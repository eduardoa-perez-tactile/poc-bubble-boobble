import { defineCheat } from '@gameengine/runtime/cheats';
import { session } from './session';
import { copyGame } from './game';
import { bubble } from './bubbles';
import { body, EnemyState } from './types';
export const FeelShowcase=defineCheat({id:'party.feel-showcase',group:'Party',title:'Inspect bubble captures chains and rescue readability',run(){
 const s=session.get();if(!s.game?.Party)return;const g=copyGame(s.game);
 g.Party!.Phase='combat';g.Party!.Timer=0;g.LevelTicks=120;g.State=1;g.Enemies=g.Enemies.slice(0,4);g.Bubbles=[];
 for(let i=0;i<g.Enemies.length;i++){
  const e=g.Enemies[i]!;Object.assign(e,{X:200+i*90,Y:260,State:EnemyState.Trapped});
  g.Bubbles.push({...bubble(e.X,e.Y),ID:100+i,Age:60,EnemyID:e.ID,CapturedAge:i===0?3:100,Floating:true,Shooter:i});
 }
 for(let i=0;i<6;i++){const p=g.Players[i]!;Object.assign(p,{X:72+i*110,Y:556,Ground:true,Invincible:0,Shoot:12,Cooldown:12});}
 g.Players[4]!.Downed=true;g.Players[4]!.Lives=0;
 g.Particles=Array.from({length:4},(_,i)=>({...body(290+i*25,420),Text:'',Life:14}));
 g.Particles.push({...body(320,420),Text:'800',Life:44});
 session.set({...s,game:g});
}});
export const FeedbackCluster=defineCheat({id:'party.feedback-cluster',group:'Party',title:'Inspect overlapping player and AI badges',run(){
 const s=session.get();if(!s.game?.Party)return;const g=copyGame(s.game);
 for(const p of g.Players)Object.assign(p,{X:340,Y:400,Ground:false,VY:0,Invincible:120,Downed:false,Lives:1,Shoot:0});
 g.Bubbles=[];g.Particles=[];g.Party!.Phase='prepare';g.Party!.Timer=180;
 session.set({...s,game:g});
}});
