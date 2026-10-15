"""Deterministic lossless packing; original reference texels are never changed."""
from pathlib import Path
from PIL import Image
import json,hashlib
import runpy
root=Path(__file__).resolve().parents[3]
manifest=json.loads((root/'data/sprites.json').read_text())
paths=sorted({p.removeprefix('sprites/') for frames in manifest.values() for p in frames}|{'tiles/%02d.png'%i for i in range(1,26)})
atlas=Image.new('RGBA',(2048,1024)); rects={}; hashes={}
for index,path in enumerate(paths):
    source=root/'assets/reference'/path
    image=Image.open(source).convert('RGBA');x=index%32*64+2;y=index//32*64+2
    assert image.width<=60 and image.height<=60
    atlas.paste(image,(x,y));rects['reference/'+path.removesuffix('.png')]=[x,y,image.width,image.height]
    hashes[path]=hashlib.sha256(source.read_bytes()).hexdigest()
logo_source=root/'assets/reference/logo.png'
logo=Image.open(logo_source).convert('RGBA');atlas.paste(logo,(0,640));rects['reference/logo']=[0,640,logo.width,logo.height];hashes['logo.png']=hashlib.sha256(logo_source.read_bytes()).hexdigest()
for index,(name,color) in enumerate([('black',(0,0,0,255)),('ink',(8,12,27,255)),('panel',(19,29,49,255))]):
    atlas.putpixel((2040+index,1020),color);rects['solid/'+name]=[2040+index,1020,1,1]
for index in range(4):
    path=root/f'assets/pixel-renderer/circle-{index}.png';circle=Image.open(path).convert('RGBA');x=512+index*64;y=640
    atlas.paste(circle,(x,y));rects[f'derived/circle/{index}']=[x,y,circle.width,circle.height];hashes[f'derived/circle/{index}']=hashlib.sha256(path.read_bytes()).hexdigest()
# Original arcade boss frames occupy spare cells; existing frame rectangles stay identical.
hashes['arcade-boss/super-drunk.png']=hashlib.sha256((root/'tools/port/sources/super-drunk.png').read_bytes()).hexdigest()
for index,(name,image) in enumerate(runpy.run_path(str(root/'src/arcade/pixel-renderer/boss-frames.py'))['FRAMES'].items()):
    x=800+index*68;y=640
    atlas.paste(image,(x,y));rects[name]=[x,y,image.width,image.height]
out=root/'assets/pixel-renderer';out.mkdir(exist_ok=True)
atlas.save(out/'atlas.png',optimize=True)
(out/'atlas-layout.json').write_text(json.dumps({'width':2048,'height':1024,'rects':rects,'sources':hashes},indent=2)+'\n')
print(f'Packed {len(paths)} unchanged frames plus logo and menu circles into {atlas.width}x{atlas.height}')
