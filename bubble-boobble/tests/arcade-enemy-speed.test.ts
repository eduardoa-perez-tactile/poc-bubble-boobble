import {referencePlayerBalance} from '../src/arcade/balance';
import { worldTest } from '@gameengine/test';
import levels from '../data/levels.json';
import { copyGame, createGame, loadLevel, stepGame } from '../src/arcade/game';
import { updateEnemies } from '../src/arcade/enemies';
import { type GameState, State, TPS } from '../src/arcade/types';

const idle = { Move: 0, Jump: false, Fire: false };
function check(value: unknown, message: string) {
  if (!value) throw new Error(message);
}

// Unchanged Go StepPlayers, revision 783cf6aa26ac3c57cdab43f2d7a5b3725a3991cc:
// seed 42, one player, idle input, frame 120 (60 Ready ticks + 60 Playing ticks).
// Each row is [X,Y,Dir,Age,Angry], in upstream enemy order. These retain float64
// movement-substep rounding as well as wall turns, gravity and platform landings.
const earlyRounds = [
  [[234.00000000000264,196,-1,60,false],[234.00000000000264,196,-1,60,false],[533.9999999999981,196,1,60,false]],
  [[186.00000000000102,206.5,-1,60,false],[258.0000000000034,86.5,-1,60,false],[316.3333333333327,316,-1,60,false],[411.16666666666714,316,1,60,false]],
  [[287.3333333333339,196,1,60,false],[425.9999999999991,196,-1,60,false],[389.99999999999716,316,1,60,false],[330.0000000000034,316,-1,60,false]],
  [[122.99999999999972,316,1,60,false],[449.99999999999744,76,-1,60,false],[249.6666666666676,436,1,60,false],[549.4999999999999,436,1,60,false],[215.16666666666666,436,1,60,false],[456.5000000000011,557.5,1,60,false]],
  [[282.0000000000034,76,-1,60,false],[234.00000000000264,196,-1,60,false],[485.9999999999966,316,1,60,false],[191.33333333333331,436,1,60,false]],
];

worldTest('arcade enemy speed: explicit source-speed profile matches first five Go rounds', () => {
  check(TPS === 60, 'reference simulation must remain 60 Hz');
  for (let index = 0; index < earlyRounds.length; index++) {
    const g = createGame(levels.slice(index), 42, 1);
    g.NormalEnemySpeedScale = 1;
    g.PlayerBalance = {...referencePlayerBalance};
    const initial = JSON.stringify(g.Enemies);
    for (let tick = 0; tick < TPS; tick++) stepGame(g, [idle]);
    check(g.State === State.Playing && g.LevelTicks === 0, `round${index + 1}: Ready updated playing time`);
    check(JSON.stringify(g.Enemies) === initial, `round${index + 1}: enemies moved during Ready`);
    for (let tick = 0; tick < TPS; tick++) stepGame(g, [idle]);
    check(g.Tick === 120 && g.LevelTicks === 60, `round${index + 1}: expected exactly 60 playing updates`);
    const actual = g.Enemies.map(e => [e.X,e.Y,e.Dir,e.Age,e.Angry]);
    check(JSON.stringify(actual) === JSON.stringify(earlyRounds[index]), `round${index + 1}: enemy movement differs from pinned Go`);
  }
}, { scene: 'scenes/main.scene.json' });

worldTest('arcade enemy speed: pause and freeze stop enemy time and hurry starts at active tick 1800', () => {
  const g = createGame(levels, 42, 1);
  g.State = State.Playing;
  g.LevelTicks = 30 * TPS - 2;
  g.Freeze = 2;
  g.Players[0]!.Invincible = 10000;
  const enemies = JSON.stringify(g.Enemies);
  g.Paused = true;
  stepGame(g, [idle]);
  check(g.Tick === 0 && g.Freeze === 2, 'pause advanced simulation');
  g.Paused = false;
  stepGame(g, [idle]);
  stepGame(g, [idle]);
  check(g.Freeze === 0 && g.LevelTicks === 1798, 'freeze advanced hurry clock');
  check(JSON.stringify(g.Enemies) === enemies, 'freeze advanced enemies');
  stepGame(g, [idle]);
  check(g.LevelTicks === 1799 && !g.Hurry, 'hurry began before 30 active seconds');
  check(g.Enemies.every(e => e.Age === 1 && !e.Angry), 'normal enemy update count');
  check(g.Enemies[0]!.X === 382, 'normal speed must be 20% slower than Go');
  stepGame(g, [idle]);
  check(g.LevelTicks === 1800 && g.Hurry, 'hurry missed 30 active seconds');
  check(g.Enemies.every(e => e.Age === 2 && e.Angry), 'hurry must accelerate enemies on its boundary tick');
  check(g.Enemies[0]!.X === 378.5, 'hurry must retain original 3.5px/tick');
}, { scene: 'scenes/main.scene.json' });


function clearArena(kind: string, angry: boolean) {
  const level = JSON.parse(JSON.stringify(levels[0]!));
  level.tiles = level.tiles.map((row: number[], y: number) => row.map((_: number, x: number) => x < 2 || x >= 30 || y === 0 || y === 25 ? 1 : 0));
  const g = createGame([level], 42, 1);
  g.Enemies = [g.Enemies[0]!];
  const e = g.Enemies[0]!;
  Object.assign(e, { Kind: kind, X: 200, Y: 200, VX: 0, VY: 0, Ground: false, Dir: 1, Vertical: 1, Angry: angry, Age: 0, Cooldown: 180, Shoot: 0, Phase: 0.5 });
  return { g, e };
}

// One unchanged Go tick in an unobstructed arena, starting at (200,200), phase 0.5.
// The tiny position tolerance in the normal case allows changed movement
// substep counts; it does not relax any canonical source-profile comparison.
const goNormalPositions = [
  ['zenchan',202.50000000000003,200.5],
  ['mighta',202.50000000000003,200.5],
  ['banebou',202.50000000000003,200.5],
  ['monsta',202.50000000000003,202.50000000000003],
  ['pulpul',202.6746025985717,201.90031057257133],
  ['invader',203.75,200.5],
] as const;
const goAngryPositions = [
  ['zenchan',203.5,200.5], ['mighta',203.5,200.5], ['banebou',203.5,200.5],
  ['monsta',203.5,203.5], ['pulpul',203.1844436380004,202.3804348015999], ['invader',205.25,200.5],
] as const;
worldTest('arcade enemy speed: production normal locomotion is 20% slower for all six kinds and angry is unchanged', () => {
  for (const [kind, x, y] of goNormalPositions) {
    const {g,e} = clearArena(kind,false);
    check(g.NormalEnemySpeedScale === 0.8, 'production tuning default');
    updateEnemies(g);
    check(Math.abs((e.X - 200) - (x - 200) * 0.8) < 1e-12, `${kind}: normal horizontal locomotion`);
    const flying = kind === 'monsta' || kind === 'pulpul';
    const expectedY = flying ? (y - 200) * 0.8 : y - 200;
    check(Math.abs((e.Y - 200) - expectedY) < 1e-12, `${kind}: flying locomotion must scale; gravity must not`);
    check(e.Age === 1 && e.Cooldown === 179 && e.Phase === (kind === 'pulpul' ? 0.535 : 0.5), `${kind}: update cadence changed`);
  }
  for (const [kind,x,y] of goAngryPositions) {
    const {g,e} = clearArena(kind,true);
    updateEnemies(g);
    check(e.X === x && e.Y === y, `${kind}: angry movement must match Go exactly`);
  }
}, { scene: 'scenes/main.scene.json' });

worldTest('arcade enemy speed: jump impulses projectile speeds and shot delays retain original timing', () => {
  for (const angry of [false,true]) {
    const {g,e} = clearArena('banebou',angry);
    e.Ground = true;
    updateEnemies(g);
    check(e.VY === (angry ? -9.5 : -7), 'Banebou jump/gravity changed');
  }
  for (const kind of ['zenchan','mighta']) {
    const {g,e} = clearArena(kind,false);
    e.Ground = true; e.Cooldown = 0; g.Players[0]!.Y = 100;
    updateEnemies(g);
    check(e.VY === -11 && e.Cooldown === 60, `${kind}: jump impulse/cooldown changed`);
  }
  for (const kind of ['mighta','invader']) {
    const {g,e} = clearArena(kind,false);
    e.Cooldown = 0; g.Players[0]!.Y = 200;
    updateEnemies(g);
    const p = g.Projectiles[0];
    check(p && (kind === 'mighta' ? Math.abs(p.VX) === 6 : p.VY === 6), `${kind}: projectile speed changed`);
    check(e.Cooldown === 180 && e.Shoot === (kind === 'mighta' ? 30 : 12), `${kind}: shot delay changed`);
    const x = e.X, y = e.Y;
    updateEnemies(g);
    check(e.X === x && e.Y === y && e.Shoot === (kind === 'mighta' ? 29 : 11), `${kind}: shot pause changed`);
  }
}, { scene: 'scenes/main.scene.json' });


worldTest('arcade enemy speed: tuning survives copies and rounds and missing live-session fields use production default', () => {
  for (const scale of [0.8,1,0.5]) {
    const g = createGame(levels,42,1);
    g.NormalEnemySpeedScale = scale;
    const copied = copyGame(g);
    check(copied.NormalEnemySpeedScale === scale, 'copy lost authoritative tuning');
    loadLevel(copied,1);
    check(copied.NormalEnemySpeedScale === scale, 'round transition lost authoritative tuning');
  }
  const {g,e} = clearArena('zenchan',false);
  delete (g as Partial<GameState>).NormalEnemySpeedScale;
  const copied = copyGame(g);
  check(copied.NormalEnemySpeedScale === 0.8, 'old live session not normalized by copy');
  updateEnemies(g);
  check(e.X === 202 && Number.isFinite(e.Y), 'direct old-session update must use production speed');
}, { scene: 'scenes/main.scene.json' });
