import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { compareTrace, difference } from './compare.mjs';

const fixture = JSON.parse(readFileSync('tests/fixtures/reference-round1-smoke.expected.json', 'utf8'));
test('exact comparison accepts repeated trace and object key reordering', () => {
  assert.equal(compareTrace(fixture, structuredClone(fixture)), null);
  assert.equal(difference({ a: 1, b: 2 }, { b: 2, a: 1 }), null);
});
test('first divergent tick includes the field, input and surrounding states', () => {
  const actual = structuredClone(fixture);
  actual.frames[65].state.Snapshot.Score = 100;
  const d = compareTrace(fixture, actual);
  assert.equal(d.frame, 65);
  assert.equal(d.path, '$.state.Snapshot.Score');
  assert.equal(d.expected, 0);
  assert.equal(d.actual, 100);
  assert.equal(d.input.players[0].Fire, true);
  assert.equal(d.expectedContext.length, 3);
});
test('missing fields, reordered actors, changed precision, and missing frames fail', () => {
  const actual = structuredClone(fixture);
  delete actual.frames[1].state.RNG;
  assert.ok(compareTrace(fixture, actual));
  assert.ok(difference([{ ID: 1 }, { ID: 2 }], [{ ID: 2 }, { ID: 1 }]));
  assert.ok(difference(0.1, 0.10000000001));
  assert.ok(difference(1, NaN));
  assert.throws(() => compareTrace({ frames: [] }, { frames: [] }), /Trace requires/);
  assert.throws(() => compareTrace({ ...fixture, frames: [] }, fixture), /initial state/);
  const short = structuredClone(fixture); short.frames.pop();
  assert.equal(compareTrace(fixture, short).frame, fixture.frames.length - 1);
});
test('real comparator command exits nonzero and writes a diagnostic on corruption', () => {
  const actual = structuredClone(fixture); actual.frames[65].state.Snapshot.Score++;
  mkdirSync('artifacts', { recursive: true });
  writeFileSync('artifacts/corrupt-trace.json', JSON.stringify(actual));
  const result = spawnSync(process.execPath, ['tools/harness/compare.mjs', 'tests/fixtures/reference-round1-smoke.expected.json', 'artifacts/corrupt-trace.json'], { encoding: 'utf8', env: { ...process.env, HARNESS_ARTIFACT_DIR: 'artifacts/selftest' } });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /frame 65.*Score/);
  assert.equal(JSON.parse(readFileSync('artifacts/selftest/first-divergence.json')).frame, 65);
});
test('fixture covers ready, movement, shooting and pause without ticking while paused', () => {
  assert.equal(fixture.frames.length, 89);
  assert.equal(fixture.frames[0].state.Snapshot.State, 0);
  assert.equal(fixture.frames[60].state.Snapshot.State, 1);
  assert.ok(fixture.frames[80].state.Snapshot.Bubbles.length > 0);
  assert.equal(fixture.frames[83].state.Snapshot.Tick, 80);
  assert.equal(fixture.frames[88].state.Snapshot.Tick, 85);
});

// Campaign audit exceptions are narrower than ordinary approximate comparison.
import { inspectCeilingBoundary, compareStudyPrefix } from './arcade-study.mjs';
function ceilingState() {
  return { Snapshot: { Players: [{ X: 100, Y: 24, VY: 0, Ground: false }], Score: 0 }, RNG: 'unchanged' };
}
test('campaign boundary permits only original Y24/VY0 versus rising above24 and does not mutate actual', () => {
  const expected = ceilingState(), actual = structuredClone(expected);
  actual.Snapshot.Players[0].Y = 15.5; actual.Snapshot.Players[0].VY = -8.5;
  const before = structuredClone(actual), boundary = inspectCeilingBoundary(expected, actual);
  assert.equal(boundary.residual, null);
  assert.deepEqual(boundary.players, [{ player: 0, expected: { Y: 24, VY: 0 }, actual: { Y: 15.5, VY: -8.5 } }]);
  assert.deepEqual(actual, before);
});
test('campaign boundary rejects wrong reference clamp, stationary/falling motion and nonfinite coordinates', () => {
  for (const patch of [{Y:24,VY:-1},{Y:20,VY:0},{Y:20,VY:1},{Y:-Infinity,VY:-1},{Y:20,VY:NaN}]) {
    const expected = ceilingState(), actual = structuredClone(expected);
    Object.assign(actual.Snapshot.Players[0],patch);
    assert.equal(inspectCeilingBoundary(expected,actual),null);
  }
  for (const patch of [{Y:23},{VY:1}]) {
    const expected = ceilingState(), actual = structuredClone(expected);
    Object.assign(expected.Snapshot.Players[0],patch);
    Object.assign(actual.Snapshot.Players[0],{Y:15,VY:-2});
    assert.equal(inspectCeilingBoundary(expected,actual),null);
  }
});
test('campaign boundary rejects collateral canonical changes including another player', () => {
  for (const change of [s => s.Snapshot.Score++, s => s.RNG='changed', s => s.Snapshot.Players[0].Ground=true, s => s.Snapshot.Players[0].X++]) {
    const expected = ceilingState(), actual = structuredClone(expected);
    Object.assign(actual.Snapshot.Players[0],{Y:15,VY:-2}); change(actual);
    assert.ok(inspectCeilingBoundary(expected,actual).residual);
    assert.ok(compareStudyPrefix([{frame:1,state:expected}],()=>actual).failure);
  }
  const expected=ceilingState(); expected.Snapshot.Players.push({X:200,Y:100,VY:1,Ground:false});
  const actual=structuredClone(expected); Object.assign(actual.Snapshot.Players[0],{Y:15,VY:-2}); actual.Snapshot.Players[1].Y++;
  assert.match(inspectCeilingBoundary(expected,actual).residual.path,/Players\[1\].Y/);
});
test('campaign prefix stops at first verified boundary without simulating or claiming later frames', () => {
  assert.throws(() => compareStudyPrefix([],()=>null), /initial state/);
  const expected=ceilingState(), actual=structuredClone(expected);
  Object.assign(actual.Snapshot.Players[0],{Y:15,VY:-2});
  const frames=[0,1,2].map(frame=>({frame,state:expected})); let calls=0;
  const result=compareStudyPrefix(frames,f=>{calls++; if(f.frame===2)throw new Error('suffix must not execute'); return f.frame===0?expected:actual;});
  assert.equal(calls,2); assert.equal(result.matchedFrames,1); assert.equal(result.boundary.frame,1); assert.equal(result.failure,null);
  const bad=structuredClone(expected);bad.Snapshot.Score++;
  const rejected=compareStudyPrefix(frames,()=>bad);
  assert.equal(rejected.matchedFrames,0);assert.equal(rejected.boundary,null);assert.equal(rejected.failure.frame,0);
});
