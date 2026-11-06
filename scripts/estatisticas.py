"""Recortes auditáveis de golos/remates e modelo exploratório casa/fora v2."""
import math
VERSION='poisson-casa-fora-v2'

def summary(rows):
 rows=sorted(rows,key=lambda r:r['date'],reverse=True)
 n=len(rows);gf=sum(r['gf'] for r in rows);ga=sum(r['ga'] for r in rows)
 sf=[r['shotsFor'] for r in rows if r.get('shotsFor') is not None];sa=[r['shotsAgainst'] for r in rows if r.get('shotsAgainst') is not None]
 return dict(n=n,gf=gf,ga=ga,gfAvg=gf/n if n else None,gaAvg=ga/n if n else None,pts=sum(3 if r['gf']>r['ga'] else int(r['gf']==r['ga']) for r in rows),shotsFor=sum(sf) if sf else None,shotsAgainst=sum(sa) if sa else None,shotsForAvg=sum(sf)/len(sf) if sf else None,shotsAgainstAvg=sum(sa)/len(sa) if sa else None,shotsForN=len(sf),shotsAgainstN=len(sa),am=sum(r['gf']>0 and r['ga']>0 for r in rows)/n if n else None,combo=sum(r['gf']>0 and r['ga']>0 and r['gf']+r['ga']>2 for r in rows)/n if n else None,results=rows[:10])

def profile(rows):
 rows=sorted(rows,key=lambda r:r['date'],reverse=True)
 return {scope:dict(season=summary(rs),last7=summary(rs[:7])) for scope,rs in [('all',rows),('home',[r for r in rows if r['venue']=='C']),('away',[r for r in rows if r['venue']=='F'])]}

def predict(h,a,mu_h,mu_a,h2h,cutoff):
 from datetime import date
 if min(h['all']['season']['n'],a['all']['season']['n'])<5 or min(h['home']['season']['n'],a['away']['season']['n'])<2:return None
 # Season overall enters explicitly (20%); recent venue and overall share 30%.
 def rate(p,venue,key,prior):
  def reg(s):return (s[key]+3*prior)/(s['n']+3)
  return .50*reg(p[venue]['season'])+.15*reg(p[venue]['last7'])+.15*reg(p['all']['last7'])+.20*reg(p['all']['season'])
 ha=rate(h,'home','gf',mu_h);ad=rate(a,'away','ga',mu_h);aa=rate(a,'away','gf',mu_a);hd=rate(h,'home','ga',mu_a)
 lh=(ha+ad)/2;la=(aa+hd)/2;base=[lh,la]
 same=[r for r in h2h if r['venue']=='C'][:5]
 weights=[math.exp(-math.log(2)*(date.fromisoformat(cutoff)-date.fromisoformat(r['date'])).days/365) for r in same]
 total=sum(weights);weight=.05*min(1,total/3)
 if total:
  hh=sum(w*r['gf'] for w,r in zip(weights,same))/total;ah=sum(w*r['ga'] for w,r in zip(weights,same))/total
  lh=(1-weight)*lh+weight*hh;la=(1-weight)*la+weight*ah
 am=(1-math.exp(-lh))*(1-math.exp(-la));p11=lh*la*math.exp(-lh-la);over=1-math.exp(-lh-la)*(1+lh+la+(lh+la)**2/2)
 return dict(lambdaHome=round(lh,8),lambdaAway=round(la,8),prob=dict(BTTS=round(am,8),O25=round(over,8),AND=round(am-p11,8)),modelVersion=VERSION,calculationMethod=METHOD,components=dict(homeAttack=ha,awayDefence=ad,awayAttack=aa,homeDefence=hd,baseHome=base[0],baseAway=base[1],h2hWeight=weight,h2hN=len(same),priorHome=mu_h,priorAway=mu_a))

# Keep the text aligned with the actual formula.
METHOD='Poisson independente: 50% época casa/fora, 15% últimos 7 casa/fora, 15% últimos 7 gerais e 20% época geral. Regularização de 3 jogos na média da liga; H2H no mesmo recinto até 5%, descontado pela antiguidade. Sem calibração.'
