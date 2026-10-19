import { bubble } from './bubbles';
import { captureBoss } from './boss';
import { defineCheat } from '@gameengine/runtime/cheats';
import { write } from '@gameengine/runtime';
import { ArcadeControl } from '../schema.gen';
import campaign from '../../data/levels.json';
import { createPartyGame, preparePartyWave } from './party';
import { copyGame } from './game';
import { session } from './session';
import { desktopGameRequest, desktopAction } from '../desktop/state';
import { EnemyState, State } from './types';
import { checkPowerSpawns } from './items';
import { hurtPlayer } from './player';
export const PartyReset=defineCheat({id:'party.reset',group:'Party',title:'Inspect wave survival',params:{team:{type:'int',min:6,max:10,default:6},countdown:{type:'int',min:1,max:180,default:1},wave:{type:'int',min:1,max:10,default:1},humans:{type:'int',min:1,max:10,default:1}},resources:[write(ArcadeControl)],run(ctx,{wave,humans,countdown,team}){
  const g=createPartyGame(campaign,42,Array.from({length:team===10?10:6},(_,i)=>i<humans?'human':'ai'));
  g.Party!.Wave=wave;preparePartyWave(g);g.Party!.Timer=countdown;
  desktopAction('party');desktopAction('start-party');
  session.set({active:true,mode:'party',game:g});ctx.setField(ArcadeControl,'skip',true);ctx.setField(ArcadeControl,'requestSequence',desktopGameRequest.get().sequence);
}});
export const PartyClear=defineCheat({id:'party.clear-wave',group:'Party',title:'Finish current enemy wave',run(){const current=session.get();if(!current.game?.Party)return;const g=copyGame(current.game);g.Party!.ToSpawn=0;g.Party!.Telegraphs=[];for(const e of g.Enemies){e.State=EnemyState.Defeated;e.DeadTicks=0;}session.set({...current,game:g});}});
export const PartyRescue=defineCheat({id:'party.rescue-setup',group:'Party',title:'Inspect teammate rescue',run(){const current=session.get();if(!current.game?.Party)return;const g=copyGame(current.game);g.Players[1]!.Downed=true;g.Players[1]!.Lives=0;g.Players[1]!.Dead=0;g.Players[1]!.X=g.Players[0]!.X+110;g.Players[1]!.Y=g.Players[0]!.Y;session.set({...current,game:g});}});
export const PartyVictory=defineCheat({id:'party.finish-boss',group:'Party',title:'Inspect boss victory result',run(){const current=session.get();if(!current.game?.Party?.Boss)return;const g=copyGame(current.game);const b=g.Party!.Boss!;b.HP=0;b.Mode='captured';b.Timer=30;const p=g.Players.find(p=>p.Lives>0&&!p.Downed)!;p.X=b.X;p.Y=b.Y;p.VY=0;p.Invincible=120;g.State=State.Playing;session.set({...current,game:g});}});
export const PartyPower=defineCheat({id:'party.powerup',group:'Party',title:'Inspect a randomized powerup',run(){const current=session.get();if(!current.game?.Party)return;const g=copyGame(current.game);g.Pending.push('pink_candy');checkPowerSpawns(g);session.set({...current,game:g});}});
export const PartyLastEnemy=defineCheat({id:'party.last-enemy',group:'Party',title:'Inspect the last angry enemy',run(){const current=session.get();if(!current.game?.Party)return;const g=copyGame(current.game);for(let i=1;i<g.Enemies.length;i++){g.Enemies[i]!.State=EnemyState.Defeated;g.Enemies[i]!.DeadTicks=0;}session.set({...current,game:g});}});
export const PartyHit=defineCheat({id:'party.hit-dragon',group:'Party',title:'Inspect a dragon elimination',params:{slot:{type:'int',min:0,max:9,default:0}},run(_ctx,{slot}){const current=session.get();if(!current.game?.Party)return;const g=copyGame(current.game);g.Players[slot]!.Invincible=0;hurtPlayer(g,slot);session.set({...current,game:g});}});
export const PartyBossDuel=defineCheat({id:'party.boss-duel',group:'Party',title:'Inspect thunder shot and boss capture',params:{captured:{type:'bool',default:false}},run(_ctx,{captured}){
 const current=session.get();if(!current.game?.Party?.Boss)return;const g=copyGame(current.game),b=g.Party!.Boss!;
 Object.assign(b,{X:420,Y:500,VX:0,VY:0,HP:1,Mode:'moving',Timer:600});
 Object.assign(g.Players[0]!,{X:250,Y:556,Dir:1,Ground:true,Invincible:600,Cooldown:0,Lives:1,Downed:false,Dead:0});g.Players[0]!.Power.Thunder=true;
 g.Bubbles=[];g.Projectiles=[];g.Effects=[];g.Items=[];if(captured)captureBoss(g);session.set({...current,game:g});
}});

export const PartyProtect=defineCheat({id:'party.protect-team',group:'Party',title:'Keep the full team firing during a stress capture',run(){
 const current=session.get();if(!current.game?.Party)return;const g=copyGame(current.game);
 for(const p of g.Players)p.Invincible=3600;
 session.set({...current,game:g});
}});

export const PartyFinalPop=defineCheat({id:'party.final-pop',group:'Party',title:'Place the last trapped enemy beside a chosen finisher',params:{slot:{type:'int',min:0,max:9,default:0}},run(_ctx,{slot}){
 const current=session.get();if(!current.game?.Party)return;
 const g=copyGame(current.game),p=g.Players[slot],enemy=g.Enemies[0];
 if(!p||!enemy||p.Lives<=0||p.Downed)return;
 g.Party!.Phase='combat';g.Party!.Timer=0;g.Party!.ToSpawn=0;g.Party!.Telegraphs=[];g.LevelTicks=120;
 Object.assign(enemy,{X:p.X,Y:p.Y,State:EnemyState.Trapped});g.Enemies=[enemy];
 g.NextID++;g.Bubbles=[{...bubble(p.X,p.Y),ID:g.NextID,EnemyID:enemy.ID,Age:30,Floating:true,Shooter:(slot+1)%g.Players.length}];
 g.Effects=[];g.Projectiles=[];session.set({...current,game:g});
}});

export const PartyBossSoak=defineCheat({id:'party.boss-soak',group:'Party',title:'Sustain a protected ten-dragon boss stress fight',run(){
 const current=session.get();if(!current.game?.Party?.Boss)return;const g=copyGame(current.game);
 g.Party!.Boss!.HP=1000000;g.Party!.Boss!.MaxHP=1000000;
 for(const p of g.Players){p.Invincible=1000000;p.Power.Thunder=true;}
 session.set({...current,game:g});
}});
