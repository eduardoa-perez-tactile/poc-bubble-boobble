// Go math/rand/v2 PCG + Rand distributions. Go BSD license: assets/reference/GO-LICENSE.
// The encoded state is stored in the canonical sim resource, never module state.
export interface RNGState { RNG: string }
const mask = (1n << 64n) - 1n;
const multiplier = (2549297995355413924n << 64n) | 4865540595714422341n;
const increment = (6364136223846793005n << 64n) | 1442695040888963407n;
export function createRNG(seed: number | bigint): RNGState {
  const s = BigInt(seed) & mask;
  return { RNG: '7063673a' + s.toString(16).padStart(16, '0') + (s ^ 0xa0761d6478bd642fn).toString(16).padStart(16, '0') };
}
export function rngHex(rng: RNGState): string { return rng.RNG; }
export function uint64(rng: RNGState): bigint {
  if (!/^7063673a[0-9a-f]{32}$/.test(rng.RNG)) throw new Error('invalid PCG encoding');
  const state = BigInt.asUintN(128, BigInt('0x' + rng.RNG.slice(8)) * multiplier + increment);
  rng.RNG = '7063673a' + state.toString(16).padStart(32, '0');
  let hi = state >> 64n;
  const lo = state & mask;
  hi = BigInt.asUintN(64, (hi ^ (hi >> 32n)) * 0xda942042e4dd58b5n);
  return BigInt.asUintN(64, (hi ^ (hi >> 48n)) * (lo | 1n));
}
export function float64(rng: RNGState): number { return Number(uint64(rng) & ((1n << 53n) - 1n)) / 9007199254740992; }
export function intN(rng: RNGState, n: number): number {
  if (!Number.isSafeInteger(n) || n <= 0) throw new Error('invalid argument to IntN');
  const bound = BigInt(n);
  if ((bound & (bound - 1n)) === 0n) return Number(uint64(rng) & (bound - 1n));
  let product = uint64(rng) * bound;
  const threshold = (1n << 64n) % bound;
  while ((product & mask) < threshold) product = uint64(rng) * bound;
  return Number(product >> 64n);
}
