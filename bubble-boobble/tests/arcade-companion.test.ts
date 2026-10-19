import { expect, worldTest, renderTest } from '@gameengine/test';
import campaign from '../data/levels.json';
import { createGame, copyGame, stepGame } from '../src/arcade/game';
import { companionInput, enableCompanion, buildCompanionGraph } from '../src/arcade/companion';
import { updatePlayer } from '../src/arcade/player';
import { bubble } from '../src/arcade/bubbles';
import { ActorSize, EnemyState, Rows, State, Tile, type Level } from '../src/arcade/types';
import { DesktopIntent } from '../src/schema.gen';
import { desktopGameRequest, desktopState } from '../src/desktop/state';
import { session } from '../src/arcade/session';
const idle = { Move: 0, Jump: false, Fire: false };
const scene = 'scenes/arcade.scene.json';
function arena() {
  const level: Level = { number: 1, player: { col: 4, row: 25 }, power_spawn: { col: 4, row: 25 }, food_spawn: { col: 16, row: 25 }, enemies: [{ kind: 'zenchan', col: 20, row: 25 }], special: '', special_count: 0,
    tiles: Array.from({ length: Rows }, (_, r) => Array.from({ length: 32 }, (_, c) => c < 2 || c >= 30 || r === 0 || r === 25 ? 1 : 0)) };
  const g = createGame([level], 42, 2); g.State = State.Playing;
  Object.assign(g.Players[1]!, { X: 300, Y: 25 * Tile - ActorSize, Ground: true, Invincible: 0, Dir: 1 });
  enableCompanion(g); return g;
}
worldTest('companion approaches shooting range and fires through normal player rules', () => {
  const g = arena(); g.Players[0]!.X = 60;
  Object.assign(g.Enemies[0]!, { X: 460, Y: g.Players[1]!.Y, State: EnemyState.Active });
  const x = g.Players[1]!.X;
  for (let i = 0; i < 180 && g.State === State.Playing; i++) stepGame(g, [idle, idle]);
  expect(g.Counters.Blown).toBeGreaterThan(0);
  expect(g.Players[1]!.X > x || g.Counters.Popped > 0).toBe(true);
  expect(g.Players[1]!.Lives).toBeGreaterThan(0);
});
worldTest('companion approaches trapped bubbles without bounce and pops them', () => {
  const g = arena(), p = g.Players[1]!;
  g.Enemies[0]!.State = EnemyState.Trapped;
  g.Bubbles = [{ ...bubble(p.X + 65, p.Y), ID: 50, Age: 40, EnemyID: g.Enemies[0]!.ID, CapturedAge: 100, Floating: true }];
  for (let i = 0; i < 160 && g.Counters.Popped === 0; i++) {
    stepGame(g, [idle]); if (!p.Ground && p.VY >= 0) expect(p.LastJump).toBe(false);
  }
  expect(g.Counters.Popped).toBeGreaterThan(0);
});
worldTest('companion evades close enemies and predicted projectiles', () => {
  const g = arena(), p = g.Players[1]!;
  Object.assign(g.Enemies[0]!, { X: p.X + 40, Y: p.Y, State: EnemyState.Active });
  const enemyInput = companionInput(g); expect(enemyInput.Move).toBe(-1); expect(enemyInput.Jump).toBe(true);
  g.Enemies = []; g.Projectiles = [{ X: p.X - 90, Y: p.Y + 12, VX: 8, VY: 0, Ground: false, Laser: false, Age: 10, Removed: false }];
  const shotInput = companionInput(g); expect(shotInput.Move).toBe(1); expect(shotInput.Jump).toBe(true);
});
worldTest('companion follows physics-validated jumps to an upper platform', () => {
  const g = arena(), p = g.Players[1]!; g.Enemies = [];
  for (let c = 8; c <= 18; c++) g.Level.tiles[21]![c] = 1;
  g.Items = [{ X: 300, Y: 21 * Tile - ActorSize, VX: 0, VY: 0, Ground: true, Stationary: true, Power: '', Food: 100, Age: 0 }];
  let landed = false;
  for (let i = 0; i < 200; i++) {
    g.Tick++; updatePlayer(g, 1, companionInput(g));
    if (p.Ground && Math.abs(p.Y - (21 * Tile - ActorSize)) < 1) { landed = true; break; }
  }
  expect(landed).toBe(true);
});
worldTest('companion jumps to pop a floating target above the highest platform', () => {
  const g = arena(), p = g.Players[1]!;
  g.Enemies[0]!.State = EnemyState.Trapped;
  for (let c = 8; c <= 18; c++) g.Level.tiles[10]![c] = 1;
  p.Y = 10 * Tile - ActorSize;
  g.Bubbles = [{ ...bubble(p.X, 48), ID: 50, Age: 40, EnemyID: g.Enemies[0]!.ID, CapturedAge: 100, Floating: true }];
  let jumped = false;
  for (let i = 0; i < 120 && g.Counters.Popped === 0; i++) {
    stepGame(g, [idle]); if (g.Counters.Jumps > 0) jumped = true;
  }
  expect(jumped).toBe(true);
  expect(g.Counters.Popped).toBeGreaterThan(0);
});
worldTest('companion clears campaign round one without human assistance', () => {
  const g = createGame(campaign as Level[], 42, 2); enableCompanion(g);
  // Exclude the human from enemy targeting and survival; the AI uses ordinary lives and damage.
  g.Players[0]!.Lives = 0;
  for (let i = 0; i < 2400 && g.LevelIndex === 0 && g.State !== State.GameOver; i++) stepGame(g, [idle]);
  expect(g.LevelIndex).toBe(1); expect(g.Players[1]!.Lives).toBeGreaterThan(0);
});
worldTest('companion graph includes bottom wrap routes through floor openings', () => {
  const g = arena();
  for (const r of [0, 25]) for (let c = 9; c <= 13; c++) g.Level.tiles[r]![c] = 0;
  for (let c = 8; c <= 18; c++) g.Level.tiles[5]![c] = 1;
  const graph = buildCompanionGraph(g, g.PlayerBalance.MoveSpeed);
  const wraps = graph.Nodes.some(n => n.Y > 500 && n.Links.some(l => graph.Nodes[l.To]!.Y < 150));
  expect(wraps).toBe(true);
});
worldTest('companion decisions survive copies and never mutate earlier snapshots', () => {
  const g = arena(); stepGame(g, [idle]);
  const before = JSON.stringify(g), a = copyGame(g), b = copyGame(g);
  for (let i = 0; i < 240; i++) { stepGame(a, [idle]); stepGame(b, [idle]); }
  expect(JSON.stringify(a)).toBe(JSON.stringify(b)); expect(JSON.stringify(g)).toBe(before);
  a.Paused = true; const frozen = JSON.stringify(a); stepGame(a, [idle]); expect(JSON.stringify(a)).toBe(frozen);
  a.Paused = false; a.Players[1]!.Dead = 20;
  expect(companionInput(a)).toEqual(idle);
  a.Players[1]!.Dead = 0; a.Players[1]!.Lives = 0; expect(companionInput(a)).toEqual(idle);
});
worldTest('companion collects nearby rewards during the clear countdown', () => {
  const g = arena(), p = g.Players[1]!; g.Enemies = []; g.State = State.Clearing; g.Countdown = 420;
  g.Items = [{ ...p, X: p.X + 60, Y: p.Y + 12, Stationary: true, Power: '', Food: 1, Age: 0 }];
  for (let i = 0; i < 120 && g.Items.length; i++) stepGame(g, [idle]);
  expect(g.Items.length).toBe(0); expect(g.Score).toBeGreaterThan(0);
});
worldTest('companion prefers a separate target when the human is closer', () => {
  const g = arena(), p = g.Players[1]!;
  p.X = 360; g.Players[0]!.X = 210;
  const enemy = g.Enemies[0]!;
  g.Enemies = [{ ...enemy, ID: 1, X: 230, Y: p.Y }, { ...enemy, ID: 2, X: 490, Y: p.Y }];
  companionInput(g); expect(g.Companion!.Goal!.ID).toBe(2);
});
worldTest('companion rebuilds routes for a new level and shoes', () => {
  const g = createGame(campaign as Level[], 42, 2); g.State = State.Playing; enableCompanion(g);
  companionInput(g); const graph = g.Companion!.Graph!;
  g.Players[1]!.Power.Shoes = true; companionInput(g);
  expect(g.Companion!.Graph!.Speed).toBe(g.PlayerBalance.ShoesSpeed);
  g.LevelIndex = 1; g.Level = g.Campaign[1]!; companionInput(g);
  expect(g.Companion!.Graph!.LevelIndex).toBe(1);
  expect(graph.LevelIndex).toBe(0);
});
worldTest('companion modes start restart pause and preserve human co-op controls', async ({ input, step }) => {
  await step(3);
  input.emit(DesktopIntent, { action: 'play-mode' }); input.emit(DesktopIntent, { action: 'start' }); await step(1);
  expect(desktopGameRequest.get().mode).toBe('ai'); expect(session.get().game!.Players.length).toBe(2); expect(!!session.get().game!.Companion).toBe(true);
  await step(700); expect(session.get().game!.Counters.Blown).toBeGreaterThan(0);
  input.emit(DesktopIntent, { action: 'pause' }); await step(1); const tick = session.get().game!.Tick;
  await step(10); expect(session.get().game!.Tick).toBe(tick);
  input.emit(DesktopIntent, { action: 'restart' }); await step(1); expect(!!session.get().game!.Companion).toBe(true);
  input.emit(DesktopIntent, { action: 'leave' }); input.emit(DesktopIntent, { action: 'play-mode' }); input.emit(DesktopIntent, { action: 'start' }); await step(1);
  expect(desktopState.get().playMode).toBe('human'); expect(session.get().game!.Players.length).toBe(2); expect(!!session.get().game!.Companion).toBe(false);
  await step(181); const x = session.get().game!.Players[1]!.X;
  input.action('move2', -1); await step(5); expect(session.get().game!.Players[1]!.X).toBeLessThan(x);
  input.emit(DesktopIntent, { action: 'leave' }); input.emit(DesktopIntent, { action: 'play-mode' }); input.emit(DesktopIntent, { action: 'start' }); await step(1);
  expect(session.get().game!.Players.length).toBe(1); expect(!!session.get().game!.Companion).toBe(false);
}, { scene });
renderTest('companion mode selector fits settings and changes through the real button', async ({ input, step, render, ui }) => {
  input.view(768, 720, 1); await step(3); input.emit(DesktopIntent, { action: 'settings' }); await step(1);
  render.stats({ width: 768, height: 720 });
  const mode = ui.interactables().find(b => b.label === 'MODE: SOLO')!;
  expect(mode.rect.y).toBe(354); expect(mode.rect.height).toBe(38);
  await ui.press(mode.id!); await step(1); render.stats({ width: 768, height: 720 });
  expect(desktopState.get().playMode).toBe('ai'); expect(ui.interactables().some(b => b.label === 'MODE: AI CO-OP')).toBe(true);
  const back = ui.interactables().find(b => b.label === 'BACK')!; expect(back.rect.y).toBe(454);
  for (const [width, height] of [[1680, 720], [640, 960]] as const) {
    input.view(width, height, 1); await step(1); render.stats({ width, height });
    for (const label of ['MODE: AI CO-OP', 'BACK']) {
      const b = ui.interactables().find(b => b.label === label)!;
      expect(b.rect.x >= 0 && b.rect.y >= 0 && b.rect.x + b.rect.width <= width && b.rect.y + b.rect.height <= height).toBe(true);
    }
  }
}, { scene });
