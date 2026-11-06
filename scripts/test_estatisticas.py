import unittest,math,json,re
from pathlib import Path
from estatisticas import profile,predict,summary
ROOT=Path(__file__).resolve().parents[1]
class StatisticsTests(unittest.TestCase):
 def rows(self):
  return [dict(date=f'2026-10-{i:02}',venue='C' if i%2 else 'F',gf=i%3,ga=1,shotsFor=0 if i==13 else None,shotsAgainst=2,opponent='Teste',outcome='E') for i in range(1,15)]
 def test_venue_before_last_seven(self):
  p=profile(self.rows());self.assertEqual(p['home']['last7']['n'],7)
  self.assertEqual(p['home']['last7']['results'][-1]['date'],'2026-10-01')
  self.assertEqual(p['all']['season']['gf'],p['home']['season']['gf']+p['away']['season']['gf'])
 def test_unknown_shots_not_zero(self):
  p=profile(self.rows());self.assertEqual(p['home']['last7']['shotsForN'],1);self.assertEqual(p['home']['last7']['shotsForAvg'],0)
  self.assertIsNone(p['away']['last7']['shotsForAvg'])
 def test_joint_probability_and_h2h_weight(self):
  p=profile(self.rows());d=self.rows()[:5];r=predict(p,p,1.6,1.2,d,'2026-11-06')
  self.assertGreaterEqual(r['components']['h2hWeight'],0);self.assertLessEqual(r['components']['h2hWeight'],.05)
  h,a=r['lambdaHome'],r['lambdaAway'];self.assertAlmostEqual(r['prob']['BTTS']-r['prob']['AND'],h*a*math.exp(-h-a),places=7)
  self.assertLessEqual(r['prob']['AND'],r['prob']['O25'])
  self.assertIsNone(predict(profile([]),p,1.6,1.2,[],'2026-11-06'))
 def test_published_statistics_temporal_and_splits(self):
  D=json.loads(re.search(r'<script id="data-json" type="application/json">(.*?)</script>',(ROOT/'index.html').read_text(),re.S)[1]);A=json.loads((ROOT/D['statisticsFile']).read_text())
  self.assertEqual(len(A['byGame']),len(D['games']))
  for g in D['games']:
   a=A['byGame'][str(g['id'])]
   for team in a['teams'].values():
    self.assertEqual(team['all']['season']['gf'],team['home']['season']['gf']+team['away']['season']['gf'])
    for scope in team.values():
     for s in scope.values():
      self.assertLessEqual(s['shotsForN'],s['n'])
      for r in s['results']:self.assertLess(r['date'],a['cutoff'])
   for r in a['h2h']['all']['results']:self.assertLess(r['date'],a['cutoff'])
if __name__=='__main__':unittest.main()
