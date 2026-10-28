#!/usr/bin/env python3
"""Refresh the public fallback snapshot before deployment; never writes remote KV."""
import json
import re
import urllib.request
from pathlib import Path

root = Path(__file__).resolve().parents[1]
with urllib.request.urlopen('https://724520.xyz/api/data', timeout=20) as response:
    content = json.load(response)
if not isinstance(content.get('data', {}).get('sitesData'), list):
    raise ValueError('Invalid public site data')
payload = json.dumps(content, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c').replace('&', '\\u0026')
page = root / 'public/index.html'
html = page.read_text()
html, count = re.subn(r'(<script id="initial-data" type="application/json">).*?(</script>)', lambda m: m[1] + payload + m[2], html, flags=re.S)
if count != 1:
    raise ValueError('Expected one initial-data element')
page.write_text(html)
print('Public fallback snapshot refreshed.')
