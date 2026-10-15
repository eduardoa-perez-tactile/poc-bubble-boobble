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
  MeshRenderer,
  MaterialGlobals,
  MaterialParams,
  Time,
  WorldView,
} from "@gameengine/runtime";
import { ArcadeControl, ArcadeVisual } from "../schema.gen.ts";
import { desktopState } from "../desktop/state.ts";
import { desktopSaveState } from "../desktop/save.ts";
import manifest from "../../data/sprites.json";
import atlas from "../../assets/pixel-renderer/atlas-layout.json";
import { session } from "./session.ts";
import { orderedArrays, orderedCapacity } from "./pixel-renderer/ordered.ts";
import type { PixelQuad } from "./pixel-renderer/types.ts";
import { EnemyState, position } from "./types.ts";
import type { GameState, Level } from "./types.ts";

// Pixel instances and pooled text have disjoint slots; never grow text to this base.
const PIXEL_SLOT_BASE = 65536;
const STATIC_QUAD = 'pixel-renderer/static-quad.gltf';
const PIXEL_MATERIAL = 'materials/pixel-ordered.mat.json';
const animations: Readonly<Record<string, readonly string[]>> = manifest;
const atlasRects: Readonly<Record<string, readonly number[]>> = atlas.rects;
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
// Deliberate improvement over Go's square stretch: keep item art's original
// aspect within its existing visual box. Simulation/collision boxes do not move.
export function fittedItemImage(name: string, tick: number, x: number, y: number, size: number): Draw {
  const draw = image(name, tick, x, y, size);
  const rect = atlasRects[draw.image];
  if (!rect) return draw;
  const width = rect[2]!, height = rect[3]!;
  if (width <= 0 || height <= 0) return draw;
  const scale = size / Math.max(width, height);
  draw.w = width * scale;
  draw.h = height * scale;
  draw.x += (size - draw.w) / 2;
  draw.y += (size - draw.h) / 2;
  return draw;
}
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
    out.push(fittedItemImage(i.Power || `food/${i.Food}`, 0, i.X, i.Y + 48, 32));
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
        out.push({ ...fittedItemImage(name, 0, x, 681, 24), footer: true });
        x += 26;
      }
  return out;
}
function editorDrawPlan(level: Level, avatar: string, tick = 0): Draw[] {
  const out: Draw[] = [];
  const spawn = (
    cell: { col: number; row: number },
    name: string,
    marker = "",
  ) => {
    const [px, py] = position(cell, 44),
      x = 24 + (px * 2) / 3,
      y = 146 + (py * 2) / 3;
    out.push(marker === "F" || marker === "B"
      ? fittedItemImage(name, tick, x, y, 30)
      : image(name, tick, x, y, 30));
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
    const ui = desktopState.get(), g = session.get().game;
    const needed = ui.screen === "editor"
      ? 4 : 1 + (g?.Particles.filter((p) => p.Text).length ?? 0);
    const plan = sceneDraws(ctx.step), pixelCount = orderedCapacity(plan.images);
    let count = 0, pixels = 0;
    for (const c of q.chunks()) for (let i = 0; i < c.length; i++) {
      const slot = c.col(ArcadeVisual).slot[i]!;
      if (slot >= PIXEL_SLOT_BASE) pixels = Math.max(pixels, slot - PIXEL_SLOT_BASE + 1);
      else count = Math.max(count, slot + 1);
    }
    for (let slot = count; slot < needed; slot++) ctx.commands.spawn({
      ArcadeVisual: { slot }, LocalTransform: {}, VisualOffset: {},
      Sprite: { visible: false }, Shape: { visible: false },
      Text2D: { font: "reference/arcade", visible: false },
    });
    for (let slot = pixels; slot < pixelCount; slot++) ctx.commands.spawn({
      ArcadeVisual: { slot: PIXEL_SLOT_BASE + slot },
      LocalTransform: {}, VisualOffset: {}, MaterialParams: {},
      MeshRenderer: {
        mesh: STATIC_QUAD, material: PIXEL_MATERIAL,
        castShadows: false, receiveShadows: false,
      },
    });
  },
});
function sceneDraws(tick: number) {
  const ui = desktopState.get(),
    s = session.get(),
    save = desktopSaveState.get(),
    avatar = save.profiles[save.active]?.avatar ?? "green";
  const images: PixelQuad[] = [],
    texts: Draw[] = [];
  const push = (d: Draw) => {
    if (d.text) texts.push(d);
    else if (d.image) images.push(d);
  };
  const solid = (name: string, x: number, y: number, w: number, h: number) =>
    images.push({ image: "solid/" + name, x, y, w, h });
  solid("ink", 0, 0, 768, 720);
  const editor = ui.screen === "editor",
    g =
      s.active && ["play", "pause", "result"].includes(ui.screen)
        ? s.game
        : null,
    level = editor ? ui.level : g?.Level;
  if (level) {
    solid(
      editor ? "panel" : "black",
      editor ? 24 : 0,
      editor ? 146 : 48,
      editor ? 512 : 768,
      editor ? 416 : 624,
    );
    for (let row = 0; row < 26; row++)
      for (let col = 0; col < 32; col++) {
        const tile = level.tiles[row]?.[col] ?? 0,
          size = editor ? 16 : 24,
          x = (editor ? 24 : 0) + col * size,
          y = (editor ? 146 : 48) + row * size;
        if (tile)
          images.push({
            image: `reference/tiles/${String(tile).padStart(2, "0")}`,
            x,
            y,
            w: size,
            h: size,
          });
        else if (editor) solid("black", x + 1, y + 1, 15, 15);
      }
    if (editor) editorDrawPlan(ui.level, avatar, tick).forEach(push);
    else if (g) {
      const actors = arcadeDrawPlan(g, avatar);
      actors.filter((d) => !d.footer).forEach(push);
      solid("ink", 0, 0, 768, 48);
      solid("ink", 0, 672, 768, 48);
      actors.filter((d) => d.footer).forEach(push);
    }
  } else if (ui.screen === "title" || ui.screen === "menu") {
    // Source rings are isolated on ink, never overlap, and precede the logo.
    for (let index = 0; index < 18; index++) {
      const radius = 8 + (index % 4) * 5,
        size = radius * 2 + 4,
        x = (index * 137 + 39) % 768,
        y = (((index * 91 - Math.floor(tick / 2)) % 720) + 720) % 720;
      images.push({
        image: `derived/circle/${index % 4}`,
        x: x - radius - 2,
        y: y - radius - 2,
        w: size,
        h: size,
      });
    }
    images.push({ image: "reference/logo", x: 209, y: 26, w: 350, h: 252 });
    push(image("green/walk", tick, 80, 550, 96, 96, 1));
    push(image("blue/walk", tick, 592, 550, 96, 96, -1));
  } else if (ui.screen === "profiles")
    for (let index = 0; index < save.profiles.length; index++)
      push(
        image(
          save.profiles[index]!.avatar + "/walk",
          tick,
          114,
          132 + index * 46,
          36,
          36,
          1,
        ),
      );
  else if (ui.screen === "settings")
    push(image(avatar + "/walk", tick, 336, 476, 96));
  return { images, texts };
}
export const ArcadePresentation = defineSystem({
  name: "ArcadePresentation",
  stage: "LateUpdate",
  queries: {
    visuals: query(
      read(ArcadeVisual),
      write(VisualOffset),
      write(Sprite),
      write(Text2D),
      write(Shape),
    ),
    mesh: query(read(ArcadeVisual), write(MeshRenderer), write(VisualOffset), write(MaterialParams)),
  },
  resources: [read(ArcadeControl), read(Time), write(MaterialGlobals)],
  runIf: { resource: ArcadeControl, field: "active", value: true },
  run(ctx, q) {
    const plan = sceneDraws(ctx.get(Time).step),
      ui = desktopState.get(),
      g = session.get().game;
    const fade =
      ui.screen === "pause"
        ? 195 / 255
        : ui.screen === "result"
          ? 220 / 255
          : 0;
    const banner =
      !!g &&
      (ui.screen === "play" || ui.screen === "pause" || ui.screen === "result") &&
      (g.State === 0 ||
        g.State === 2 ||
        (g.Hurry && g.State === 1 && g.LevelTicks < 1980 && g.Tick % 30 < 24));
    const bannerTop = g?.State === 2 ? 84 : 240;
    ctx.set(MaterialGlobals, { v0: [fade, bannerTop, banner ? 1 : 0, 0] });
    // File meshes upload on the cold live viewport path; dynamic meshes in this
    // installed runtime upload only after an offscreen screenshot. One static
    // unit quad is instanced, with the same ordered positions and source pixels.
    const geometry = orderedArrays(plan.images), arrays = geometry.arrays;
    for (const c of q.mesh.chunks()) {
      const slots = c.col(ArcadeVisual).slot;
      const offsets = c.col(VisualOffset);
      const params = c.col(MaterialParams).params;
      const colors = c.col(MeshRenderer).color;
      for (let i = 0; i < c.length; i++) {
        const quad = slots[i]! - PIXEL_SLOT_BASE, t = i * 3, m = i * 4;
        if (quad < 0 || quad >= geometry.vertices / 4) {
          offsets.scale[t] = offsets.scale[t + 1] = offsets.scale[t + 2] = 0;
          continue;
        }
        const p = quad * 12, u = quad * 8, k = quad * 16;
        const x0 = arrays.positions[p]!, y0 = arrays.positions[p + 1]!;
        const x1 = arrays.positions[p + 6]!, y1 = arrays.positions[p + 7]!;
        offsets.position[t] = (x0 + x1) / 2;
        offsets.position[t + 1] = (y0 + y1) / 2;
        offsets.position[t + 2] = arrays.positions[p + 2]!;
        offsets.scale[t] = x1 - x0;
        offsets.scale[t + 1] = y1 - y0;
        offsets.scale[t + 2] = 1;
        params[m] = arrays.uvs[u]!;
        params[m + 1] = arrays.uvs[u + 5]!;
        params[m + 2] = arrays.uvs[u + 2]! - arrays.uvs[u]!;
        params[m + 3] = arrays.uvs[u + 1]! - arrays.uvs[u + 5]!;
        colors[m] = arrays.colors[k]! / 255;
        colors[m + 1] = arrays.colors[k + 1]! / 255;
        colors[m + 2] = arrays.colors[k + 2]! / 255;
        colors[m + 3] = 1;
      }
    }
    for (const c of q.visuals.chunks())
      for (let i = 0; i < c.length; i++) {
        const slot = c.col(ArcadeVisual).slot[i]!;
        if (c.col(Sprite).visible[i]) c.set(Sprite, i, { visible: false });
        if (c.col(Shape).visible[i]) c.set(Shape, i, { visible: false });
        if (slot === 0) {
          c.set(VisualOffset, i, {
            position: [0, 0, 0],
            scale: plan.images.length ? [1, 1, 1] : [0, 0, 0],
          });
          if (c.col(Text2D).visible[i]) c.set(Text2D, i, { visible: false });
          continue;
        }
        const d = plan.texts[slot - 1];
        if (!d) {
          if (c.col(Text2D).visible[i]) c.set(Text2D, i, { visible: false });
          continue;
        }
        c.set(VisualOffset, i, {
          position: [d.x, 720 - d.y, 0],
          scale: [1, 1, 1],
        });
        c.set(Text2D, i, {
          visible: true,
          text: d.text,
          font: "reference/arcade",
          size: d.size,
          color: (() => {
            let r = 255,
              g = 220,
              b = 106;
            if (
              banner &&
              d.x >= 108 &&
              d.x < 660 &&
              d.y >= bannerTop &&
              d.y < bannerTop + 82
            ) {
              r = 8 + (r * 25) / 255;
              g = 12 + (g * 25) / 255;
              b = 27 + (b * 25) / 255;
            }
            return (
              "#" +
              [r, g, b]
                .map((v) =>
                  Math.max(0, Math.min(255, Math.round(v * (1 - fade))))
                    .toString(16)
                    .padStart(2, "0"),
                )
                .join("") +
              "ff"
            );
          })(),
          align: "Left",
          order: slot,
        });
      }
  },
});
