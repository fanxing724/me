from pathlib import Path
import json
root=Path(__file__).resolve().parents[1]
text='// Generated from admin/index.html and admin/login.html.\n'
for name,file in [('adminPage','index.html'),('loginPage','login.html')]:
 text+='export const '+name+' = '+json.dumps((root/'admin'/file).read_text(),ensure_ascii=False)+';\n'
(root/'admin/pages.mjs').write_text(text)
