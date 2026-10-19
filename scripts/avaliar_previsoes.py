#!/usr/bin/env python3
"""Avalia apenas previsões arquivadas antes dos jogos contra resultados validados.

Não obtém dados da internet, não gera previsões e não inventa resultados.
As fontes de resultados têm de ser introduzidas e verificadas separadamente.
"""

import argparse
import datetime as dt
import json
import math
from collections import defaultdict
from pathlib import Path
from zoneinfo import ZoneInfo

PORTUGAL = ZoneInfo("Europe/Lisbon")
UTC = dt.timezone.utc
MARKETS = ("w1", "draw", "w2", "o15", "o25", "btts", "no", "and", "or")
HALF = {"HT1": ("first", "w1"), "HT2": ("first", "w2"),
        "SH1": ("second", "w1"), "SH2": ("second", "w2")}
CORNERS = {"C85": "o85", "C95": "o95"}
MIN_EPS = 1e-12


def valid_probability(value):
    return type(value) in (float, int) and math.isfinite(value) and 0 <= value <= 1


def parse_archive_at(value):
    if not isinstance(value, str):
        return None
    try:
        parsed = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
        return parsed.astimezone(UTC) if parsed.tzinfo else None
    except (ValueError, TypeError):
        return None


def game_time(game):
    date = game.get("date")
    time = game.get("time_pt")
    if not isinstance(date, str) or not isinstance(time, str):
        return None
    try:
        local = dt.datetime.fromisoformat(f"{date}T{time}").replace(tzinfo=PORTUGAL)
        return local.astimezone(UTC)
    except (ValueError, TypeError):
        return None


def integer_score(value):
    return type(value) is int and 0 <= value < 50


def valid_result(game, result):
    if not isinstance(result, dict) or result.get("verified") is not True:
        return False
    if result.get("status") not in ("FT", "FINAL"):
        return False
    source = result.get("source")
    if not isinstance(source, str) or not source.startswith("https://"):
        return False
    if result.get("date") != game.get("date"):
        return False
    if (result.get("home"), result.get("away")) != (game.get("home"), game.get("away")):
        return False
    return integer_score(result.get("home_goals")) and integer_score(result.get("away_goals"))


def event_outcomes(result):
    h, a = result["home_goals"], result["away_goals"]
    total = h + a
    btts = h >= 1 and a >= 1
    events = {
        "w1": int(h > a), "draw": int(h == a), "w2": int(h < a),
        "o15": int(total >= 2), "o25": int(total >= 3),
        "btts": int(btts), "no": int(not btts),
        "and": int(btts and total >= 3), "or": int(btts or total >= 3)
    }
    if integer_score(result.get("half_home")) and integer_score(result.get("half_away")):
        hh, ha = result["half_home"], result["half_away"]
        if hh <= h and ha <= a:
            events["HT1"] = int(hh > ha)
            events["HT2"] = int(hh < ha)
            events["SH1"] = int((h - hh) > (a - ha))
            events["SH2"] = int((h - hh) < (a - ha))
    corners = result.get("corners_total")
    if type(corners) is int and corners >= 0:
        events["C85"] = int(corners >= 9)
        events["C95"] = int(corners >= 10)
    return events


def brier(p, actual):
    return (p - actual) ** 2


def logloss(p, actual):
    p = min(1 - MIN_EPS, max(MIN_EPS, p))
    return -(actual * math.log(p) + (1 - actual) * math.log(1 - p))


def record_row(game, k, probability, actual):
    return {
        "game_id": game["id"], "league": game.get("league"),
        "market": k, "probability": probability, "actual": actual,
        "correct_classification": int((probability >= .5) == bool(actual)),
        "brier": round(brier(probability, actual), 8),
        "log_loss": round(logloss(probability, actual), 8)
    }


def group_metrics(rows, name):
    out = []
    groups = defaultdict(list)
    for row in rows:
        groups[row[name]].append(row)
    for label, data in sorted(groups.items(), key=lambda x: str(x[0])):
        n = len(data)
        out.append({
            name: label, "evaluated": n,
            "correct": sum(x["correct_classification"] for x in data),
            "hit_rate": round(sum(x["correct_classification"] for x in data) / n, 4),
            "brier": round(sum(x["brier"] for x in data) / n, 5),
            "log_loss": round(sum(x["log_loss"] for x in data) / n, 5)
        })
    return out


def calibration_bins(rows):
    bins = [[] for _ in range(10)]
    for row in rows:
        index = min(9, int(10 * row["probability"]))
        bins[index].append(row)
    return [{
        "range": f"{n*10}-{(n+1)*10}%",
        "count": len(data),
        "predicted_mean": round(sum(x["probability"] for x in data) / len(data), 4) if data else None,
        "observed_rate": round(sum(x["actual"] for x in data) / len(data), 4) if data else None
    } for n, data in enumerate(bins)]


def evaluate(archive, results):
    week = archive.get("week_start")
    if not isinstance(week, str) or week != results.get("week_start"):
        raise ValueError("O período dos resultados não corresponde ao arquivo de previsões.")
    when = parse_archive_at(archive.get("archived_at"))
    if when is None:
        raise ValueError("O arquivo tem de conter um timestamp de publicação válido e com fuso horário.")
    source_games = archive.get("games")
    result_games = results.get("games")
    if not isinstance(source_games, list) or not isinstance(result_games, list):
        raise ValueError("Faltam as listas de jogos.")
    by_id = {x.get("id"): x for x in result_games if isinstance(x, dict)}
    rows, assessed_ids, issues = [], set(), []
    games_map = {}
    for game in source_games:
        if not isinstance(game, dict):
            continue
        gid = game.get("id")
        if gid in games_map:
            issues.append(f"id duplicado no arquivo: {gid}")
            continue
        games_map[gid] = game
        game_start = game_time(game)
        if game_start is None:
            issues.append(f"jogo {gid}: data/hora pré-jogo inválidas")
            continue
        if when >= game_start:
            issues.append(f"jogo {gid}: previsão publicada depois do início")
            continue
        result = by_id.get(gid)
        if result is None:
            continue
        if not valid_result(game, result):
            issues.append(f"jogo {gid}: resultado sem verificação, fonte ou correspondência")
            continue
        outcomes = event_outcomes(result)
        measured = 0
        for key, p in (game.get("probabilities") or {}).items():
            if key in MARKETS and key in outcomes and valid_probability(p):
                rows.append(record_row(game, key, p, outcomes[key]))
                measured += 1
        for label, (field, key) in HALF.items():
            p = (game.get(field) or {}).get(key)
            if label in outcomes and valid_probability(p):
                rows.append(record_row(game, label, p, outcomes[label]))
                measured += 1
        for label, key in CORNERS.items():
            p = (game.get("corners") or {}).get(key)
            if label in outcomes and valid_probability(p):
                rows.append(record_row(game, label, p, outcomes[label]))
                measured += 1
        if measured:
            assessed_ids.add(gid)
    outcome_index = {(r["game_id"], r["market"]): r["actual"] for r in rows}
    top_rows = []
    for pick in archive.get("top20") or []:
        if not isinstance(pick, dict):
            continue
        key = str(pick.get("market") or "")
        aliases = {"O15":"o15","O25":"o25","BTTS":"btts","W1":"w1","W2":"w2",
                   "AND":"and","OR":"or","X":"draw","BTTS_NO":"no"}
        assessed_key = aliases.get(key, key)
        target = outcome_index.get((pick.get("id"), assessed_key))
        if target is not None and valid_probability(pick.get("p")):
            top_rows.append({"game_id": pick["id"], "market": key,
                             "correct": bool(target), "probability": pick["p"]})
    num = len(rows)
    summary = {
        "games_evaluated": len(assessed_ids),
        "markets_evaluated": num,
        "picks_evaluated": len(top_rows),
        "picks_correct": sum(p["correct"] for p in top_rows),
        "hit_rate": round(sum(p["correct"] for p in top_rows) / len(top_rows), 4) if top_rows else None,
        "brier": round(sum(x["brier"] for x in rows) / num, 5) if num else None,
        "log_loss": round(sum(x["log_loss"] for x in rows) / num, 5) if num else None
    }
    return {
        "schema": 2, "week": week, "archived_at": archive["archived_at"],
        "model_version": archive.get("model_version"), "source": results.get("source"),
        "status": "avaliado" if assessed_ids else "sem resultados elegíveis",
        "summary": summary, "markets": group_metrics(rows, "market"),
        "leagues": group_metrics(rows, "league"), "calibration": calibration_bins(rows),
        "top20_results": top_rows, "game_ids_evaluated": sorted(assessed_ids),
        "rows": rows, "issues": issues
    }


def accumulate(evaluations):
    data = [x for x in evaluations if isinstance(x, dict) and x.get("schema") == 2]
    seen = {}
    for item in data:
        seen[item.get("week")] = item
    items = [seen[k] for k in sorted(seen) if k]
    all_rows = [row for item in items for row in item.get("rows", [])]
    picks = [pick for item in items for pick in item.get("top20_results", [])]
    game_count = sum(x.get("summary", {}).get("games_evaluated", 0) for x in items)
    n = len(all_rows)
    summary = {
        "games_evaluated": game_count or None,
        "markets_evaluated": n or None,
        "picks_evaluated": len(picks) or None,
        "picks_correct": sum(bool(x["correct"]) for x in picks) if picks else None,
        "hit_rate": round(sum(bool(x["correct"]) for x in picks) / len(picks), 4) if picks else None,
        "brier": round(sum(x["brier"] for x in all_rows) / n, 5) if n else None,
        "log_loss": round(sum(x["log_loss"] for x in all_rows) / n, 5) if n else None
    }
    weeks = [{
        "week": x["week"], **x.get("summary", {})
    } for x in items]
    return {
        "schema": 2, "last_updated": dt.datetime.now(UTC).isoformat(),
        "status": "Avaliações verificadas" if n else "Sem resultados apurados ainda",
        "summary": summary, "weeks": weeks, "markets": group_metrics(all_rows, "market"),
        "leagues": group_metrics(all_rows, "league"), "calibration": calibration_bins(all_rows)
    }


def save_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    tmp.replace(path)


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--previsoes", type=Path, required=True)
    p.add_argument("--resultados", type=Path, required=True)
    p.add_argument("--historico-dir", type=Path, default=Path("historico"))
    args = p.parse_args()
    if not args.resultados.exists():
        raise SystemExit("O ficheiro de resultados oficiais verificados ainda não existe. Nenhuma métrica foi gerada.")
    predictions = json.loads(args.previsoes.read_text(encoding="utf-8"))
    results = json.loads(args.resultados.read_text(encoding="utf-8"))
    assessed = evaluate(predictions, results)
    path = args.historico_dir / f"{predictions['week_start']}-avaliacao.json"
    evaluations = []
    for existing in args.historico_dir.glob("*-avaliacao.json"):
        if existing != path:
            evaluations.append(json.loads(existing.read_text(encoding="utf-8")))
    evaluations.append(assessed)
    save_json(path, assessed)
    save_json(args.historico_dir / "desempenho.json", accumulate(evaluations))
    print(f"Semana {assessed['week']}: {assessed['summary']['games_evaluated']} jogos elegíveis; "
          f"{assessed['summary']['markets_evaluated']} probabilidades avaliadas.")
    print("Não houve alterações automáticas ao modelo; validar cada proposta com backtest temporal.")


if __name__ == "__main__":
    main()
