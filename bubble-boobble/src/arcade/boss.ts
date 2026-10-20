import { recordPartyKill, recordPartyLastKill } from './party-config';
import { arenaWidth, arenaHeight, levelWidth, type Level } from './types';
import { ActorSize, Tile, State, alive, body, intersects, type GameState, type PartyBoss } from './types';
import { partySpawns } from './party-config';
import { item } from './items';
import { addScore } from './game';

export const bossSize = 96;
// Bubble Madness tuning for 1–10 dragons; these are not claimed arcade ROM values.
export function createBoss(team:number,level?:Level):PartyBoss {
  const hp=18+Math.min(team,6)*6+Math.max(0,team-6)*4;
  return {X:(levelWidth(level)-bossSize)/2,Y:150,VX:2.25,VY:2.25,Dir:1,HP:hp,MaxHP:hp,Tick:0,Invulnerable:0,Mode:'moving',Timer:150};
}
/** Individual floor pickups are replenished after deaths; collecting one never deprives a teammate. */
export function ensureThunderPickups(g:GameState) {
  const b=g.Party?.Boss;
  if(!b||b.Mode==='captured')return;
  const needed=g.Players.filter(p=>alive(p)&&!p.Power.Thunder).length;
  let present=g.Items.filter(i=>i.Power==='thunder_potion').length;
  for(let i=0;present<needed&&i<g.Players.length;i++) {
    const cell=partySpawns[i]!;
    const x=g.Players.length>6?cell.col*Tile:80+i*116,y=g.Players.length>6?cell.row*Tile-32:arenaHeight(g)-Tile-32;
    if(g.Items.some(it=>it.Power==='thunder_potion'&&Math.abs(it.X-x)<32&&Math.abs(it.Y-y)<32))continue;
    g.Items.push({...item(x,y),Power:'thunder_potion',Stationary:true});present++;
  }
}
export function captureBoss(g:GameState) {
  const b=g.Party!.Boss!;
  b.HP=0;b.Mode='captured';b.Timer=0;b.Invulnerable=0;
  g.Projectiles=[];g.Bubbles=[];g.Effects=[];g.Items=[];g.Sounds.push('item');
}
/** Called at every swept lightning position, so fast bolts cannot tunnel through the boss. */
export function hitBossWithThunder(g:GameState,x:number,y:number,w:number,h:number):boolean {
  const b=g.Party?.Boss;
  if(g.Party?.Phase!=='boss'||!b||b.Mode==='captured'||!intersects(x,y,w,h,b.X,b.Y,bossSize,bossSize))return false;
  b.HP--;b.Invulnerable=8;addScore(g,100,b.X,b.Y);
  // Invulnerable is a visual hit flash, not a gate: simultaneous teammates' bolts all count.
  if(b.HP<=0)captureBoss(g);
  return true;
}
function bottleFan(g:GameState) {
  const b=g.Party!.Boss!,dir=b.Dir;
  // Fixed slopes avoid platform-dependent trig and give clear gaps between bottles.
  for(const slope of [-1.2,-.8,-.4,0,.4,.8,1.2])
    g.Projectiles.push({...body(b.X+48+dir*40,b.Y+38),VX:dir*3.8,VY:slope*3.2,Bottle:true,Laser:false,Age:0,Removed:false});
  g.Sounds.push('laser');
}
export function stepBoss(g:GameState) {
  const b=g.Party!.Boss!;b.Tick++;
  if(b.Invulnerable>0)b.Invulnerable--;
  if(b.HP<=0&&b.Mode!=='captured')captureBoss(g);
  if(b.Mode==='captured') {
    b.Timer++;
    // Settle within reach of the floor. No timed escape/restart in the co-op adaptation.
    b.Y=Math.min(arenaHeight(g)-Tile-bossSize,b.Y+1.5);
    if(b.Timer<30)return;
    const finisher=g.Players.findIndex(p=>alive(p)&&intersects(p.X,p.Y,ActorSize,ActorSize,b.X,b.Y,bossSize,bossSize));
    if(finisher>=0) {
      recordPartyKill(g,finisher);
      recordPartyLastKill(g,finisher);
      addScore(g,5000,b.X,b.Y);g.State=State.Won;g.Bubbles=[];g.Effects=[];g.Sounds.push('opening');
    }
    return;
  }
  if(b.Tick%120===0)ensureThunderPickups(g);
  if(g.Freeze>0)return;
  if(b.Mode==='windup') {
    if(--b.Timer<=0){bottleFan(g);b.Mode='moving';b.Timer=b.HP*3<=b.MaxHP?100:150;}
    return;
  }
  const speed=b.HP*3<=b.MaxHP?1.25:1;
  b.X+=b.VX*speed;b.Y+=b.VY*speed;
  const right=arenaWidth(g)-2*Tile-bossSize,bottom=arenaHeight(g)-Tile-bossSize;
  if(b.X<=2*Tile||b.X>=right){b.X=Math.max(2*Tile,Math.min(right,b.X));b.VX=-b.VX;}
  if(b.Y<=Tile||b.Y>=bottom){b.Y=Math.max(Tile,Math.min(bottom,b.Y));b.VY=-b.VY;}
  b.Dir=b.VX<0?-1:1;
  if(--b.Timer<=0) {
    let target=g.Players.find(alive),distance=Infinity;
    for(const p of g.Players)if(alive(p)&&Math.abs(p.X-b.X)<distance){target=p;distance=Math.abs(p.X-b.X);}
    b.Dir=target&&target.X+22<b.X+48?-1:1;
    b.Mode='windup';b.Timer=30;
  }
}
