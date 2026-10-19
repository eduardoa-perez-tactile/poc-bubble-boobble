import { arenaWidth, arenaHeight, arenaRows, arenaColumns } from './types';
import {
  ActorSize,
  EnemyState,
  type GameState,
  type Item,
  TPS,
  Tile,
  alive,
  body,
  intersects,
  position,
} from "./types";
import { productionPlayerBalance } from './balance';
import { blocked, solid } from "./physics";
import { intN } from './rng';
import { addScore, defeat, loadLevel } from "./game";
export function foodScore(level: number) {
  return level <= 10
    ? Math.max(1, level) * 10
    : 100 + (Math.min(level, 25) - 10) * 50;
}
export const item = (X: number, Y: number): Item => ({
  ...body(X, Y),
  Stationary: false,
  Power: "",
  Food: 0,
  Age: 0,
});
// Existing fruit art, cycled by wave rather than the survival arena's fixed level.
const partyFruit = [13,14,15,16,17,18,19,20] as const;
export const rewardFood = (g:GameState) => g.Party ? partyFruit[(g.Party.Wave-1)%partyFruit.length]! : g.Level.number;
export function spawnFood(g: GameState, x: number, y: number) {
  g.Items.push({
    ...item(
      Math.max(2 * Tile, Math.min(arenaWidth(g) - 2 * Tile - 32, x)),
      Math.max(Tile, Math.min(arenaHeight(g) - 2 * Tile, y)),
    ),
    Food: rewardFood(g),
  });
}
function partyPowerLocation(g: GameState): [number, number] | undefined {
  const locations: [number, number][] = [];
  for (let row = 2; row < arenaRows(g); row++) {
    for (let col = 2; col < arenaColumns(g)-3; col++) {
      const x = col * Tile, y = row * Tile - 32;
      if (blocked(g, x, y, 32) || !solid(g, col, row) || !solid(g, Math.floor((x + 31) / Tile), row)) continue;
      if (g.Players.some(p => alive(p) && intersects(p.X, p.Y, ActorSize, ActorSize, x, y, 32, 32))) continue;
      if (g.Enemies.some(e => e.State !== EnemyState.Defeated && intersects(e.X, e.Y, ActorSize, ActorSize, x, y, 32, 32))) continue;
      locations.push([x, y]);
    }
  }
  // Consume the recorded game's RNG only when a drop can actually appear.
  return locations.length ? locations[intN(g, locations.length)] : undefined;
}
export function checkPowerSpawns(g: GameState) {
  // The boss supplies thunder pickups. Ordinary thunder rewards would repeatedly
  // spawn clocks and leave the moving fight frozen under six-player fire.
  if(g.Party?.Boss)return;
  const c = g.Counters;
  const rules: [keyof typeof c, number, string][] = [
    ["Blown", 35, "pink_candy"],
    ["Popped", 35, "blue_candy"],
    ["Jumps", 35, "yellow_candy"],
    ["Thunder", 12, "clock"],
    ["Fire", 13, "dynamite"],
    ["Blue", 3, "crystal_ring"],
    ["Yellow", 3, "amethyst_ring"],
    ["Pink", 3, "ruby_ring"],
  ];
  for (const [key, threshold, power] of rules)
    while (c[key] >= threshold) {
      c[key] -= threshold;
      g.Pending.push(power);
    }
  const shoesTravelThreshold = g.PlayerBalance?.ShoesTravelThreshold ?? productionPlayerBalance.ShoesTravelThreshold;
  if (c.Walked >= shoesTravelThreshold) {
    c.Walked -= shoesTravelThreshold;
    g.Pending.push("shoes");
  }
  if (c.Water >= 15 && g.WaterStage === 0) {
    g.Pending.push("orange_parasol");
    g.WaterStage = 1;
  }
  if (c.Water >= 20 && g.WaterStage === 1) {
    g.Pending.push("red_parasol");
    g.WaterStage = 2;
  }
  if (c.Water >= 25 && g.WaterStage === 2) {
    g.Pending.push("purple_parasol");
    c.Water -= 25;
    g.WaterStage = 0;
  }
  if (g.Pending.length === 0 || g.Items.some((i) => i.Power !== "")) return;
  const location = g.Party ? partyPowerLocation(g) : position(g.Level.power_spawn, 32, g.Level);
  if (!location) return;
  const [x, y] = location;
  g.Items.push({ ...item(x, y), Power: g.Pending.shift()! });
}
export function updateItems(g: GameState) {
  const kept: Item[] = [];
  for (const it of g.Items) {
    it.Age++;
    if (it.Age > 12 * TPS && it.Power !== 'thunder_potion') continue;
    // Keep offensive pickups available until their targets can fight back.
    if (g.Party && (g.Party.Phase === 'prepare' || g.Party.Phase === 'rest') && (it.Power === 'dynamite' || it.Power === 'clock')) {
      kept.push(it);
      continue;
    }
    if (it.Power === "" && !it.Stationary) {
      const oldFeet = it.Y + 32;
      it.VY = Math.min(6, it.VY + 0.3);
      const newFeet = oldFeet + it.VY;
      let row = Math.trunc(oldFeet / Tile);
      if (row * Tile < oldFeet) row++;
      if (
        row * Tile <= newFeet &&
        (solid(g, Math.trunc(it.X / Tile), row) ||
          solid(g, Math.trunc((it.X + 31) / Tile), row))
      ) {
        it.Y = row * Tile - 32;
        it.VY = 0;
      } else it.Y += it.VY;
      if (it.Y > arenaHeight(g)) {
        [it.X, it.Y] = position(g.Level.food_spawn, 32, g.Level);
        it.VY = 0;
      }
    }
    let collected = false;
    for (let player = 0; player < g.Players.length; player++) {
      const p = g.Players[player]!;
      if (
        !alive(p) ||
        !intersects(p.X, p.Y, ActorSize, ActorSize, it.X, it.Y, 32, 32)
      )
        continue;
      if(it.Power==='thunder_potion'&&p.Power.Thunder)continue;
      if (it.Power !== "") {
        if (applyPower(g, it.Power, player)) return true;
      } else {
        addScore(g, foodScore(g.Party ? g.Level.number : it.Food), it.X, it.Y, g.PlayerBalance?.ArcadeScoring !== false);
        g.Sounds.push("food");
      }
      collected = true;
      break;
    }
    if (!collected) kept.push(it);
  }
  g.Items = kept;
  return false;
}
export function applyPower(g: GameState, power: string, player: number) {
  const p = g.Players[player]!.Power;
  let points = 100,
    warp = 0;
  switch (power) {
    case 'thunder_potion':
      p.Thunder=true;
      break;
    case "pink_candy":
      p.Pink = true;
      g.Counters.Pink++;
      break;
    case "blue_candy":
      p.Blue = true;
      g.Counters.Blue++;
      break;
    case "yellow_candy":
      p.Yellow = true;
      g.Counters.Yellow++;
      break;
    case "shoes":
      p.Shoes = true;
      break;
    case "orange_parasol":
      points = 200;
      warp = 3;
      break;
    case "red_parasol":
      points = 200;
      warp = 5;
      break;
    case "purple_parasol":
      points = 200;
      warp = 7;
      break;
    case "crystal_ring":
      points = 1000;
      p.Crystal = true;
      break;
    case "amethyst_ring":
      points = 1000;
      p.Amethyst = true;
      break;
    case "ruby_ring":
      points = 1000;
      p.Ruby = true;
      break;
    case "dynamite":
      points = 200;
      for (const e of g.Enemies) defeat(g, e, 2,player);
      for (const b of g.Bubbles) if (b.EnemyID !== 0) b.Removed = true;
      g.Projectiles = [];
      g.Sounds.push("explosion");
      break;
    case "clock":
      points = 200;
      g.Freeze = 7 * TPS;
      break;
  }
  addScore(g, points, g.Players[player]!.X, g.Players[player]!.Y);
  g.Sounds.push("item");
  if (warp > 0 && g.Party) {
    // Campaign skips become a team recovery reward in survival.
    for (const p of g.Players) if (!p.Downed && p.Lives > 0) p.Invincible = Math.max(p.Invincible,180);
    return false;
  }
  if (warp > 0) {
    loadLevel(g, g.LevelIndex + warp);
    return true;
  }
  return false;
}
