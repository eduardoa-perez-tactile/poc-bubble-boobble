import {referencePlayerBalance} from '../src/arcade/balance';
import round1 from './fixtures/arcade-round-1-combat.expected.json';
import setup1 from './scenarios/arcade-round-1-combat.json';
import round10 from './fixtures/arcade-round-10-combat.expected.json';
import setup10 from './scenarios/arcade-round-10-combat.json';
import round24 from './fixtures/arcade-round-24-combat.expected.json';
import setup24 from './scenarios/arcade-round-24-combat.json';
import round25 from './fixtures/arcade-round-25-combat.expected.json';
import setup25 from './scenarios/arcade-round-25-combat.json';
import {worldTest} from '@gameengine/test';
import {canonicalState,createGame,stepGame} from '../src/arcade/game';
import type {Level} from '../src/arcade/types';
import levels from '../data/levels.json';
import smoke from './fixtures/reference-round1-smoke.expected.json';
import setup from './scenarios/reference-round1-smoke.json';
import {match} from './arcade-assert';
for(const [fixture,scenario] of [[smoke,setup],[round1,setup1],[round10,setup10],[round24,setup24],[round25,setup25]] as const) {
 worldTest(`arcade pure simulation full Go parity ${fixture.scenario}`,()=>{
  const g=createGame((levels as Level[]).slice(scenario.round-1),scenario.seed,scenario.players);
  // Original fixtures deliberately exercise both original numeric profiles.
  // Separate balance regressions assert the playable movement and shooting.
  g.NormalEnemySpeedScale=1;
  g.PlayerBalance={...referencePlayerBalance};
  for(const f of fixture.frames){
   if(f.input){g.Paused=f.input.paused;stepGame(g,f.input.players);}
   match(f.state,canonicalState(g),`${fixture.scenario}.frame[${f.frame}]`);
  }
 },{scene:'scenes/main.scene.json'});
}
