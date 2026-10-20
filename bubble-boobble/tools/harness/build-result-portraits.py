"""Bake UI portraits from the exact gameplay frames and dragon palette swaps."""
import json
import uuid
from pathlib import Path
from PIL import Image
ROOT = Path(__file__).resolve().parents[2]
palettes = json.loads((ROOT / 'data/dragon-palettes.json').read_text())
out = ROOT / 'assets/ui/dragon-results'
out.mkdir(parents=True, exist_ok=True)
for skin in ['green','blue','red','yellow','purple','orange','cyan','pink','ivory','slate']:
    palette = palettes.get(skin, {})
    source = palette.get('sourceAnimation',skin)
    image = Image.open(ROOT / f'assets/reference/{source}/walk/0.png').convert('RGBA')
    swaps = {tuple(s['from']):tuple(s['to']) for s in palette.get('swaps',[])}
    image.putdata([(*swaps.get(px[:3],px[:3]),px[3]) for px in image.getdata()])
    image.save(out / f'{skin}.png')

    meta = out / f'{skin}.png.gmeta'
    if not meta.exists():
        meta.write_text(f'guid = "{uuid.uuid4()}"\nimporter = "texture"\n[settings]\natlas = "dragon-results"\nfilter = "nearest"\ncompression = "none"\ntrim = false\n')
