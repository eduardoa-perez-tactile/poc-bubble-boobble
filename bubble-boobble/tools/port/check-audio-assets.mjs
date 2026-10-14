// Check source provenance and unique cooked keys, including engine music fallback.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const read=path=>JSON.parse(readFileSync(path,'utf8'));
const provenance=read('data/reference-assets.json');
const sha=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
for(const source of provenance.imported)if(sha(source.target)!==source.sha256)throw new Error(`Original source changed: ${source.target}`);
for(const file of provenance.music.files)if(sha(file.file)!==file.sha256)throw new Error(`Converted music changed: ${file.file}`);
if(sha('tools/port/export-music.go')!==provenance.music.exporterSha256)throw new Error('Music exporter provenance is stale');
const manifest=read(process.argv[2]??'.gameengine/cooked/desktop/manifest.json');
const cookedAliases=new Map();
for(const entry of manifest.entries){
 // Scripts/configs may intentionally have no alias; only named assets resolve
 // through these keys, which must identify exactly one entry across all kinds.
 if(typeof entry.alias!=='string'||entry.alias.length===0)continue;
 const previous=cookedAliases.get(entry.alias);
 if(previous)throw new Error(`Duplicate cooked alias ${entry.alias}: ${previous.kind} (${previous.guid}) and ${entry.kind} (${entry.guid})`);
 cookedAliases.set(entry.alias,entry);
}
const aliases=new Map([...cookedAliases].filter(([alias])=>alias.startsWith('reference/audio/')));
for(let i=1;i<=5;i++){
 if(aliases.get(`reference/audio/bubble-${i}`)?.kind!=='binary')throw new Error(`Original YM key missing: bubble-${i}`);
 if(aliases.get(`reference/audio/music-bubble-${i}`)?.kind!=='audio')throw new Error(`Converted music key missing: music-bubble-${i}`);
}
console.log(`Original provenance intact; ${cookedAliases.size} unique nonempty cooked aliases; ${aliases.size} reference audio aliases; five distinct playable music keys.`);
