import {referencePlayerBalance} from '../src/arcade/balance';
import {worldTest} from '@gameengine/test';
import campaign from '../data/levels.json';
import {scenarioGame} from '../src/arcade/scenarios';
import {stepGame,canonicalState} from '../src/arcade/game';
import {session} from '../src/arcade/session';
import {ResetArcade} from '../src/arcade/arcade.cheats';
import {ArcadeInput} from '../src/schema.gen';
import {match} from './arcade-assert';
import {boundaryCases} from './arcade-boundary-cases';
for(const [scenario,fixture] of boundaryCases){
 worldTest(`arcade boundary pure exact Go ${scenario.name}`,()=>{
  const g=scenarioGame(campaign,scenario);
  g.NormalEnemySpeedScale=1;
  g.PlayerBalance={...referencePlayerBalance};
  for(const f of fixture.frames){
   if(f.input){g.Paused=f.input.paused;stepGame(g,f.input.players);}
   match(f.state,canonicalState(g),`${scenario.name}.frame[${f.frame}]`);
  }
 },{scene:'scenes/main.scene.json'});
 worldTest(`arcade boundary engine input exact Go ${scenario.name}`,async({step,input,cheat})=>{
  await step(1);
  await cheat(ResetArcade,{scenario:scenario.name,quiet:true,normalEnemySpeedScale:1,referencePlayerTuning:true});
  for(const f of fixture.frames){
   if(f.input){
    for(let player=0;player<scenario.players;player++){
     const i=f.input.players[player]??{Move:0,Jump:false,Fire:false};
     input.emit(ArcadeInput,{player,move:i.Move,jump:i.Jump,fire:i.Fire,paused:f.input.paused});
    }
    await step(1);
   }
   const g=session.get().game;
   if(!g)throw new Error(`Missing controlled session ${scenario.name}`);
   match(f.state,canonicalState(g),`${scenario.name}.frame[${f.frame}]`);
  }
 },{scene:'scenes/arcade.scene.json'});
}
