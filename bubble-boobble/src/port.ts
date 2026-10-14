import { defineSystem, query, read, write, ActionState, VisualOffset, Sprite, WorldView } from '@gameengine/runtime';
import { MovementInput, PortInput, PortMatch, PortPlayer, PortVisual } from './schema.gen.ts';
import { initialPlayer, updatePlayer } from './movement.ts';

export const PortBoot = defineSystem({
  name: 'PortBoot', query: query(read(PortVisual)), resources: [write(PortMatch), write(PortPlayer), write(WorldView)],
  runIf: { resource: PortMatch, field: 'active', value: false },
  run(ctx, q) {
    if (!q.count) return;
    ctx.set(PortPlayer, initialPlayer());
    ctx.set(PortMatch, { active: true });
    ctx.set(WorldView, { center: [384, 360], orthoSize: 360, designAspect: 768 / 720, fit: 'Contain' });
  },
});
export const PortControls = defineSystem({
  name: 'PortControls', after: ['PortBoot'], query: query(read(ActionState)),
  resources: [write(PortMatch), write(PortInput)], events: [MovementInput],
  runIf: { resource: PortMatch, field: 'active', value: true },
  run(ctx, q) {
    let move = 0, jump = false;
    for (const c of q.chunks()) for (let i = 0; i < c.length; i++) {
      const a = c.col(ActionState);
      if (c.is(ActionState, i, 'name', 'move')) move = a.value[i]!;
      if (c.is(ActionState, i, 'name', 'jump')) jump = a.pressed[i] !== 0;
      if (c.is(ActionState, i, 'name', 'pause') && a.justPressed[i]) ctx.setField(PortMatch, 'paused', !ctx.get(PortMatch).paused);
    }
    for (const e of ctx.events.read(MovementInput)) { move = e.move; jump = e.jump; ctx.setField(PortMatch, 'paused', e.paused); }
    ctx.set(PortInput, { move, jump });
  },
});
export const PortMovement = defineSystem({
  name: 'PortMovement', after: ['PortControls'],
  resources: [write(PortMatch), write(PortPlayer), read(PortInput)],
  runIf: { resource: PortMatch, field: 'active', value: true },
  run(ctx) {
    const m = ctx.get(PortMatch);
    if (m.skip) { ctx.setField(PortMatch, 'skip', false); return; }
    ctx.setField(PortMatch, 'jumpSound', false);
    if (m.paused) return;
    ctx.setField(PortMatch, 'tick', m.tick + 1);
    if (m.ready) {
      ctx.setField(PortMatch, 'countdown', m.countdown - 1);
      if (m.countdown <= 1) ctx.setField(PortMatch, 'ready', false);
      return;
    }
    const p = ctx.get(PortPlayer), input = ctx.get(PortInput), oldX = p.x;
    const jumped = updatePlayer(p, input.move, input.jump);
    ctx.set(PortPlayer, p);
    ctx.setField(PortMatch, 'walked', m.walked + Math.abs(p.x - oldX));
    if (jumped) { ctx.setField(PortMatch, 'jumps', m.jumps + 1); ctx.setField(PortMatch, 'jumpSound', true); }
  },
});
export const PortPresentation = defineSystem({
  name: 'PortPresentation', stage: 'LateUpdate',
  query: query(read(PortVisual), write(VisualOffset), write(Sprite)),
  resources: [read(PortPlayer), read(PortMatch)],
  runIf: { resource: PortMatch, field: 'active', value: true },
  run(ctx, q) {
    const p = ctx.get(PortPlayer), m = ctx.get(PortMatch);
    const state = p.ground ? 'walk' : 'jump';
    const frame = Math.floor(Math.max(0, p.ground ? p.walkFrame : m.tick) / 10) % (p.ground ? 7 : 4);
    for (const c of q.chunks()) for (let i = 0; i < c.length; i++) {
      c.set(VisualOffset, i, { position: [p.x + 24, 720 - (p.y + 48 + 24), 0] });
      c.set(Sprite, i, { image: `reference/green/${state}/${frame}`, flipX: p.dir > 0 });
    }
  },
});
