#!/usr/bin/env python3
"""Casos sintéticos e isolados; não são resultados reais nem previsões publicadas."""
import unittest
from avaliar_previsoes import evaluate, accumulate, brier, logloss


def forecasts(archived_at="2026-10-19T08:00:00Z"):
    return {
        "schema": 1, "week_start": "2026-10-19", "week_end": "2026-10-25",
        "archived_at": archived_at, "model_version": "v1-test",
        "games": [{
            "id": 1, "league": "PT", "date": "2026-10-19",
            "time_pt": "18:00", "home": "Equipa A", "away": "Equipa B",
            "probabilities": {
                "w1": 0.6, "draw": 0.2, "w2": 0.2,
                "o15": 0.8, "o25": 0.65, "btts": 0.7,
                "no": 0.3, "and": 0.6, "or": 0.75
            },
            "first": {"w1": 0.4, "w2": 0.2},
            "second": {"w1": 0.5, "w2": 0.2},
            "corners": {"o85": 0.6, "o95": 0.5}
        }],
        "top20": [{"id": 1, "market": "O25", "p": 0.65},
                  {"id": 1, "market": "BTTS", "p": 0.7},
                  {"id": 1, "market": "W1", "p": 0.6}]
    }


def results(verified=True):
    return {
        "week_start": "2026-10-19", "source": "fonte confirmada por teste",
        "games": [{
            "id": 1, "date": "2026-10-19",
            "home": "Equipa A", "away": "Equipa B",
            "home_goals": 2, "away_goals": 1,
            "half_home": 1, "half_away": 0,
            "corners_total": 11,
            "status": "FT", "verified": verified,
            "source": "https://example.org/fixture-source"
        }]
    }


class ForecastVerificationTests(unittest.TestCase):
    def test_brier_and_log_loss(self):
        self.assertAlmostEqual(brier(.6, 1), .16, places=6)
        self.assertGreater(logloss(.6, 1), 0)

    def test_eligible_pre_match_results(self):
        evaluated = evaluate(forecasts(), results())
        s = evaluated["summary"]
        self.assertEqual(s["games_evaluated"], 1)
        self.assertEqual(s["markets_evaluated"], 15)
        self.assertEqual(s["picks_evaluated"], 3)
        self.assertEqual(s["picks_correct"], 3)
        self.assertEqual(len(evaluated["calibration"]), 10)
        self.assertEqual(evaluated["status"], "avaliado")
        self.assertTrue(all(0 <= x["actual"] <= 1 for x in evaluated["rows"]))
        self.assertIn("PT", [row["league"] for row in evaluated["leagues"]])

    def test_rejects_unverified_results(self):
        evaluated = evaluate(forecasts(), results(verified=False))
        self.assertEqual(evaluated["summary"]["games_evaluated"], 0)
        self.assertEqual(evaluated["summary"]["picks_evaluated"], 0)

    def test_excludes_forecasts_created_after_kickoff(self):
        evaluated = evaluate(forecasts("2026-10-19T22:00:00Z"), results())
        self.assertEqual(evaluated["summary"]["games_evaluated"], 0)
        self.assertTrue(any("depois do início" in e for e in evaluated["issues"]))

    def test_mismatched_fixture_is_excluded(self):
        r = results()
        r["games"][0]["away"] = "Equipa Diferente"
        self.assertEqual(evaluate(forecasts(), r)["summary"]["games_evaluated"], 0)

    def test_week_cannot_be_changed(self):
        r = results()
        r["week_start"] = "2026-10-26"
        with self.assertRaises(ValueError):
            evaluate(forecasts(), r)

    def test_accumulated_summaries(self):
        w = evaluate(forecasts(), results())
        acc = accumulate([w])
        self.assertEqual(acc["summary"]["games_evaluated"], 1)
        self.assertEqual(acc["summary"]["picks_correct"], 3)
        self.assertEqual(len(acc["weeks"]), 1)
        self.assertGreater(acc["summary"]["brier"], 0)


if __name__ == "__main__":
    unittest.main()
