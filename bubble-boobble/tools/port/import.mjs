// Rebuild the round-one scene from the imported, checksum-pinned campaign data.
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
const level = JSON.parse(readFileSync('data/levels.json'))[0];
const tiles = [];
for (let r = 0; r < 26; r++) for (let c = 0; c < 32; c++) {
  const tile = level.tiles[r][c];
  if (tile) tiles.push({ name: `Tile ${c},${r}`, LocalTransform: { position: [c*24+12, 720-(r*24+48+12), 0] }, Sprite: { image: `reference/tiles/${String(tile).padStart(2,'0')}`, size: [24,24] } });
}
writeFileSync('scenes/round1.scene.json', JSON.stringify({ $schemaVersion: 2, id: 'round1', entities: [
  { name: 'Camera', id: 'camera', Camera: { clearColor: '#000000ff', orthoSize: 360 }, LocalTransform: { position: [384,360,0] } },
  { name: 'Environment', children: tiles },
  { name: 'Player', PortVisual: {}, LocalTransform: {}, VisualOffset: {}, Sprite: { image: 'reference/green/jump/0', size: [48,48], order: 10 } },
]}, null, 2)+'\n');
function metadata(dir) { for (const e of readdirSync(dir,{withFileTypes:true})) { const path = `${dir}/${e.name}`; if(e.isDirectory()) metadata(path); else if(path.endsWith('.png')) writeFileSync(path+'.gmeta', `guid = "${existsSync(path+".gmeta") ? readFileSync(path+".gmeta","utf8").match(/guid = "([^"]+)"/)[1] : randomUUID()}"\nimporter = "texture"\n[settings]\natlas = "port"\nfilter = "nearest"\ncompression = "none"\ntrim = false\n`); } }
metadata('assets/reference');
