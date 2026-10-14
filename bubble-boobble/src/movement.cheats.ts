import { write } from '@gameengine/runtime';
import { defineCheat } from '@gameengine/runtime/cheats';
import { PortMatch, PortPlayer } from './schema.gen.ts';
import { initialPlayer, spawnPosition } from './movement.ts';
export const ResetMovement = defineCheat({
  id: 'port.movement', group: 'Port', title: 'Reset round 1 movement',
  params: {
    spawnCol: { type: 'int', default: -1 }, spawnRow: { type: 'int', default: -1 },
    x: { type: 'number', default: -1 }, y: { type: 'number', default: -1 },
    vy: { type: 'number', default: 0 }, coyote: { type: 'int', default: 0 },
    ready: { type: 'bool', default: false },
  },
  resources: [write(PortPlayer), write(PortMatch)],
  run(ctx, args) {
    const p = initialPlayer();
    if (args.spawnCol >= 0) [p.x, p.y] = spawnPosition(args.spawnCol, args.spawnRow);
    if (args.x >= 0) p.x = args.x;
    if (args.y >= 0) p.y = args.y;
    p.vy = args.vy; p.coyote = args.coyote;
    ctx.set(PortPlayer, p);
    ctx.set(PortMatch, { active: true, tick: 0, countdown: args.ready ? 60 : 0, ready: args.ready, paused: false, walked: 0, jumps: 0, jumpSound: false, skip: true });
  },
});
