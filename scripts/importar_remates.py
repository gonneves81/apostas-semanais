"""Importa HST/AST de Football-Data. Não deduz remates a partir dos golos."""
import csv,json,re,datetime as dt,unicodedata,argparse,urllib.request,io
from pathlib import Path
CODES={'PT':'P1','EN':'E0','ES':'SP1','IT':'I1','FR':'F1','DE':'D1','DE2':'D2','NL':'N1','SC':'SC0'}
ALIASES={
'Académico':'Academico Viseu','CD Nacional':'Nacional','Casa Pia AC':'Casa Pia','Estoril Praia':'Estoril','Estrela Amadora':'Estrela','FC Arouca':'Arouca','FC Famalicão':'Famalicao','FC Porto':'Porto','Marítimo M.':'Maritimo','Moreirense FC':'Moreirense','Rio Ave FC':'Rio Ave','SC Braga':'Sp Braga','SL Benfica':'Benfica','Sporting CP':'Sp Lisbon',
'Man Utd':'Man United','Spurs':'Tottenham','Athletic Club':'Ath Bilbao','Atlético de Madrid':'Ath Madrid','CA Osasuna':'Osasuna','Deportivo Alavés':'Alaves','Elche CF':'Elche','FC Barcelona':'Barcelona','Getafe CF':'Getafe','Levante UD':'Levante','Málaga CF':'Malaga','R. Racing Club':'Santander','RCD Espanyol de Barcelona':'Espanol','Rayo Vallecano':'Vallecano','Real Betis':'Betis','Real Sociedad':'Sociedad','Sevilla FC':'Sevilla','Valencia CF':'Valencia','Villarreal CF':'Villarreal',
'AJ Auxerre':'Auxerre','AS Monaco':'Monaco','Angers SCO':'Angers','Estac Troyes':'Troyes','FC Lorient':'Lorient','Havre Athletic Club':'Le Havre','LOSC Lille':'Lille','Le Mans FC':'Le Mans','OGC Nice':'Nice','Olympique Lyonnais':'Lyon','Olympique de Marseille':'Marseille','Paris Saint-Germain':'Paris SG','RC Lens':'Lens','RC Strasbourg Alsace':'Strasbourg','Stade Brestois 29':'Brest','Stade Rennais FC':'Rennes','Toulouse FC':'Toulouse',
'1. FC Köln':'FC Koln','1. FC Union Berlin':'Union Berlin','1. FSV Mainz 05':'Mainz','Bayer 04 Leverkusen':'Leverkusen','Borussia Dortmund':'Dortmund','Borussia Mönchengladbach':"M'gladbach",'Eintracht Frankfurt':'Ein Frankfurt','FC Augsburg':'Augsburg','FC Bayern München':'Bayern Munich','FC Schalke 04':'Schalke 04','Hamburger SV':'Hamburg','SC Freiburg':'Freiburg','SC Paderborn 07':'Paderborn','SV 07 Elversberg':'Elversberg','SV Werder Bremen':'Werder Bremen','TSG Hoffenheim':'Hoffenheim','VfB Stuttgart':'Stuttgart',
'1. FC Heidenheim 1846':'Heidenheim','1. FC Kaiserslautern':'Kaiserslautern','1. FC Magdeburg':'Magdeburg','1. FC Nürnberg':'Nurnberg','DSC Arminia Bielefeld':'Bielefeld','Dynamo Dresden':'Dresden','Eintracht Braunschweig':'Braunschweig','Energie Cottbus':'Cottbus','FC St. Pauli':'St Pauli','Hannover 96':'Hannover','Hertha BSC':'Hertha','Karlsruher SC':'Karlsruhe','SV Darmstadt 98':'Darmstadt','SpVgg Greuther Fürth':'Greuther Furth','VfL Bochum':'Bochum','VfL Osnabrück':'Osnabruck','VfL Wolfsburg':'Wolfsburg',
'Internazionale':'Inter','Heart of Midlothian':'Hearts','St. Johnstone':'St Johnstone','St. Mirren':'St Mirren','ADO Den Haag':'Den Haag','AZ':'AZ Alkmaar','Excelsior Rotterdam':'Excelsior','FC Groningen':'Groningen','FC Twente':'Twente','FC Utrecht':'Utrecht','Fortuna Sittard':'For Sittard','N.E.C. Nijmegen':'Nijmegen','PEC Zwolle':'Zwolle','PSV':'PSV Eindhoven','SC Cambuur':'Cambuur','sc Heerenveen':'Heerenveen'}
def count(v):
 try:
  n=int(v)
  return n if n>=0 and str(n)==str(v).strip() else None
 except (ValueError,TypeError):return None

def team_rows(rows,name,cutoff):
 out=[]
 for r in rows:
  try:date=dt.datetime.strptime(r['Date'],'%d/%m/%Y').date().isoformat()
  except (ValueError,KeyError):continue
  if date>=cutoff or name not in (r.get('HomeTeam'),r.get('AwayTeam')):continue
  if count(r.get('FTHG')) is None or count(r.get('FTAG')) is None:continue
  home=r['HomeTeam']==name
  out.append({'date':date,'opponent':r['AwayTeam'] if home else r['HomeTeam'],'venue':'C' if home else 'F','for':count(r.get('HST' if home else 'AST')),'against':count(r.get('AST' if home else 'HST'))})
 return sorted(out,key=lambda r:r['date'],reverse=True)

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--csv-dir');args=parser.parse_args()
 root=Path(__file__).resolve().parents[1];D=json.loads(re.search(r'<script id="data-json" type="application/json">(.*?)</script>',(root/'index.html').read_text(),re.S)[1])
 season=D['start'][2:4]+str(int(D['start'][2:4])+1).zfill(2);data={};sources={}
 for lg,code in CODES.items():
  url=f'https://www.football-data.co.uk/mmz4281/{season}/{code}.csv';sources[lg]=url
  raw=(Path(args.csv_dir)/f'{lg}.csv').read_text(encoding='utf-8-sig') if args.csv_dir else urllib.request.urlopen(url,timeout=30).read().decode('utf-8-sig')
  data[lg]=list(csv.DictReader(io.StringIO(raw)))
 out={'schema':1,'edition':D['start'],'retrievedAt':dt.datetime.now(dt.timezone.utc).isoformat(),'definition':'HST/AST: remates à baliza, excluindo remates para fora e bloqueados.','sources':sources,'byGame':{}}
 for g in D['games']:
  rows=data.get(g['league'],[]);names={r.get(k) for r in rows for k in ('HomeTeam','AwayTeam')};entry={}
  for side in ('home','away'):
   name=ALIASES.get(g[side],g[side]);matched=name in names
   entry[side]={'team':g[side],'sourceTeam':name if matched else None,'source':sources.get(g['league']),'status':'available' if matched else 'team_not_matched','results':team_rows(rows,name,g['date']) if matched else []}
  out['byGame'][str(g['id'])]=entry
 path=root/'dados'/f'remates-{D["start"]}.json';path.write_text(json.dumps(out,ensure_ascii=False,indent=2))
 print('Jogos:',len(out['byGame']),'Equipas correspondidas:',sum(x['status']=='available' for g in out['byGame'].values() for x in g.values()))
if __name__=='__main__':main()
