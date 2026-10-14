"""Rebuild game-owned pixel assets without changing any original reference file."""
from pathlib import Path
from PIL import Image
import hashlib,json,subprocess,sys
root=Path(__file__).resolve().parents[2]
proof=json.loads((root/'assets/pixel-renderer/circles-source.json').read_text())
source=root/proof['source']
if hashlib.sha256(source.read_bytes()).hexdigest()!=proof['pngSHA256']:
    raise SystemExit('The committed Go circle-source screenshot hash differs')
image=Image.open(source).convert('RGB')
for index,entry in enumerate(proof['circles']):
    image.crop(entry['sourceBox']).save(root/f'assets/pixel-renderer/circle-{index}.png')
subprocess.run([sys.executable,str(root/'src/arcade/pixel-renderer/build-atlas.py')],cwd=root,check=True)
go=root/'.cache/toolchains/go/bin/go'
if not go.exists():raise SystemExit('Run npm run harness:setup to provision the pinned Go toolchain')
subprocess.run([str(go),'run','src/arcade/pixel-renderer/build-pixels.go',str(root)],cwd=root,check=True)
subprocess.run(['gameengine','material','compile','assets/materials/pixel-ordered.material.ts'],cwd=root,check=True)
