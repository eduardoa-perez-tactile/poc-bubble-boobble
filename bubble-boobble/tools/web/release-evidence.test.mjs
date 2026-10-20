import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateReleaseEvidence, browserDeferralReason, deferredBrowserCommand } from './release-evidence.mjs';

const evidence = () => ({ sha: 'release-sha', build: { sha: 'release-sha', dirty: false }, native: { sha: 'release-sha', ok: true }, parity: { sha: 'release-sha', ok: true }, browser: { sha: 'release-sha', ok: true } });
const deferred = () => ({ sha: 'release-sha', ok: false, status: 'deferred', reason: browserDeferralReason, deferredCommand: deferredBrowserCommand });

test('fully verified releases publish without a deferral flag', () => {
  assert.deepEqual(validateReleaseEvidence(evidence()), { browserDeferred: false });
});
test('a recorded browser deferral is accepted only when explicitly selected', () => {
  const input = { ...evidence(), browser: deferred() };
  assert.throws(() => validateReleaseEvidence(input), /--defer-browser-playtest/);
  assert.deepEqual(validateReleaseEvidence({ ...input, deferBrowserPlaytest: true }), { browserDeferred: true });
});
test('an actual failed browser test cannot be relabeled by the publication flag', () => {
  assert.throws(() => validateReleaseEvidence({ ...evidence(), browser: { sha: 'release-sha', ok: false, error: 'Acceptance failed' }, deferBrowserPlaytest: true }), /cannot be treated as deferred/);
});
test('deferred browser checks never excuse failed native or wasm checks', () => {
  for (const lane of ['native', 'parity']) {
    const input = { ...evidence(), browser: deferred(), deferBrowserPlaytest: true };
    input[lane].ok = false;
    assert.throws(() => validateReleaseEvidence(input), new RegExp(`${lane} did not pass`));
  }
});
test('all evidence must match the exact clean exported commit', () => {
  for (const lane of ['build', 'native', 'parity', 'browser']) {
    const input = { ...evidence(), browser: deferred(), deferBrowserPlaytest: true };
    input[lane].sha = 'old-sha';
    assert.throws(() => validateReleaseEvidence(input), /Rebuild|stale/);
  }
  const input = evidence(); input.build.dirty = true;
  assert.throws(() => validateReleaseEvidence(input), /clean checkout/);
});
