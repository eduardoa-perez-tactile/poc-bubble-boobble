import { worldTest, expect } from '@gameengine/test';
import { LocalTransform } from '@gameengine/runtime';
import { Bubble, Game } from '../src/schema.gen.ts';

worldTest('tapping a bubble pops it', async ({ world, step, input, tap }) => {
  input.view(1080, 1920, 3);
  await step(40);
  const [bubble] = world.entities(Bubble);
  expect(bubble === undefined).toBe(false);
  const [x, y] = world.get(bubble!, LocalTransform).position;
  await tap([x!, y!]);
  await step(2);
  expect(world.resource(Game).score).toBe(1);
}, { scene: "scenes/main.scene.json" });

worldTest('bubbles that reach the top go away', async ({ world, step }) => {
  await step(900);
  expect(world.resource(Game).spawned).toBe(30);
  expect(world.entities(Bubble).length).toBeLessThan(15);
}, { scene: "scenes/main.scene.json" });
