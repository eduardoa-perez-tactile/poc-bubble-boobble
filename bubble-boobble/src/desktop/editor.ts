import type { Cell, Level } from '../arcade/types.ts';
export const enemyKinds = ['zenchan','monsta','mighta','pulpul','banebou','invader'];
export const editorTools = ['BLOCK','ERASER','PLAYER','FOOD SPAWN','BONUS SPAWN','ZEN-CHAN','MONSTA','MIGHTA','PULPUL','BANEBOU','INVADER'];
export const cloneLevel = (level:Level):Level => ({...level, tiles:level.tiles.map(row=>[...row]), enemies:level.enemies.map(e=>({...e})),player:{...level.player},food_spawn:{...level.food_spawn},power_spawn:{...level.power_spawn}});
export function validateLevel(l:Level):string {
  if(l.number<1||l.number>25)return 'tile theme must be between 1 and 25';
  if(l.tiles.length!==26)return 'expected 26 rows';
  for(const [r,row] of l.tiles.entries()) {if(row.length!==32)return `row ${r} must contain 32 tiles`;for(const [c,t] of row.entries()){if(t<0||t>25)return `invalid tile at ${c},${r}`;if((c<2||c>=30)&&t===0)return 'side walls must remain closed';}}
  if(l.enemies.length<1||l.enemies.length>32)return 'place between 1 and 32 enemies';
  const valid=(c:Cell)=>c.col>=2&&c.col<30&&c.row>=1&&c.row<26;
  for(const e of l.enemies){if(!enemyKinds.includes(e.kind))return `unknown enemy ${e.kind}`;if(!valid(e))return 'enemy is outside the arena';}
  if(!valid(l.player)||!valid(l.food_spawn)||!valid(l.power_spawn))return 'spawn point is outside the arena';
  if(!['','water','thunder','fire'].includes(l.special))return `unknown special bubble ${l.special}`;
  if(l.special_count<0||l.special_count>100)return 'invalid special bubble count';
  for(let r=1;r<24;r++)for(let c=2;c<29;c++)if(!l.tiles[r]![c]&&!l.tiles[r]![c+1]&&!l.tiles[r+1]![c]&&!l.tiles[r+1]![c+1])return '';
  return 'leave room for the player and enemies';
}
export function paintLevel(source:Level,col:number,row:number,tool:number):Level {
  if(col<2||col>=30||row<0||row>=26)return source;
  const l=cloneLevel(source);
  if(tool===0)l.tiles[row]![col]=l.number;
  else if(tool===1){l.tiles[row]![col]=0;l.enemies=l.enemies.filter(e=>e.col!==col||e.row!==row+2);}
  else {const cell={col,row:Math.min(25,Math.max(2,row+2))};if(tool===2)l.player=cell;else if(tool===3)l.food_spawn=cell;else if(tool===4)l.power_spawn=cell;else {const kind=enemyKinds[tool-5];if(!kind||l.enemies.length>=32)return source;const found=l.enemies.find(e=>e.col===cell.col&&e.row===cell.row);if(found)found.kind=kind;else l.enemies.push({...cell,kind});}}
  return l;
}
