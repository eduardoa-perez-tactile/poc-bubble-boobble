import type { CompanionState } from '../arcade/companion';
import { State, type GameState } from '../arcade/types';
import type { WorldNotice, WorldState } from './world-rules';

export const PUBLIC_WORLD_LIMIT = 240 * 1024;
export const PUBLIC_GAME_LIMIT = 200 * 1024;
export type PublicValue = null | boolean | number | string | PublicValue[] | { [key: string]: PublicValue };
export const PUBLIC_ACTORS = ['Players','Enemies','Bubbles','Projectiles','Items','Effects','Particles'] as const;
export type PublicActor = typeof PUBLIC_ACTORS[number];
export interface PackedActors { fields: string[]; rows: PublicValue[][] }
/** Display snapshot, never a saved/authoritative game or input to stepGame. */
export interface PackedGame { version: 1; data: Record<string, PublicValue>; actors: Record<PublicActor, PackedActors> }
export interface PublicRoom {
 id: string; title: string; owners: (number | null)[]; humans: number; wave: number;
 phase: 'prepare' | 'combat' | 'rest' | 'boss'; ended: boolean; notices: WorldNotice[]; game?: PackedGame;
}
export interface PublicWorld { version: 1; tick: number; rooms: PublicRoom[]; peers: { player: number; room: string | null; error?: string }[] }
const privateFields = new Set(['Campaign','RNG','Companion','Companions','OnlineNavigationGraphs','OnlineNavigationGraphIndices']);
const actors = new Set<string>(PUBLIC_ACTORS);

/** Portable UTF-8 size: the engine VM need not supply TextEncoder. */
export function publicBytes(value: unknown): number {
 const text=JSON.stringify(value);let bytes=0;
 for(let at=0;at<text.length;at++){
  const code=text.charCodeAt(at);
  if(code<128)bytes++;else if(code<2048)bytes+=2;
  else if(code>=0xd800&&code<=0xdbff&&at+1<text.length&&text.charCodeAt(at+1)>=0xdc00&&text.charCodeAt(at+1)<=0xdfff){bytes+=4;at++;}
  else bytes+=3;
 }
 return bytes;
}
function publicValue(value: unknown): PublicValue {
 if(value===null||typeof value==='boolean'||typeof value==='string')return value;
 if(typeof value==='number'){if(!Number.isFinite(value))throw new Error('Non-finite public game value');return value;}
 if(Array.isArray(value))return value.map(item=>item===undefined?null:publicValue(item));
 if(value&&typeof value==='object'){
  const out:Record<string,PublicValue>={};
  for(const key of Object.keys(value).sort()){const item=(value as Record<string,unknown>)[key];if(item!==undefined)out[key]=publicValue(item);}
  return out;
 }
 throw new Error('Unsupported public game value');
}
function packActors(rows: readonly object[]): PackedActors {
 const fields=[...new Set(rows.flatMap(row=>Object.keys(row)))].sort();
 return {fields,rows:rows.map(row=>fields.map(field=>{const value=(row as Record<string,unknown>)[field];return value===undefined?null:publicValue(value);} ))};
}
function packGame(game: GameState): PackedGame {
 const data:Record<string,PublicValue>={};
 for(const key of Object.keys(game).sort())if(!privateFields.has(key)&&!actors.has(key)){
  const value=(game as unknown as Record<string,unknown>)[key];if(value!==undefined)data[key]=publicValue(value);
 }
 const tables={} as Record<PublicActor,PackedActors>;
 for(const key of PUBLIC_ACTORS)tables[key]=packActors(game[key]);
 const packed:PackedGame={version:1,data,actors:tables};
 // Cosmetics are the only expendable data. Never trim actors that determine shared combat.
 for(const key of ['Particles','Effects'] as const){
  while(publicBytes(packed)>PUBLIC_GAME_LIMIT&&packed.actors[key].rows.length){
   const rows=packed.actors[key].rows;packed.actors[key]={fields:packed.actors[key].fields,rows:rows.slice(Math.ceil(rows.length/2))};
  }
 }
 return packed;
}
/** Every room's roster stays visible; full games take turns when snapshots reach the budget. */
export function projectWorld(state: WorldState): PublicWorld {
 const ordered=state.rooms.slice().sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
 const roomPeers=state.peers.filter(peer=>peer.room!==null);
 const errorPeers=state.peers.filter(peer=>peer.room===null&&!!peer.error).sort((a,b)=>a.player-b.player).slice(0,64);
 const result:PublicWorld={version:1,tick:state.tick,rooms:ordered.map(room=>({id:room.id,title:room.title,owners:room.owners.slice(),humans:room.owners.filter(owner=>owner!==null).length,wave:room.game.Party?.Wave??1,phase:room.game.Party?.Phase??'prepare',ended:room.game.State===State.GameOver||room.game.State===State.Won,notices:room.notices.map(notice=>({...notice}))})),peers:[...roomPeers,...errorPeers].sort((a,b)=>a.player-b.player).map(peer=>({player:peer.player,room:peer.room,...(peer.error?{error:peer.error.slice(0,96)}:{})}))};
 if(publicBytes(result)>PUBLIC_WORLD_LIMIT)throw new Error('Public room metadata exceeds its document budget');
 const first=ordered.length?Math.floor(state.tick/3)%ordered.length:0;
 for(let index=0;index<ordered.length;index++){
  const slot=(first+index)%ordered.length,game=packGame(ordered[slot]!.game);
  if(publicBytes(game)>PUBLIC_GAME_LIMIT)continue;
  result.rooms[slot]!.game=game;
  if(publicBytes(result)>PUBLIC_WORLD_LIMIT)delete result.rooms[slot]!.game;
 }
 return result;
}
function object(value: unknown): value is Record<string,unknown>{return !!value&&typeof value==='object'&&!Array.isArray(value);}
function finite(value: unknown): value is number{return typeof value==='number'&&Number.isFinite(value);}
function values(value: unknown,depth=0): value is PublicValue {
 if(depth>24)return false;
 if(value===null||typeof value==='string'||typeof value==='boolean'||finite(value))return true;
 if(Array.isArray(value))return value.every(item=>values(item,depth+1));
 return object(value)&&Object.entries(value).every(([key,item])=>key!=='__proto__'&&key!=='constructor'&&key!=='prototype'&&values(item,depth+1));
}
function packedGame(value: unknown): value is PackedGame {
 if(!object(value)||value.version!==1||!object(value.data)||!object(value.actors)||!values(value.data))return false;
 if(Object.keys(value.data).some(key=>privateFields.has(key)||actors.has(key)))return false;
 const data=value.data;
 if(!finite(data.State)||!finite(data.Tick)||!finite(data.Score)||!object(data.Level)||!Array.isArray(data.Level.tiles)||!object(data.Party)||!Array.isArray(data.Party.Slots)||data.Party.Slots.length!==10||!data.Party.Slots.every(slot=>slot==='human'||slot==='ai'||slot==='empty'))return false;
 for(const key of PUBLIC_ACTORS){
  const table=value.actors[key];
  if(!object(table)||!Array.isArray(table.fields)||!Array.isArray(table.rows))return false;
  const fields=table.fields;
  if(!fields.every(field=>typeof field==='string'&&field!=='__proto__'&&field!=='constructor'&&field!=='prototype')||new Set(fields).size!==fields.length||!table.rows.every(row=>Array.isArray(row)&&row.length===fields.length&&row.every(item=>values(item))))return false;
 }
 return true;
}
/** Validate untrusted public transport data before it reaches presentation readers. */
export function isPublicWorld(value: unknown): value is PublicWorld {
 if(!object(value)||value.version!==1||!Number.isInteger(value.tick)||!finite(value.tick)||value.tick<0||!Array.isArray(value.rooms)||value.rooms.length>4||!Array.isArray(value.peers)||value.peers.length>104)return false;
 const ids=new Set<string>();
 for(const room of value.rooms){
  if(!object(room)||typeof room.id!=='string'||!/^room-[1-9][0-9]*$/.test(room.id)||ids.has(room.id)||typeof room.title!=='string'||room.title.length>96||!Array.isArray(room.owners)||room.owners.length!==10||!room.owners.every(owner=>owner===null||finite(owner)&&Number.isInteger(owner)&&owner>=0&&owner<=0xffffffff)||room.humans!==room.owners.filter(owner=>owner!==null).length||!finite(room.wave)||!Number.isInteger(room.wave)||typeof room.phase!=='string'||!['prepare','combat','rest','boss'].includes(room.phase)||typeof room.ended!=='boolean'||!Array.isArray(room.notices)||room.notices.length>32)return false;
  ids.add(room.id);
  for(const notice of room.notices)if(!object(notice)||!Number.isInteger(notice.id)||!Number.isInteger(notice.tick)||!Number.isInteger(notice.slot)||!finite(notice.slot)||notice.slot<0||notice.slot>=10||!['join','leave'].includes(String(notice.kind))||typeof notice.label!=='string'||notice.label.length>64)return false;
  if(room.game!==undefined&&!packedGame(room.game))return false;
 }
 if(!value.peers.every(peer=>object(peer)&&finite(peer.player)&&Number.isInteger(peer.player)&&peer.player>=0&&peer.player<=0xffffffff&&(peer.room===null||typeof peer.room==='string'&&ids.has(peer.room))&&(peer.error===undefined||typeof peer.error==='string'&&peer.error.length<=96)))return false;
 return publicBytes(value)<=PUBLIC_WORLD_LIMIT;
}
/** AI sentinels exist solely for draw truthiness. This object must never enter the simulation. */
export function hydratePublicGame(packed: PackedGame): GameState {
 const game={...publicValue(packed.data) as Record<string,PublicValue>,Campaign:[],RNG:'1'} as unknown as GameState;
 for(const key of PUBLIC_ACTORS){
  const table=packed.actors[key];
  const rows=table.rows.map(row=>{const actor:Record<string,PublicValue>={};table.fields.forEach((field,index)=>{const value=row[index];if(value!==null&&value!==undefined)actor[field]=publicValue(value);});return actor;});
  (game as unknown as Record<string,unknown>)[key]=rows;
 }
 if(game.Party){game.Companions=game.Party.Slots.map(slot=>slot==='ai'?{Graph:null} as unknown as CompanionState:null);if(game.Companions[1])game.Companion=game.Companions[1]!;}
 return game;
}
