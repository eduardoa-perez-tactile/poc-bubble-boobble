import { expect, worldTest, renderTest } from '@gameengine/test';
import { LocalTransform } from '@gameengine/runtime';
import { Bubble, Game, HarnessControl } from '../src/schema.gen.ts';
import { ResetHarness } from '../src/harness.cheats.ts';

worldTest('harness reset and tap', async ({ world, step, input, tap, cheat }) => {
  input.view(768, 720, 8);
  await step(45);
  await cheat(ResetHarness, { scenario: 'starter-tap' });
  expect(world.resource(HarnessControl).active).toBe(1);
  expect(world.entities(Bubble).length).toBe(1);
  const bubble = world.entities(Bubble)[0]!;
  expect(world.get(bubble, LocalTransform).position[0]).toBe(0);
  expect(world.get(bubble, LocalTransform).position[1]).toBe(0);
  await step(90);
  expect(world.entities(Bubble).length).toBe(1);
  await tap([0, 0]);
  await step(2);
  expect(world.resource(Game).score).toBe(1);
  expect(world.entities(Bubble).length).toBe(0);
  await cheat(ResetHarness, { scenario: 'starter-tap' });
  expect(world.resource(Game).score).toBe(0);
  expect(world.resource(Game).spawned).toBe(1);
  expect(world.entities(Bubble).length).toBe(1);
  expect(world.get(world.entities(Bubble)[0]!, LocalTransform).position[1]).toBe(0);
  await tap([0, 0]);
  await step(2);
  expect(world.resource(Game).score).toBe(1);
}, { scene: "scenes/main.scene.json" });

renderTest('harness starter golden', async ({ input, cheat, render }) => {
  input.view(768, 720, 8);
  await cheat(ResetHarness, { scenario: 'starter-tap' });
  render.expectScreenshot('starter-tap', { width: 768, height: 720 });
}, { scene: "scenes/main.scene.json" });
