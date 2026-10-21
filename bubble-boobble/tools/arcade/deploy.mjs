#!/usr/bin/env node
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { origin, publish, rpc, validSlug, verifiedRelease } from './client.mjs';
import { packageExports } from './release.mjs';

export function deploymentSlug(prefix, revision, date = new Date(), nonce = randomBytes(2).toString('hex')) {
  validSlug(prefix);
  if (!/^[a-f0-9]{40}$/.test(revision ?? '')) throw new Error('A verified source revision is required.');
  const stamp = date.toISOString().replace(/[-:]/g, '').slice(0, 15).toLowerCase();
  const suffix = `-${revision.slice(0, 7)}-${stamp}-${nonce}`;
  return validSlug(prefix.slice(0, 48 - suffix.length).replace(/-+$/, '') + suffix);
}

/** Upload once; resuming polls the same publication and never allocates a second server. */
export async function deployRelease({ slug, zip, resume = false, timeoutMs = 600000 }, {
  publishRelease = publish, call = rpc, sleep = delay, now = Date.now, record = () => {}, progress = () => {},
} = {}) {
  validSlug(slug);
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1000) throw new Error('Deployment timeout must be at least one second.');
  const build = resume ? undefined : verifiedRelease(zip).receipt;
  let evidence = { slug, zip, build, state: resume ? 'resuming' : 'uploading', browserVerified: false };
  const save = update => { evidence = { ...evidence, ...update }; record(evidence); };
  save({});
  if (!resume) {
    progress(`Uploading ${slug}`);
    await publishRelease({ slug, zip });
    save({ state: 'queued' });
  }
  const deadline = now() + timeoutMs;
  for (;;) {
    const status = await call('publication_status', { slug });
    save({ state: status.status, publication: status });
    progress(`${slug}: ${status.status}`);
    if (status.status === 'failed') throw new Error(`Publication failed: ${JSON.stringify(status)}`);
    if (status.status === 'published') {
      const check = await call('check_game', { slug });
      save({ check });
      if (check.entryStatus !== 200 || check.fileCheckPassed !== true || !Array.isArray(check.missingFiles) || check.missingFiles.length) {
        throw new Error(`Published, but file checks failed: ${JSON.stringify(check)}`);
      }
      // The guide's canonical route is HTTPS even if a tool returns a relative socket.
      save({ state: 'published', fileCheckPassed: true, url: `${origin}/${slug}/`, socket: `wss://${new URL(origin).host}/${slug}/socket` });
      return evidence;
    }
    if (!['queued', 'pending', 'building', 'starting', 'provisioning', 'checking', 'publishing'].includes(status.status)) {
      throw new Error(`Unknown publication state; inspect before retrying: ${JSON.stringify(status)}`);
    }
    if (now() >= deadline) throw new Error(`Timed out waiting for ${slug}; it may still publish. Resume with --resume ${slug}.`);
    await sleep(Math.min(5000, deadline - now()));
  }
}

const help = `Usage: npm run arcade:deploy -- --zip RELEASE.zip [--slug NAME | --prefix bubble-madness-mp] [--dry-run]
  Or: --web WEB_EXPORT --server SERVER_EXPORT [--prefix NAME] (verify/package first)
  Resume an existing publication without uploading: --resume SLUG
  Options: --timeout-seconds 600, --dry-run (local validation only; no network calls).
  Run on the office network/VPN. Each deployment uses a new URL; existing games remain live.`;

async function main() {
  const args = {}, flags = new Set(['dry-run', 'help']);
  for (let i = 2; i < process.argv.length; i++) {
    const key = process.argv[i]?.replace(/^--/, '');
    if (!process.argv[i]?.startsWith('--') || !['zip', 'slug', 'prefix', 'web', 'server', 'resume', 'timeout-seconds', ...flags].includes(key) || key in args) throw new Error(help);
    if (flags.has(key)) args[key] = true;
    else { const value = process.argv[++i]; if (!value || value.startsWith('--')) throw new Error(help); args[key] = value; }
  }
  if (args.help) { console.log(help); return; }
  const timeoutMs = Number(args['timeout-seconds'] ?? 600) * 1000;
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1000) throw new Error('Timeout must be at least one second.');
  const project = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  const modes = Number(!!args.zip) + Number(!!(args.web || args.server)) + Number(!!args.resume);
  if (modes !== 1 || (!!args.web !== !!args.server) || (args.slug && args.prefix) || (args.resume && (args.slug || args.prefix))) throw new Error(help);
  let zip = args.zip ? resolve(args.zip) : undefined;
  if (args.web) {
    if (args['dry-run']) throw new Error('Use --zip for a dry run; packaging needs a concrete output.');
    const out = join(project, 'build/arcade', `release-${Date.now()}-${randomBytes(2).toString('hex')}.zip`);
    packageExports({ web: resolve(args.web), server: resolve(args.server), out }); zip = out;
  }
  const build = zip ? verifiedRelease(zip).receipt : undefined;
  const slug = validSlug(args.resume ?? args.slug ?? deploymentSlug(args.prefix ?? 'bubble-madness-mp', build?.revision));
  if (args['dry-run']) { console.log(JSON.stringify({ dryRun: true, slug, zip, build, networkCalls: 0 }, null, 2)); return; }
  const dir = join(project, 'build/arcade/deployments'); mkdirSync(dir, { recursive: true });
  // A resume journal is separate, preserving the original upload/build attribution.
  const receipt = join(dir, `${slug}-${args.resume ? 'resume' : 'deploy'}-${Date.now()}-${randomBytes(2).toString('hex')}.json`);
  console.error(`Deployment receipt: ${receipt}\nIf interrupted: npm run arcade:deploy -- --resume ${slug}`);
  const result = await deployRelease({ slug, zip, resume: !!args.resume, timeoutMs }, {
    record: data => writeFileSync(receipt, JSON.stringify(data, null, 2) + '\n'), progress: message => console.error(message),
  });
  console.log(JSON.stringify({ ...result, receipt }, null, 2));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(`Office Arcade deploy: ${error.message}`); process.exitCode = 1; });
}
