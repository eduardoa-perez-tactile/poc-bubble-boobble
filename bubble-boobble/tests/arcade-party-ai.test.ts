import { createBoss } from '../src/arcade/boss';
import { expect, worldTest } from '@gameengine/test';
import { createGame, copyGame, stepGame } from '../src/arcade/game';
import campaign from '../data/levels.json';
import { createPartyGame, preparePartyWave } from '../src/arcade/party';
import { companionInput, enableCompanion } from '../src/arcade/companion';
import { updatePlayer } from '../src/arcade/player';
import { ActorSize, EnemyState, Rows, State, Tile, type GameState, type Level } from '../src/arcade/types';
const idle = { Move: 0, Jump: false, Fire: false };
function party(): GameState {
  const level: Level = { number: 1, player: { col: 4, row: 25 }, power_spawn: { col: 4, row: 25 }, food_spawn: { col: 16, row: 25 }, enemies: [{ kind: 'zenchan', col: 20, row: 25 }], special: '', special_count: 0,
    tiles: Array.from({ length: Rows }, (_, r) => Array.from({ length: 32 }, (_, c) => c < 2 || c >= 30 || r === 0 || r === 25 ? 1 : 0)) };
  const g = createGame([level], 42, 2), base = g.Players[0]!;
  g.Players = Array.from({ length: 6 }, (_, i) => ({ ...base, Power: { ...base.Power }, X: 80 + i * 80, Y: 25 * Tile - ActorSize, Invincible: 0, Ground: true }));
  g.State = State.Playing;
  return g;
}
worldTest('party AI six indexed bots keep independent memory and share equivalent navigation', () => {
  const g = party();
  for (let i = 0; i < 6; i++) enableCompanion(g, i);
  for (let i = 0; i < 6; i++) companionInput(g, i);
  expect(g.Companions!.length).toBe(6);
  for (let i = 0; i < 6; i++) {
    expect(!!g.Companions![i]!.Goal).toBe(true);
    expect(g.Companions![i]!.Graph === g.Companions![0]!.Graph).toBe(true);
    if (i) expect(g.Companions![i] === g.Companions![0]).toBe(false);
  }
  const graph = g.Companions![0]!.Graph;
  g.Players[4]!.Power.Shoes = true; companionInput(g, 4);
  expect(g.Companions![4]!.Graph!.Shoes).toBe(true);
  expect(g.Companions![0]!.Graph === graph).toBe(true);
  expect(g.Companions![4]!.Graph === graph).toBe(false);
});
worldTest('party AI follows nearest human and yields targets to all nearby teammates', () => {
  const g = party(); g.Enemies = []; enableCompanion(g, 4);
  companionInput(g, 4);
  expect(g.Companions![4]!.Goal!.Kind).toBe('follow');
  expect(g.Companions![4]!.Goal!.ID).toBe(3);
  const p = g.Players[4]!; p.X = 360;
  g.Players[0]!.X = 60; g.Players[3]!.X = 210;
  for (const i of [1, 2, 5]) g.Players[i]!.Lives = 0;
  const enemy = party().Enemies[0]!;
  g.Enemies = [{ ...enemy, ID: 1, X: 230, Y: p.Y, State: EnemyState.Active }, { ...enemy, ID: 2, X: 490, Y: p.Y, State: EnemyState.Active }];
  g.Companions![4]!.NextThink = 0; companionInput(g, 4);
  expect(g.Companions![4]!.Goal!.ID).toBe(2);
});
worldTest('party AI prioritizes rescuing a downed teammate and downed bots remain idle', () => {
  const g = party(); enableCompanion(g, 2); enableCompanion(g, 5);
  Object.assign(g.Players[5]!, { Downed: true, X: g.Players[2]!.X + 70 });
  const action = companionInput(g, 2);
  expect(g.Companions![2]!.Goal!.Kind).toBe('rescue');
  expect(g.Companions![2]!.Goal!.ID).toBe(5);
  expect(action.Move).toBe(1);
  expect(companionInput(g, 5)).toEqual(idle);
  Object.assign(g.Players[5]!, { Downed: false });
  companionInput(g, 2); g.Tick += 12; companionInput(g, 2);
  expect(g.Companions![2]!.Goal!.Kind === 'rescue').toBe(false);
});
worldTest('party AI decisions reproduce from independent snapshots and keep legacy API', () => {
  const original = party(); for (let i = 1; i < 6; i++) enableCompanion(original, i);
  const before = JSON.stringify(original);
  const a = copyGame(original), b = copyGame(original);
  for (let tick = 0; tick < 90; tick++) {
    a.Tick++; b.Tick++;
    for (let i = 1; i < 6; i++) {
      const left = companionInput(a, i), right = companionInput(b, i);
      expect(left).toEqual(right); updatePlayer(a, i, left); updatePlayer(b, i, right);
    }
  }
  expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  expect(JSON.stringify(original)).toBe(before);
  const legacy = createGame(original.Campaign, 42, 2); enableCompanion(legacy);
  expect(!!legacy.Companion).toBe(true); expect(legacy.Companions).toBe(undefined);
  legacy.State = State.Playing; companionInput(legacy); expect(!!legacy.Companion!.Goal).toBe(true);
});

worldTest('party AI approaches the boss and fires thunder while damage flashes remain cosmetic', () => {
  const g = party(), p = g.Players[3]!; enableCompanion(g, 3); g.Enemies = [];
  g.Party = { Slots: ['human', 'human', 'human', 'ai', 'human', 'human'], Boss: { ...createBoss(6), X:400, Y:150 } } as NonNullable<GameState['Party']>;
  p.X = 250; p.Y = 196; p.Dir = 1; p.Ground = true;p.Power.Thunder=true;
  expect(companionInput(g, 3).Fire).toBe(true);
  expect(g.Companions![3]!.Goal!.Kind).toBe('boss');
  g.Party.Boss!.Invulnerable = 60;
  expect(companionInput(g, 3).Fire).toBe(true);
  p.Power.Thunder=false;expect(companionInput(g,3).Fire).toBe(false);
});

worldTest('party AI rests quietly after collecting wave rewards', () => {
  const g = party(); enableCompanion(g, 1); g.State = State.Clearing; g.Enemies = [];
  g.Party = { Phase: 'rest', Slots: ['human', 'ai', 'human', 'human', 'human', 'human'] } as NonNullable<GameState['Party']>;
  expect(companionInput(g)).toEqual(idle);
  const p = g.Players[1]!;
  g.Items = [{ ...p, X: p.X + 60, Stationary: true, Power: '', Food: 1, Age: 0 }];
  companionInput(g); expect(g.Companions![1]!.Goal!.Kind).toBe('item');
  g.Items = []; expect(companionInput(g)).toEqual(idle);
  expect(g.Companions![1]!.Remaining).toBe(0);
});

worldTest('party AI five bots capture enemies through the real party wave loop', () => {
  const g = createPartyGame(campaign as Level[], 42);
  for (let tick = 0; tick < 1800 && g.Counters.Popped === 0; tick++) {
    for (const p of g.Players) p.Invincible = 2;
    stepGame(g, [idle]);
  }
  expect(g.Counters.Blown).toBeGreaterThan(0);
  expect(g.Counters.Popped).toBeGreaterThan(0);
  expect(g.Party!.Spawned).toBeGreaterThan(0);
  const graph = g.Companions![1]!.Graph;
  for (let i = 2; i < 6; i++) expect(g.Companions![i]!.Graph === graph).toBe(true);
});
worldTest('party AI collects thunder and damages the moving boss through real bubble pops', () => {
  const g = createPartyGame(campaign as Level[], 42, undefined, 2);
  g.Party!.Wave = 2; preparePartyWave(g); g.Party!.Timer = 1; stepGame(g, [idle]);
  const hp = g.Party!.Boss!.HP;
  for (let tick = 0; tick < 3600 && g.Party!.Boss!.HP === hp; tick++) {
    for (const p of g.Players) p.Invincible = 2;
    stepGame(g, [idle]);
  }
  expect(g.Party!.Boss!.HP).toBeLessThan(hp);
});
