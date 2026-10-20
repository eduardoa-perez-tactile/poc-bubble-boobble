import assert from 'node:assert/strict';

export const deferredBrowserCommand = [process.execPath, 'tools/web/smoke.mjs'];
export const browserDeferralReason = 'Browser gameplay playtesting is reserved for the user, as explicitly requested in this deployment task and in PROJECT.md/docs/git-workflow.md.';

/** A deliberate browser-playtest deferral never excuses stale artifacts or failed engine checks. */
export function validateReleaseEvidence({ sha, build, native, parity, browser, deferBrowserPlaytest = false }) {
  assert.equal(build.sha, sha, 'Rebuild this commit before publishing');
  assert.equal(build.dirty, false, 'The exported build must come from a clean checkout');
  for (const [lane, evidence] of Object.entries({ native, parity, browser })) {
    assert.equal(evidence.sha, sha, `${lane} evidence is stale`);
    if (lane !== 'browser') assert.equal(evidence.ok, true, `${lane} did not pass`);
  }
  if (browser.ok === true) return { browserDeferred: false };
  assert.equal(deferBrowserPlaytest, true, 'Browser acceptance did not pass; an explicitly recorded playtest deferral requires --defer-browser-playtest');
  assert.equal(browser.ok, false, 'Deferred browser acceptance must not be marked as passed');
  assert.equal(browser.status, 'deferred', 'A failed browser test cannot be treated as deferred');
  assert.equal(browser.reason, browserDeferralReason, 'Browser deferral must cite the project playtest restriction');
  assert.deepEqual(browser.deferredCommand, deferredBrowserCommand, 'Unexpected deferred browser command');
  return { browserDeferred: true };
}
