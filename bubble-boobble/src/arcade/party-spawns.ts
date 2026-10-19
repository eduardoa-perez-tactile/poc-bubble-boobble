import { blocked, solid } from './physics';
import { partySpawn } from './party-config';
import { ActorSize, Tile, arenaColumns, arenaRows, position, type GameState } from './types';

interface Spot { X:number; Y:number }
export interface EnemySpawn extends Spot { Ground:boolean }
export const isFlyingEnemy = (kind:string) => kind==='monsta'||kind==='pulpul';
const overlaps=(a:Spot,b:Spot,gap:number)=>Math.abs(a.X-b.X)<ActorSize+gap&&Math.abs(a.Y-b.Y)<ActorSize+gap;
function supported(g:GameState,p:Spot):boolean {
 const feet=p.Y+ActorSize;
 if(feet%Tile!==0)return false;
 for(let col=Math.floor(p.X/Tile);col<=Math.floor((p.X+ActorSize-.01)/Tile);col++)
  if(!solid(g,col,feet/Tile))return false;
 return true;
}
/** Only runs when constructing a wave: reserve real footing before allocating flyers. */
export function partyEnemyFormation(g:GameState,kinds:readonly string[]):EnemySpawn[] {
 const protectedSpots:Spot[]=g.Players.filter(p=>p.Lives>0||p.Downed).map(p=>({X:p.X,Y:p.Y}));
 g.Party!.Slots.forEach((slot,index)=>{
  if(slot==='empty')return;
  const [X,Y]=position(partySpawn(index,g.Players.length),ActorSize,g.Level);protectedSpots.push({X,Y});
 });
 const clear=(p:Spot)=>!blocked(g,p.X,p.Y,ActorSize)&&!protectedSpots.some(other=>overlaps(p,other,8));
 const ground:Spot[]=[];
 for(let row=4;row<arenaRows(g);row++)for(let x=2*Tile+2;x+ActorSize<=(arenaColumns(g)-2)*Tile;x+=Tile/2){
  const p={X:x,Y:row*Tile-ActorSize};
  if(supported(g,p)&&clear(p))ground.push(p);
 }
 // Preserve the formation's broad spread and alternating direction as preferred anchors.
 const courtyard:Spot[]=[];
 if(g.Players.length>6)for(const row of [9,14,19,22])for(let col=3;col<=39;col+=4){
  const p={X:col*Tile,Y:row*Tile-ActorSize};if(!blocked(g,p.X,p.Y,ActorSize))courtyard.push(p);
 }
 const columns=[0,7,3,4,1,6,2,5],rows=[20,10,15,5];
 const preferred=(index:number):Spot=>{
  if(courtyard.length){const offset=index*7%courtyard.length;return courtyard[g.Party!.Wave%2?offset:courtyard.length-1-offset]!;}
  const column=columns[Math.floor(index/rows.length)]!;
  return {X:(8+(g.Party!.Wave%2?column:7-column)*2)*Tile,Y:rows[index%rows.length]!*Tile-ActorSize};
 };
 const placed:(EnemySpawn|undefined)[]=Array(kinds.length);
 let air:Spot[]|undefined;
 const choose=(pool:Spot[],target:Spot):Spot|undefined=>{
  let best:Spot|undefined,distance=Infinity;
  for(const p of pool){
   const score=Math.abs(p.X-target.X)+Math.abs(p.Y-target.Y);
   if(score>=distance||placed.some(other=>other&&overlaps(p,other,4)))continue;
   best=p;distance=score;
  }
  return best;
 };
 for(const flying of [false,true])for(let i=0;i<kinds.length;i++){
  if(isFlyingEnemy(kinds[i]!)!==flying)continue;
  const target=preferred(i);
  let spot=choose(ground,target);
  if(!spot&&flying){
   if(!air){
    air=[];
    for(let row=4;row<arenaRows(g);row+=2)for(let col=2;col<arenaColumns(g)-3;col+=2){
     const p={X:col*Tile+2,Y:row*Tile-ActorSize};if(clear(p))air.push(p);
    }
   }
   spot=choose(air,target);
  }
  if(!spot)throw new Error(`No safe ${flying?'flying':'grounded'} spawn for ${kinds[i]}`);
  placed[i]={...spot,Ground:supported(g,spot)};
 }
 return placed as EnemySpawn[];
}
