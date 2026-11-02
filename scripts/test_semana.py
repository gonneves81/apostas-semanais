import datetime as dt,json,re,unittest
from pathlib import Path
from atualizar_semana import week,kickoff,identity,team_results,canonical
ROOT=Path(__file__).resolve().parents[1]
class WeeklyTests(unittest.TestCase):
 def test_week_boundaries(self):
  self.assertEqual(week(dt.date(2026,11,2)),('2026-11-02','2026-11-08'))
  self.assertEqual(week(dt.date(2026,11,1)),('2026-10-26','2026-11-01'))
  self.assertEqual(week(dt.date(2027,1,1)),('2026-12-28','2027-01-03'))
 def test_time_and_identity(self):
  self.assertEqual(kickoff({'date':'2026-11-02','time':'21:00'}).isoformat(),'2026-11-02T20:00:00+00:00')
  self.assertIsNone(kickoff({'date':'2026-11-02','time':''}))
  self.assertLess(identity('EN','Arsenal','Hull'),2**53)
  self.assertEqual(canonical('Atleti'),canonical('Atlético de Madrid'))
 def test_current_bundle(self):
  D=json.loads(re.search(r'<script id="data-json" type="application/json">(.*?)</script>',(ROOT/'index.html').read_text(),re.S)[1]);start=D['start'];m=json.loads((ROOT/f'dados/modelo-golos-{start}.json').read_text());h=json.loads((ROOT/f'dados/ultimos10-{start}.json').read_text());s=json.loads((ROOT/f'dados/remates-{start}.json').read_text())
  self.assertEqual(len(set(g['id'] for g in D['games'])),len(D['games']))
  self.assertEqual(set(m['games']),{str(g['id']) for g in D['games']})
  for g in D['games']:
   self.assertTrue(start<=g['date']<=D['end']);r=m['games'][str(g['id'])]
   self.assertEqual((r['home'],r['away'],r['date']),(g['home'],g['away'],g['date']))
   if r.get('prob'):
    self.assertTrue(0<r['prob']['AND']<=min(r['prob']['O25'],r['prob']['BTTS'])<1)
   else:self.assertTrue(r.get('unavailableReason'))
   for side in ['home','away']:
    for x in h['byGame'][str(g['id'])][side]['results']+s['byGame'][str(g['id'])][side]['results']:self.assertLess(x['date'],g['date'])
if __name__=='__main__':unittest.main()
