import { ActorSize, Tile, Width, Height, State, alive, body, intersects, type GameState, type PartyBoss } from './types';
import { item } from './items';
import { addScore } from './game';

export const bossSize = 96;
// Bubble Madness tuning for 1–6 dragons; these are not claimed arcade ROM values.
export function createBoss(team:number):PartyBoss {
  const hp=18+team*6;
  return {X:336,Y:150,VX:2.25,VY:2.25,Dir:1,HP:hp,MaxHP:hp,Tick:0,Invulnerable:0,Mode:'moving',Timer:150};
}
/** Individual floor pickups are replenished after deaths; collecting one never deprives a teammate. */
export function ensureThunderPickups(g:GameState) {
  const b=g.Party?.Boss;
  if(!b||b.Mode==='captured')return;
  const needed=g.Players.filter(p=>alive(p)&&!p.Power.Thunder).length;
  let present=g.Items.filter(i=>i.Power==='thunder_potion').length;
  for(let i=0;present<needed&&i<6;i++) {
    const x=80+i*116,y=Height-Tile-32;
    if(g.Items.some(it=>it.Power==='thunder_potion'&&Math.abs(it.X-x)<32))continue;
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
    b.Y=Math.min(Height-Tile-bossSize,b.Y+1.5);
    if(b.Timer<30)return;
    if(g.Players.some(p=>alive(p)&&intersects(p.X,p.Y,ActorSize,ActorSize,b.X,b.Y,bossSize,bossSize))) {
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
  const right=Width-2*Tile-bossSize,bottom=Height-Tile-bossSize;
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
