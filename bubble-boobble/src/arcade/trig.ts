// Binary64 fused multiply-add, with exact integer intermediate and ties-to-even rounding.
// Scratch bytes carry no sim state; every read follows a write.
const bits = new DataView(new ArrayBuffer(8));
function parts(x: number): [bigint, number] {
  bits.setFloat64(0, x);
  const b = bits.getBigUint64(0), exponent = Number((b >> 52n) & 2047n);
  const mantissa = (b & ((1n << 52n) - 1n)) | (exponent ? 1n << 52n : 0n);
  return [(b >> 63n) ? -mantissa : mantissa, exponent ? exponent - 1075 : -1074];
}
export function goFMA(a: number, b: number, c: number): number {
  if (Number.isNaN(a) || Number.isNaN(b) || Number.isNaN(c)) return NaN;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return a * b + c;
  if (!Number.isFinite(c)) return c;
  const [am, ae] = parts(a), [bm, be] = parts(b), [cm, ce] = parts(c);
  const pe = ae + be, e = Math.min(pe, ce);
  let n = (am * bm << BigInt(pe - e)) + (cm << BigInt(ce - e));
  if (n === 0n) return (Object.is(a * b, -0) && Object.is(c, -0)) ? -0 : 0;
  const negative = n < 0n;
  if (negative) n = -n;
  const length = n.toString(2).length;
  const shift = Math.max(0, length - 53, -1074 - e);
  if (shift) {
    const s = BigInt(shift), retained = n >> s, remainder = n - (retained << s), half = 1n << (s - 1n);
    n = retained + ((remainder > half || (remainder === half && (retained & 1n) !== 0n)) ? 1n : 0n);
  }
  const value = Number(n) * 2 ** (e + shift);
  return negative ? -value : value;
}
const piDigits = [0x1n,0x45f306dc9c882a53n,0xf84eafa3ea69bb81n,0xb6c52b3278872083n,0xfca2c757bd778ac3n,0x6e48dc74849ba5c0n,0x0c925dd413a32439n,0xfc3bd63962534e7dn,0xd1046bea5d768909n,0xd338e04d68befc82n,0x7323ac7306a673e9n,0x3908bf177bf25076n,0x3ff12fffbc0b301fn,0xde5e2316b414da3en,0xda6cfd9e4f96136en,0x9e8c7ecd3cbfd45an,0xea4f758fd7cbe2f6n,0x7a0e73ef14a525d4n,0xd7f6bf623f1aba10n,0xac06608df8f6d757n];
function reduce(x: number): [number, number] {
  const [ix, exp] = parts(x), digit = Math.floor((exp + 61) / 64), shift = BigInt((exp + 61) % 64);
  const word = (i: number): bigint => BigInt.asUintN(64, (piDigits[i]! << shift) | (piDigits[i + 1]! >> (64n - shift)));
  const z2hi = (word(digit + 2) * ix) >> 64n;
  const z1 = word(digit + 1) * ix;
  const sum = (z1 & ((1n << 64n) - 1n)) + z2hi;
  const lo = BigInt.asUintN(64, sum);
  let hi = BigInt.asUintN(64, word(digit) * ix + (z1 >> 64n) + (sum >> 64n));
  let j = Number(hi >> 61n);
  hi = BigInt.asUintN(64, (hi << 3n) | (lo >> 61n));
  const lz = 64 - hi.toString(2).length;
  hi = BigInt.asUintN(64, (hi << BigInt(lz + 1)) | (lo >> BigInt(63 - lz))) >> 12n;
  hi |= BigInt(1023 - (lz + 1)) << 52n;
  bits.setBigUint64(0, hi);
  let z = bits.getFloat64(0);
  if (j % 2) { j = (j + 1) & 7; z--; }
  return [j, z * (Math.PI / 4)];
}
// Go 1.26 math/sin.go (Cephes polynomial). Copyright The Go Authors.
// BSD license: assets/reference/GO-LICENSE. Preserve float64 operation order.
const sin = [1.58962301576546568060e-10,-2.50507477628578072866e-8,2.75573136213857245213e-6,-1.98412698295895385996e-4,8.33333333332211858878e-3,-1.66666666666666307295e-1];
const cos = [-1.13585365213876817300e-11,2.08757008419747316778e-9,-2.75573141792967388112e-7,2.48015872888517045348e-5,-1.38888888888730564116e-3,4.16666666666665929218e-2];
function trig(x: number, cosine: boolean): number {
  if (!Number.isFinite(x)) return NaN;
  if (x === 0) return cosine ? 1 : x;
  let sign = !cosine && x < 0;
  x = Math.abs(x);
  let j: number, z: number;
  if (x >= 536870912) [j, z] = reduce(x);
  else {
    j = Math.trunc(x * (4 / Math.PI));
    let y = j;
    if (j % 2 === 1) { j++; y++; }
    j %= 8;
    z = goFMA(-y, 7.85398125648498535156e-1, x);
    z = goFMA(-y, 3.77489470793079817668e-8, z);
    z = goFMA(-y, 2.69515142907905952645e-15, z);
  }
  if (j > 3) { j -= 4; sign = !sign; }
  if (cosine && j > 1) sign = !sign;
  const zz = z * z;
  const useCos = cosine ? j !== 1 && j !== 2 : j === 1 || j === 2;
  const coefficients = useCos ? cos : sin;
  let polynomial = coefficients[0]!;
  for (let i = 1; i < coefficients.length; i++) polynomial = goFMA(polynomial, zz, coefficients[i]!);
  const y = useCos ? goFMA(zz * zz, polynomial, goFMA(-0.5, zz, 1)) : goFMA(z * zz, polynomial, z);
  return sign ? -y : y;
}
export const goSin = (x: number): number => trig(x, false);
export const goCos = (x: number): number => trig(x, true);
