import { worldTest, expect } from '@gameengine/test';
import { MorePlayerInputs, PlayerInputs } from '@gameengine/runtime';
import campaign from '../data/levels.json';
import { copyGame, stepGame } from '../src/arcade/game';
import { preparePartyWave } from '../src/arcade/party';
import { hurtPlayer } from '../src/arcade/player';
import { createRNG } from '../src/arcade/rng';
import { State } from '../src/arcade/types';
import { createOnlineWaveGame, onlineButtons, onlineGameSeed, onlinePartySlots, readOnlineInputs } from '../src/online/rules';

const match = (players: number, seed = '18446744073709551615') => ({ players, seed, mode: 'realtime' as const });
const idle = () => Array.from({ length: 10 }, () => ({ Move: 0, Jump: false, Fire: false }));

worldTest('online human rosters always fill ten unique dragon slots', () => {
  for (const humans of [1, 2, 5, 10]) {
    const game = createOnlineWaveGame(campaign, match(humans));
    expect(game.Players.length).toBe(10);
    expect(game.Party!.Slots).toEqual(onlinePartySlots(humans));
    expect(game.Party!.Slots.filter(slot => slot === 'human').length).toBe(humans);
    expect(game.Party!.Slots.filter(slot => slot === 'ai').length).toBe(10 - humans);
    expect(game.Companions!.map(ai => !!ai)).toEqual(Array.from({ length: 10 }, (_, index) => index >= humans));
    expect(game.Players.every(player => player.Lives === 1)).toBe(true);
    expect(new Set(game.Players.map(player => player.Skin)).size).toBe(10);
  }
});

worldTest('online decimal u64 seeds retain low bits above JavaScript integer precision', () => {
  for (const seed of ['0', '1', '9007199254740992', '9007199254740993', '18446744073709551615']) {
    expect(onlineGameSeed(seed).toString()).toBe(seed);
    const a = createOnlineWaveGame(campaign, match(10, seed));
    const b = createOnlineWaveGame(campaign, match(10, seed));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    // Initialization consumes the seeded RNG for the original arena too.
    expect(a.RNG === createRNG(onlineGameSeed(seed)).RNG).toBe(false);
  }
  const a = createOnlineWaveGame(campaign, match(10, '9007199254740992'));
  const b = createOnlineWaveGame(campaign, match(10, '9007199254740993'));
  expect(a.RNG === b.RNG).toBe(false);
  for (const seed of ['-1', '01', '1.5', '1e3', '', '18446744073709551616']) {
    let rejected = false;
    try { onlineGameSeed(seed); } catch { rejected = true; }
    expect(rejected).toBe(true);
  }
});

worldTest('online packed seats four five and ten drive only their own humans', ({ world }) => {
  world.setResource(PlayerInputs, { players: 10, stick3: [-1, 0], buttons3: onlineButtons.bit('jump') });
  const buttons = Array(252).fill(0), stickX = Array(252).fill(0), stickY = Array(252).fill(0);
  buttons[0] = onlineButtons.bit('fire'); stickX[0] = 0.5;
  buttons[5] = onlineButtons.pack({ jump: true, fire: true }); stickX[5] = 1;
  world.setResource(MorePlayerInputs, { buttons, stickX, stickY });
  const inputs = readOnlineInputs(world.resource(PlayerInputs), world.resource(MorePlayerInputs), 10);
  expect(inputs[3]).toEqual({ Move: -1, Jump: true, Fire: false });
  expect(inputs[4]).toEqual({ Move: 0.5, Jump: false, Fire: true });
  expect(inputs[9]).toEqual({ Move: 1, Jump: true, Fire: true });
  expect(inputs[0]).toEqual({ Move: 0, Jump: false, Fire: false });
  const ai = readOnlineInputs(world.resource(PlayerInputs), world.resource(MorePlayerInputs), 2);
  expect(ai.slice(2)).toEqual(idle().slice(2));
  const game = createOnlineWaveGame(campaign, match(10));
  game.Party!.Timer = 1; stepGame(game, idle());
  const before = game.Players.map(player => player.X);
  stepGame(game, inputs);
  expect(game.Players[9]!.X).toBeGreaterThan(before[9]!);
  expect(game.Players[3]!.X).toBeLessThan(before[3]!);
  expect(game.Players[0]!.X).toBe(before[0]!);
  expect(game.Bubbles.some(bubble => bubble.Shooter === 9)).toBe(true);
  expect(game.Bubbles.some(bubble => bubble.Shooter === 4)).toBe(true);
});

worldTest('online mixed AI snapshot branches preserve original state and resimulate identically', () => {
  const original = createOnlineWaveGame(campaign, match(2));
  original.Party!.Timer = 1;
  const originalText = JSON.stringify(original);
  const a = copyGame(original), b = copyGame(original);
  for (let frame = 0; frame < 180; frame++) {
    const inputs = idle();
    inputs[0] = { Move: frame % 90 < 45 ? 1 : -1, Jump: frame % 25 === 0, Fire: true };
    inputs[1] = { Move: frame % 90 < 45 ? -1 : 1, Jump: frame % 30 === 0, Fire: true };
    stepGame(a, inputs); stepGame(b, inputs);
  }
  expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  expect(JSON.stringify(original)).toBe(originalText);
  expect(a.Tick).toBeGreaterThan(0);
  expect(a.Party!.Phase).toBe('combat');
  expect(a.Counters.Blown).toBeGreaterThan(0);
});

worldTest('online tenth human can rescue and clean rematches reset boss and results', () => {
  const game = createOnlineWaveGame(campaign, match(10));
  game.Party!.Timer = 1; stepGame(game, idle());
  game.Players[0]!.Invincible = 0; hurtPlayer(game, 0);
  game.Players[9]!.X = game.Players[0]!.X; game.Players[9]!.Y = game.Players[0]!.Y;
  stepGame(game, idle());
  expect(game.Players[0]!.Downed).toBe(false);
  game.Party!.Wave = game.Party!.BossWave; preparePartyWave(game);
  expect(!!game.Party!.Boss).toBe(true);
  for (const player of game.Players) { player.Lives = 0; player.Downed = true; }
  stepGame(game, idle());
  expect(game.State).toBe(State.GameOver);
  const next = createOnlineWaveGame(campaign, match(5, '42'));
  expect(next.Party!.Wave).toBe(1);
  expect(next.State).toBe(State.Playing);
  expect(next.Score).toBe(0);
  expect(!!next.Party!.Boss).toBe(false);
  expect(next.Players.every(player => player.Lives === 1 && !player.Downed)).toBe(true);
});
