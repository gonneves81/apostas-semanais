"""Completa lacunas com resultados estritamente anteriores; mantém previsões publicadas.
As estimativas acrescentadas nesta revisão nunca entram no histórico pré-jogo.
"""
import json,math,datetime as dt
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
METHOD='Poisson independente: médias de ataque/defesa regularizadas com 5 jogos a 1,35 golos; 65% casa/fora e 35% últimos 7; sem calibração.'
def estimate(g):
 h=[r for r in g['latest']['home'] if r['date']<g['date']][:7]
 a=[r for r in g['latest']['away'] if r['date']<g['date']][:7]
 hv=[r for r in h if r['venue']=='C'];av=[r for r in a if r['venue']=='F']
 if min(len(h),len(a))<5 or min(len(hv),len(av))<2:return None
 def avg(rows,k):return (sum(r[k] for r in rows)+5*1.35)/(len(rows)+5)
 lh=.65*(avg(hv,'gf')+avg(av,'ga'))/2+.35*(avg(h,'gf')+avg(a,'ga'))/2
 la=.65*(avg(av,'gf')+avg(hv,'ga'))/2+.35*(avg(a,'gf')+avg(h,'ga'))/2
 btts=(1-math.exp(-lh))*(1-math.exp(-la));total=lh+la
 over=1-math.exp(-total)*(1+total+total*total/2)
 both= btts - math.exp(-total)*lh*la
 return {'lambdaHome':round(lh,8),'lambdaAway':round(la,8),'prob':{'BTTS':round(btts,8),'O25':round(over,8),'AND':round(both,8)}}
def main():
 path=ROOT/'dados/modelo-golos-2026-10-26.json';d=json.loads(path.read_text());now=dt.datetime.now(dt.timezone.utc).isoformat();audit=[]
 for g in d['games'].values():
  old=g['status']
  if g.get('prob'):continue
  e=estimate(g)
  if not e:
   g['status']='amostra_insuficiente';g['unavailableReason']='Menos de 5 jogos por equipa ou menos de 2 no recinto relevante.';continue
  g.update(e);g.update(status='estimativa_reconstruida',calculatedAt=now,backtestEligible=False,calculationMethod=METHOD,previousStatus=old)
  audit.append({'id':g['id'],'home':g['home'],'away':g['away'],'previousStatus':old,'newStatus':g['status']})
 n=sum(bool(g.get('prob')) for g in d['games'].values());d['coverage']={'total':len(d['games']),'estimated':n,'unavailable':len(d['games'])-n,'reconstructed':sum(g.get('status')=='estimativa_reconstruida' for g in d['games'].values())};d['reviewedAt']=now
 d['warning']='Estimativas sem calibração. Os registos com estado estimativa_reconstruida foram calculados na revisão, exclusivamente com dados anteriores ao encontro; não constituem previsões publicadas antes do início nem são elegíveis para avaliação retroativa.'
 d['model']['missingEstimatesMethod']=METHOD
 path.write_text(json.dumps(d,ensure_ascii=False,indent=2))
 (ROOT/'dados/auditoria-previsoes-2026-11-01.json').write_text(json.dumps({'reviewedAt':now,'coverage':d['coverage'],'changes':audit},ensure_ascii=False,indent=2))
 print(d['coverage'])
if __name__=='__main__':main()
