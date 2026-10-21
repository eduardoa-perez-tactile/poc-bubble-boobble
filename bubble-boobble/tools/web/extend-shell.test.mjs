import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {build} from '../../.gameengine/engine/node_modules/esbuild/lib/main.js';
import {extendPlayerSource} from './extend-shell.mjs';

test('game shell coalesces world packets while preserving pinned lifecycle and hidden suspension',async()=>{
 const project=resolve('.'),{engineRoot}=JSON.parse(readFileSync('.gameengine/web-toolchain.json','utf8'));
 const original=readFileSync(resolve(engineRoot,'platform/web/player.ts'),'utf8'),source=extendPlayerSource(original,{project,engineRoot});
 assert.match(source,/if \(busy\) return;/);
 assert.match(source,/if \(!visibility\)/);
 assert.match(source,/originalSocketTake\(owner\)/);
 assert.match(source,/onlineBackground\.flush\(\)/);
 assert.match(source,/\[engine, visibility \? 1 : 0\]/); // Actual lifecycle still delivered once.
 assert.match(source,/\{ async: true \}/);
 assert.doesNotMatch(source,/onlineBackgroundForeground|createOnlineBackgroundPump/);
 assert.equal((source.match(/onlineBackground\.dispose\(\)/g)??[]).length,2);
 assert.match(source,/else if \(!disposed && !browserControls\.hidden\(\)\) \{\n      frameRequest = requestAnimationFrame\(frame\)/);
 assert.doesNotMatch(source,/setInterval\(/);
 const compiled=await build({stdin:{contents:source,loader:'ts',resolveDir:resolve(engineRoot,'platform/web')},bundle:true,format:'esm',platform:'browser',target:'es2022',write:false});
 assert.ok(compiled.outputFiles[0].text.length>1000);
 assert.throws(()=>extendPlayerSource(original.replace('let module: EngineModule;','let module: FutureEngineModule;'),{project,engineRoot}),/Pinned engine shell changed/);
});
