import { createPartyArena } from './party-arena';
import { partyEnemyFormation } from './party-spawns';
import { createBoss, ensureThunderPickups, stepBoss } from './boss';
import { createGame, remainingEnemies } from './game';
import { enableCompanion, companionInput, warmPartyNavigation } from './companion';
import { respawn, updatePlayer, checkPlayerHit } from './player';
import { updateEnemies, updateProjectiles, updateDefeated } from './enemies';
import { updateBubbles, updateEffects } from './bubbles';
import { updateItems, checkPowerSpawns, spawnFood } from './items';
import { arenaWidth, body, alive, EnemyState, State, type GameState, type Input, type Level, type PartySlot } from './types';

import { partyColors, defaultPartySlots, partyPrepareTicks, partyBreakTicks, partySurvivorCount, partyStartGraceTicks } from './party-config';
export { partyColors, partySpawnColumns, defaultPartySlots } from './party-config';
const idle: Input = Object.freeze({Move:0,Jump:false,Fire:false});
const kinds = ['zenchan','monsta','banebou','mighta','pulpul','invader'];

/** One authoritative party document; the campaign's arena is copied, never modified. */
export function createPartyGame(levels:Level[], seed:number, slots:PartySlot[]=defaultPartySlots, bossWave=10):GameState {
  if (![6,10].includes(slots.length) || !slots.includes('human') || slots.some(s=>!['human','ai','empty'].includes(s))) throw new Error('Choose six or ten slots with at least one human');
  if (!Number.isInteger(bossWave)||bossWave<2||bossWave>100) throw new Error('Invalid boss wave');
  if(!levels.length)throw new Error('no levels supplied');
  const g=createGame(slots.length>6?[createPartyArena(levels[0]!)]:levels.slice(0,1),seed,slots.length);
  g.Party={Kills:slots.map(()=>0),Wave:1,BossWave:bossWave,Phase:'prepare',Timer:partyPrepareTicks,Slots:slots.slice(),ToSpawn:0,SpawnTick:0,Spawned:0,Telegraphs:[]};
  g.Enemies=[];g.Companions=Array.from({length:slots.length},()=>null);
  for(let i=0;i<g.Players.length;i++) {
    g.Players[i]!.Skin=partyColors[i];
    g.Players[i]!.Lives=slots[i]==='empty'?0:1;
    respawn(g,i);
    if(slots[i]==='ai')enableCompanion(g,i);
  }
  preparePartyWave(g);
  return g;
}
export function copyParty(g:GameState) {
  const p=g.Party;
  return p?{...p,Kills:p.Kills?.slice(),Slots:p.Slots.slice(),Telegraphs:p.Telegraphs.map(t=>({...t})),...(p.Boss?{Boss:{...p.Boss}}:{}),...(p.LastKill?{LastKill:{...p.LastKill}}:{})}:undefined;
}
const occupied=(g:GameState)=>g.Party!.Slots.reduce((n,s)=>n+(s!=='empty'?1:0),0);
export function partyWaveBudget(wave:number,team:number) { return Math.min(32,3+wave*2+Math.max(0,Math.min(team,6)-1)*2 + Math.ceil(Math.max(0,team-6)/2)); }
/** Show the whole formation before releasing it, just like a campaign round. */
export function preparePartyWave(g:GameState) {
  const p=g.Party!;
  g.State=State.Playing;g.LevelTicks=0;g.Hurry=false;g.Freeze=0;g.Bubbles=[];g.Projectiles=[];g.Effects=[];g.Enemies=[];
  p.Phase='prepare';p.Timer=partyPrepareTicks;g.Countdown=p.Timer;p.Spawned=0;p.Telegraphs=[];p.SpawnTick=0;p.ToSpawn=0;
  delete p.Boss;delete p.LastKill;
  if(p.Wave===p.BossWave) {
    p.Boss=createBoss(occupied(g),g.Level);
    g.Items=[];ensureThunderPickups(g);
    return;
  }
  const count=partyWaveBudget(p.Wave,occupied(g));
  const variety=Math.min(kinds.length,p.Wave+1);
  const waveKinds=Array.from({length:count},(_,index)=>kinds[(index+p.Wave-1)%variety]!);
  const formation=partyEnemyFormation(g,waveKinds);
  for(let index=0;index<count;index++) {
    const spawn=formation[index]!,x=spawn.X,y=spawn.Y;
    g.NextID++;
    g.Enemies.push({...body(x,y),Ground:spawn.Ground,ID:g.NextID,Kind:waveKinds[index]!,State:EnemyState.Active,Dir:x<arenaWidth(g)/2?1:-1,Vertical:index%2?1:-1,Angry:false,Age:0,Cooldown:120,Shoot:0,DeadTicks:0,Phase:index*.6,CarriedBy:0,CarryTicks:0});
  }
  p.Spawned=count;
}
function beginWave(g:GameState) {
  const p=g.Party!;
  p.Timer=0;p.Phase=p.Boss?'boss':'combat';
  for(const dragon of g.Players) if(alive(dragon))dragon.Invincible=partyStartGraceTicks;
}
function spawnTelegraphs(g:GameState) {
  const p=g.Party!;
  const ready=p.Telegraphs.filter(t=>--t.Ticks<=0);
  p.Telegraphs=p.Telegraphs.filter(t=>t.Ticks>0);
  for(const t of ready) {
    g.NextID++;
    const variety=Math.min(kinds.length,p.Wave+1);
    g.Enemies.push({...body(t.X,t.Y),ID:g.NextID,Kind:kinds[(g.NextID-1)%variety]!,State:EnemyState.Active,Dir:t.X<arenaWidth(g)/2?1:-1,Vertical:1,Angry:false,Age:0,Cooldown:120,Shoot:0,DeadTicks:0,Phase:0,CarriedBy:0,CarryTicks:0});
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
  p.Phase='rest';p.Timer=partyBreakTicks;p.Telegraphs=[];
  g.State=State.Clearing;g.Countdown=p.Timer;g.Enemies=[];g.Projectiles=[];g.Bubbles=[];g.Effects=[];g.Freeze=0;g.Hurry=false;
  for(let i=0;i<g.Players.length;i++)if(g.Players[i]!.Downed)revive(g,i);
}
function enrageLastEnemy(g:GameState) {
  const p=g.Party!;
  if(p.Phase!=='combat'||p.ToSpawn>0||p.Telegraphs.length>0)return;
  let last;
  for(const e of g.Enemies) {
    if(e.State===EnemyState.Defeated)continue;
    if(last)return;
    last=e;
  }
  if(last?.State===EnemyState.Active)last.Angry=true;
}
/** Called only from the fixed-step simulation, with recorded human input. */
export function stepParty(g:GameState,inputs:Input[]) {
  const p=g.Party!;
  g.Tick++;
  // Every occupied slot counts, including AI teammates and the final dragon.
  // Check before phase handling so a wiped team cannot enter another wave.
  if(partySurvivorCount(g)===0){g.State=State.GameOver;return;}
  warmPartyNavigation(g);
  const ins=inputs.slice(),holdMovement=p.Phase==='prepare'&&p.Wave===1;
  for(let i=0;i<g.Players.length;i++) {
    if(p.Slots[i]==='empty')continue;
    if(p.Slots[i]==='ai')ins[i]=holdMovement?idle:companionInput(g,i);
    if(holdMovement)ins[i]={Move:0,Jump:false,Fire:!!ins[i]?.Fire};
    if(alive(g.Players[i]!))updatePlayer(g,i,ins[i]??idle,!holdMovement);
  }
  if(p.Phase==='prepare') {
    updateBubbles(g,ins);updateEffects(g);updateItems(g);
    g.Particles=g.Particles.filter(v=>{v.Y-=.6;return --v.Life>0;});
    rescues(g);p.Timer--;g.Countdown=p.Timer;
    if(p.Timer<=0)beginWave(g);
    return;
  }
  if(p.Phase==='rest') {
    updateBubbles(g,ins);updateEffects(g);updateItems(g);g.Particles=g.Particles.filter(v=>{v.Y-=.6;return --v.Life>0;});p.Timer--;g.Countdown=p.Timer;
    if(p.Timer<=partyPrepareTicks){p.Wave++;preparePartyWave(g);}
    return;
  }
  rescues(g);
  g.LevelTicks++;
  spawnTelegraphs(g);
  enrageLastEnemy(g);
  if(g.Freeze>0)g.Freeze--;else{updateEnemies(g);updateProjectiles(g);}
  // Remove completed actors to bound long-session work.
  updateDefeated(g);g.Enemies=g.Enemies.filter(e=>e.State!==EnemyState.Defeated||e.DeadTicks>0);
  updateBubbles(g,ins);updateEffects(g);updateItems(g);checkPowerSpawns(g);
  enrageLastEnemy(g);
  if(p.Phase==='boss')stepBoss(g);
  if(g.State===State.Won)return;
  for(let i=0;i<g.Players.length;i++)checkPlayerHit(g,i);
  if(partySurvivorCount(g)===0){g.State=State.GameOver;return;}
  if(p.Phase==='combat'&&p.ToSpawn===0&&p.Telegraphs.length===0&&remainingEnemies(g)===0)rest(g);
  g.Particles=g.Particles.filter(v=>{v.Y-=.6;return --v.Life>0;});
}
