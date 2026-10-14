// Presentation follows pinned internal/app/render.go. It never changes match state.
import {
  defineSystem,
  query,
  read,
  write,
  LocalTransform,
  VisualOffset,
  Sprite,
  Text2D,
  Shape,
  WorldView,
} from "@gameengine/runtime";
import { ArcadeControl, ArcadeVisual } from "../schema.gen.ts";
import { desktopState } from "../desktop/state.ts";
import { desktopSaveState } from "../desktop/save.ts";
import manifest from "../../data/sprites.json";
import { session } from "./session.ts";
import { EnemyState, position } from "./types.ts";
import type { GameState, Level } from "./types.ts";

const TILE_SLOTS = 32 * 26;
const TILE_BASE = 3; // board backdrop plus top and bottom ink bars
const animations: Readonly<Record<string, readonly string[]>> = manifest;
export function referenceFrame(name: string, tick: number): string {
  const paths = animations[name];
  const path = paths?.[Math.floor(Math.max(0, tick) / 10) % paths.length];
  return path
    ? "reference/" + path.replace(/^sprites\//, "").replace(/\.png$/, "")
    : "";
}
interface Draw {
  image: string;
  x: number;
  y: number;
  w: number;
  h: number;
  flip: boolean;
  text: string;
  size: number;
  footer?: boolean;
}
const image = (
  name: string,
  tick: number,
  x: number,
  y: number,
  w: number,
  h = w,
  dir = -1,
): Draw => ({
  image: referenceFrame(name, tick),
  x,
  y,
  w,
  h,
  flip: dir > 0,
  text: "",
  size: 0,
});
const label = (text: string, x: number, y: number, size: number): Draw => ({
  image: "",
  x,
  y,
  w: 0,
  h: 0,
  flip: false,
  text,
  size,
});
export function arcadeDrawPlan(g: GameState, avatar = "green"): Draw[] {
  if (g.Players.length === 2) avatar = "green";
  const out: Draw[] = [];
  for (const i of g.Items) {
    if (i.Age > 600 && i.Age % 12 < 6) continue;
    out.push(image(i.Power || `food/${i.Food}`, 0, i.X, i.Y + 48, 32));
  }
  for (const e of g.Enemies) {
    if (
      e.State === EnemyState.Trapped ||
      (e.State === EnemyState.Defeated && e.DeadTicks === 0)
    )
      continue;
    let state = e.Angry ? "angry" : "walk";
    if (e.Kind === "mighta" && e.Shoot > 0)
      state = e.Angry ? "shoot-angry" : "shoot";
    if (e.State === EnemyState.Defeated || e.State === EnemyState.Carried)
      state = "dead";
    out.push(image(e.Kind + "/" + state, e.Age, e.X, e.Y + 48, 48, 48, e.Dir));
  }
  for (const b of g.Bubbles) {
    let name = "bubble",
      tick = Math.min(b.Age, 30);
    if (b.Element) {
      name = b.Element + "-bubble";
      tick = b.Age;
    }
    if (b.Age > 450 && b.EnemyID === 0 && !b.Element) {
      name = "bubble-warning";
      tick = b.Age;
    }
    if (b.EnemyID !== 0) {
      const e = g.Enemies.find((e) => e.ID === b.EnemyID);
      if (e) {
        const state =
          b.CapturedAge > 1200
            ? "escape"
            : b.CapturedAge > 1000
              ? "warning"
              : "bubble";
        name = e.Kind + "/" + state;
        tick = b.Age;
      }
    }
    out.push(image(name, tick, b.X, b.Y + 48, 44));
  }
  for (const p of g.Projectiles)
    out.push(
      image(
        p.Laser ? "laser" : "boulder",
        p.Age,
        p.X,
        p.Y + 48,
        p.Laser ? 16 : 24,
        p.Laser ? 28 : 24,
      ),
    );
  for (const e of g.Effects)
    out.push(
      image(
        e.Element === "fire" && e.Ground ? "flame" : e.Element,
        e.Age,
        e.X,
        e.Y + 48,
        40,
        32,
        e.Dir,
      ),
    );
  for (let index = 0; index < g.Players.length; index++) {
    const p = g.Players[index]!;
    if (p.Lives === 0 && p.Dead === 0) continue;
    if (p.Invincible !== 0 && p.Invincible % 12 >= 6) continue;
    let state = "walk",
      tick = p.WalkFrame;
    if (!p.Ground) {
      state = "jump";
      tick = g.Tick;
    }
    if (p.Shoot > 0) {
      state = "shoot";
      tick = 12 - p.Shoot;
    }
    if (p.Dead > 0) {
      state = "dead";
      tick = 90 - p.Dead;
    }
    out.push(
      image(
        (index === 1 ? "blue" : avatar) + "/" + state,
        tick,
        p.X,
        p.Y + 48,
        48,
        48,
        p.Dir,
      ),
    );
  }
  for (const p of g.Particles)
    out.push(
      p.Text
        ? label(p.Text, p.X, p.Y + 48, 12)
        : image("pop", 0, p.X, p.Y + 48, 44),
    );
  out.push({ ...image(avatar + "/walk", 0, 20, 680, 28), footer: true });
  if (g.Players.length === 2)
    out.push({ ...image("blue/walk", 0, 126, 680, 28), footer: true });
  const p = g.Players[0];
  let x = 320;
  if (p)
    for (const [active, name] of [
      [p.Power.Pink, "pink_candy"],
      [p.Power.Blue, "blue_candy"],
      [p.Power.Yellow, "yellow_candy"],
      [p.Power.Shoes, "shoes"],
      [p.Power.Crystal, "crystal_ring"],
      [p.Power.Amethyst, "amethyst_ring"],
      [p.Power.Ruby, "ruby_ring"],
    ] as const)
      if (active) {
        out.push({ ...image(name, 0, x, 681, 24), footer: true });
        x += 26;
      }
  return out;
}
function editorDrawPlan(level: Level, avatar: string): Draw[] {
  const out: Draw[] = [];
  const spawn = (
    cell: { col: number; row: number },
    name: string,
    marker = "",
  ) => {
    const [px, py] = position(cell, 44),
      x = 24 + (px * 2) / 3,
      y = 146 + (py * 2) / 3;
    out.push(image(name, 0, x, y, 30));
    if (marker) out.push(label(marker, x, y - 9, 9));
  };
  for (const e of level.enemies) spawn(e, e.kind + "/walk");
  spawn(level.player, avatar + "/walk", "P");
  spawn(level.food_spawn, "food/1", "F");
  spawn(level.power_spawn, "pink_candy", "B");
  return out;
}
export const ArcadeBoot = defineSystem({
  name: "ArcadeBoot",
  query: query(read(ArcadeVisual)),
  resources: [write(ArcadeControl), write(WorldView)],
  runIf: { resource: ArcadeControl, field: "active", value: false },
  run(ctx, q) {
    if (!q.count) return;
    ctx.setField(ArcadeControl, "active", true);
    ctx.set(WorldView, {
      center: [384, 360],
      orthoSize: 360,
      designAspect: 768 / 720,
      fit: "Contain",
    });
  },
});
export const ArcadePool = defineSystem({
  name: "ArcadePool",
  after: ["ArcadeStep"],
  query: query(read(ArcadeVisual)),
  resources: [read(ArcadeControl)],
  runIf: { resource: ArcadeControl, field: "active", value: true },
  run(ctx, q) {
    const ui = desktopState.get(),
      s = session.get();
    let needed = 0;
    if (ui.screen === "editor")
      needed = TILE_BASE + TILE_SLOTS + ui.level.enemies.length + 6;
    else if (s.active && s.game) {
      const g = s.game;
      needed =
        TILE_BASE +
        TILE_SLOTS +
        g.Items.length +
        g.Enemies.length +
        g.Bubbles.length +
        g.Projectiles.length +
        g.Effects.length +
        g.Players.length +
        g.Particles.length +
        9;
    }
    let count = 0;
    for (const c of q.chunks())
      for (let i = 0; i < c.length; i++)
        count = Math.max(count, c.col(ArcadeVisual).slot[i]! + 1);
    for (let slot = count; slot < needed; slot++)
      ctx.commands.spawn({
        ArcadeVisual: { slot },
        LocalTransform: {},
        VisualOffset: {},
        Sprite: { visible: false },
        Shape: { visible: false },
        Text2D: { font: "reference/arcade", visible: false },
      });
  },
});
export const ArcadePresentation = defineSystem({
  name: "ArcadePresentation",
  stage: "LateUpdate",
  query: query(
    read(ArcadeVisual),
    write(VisualOffset),
    write(Sprite),
    write(Text2D),
    write(Shape),
  ),
  resources: [read(ArcadeControl)],
  runIf: { resource: ArcadeControl, field: "active", value: true },
  run(_ctx, q) {
    const ui = desktopState.get(),
      s = session.get(),
      save = desktopSaveState.get(),
      avatar = save.profiles[save.active]?.avatar ?? "green";
    const editor = ui.screen === "editor",
      game = s.active ? s.game : null;
    const level = editor ? ui.level : game?.Level;
    const draws = editor
      ? editorDrawPlan(ui.level, avatar)
      : game
        ? arcadeDrawPlan(game, avatar)
        : [];
    for (const c of q.chunks())
      for (let i = 0; i < c.length; i++) {
        const slot = c.col(ArcadeVisual).slot[i]!;
        if (c.col(Shape).visible[i]) c.set(Shape, i, { visible: false });
        if (!level) {
          if (c.col(Sprite).visible[i]) c.set(Sprite, i, { visible: false });
          if (c.col(Text2D).visible[i]) c.set(Text2D, i, { visible: false });
          continue;
        }
        if (slot < TILE_BASE) {
          const x = slot === 0 && editor ? 24 : 0,
            y = slot === 0 ? (editor ? 146 : 48) : slot === 1 ? 0 : 672,
            w = slot === 0 && editor ? 512 : 768,
            h = slot === 0 ? (editor ? 416 : 624) : 48;
          c.set(VisualOffset, i, { position: [x + w / 2, 720 - y - h / 2, 0] });
          c.set(Shape, i, {
            visible: slot === 0 || !editor,
            kind: "Rect",
            size: [w, h],
            color:
              slot === 0 ? (editor ? "#131d31ff" : "#000000ff") : "#080c1bff",
            softness: 0,
            order: slot === 0 ? -3 : 100000,
          });
          c.set(Sprite, i, { visible: false });
          c.set(Text2D, i, { visible: false });
          continue;
        }
        if (slot < TILE_BASE + TILE_SLOTS) {
          const index = slot - TILE_BASE,
            row = Math.floor(index / 32),
            col = index % 32,
            tile = level.tiles[row]?.[col] ?? 0;
          const size = editor ? 16 : 24,
            x = (editor ? 24 : 0) + col * size,
            y = (editor ? 146 : 48) + row * size;
          c.set(VisualOffset, i, {
            position: [x + size / 2, 720 - y - size / 2, 0],
          });
          c.set(Sprite, i, {
            visible: tile !== 0,
            image: `reference/tiles/${String(tile || 1).padStart(2, "0")}`,
            size: [size, size],
            anchor: [0.5, 0.5],
            flipX: false,
            order: slot,
          });
          c.set(Text2D, i, { visible: false });
          if (editor && tile === 0) {
            c.set(VisualOffset, i, {
              position: [x + size / 2 + 0.5, 720 - y - size / 2 - 0.5, 0],
            });
            c.set(Shape, i, {
              visible: true,
              kind: "Rect",
              size: [15, 15],
              color: "#000000ff",
              softness: 0,
              order: slot,
            });
          }
          continue;
        }
        const d = draws[slot - TILE_BASE - TILE_SLOTS];
        if (!d) {
          c.set(Sprite, i, { visible: false });
          c.set(Text2D, i, { visible: false });
          continue;
        }
        c.set(VisualOffset, i, {
          position: [d.x + d.w / 2, 720 - d.y - d.h / 2, 0],
        });
        c.set(Sprite, i, {
          visible: !!d.image,
          image: d.image || "reference/pop/0",
          size: [d.w, d.h],
          anchor: [0.5, 0.5],
          flipX: d.flip,
          order: d.footer ? 100001 + slot : slot,
        });
        c.set(Text2D, i, {
          visible: !!d.text,
          text: d.text,
          font: "reference/arcade",
          size: d.size,
          color: "#ffdc6aff",
          align: "Left",
          order: slot,
        });
      }
  },
});
