import { worldTest } from '@gameengine/test';
import { goSin, goCos, goFMA } from '../src/arcade/trig.ts';
import {createRNG, uint64, float64, intN} from '../src/arcade/rng.ts';
import fixture from './fixtures/math-go-trig.expected.json';
import fmas from './fixtures/math-go-fma.expected.json';
import rng0 from './fixtures/math-go-rng-0.expected.json';
import rng42 from './fixtures/math-go-rng-42.expected.json';
import rngMax from './fixtures/math-go-rng-9007199254740991.expected.json';
worldTest('arcade Go float64 trigonometry exact study', () => {
  for (const f of fixture.frames) {
    const {X,Sin,Cos} = f.state;
    if(goSin(X) !== Sin || goCos(X) !== Cos) throw new Error(`Go trig differs at ${X}: sin ${goSin(X)} / ${Sin}; cos ${goCos(X)} / ${Cos}`);
  }
  if (!Object.is(goSin(-0), -0) || goCos(-0) !== 1 || !Number.isNaN(goSin(Infinity)) || !Number.isNaN(goCos(NaN))) throw new Error('trig special values differ');
}, { scene:'scenes/main.scene.json' });
worldTest('arcade Go fused float64 arithmetic exact study', () => {
  for (const f of fmas.frames) {
    const {A,B,C,Result} = f.state;
    if(goFMA(A,B,C) !== Result) throw new Error(`FMA differs at ${A} * ${B} + ${C}: ${goFMA(A,B,C)} / ${Result}`);
  }
  if (!Object.is(goFMA(-0,1,-0), -0)) throw new Error('FMA negative zero differs');
}, { scene:'scenes/main.scene.json' });
worldTest('arcade Go PCG exact seeded distributions and state', () => {
  for (const [seed, fixture] of [[0,rng0],[42,rng42],[9007199254740991,rngMax]] as const) {
    const rng=createRNG(seed);
    for (const f of fixture.frames) {
      const expected=f.state;
      const u=uint64(rng).toString(16), v=float64(rng), n=intN(rng,expected.N);
      if (u!==expected.Uint64 || v!==expected.Float64 || n!==expected.IntN || rng.RNG!==expected.RNG) throw new Error(`PCG differs: seed ${seed} draw ${f.frame}`);
      // A JSON round trip must preserve the next draw exactly (save/replay boundary).
      const restored=JSON.parse(JSON.stringify(rng));
      const copy={...rng};
      if (uint64(restored)!==uint64(copy) || restored.RNG!==copy.RNG) throw new Error('PCG restore differs');
    }
  }
}, { scene:'scenes/main.scene.json' });
