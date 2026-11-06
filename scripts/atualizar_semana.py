"""Publica uma edição Mon–Sun coerente; nunca muda apenas o rótulo da semana."""
import argparse,concurrent.futures,csv,datetime as dt,hashlib,io,json,re,urllib.request
from pathlib import Path
from zoneinfo import ZoneInfo
from estatisticas import profile,summary,predict,METHOD,VERSION
from importar_remates import ALIASES,count,CODES
ROOT=Path(__file__).resolve().parents[1]
COMP=dict(zip(['PT','EN','ES','IT','FR','DE','DE2','NL','SC','UCL','UEL','UECL'],['POR_1_primeira-liga','ENG_1_premier-league','ESP_1_la-liga','ITA_1_serie-a','FRA_1_ligue-1','GER_1_bundesliga','GER_2_2-bundesliga','NED_1_eredivisie','SCO_1_premiership','UEFA_1_champions-league','UEFA_1_europa-league','UEFA_1_conference-league']))
EXTRA={x.split('_')[0]:x for x in ['AUT_1_bundesliga','BEL_1_pro-league','CRO_1_hnl','CYP_1_first-division','CZE_1_chance-liga','DEN_1_superliga','FIN_1_veikkausliiga','GRE_1_super-league','KAZ_1_premier-league','NOR_1_eliteserien','POL_1_ekstraklasa','ROU_1_liga-1','SUI_1_super-league','SVK_1_nike-liga','SVN_1_prva-liga','SWE_1_allsvenskan','TUR_1_super-lig','UKR_1_premier-league']}
EXTRA_NAMES={'Slavia Praha':'Slavia Prague','Sparta Praha':'Sparta Prague','Viktoria Plzen':'Plzen','KuPS Kuopio':'KuPS','Gent':'KAA Gent','Lillestrøm':'Lillestrom','Copenhagen':'FC Copenhagen','Nordsjælland':'Nordsjaelland','Union SG':'Union St.-Gilloise','Dinamo Zagreb':'Din. Zagreb','Universitatea Craiova':'Univ. Craiova','Atleti':'Ath Madrid','Bayern München':'Bayern Munich','B. Dortmund':'Borussia Dortmund','Leipzig':'RB Leipzig','Paris':'Paris SG','Braga':'Sp Braga','N.E.C.':'Nijmegen','Shakhtar':'Shakhtar Donetsk','S. Bratislava':'Slovan Bratislava','Bodø/Glimt':'Bodo/Glimt','Olympiacos':'Olympiakos','Fenerbahçe':'Fenerbahce','Ferencváros':'Ferencvaros','GNK Dinamo':'Dinamo Zagreb','L. Red Imps':'Lincoln Red Imps','U. Craiova':'Universitatea Craiova','H. Beer-Sheva':'Hapoel Beer Sheva'}
BASE='https://raw.githubusercontent.com/oladeeayo/open-matchday/master/data'
def week(today):
 start=today-dt.timedelta(days=today.weekday());return start.isoformat(),(start+dt.timedelta(days=6)).isoformat()
def save(p,d):
 p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(d,ensure_ascii=False,separators=(',',':'),allow_nan=False)+'\n')
def identity(lg,h,a):return int(hashlib.sha256((lg+'|'+h+'|'+a).encode()).hexdigest()[:12],16)
def canonical(s):
 import unicodedata
 s=EXTRA_NAMES.get(s,s);s=EXTRA_NAMES.get(s,s);s=ALIASES.get(s,s)
 return ''.join(c for c in unicodedata.normalize('NFKD',s).casefold() if c.isalnum())
def kickoff(r):
 # Fonte documenta UTC+1 fixo. Converter para Europe/Lisbon.
 if not re.fullmatch(r'\d{2}:\d{2}',r.get('time','')):return None
 return dt.datetime.fromisoformat(r['date']+'T'+r['time']).replace(tzinfo=dt.timezone(dt.timedelta(hours=1))).astimezone(ZoneInfo('Europe/Lisbon'))
def team_results(rows,name,cutoff):
 out=[]
 for r in rows:
  if r['date']>=cutoff or name not in (canonical(r['home']),canonical(r['away'])):continue
  h=canonical(r['home'])==name;gf=count(r['ft_home' if h else 'ft_away']);ga=count(r['ft_away' if h else 'ft_home'])
  if gf is None or ga is None:continue
  out.append(dict(date=r['date'],opponent=r['away'] if h else r['home'],venue='C' if h else 'F',gf=gf,ga=ga,outcome='V' if gf>ga else 'E' if gf==ga else 'D',sourceUrl=r['sourceUrl'],competition=r['league'],shotsFor=count(r.get('home_target' if h else 'away_target')),shotsAgainst=count(r.get('away_target' if h else 'home_target'))))
 return sorted(out,key=lambda r:r['date'],reverse=True)
def build(now,cache=None):
 html=(ROOT/'index.html').read_text();pattern=r'(<script id="data-json" type="application/json">)(.*?)(</script>)';old=json.loads(re.search(pattern,html,re.S)[2]);start,end=week(now.date());year=now.year-(now.month<7);season=str(year)[2:]+str(year+1)[2:]
 def fetch(job):
  lg,kind=job;url=f'{BASE}/{(COMP|EXTRA)[lg]}/{kind}_{season}.csv';path=cache/f'{lg}-{kind}.csv' if cache else None
  if path and path.exists():raw=path.read_text()
  else:
   raw=urllib.request.urlopen(url,timeout=40).read().decode('utf-8-sig')
   if path:path.parent.mkdir(parents=True,exist_ok=True);path.write_text(raw)
  reader=csv.DictReader(io.StringIO(raw));required={'date','home','away'}|({'ft_home','ft_away'} if kind=='results' else {'time'})
  if not required.issubset(reader.fieldnames or []):raise ValueError('Formato inválido: '+url)
  return (lg,kind),[dict(r,league=lg,sourceUrl=url) for r in reader if re.fullmatch(r'\d{4}-\d{2}-\d{2}',r.get('date',''))]
 with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:source=dict(pool.map(fetch,[(lg,k) for lg in COMP for k in ('fixtures','results')]+[(lg,'results') for lg in EXTRA]))
 all_results=[r for (lg,k),rs in source.items() if k=='results' for r in rs if r['date']<now.date().isoformat()]
 # Older seasons are used only for H2H, never mixed into current-season form.
 archive=[];archive_errors=[]
 def fetch_history(job):
  lg,ss=job
  # Football-Data retains prior seasons; open-matchday is the current-season source.
  football=lg in CODES
  url=f'https://www.football-data.co.uk/mmz4281/{ss}/{CODES[lg]}.csv' if football else f'{BASE}/{COMP[lg]}/results_{ss}.csv'
  path=cache/f'{lg}-history-{ss}.csv' if cache else None
  try:
   if path and path.exists():raw=path.read_text()
   else:
    try:raw=urllib.request.urlopen(url,timeout=40).read().decode('utf-8-sig')
    except Exception as exc:
     if getattr(exc,'code',None)==404:raise
     raw=urllib.request.urlopen(url,timeout=40).read().decode('utf-8-sig')
   if path:path.parent.mkdir(parents=True,exist_ok=True);path.write_text(raw)
   out=[]
   for r in csv.DictReader(io.StringIO(raw)):
    if football:
     try:date=dt.datetime.strptime(r['Date'],'%d/%m/%Y').date().isoformat()
     except (ValueError,KeyError):continue
     r=dict(date=date,home=r['HomeTeam'],away=r['AwayTeam'],ft_home=r['FTHG'],ft_away=r['FTAG'],home_target=r.get('HST'),away_target=r.get('AST'))
    if re.fullmatch(r'\d{4}-\d{2}-\d{2}',r.get('date','')):out.append(dict(r,league=lg,sourceUrl=url))
   return out,None
  except Exception:return [],url

 with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
  for rows,error in pool.map(fetch_history,[(lg,str(y)[2:]+str(y+1)[2:]) for lg in COMP for y in (year-1,year-2)]):
   archive.extend(rows)
   if error:archive_errors.append(error)
 analysis=dict(schema=1,edition=start,generatedAt=now.isoformat(),historyUnavailable=archive_errors,method=METHOD,modelVersion=VERSION,byGame={})
 games=[];seen=set()
 for lg in COMP:
  for r in source[lg,'results']+source[lg,'fixtures']:
   ko=kickoff(r);date=ko.date().isoformat() if ko else r['date']
   if not start<=date<=end:continue
   key=(lg,r['home'],r['away'])
   if key in seen:continue
   seen.add(key);games.append(dict(id=identity(*key),league=lg,date=date,day=int(date[-2:]),time=ko.strftime('%H:%M') if ko else '—',home=r['home'],away=r['away'],p={},first={},second={},c85=None,c95=None,verified=False,kickoff=ko.isoformat() if ko else None,kickoffVerified=False,sourceUrl=r['sourceUrl'],robust='Modelo não calibrado'))
 games.sort(key=lambda g:(g['date'],g['time'],g['league'],g['home']))
 if not games:raise ValueError('Nenhum jogo publicado para a semana atual; conservar edição e mostrar aviso de desatualização.')
 priorpath=ROOT/f'dados/modelo-golos-{start}.json';prior=json.loads(priorpath.read_text())['games'] if priorpath.exists() else {}
 model=dict(schema=1,edition=dict(start=start,end=end),generatedAt=now.isoformat(),model=dict(method=METHOD,calibrated=False),games={})
 hist=dict(schema=1,period=dict(start=start,end=end),builtOn=now.isoformat(),asOfExclusive=now.date().isoformat(),byGame={})
 shots=dict(schema=1,edition=start,retrievedAt=now.isoformat(),definition='Remates à baliza publicados por open-matchday; valores ausentes não são zero.',byGame={})
 for g in games:
  gid=str(g['id']);cutoff=min(g['date'],now.date().isoformat());latest={s:team_results(all_results,canonical(g[s]),cutoff) for s in ('home','away')}
  hist['byGame'][gid]={'date':g['date'],**{s:dict(name=g[s],available=len(latest[s][:10]),complete=len(latest[s])>=10,results=latest[s][:10]) for s in latest}}
  shots['byGame'][gid]={s:dict(team=g[s],sourceTeam=g[s],source=f'{BASE}/{COMP[g["league"]]}/results_{season}.csv',status='available' if latest[s] else 'team_not_matched',results=[dict(date=r['date'],opponent=r['opponent'],venue=r['venue'],**{'for':r['shotsFor'],'against':r['shotsAgainst']}) for r in latest[s]]) for s in latest}
  # Domestic fixtures use their league only; European fixtures use all covered competitions.
  pool_rows=all_results if g['league'].startswith('U') else [r for r in all_results if r['league']==g['league']]
  full={side:team_results(pool_rows,canonical(g[side]),cutoff) for side in ('home','away')}
  profiles={side:profile(full[side]) for side in full}
  direct=[r for r in team_results(archive+all_results,canonical(g['home']),cutoff) if canonical(r['opponent'])==canonical(g['away'])]
  direct=list({(r['date'],r['venue']):r for r in direct}.values());direct.sort(key=lambda r:r['date'],reverse=True);direct=direct[:10]
  league_rows=[r for r in all_results if r['league']==g['league'] and r['date']<cutoff and count(r.get('ft_home')) is not None and count(r.get('ft_away')) is not None]
  mh=sum(int(r['ft_home']) for r in league_rows)/len(league_rows) if league_rows else 1.35
  ma=sum(int(r['ft_away']) for r in league_rows)/len(league_rows) if league_rows else 1.35
  analysis['byGame'][gid]=dict(teams=profiles,h2h=dict(all=summary(direct),sameVenue=summary([r for r in direct if r['venue']=='C']),historySeasons=3,partial=any(COMP[g['league']] in u or (g['league'] in CODES and '/'+CODES[g['league']]+'.csv' in u) for u in archive_errors)),cutoff=cutoff,scope='Competições disponíveis' if g['league'].startswith('U') else 'Campeonato',sources=sorted(set(r['sourceUrl'] for side in full for r in full[side])))
  m={k:g[k] for k in ('id','league','date','home','away')};m['latest']={s:latest[s][:7] for s in latest};m['counts']=dict(home=len(m['latest']['home']),away=len(m['latest']['away']),homeAtHome=sum(r['venue']=='C' for r in m['latest']['home']),awayAtAway=sum(r['venue']=='F' for r in m['latest']['away']))
  past=bool(g['kickoff'] and dt.datetime.fromisoformat(g['kickoff'])<=now) or g['date']<now.date().isoformat()
  if past and gid in prior and prior[gid]['date']==g['date']:m=prior[gid]
  else:
   e=None if past else predict(profiles['home'],profiles['away'],mh,ma,direct,cutoff);m.update(e or {});m['counts']=dict(home=profiles['home']['all']['season']['n'],away=profiles['away']['all']['season']['n'],homeAtHome=profiles['home']['home']['season']['n'],awayAtAway=profiles['away']['away']['season']['n']);m.update(status='estimativa_nao_calibrada' if e else 'nao_publicada_antes_do_jogo' if past else 'amostra_insuficiente',calculatedAt=now.isoformat(),backtestEligible=bool(e),unavailableReason='Jogo já iniciado sem previsão publicada previamente.' if past else 'Amostra insuficiente: são necessários 5 jogos e 2 no recinto relevante por equipa.')
  model['games'][gid]=m
  analysis['byGame'][gid]['forecastVersion']=m.get('modelVersion','published-poisson-v1')
 model['coverage']=dict(total=len(games),estimated=sum(bool(g.get('prob')) for g in model['games'].values()));model['coverage']['unavailable']=len(games)-model['coverage']['estimated']
 standings=dict(calculatedUntil=max(r['date'] for r in all_results),leagues={})
 for lg in COMP:
  if lg.startswith('U'):continue
  league_rows=[r for r in all_results if r['league']==lg]
  names=sorted(set(r[side] for r in league_rows for side in ('home','away')))
  teams=[]
  for name in names:
   rs=team_results(league_rows,canonical(name),now.date().isoformat());pr=profile(rs);base=pr['all']['season']
   teams.append(dict(name=name,key=canonical(name),p=base['n'],pts=base['pts'],gf=base['gf'],ga=base['ga'],recent=[dict(r,home=r['venue']=='C',result=r['outcome'],score=f"{r['gf']}-{r['ga']}") for r in rs[:10]],splits=pr))
  standings['leagues'][lg]={'standings':sorted(teams,key=lambda t:(-t['pts'],t['ga']-t['gf'],-t['gf']))}

 D={**old,'start':start,'end':end,'games':games,'top20':[],'marketOdds':old.get('marketOdds',[]) if old['start']==start else [],'dataThrough':standings['calculatedUntil'],'retrievedOn':now.date().isoformat(),'updatedAt':now.isoformat(),'standingsFile':f'dados/classificacoes-{start}.json','statisticsFile':f'dados/estatisticas-{start}.json','calendarSource':'open-matchday','calendarNote':'Horários de Lisboa convertidos da convenção UTC+1 da fonte; confirmar alterações junto da competição.'}
 for league in D['leagues']:league['count']=sum(g['league']==league['code'] for g in games)
 # All downloads/validation finish before any published edition is replaced.
 if old['start']!=start:save(ROOT/f'historico/edicoes/{old["start"]}.json',old)
 for name,d in [('modelo-golos',model),('ultimos10',hist),('remates',shots),('classificacoes',standings),('estatisticas',analysis)]:save(ROOT/f'dados/{name}-{start}.json',d)
 html=re.sub(pattern,lambda m:m[1]+json.dumps(D,ensure_ascii=False,separators=(',',':'))+m[3],html,flags=re.S)
 html=re.sub(r'(<span class="header-meta">).*?(</span>)',lambda m:m[1]+f'{start} — {end}'+m[2],html)
 html=re.sub(r'<title>.*?</title>',f'<title>Apostas Semanais | {start} a {end}</title>',html)
 html=re.sub(r'<meta name="description" content="[^"]*">',f'<meta name="description" content="Apostas Semanais: {len(games)} jogos de {start} a {end}; 1/X/2, Ambas Marcam, +2,5 e AM e +2,5.">',html)
 html=re.sub(r'<footer class="footer">.*?</footer>',f'<footer class="footer">APOSTAS SEMANAIS · {start} a {end} · Atualizado em {now.strftime("%d/%m/%Y %H:%M")} · Hora de Lisboa<br>Atualização automática do calendário e estatísticas; sem resultados em direto.</footer>',html,flags=re.S)
 html=re.sub(r'<p class="hero-desc">.*?</p>',f'<p class="hero-desc">Semana de {start} a {end} · Análise de futebol, golos, forma recente e remates à baliza.</p>',html,flags=re.S)
 html=re.sub(r'<div class="hero-pdf">.*?</div>',f'<div class="hero-pdf"><span>{len(games)} jogos na edição atual. Estimativas apenas quando existe amostra suficiente; consultar a cobertura de cada encontro.</span></div>',html,flags=re.S)
 (ROOT/'index.html').write_text(html);print(json.dumps(dict(edition=start,coverage=model['coverage'],leagues={lg:sum(g['league']==lg for g in games) for lg in COMP}),ensure_ascii=False))
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--source-cache',type=Path);p.add_argument('--now');a=p.parse_args();build(dt.datetime.fromisoformat(a.now).astimezone(ZoneInfo('Europe/Lisbon')) if a.now else dt.datetime.now(ZoneInfo('Europe/Lisbon')),a.source_cache)
