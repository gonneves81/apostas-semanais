import unittest,datetime as dt
from unittest.mock import patch
from pathlib import Path
import tempfile
import qualificar_modelo as q
class QualificacaoTests(unittest.TestCase):
 def test_probabilities(self):
  p=q.probabilities(1.3,1.8)
  self.assertAlmostEqual(p['W1']+p['X']+p['W2'],1)
  self.assertLessEqual(p['AND'],min(p['BTTS'],p['O25']))
 def test_missing_features(self):
  self.assertIsNone(q.features([], 'A',True,'base'))
 def test_zero_loss(self):
  s=q.score([{'p':[1.,0.],'y':[1,0]}]);self.assertEqual(s['brier'],0);self.assertEqual(s['logLoss'],0)
 def test_archive_immutable_and_late(self):
  g={'id':1,'home':'A','away':'B','league':'PT','date':'2027-01-01','time':'20:00'};D={'games':[g]};m={'games':{'1':{'prob':{'BTTS':.5},'lambdaHome':1.2,'lambdaAway':1.3}}};audit={'byGame':{}}
  with tempfile.TemporaryDirectory() as t,patch.object(q,'ROOT',Path(t)):
   before=dt.datetime(2027,1,1,18,tzinfo=dt.timezone.utc)
   a=q.archive(D,m,audit,before);self.assertEqual(a['provisional'],1);self.assertEqual(a['confirmed'],0)
   p=next((Path(t)/'historico/arquivo').glob('*.json'));old=p.read_bytes();m['games']['1']['lambdaHome']=2
   q.archive(D,m,audit,before);self.assertEqual(p.read_bytes(),old)
   g['id']=2;g['home']='C';m['games']['2']=m['games']['1']
   a=q.archive(D,m,audit,dt.datetime(2027,1,2,tzinfo=dt.timezone.utc));self.assertEqual(a['total'],1)
 def test_same_day_does_not_train(self):
  row={'id':'1','league':'PT','season':'2627','date':'2026-10-01','home':'A','away':'B','hg':1,'ag':0}
  seen=[]
  def pred(hist,r,v):seen.append(len(hist));return None
  with patch.object(q,'predict',pred):q.backtest([row,dict(row,id='2')],'2627')
  self.assertEqual(set(seen),{0})
if __name__=='__main__':unittest.main()
