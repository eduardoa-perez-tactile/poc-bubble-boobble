import { write } from '@gameengine/runtime';
import { defineCheat } from '@gameengine/runtime/cheats';
import { ArcadeControl } from '../schema.gen';
import { createGame } from './game';
import { desktopAction } from '../desktop/state';
import { session } from './session';
import { ActorSize, Rows, State, Tile, type Level } from './types';
export const PreparePlayerMotion = defineCheat({
  id: 'arcade.prepare-player-motion', group: 'Arcade', title: 'Prepare player motion verification',
  params: { mode: { type: 'string', default: 'fall' }, shoes: { type: 'bool', default: false } },
  resources: [write(ArcadeControl)],
  run(ctx, { mode, shoes }) {
    const level: Level = { number: 1, player: { col: 4, row: 25 }, power_spawn: { col: 4, row: 25 }, food_spawn: { col: 16, row: 25 }, enemies: [{ kind: 'zenchan', col: 26, row: 25 }], special: '', special_count: 0,
      tiles: Array.from({ length: Rows }, (_, r) => Array.from({ length: 32 }, (_, c) => c < 2 || c >= 30 || r === 0 || r === 25 ? 1 : 0)) };
    const g = createGame([level], 42, 2); g.State = State.Playing; g.Freeze = 10000;
    for (const p of g.Players) Object.assign(p, { X: 240, Y: mode === 'jump' ? 25 * Tile - ActorSize : 80, Ground: mode === 'jump', Invincible: 10000 });
    g.Players[1]!.X = 480;
    for (const p of g.Players) p.Power.Shoes = shoes;
    desktopAction('navigate', 'play'); session.set({ active: true, mode: 'motion-audit', game: g });
    ctx.set(ArcadeControl, { active: true, skip: true });
  },
});
