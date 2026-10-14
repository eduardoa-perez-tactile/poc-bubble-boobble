// Check source provenance and the manifest keys used by real engine music fallback.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const read=path=>JSON.parse(readFileSync(path,'utf8'));
const provenance=read('data/reference-assets.json');
const sha=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
for(const source of provenance.imported)if(sha(source.target)!==source.sha256)throw new Error(`Original source changed: ${source.target}`);
for(const file of provenance.music.files)if(sha(file.file)!==file.sha256)throw new Error(`Converted music changed: ${file.file}`);
if(sha('tools/port/export-music.go')!==provenance.music.exporterSha256)throw new Error('Music exporter provenance is stale');
const manifest=read(process.argv[2]??'.gameengine/cooked/desktop/manifest.json');
const aliases=new Map();
for(const entry of manifest.entries.filter(e=>e.alias?.startsWith('reference/audio/'))){
 if(aliases.has(entry.alias))throw new Error(`Duplicate audio alias ${entry.alias}: ${aliases.get(entry.alias).kind} and ${entry.kind}`);
 aliases.set(entry.alias,entry);
}
for(let i=1;i<=5;i++){
 if(aliases.get(`reference/audio/bubble-${i}`)?.kind!=='binary')throw new Error(`Original YM key missing: bubble-${i}`);
 if(aliases.get(`reference/audio/music-bubble-${i}`)?.kind!=='audio')throw new Error(`Converted music key missing: music-bubble-${i}`);
}
console.log(`Original provenance intact; ${aliases.size} unique reference audio aliases; five distinct playable music keys.`);
