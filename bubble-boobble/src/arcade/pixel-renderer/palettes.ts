import animations from '../../../data/sprites.json';
import palettes from '../../../data/dragon-palettes.json';

// Immutable virtual frames share the original dragon/bubble texels and bounds.
// The U coordinate carries a palette index in whole2048-texel atlas widths;
// the shader strips it before integer texel sampling. No extra texture/batch.
const aliases: Readonly<Record<string, {source: string; palette: number}>> = Object.fromEntries(
  Object.values(palettes).flatMap(palette =>
    Object.entries(animations).filter(([name]) => name === palette.sourceAnimation || name.startsWith(palette.sourceAnimation+'/'))
      .flatMap(([, paths]) => paths.map(path => {
        const source = 'reference/' + path.replace(/^sprites\//,'').replace(/\.png$/,'');
        return [source.replace(`reference/${palette.sourceAnimation}/`,`reference/${palette.targetAnimation}/`),{source,palette:palette.id}];
      }))),
);
const packedSwaps: Readonly<Record<number, Readonly<Record<number,number>>>> = Object.fromEntries(
  Object.values(palettes).map(palette => [palette.id, Object.fromEntries(palette.swaps.map(swap => [
    swap.from[0]! | swap.from[1]! << 8 | swap.from[2]! << 16,
    swap.to[0]! | swap.to[1]! << 8 | swap.to[2]! << 16,
  ]))]),
);
export const sourceFrame = (image: string): string => aliases[image]?.source ?? image;
export const framePalette = (image: string): number => aliases[image]?.palette ?? 0;
export function paletteColor(rgba: number, palette: number): number {
  const replacement = packedSwaps[palette]?.[rgba & 0xffffff];
  return replacement === undefined ? rgba : ((rgba & 0xff000000) | replacement) >>> 0;
}
