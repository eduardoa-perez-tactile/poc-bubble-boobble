import { arenaWidth, arenaHeight } from './types';
import {
  ActorSize,
  EnemyState,
  type GameState,
  TPS,
  Tile,
  alive,
  body,
  direction,
} from "./types";
import { blocked, moveActor, moveFlying } from "./physics";
import { target } from "./player";
import { spawnFood } from "./items";
import { goSin, goCos, goFMA } from "./trig";
export function updateEnemies(g: GameState) {
  for (const e of g.Enemies) {
    const t = target(g, e);
    e.Age++;
    if (e.State !== EnemyState.Active) continue;
    if (e.Cooldown > 0) e.Cooldown--;
    if (e.Shoot > 0) {
      e.Shoot--;
      continue;
    }
    const referenceSpeed = e.Angry ? 3.5 : 2.5;
    const movementScale = e.Angry ? 1 : (g.NormalEnemySpeedScale ?? 0.8);
    let speed = referenceSpeed * movementScale;
    switch (e.Kind) {
      case "monsta":
        moveFlying(g, e, e.Dir * speed, e.Vertical * speed);
        break;
      case "pulpul":
        e.Phase += 0.035;
        moveFlying(
          g,
          e,
          e.Dir * (goFMA(Math.abs(goSin(e.Phase)), referenceSpeed, 1.4) * movementScale),
          e.Vertical * (goFMA(Math.abs(goCos(2 * e.Phase)), referenceSpeed, 0.7) * movementScale),
        );
        break;
      default:
        if (e.Kind === "invader") speed *= 1.5;
        if (e.Ground) {
          switch (e.Kind) {
            case "banebou":
              e.VY = e.Angry ? -10 : -7.5;
              break;
            case "zenchan":
            case "mighta":
              if (e.Cooldown === 0 && t.Y < e.Y - Tile) {
                e.VY = -11.5;
                e.Dir = direction(t.X - e.X);
                e.Cooldown = 60;
              }
              break;
          }
        }
        if (
          e.Kind === "mighta" &&
          e.Cooldown === 0 &&
          Math.abs(e.Y - t.Y) < Tile &&
          alive(t)
        ) {
          e.Dir = direction(t.X - e.X);
          g.Projectiles.push({
            ...body(e.X + 20 + e.Dir * 24, e.Y + 14),
            VX: e.Dir * 6,
            Laser: false,
            Age: 0,
            Removed: false,
          });
          e.Cooldown = 180;
          e.Shoot = 30;
        }
        if (e.Kind === "invader" && e.Cooldown === 0) {
          g.Projectiles.push({
            ...body(e.X + 16, e.Y + ActorSize),
            VY: 6,
            Laser: true,
            Age: 0,
            Removed: false,
          });
          e.Cooldown = 180;
          e.Shoot = 12;
          g.Sounds.push("laser");
        }
        const oldX = e.X;
        moveActor(g, e, e.Dir * speed, true);
        if (Math.abs(e.X - oldX) < 0.01) e.Dir *= -1;
    }
  }
}
export function updateDefeated(g: GameState) {
  for (const e of g.Enemies)
    if (e.State === EnemyState.Defeated && e.DeadTicks > 0) {
      e.DeadTicks--;
      e.X += e.VX;
      e.Y += e.VY;
      e.VY += 0.45;
      if (e.DeadTicks === 0) spawnFood(g, e.X, e.Y);
    }
}
export function updateProjectiles(g: GameState) {
  g.Projectiles = g.Projectiles.filter((p) => {
    p.Age++;
    const steps = Math.max(
      1,
      Math.ceil(Math.max(Math.abs(p.VX), Math.abs(p.VY))),
    );
    for (let i = 0; i < steps; i++) {
      p.X += p.VX / steps;
      p.Y += p.VY / steps;
      if ((p.Bottle ? p.X<2*Tile || p.X>arenaWidth(g)-2*Tile || p.Y<Tile : blocked(g, p.X, p.Y, 16)) || p.Y > arenaHeight(g)) {
        p.Removed = true;
        break;
      }
    }
    return !p.Removed && p.Age < 5 * TPS;
  });
}
