import { write } from '@gameengine/runtime';
import { defineCheat } from '@gameengine/runtime/cheats';
import { ArcadeControl } from '../schema.gen';
import { createGame } from './game';
import { bubble } from './bubbles';
import { item } from './items';
import { desktopAction } from '../desktop/state';
import { session } from './session';
import { ActorSize, EnemyState, State, Tile, type Level } from './types';
import campaign from '../../data/levels.json';
export const PrepareScoring = defineCheat({
  id: 'arcade.prepare-scoring', group: 'Arcade', title: 'Prepare bubble and fruit scoring',
  params: { mode: { type: 'string', default: 'bubble' }, player: { type: 'int', min: 0, max: 1, default: 0 }, fruit: { type: 'int', min: 1, max: 25, default: 1 } },
  resources: [write(ArcadeControl)],
  run(ctx, { mode, player, fruit }) {
    const g = createGame(campaign as Level[], 42, 2); g.State = State.Playing; g.Freeze = 10000;
    Object.assign(g.Players[player]!, { X: 240, Y: 25 * Tile - ActorSize, VY: 0, Ground: true, Invincible: 10000 });
    Object.assign(g.Players[1 - player]!, { X: 576, Y: 25 * Tile - ActorSize, VY: 0, Ground: true, Invincible: 10000 });
    const p = g.Players[player]!;
    if (mode === 'fruit' || mode === 'mixed') g.Items = [{ ...item(p.X, p.Y + 12), Stationary: true, Food: fruit }];
    if (mode !== 'fruit') {
      const e = g.Enemies[0]!;
      if (mode === 'enemy') Object.assign(e, { X: p.X + 16, Y: p.Y, State: EnemyState.Trapped });
      g.Bubbles = [{ ...bubble(p.X + 16, p.Y), ID: ++g.NextID, Age: 30, Floating: true, EnemyID: mode === 'enemy' ? e.ID : 0 }];
    }
    desktopAction('navigate', 'play'); session.set({ active: true, mode: 'scoring-audit', game: g });
    ctx.set(ArcadeControl, { active: true, skip: true });
  },
});
