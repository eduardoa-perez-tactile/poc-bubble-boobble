import { worldTest, expect } from '@gameengine/test';
import campaign from '../data/levels.json';
import { createOnlineWaveGame } from '../src/online/rules';
import { stepGame } from '../src/arcade/game';
import { preparePartyWave } from '../src/arcade/party';
import { arcadeDrawPlan, onlineVisualBudget, sceneDraws } from '../src/arcade/presentation';
import { orderedCapacity } from '../src/arcade/pixel-renderer/ordered';
import { advanceFeel, emptyFeel } from '../src/arcade/juice';
import { PartyReset } from '../src/arcade/party.cheats';
import { session } from '../src/arcade/session';
import { ArcadeVisual, OnlineWorldSnapshot } from '../src/schema.gen';
import { applyWorldEvents, createWorldState } from '../src/online/world-rules';
import { projectWorld } from '../src/online/world-public';

worldTest('online solo reserves only its occupied dragon and actual pop effects', async ({ input, step, world }) => {
  const state = applyWorldEvents(createWorldState(), [{ kind: 'join', player: 7, name: 'PLAYER' }, { kind: 'input', player: 7, data: { action: 'create' } }], campaign);
  const solo = state.rooms[0]!.game;
  const initial = onlineVisualBudget(solo);
  const ten = createOnlineWaveGame(campaign, { players: 10, mode: 'realtime', seed: '1' });
  expect(initial.pixels).toBeLessThan(onlineVisualBudget(ten).pixels);
  input.emit(OnlineWorldSnapshot, { $data: JSON.stringify({ player: 7, document: projectWorld(state), playing: true, reset: true }) });
  await step(3);
  const meshes = world.entities(ArcadeVisual).filter(entity => world.get(entity, ArcadeVisual).slot >= 65536);
  expect(meshes.length).toBeGreaterThan(0);
  expect(meshes.length).toBeLessThanOrEqual(1600);
  solo.Particles = Array.from({ length: 30 }, () => ({ ...solo.Players[0]!, Text: '', Life: 14 }));
  expect(onlineVisualBudget(solo).pixels - initial.pixels).toBe(18 * 16);
}, { scene: 'scenes/arcade.scene.json' });

worldTest('online visual capacity covers ten dragons combat boss and bounded celebrations', () => {
  for (const humans of [2, 10]) {
    const game = createOnlineWaveGame(campaign, { players: humans, mode: 'realtime', seed: '42' });
    let feel = emptyFeel();
    for (let frame = 0; frame < 480; frame++) {
      if (frame === 300) { game.Party!.Wave = game.Party!.BossWave; preparePartyWave(game); game.Party!.Timer = 1; }
      stepGame(game, game.Players.map((_, slot) => ({ Move: (Math.floor(frame / 60) + slot) % 2 ? 1 : -1, Jump: frame % 25 === 0, Fire: true })));
      if (frame % 15 !== 0) continue;
      feel = advanceFeel(feel, game, frame);
      const draws = arcadeDrawPlan(game, 'green', feel);
      const budget = onlineVisualBudget(game);
      expect(budget.pixels).toBeGreaterThanOrEqual(orderedCapacity(draws.filter(draw => !!draw.image)));
      expect(budget.texts).toBeGreaterThanOrEqual(draws.filter(draw => !!draw.text).length + 1);
    }
  }
});

worldTest('online visual capacity also covers complete courtyard scene at window extremes', async ({ step, cheat }) => {
  await step(2);
  for (const wave of [1, 10]) {
    await cheat(PartyReset, { team: 10, humans: 10, wave, countdown: 1 });
    const game = session.get().game!;
    const feel = emptyFeel();
    feel.cues = Array.from({ length: 32 }, (_, slot) => ({ kind: 'victory', x: 384, y: 360, at: 0, slot: slot % 10 }));
    for (const [width, height] of [[768, 720], [1680, 720], [640, 960]]) {
      const plan = sceneDraws(game.Tick, feel, { width: width!, height: height!, safeArea: [0, 0, 0, 0] });
      const budget = onlineVisualBudget(game);
      expect(budget.pixels).toBeGreaterThanOrEqual(orderedCapacity(plan.images, plan.clip));
      expect(budget.texts).toBeGreaterThanOrEqual(plan.texts.length + 1);
    }
  }
}, { scene: 'scenes/arcade.scene.json' });
