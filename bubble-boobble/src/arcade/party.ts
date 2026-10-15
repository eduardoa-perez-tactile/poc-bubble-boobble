import { createGame, addScore, remainingEnemies } from './game';
import { enableCompanion, companionInput } from './companion';
import { respawn, updatePlayer, checkPlayerHit } from './player';
import { updateEnemies, updateProjectiles, updateDefeated } from './enemies';
import { updateBubbles, updateEffects } from './bubbles';
import { updateItems, checkPowerSpawns, spawnFood } from './items';
import { body, alive, EnemyState, State, Tile, ActorSize, intersects, type GameState, type Input, type Level, type PartySlot } from './types';

import { partyColors, defaultPartySlots } from './party-config';
export { partyColors, partySpawnColumns, defaultPartySlots } from './party-config';
const idle: Input = Object.freeze({Move:0,Jump:false,Fire:false});
const entrances = [{col:4,row:10},{col:26,row:10},{col:4,row:20},{col:26,row:20}];
const kinds = ['zenchan','monsta','banebou','mighta','pulpul','invader'];

/** One authoritative party document; the campaign's arena is copied, never modified. */
export function createPartyGame(levels:Level[], seed:number, slots:PartySlot[]=defaultPartySlots, bossWave=10):GameState {
  if (slots.length!==6 || !slots.includes('human') || slots.some(s=>!['human','ai','empty'].includes(s))) throw new Error('Choose six slots with at least one human');
  if (!Number.isInteger(bossWave)||bossWave<2||bossWave>100) throw new Error('Invalid boss wave');
  const g=createGame(levels.slice(0,1),seed,6);
  g.Party={Wave:1,BossWave:bossWave,Phase:'prepare',Timer:180,Slots:slots.slice(),ToSpawn:0,SpawnTick:0,Spawned:0,Telegraphs:[]};
  g.Enemies=[];g.Companions=Array.from({length:6},()=>null);
  for(let i=0;i<6;i++) {
    g.Players[i]!.Skin=partyColors[i];
    g.Players[i]!.Lives=slots[i]==='empty'?0:1;
    respawn(g,i);
    if(slots[i]==='ai')enableCompanion(g,i);
  }
  return g;
}
export function copyParty(g:GameState) {
  const p=g.Party;
  return p?{...p,Slots:p.Slots.slice(),Telegraphs:p.Telegraphs.map(t=>({...t})),...(p.Boss?{Boss:{...p.Boss}}:{})}:undefined;
}
const occupied=(g:GameState)=>g.Party!.Slots.reduce((n,s)=>n+(s!=='empty'?1:0),0);
export function partyWaveBudget(wave:number,team:number) { return 3+wave*2+Math.max(0,team-1)*2; }
function beginWave(g:GameState) {
  const p=g.Party!;
  g.State=State.Playing;g.LevelTicks=0;g.Hurry=false;g.Freeze=0;g.Bubbles=[];g.Projectiles=[];g.Effects=[];g.Enemies=[];
  for(const dragon of g.Players) if(alive(dragon))dragon.Invincible=120;
  p.Timer=0;p.Spawned=0;p.Telegraphs=[];p.SpawnTick=0;
  p.Phase=p.Wave===p.BossWave?'boss':'combat';
  p.ToSpawn=p.Phase==='boss'?0:partyWaveBudget(p.Wave,occupied(g));
  if(p.Phase==='boss') {
    const hp=12+occupied(g)*6;
    p.Boss={X:336,Y:150,HP:hp,MaxHP:hp,Tick:0,Invulnerable:1};
  }
}
function scheduleEnemy(g:GameState) {
  const p=g.Party!;
  const c=entrances[p.Spawned%entrances.length]!;
  // Spawn at platform feet, not inside geometry; 60 ticks of visible warning.
  p.Telegraphs.push({X:c.col*Tile,Y:c.row*Tile-ActorSize,Ticks:60});
  p.Spawned++;p.ToSpawn--;
}
function spawnTelegraphs(g:GameState) {
  const p=g.Party!;
  const ready=p.Telegraphs.filter(t=>--t.Ticks<=0);
  p.Telegraphs=p.Telegraphs.filter(t=>t.Ticks>0);
  for(const t of ready) {
    g.NextID++;
    const variety=Math.min(kinds.length,1+Math.floor((p.Wave-1)/2));
    g.Enemies.push({...body(t.X,t.Y),ID:g.NextID,Kind:kinds[(g.NextID-1)%variety]!,State:EnemyState.Active,Dir:t.X<384?1:-1,Vertical:1,Angry:false,Age:0,Cooldown:120,Shoot:0,DeadTicks:0,Phase:0,CarriedBy:0,CarryTicks:0});
  }
}
function revive(g:GameState,index:number) {
  const dragon=g.Players[index]!;
  const x=dragon.X,y=dragon.Y;
  dragon.Lives=1;respawn(g,index);
  Object.assign(g.Players[index]!,{X:x,Y:y,Downed:false,Invincible:180});
  g.Sounds.push('item');
}
function rescues(g:GameState) {
  for(let i=0;i<g.Players.length;i++) {
    const p=g.Players[i]!;
    if(!p.Downed)continue;
    if(g.Players.some((other,j)=>j!==i&&alive(other)&&Math.abs(other.X-p.X)<52&&Math.abs(other.Y-p.Y)<52))revive(g,i);
  }
}
function rest(g:GameState) {
  const p=g.Party!;
  for(const e of g.Enemies)if(e.State===EnemyState.Defeated&&e.DeadTicks>0)spawnFood(g,e.X,e.Y);
  p.Phase='rest';p.Timer=600;p.Telegraphs=[];
  g.State=State.Clearing;g.Countdown=600;g.Enemies=[];g.Projectiles=[];g.Bubbles=[];g.Effects=[];g.Freeze=0;g.Hurry=false;
  for(let i=0;i<g.Players.length;i++)if(g.Players[i]!.Downed)revive(g,i);
}
function stepBoss(g:GameState) {
  const p=g.Party!,b=p.Boss!;b.Tick++;
  // First 90 ticks wind up the attack; the following 150 expose the boss.
  const phase=b.Tick%300;
  b.Invulnerable=phase<90||phase>=240?1:0;
  if(phase===90) {
    for(const dragon of g.Players)if(alive(dragon))g.Projectiles.push({...body(Math.max(60,Math.min(690,dragon.X+14)),48),VY:4,Laser:true,Age:0,Removed:false});
    g.Sounds.push('laser');
  }
  if(b.Tick%600===1&&remainingEnemies(g)<6) {p.ToSpawn=2;scheduleEnemy(g);scheduleEnemy(g);}
  if(!b.Invulnerable)for(const shot of g.Bubbles) {
    if(shot.Removed||shot.EnemyID||shot.Element||shot.Floating||shot.Age<=0)continue;
    if(intersects(shot.X,shot.Y,40,40,b.X,b.Y,96,96)){shot.Removed=true;b.HP--;addScore(g,100,b.X,b.Y);g.Sounds.push('pop');if(b.HP<=0)break;}
  }
  g.Bubbles=g.Bubbles.filter(shot=>!shot.Removed);
  if(b.HP<=0) {addScore(g,5000,b.X,b.Y);g.State=State.Won;g.Projectiles=[];g.Enemies=[];g.Sounds.push('opening');}
}
/** Called only from the fixed-step simulation, with recorded human input. */
export function stepParty(g:GameState,inputs:Input[]) {
  const p=g.Party!;
  g.Tick++;
  if(p.Phase==='prepare') {
    p.Timer--;g.Countdown=p.Timer;
    if(p.Timer<=0)beginWave(g);
    return;
  }
  const ins=inputs.slice();
  for(let i=0;i<6;i++) {
    if(p.Slots[i]==='empty')continue;
    if(p.Slots[i]==='ai')ins[i]=companionInput(g,i);
    if(alive(g.Players[i]!))updatePlayer(g,i,p.Phase==='rest'?{...(ins[i]??idle),Fire:false}:ins[i]??idle);
  }
  if(p.Phase==='rest') {
    updateItems(g);g.Particles=g.Particles.filter(v=>{v.Y-=.6;return --v.Life>0;});p.Timer--;g.Countdown=p.Timer;
    if(p.Timer<=0){p.Wave++;beginWave(g);}
    return;
  }
  rescues(g);
  if(!g.Players.some(alive)){g.State=State.GameOver;return;}
  g.LevelTicks++;
  const cap=Math.min(12,4+occupied(g));
  if(p.Phase==='combat'&&p.ToSpawn>0&&remainingEnemies(g)+p.Telegraphs.length<cap) {
    if(p.SpawnTick<=0){scheduleEnemy(g);p.SpawnTick=Math.max(45,150-(p.Wave-1)*10);}else p.SpawnTick--;
  }
  spawnTelegraphs(g);
  if(g.Freeze>0)g.Freeze--;else{updateEnemies(g);updateProjectiles(g);}
  // Remove completed actors to bound long-session work.
  updateDefeated(g);g.Enemies=g.Enemies.filter(e=>e.State!==EnemyState.Defeated||e.DeadTicks>0);
  updateBubbles(g,ins);updateEffects(g);updateItems(g);checkPowerSpawns(g);
  if(p.Phase==='boss')stepBoss(g);
  if(g.State===State.Won)return;
  for(let i=0;i<6;i++)checkPlayerHit(g,i);
  if(!g.Players.some(alive)){g.State=State.GameOver;return;}
  if(p.Phase==='combat'&&p.ToSpawn===0&&p.Telegraphs.length===0&&remainingEnemies(g)===0)rest(g);
  g.Particles=g.Particles.filter(v=>{v.Y-=.6;return --v.Life>0;});
}
