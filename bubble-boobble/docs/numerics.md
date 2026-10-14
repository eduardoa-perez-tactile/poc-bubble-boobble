# Reference numerical parity

The oracle is pinned to Go 1.26.9 on Darwin arm64. Its compiler emits fused
multiply-add instructions in `math.sin` / `math.cos`, including all three
range-reduction subtractions and Horner polynomial terms. A direct JavaScript
translation differed by one ULP at 0.75 radians. Native `Math.sin` / `Math.cos`
and the engine's own deterministic trigonometry are not the pinned algorithm.

`src/arcade/trig.ts` translates Go's Cephes polynomials and Payne-Hanek reduction.
`goFMA` computes the exact binary product and sum as integers, then rounds once
to binary64, ties to even. It handles finite intermediate overflow and gradual
underflow without using platform transcendental functions. The module's byte
scratch view is overwritten before each read and retains no simulation state.
Constants and reduction digits derive from the Go standard library; its BSD
license is retained at `assets/reference/GO-LICENSE`.

Cached exact comparisons cover 779 angles: gameplay phases, pi boundaries, both
signs, the large-reduction threshold, the maximum finite binary64 value, and an
exponent sweep including subnormals. Seven FMA cases cover cancellation,
intermediate overflow, subnormal rounding and exact zero. A separate reproducible
raw-bit sample (PCG seed 23, 10,000 draws, excluding three nonfinite values)
compared 9,997 finite angles against the live pinned oracle with no differences.
This sample is a numerical study, not an exhaustive proof over all binary64.

`src/arcade/rng.ts` implements Go `math/rand/v2` PCG128/DXSM. Its mutable holder
uses the oracle's `RNG` hexadecimal MarshalBinary representation, including the
`pcg:` prefix; the canonical resource serializes all generator state. `Float64`
uses the low 53 bits. `IntN` masks powers of two and uses Lemire multiply/reject
for other bounds. Cached cases compare 600 mixed Uint64/Float64/IntN sequences
at seeds 0, 42 and the largest safe integer, including state after every draw
sequence and JSON save/restore continuation.

Run `node tools/harness/numerics-study.mjs` to repeat the live raw-bit trig study
and an additional 10,000-draw finite-result FMA study.

Run `gameengine test --js v8 --filter '*Go*'` for the cached numerical tests.
`node tools/harness/arcade-parity.mjs` compares complete canonical pure-simulation
state to all cached non-math fixtures. This pure lane does not test engine input,
rendering, audio playback or persistence services. `math` / `rng` / `fma` oracle
modes only expose standard-library operations; they do not alter game rules.

The V8 host passes all three numerical tests. Hermes remains unavailable in this
environment, so cross-runtime execution has not been verified. Software FMA
allocates BigInts; measure representative gameplay before claiming a performance
budget. Go may also fuse arithmetic within gameplay expressions; trig parity
alone does not establish whole-game numerical parity.

## Campaign numerical study

`node tools/harness/arcade-study.mjs` audits 25 independently initialized rounds,
1,261 canonical frames each, PCG seed 42, alternating one/two players, movement
reversals, jumping and firing. All 31,525 snapshots currently compare exactly.
This first exposed one-ULP differences at bubble drift and Pulpul steering because
the Go compiler also fused multiply-add expressions in gameplay; the translated
simulation now preserves those fusion points. This study initializes every round
independently; it does not prove natural progression through all 25 rounds.

Cached combat traces for rounds 1, 10, 24 and 25 contain 361 frames each and
exercise floating bubbles, captures, death, Pulpul steering, the round-24 ceiling,
and a scored defeat. Exact comparison includes every canonical field and sound
event. Audio-device playback and visual similarity require separate checks.

The five cached canonical cases also pass through the engine's `ArcadeInput`
events and document state in `tests/arcade-input.test.ts`. The default quick lane
runs these together with movement and numerical tests; the live all-round and
random studies run separately through `npm run harness:milestone`. Fresh starter,
movement-keyboard and arcade-smoke replays verify with their explicit scenes.
These engine hashes supplement the Go comparisons and do not replace them.
