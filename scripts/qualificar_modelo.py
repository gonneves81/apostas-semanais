"""Auditoria, testes temporais e arquivo imutável. Nunca promove um modelo só por acertar no treino."""
import csv,json,math,re,datetime as dt,argparse,urllib.request,io,hashlib,collections
from pathlib import Path
from zoneinfo import ZoneInfo
from importar_remates import ALIASES,CODES
ROOT=Path(__file__).resolve().parents[1];KEYS=['W1','X','W2','BTTS','O25','AND']
VERSIONS=['base','recencia_adversario','remates','xg']
def read(p):return json.loads(p.read_text())
def save(p,x):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(x,ensure_ascii=False,separators=(',',':'),allow_nan=False)+'\n')
def number(x):
 try:
  n=float(x);return n if math.isfinite(n) and n>=0 else None
 except (ValueError,TypeError):return None

def probabilities(h,a):
 H=[math.exp(-h)];A=[math.exp(-a)]
 for i in range(1,65):H.append(H[-1]*h/i);A.append(A[-1]*a/i)
 p={k:0. for k in KEYS}
 for i,x in enumerate(H):
  for j,y in enumerate(A):
   z=x*y;p['W1' if i>j else 'X' if i==j else 'W2']+=z
   if i and j:p['BTTS']+=z
   if i+j>2:p['O25']+=z
   if i and j and i+j>2:p['AND']+=z
 return p

def features(history,team,home,version):
 rows=[]
 for r in reversed(history):
  if team not in (r['home'],r['away']):continue
  own=r['home']==team;gf=r['hg'] if own else r['ag'];ga=r['ag'] if own else r['hg']
  sf=r['hst'] if own else r['ast'];sa=r['ast'] if own else r['hst'];xf=r['hxg'] if own else r['axg'];xa=r['axg'] if own else r['hxg']
  rows.append({'gf':gf,'ga':ga,'sf':sf,'sa':sa,'xf':xf,'xa':xa,'venue':own,'opp':r['away'] if own else r['home']})
  if len(rows)==(7 if version=='base' else 20):break
 if len(rows)<5:return None
 venue=[r for r in rows if r['venue']==home]
 if len(venue)<2:return None
 def avg(rs,k,prior):
  pairs=[(r[k],1 if version=='base' else .93**i) for i,r in enumerate(rs) if r[k] is not None]
  return (sum(x*w for x,w in pairs)+5*prior)/(sum(w for _,w in pairs)+5)
 f=.65*avg(venue,'gf',1.35)+.35*avg(rows,'gf',1.35);a=.65*avg(venue,'ga',1.35)+.35*avg(rows,'ga',1.35)
 if version!='base':
  # Opponent strength only from earlier matches; shrink small samples towards league mean.
  means=[]
  for r in rows:
   opp=[x for x in history if r['opp'] in (x['home'],x['away'])][-20:]
   gf=sum(x['hg'] if x['home']==r['opp'] else x['ag'] for x in opp);ga=sum(x['ag'] if x['home']==r['opp'] else x['hg'] for x in opp)
   means.append(((gf+6.75)/(len(opp)+5),(ga+6.75)/(len(opp)+5)))
  f*=1.35/(sum(x[1] for x in means)/len(means));a*=1.35/(sum(x[0] for x in means)/len(means))
 if version in ('remates','xg'):
  k1,k2,prior=('sf','sa',4.5) if version=='remates' else ('xf','xa',1.35)
  if sum(r[k1] is not None and r[k2] is not None for r in rows)<5:return None
  scale=.3 if version=='remates' else 1
  f=.8*f+.2*scale*avg(rows,k1,prior);a=.8*a+.2*scale*avg(rows,k2,prior)
 return f,a

def predict(history,r,v):
 h=features(history,r['home'],True,v);a=features(history,r['away'],False,v)
 if h is None or a is None:return None
 return probabilities(min(6,max(.15,(h[0]+a[1])/2)),min(6,max(.15,(a[0]+h[1])/2)))
def outcomes(r):
 h,a=r['hg'],r['ag'];return dict(zip(KEYS,[h>a,h==a,h<a,h>0 and a>0,h+a>=3,h>0 and a>0 and h+a>=3]))
def score(rows):
 if not rows:return {'n':0,'brier':None,'logLoss':None}
 pairs=[(p,y) for row in rows for p,y in zip(row['p'],row['y'])]
 return {'n':len(rows),'brier':sum((p-y)**2 for p,y in pairs)/len(pairs),'logLoss':-sum(y*math.log(max(p,1e-12))+(1-y)*math.log(max(1-p,1e-12)) for p,y in pairs)/len(pairs)}
def backtest(rows,season):
 tested={v:[] for v in VERSIONS};hist=collections.defaultdict(list);current=[r for r in rows if r['season']==season];dates=sorted(set(r['date'] for r in current));split=dates[len(dates)//2] if dates else '9999';bydate=collections.defaultdict(list)
 for r in rows:bydate[r['date']].append(r)
 for date in sorted(bydate):
  for r in bydate[date]:
   if r['season']!=season:continue
   for v in VERSIONS:
    p=predict(hist[r['league']],r,v)
    if p:tested[v].append({'id':r['id'],'league':r['league'],'date':date,'p':[p[k] for k in KEYS],'y':[int(outcomes(r)[k]) for k in KEYS]})
  for r in bydate[date]:hist[r['league']].append(r)
 # Select using validation ONLY; compare on identical matches to avoid coverage bias.
 comparisons={}
 for v in VERSIONS:
  ids={r['id'] for r in tested[v]} & {r['id'] for r in tested['base']}
  base=[r for r in tested['base'] if r['id'] in ids];candidateRows=[r for r in tested[v] if r['id'] in ids]
  comparisons[v]={'validation':score([r for r in candidateRows if r['date']<split]),'test':score([r for r in candidateRows if r['date']>=split]),'baselineValidationSameGames':score([r for r in base if r['date']<split]),'baselineTestSameGames':score([r for r in base if r['date']>=split])}
 eligible=[v for v in VERSIONS[1:] if comparisons[v]['validation']['n']>=100 and comparisons[v]['validation']['brier']<comparisons[v]['baselineValidationSameGames']['brier'] and comparisons[v]['validation']['logLoss']<comparisons[v]['baselineValidationSameGames']['logLoss']]
 candidate=min(eligible,key=lambda v:comparisons[v]['validation']['brier']-comparisons[v]['baselineValidationSameGames']['brier']) if eligible else None
 c=comparisons.get(candidate,{});t=c.get('test',{});b=c.get('baselineTestSameGames',{})
 evidence=bool(t.get('n',0)>=200 and t['brier']<b['brier'] and t['logLoss']<b['logLoss'])
 calibration=[]
 for lo in range(0,100,10):
  pairs=[(p,y) for r in tested['base'] if r['date']>=split for p,y in zip(r['p'],r['y']) if lo/100<=p<(lo+10)/100]
  calibration.append({'range':f'{lo}–{lo+10}%','n':len(pairs),'predicted':sum(p for p,y in pairs)/len(pairs) if pairs else None,'observed':sum(y for p,y in pairs)/len(pairs) if pairs else None})
 return {'splitDate':split,'training':'Época anterior e apenas jogos de datas estritamente anteriores','validation':'Primeira metade das datas da época atual','test':'Segunda metade das datas da época atual; sem afinação de pesos nesse bloco','models':comparisons,'candidate':candidate,'evidence':evidence,'promoted':False,'decision':'Revisão necessária: nenhum candidato é promovido sem calibração independente e repetição temporal.','calibration':calibration,'leagues':[{ 'league':lg,**score([r for r in tested['base'] if r['league']==lg and r['date']>=split])} for lg in CODES], 'markets':[{'market':k,**score([dict(r,p=[r['p'][i]],y=[r['y'][i]]) for r in tested['base'] if r['date']>=split])} for i,k in enumerate(KEYS)]}

def audit(D,model,history,rows,now):
 idx={(r['league'],r['date'],r['home'],r['away']):r for r in rows};issues=[];checked=0;matched=0;gameIssues=collections.defaultdict(list)
 for g in D['games']:
  m=model['games'].get(str(g['id']));
  if not m or (m['home'],m['away'],m['date'])!=(g['home'],g['away'],g['date']):gameIssues[str(g['id'])].append('Identidade do modelo divergente')
  for side in ['home','away']:
   team=ALIASES.get(g[side],g[side]);rs=history.get('byGame',{}).get(str(g['id']),{}).get(side,{}).get('results',[])
   for x in rs:
    checked+=1;opp=ALIASES.get(x['opponent'],x['opponent']);home=x['venue']=='C';key=(g['league'],x['date'],team if home else opp,opp if home else team);r=idx.get(key)
    if x['date']>=g['date']:gameIssues[str(g['id'])].append('Resultado posterior ao corte temporal')
    if not r:continue
    matched+=1
    if (x['gf'],x['ga'])!=((r['hg'],r['ag']) if home else (r['ag'],r['hg'])):
     gameIssues[str(g['id'])].append('Resultado divergente entre fontes: '+x['date']+' '+x['opponent'])
  if not re.fullmatch(r'\d\d:\d\d',g.get('time','')):gameIssues[str(g['id'])].append('Hora de início em falta')
 for gid,items in gameIssues.items():issues.append({'gameId':int(gid),'issues':sorted(set(items))})
 latest=max((r['date'] for r in rows),default=None)
 return {'checked':checked,'matched':matched,'unmatched':checked-matched,'crossSourceIssues':issues,'byGame':dict(gameIssues),'latestResultDate':latest,'sourceAgeDays':(now.date()-dt.date.fromisoformat(latest)).days if latest else None,'note':'Registos não correspondidos não contam como confirmados. Competições europeias e nomes sem correspondência podem explicar parte das diferenças.'}

def archive(D,model,aud,now):
 dest=ROOT/'historico/arquivo';dest.mkdir(parents=True,exist_ok=True);created=0;reasons=collections.Counter()
 for g in D['games']:
  m=model['games'].get(str(g['id']),{});p=m.get('prob')
  if not p:reasons['Sem probabilidades']+=1;continue
  if m.get('backtestEligible') is False:reasons['Estimativa reconstruída, excluída do arquivo pré-jogo']+=1;continue
  try:kick=dt.datetime.fromisoformat(g['date']+'T'+g['time']).replace(tzinfo=ZoneInfo('Europe/Lisbon')).astimezone(dt.timezone.utc)
  except ValueError:reasons['Horário desconhecido']+=1;continue
  if now>=kick:reasons['Encontro já iniciado segundo o calendário']+=1;continue
  identity=hashlib.sha256(f"{g['league']}|{g['date']}|{g['home']}|{g['away']}".encode()).hexdigest()[:20];path=dest/(identity+'.json')
  if path.exists():continue
  # Without explicit kickoff verification this remains provisional, never scored as a confirmed pre-match forecast.
  verified=g.get('kickoffVerified') is True and str(g.get('kickoffSource','')).startswith('https://')
  obj={'schema':1,'id':identity,'recordedAt':now.isoformat(),'game':g,'kickoff':kick.isoformat(),'kickoffVerified':verified,'evaluationEligible':verified and not aud['byGame'].get(str(g['id'])),'probabilities':probabilities(m['lambdaHome'],m['lambdaAway']),'modelVersion':m.get('modelVersion','published-poisson-v1'),'sourceModelGeneratedAt':model.get('generatedAt'),'odds':[o for o in D.get('marketOdds',[]) if o.get('gameId')==g['id']],'status':'confirmed' if verified else 'provisional_kickoff_unverified'}
  with path.open('x') as f:json.dump(obj,f,ensure_ascii=False,separators=(',',':'))
  created+=1
 files=[read(p) for p in dest.glob('*.json')]
 return {'created':created,'total':len(files),'confirmed':sum(x['evaluationEligible'] for x in files),'provisional':sum(not x['evaluationEligible'] for x in files),'excluded':dict(reasons)}

def prospective(rows):
 idx={(r['league'],r['date'],r['home'],r['away']):r for r in rows};assessed=[]
 receipts=read(ROOT/'historico/publicacoes.json') if (ROOT/'historico/publicacoes.json').exists() else {}
 for path in (ROOT/'historico/arquivo').glob('*.json'):
  archive=read(path);g=archive['game']
  receipt=receipts.get(archive['id'],{});published=receipt.get('publishedAt')
  if not archive.get('evaluationEligible') or not published:continue
  if not dt.datetime.fromisoformat(archive['recordedAt'])<=dt.datetime.fromisoformat(published)<dt.datetime.fromisoformat(archive['kickoff']):continue
  r=idx.get((g['league'],g['date'],ALIASES.get(g['home'],g['home']),ALIASES.get(g['away'],g['away'])))
  if r:assessed.append({'league':g['league'],'p':[archive['probabilities'][k] for k in KEYS],'y':[int(outcomes(r)[k]) for k in KEYS]})
 return {'summary':score(assessed),'leagues':[{'league':lg,**score([r for r in assessed if r['league']==lg])} for lg in CODES], 'markets':[{'market':k,**score([dict(r,p=[r['p'][i]],y=[r['y'][i]]) for r in assessed])} for i,k in enumerate(KEYS)]}

def main():
 ap=argparse.ArgumentParser();ap.add_argument('--csv-dir');ap.add_argument('--offline',action='store_true');args=ap.parse_args();now=dt.datetime.now(dt.timezone.utc)
 D=json.loads(re.search(r'<script id="data-json" type="application/json">(.*?)</script>',(ROOT/'index.html').read_text(),re.S)[1]);season=D['start'][2:4]+str(int(D['start'][2:4])+1);previous=str(int(season[:2])-1)+season[:2]
 snapshot=ROOT/'dados/fontes-modelo.json';rows=[];sources=[]
 if args.offline:
  raw=read(snapshot);rows=raw['rows'];sources=raw['sources']
 else:
  for lg,code in CODES.items():
   for ss in [previous,season]:
    url=f'https://www.football-data.co.uk/mmz4281/{ss}/{code}.csv';sources.append(url)
    path=Path(args.csv_dir)/(lg+('-'+ss if ss!=season else '')+'.csv') if args.csv_dir else None
    raw=path.read_text(encoding='utf-8-sig') if path else urllib.request.urlopen(url,timeout=45).read().decode('utf-8-sig')
    for r in csv.DictReader(io.StringIO(raw)):
     try:date=dt.datetime.strptime(r['Date'],'%d/%m/%Y').date().isoformat()
     except ValueError:continue
     if date>=now.date().isoformat() or number(r.get('FTHG')) is None or number(r.get('FTAG')) is None:continue
     rows.append(dict(id='|'.join([lg,date,r['HomeTeam'],r['AwayTeam']]),league=lg,season=ss,date=date,home=r['HomeTeam'],away=r['AwayTeam'],hg=int(r['FTHG']),ag=int(r['FTAG']),hst=number(r.get('HST')),ast=number(r.get('AST')),hxg=number(r.get('HxG')),axg=number(r.get('AxG'))))
  save(snapshot,{'retrievedAt':now.isoformat(),'sources':sources,'rows':rows})
 model=read(ROOT/f'dados/modelo-golos-{D["start"]}.json');history=read(ROOT/f'dados/ultimos10-{D["start"]}.json');aud=audit(D,model,history,rows,now)
 result={'schema':1,'updatedAt':now.isoformat(),'edition':D['start'],'sourceRows':len(rows),'sources':sources,'audit':aud,'backtest':backtest(rows,season),'archive':archive(D,model,aud,now)}
 result['prospective']=prospective(rows)
 save(ROOT/'dados/qualificacao.json',result);print(json.dumps({'rows':len(rows),'auditIssues':len(aud['crossSourceIssues']),'archive':result['archive'],'models':result['backtest']['models']},ensure_ascii=False))
if __name__=='__main__':main()
