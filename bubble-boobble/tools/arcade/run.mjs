#!/usr/bin/env node
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { command, engineIdentity, packageExports, stampExport, verifyExports, withBrowserReleaseFlags, webEngineRoot } from './release.mjs';
import { publish, rpc, validSlug } from './client.mjs';
const project = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const action = process.argv[2], args = {};
for (let at = 3; at < process.argv.length; at += 2) {
  const key = process.argv[at], value = process.argv[at + 1];
  if (!key.startsWith('--') || !value || value.startsWith('--')) throw new Error(`Expected --name value: ${key}`);
  args[key.slice(2)] = value;
}
const required = key => { if (!args[key]) throw new Error(`Missing --${key}`); return args[key]; };
const path = key => resolve(required(key));
try {
  let result;
  if (action === 'list') result = await rpc('list_games');
  else if (action === 'status' || action === 'check') result = await rpc(action === 'status' ? 'publication_status' : 'check_game', { slug: validSlug(required('slug')) });
  else if (action === 'verify' || action === 'package') {
    const options = { web: path('web'), server: path('server') };
    result = action === 'verify' ? verifyExports(options) : packageExports({ ...options, out: path('out') });
  } else if (action === 'stamp') result = stampExport({ project, engineRoot: path('engine-root'), out: path('export'), target: required('target') });
  else if (action === 'build-server') {
    if (process.platform !== 'linux' || process.arch !== 'x64') throw new Error('Build on Ubuntu 24.04 Linux x64. macOS cannot cross-build the authoritative Linux export.');
    const engineRoot = path('engine-root'), out = path('out');
    engineIdentity(engineRoot);
    withBrowserReleaseFlags(project, () => command(process.execPath, [join(engineRoot, 'tools/cli/bin/gameengine.mjs'), 'build', 'server', '--project', project, '--target', 'linux-x64', '--authority', 'server', '--port', '8787', '--out', out], { cwd: project, env: { ...process.env, GAMEENGINE_REPO: engineRoot }, stdio: 'inherit' }));
    result = stampExport({ project, engineRoot, out, target: 'linux-x64' });
  } else if (action === 'build-web') {
    const engineRoot = webEngineRoot(project, path('engine-root'));
    engineIdentity(engineRoot);
    // The game's existing exporter preserves its virtual controls, save compatibility and splash.
    command(process.execPath, [join(project, 'tools/web/toolchain.mjs'), 'export'], { cwd: project, env: { ...process.env, WEB_CONFIG: 'release' }, stdio: 'inherit' });
    result = stampExport({ project, engineRoot, out: join(project, 'build/web'), target: 'web' });
  } else if (action === 'publish') result = await publish({ slug: required('slug'), zip: path('zip') });
  else throw new Error('Usage: run.mjs list | status/check --slug SLUG | build-web --engine-root ROOT | build-server --engine-root ROOT --out EXPORT | stamp --engine-root ROOT --export EXPORT --target web/linux-x64 | verify/package --web WEB_EXPORT --server SERVER_EXPORT [--out ZIP] | publish --slug SLUG --zip ZIP');
  console.log(JSON.stringify(result, null, 2));
} catch (error) { console.error(`Office Arcade: ${error.message}`); process.exitCode = 1; }
