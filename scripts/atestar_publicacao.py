"""Executar apenas após deploy-pages concluído, dentro de GitHub Actions."""
import os,json,datetime as dt
from pathlib import Path
if os.environ.get('GITHUB_ACTIONS')!='true' or not os.environ.get('DEPLOYMENT_URL','').startswith('https://'):
 raise SystemExit('É necessária uma publicação GitHub Pages concluída.')
path=Path('historico/publicacoes.json');records=json.loads(path.read_text()) if path.exists() else {}
for file in Path('historico/arquivo').glob('*.json'):
 data=json.loads(file.read_text())
 records.setdefault(data['id'],{'publishedAt':dt.datetime.now(dt.timezone.utc).isoformat(),'url':os.environ['DEPLOYMENT_URL'],'runId':os.environ.get('GITHUB_RUN_ID')})
path.write_text(json.dumps(records,ensure_ascii=False,separators=(',',':'))+'\n')
