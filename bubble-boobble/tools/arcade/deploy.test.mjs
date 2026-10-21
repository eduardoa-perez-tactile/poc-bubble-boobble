import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deploymentSlug, deployRelease } from './deploy.mjs';
import { digest } from './release.mjs';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'arcade-deploy-')); t.after(() => rmSync(root, { recursive: true, force: true }));
  const zip = join(root, 'release.zip'), bytes = Buffer.from('intercepted upload fixture');
  writeFileSync(zip, bytes); writeFileSync(`${zip}.json`, JSON.stringify({ ok: true, revision: 'a'.repeat(40), zipSha256: digest(bytes) }));
  return zip;
}
test('generated update URLs fit the managed limit and distinguish repeat deployments', () => {
  const date = new Date('2026-10-20T12:30:00Z'), prefix = 'a'.repeat(48);
  const a = deploymentSlug(prefix, 'a'.repeat(40), date, 'abcd'), b = deploymentSlug(prefix, 'a'.repeat(40), date, '1234');
  assert.ok(a.length <= 48); assert.notEqual(a, b); assert.match(a, /aaaaaaa-20261020t123000-abcd$/);
  assert.throws(() => deploymentSlug('../bad', 'a'.repeat(40)));
});
test('deploy uploads once, waits for published, then checks files and journals evidence', async t => {
  const zip = fixture(t), calls = [], records = []; let poll = 0, uploads = 0;
  const result = await deployRelease({ slug: 'new-game', zip }, {
    publishRelease: async () => { uploads++; }, sleep: async () => {}, record: value => records.push(value),
    call: async name => {
      calls.push(name);
      return name === 'publication_status' ? { status: ++poll === 1 ? 'queued' : 'published' } : { entryStatus: 200, fileCheckPassed: true, missingFiles: [] };
    },
  });
  assert.equal(uploads, 1); assert.deepEqual(calls, ['publication_status', 'publication_status', 'check_game']);
  assert.equal(records[0].state, 'uploading'); assert.equal(records[1].state, 'queued');
  assert.equal(result.url, 'https://webgames.tactilews.com/new-game/'); assert.equal(result.socket, 'wss://webgames.tactilews.com/new-game/socket');
  assert.equal(result.browserVerified, false); assert.equal(result.build.revision, 'a'.repeat(40));
});
test('corrupted release fails before any upload or status call', async t => {
  const zip = fixture(t); writeFileSync(zip, 'changed');
  await assert.rejects(deployRelease({ slug: 'new-game', zip }, { publishRelease: () => assert.fail('upload called'), call: () => assert.fail('status called') }), /matching verified/);
});
test('resume never uploads or prepares another server and surfaces terminal failure', async () => {
  const calls = [];
  await assert.rejects(deployRelease({ slug: 'existing-game', resume: true }, {
    publishRelease: () => assert.fail('resume uploaded'), call: async name => { calls.push(name); return { status: 'failed', error: 'server startup failed' }; },
  }), /server startup failed/);
  assert.deepEqual(calls, ['publication_status']);
});
test('timeout retains a resumable publication without claiming success', async () => {
  let clock = 0;
  await assert.rejects(deployRelease({ slug: 'existing-game', resume: true, timeoutMs: 1000 }, {
    now: () => clock, sleep: async ms => { clock += ms; }, call: async () => ({ status: 'queued' }),
  }), /may still publish.*--resume existing-game/);
});
test('published address with missing files is not a successful deployment', async () => {
  await assert.rejects(deployRelease({ slug: 'existing-game', resume: true }, {
    call: async name => name === 'publication_status' ? { status: 'published' } : { entryStatus: 200, fileCheckPassed: false, missingFiles: ['player.js'] },
  }), /file checks failed.*player.js/);
});
