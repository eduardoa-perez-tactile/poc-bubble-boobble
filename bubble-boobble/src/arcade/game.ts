import { recordPartyKill, recordPartyLastKill } from './party-config';
import { arenaWidth, levelColumns, levelRows } from './types';
import { stepParty, copyParty } from './party';
import { companionInput } from './companion';
import {
  type Enemy,
  EnemyState,
  type GameState,
  type Input,
  type Level,
  State,
  TPS,
  alive,
  body,
  direction,
  powers,
} from "./types";
import { productionPlayerBalance } from './balance';
import { spawnPosition } from "./physics";
import { checkPlayerHit, respawn, updatePlayer } from "./player";
import { spawnSpecial, updateBubbles, updateEffects } from "./bubbles";
import { updateDefeated, updateEnemies, updateProjectiles } from "./enemies";
import { checkPowerSpawns, updateItems } from "./items";
import { createRNG, float64, intN, rngHex } from "./rng";
export function createGame(
  levels: Level[],
  seed: number,
  count = 1,
): GameState {
  if (!Number.isInteger(count) || count < 1 || count > 10) throw new Error("expected one to ten players");
  if (!levels.length) throw new Error("no levels supplied");
  for (const level of levels) validateLevel(level);
  const g: GameState = {
    PlayerBalance: { ...productionPlayerBalance },
    NormalEnemySpeedScale: 0.8,
    Campaign: levels,
    Level: levels[0]!,
    LevelIndex: 0,
    Custom: false,
    State: State.Ready,
    Paused: false,
    Tick: 0,
    LevelTicks: 0,
    Countdown: 0,
    Freeze: 0,
    Hurry: false,
    Score: 0,
    Players: Array.from({ length: count }, () => ({
      ...body(),
      Lives: 3,
      JumpBuffer: 0,
      Coyote: 0,
      LastJump: false,
      Dir: 0,
      Invincible: 0,
      Dead: 0,
      Shoot: 0,
      Cooldown: 0,
      WalkFrame: 0,
      Power: powers(),
    })),
    Enemies: [],
    Bubbles: [],
    Projectiles: [],
    Items: [],
    Effects: [],
    Particles: [],
    Sounds: [],
    Counters: {
      Blown: 0,
      Popped: 0,
      Jumps: 0,
      Water: 0,
      Thunder: 0,
      Fire: 0,
      Pink: 0,
      Blue: 0,
      Yellow: 0,
      Walked: 0,
    },
    WaterStage: 0,
    Pending: [],
    SpawnedSpecial: 0,
    NextID: 0,
    ExtraLifeAt: 30000,
    RNG: createRNG(seed).RNG,
  };
  loadLevel(g, 0);
  return g;
}
export function loadLevel(g: GameState, index: number) {
  if (index >= g.Campaign.length) {
    g.State = State.Won;
    g.Sounds.push("opening");
    return;
  }
  g.LevelIndex = index;
  g.Level = {
    ...g.Campaign[index]!,
    tiles: g.Campaign[index]!.tiles.map((row) => row.slice()),
    enemies: g.Campaign[index]!.enemies.map((e) => ({ ...e })),
    player: { ...g.Campaign[index]!.player },
    power_spawn: { ...g.Campaign[index]!.power_spawn },
    food_spawn: { ...g.Campaign[index]!.food_spawn },
  };
  g.LevelTicks = 0;
  g.Freeze = 0;
  g.SpawnedSpecial = 0;
  g.Hurry = false;
  g.Paused = false;
  g.Bubbles = [];
  g.Projectiles = [];
  g.Items = [];
  g.Effects = [];
  g.Particles = [];
  g.Enemies = [];
  for (const spawn of g.Level.enemies) {
    const [x, y] = spawnPosition(g, spawn);
    g.NextID++;
    const dir = intN(g, 2) === 0 ? 1 : -1;
    g.Enemies.push({
      ...body(x, y),
      CarriedBy: 0,
      CarryTicks: 0,
      ID: g.NextID,
      Kind: spawn.kind,
      State: EnemyState.Active,
      Dir: dir,
      Vertical: 1,
      Angry: false,
      Age: 0,
      Cooldown: 180,
      Shoot: 0,
      DeadTicks: 0,
      Phase: float64(g) * 2 * Math.PI,
    });
  }
  for (let i = 0; i < g.Players.length; i++) {
    respawn(g, i);
    g.Players[i]!.Invincible = 0;
  }
  g.State = State.Ready;
  g.Countdown = TPS;
}
export function stepGame(g: GameState, inputs: Input[] | Input) {
  const ins = Array.isArray(inputs) ? inputs.slice() : [inputs];
  g.Sounds = [];
  if (g.Paused || g.State === State.GameOver || g.State === State.Won) return;
  if (g.Party) { stepParty(g, ins); return; }
  g.Tick++;
  if (g.State === State.Ready) {
    g.Countdown--;
    if (g.Countdown <= 0) g.State = State.Playing;
    return;
  }
  if (g.Companion) ins[1] = companionInput(g);
  for (let i = 0; i < g.Players.length; i++) {
    const p = g.Players[i]!;
    if (p.Dead > 0) {
      p.Dead--;
      if (p.Dead === 0 && p.Lives > 0) {
        respawn(g, i);
        g.Projectiles = [];
      }
    } else if (p.Lives > 0)
      updatePlayer(g, i, ins[i] ?? { Move: 0, Jump: false, Fire: false });
  }
  if (g.Players.every((p) => p.Lives <= 0 && p.Dead <= 0)) {
    g.State = State.GameOver;
    return;
  }
  if (g.State === State.Playing) {
    if (g.Freeze > 0) g.Freeze--;
    else {
      g.LevelTicks++;
      if (g.LevelTicks >= 30 * TPS && !g.Hurry) {
        g.Hurry = true;
        for (const e of g.Enemies) e.Angry = true;
      }
      updateEnemies(g);
      updateProjectiles(g);
    }
    spawnSpecial(g);
  }
  updateBubbles(g, ins);
  updateEffects(g);
  if (updateItems(g)) return;
  updateDefeated(g);
  updateParticles(g);
  if (g.State === State.Playing) {
    checkPowerSpawns(g);
    for (let i = 0; i < g.Players.length; i++) checkPlayerHit(g, i);
    if (remainingEnemies(g) === 0 && g.Players.some(alive)) {
      g.State = State.Clearing;
      g.Countdown = 7 * TPS;
      g.Projectiles = [];
    }
  } else if (g.State === State.Clearing) {
    g.Countdown--;
    if (g.Countdown === 0) loadLevel(g, g.LevelIndex + 1);
  }
}
export const remainingEnemies = (g: GameState) =>
  g.Enemies.reduce((n, e) => n + (e.State !== EnemyState.Defeated ? 1 : 0), 0);
export const enemy = (g: GameState, id: number) =>
  g.Enemies.find((e) => e.ID === id);
export function defeat(g: GameState, e: Enemy, multiplier: number, player?:number) {
  if (e.State === EnemyState.Defeated) return;
  e.State = EnemyState.Defeated;
  recordPartyKill(g,player);
  if(g.Party&&g.Party.ToSpawn===0&&g.Party.Telegraphs.length===0&&remainingEnemies(g)===0)recordPartyLastKill(g,player);
  e.DeadTicks = 50;
  e.VX = direction(e.X - arenaWidth(g) / 2) * 4;
  e.VY = -8;
  addScore(g, 100 * multiplier, e.X, e.Y);
}
export function addScore(g: GameState, points: number, x: number, y: number, showSmallPoints = false) {
  g.Score += points;
  if (points >= 100 || showSmallPoints && points > 0)
    g.Particles.push({ ...body(x, y), Text: String(points), Life: 45 });
  if (g.Party) return;
  while (g.Score >= g.ExtraLifeAt) {
    for (let i = 0; i < g.Players.length; i++) {
      const p = g.Players[i]!;
      p.Lives++;
      if (p.Lives === 1 && p.Dead === 0) respawn(g, i);
    }
    g.ExtraLifeAt += 100000;
    g.Particles.push({
      ...body(g.Players[0]!.X, g.Players[0]!.Y - 24),
      Text: "1UP",
      Life: 90,
    });
  }
}
export function updateParticles(g: GameState) {
  g.Particles = g.Particles.filter((p) => {
    p.Life--;
    p.Y -= 0.6;
    return p.Life > 0;
  });
}
export function canonicalState(source: GameState) {
  // Go Snapshot copies slice elements, including embedded player powers.
  const g = copyGame(source);
  // Go has no cosmetic shooter metadata. Strip only that field from the copied
  // bubbles; the authoritative session retains it for deterministic rendering.
  for (const b of g.Bubbles) delete b.Shooter;
  // Arcade motion phases have no fields in the pinned Go snapshot.
  for (const p of g.Players) { delete p.MotionTick; delete p.JumpStep; }
  const nullable = <T>(v: T[]) => (v.length ? v : null);
  return {
    Snapshot: {
      Round: g.Level.number,
      State: g.State,
      Paused: g.Paused,
      Hurry: g.Hurry,
      Tick: g.Tick,
      LevelTicks: g.LevelTicks,
      Countdown: g.Countdown,
      Freeze: g.Freeze,
      Score: g.Score,
      Players: nullable(g.Players),
      Enemies: nullable(g.Enemies),
      Bubbles: nullable(g.Bubbles),
      Projectiles: nullable(g.Projectiles),
      Items: nullable(g.Items),
      Effects: nullable(g.Effects),
      Particles: nullable(g.Particles),
      Sounds: nullable(g.Sounds),
    },
    LevelIndex: g.LevelIndex,
    Custom: g.Custom,
    Counters: g.Counters,
    WaterStage: g.WaterStage,
    Pending: g.Pending.slice(),
    SpawnedSpecial: g.SpawnedSpecial,
    NextID: g.NextID,
    ExtraLifeAt: g.ExtraLifeAt,
    RNG: rngHex(g),
  };
}
export function copyGame(g: GameState): GameState {
  const copied:GameState = {
    ...g,
    ...(g.Party ? { Party: copyParty(g) } : {}),
    ...(g.Companions ? { Companions: g.Companions.map(ai => ai ? {...ai, Goal: ai.Goal ? {...ai.Goal} : null} : null) } : {}),
    ...(g.Companion && !g.Companions ? { Companion: { ...g.Companion, Goal: g.Companion.Goal ? { ...g.Companion.Goal } : null } } : {}),
    NormalEnemySpeedScale: g.NormalEnemySpeedScale ?? 0.8,
    PlayerBalance: { ...productionPlayerBalance, ...g.PlayerBalance },
    Players: g.Players.map((p) => ({ ...p, Power: { ...p.Power } })),
    Enemies: g.Enemies.map((e) => ({ ...e })),
    Bubbles: g.Bubbles.map((b) => ({ ...b })),
    Projectiles: g.Projectiles.map((p) => ({ ...p })),
    Items: g.Items.map((i) => ({ ...i })),
    Effects: g.Effects.map((e) => ({ ...e })),
    Particles: g.Particles.map((p) => ({ ...p })),
    Sounds: g.Sounds.slice(),
    Counters: { ...g.Counters },
    Pending: g.Pending.slice(),
  };
  if(copied.Companions && g.Companion)copied.Companion=copied.Companions[1]??undefined;
  return copied;
}
export function movementStep(g: GameState, input: Input) {
  g.Sounds = [];
  if (g.Paused) return;
  g.Tick++;
  updatePlayer(g, 0, input);
}
export function movementSetup(
  g: GameState,
  player?: Partial<GameState["Players"][0]>,
  spawn?: {
    col: number;
    row: number;
  },
) {
  g.State = State.Playing;
  g.Countdown = 0;
  if (player) Object.assign(g.Players[0]!, player);
  if (spawn) [g.Players[0]!.X, g.Players[0]!.Y] = spawnPosition(g, spawn);
}
export function validateLevel(l: Level) {
  const fail = (message: string): never => {
    throw new Error(message);
  };
  if (l.number < 1 || l.number > 25)
    fail("tile theme must be between 1 and 25");
  if(l.arena!==undefined&&l.arena!=='courtyard')fail('unknown arena');
  const rows=levelRows(l),columns=levelColumns(l);
  if (l.tiles.length !== rows) fail(`expected ${rows} rows`);
  for (const row of l.tiles) {
    if (row.length !== columns) fail(`expected ${columns} columns`);
    for (let col = 0; col < columns; col++) {
      if (row[col]! < 0 || row[col]! > 25) fail("invalid tile");
      if ((col < 2 || col >= columns-2) && row[col]! === 0)
        fail("side walls must remain closed");
    }
  }
  if (!l.enemies.length || l.enemies.length > 32)
    fail("place between 1 and 32 enemies");
  const valid = (c: { col: number; row: number }) =>
    c.col >= 2 && c.col < columns-2 && c.row >= 1 && c.row < rows;
  for (const e of l.enemies) {
    if (
      !["zenchan", "monsta", "mighta", "pulpul", "banebou", "invader"].includes(
        e.kind,
      )
    )
      fail("unknown enemy");
    if (!valid(e)) fail("enemy is outside the arena");
  }
  if (!valid(l.player) || !valid(l.power_spawn) || !valid(l.food_spawn))
    fail("spawn point is outside the arena");
  if (l.special !== "" && !["water", "thunder", "fire"].includes(l.special))
    fail("unknown special bubble");
  if (l.special_count < 0 || l.special_count > 100)
    fail("invalid special bubble count");
  let space = false;
  for (let row = 1; row < rows-2; row++)
    for (let col = 2; col < columns-3; col++)
      if (
        l.tiles[row]![col]! === 0 &&
        l.tiles[row]![col + 1]! === 0 &&
        l.tiles[row + 1]![col]! === 0 &&
        l.tiles[row + 1]![col + 1]! === 0
      )
        space = true;
  if (!space) fail("leave room for the player and enemies");
}
