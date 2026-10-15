import round1 from './fixtures/arcade-round-1-combat.expected.json';
import setup1 from './scenarios/arcade-round-1-combat.json';
import round10 from './fixtures/arcade-round-10-combat.expected.json';
import setup10 from './scenarios/arcade-round-10-combat.json';
import round24 from './fixtures/arcade-round-24-combat.expected.json';
import setup24 from './scenarios/arcade-round-24-combat.json';
import round25 from './fixtures/arcade-round-25-combat.expected.json';
import setup25 from './scenarios/arcade-round-25-combat.json';
import {worldTest} from '@gameengine/test';
import {ResetArcade} from '../src/arcade/arcade.cheats';
import {ArcadeInput} from '../src/schema.gen';
import {session} from '../src/arcade/session';
import {canonicalState} from '../src/arcade/game';
import smoke from './fixtures/reference-round1-smoke.expected.json';
import setup from './scenarios/reference-round1-smoke.json';
import {match} from './arcade-assert';
// Engine event path + document state. These tests do not claim visual/audio parity.
for(const [fixture,scenario] of [[smoke,setup],[round1,setup1],[round10,setup10],[round24,setup24],[round25,setup25]] as const) {
 worldTest(`arcade engine input full Go parity ${fixture.scenario}`,async({step,input,cheat})=>{
  await step(1);
  await cheat(ResetArcade,{round:scenario.round,seed:scenario.seed,players:scenario.players,quiet:true,normalEnemySpeedScale:1,referencePlayerTuning:true});
  for(const f of fixture.frames){
   if(f.input){
    for(let player=0;player<scenario.players;player++){
     const i=f.input.players[player]??{Move:0,Jump:false,Fire:false};
     input.emit(ArcadeInput,{player,move:i.Move,jump:i.Jump,fire:i.Fire,paused:f.input.paused});
    }
    await step(1);
   }
   const g=session.get().game;
   if(!g)throw new Error(`Arcade session missing at frame ${f.frame}`);
   match(f.state,canonicalState(g),`${fixture.scenario}.frame[${f.frame}]`);
  }
 },{scene:'scenes/arcade.scene.json'});
}
