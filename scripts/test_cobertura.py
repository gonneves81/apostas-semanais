import json,math
from pathlib import Path
from completar_previsoes import estimate
root=Path(__file__).resolve().parents[1]
d=json.loads((root/'dados/modelo-golos-2026-10-26.json').read_text())
assert d['coverage']=={'total':92,'estimated':92,'unavailable':0,'reconstructed':70}
for g in d['games'].values():
 assert set(g['prob'])=={'BTTS','O25','AND'}
 assert all(math.isfinite(p) and 0<=p<=1 for p in g['prob'].values())
 assert g['prob']['AND']<=min(g['prob']['BTTS'],g['prob']['O25'])
 for side in ('home','away'):
  assert len(g['latest'][side])>=5
  assert all(r['date']<g['date'] for r in g['latest'][side])
 if g['status']=='estimativa_reconstruida':
  assert g['backtestEligible'] is False and g['calculatedAt']
  expected=estimate(g)
  assert expected['prob']==g['prob']
marseille=d['games']['88'];assert marseille['home']=='Olympique de Marseille';assert all(marseille['prob'].values())
print('OK: 92 jogos, 70 lacunas corrigidas, Marselha–Toulouse completo; corte temporal e marcação retroativa verificados.')
