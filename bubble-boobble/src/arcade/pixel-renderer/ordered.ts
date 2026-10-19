import { meshes } from "@gameengine/runtime";
import pixels from "../../../assets/pixel-renderer/pixels.json";
import { pixelRect } from "./index.ts";
import {framePalette,paletteColor,sourceFrame} from './palettes.ts';
import type { PixelQuad } from "./types.ts";
interface Source {
  width: number;
  height: number;
  pixels: readonly number[];
  partial: boolean;
}
const sources: Readonly<Record<string, Source>> = pixels;
// Immutable import-derived metadata, not frame history. A source texel covers at
// most ceil(scaleX)*ceil(scaleY) logical pixels, each needing at most one run.
const partialTexels: Readonly<Record<string, number>> = Object.fromEntries(
  Object.entries(sources).filter(([, s]) => s.partial).map(([name, s]) => [
    name, s.pixels.reduce((n, alpha, index) => n + (index % 4 === 3 && alpha > 0 && alpha < 255 ? 1 : 0), 0),
  ]),
);
export interface PixelClip {left:number;top:number;right:number;bottom:number}
const canvasClip:PixelClip={left:0,top:0,right:768,bottom:720};
export function orderedCapacity(draws: readonly PixelQuad[],clip:PixelClip=canvasClip): number {
  let count = 0;
  for (const q of draws) {
    if (!q.image || q.w <= 0 || q.h <= 0 || q.x >= clip.right || q.y >= clip.bottom || q.x + q.w <= clip.left || q.y + q.h <= clip.top) continue;
    count++;
    const key = sourceFrame(q.image), partial = partialTexels[key];
    if (partial) {
      const source = sources[key]!;
      count += partial * Math.ceil(q.w / source.width) * Math.ceil(q.h / source.height);
    }
  }
  return Math.min(65536, count);
}
// Fully rewritten scratch buffers: no presentation history or authoritative state.
const MAX_VERTICES = 262144;
const positions = new Float32Array(MAX_VERTICES * 3),
  uvs = new Float32Array(MAX_VERTICES * 2),
  colors = new Uint8Array(MAX_VERTICES * 4),
  indices = new Uint32Array((MAX_VERTICES / 4) * 6),
  normals = new Float32Array(MAX_VERTICES * 3);
const contributors = new Uint32Array(4096);
const black = 0xff000000,
  ink = 0xff1b0c08,
  panel = 0xff311d13;
export function solidColor(image: string): number | undefined {
  if (!/^solid\/#[0-9a-f]{6}$/i.test(image)) return undefined;
  const n = parseInt(image.slice(7), 16);
  return ((n >>> 16) | (n & 0xff00) | ((n & 255) << 16) | 0xff000000) >>> 0;
}
function sample(q: PixelQuad, x: number, y: number): number {
  if (x < q.x || y < q.y || x >= q.x + q.w || y >= q.y + q.h) return 0;
  const solid = solidColor(q.image);
  if (solid !== undefined) return solid;
  if (q.image === "solid/black") return black;
  if (q.image === "solid/ink") return ink;
  if (q.image === "solid/panel") return panel;
  const s = sources[sourceFrame(q.image)];
  if (!s) return 0;
  let sx = Math.floor(((x - q.x) * s.width) / q.w);
  if (q.flip) sx = s.width - 1 - sx;
  const sy = Math.floor(((y - q.y) * s.height) / q.h),
    at = (sy * s.width + sx) * 4,
    p = s.pixels;
  return paletteColor(
    (p[at]! | (p[at + 1]! << 8) | (p[at + 2]! << 16) | (p[at + 3]! << 24)) >>> 0,
    framePalette(q.image),
  );
}
// Ebiten uploads premultiplied 8-bit texels. Each draw stores its rounded result
// before a subsequent sprite draws, rather than blending in linear-light sRGB.
export function composedColorAt(
  draws: readonly PixelQuad[],
  last: number,
  x: number,
  y: number,
): number {
  let count = 0;
  for (let index = last; index >= 0; index--) {
    const c = sample(draws[index]!, x, y),
      a = c >>> 24;
    if (a === 0) continue;
    if (count === contributors.length)
      throw new Error("pixel contributor capacity exceeded");
    contributors[count++] = c;
    if (a === 255) break;
  }
  let r = 8,
    g = 12,
    b = 27;
  while (count) {
    const c = contributors[--count]!,
      a = c >>> 24,
      t = (255 - a) / 255;
    r = Math.min(255, Math.round((c & 255) + r * t));
    g = Math.min(255, Math.round(((c >>> 8) & 255) + g * t));
    b = Math.min(255, Math.round(((c >>> 16) & 255) + b * t));
  }
  return (r | (g << 8) | (b << 16) | 0xff000000) >>> 0;
}
export function orderedArrays(
  draws: readonly PixelQuad[],
  scale = 1,
  originX = 0,
  originY = 0,
  clip:PixelClip=canvasClip,
) {
  let vertex = 0,
    indexCount = 0,
    partialRuns = 0;
  const quad = (
    x: number,
    y: number,
    w: number,
    h: number,
    z: number,
    rect: readonly number[],
    color = 0xffffffff,
  ) => {
    const x0 = Math.max(clip.left, x),
      y0 = Math.max(clip.top, y),
      x1 = Math.min(clip.right, x + w),
      y1 = Math.min(clip.bottom, y + h);
    if (x0 >= x1 || y0 >= y1) return;
    if (rect.length && (x0 !== x || y0 !== y || x1 !== x + w || y1 !== y + h))
      rect = [
        rect[0]! + ((x0 - x) / w) * rect[2]!,
        rect[1]! + ((y0 - y) / h) * rect[3]!,
        (rect[2]! * (x1 - x0)) / w,
        (rect[3]! * (y1 - y0)) / h,
      ];
    x = x0;
    y = y0;
    w = x1 - x0;
    h = y1 - y0;
    if (vertex + 4 > MAX_VERTICES)
      throw new Error("pixel geometry capacity exceeded");
    const left = (x - originX) * scale,
      right = (x + w - originX) * scale,
      top = (720 - y - originY) * scale,
      bottom = (720 - y - h - originY) * scale;
    positions.set(
      [left, bottom, z, right, bottom, z, right, top, z, left, top, z],
      vertex * 3,
    );
    normals.set([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], vertex * 3);
    if (rect.length)
      uvs.set(
        [
          rect[0]! / 2048,
          (rect[1]! + rect[3]!) / 1024,
          (rect[0]! + rect[2]!) / 2048,
          (rect[1]! + rect[3]!) / 1024,
          (rect[0]! + rect[2]!) / 2048,
          rect[1]! / 1024,
          rect[0]! / 2048,
          rect[1]! / 1024,
        ],
        vertex * 2,
      );
    else uvs.fill(-1, vertex * 2, (vertex + 4) * 2);
    for (let v = vertex; v < vertex + 4; v++) {
      const at = v * 4;
      colors[at] = color & 255;
      colors[at + 1] = (color >>> 8) & 255;
      colors[at + 2] = (color >>> 16) & 255;
      colors[at + 3] = 255;
    }
    indices.set(
      [vertex, vertex + 1, vertex + 2, vertex, vertex + 2, vertex + 3],
      indexCount,
    );
    vertex += 4;
    indexCount += 6;
  };
  for (let index = 0; index < draws.length; index++) {
    const q = draws[index]!;
    if (!q.image || q.w <= 0 || q.h <= 0) continue;
    const rect = pixelRect(q.image, q.flip),
      z = index * 0.001;
    const solid = solidColor(q.image);
    quad(q.x, q.y, q.w, q.h, z, solid === undefined ? rect : [], solid);
    if (!sources[sourceFrame(q.image)]?.partial) continue;
    const x0 = Math.max(Math.ceil(clip.left), Math.ceil(q.x - 0.5)),
      x1 = Math.min(Math.ceil(clip.right), Math.ceil(q.x + q.w - 0.5)),
      y0 = Math.max(Math.ceil(clip.top), Math.ceil(q.y - 0.5)),
      y1 = Math.min(Math.ceil(clip.bottom), Math.ceil(q.y + q.h - 0.5));
    for (let y = y0; y < y1; y++) {
      let start = -1,
        last = 0;
      const flush = (end: number) => {
        if (start >= 0) {
          quad(start, y, end - start, 1, z, [], last);
          partialRuns++;
          start = -1;
        }
      };
      for (let x = x0; x < x1; x++) {
        const a = sample(q, x + 0.5, y + 0.5) >>> 24;
        if (a === 0 || a === 255) {
          flush(x);
          continue;
        }
        const c = composedColorAt(draws, index, x + 0.5, y + 0.5);
        if (start >= 0 && last !== c) flush(x);
        if (start < 0) {
          start = x;
          last = c;
        }
      }
      flush(x1);
    }
  }
  return {
    arrays: {
      positions: positions.subarray(0, vertex * 3),
      normals: normals.subarray(0, vertex * 3),
      uvs: uvs.subarray(0, vertex * 2),
      colors: colors.subarray(0, vertex * 4),
      indices: indices.subarray(0, indexCount),
    },
    vertices: vertex,
    partialRuns,
  };
}
export function updateOrderedPixels(
  name: string,
  draws: readonly PixelQuad[],
  scale = 1,
  originX = 0,
  originY = 0,
) {
  const result = orderedArrays(draws, scale, originX, originY);
  if (meshes.info(name)) meshes.update(name, result.arrays);
  else meshes.create(name, result.arrays);
  return {
    key: "dynamic:" + name,
    vertices: result.vertices,
    partialRuns: result.partialRuns,
  };
}
