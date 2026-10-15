import atlas from "../../../assets/pixel-renderer/atlas-layout.json";
import {framePalette,sourceFrame} from './palettes.ts';
export function pixelRect(
  image: string,
  flip = false,
): [number, number, number, number] {
  const r = (atlas.rects as Record<string, number[]>)[sourceFrame(image)];
  if (!r) return [0, 0, 0, 0];
  const x = r[0]! + framePalette(image) * atlas.width;
  return flip
    ? [x + r[2]!, r[1]!, -r[2]!, r[3]!]
    : [x, r[1]!, r[2]!, r[3]!];
}
