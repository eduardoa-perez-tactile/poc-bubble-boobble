import atlas from "../../../assets/pixel-renderer/atlas.json";
export function pixelRect(
  image: string,
  flip = false,
): [number, number, number, number] {
  const r = (atlas.rects as Record<string, number[]>)[image];
  if (!r) return [0, 0, 0, 0];
  return flip
    ? [r[0]! + r[2]!, r[1]!, -r[2]!, r[3]!]
    : [r[0]!, r[1]!, r[2]!, r[3]!];
}
