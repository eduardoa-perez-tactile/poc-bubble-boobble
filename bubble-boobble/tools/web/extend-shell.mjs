import { browserSaveCompatibility } from './save-compat.mjs';
import { writeSplashShell } from './splash-shell.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
export async function extendWebShell({project,engineRoot,sdk}) {
  const site=join(project,'build/web/site');
  const loader=join(site,'gameengine-web-player.js');
  const engineVersion=JSON.parse(readFileSync(join(sdk,'engine-version.json'),'utf8')).version;
  writeFileSync(loader,browserSaveCompatibility(readFileSync(loader,'utf8'),engineVersion));
  const source=extendPlayerSource(readFileSync(join(engineRoot,'platform/web/player.ts'),'utf8'),{project,engineRoot});
  const {build}=await import(pathToFileURL(join(sdk,'node_modules/esbuild/lib/main.js')).href);
  await build({stdin:{contents:source,resolveDir:join(engineRoot,'platform/web'),loader:'ts'},outfile:join(site,'player.js'),bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true});
  writeSplashShell({project,site});
  const git=args=>{const r=spawnSync('git',args,{cwd:project,encoding:'utf8'});if(r.status!==0)throw new Error(r.stderr);return r.stdout.trim();};
  writeFileSync(join(site,'playtest-build.json'),JSON.stringify({sha:git(['rev-parse','HEAD']),dirty:!!git(['status','--porcelain']),exportedAt:new Date().toISOString(),name:'Bubble Madness',shell:'bubble-web-v3'},null,2)+'\n');
}

/** Game-owned extension of the exact pinned loader; engine/wasm stay unchanged. */
export function extendPlayerSource(playerSource,{project,engineRoot}) {
  let source=playerSource;
  const replace=(before,after)=>{if(!source.includes(before))throw new Error(`Pinned engine shell changed: ${before}`);source=source.replace(before,after);};
  replace("import { InputQueue, bindInput } from './input.ts';",`import { InputQueue, bindInput } from ${JSON.stringify(join(engineRoot,'platform/web/input.ts'))};\nimport { installControls } from ${JSON.stringify(join(project,'web/controls.mjs'))};\nimport { installSplash } from ${JSON.stringify(join(project,'web/splash.mjs'))};\nimport { createWorldBackgroundTransport } from ${JSON.stringify(join(project,'web/online-background.mjs'))};\nimport { worldMessages } from ${JSON.stringify(join(engineRoot,'packages/runtime/src/world-wire.ts'))};`);
  replace('const queue = new InputQueue();','const queue = new InputQueue();\nconst browserControls = installControls(canvas,queue);\ninstallSplash();');
  // Reset handling and polling share one frame so focus changes cannot leave stale controls.
  replace('    if (queue.resetPending) {','    browserControls.poll();\n    if (queue.resetPending) {');
  source=source.replaceAll('document.hidden','browserControls.hidden()');
  replace("const sockets = new BrowserSockets((url, protocols) => new WebSocket(url, protocols), {", `const onlineBackground = createWorldBackgroundTransport({
  factory: (url, protocols) => new WebSocket(url, protocols), hidden: () => browserControls.hidden(), decode: worldMessages,
});
const sockets = new BrowserSockets(onlineBackground.create, {`);
  replace("  sockets.dispose();", "  sockets.dispose();\n  onlineBackground.dispose();");
  replace("window.addEventListener('pagehide', () => {\n  disposed = true;", "window.addEventListener('pagehide', () => {\n  disposed = true;\n  onlineBackground.dispose();");
  replace('let module: EngineModule;', `// Flush one retained complete world packet before the SDK drains its bounded queue.
const originalSocketTake = sockets.take.bind(sockets);
sockets.take = (owner) => { onlineBackground.flush(); return originalSocketTake(owner); };
let module: EngineModule;`);
  const visibility=source.match(/document\.addEventListener\('visibilitychange', \(\) => \{[\s\S]*?\n\}\);/);
  if(!visibility)throw new Error('Pinned engine visibility handler changed');
  source+='\n'+visibility[0].replace("'visibilitychange'","'bubble-visibility'")+'\n';
  return source;
}
