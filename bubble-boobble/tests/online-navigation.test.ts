import { worldTest, expect } from '@gameengine/test';
import campaign from '../data/levels.json';
import { copyGame, stepGame } from '../src/arcade/game';
import { preparePartyWave } from '../src/arcade/party';
import { hurtPlayer } from '../src/arcade/player';
import { createOnlineWaveGame } from '../src/online/rules';
import { compactOnlineNavigation, restoreOnlineNavigation } from '../src/online/navigation';

const create = (humans: number) => createOnlineWaveGame(campaign, { players: humans, seed: '18446744073709551615', mode: 'realtime' });
const idle = () => Array.from({ length: 10 }, () => ({ Move: 0, Jump: false, Fire: false }));

worldTest('online navigation compacts shared graphs and restores slot-one alias without changing snapshot', () => {
  const original = create(1);
  stepGame(original, idle());
  const before = JSON.stringify(original), compact = copyGame(original);
  compactOnlineNavigation(compact);
  expect(compact.OnlineNavigationGraphs!.length).toBe(1);
  expect(compact.OnlineNavigationGraphIndices).toEqual([-1, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  expect(compact.Companions!.every(ai => !ai?.Graph)).toBe(true);
  expect(compact.Companion!.Graph).toBe(null);
  expect(JSON.stringify(compact).length).toBeLessThan(before.length / 2);
  const encoded = JSON.stringify(compact), restored = copyGame(compact);
  restoreOnlineNavigation(restored);
  expect(JSON.stringify(restored)).toBe(before);
  expect(restored.Companion).toBe(restored.Companions![1]);
  expect(restored.Companions![1]!.Graph).toBe(restored.Companions![9]!.Graph);
  stepGame(restored, idle());
  expect(JSON.stringify(original)).toBe(before);
  expect(JSON.stringify(compact)).toBe(encoded);
});

worldTest('online compact navigation matches ordinary controller state through shoes downing and boss', () => {
  let ordinary = create(2), compact = copyGame(ordinary);
  for (let frame = 0; frame < 210; frame++) {
    ordinary = copyGame(ordinary);
    compact = copyGame(compact);
    restoreOnlineNavigation(compact);
    for (const game of [ordinary, compact]) {
      for (const player of game.Players) player.Invincible = 600;
      if (frame === 3) { game.Players[9]!.Invincible = 0; hurtPlayer(game, 9); }
      if (frame === 35) { game.Players[9]!.Downed = false; game.Players[9]!.Lives = 1; }
      if (frame === 60) game.Players[6]!.Power.Shoes = true;
      if (frame === 100) game.Players[7]!.Power.Shoes = true;
      if (frame === 145) { game.Party!.Wave = game.Party!.BossWave; preparePartyWave(game); game.Party!.Timer = 1; }
      const inputs = idle();
      inputs[0] = { Move: frame % 60 < 30 ? 1 : -1, Jump: frame % 23 === 0, Fire: true };
      stepGame(game, inputs);
    }
    expect(JSON.stringify(compact)).toBe(JSON.stringify(ordinary));
    compactOnlineNavigation(compact);
    expect(compact.Companions!.every(ai => !ai?.Graph)).toBe(true);
    expect(compact.OnlineNavigationGraphs!.length).toBeLessThanOrEqual(4);
    // A JSON snapshot removes incidental JS aliases; restoration must recreate the graph refs.
    if (frame % 19 === 0) compact = JSON.parse(JSON.stringify(compact));
  }
});
