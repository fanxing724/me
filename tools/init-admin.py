#!/usr/bin/env python3
"""Create private initial login records locally; never prints passwords or keys."""
from pathlib import Path
import getpass,hashlib,json,secrets,os
root=Path(__file__).resolve().parents[1];folder=root/'private'
folder.mkdir(mode=0o700,exist_ok=True)
paths=[folder/'admin-credentials.json',folder/'session-key.txt']
if any(path.exists() for path in paths):raise SystemExit('Initialization files already exist; refusing to overwrite.')
username=input('Admin username: ').strip()
if not username:raise SystemExit('Username is required.')
password=getpass.getpass('Password (at least 12 characters): ')
if len(password)<12:raise SystemExit('Password is too short.')
if password!=getpass.getpass('Confirm password: '):raise SystemExit('Passwords do not match.')
salt=secrets.token_hex(16)
record={'username':username,'salt':salt,'hash':hashlib.pbkdf2_hmac('sha256',password.encode(),salt.encode(),100000).hex()}
for path,text in zip(paths,[json.dumps(record)+'\n',secrets.token_hex(32)]):
    fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
    with os.fdopen(fd,'w') as handle:handle.write(text)
print('Private initialization files created. Upload them using the deployment guide; do not commit them.')
