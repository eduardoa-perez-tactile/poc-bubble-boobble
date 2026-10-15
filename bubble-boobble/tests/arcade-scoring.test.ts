import { expect, worldTest, renderTest } from '@gameengine/test';
import { Text2D } from '@gameengine/runtime';
import campaign from '../data/levels.json';
import { createGame, addScore, copyGame } from '../src/arcade/game';
import { bubble, popBubble, updateBubbles } from '../src/arcade/bubbles';
import { item, updateItems, foodScore } from '../src/arcade/items';
import { referencePlayerBalance } from '../src/arcade/balance';
import { EnemyState, State, type Level } from '../src/arcade/types';
import { PrepareScoring } from '../src/arcade/scoring.cheats';
import { session } from '../src/arcade/session';
import { ArcadeInput } from '../src/schema.gen';
import { hudModel } from '../src/desktop/hud.view';
import { initialDesktopSave } from '../src/desktop/save';
const scene = 'scenes/arcade.scene.json';
const idle = { Move: 0, Jump: false, Fire: false };
function game() { const g = createGame(campaign as Level[], 42, 2); g.State = State.Playing; g.Freeze = 10000; return g; }
worldTest('arcade scoring empty bubbles award ten points once for either player', () => {
  for (const player of [0, 1]) {
    const g = game(); g.Bubbles = [{ ...bubble(200, 300), ID: 100, Age: 30 }];
    popBubble(g, 0, player); expect(g.Score).toBe(10);
    expect(g.Particles.filter(p => p.Text === '10').length).toBe(1);
    popBubble(g, 0, player); expect(g.Score).toBe(10);
  }
}, { scene });
worldTest('arcade scoring mixed chains retain enemy combo multipliers and score each empty bubble', () => {
  const g = game(); g.Enemies = [g.Enemies[0]!, { ...g.Enemies[0]!, ID: 200 }];
  for (const e of g.Enemies) e.State = EnemyState.Trapped;
  g.Bubbles = [
    { ...bubble(200, 300), ID: 101, Age: 30, EnemyID: g.Enemies[0]!.ID },
    { ...bubble(230, 300), ID: 102, Age: 30 },
    { ...bubble(260, 300), ID: 103, Age: 30, EnemyID: 200 },
    { ...bubble(290, 300), ID: 104, Age: 30 },
  ];
  popBubble(g, 0, 0); expect(g.Score).toBe(320); expect(g.Counters.Popped).toBe(4);
  expect(g.Particles.filter(p => p.Text).map(p => p.Text)).toEqual(['100', '10', '200', '10']);
  popBubble(g, 3, 1); expect(g.Score).toBe(320);
}, { scene });
worldTest('arcade scoring expired bubbles and bubble bounces do not award points', () => {
  const g = game(), p = g.Players[0]!;
  g.Bubbles = [{ ...bubble(400, 200), Age: 600, Floating: true }]; updateBubbles(g, [idle, idle]);
  expect(g.Score).toBe(0); expect(g.Bubbles.length).toBe(0);
  Object.assign(p, { X: 240, Y: 300, VY: 6 });
  g.Bubbles = [{ ...bubble(240, 340), Age: 30, Floating: true }];
  updateBubbles(g, [{ ...idle, Jump: true }, idle]);
  expect(g.Score).toBe(0); expect(g.Bubbles.length).toBe(1);
}, { scene });
worldTest('arcade scoring every fruit value produces the enemy-pop points effect at pickup', () => {
  for (let fruit = 1; fruit <= 25; fruit++) for (const player of [0, 1]) {
    const g = game(), p = g.Players[player]!;
    g.Items = [{ ...item(p.X, p.Y), Stationary: true, Food: fruit }];
    updateItems(g);
    expect(g.Score).toBe(foodScore(fruit)); expect(g.Items.length).toBe(0);
    const texts = g.Particles.filter(v => v.Text);
    expect(texts.length).toBe(1); expect(texts[0]!.Text).toBe(String(foodScore(fruit)));
    expect(texts[0]!.X).toBe(p.X); expect(texts[0]!.Y).toBe(p.Y); expect(texts[0]!.Life).toBe(45);
    updateItems(g); expect(g.Score).toBe(foodScore(fruit));
  }
}, { scene });
worldTest('arcade scoring small pops trigger extra lives and snapshots stay independent', () => {
  const g = game(); g.Score = g.ExtraLifeAt - 10;
  g.Bubbles = [{ ...bubble(200, 300), ID: 100, Age: 30 }];
  const before = JSON.stringify(g), copy = copyGame(g); popBubble(copy, 0, 0);
  expect(copy.Score).toBe(30000); expect(copy.Players[0]!.Lives).toBe(4); expect(copy.Players[1]!.Lives).toBe(4);
  expect(copy.Particles.some(p => p.Text === '1UP')).toBe(true); expect(JSON.stringify(g)).toBe(before);
  // Frequent small ring awards retain their previous non-popup behavior.
  const ring = game(); addScore(ring, 10, 0, 0); expect(ring.Particles.length).toBe(0);
}, { scene });
worldTest('arcade scoring explicit Go profile retains historical scores and low fruit feedback', () => {
  const g = game(); g.PlayerBalance = { ...referencePlayerBalance };
  g.Bubbles = [{ ...bubble(200, 300), Age: 30 }]; popBubble(g, 0, 0); expect(g.Score).toBe(0);
  const p = g.Players[0]!; g.Items = [{ ...item(p.X, p.Y), Food: 1, Stationary: true }]; updateItems(g);
  expect(g.Score).toBe(10); expect(g.Particles.filter(v => v.Text).length).toBe(0);
}, { scene });
worldTest('arcade scoring real engine pops and fruit pickups update HUD and animate points', async ({ step, cheat, input }) => {
  await step(1);
  for (const player of [0, 1]) for (const mode of ['bubble', 'fruit', 'mixed', 'enemy']) {
    await cheat(PrepareScoring, { mode, player, fruit: 1 });
    input.emit(ArcadeInput, { player, move: 0, jump: false, fire: false, paused: false }); await step(1);
    const g = session.get().game!, points = mode === 'enemy' ? 100 : mode === 'mixed' ? 20 : 10;
    expect(g.Score).toBe(points); expect(hudModel(g, initialDesktopSave).score).toBe(String(points).padStart(7, '0'));
    const text = g.Particles.find(p => p.Text === String(mode === 'enemy' ? 100 : 10))!;
    expect(!!text).toBe(true); expect(text.Life).toBe(44);
    const oldY = text.Y, oldLife = text.Life; await step(5);
    const later = session.get().game!.Particles.find(p => p.Text === text.Text)!;
    expect(later.Y).toBeLessThan(oldY); expect(later.Life).toBe(oldLife - 5);
    expect(session.get().game!.Score).toBe(points);
  }
}, { scene });
renderTest('arcade scoring fruit and enemy point labels share the rendered text effect', async ({ step, cheat, render, world }) => {
  await step(1);
  for (const mode of ['fruit', 'enemy']) {
    await cheat(PrepareScoring, { mode, player: 0, fruit: 1 }); await step(2);
    render.stats({ width: 768, height: 720 });
    const text = mode === 'fruit' ? '10' : '100';
    const points = world.entities(Text2D).map(e => world.get(e, Text2D)).find(t => t.visible && t.text === text);
    expect(!!points).toBe(true); expect(points!.font).toBe('reference/arcade'); expect(points!.size).toBe(12);
  }
}, { scene });
