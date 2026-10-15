"""Extract unchanged original arcade frames; provenance and rectangles live beside the source sheet."""
from pathlib import Path
from PIL import Image
import hashlib,json
root=Path(__file__).resolve().parents[3]
source=root/'tools/port/sources/super-drunk.png'
proof=json.loads(source.with_suffix('.json').read_text())
assert hashlib.sha256(source.read_bytes()).hexdigest()==proof['sha256'], 'Boss source sheet differs'
sheet=Image.open(source).convert('RGBA')
FRAMES={}
for pose,cells in proof['cells'].items():
    for index,(x,y,w,h) in enumerate(cells):
        FRAMES[f'derived/boss/{pose}-{index}']=sheet.crop((x,y,x+w,y+h))
