import { query, read, write } from '@gameengine/runtime';
import { defineCheat } from '@gameengine/runtime/cheats';
import { Bubble, Game, HarnessControl } from './schema.gen.ts';

// The bundler discovers this file; production gameplay must never import it.
export const ResetHarness = defineCheat({
  id: 'harness.reset',
  group: 'Harness',
  title: 'Reset named starter scenario',
  description: 'Replaces all starter bubbles with one stationary bubble at the origin. No port gameplay is enabled.',
  params: { scenario: { type: 'enum', values: ['starter-tap'], default: 'starter-tap' } },
  query: query(read(Bubble)),
  resources: [write(Game), write(HarnessControl)],
  run(ctx, _params, q) {
    for (const c of q.chunks()) for (let i = 0; i < c.length; i++) ctx.commands.despawn(c.entity(i));
    ctx.set(HarnessControl, { active: 1 });
    ctx.set(Game, { score: 0, spawned: 1 });
    ctx.commands.spawn({
      LocalTransform: { position: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] },
      Shape: { kind: 'Circle', size: [2, 2], radius: 1, color: '#6bc5ff' },
      Bubble: { radius: 1, speed: 0 },
    });
  },
});
