import { expect, worldTest, renderTest } from '@gameengine/test';
import { WorldView } from '@gameengine/runtime';
import { MovementInput, PortMatch, PortPlayer } from '../src/schema.gen.ts';
import walkSetup from './scenarios/movement-walk-jump.json';
import wrapSetup from './scenarios/movement-wrap.json';
import lastSetup from './scenarios/movement-coyote-last.json';
import expiredSetup from './scenarios/movement-coyote-expired.json';
import landingSetup from './scenarios/movement-buffer-landing.json';
import bufferExpiredSetup from './scenarios/movement-buffer-expired.json';
import ceilingSetup from './scenarios/movement-ceiling.json';
import spawnSetup from './scenarios/movement-obstructed-spawn.json';
import { ResetMovement } from '../src/movement.cheats.ts';
import walk from './fixtures/movement-walk-jump.expected.json';
import wrap from './fixtures/movement-wrap.expected.json';
import last from './fixtures/movement-coyote-last.expected.json';
import expired from './fixtures/movement-coyote-expired.expected.json';
import landing from './fixtures/movement-buffer-landing.expected.json';
import bufferExpired from './fixtures/movement-buffer-expired.expected.json';
import ceiling from './fixtures/movement-ceiling.expected.json';
import spawn from './fixtures/movement-obstructed-spawn.expected.json';
const scene = 'scenes/round1.scene.json';
for (const [fixture, setup] of [[walk,walkSetup], [wrap,wrapSetup], [last,lastSetup], [expired,expiredSetup], [landing,landingSetup], [bufferExpired,bufferExpiredSetup], [ceiling,ceilingSetup], [spawn,spawnSetup]] as const) {
  worldTest(`movement oracle ${fixture.scenario}`, async ({ world, step, input, cheat }) => {
    await step(1);
    const initial = 'player' in setup ? setup.player : undefined;
    await cheat(ResetMovement, { x: initial?.X ?? -1, y: initial?.Y ?? -1, vy: initial?.VY ?? 0, coyote: initial && 'Coyote' in initial ? Number(initial.Coyote) : 0,
      spawnCol: 'spawn' in setup ? setup.spawn.col : -1, spawnRow: 'spawn' in setup ? setup.spawn.row : -1 });
    for (const f of fixture.frames) {
      if (f.input) {
        const i = f.input.players[0]!;
        input.emit(MovementInput, { move: i.Move, jump: i.Jump, paused: f.input.paused });
        await step(1);
      }
      const p = world.resource(PortPlayer), expected = f.state.Snapshot.Players[0]!;
      // This is deliberately a movement projection, not full-match parity.
      for (const [goKey, want] of Object.entries(expected)) {
        if (goKey === 'Power') continue; // Powers are not implemented in this slice.
        const key = goKey === 'VX' ? 'vx' : goKey === 'VY' ? 'vy' : goKey[0]!.toLowerCase() + goKey.slice(1);
        const value = (p as unknown as Record<string, unknown>)[key];
        if (value !== want) throw new Error(`${fixture.scenario} frame=${f.frame} tick=${f.state.Snapshot.Tick} player.${goKey}: expected ${want}, actual ${value}; input=${JSON.stringify(f.input)}`);
      }
      const m = world.resource(PortMatch);
      expect(m.paused).toBe(f.state.Snapshot.Paused);
      expect(m.tick).toBe(f.state.Snapshot.Tick);
      expect(m.walked).toBe(f.state.Counters.Walked);
      expect(m.jumps).toBe(f.state.Counters.Jumps);
      expect(m.jumpSound).toBe((f.state.Snapshot.Sounds ?? []).includes('jump'));
    }
  }, { scene });
}
worldTest('movement ready countdown and semantic input', async ({ step, cheat, input, world }) => {
  await step(1);
  await cheat(ResetMovement, { ready: true });
  const x = world.resource(PortPlayer).x;
  input.action('move', 1);
  await step(60);
  expect(world.resource(PortPlayer).x).toBe(x);
  input.action('move', 1);
  await step(1);
  expect(world.resource(PortPlayer).x).toBe(x + 3);
}, { scene });
for (const [width, height] of [[768,720],[1680,720],[640,960]]) {
  renderTest(`movement board ${width}x${height}`, async ({ input, step, render, world }) => {
    input.view(width!,height!,1);
    await step(2);
    expect(world.resource(WorldView).designAspect).toBeCloseTo(768/720, 5);
    const [left, top] = input.worldToScreen([0,720]);
    const [right, bottom] = input.worldToScreen([768,0]);
    expect(left).toBeGreaterThanOrEqual(-0.01);
    expect(top).toBeGreaterThanOrEqual(-0.01);
    expect(right).toBeLessThanOrEqual(width!+0.01);
    expect(bottom).toBeLessThanOrEqual(height!+0.01);
    render.expectDrawCalls('<=',4,{width:width!,height:height!});
    render.expectScreenshot('round1',{width:width!,height:height!});
  }, { scene });
}

worldTest('movement physical keyboard hold release and jump', async ({ step, cheat, input, world }) => {
  await step(1); await cheat(ResetMovement, {}); await step(2);
  const x = world.resource(PortPlayer).x;
  input.key(51, true); await step(3); // Engine physical ArrowRight code.
  expect(world.resource(PortPlayer).x).toBe(x + 9);
  input.key(51, false); input.key(52, true); await step(1); // ArrowUp.
  expect(world.resource(PortPlayer).vy).toBe(-11);
  expect(world.resource(PortPlayer).x).toBe(x + 9);
  input.key(52, false);
}, { scene });
