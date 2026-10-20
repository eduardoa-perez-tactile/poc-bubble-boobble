import { browserSaveCompatibility } from './save-compat.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
export async function extendWebShell({project,engineRoot,sdk}) {
  const site=join(project,'build/web/site');
  const loader=join(site,'gameengine-web-player.js');
  writeFileSync(loader,browserSaveCompatibility(readFileSync(loader,'utf8')));
  let source=readFileSync(join(engineRoot,'platform/web/player.ts'),'utf8');
  const replace=(before,after)=>{if(!source.includes(before))throw new Error(`Pinned engine shell changed: ${before}`);source=source.replace(before,after);};
  replace("import { InputQueue, bindInput } from './input.ts';",`import { InputQueue, bindInput } from ${JSON.stringify(join(engineRoot,'platform/web/input.ts'))};\nimport { installControls } from ${JSON.stringify(join(project,'web/controls.mjs'))};`);
  replace('const queue = new InputQueue();','const queue = new InputQueue();\nconst browserControls = installControls(canvas,queue);');
  // Reset handling and polling share one frame so focus changes cannot leave stale controls.
  replace('    if (queue.resetPending) {','    browserControls.poll();\n    if (queue.resetPending) {');
  source=source.replaceAll('document.hidden','browserControls.hidden()');
  const visibility=source.match(/document\.addEventListener\('visibilitychange', \(\) => \{[\s\S]*?\n\}\);/);
  if(!visibility)throw new Error('Pinned engine visibility handler changed');
  source+='\n'+visibility[0].replace("'visibilitychange'","'bubble-visibility'")+'\n';
  const {build}=await import(pathToFileURL(join(sdk,'node_modules/esbuild/lib/main.js')).href);
  await build({stdin:{contents:source,resolveDir:project,loader:'ts'},outfile:join(site,'player.js'),bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true});
  let html=readFileSync(join(site,'index.html'),'utf8');
  html=html.replace('<title>Game Engine</title>','<title>Bubble Madness</title>').replace('<h1 id="name">Game Engine</h1>','<h1 id="name">Bubble Madness</h1>');
  html=html.replace('<button id="start" disabled>Start game</button>',`<button id="start" disabled>START GAME</button>
      <p class="controls">Trap enemies. Pop bubbles. Collect fruit.</p>
      <p class="controls"><strong>Player 1</strong> &nbsp; A/D or ←/→ move · W/↑ jump · Space fire<br><strong>Player 2</strong> &nbsp; J/L move · I jump · K fire<br>Esc pause · M mute · F11 fullscreen<br>Controller: stick / D-pad · A jump · X fire · Start pause</p>
      <p class="compat">Desktop browser with WebGPU required. Saves stay in this browser.<br>For co-op, choose MODE in Settings. Wave Survival supports AI teammates.</p>`);
  html=html.replace('</head>',`<style>
    html,body{background:#101426;color:#f2f9ff}#launch{background:radial-gradient(ellipse at top,#204f56,#101426 75%);gap:.65rem;overflow:auto}#name{font-size:clamp(36px,7vw,68px);letter-spacing:-.04em;color:#b9ff72;text-shadow:0 5px #082e24;margin:.2em 0}#start{background:#b9ff72;color:#10291d;border:0;border-radius:12px;font-weight:800;box-shadow:0 5px #477c37}#start:disabled{opacity:.45}.controls{line-height:1.7;margin:.35em 0}.compat{font-size:13px;color:#a9bdcc;line-height:1.6}dialog{max-width:420px;background:#172b38;color:#f2f9ff;border:2px solid #b9ff72;border-radius:16px;padding:24px}dialog::backdrop{background:#07101cbb}dialog button{background:#245440;border-color:#b9ff72}#status{margin:.25em auto}
    </style></head>`);
  writeFileSync(join(site,'index.html'),html);
  const git=args=>{const r=spawnSync('git',args,{cwd:project,encoding:'utf8'});if(r.status!==0)throw new Error(r.stderr);return r.stdout.trim();};
  writeFileSync(join(site,'playtest-build.json'),JSON.stringify({sha:git(['rev-parse','HEAD']),dirty:!!git(['status','--porcelain']),exportedAt:new Date().toISOString(),name:'Bubble Madness',shell:'bubble-web-v1'},null,2)+'\n');
}
