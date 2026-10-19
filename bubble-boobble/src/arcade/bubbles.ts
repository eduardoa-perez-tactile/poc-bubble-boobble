import { arenaWidth, arenaHeight } from './types';
import { hitBossWithThunder } from './boss';
import { startPlayerJump } from './physics';
import {
  ActorSize,
  type Bubble,
  type Effect,
  EnemyState,
  type GameState,
  type Input,
  TPS,
  Tile,
  alive,
  body,
  intersects,
  position,
} from "./types";
import { productionPlayerBalance } from './balance';
import { blocked } from "./physics";
import { addScore, defeat, enemy } from "./game";
import { item, rewardFood } from "./items";
import { goSin, goFMA } from "./trig";
export const bubble = (X = 0, Y = 0): Bubble => ({
  ...body(X, Y),
  ID: 0,
  Dir: 0,
  Age: 0,
  EnemyID: 0,
  CapturedAge: 0,
  Distance: 0,
  MaxDistance: 0,
  Speed: 0,
  Floating: false,
  Removed: false,
  Element: "",
});
export const effect = (X = 0, Y = 0): Effect => ({
  ...body(X, Y),
  ID: 0,
  Element: "",
  Dir: 0,
  Age: 0,
  Life: 0,
  Spread: false,
});
export function shootBubble(g: GameState, player: number) {
  const p = g.Players[player]!,
    balance = g.PlayerBalance ?? productionPlayerBalance,
    speed = p.Power.Blue ? balance.BlueBubbleSpeed : balance.BubbleSpeed,
    reach = p.Power.Pink ? balance.PinkBubbleRange : balance.BubbleRange;
  g.NextID++;
  g.Bubbles.push({
    ...bubble(p.X + p.Dir * 18, p.Y + 2),
    ID: g.NextID,
    Shooter: player,
    Dir: p.Dir,
    Speed: speed,
    MaxDistance: reach,
    ...(g.Party?.Boss && p.Power.Thunder ? {Element:'thunder',ThunderShot:true} : {}),
  });
  g.Counters.Blown++;
  if (p.Power.Ruby) addScore(g, 100, p.X, p.Y);
  g.Sounds.push("shoot");
}
export function updateBubbles(g: GameState, inputs: Input[]) {
  for (let i = 0; i < g.Bubbles.length; i++) {
    const b = g.Bubbles[i]!;
    if (b.Removed) continue;
    b.Age++;
    if (b.Element !== "" && !b.ThunderShot) moveSpecialBubble(g, b);
    else if (!b.Floating) {
      for (let step = 0; step < Math.trunc(b.Speed); step++) {
        b.X += b.Dir;
        b.Distance++;
        for (const e of g.Enemies)
          if (
            b.Element === '' && g.Party?.Phase !== 'prepare' &&
            e.State === EnemyState.Active &&
            intersects(b.X, b.Y, 40, 40, e.X + 3, e.Y + 3, 38, 38)
          ) {
            b.EnemyID = e.ID;
            e.State = EnemyState.Trapped;
            b.Floating = true;
            break;
          }
        if (
          b.Floating ||
          b.Distance >= b.MaxDistance ||
          blocked(g, b.X + 4, b.Y + 4, 32)
        ) {
          b.Floating = true;
          break;
        }
      }
    } else {
      const ceiling = g.Level.number === 24 ? 9 * Tile : 2 * Tile;
      if (b.Y > ceiling) b.Y -= 1.15;
      else b.Y = goFMA(goSin(b.Age / 28), 4, ceiling);
      b.X = goFMA(goSin(goFMA(b.ID, 1.7, b.Age / 60)), 0.2, b.X);
    }
    b.X = Math.max(2 * Tile, Math.min(arenaWidth(g) - 2 * Tile - 40, b.X));
    if (b.EnemyID !== 0) {
      b.CapturedAge++;
      const e = enemy(g, b.EnemyID);
      if (e) {
        e.X = b.X;
        e.Y = b.Y;
      }
      if (b.CapturedAge > 1270) {
        if (e) {
          e.State = EnemyState.Active;
          e.Angry = true;
          e.VY = 0;
          e.Y += 4;
        }
        b.Removed = true;
        continue;
      }
    } else if (b.Age > (g.Party ? 180 : 600)) {
      b.Removed = true;
      continue;
    }
    for (let player = 0; player < g.Players.length; player++) {
      const input = inputs[player] ?? { Move: 0, Jump: false, Fire: false },
        p = g.Players[player]!;
      if (!alive(p) || b.Age <= 20 || b.Removed) continue;
      if (
        !(g.Party && b.ThunderShot) && input.Jump &&
        p.VY >= 0 &&
        p.Y + ActorSize >= b.Y &&
        p.Y + ActorSize - p.VY <= b.Y + 10 &&
        p.X + ActorSize > b.X + 4 &&
        p.X < b.X + 36
      ) {
        p.Y = b.Y - ActorSize;
        startPlayerJump(g, p, -10.5);
        g.Sounds.push("jump");
        continue;
      }
      if (intersects(p.X + 4, p.Y + 4, 36, 36, b.X, b.Y, 40, 40))
        popBubble(g, i, player);
    }
  }
  g.Bubbles = g.Bubbles.filter((b) => !b.Removed);
}
export function popBubble(g: GameState, index: number, player: number) {
  const queue = [index];
  let combo = 0;
  while (queue.length) {
    const i = queue.shift()!,
      b = g.Bubbles[i]!;
    if (b.Removed) continue;
    b.Removed = true;
    g.Counters.Popped++;
    g.Particles.push({ ...body(b.X, b.Y), Text: "", Life: 15 });
    const e = enemy(g, b.EnemyID);
    if (e && e.State === EnemyState.Trapped) {
      combo++;
      defeat(g, e, 1 << Math.min(combo - 1, 5),player);
      const [x, y] = position(g.Level.food_spawn, 32, g.Level);
      g.Items.push({ ...item(x, y), Food: rewardFood(g), Stationary: true });
    }
    // Empty ordinary bubbles score once each, including every bubble in a chain.
    if (b.EnemyID === 0 && b.Element === '' && g.PlayerBalance?.ArcadeScoring !== false)
      addScore(g, 10, b.X, b.Y, true);
    if (b.Element !== "") releaseElement(g, b, player);
    for (let j = 0; j < g.Bubbles.length; j++) {
      const other = g.Bubbles[j]!;
      if (
        !other.Removed &&
        other.Age > 20 &&
        intersects(b.X - 6, b.Y - 6, 52, 52, other.X, other.Y, 40, 40)
      )
        queue.push(j);
    }
  }
  g.Sounds.push("pop");
}
export function spawnSpecial(g: GameState) {
  if (g.Level.special === "" || g.SpawnedSpecial >= g.Level.special_count)
    return;
  if (
    g.Freeze === 0 &&
    g.LevelTicks >= 1 &&
    g.SpawnedSpecial <= Math.trunc((g.LevelTicks - 1) / 450)
  ) {
    g.NextID++;
    g.Bubbles.push({
      ...bubble(252, Tile),
      ID: g.NextID,
      Dir: 1,
      Age: 21,
      Floating: true,
      Element: g.Level.special,
    });
    g.SpawnedSpecial++;
  }
}
export function moveSpecialBubble(g: GameState, b: Bubble) {
  if (!blocked(g, b.X + 4, b.Y + 7, 32)) b.Y += 3;
  else {
    const next = b.X + b.Dir * 2;
    if (blocked(g, next + 4, b.Y + 4, 32)) b.Dir *= -1;
    else b.X = next;
  }
  if (b.Y > arenaHeight(g)) b.Y = Tile;
}
export function releaseElement(g: GameState, b: Bubble, player: number) {
  g.NextID++;
  const e = {
    ...effect(b.X, b.Y),
    ...(g.Party?{Owner:player}:{}),
    ID: g.NextID,
    Element: b.Element,
    Dir: g.Players[player]!.Dir,
    Life: 300,
  };
  switch (b.Element) {
    case "water":
      g.Counters.Water++;
      e.Life = 420;
      g.Sounds.push("water");
      break;
    case "thunder":
      g.Counters.Thunder++;
      e.Life = 90;
      if(!g.Party||!g.Sounds.includes("laser"))g.Sounds.push("laser");
      break;
    case "fire":
      g.Counters.Fire++;
      g.Sounds.push("fire");
      break;
  }
  g.Effects.push(e);
}
export function updateEffects(g: GameState) {
  const spawned: Effect[] = [];
  for (const e of g.Effects) {
    e.Age++;
    e.Life--;
    switch (e.Element) {
      case "thunder":
        for (let step = 0; step < 12; step++) {
          e.X += e.Dir;
          if(g.Party?.Phase==='boss') {
            for(const shot of g.Projectiles)if(shot.Bottle&&!shot.Removed&&intersects(e.X,e.Y,40,24,shot.X,shot.Y,16,20))shot.Removed=true;
            if(hitBossWithThunder(g,e.X,e.Y,40,24)){e.Life=0;break;}
          }
          hitWithElement(g, e, 40, 24);
        }
        if (e.X < 2 * Tile || e.X > arenaWidth(g) - 2 * Tile) e.Life = 0;
        break;
      case "water":
        if (!blocked(g, e.X + 3, e.Y + 6, 26)) e.Y += 3;
        else {
          const next = e.X + e.Dir * 3;
          if (blocked(g, next + 3, e.Y + 3, 26)) e.Dir *= -1;
          else e.X = next;
        }
        if (e.Age % 12 === 0 && e.Age <= 72 && !e.Spread)
          spawned.push({
            ...effect(),
            ...(e.Owner!==undefined?{Owner:e.Owner}:{}),
            X: e.X,
            Y: e.Y,
            VX: e.VX,
            VY: e.VY,
            Ground: e.Ground,
            Element: "water",
            Dir: e.Dir,
            Life: 150,
            Spread: true,
          });
        if (e.Y > arenaHeight(g)) e.Life = 0;
        hitWithElement(g, e, 32, 32);
        carryOnWater(g, e);
        break;
      case "fire":
        if (!e.Ground) {
          if (!blocked(g, e.X + 3, e.Y + 7, 26)) e.Y += 4;
          else {
            e.Ground = true;
            if (!e.Spread)
              for (const dir of [-1, 1])
                spawned.push({
                  ...effect(e.X + dir * 28, e.Y),
                  ...(e.Owner!==undefined?{Owner:e.Owner}:{}),
                  Element: "fire",
                  Dir: dir,
                  Life: 300,
                  Spread: true,
                });
          }
        }
        if (e.Y > arenaHeight(g)) e.Life = 0;
        hitWithElement(g, e, 32, 32);
        break;
    }
  }
  g.Effects = g.Party?.Boss?.Mode==='captured' ? [] : g.Effects.filter((e) => e.Life > 0).concat(spawned);
}
export function hitWithElement(
  g: GameState,
  effect: Effect,
  w: number,
  h: number,
) {
  if (g.Party?.Phase === 'prepare') return;
  if (effect.Element === "fire" && !effect.Ground) return;
  for (const e of g.Enemies)
    if (
      e.State === EnemyState.Active &&
      intersects(effect.X, effect.Y, w, h, e.X, e.Y, ActorSize, ActorSize)
    ) {
      if (effect.Element === "water" && !effect.Spread) {
        e.State = EnemyState.Carried;
        e.CarriedBy = effect.ID;
        e.CarryTicks = 0;
      } else if (effect.Element !== "water") defeat(g, e, 2,effect.Owner);
    }
}
export function carryOnWater(g: GameState, effect: Effect) {
  if (effect.Spread) return;
  for (const e of g.Enemies)
    if (g.Party?.Phase !== 'prepare' && e.State === EnemyState.Carried && e.CarriedBy === effect.ID) {
      e.X = effect.X;
      e.Y = effect.Y - 12;
      e.CarryTicks++;
      if (
        effect.Life <= 0 ||
        e.CarryTicks >= 3 * TPS ||
        e.Y > arenaHeight(g) - ActorSize
      )
        defeat(g, e, 2,effect.Owner);
    }
  for (const p of g.Players)
    if (
      alive(p) &&
      p.VY >= 0 &&
      intersects(p.X, p.Y, ActorSize, ActorSize, effect.X, effect.Y, 32, 32)
    ) {
      const x = effect.X,
        y = effect.Y - 12;
      if (!blocked(g, x, y, ActorSize)) {
        p.X = x;
        p.Y = y;
      }
    }
}
