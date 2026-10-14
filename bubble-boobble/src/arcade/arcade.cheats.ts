import { write } from '@gameengine/runtime';
import { defineCheat } from '@gameengine/runtime/cheats';
import campaign from '../../data/levels.json';
import { ArcadeControl } from '../schema.gen.ts';
import { createGame } from './game.ts';
import type { Level } from './types.ts';
import { session } from './session.ts';
import { desktopAction } from '../desktop/state.ts';
import {scenarioGame} from './scenarios.ts';
import type {ArcadeScenario} from './scenarios.ts';
import scenarioInputs from '../../data/harness-scenarios.json';
const scenarios=scenarioInputs as Record<string,ArcadeScenario>;
export const ResetArcade = defineCheat({
  id: 'arcade.reset', group: 'Arcade', title: 'Reset pinned campaign scenario',
  params: {
    round: { type: 'int', min:1,max:25,default:1 },
    seed: { type: 'int',min:0,max:2147483647,default:1 },
    players: { type: 'int',min:1,max:2,default:1 },
    ready: { type:'bool',default:true }, quiet:{type:'bool',default:true},
    scenario: {type:'string',default:''},
  },
  resources:[write(ArcadeControl)],
  run(ctx,{round,seed,players,ready,scenario}) {
    const setup=scenario?scenarios[scenario]:undefined;
    if(scenario&&!setup)throw new Error(`Unknown arcade scenario: ${scenario}`);
    const game=setup?scenarioGame(campaign as Level[],setup):createGame((campaign as Level[]).slice(round-1),seed,players);
    if(!setup&&!ready){game.State=1;game.Countdown=0;}
    // LIVE_PROBE_ANCHOR
    desktopAction('navigate','play');
    session.set({active:true,mode:'campaign',game});
    ctx.set(ArcadeControl,{active:true,skip:true});
  },
});
