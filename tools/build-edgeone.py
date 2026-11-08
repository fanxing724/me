#!/usr/bin/env python3
"""Build a public-only EdgeOne mirror connected to the independent backend."""
from pathlib import Path
import shutil,json,re,tempfile,datetime
root=Path(__file__).resolve().parents[1]
stage=Path(tempfile.mkdtemp(prefix='.edgeone-build-',dir=root))
shutil.copytree(root/'public',stage,dirs_exist_ok=True,ignore=shutil.ignore_patterns('admin.js','admin.css','admin-theme.css','admin-custom.js','admin-custom.css'))
shutil.copytree(root/'edge-functions',stage/'edge-functions',dirs_exist_ok=True)
html=(stage/'index.html').read_text();match=re.search(r'<script id="initial-data" type="application/json">(.*?)</script>',html,re.S)
if not match:raise ValueError('Public data snapshot is missing')
data=json.loads(match[1]);assert isinstance(data.get('data',{}).get('sitesData'),list)
payload=json.dumps(data,ensure_ascii=False,separators=(',',':')).replace('<','\\u003c').replace('&','\\u0026')
(stage/'edge-functions/_lib/snapshot.js').write_text('export default '+payload+';\n')
settings_match=re.search(r'<script id="initial-settings" type="application/json">(.*?)</script>',html,re.S)
if settings_match:(stage/'edge-functions/_lib/settings-snapshot.js').write_text('export default '+settings_match[1]+';\n')
html=re.sub(r'/static/pageviews\.js\?v=[^"\x27\s]+','/static/pageviews.js?v=20261109-counter1',html);(stage/'index.html').write_text(html)
# Existing public Font Awesome brand styles depend on these fonts.
fonts=root/'public/webfonts'
if fonts.exists():shutil.copytree(fonts,stage/'webfonts',dirs_exist_ok=True)
config={'headers':[{'source':'/*','headers':[{'key':'X-Content-Type-Options','value':'nosniff'},{'key':'Referrer-Policy','value':'strict-origin-when-cross-origin'}]}],'redirects':[{'source':path,'destination':'https://admin.724520.xyz/manage','statusCode':302} for path in ['/manage','/login','/logout']]}
(stage/'edgeone.json').write_text(json.dumps(config,ensure_ascii=False,indent=2)+'\n');(stage/'package.json').write_text('{"private":true,"type":"module"}\n')
(stage/'release.json').write_text(json.dumps({'version':'20261109-counter1','line':'edgeone','dataSource':'https://admin.724520.xyz'}))
if (root/'LICENSE').exists():shutil.copy2(root/'LICENSE',stage/'LICENSE')
output=root/'dist-edgeone'
if output.exists():
 archive=root/'.build-backups';archive.mkdir(exist_ok=True)
 shutil.move(str(output),str(archive/('dist-edgeone-'+datetime.datetime.now().strftime('%Y%m%d-%H%M%S-%f'))))
shutil.move(str(stage),str(output));print(output)
