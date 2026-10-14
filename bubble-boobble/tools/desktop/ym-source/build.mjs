// Developer packaging uses the pinned, already-installed toolchain and module cache.
// It never provisions a compiler or contacts a module proxy during a launch.
import {spawnSync} from 'node:child_process';
import {readFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
export function buildYMHelper(destination){
 const project=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
 const lock=JSON.parse(readFileSync(resolve(project,'tools/harness/reference.lock.json'),'utf8'));
 const expected=JSON.parse(readFileSync(resolve(project,'tools/desktop/ym-source/expected-pcm.json'),'utf8'));
 const go=process.env.HARNESS_GO??resolve(project,'.cache/toolchains/go/bin/go');
 const env={...process.env,GOTOOLCHAIN:'local',GOPROXY:'off',GOSUMDB:'off',CGO_ENABLED:'0',GOOS:'darwin',GOARCH:'arm64'};
 const cwd=resolve(project,'tools/desktop/ym-source');
 const run=args=>{const result=spawnSync(go,args,{cwd,env,encoding:'utf8',maxBuffer:8*1024*1024});if(result.status!==0)throw new Error(`Stateful music requires local ${lock.go.version} and cached pinned modules. Run npm run harness:setup explicitly, then .cache/toolchains/go/bin/go -C tools/desktop/ym-source mod download (or use exact HARNESS_GO for that command). No download was attempted. ${result.error??result.stderr}`);return result.stdout.trim();};
 const version=run(['version']);
 if(!version.startsWith(`go version ${lock.go.version} `))throw new Error(`Expected ${lock.go.version}, got ${version}; set HARNESS_GO to the pinned executable`);
 const readerHash=createHash('sha256').update(readFileSync(resolve(cwd,'internal/ym/stream.go'))).digest('hex');
 if(readerHash!==expected.readerSha256||expected.referenceRevision!==lock.revision)throw new Error('Stateful music reader provenance mismatch');
 run(['mod','verify']);
 const module=JSON.parse(run(['list','-m','-json',expected.module.Path]));
 for(const key of ['Path','Version','Sum','GoModSum'])if(module[key]!==expected.module[key])throw new Error(`Stateful music dependency provenance mismatch: ${key}`);
 mkdirSync(dirname(destination),{recursive:true});
 run(['build','-mod=readonly','-trimpath','-o',destination,'.']);
 return {go:version,readerSha256:readerHash,referenceRevision:lock.revision,module:expected.module};
}
