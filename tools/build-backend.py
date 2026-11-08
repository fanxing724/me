#!/usr/bin/env python3
"""Build only the assets required by the independent homepage backend."""
from pathlib import Path
import shutil,subprocess
root=Path(__file__).resolve().parents[1]
subprocess.run(['python3',str(root/'tools/build-admin.py')],check=True)
for directory,names in [('static',['admin.js','admin.css','admin-theme.css','admin-custom.js','admin-custom.css','settings-schema.mjs','star.svg']),('assets',['avatar-fast.webp'])]:
 target=root/'dist-admin'/directory;target.mkdir(parents=True,exist_ok=True)
 for name in names:shutil.copy2(root/'public'/directory/name,target/name)
print(root/'dist-admin')
