#!/usr/bin/env python3
"""Read public backend data and refresh both fallbacks only after validation."""
from pathlib import Path
import argparse,json,re,subprocess,tempfile,os
root=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--backend',default='https://admin.724520.xyz')
args=parser.parse_args()
def read(path):
    result=subprocess.run(['curl','--fail','--silent','--show-error','--max-time','20',args.backend.rstrip('/')+path],capture_output=True,check=True)
    return json.loads(result.stdout)
content=read('/api/data');settings=read('/api/settings')
if not isinstance(content.get('data',{}).get('sitesData'),list):raise ValueError('Invalid public site data')
if not isinstance(settings.get('settings',{}).get('modules'),dict):raise ValueError('Invalid public settings')
def payload(value):return json.dumps(value,ensure_ascii=False,separators=(',',':')).replace('<','\\u003c').replace('&','\\u0026')
page=root/'public/index.html';html=page.read_text()
for name,value in [('initial-data',content),('initial-settings',settings)]:
    pattern=r'(<script id="'+name+r'" type="application/json">).*?(</script>)'
    html,count=re.subn(pattern,lambda match:match[1]+payload(value)+match[2],html,flags=re.S)
    if count!=1:raise ValueError('Expected one '+name+' element')
with tempfile.NamedTemporaryFile(mode='w',encoding='utf-8',dir=page.parent,prefix='.snapshot-',delete=False) as handle:
    handle.write(html);temporary=Path(handle.name)
os.chmod(temporary,0o644);os.replace(temporary,page)
(root/'data/site-content.json').write_text(json.dumps(content,ensure_ascii=False,indent=2)+'\n')
print('Public content and settings snapshots refreshed. No remote writes.')
