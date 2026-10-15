import campaignPreviews from '../../data/levels.json';
import { partyCardRect } from '../desktop/layout';
import { partyColors, partyPrepareTicks } from './party-config';
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
import { dragonSkins, isDragonSkin } from "../desktop/skins.ts";
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
  if(name.startsWith('boss/')){
    const pose=name.slice(5),frames=pose==='move'||pose==='captured'?4:2;
    return `derived/boss/${pose}-${Math.floor(Math.max(0,tick)/10)%frames}`;
  }
  if (name === 'green/bubble') name = 'bubble';
  const prefix = name.split('/')[0]!;
  const bubbleSkin = isDragonSkin(prefix) && name === `${prefix}/bubble` ? prefix : '';
  const skin = ['red', 'yellow', 'purple', 'orange'].includes(prefix) ? prefix : '';
  const paths = animations[bubbleSkin ? 'bubble' : skin ? 'green/' + name.slice(skin.length + 1) : name];
  const path = paths?.[Math.floor(Math.max(0, tick) / 10) % paths.length];
  const frame = path
    ? "reference/" + path.replace(/^sprites\//, "").replace(/\.png$/, "")
    : "";
  return bubbleSkin ? frame.replace('reference/bubble/',`reference/${bubbleSkin}/bubble/`)
    : skin ? frame.replace('reference/green/',`reference/${skin}/`) : frame;
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
  color?: readonly [number, number, number];
}
const dragonIndicatorColors: Readonly<Record<string, readonly [number, number, number]>> = {
  green: [0,255,0], blue: [0,170,255], red: [255,0,0],
  yellow: [255,220,0], purple: [180,90,255], orange: [255,135,0],
};
const powerupTags: Readonly<Record<string, string>> = {
  thunder_potion:'THR', pink_candy: 'RNG', blue_candy: 'SPD', yellow_candy: 'RAP', shoes: 'RUN',
  clock: 'TIM', dynamite: 'BOM', orange_parasol: 'DEF', red_parasol: 'DEF',
  purple_parasol: 'DEF', crystal_ring: 'PTS', amethyst_ring: 'PTS', ruby_ring: 'PTS',
};
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
const label = (text: string, x: number, y: number, size: number, color?: readonly [number, number, number]): Draw => ({
  image: "",
  x,
  y,
  w: 0,
  h: 0,
  flip: false,
  text,
  size,
  color,
});
export function arcadeDrawPlan(g: GameState, avatar = "green"): Draw[] {
  const out: Draw[] = [];
  const skinAt = (index: number) => g.Party
    ? (isDragonSkin(g.Players[index]?.Skin) ? g.Players[index]!.Skin! : dragonSkins[index % dragonSkins.length]!)
    : index === 1 ? 'blue' : avatar;
  const entranceY = (target: number, index: number) => {
    if (g.Party?.Phase !== 'prepare') return target;
    const t = Math.max(0, Math.min(1, (partyPrepareTicks - g.Party.Timer - index % 6 * 5) / 60));
    return -48 + (target + 48) * (1 - (1 - t) * (1 - t));
  };
  if (g.Party) {
    for (const spawn of g.Party.Telegraphs ?? []) {
      out.push(image('bubble-warning', spawn.Ticks, spawn.X, spawn.Y + 48, 44));
      out.push(label('!', spawn.X + 16, spawn.Y + 38, 16));
    }
    const boss = g.Party.Boss;
    if (boss) {
      const captured=boss.Mode==='captured', y=entranceY(boss.Y+48,0);
      if(captured || !boss.Invulnerable || boss.Tick%4<2)
        out.push(image(captured?'boss/captured':boss.Mode==='windup'?'boss/attack':'boss/move',g.Party.Phase==='prepare'?g.Tick:boss.Tick,boss.X,y,96,96,boss.Dir));
      if(boss.Mode==='windup')out.push(label('!',boss.X+42,Math.max(68,boss.Y+32),20,[255,220,45]));
    }
  }
  for (const i of g.Items) {
    if (i.Power!=='thunder_potion' && i.Age > 600 && i.Age % 12 < 6) continue;
    out.push(fittedItemImage((i.Power==='thunder_potion'?'thunder-bubble':i.Power) || `food/${i.Food}`, 0, i.X, i.Y + 48, 32));
    if (g.Party && i.Power)
      out.push(label(powerupTags[i.Power] ?? 'PWR', Math.max(8, Math.min(728, i.X + 1)), Math.max(66, i.Y + 34), 10, [100,255,130]));
  }
  for (let index = 0; index < g.Enemies.length; index++) {
    const e = g.Enemies[index]!;
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
    out.push(image(e.Kind + "/" + state, g.Party?.Phase === 'prepare' ? g.Tick + index * 3 : e.Age, e.X, entranceY(e.Y + 48, index), 48, 48, e.Dir));
  }
  for (const b of g.Bubbles) {
    const bubbleSkin = skinAt(b.Shooter ?? 0);
    let name = bubbleSkin === 'green' ? 'bubble' : `${bubbleSkin}/bubble`,
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
        p.Bottle ? "boss/bottle" : p.Laser ? "laser" : "boulder",
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
    if (g.Party && p.Downed) {
      out.push(image(`${skinAt(index)}/bubble`, 30, p.X - 6, p.Y + 42, 60));
      out.push(image(`${skinAt(index)}/dead`, 0, p.X + 6, p.Y + 54, 36, 36, p.Dir));
      out.push(label(`${index + 1} HELP`, Math.max(8, Math.min(680, p.X - 8)), Math.max(66, Math.min(650, p.Y + 36)), 10, dragonIndicatorColors[skinAt(index)]));
      continue;
    }
    if (p.Lives === 0 && p.Dead === 0) continue;
    if (p.Invincible !== 0 && p.Invincible % 12 >= 6 && (!g.Party || g.Party.Phase==='combat' || g.Party.Phase==='boss')) continue;
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
        skinAt(index) + "/" + state,
        tick,
        p.X,
        p.Y + 48,
        48,
        48,
        p.Dir,
      ),
    );
    if (g.Party)
      out.push(label(`${index + 1}${g.Companions?.[index] ? ' AI' : ''}`, Math.max(8, Math.min(712, p.X + 8)), Math.max(66, Math.min(650, p.Y + 40)), 10, dragonIndicatorColors[skinAt(index)]));
  }
  for (const p of g.Particles)
    out.push(
      p.Text
        ? label(p.Text, p.X, p.Y + 48, 12)
        : image("pop", 0, p.X, p.Y + 48, 44),
    );
  if (g.Party) {
    for (let index = 0; index < 6; index++) {
      const p = g.Party.Slots[index] === 'empty' ? undefined : g.Players[index], x = 12 + index * 126;
      if (p) out.push({ ...image(`${skinAt(index)}/walk`, 0, x, 680, 28), footer: true });
      out.push({ ...label(p ? `${index + 1}${g.Companions?.[index] ? ' AI' : ''}` : `${index + 1} --`, x + 34, 684, 11, dragonIndicatorColors[skinAt(index)]), footer: true });
      if (p) out.push({ ...label(p.Downed ? 'HELP' : 'READY', x + 34, 702, 8, dragonIndicatorColors[skinAt(index)]), footer: true });
    }
    return out;
  }
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
    const plan = sceneDraws(ctx.step), needed = plan.texts.length + 1, pixelCount = orderedCapacity(plan.images);
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
  } else if(ui.screen==='modes') {
    for(let mode=0;mode<2;mode++) {
      const x=mode===0?100:396,y=168,level=campaignPreviews[0]!;
      solid('black',x+4,y+4,264,248);
      for(let row=0;row<26;row++)for(let col=0;col<32;col++)if(level.tiles[row]![col])images.push({image:`reference/tiles/${mode===0?'01':'03'}`,x:x+24+col*7,y:y+34+row*7,w:7,h:7});
      if(mode===0){
        push(image('green/walk',0,x+40,y+184,40));push(image('blue/walk',0,x+192,y+184,40,40,1));
        push(image('zenchan/walk',0,x+116,y+62,36));
        push(image('bubble',30,x+98,y+122,32));push(image('bubble',30,x+154,y+100,24));
      }else{
        push(image('mighta/angry',0,x+92,y+58,88));
        for(let i=0;i<6;i++)push(image(`${partyColors[i]}/walk`,0,x+28+i*36,y+188,32,32,i<3?1:-1));
        push(image('fire-bubble',0,x+34,y+88,32));push(image('thunder-bubble',0,x+206,y+100,32));
      }
    }
  } else if (ui.screen === 'party') {
    for(let index=0;index<6;index++) {
      const r=partyCardRect(index);
      solid('panel',r.x+3,r.y+30,r.width-6,134);
      const pose=ui.selected===index&&tick%180<35?tick%180:0;
      push(image(`${partyColors[index]}/walk`,pose,r.x+56,r.y+42,104,104,1));
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
    // The current title logo is a UI icon; original atlas texels remain reference evidence.
    for (let index = 0; index < partyColors.length; index++) {
      push(image(`${partyColors[index]}/walk`, tick, 88 + index * 104, 600, 72, 72, index < 3 ? 1 : -1));
    }
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
      !g.Party &&
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
        if (arrays.uvs[u]! < 0) {
          // Encoded source-over RGB must enter before the shader's sRGB decode;
          // MeshRenderer.color is a later linear tint, not a shader input.
          params[m] = -1;
          params[m + 1] = arrays.colors[k]! / 255;
          params[m + 2] = arrays.colors[k + 1]! / 255;
          params[m + 3] = arrays.colors[k + 2]! / 255;
        } else {
          params[m] = arrays.uvs[u]!;
          params[m + 1] = arrays.uvs[u + 5]!;
          params[m + 2] = arrays.uvs[u + 2]! - arrays.uvs[u]!;
          params[m + 3] = arrays.uvs[u + 1]! - arrays.uvs[u + 5]!;
        }
        colors[m] = colors[m + 1] = colors[m + 2] = colors[m + 3] = 1;
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
            let [r, g, b] = d.color ?? [255, 220, 106];
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
