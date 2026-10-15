import {referencePlayerBalance} from './balance';
import { write } from '@gameengine/runtime';
import { defineCheat } from '@gameengine/runtime/cheats';
import campaign from '../../data/levels.json';
import sprites from '../../data/sprites.json';
import { ArcadeControl } from '../schema.gen.ts';
import { createGame, copyGame } from './game.ts';
import { bubble } from './bubbles.ts';
import type { Level } from './types.ts';
import { session } from './session.ts';
import { desktopAction } from '../desktop/state.ts';
import {scenarioGame} from './scenarios.ts';
import {item} from './items.ts';
import type {ArcadeScenario} from './scenarios.ts';
import scenarioInputs from '../../data/harness-scenarios.json';
const scenarios=scenarioInputs as Record<string,ArcadeScenario>;
export const PopBurst = defineCheat({
  id:'arcade.pop-burst',group:'Audio',title:'Inspect simultaneous dragon pops',
  run(){
    const current=session.get();if(!current.game)return;
    const g=copyGame(current.game);
    g.Bubbles=g.Players.flatMap((p,Shooter)=>p.Lives>0&&!p.Downed?[{...bubble(p.X,p.Y),ID:++g.NextID,Shooter,Age:30,Floating:true}]:[]);
    session.set({...current,game:g});
  },
});
export const SpriteSizing = defineCheat({
  id: 'arcade.sprite-sizing', group: 'Arcade', title: 'Inspect pickup sprite proportions',
  resources: [write(ArcadeControl)],
  run(ctx) {
    const game = createGame(campaign as Level[], 42);
    game.State = 1;
    game.Paused = true;
    game.Enemies = [];
    game.Level = {...game.Level, tiles: game.Level.tiles.map(row => row.map(() => 0))};
    const names = Object.keys(sprites).filter(name => name.startsWith('food/') ||
      ['pink_candy','blue_candy','yellow_candy','shoes','crystal_ring','amethyst_ring','ruby_ring',
       'clock','dynamite','orange_parasol','red_parasol','purple_parasol'].includes(name));
    game.Items = names.map((name, index) => ({
      ...item(80 + (index % 7) * 88, 80 + Math.floor(index / 7) * 88),
      Stationary: true, Power: name.startsWith('food/') ? '' : name,
      Food: name.startsWith('food/') ? Number(name.slice(5)) : 0,
    }));
    Object.assign(game.Players[0]!.Power, {Pink:true,Blue:true,Yellow:true,Shoes:true,Crystal:true,Amethyst:true,Ruby:true});
    desktopAction('navigate', 'play');
    session.set({active:true,mode:'campaign',game});
    ctx.set(ArcadeControl, {active:true,skip:true});
  },
});
export const ResetArcade = defineCheat({
  id: 'arcade.reset', group: 'Arcade', title: 'Reset pinned campaign scenario',
  params: {
    round: { type: 'int', min:1,max:25,default:1 },
    seed: { type: 'int',min:0,max:2147483647,default:1 },
    players: { type: 'int',min:1,max:2,default:1 },
    ready: { type:'bool',default:true }, quiet:{type:'bool',default:true},
    scenario: {type:'string',default:''},
    referencePlayerTuning: {type:'bool',default:false,doc:'Use pinned Go player values for oracle comparisons only.'},
    normalEnemySpeedScale: {type:'number',min:0,max:1,default:0.8,doc:'Normal movement tuning; 1 reproduces source-speed oracle cases.'},
  },
  resources:[write(ArcadeControl)],
  run(ctx,{round,seed,players,ready,scenario,normalEnemySpeedScale,referencePlayerTuning}) {
    const setup=scenario?scenarios[scenario]:undefined;
    if(scenario&&!setup)throw new Error(`Unknown arcade scenario: ${scenario}`);
    const game=setup?scenarioGame(campaign as Level[],setup):createGame((campaign as Level[]).slice(round-1),seed,players);
    game.NormalEnemySpeedScale=normalEnemySpeedScale;
    if(referencePlayerTuning)game.PlayerBalance={...referencePlayerBalance};
    if(!setup&&!ready){game.State=1;game.Countdown=0;}
    // LIVE_PROBE_ANCHOR
    desktopAction('navigate','play');
    session.set({active:true,mode:'campaign',game});
    ctx.set(ArcadeControl,{active:true,skip:true});
  },
});
