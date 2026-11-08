#!/usr/bin/env python3
"""Build a public EdgeOne ZIP with index.html at the archive root."""
from pathlib import Path
import argparse,subprocess,zipfile
root=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output',type=Path,default=root/'homepage-edgeone.zip')
args=parser.parse_args()
subprocess.run(['python3',str(root/'tools/build-edgeone.py')],check=True)
args.output.parent.mkdir(parents=True,exist_ok=True)
with zipfile.ZipFile(args.output,'w',zipfile.ZIP_DEFLATED) as archive:
    for path in sorted((root/'dist-edgeone').rglob('*')):
        if path.is_file():archive.write(path,path.relative_to(root/'dist-edgeone'))
with zipfile.ZipFile(args.output) as archive:
    assert archive.testzip() is None
    assert 'index.html' in archive.namelist()
    assert 'edge-functions/api/settings.js' in archive.namelist()
print(args.output)
