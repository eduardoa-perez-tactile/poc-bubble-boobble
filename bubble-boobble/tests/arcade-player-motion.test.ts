import { expect, worldTest } from '@gameengine/test';
import { createGame, copyGame, canonicalState, stepGame } from '../src/arcade/game';
import { moveActor } from '../src/arcade/physics';
import { updatePlayer } from '../src/arcade/player';
import { bubble, updateBubbles } from '../src/arcade/bubbles';
import { referencePlayerBalance } from '../src/arcade/balance';
import { ActorSize, Height, Rows, State, Tile, body, type Level } from '../src/arcade/types';
import { PreparePlayerMotion } from '../src/arcade/motion.cheats';
import { ArcadeInput } from '../src/schema.gen';
import { session } from '../src/arcade/session';
import campaign from '../data/levels.json';
const idle = { Move: 0, Jump: false, Fire: false };
const scene = 'scenes/arcade.scene.json';
function arena() {
  const level: Level = { number: 1, player: { col: 4, row: 25 }, power_spawn: { col: 4, row: 25 }, food_spawn: { col: 16, row: 25 }, enemies: [{ kind: 'zenchan', col: 26, row: 25 }], special: '', special_count: 0,
    tiles: Array.from({ length: Rows }, (_, r) => Array.from({ length: 32 }, (_, c) => c < 2 || c >= 30 || r === 0 || r === 25 ? 1 : 0)) };
  const g = createGame([level], 42, 2); g.State = State.Playing; g.Freeze = 10000; return g;
}
worldTest('arcade player motion ledge falls stay steady for both players and shoes', () => {
  for (const shoes of [false, true]) {
    const g = arena();
    for (const p of g.Players) { Object.assign(p, { Y: 80, VY: 0, Ground: false }); p.Power.Shoes = shoes; }
    for (let t = 1; t <= 60; t++) {
      for (let index = 0; index < 2; index++) {
        updatePlayer(g, index, idle);
        const p = g.Players[index]!;
        expect(p.VY === 3 || p.VY === 6).toBe(true);
        if (t % 10 === 0) expect(p.Y).toBe(80 + t / 10 * (shoes ? 57 : 36));
      }
    }
  }
});
worldTest('arcade player motion jump has the sourced rise apex and landing timing', () => {
  const g = arena(), p = g.Players[0]!, y = p.Y;
  p.Ground = true;
  const milestones: Record<number, number> = { 5: 36, 10: 72, 15: 102, 20: 120, 25: 126, 30: 123, 35: 105, 40: 78, 45: 42, 50: 6 };
  for (let t = 1; t <= 53; t++) {
    updatePlayer(g, 0, { ...idle, Jump: true });
    if (milestones[t] !== undefined) expect(y - p.Y).toBe(milestones[t]);
    if (t < 51) expect(p.Ground).toBe(false);
  }
  expect(p.Ground).toBe(true); expect(p.Y).toBe(y); expect(p.JumpStep).toBe(undefined);
  expect(g.Counters.Jumps).toBe(1);
});
worldTest('arcade player motion shoes alter cadence without changing jump height', () => {
  for (const shoes of [false, true]) {
    const g = arena(), p = g.Players[0]!, y = p.Y; p.Ground = true; p.Power.Shoes = shoes;
    let highest = y, landed = 0;
    for (let t = 1; t < 80; t++) {
      updatePlayer(g, 0, { ...idle, Jump: t === 1 }); highest = Math.min(highest, p.Y);
      if (p.Ground) { landed = t; break; }
    }
    expect(y - highest).toBe(126); expect(landed).toBe(shoes ? 32 : 51);
  }
});
worldTest('arcade player motion wraps a steady fall and resets the curve on landing', () => {
  const g = arena(), p = g.Players[0]!;
  for (const row of [0, 25]) for (let c = 9; c <= 12; c++) g.Level.tiles[row]![c] = 0;
  Object.assign(p, { X: 240, Y: Height - 1, VY: 12, Ground: false });
  updatePlayer(g, 0, idle); expect(p.Y).toBe(Tile); expect(p.VY).toBe(3);
  updatePlayer(g, 0, idle); expect(p.Y).toBe(Tile + 3); expect(p.VY).toBe(3);
  for (let c = 8; c <= 14; c++) g.Level.tiles[10]![c] = 1;
  Object.assign(p, { Y: 10 * Tile - ActorSize - 1, VY: 0 });
  updatePlayer(g, 0, idle); expect(p.Ground).toBe(true); expect(p.VY).toBe(0);
  updatePlayer(g, 0, { ...idle, Jump: true }); expect(p.Y).toBeLessThan(10 * Tile - ActorSize);
});
worldTest('arcade player motion bubble bounce restarts the jump curve without popping', () => {
  const g = arena(), p = g.Players[0]!;
  Object.assign(p, { X: 240, Y: 300, VY: 6, Ground: false, JumpStep: 55 });
  g.Bubbles = [{ ...bubble(240, 340), ID: 100, Age: 30, Floating: true }];
  updateBubbles(g, [{ ...idle, Jump: true }, idle]);
  expect(p.JumpStep).toBe(0); expect(p.VY).toBe(-6); expect(g.Bubbles.length).toBe(1);
  const y = p.Y; updatePlayer(g, 0, { ...idle, Jump: true });
  expect(p.Y).toBe(y - 6); expect(p.JumpStep).toBe(1);
});
worldTest('arcade player motion copies preserve phase while Go projection remains compatible', () => {
  const g = arena(), p = g.Players[0]!; p.Ground = true;
  updatePlayer(g, 0, { ...idle, Jump: true });
  const before = JSON.stringify(g), a = copyGame(g), b = copyGame(g);
  for (let i = 0; i < 70; i++) { stepGame(a, [idle]); stepGame(b, [idle]); }
  expect(JSON.stringify(a)).toBe(JSON.stringify(b)); expect(JSON.stringify(g)).toBe(before);
  const projected = canonicalState(g).Snapshot.Players![0]!;
  expect(projected.JumpStep).toBe(undefined); expect(projected.MotionTick).toBe(undefined);
  expect(p.JumpStep).toBe(1);
  g.PlayerBalance = { ...referencePlayerBalance }; delete p.JumpStep; delete p.MotionTick;
  Object.assign(p, { Y: 80, VY: 0, Ground: false });
  updatePlayer(g, 0, idle); expect(p.VY).toBe(.5); updatePlayer(g, 0, idle); expect(p.VY).toBe(1);
  const enemy = { ...body(240, 80) }; moveActor(g, enemy, 0, true); expect(enemy.VY).toBe(.5);
});
worldTest('arcade player motion can land on a real campaign upper platform', () => {
  const g = createGame(campaign as Level[], 42), p = g.Players[0]!;
  Object.assign(p, { X: 96, Y: 25 * Tile - ActorSize, VY: 0, Ground: true });
  let landed = false;
  for (let i = 0; i < 70; i++) {
    updatePlayer(g, 0, { Move: 1, Jump: i === 0, Fire: false });
    if (p.Ground && p.Y === 20 * Tile - ActorSize) { landed = true; break; }
  }
  expect(landed).toBe(true);
});
for (const shoes of [false, true]) worldTest(`arcade player motion real engine fall inputs shoes ${shoes}`, async ({ step, input, cheat }) => {
  await step(1); await cheat(PreparePlayerMotion, { mode: 'fall', shoes });
  for (let t = 1; t <= 30; t++) {
    for (let player = 0; player < 2; player++) input.emit(ArcadeInput, { player, move: 0, jump: false, fire: false, paused: false });
    await step(1);
    if (t % 10 === 0) for (const p of session.get().game!.Players) expect(p.Y).toBe(80 + t / 10 * (shoes ? 57 : 36));
  }
}, { scene });
worldTest('arcade player motion real engine jump pause and co-op phases', async ({ step, input, cheat }) => {
  await step(1); await cheat(PreparePlayerMotion, { mode: 'jump', shoes: false });
  const y = session.get().game!.Players[0]!.Y;
  input.emit(ArcadeInput, { player: 0, move: 0, jump: true, fire: false, paused: false }); await step(1);
  expect(session.get().game!.Players[0]!.Y).toBe(y - 6);
  input.emit(ArcadeInput, { player: 0, move: 0, jump: true, fire: false, paused: true }); await step(1);
  const before = JSON.stringify(session.get().game); await step(8); expect(JSON.stringify(session.get().game)).toBe(before);
  input.emit(ArcadeInput, { player: 0, move: 0, jump: true, fire: false, paused: false }); await step(1);
  expect(session.get().game!.Players[0]!.Y).toBe(y - 12);
  expect(session.get().game!.Players[1]!.Y).toBe(y);
  for (let t = 3; t <= 51; t++) {
    input.emit(ArcadeInput, { player: 0, move: 0, jump: true, fire: false, paused: false }); await step(1);
    const p = session.get().game!.Players[0]!;
    if (t === 25) expect(y - p.Y).toBe(126);
    if (t < 51) expect(p.Ground).toBe(false);
  }
  expect(session.get().game!.Players[0]!.Ground).toBe(true);
  expect(session.get().game!.Counters.Jumps).toBe(1);
}, { scene });
