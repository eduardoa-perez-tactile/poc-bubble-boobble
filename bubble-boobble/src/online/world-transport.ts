import { multiplayer, type WorldConnection, type WorldEvent } from '@gameengine/runtime';
import { WEB_BUILD } from '../desktop/build-flags';

/** Local intent only. Player identity and world state always come from the server. */
export interface WorldControls { move: number; jump: boolean; fire: boolean }
export const neutralWorldControls = (): WorldControls => ({ move: 0, jump: false, fire: false });
export function cleanWorldControls(value: WorldControls): WorldControls {
 return { move: Number.isFinite(value.move) ? Math.max(-1,Math.min(1,value.move)) : 0, jump: value.jump===true, fire: value.fire===true };
}

/** Presentation capability owned by the same-origin browser shell; no DOM API in game code. */
export function browserWorldControls(): WorldControls[]|null {
 if(!WEB_BUILD)return null;
 try {
  const shell=(globalThis as unknown as {parent?:{__bubbleBrowser?:{protocol?:number;worldControls?:()=>unknown}}}).parent?.__bubbleBrowser;
  if(shell?.protocol!==1||typeof shell.worldControls!=='function')return null;
  const batch=shell.worldControls();
  if(!Array.isArray(batch)||batch.length>64)return [neutralWorldControls()];
  return batch.map(value=>value&&typeof value==='object'?cleanWorldControls(value as WorldControls):neutralWorldControls());
 } catch { return null; }
}

export interface WorldTransport {
 send(data: unknown): void;
 sendControls(controls: WorldControls): boolean;
 releaseNeutral(): void;
 close(): void;
}
interface Options { server: string; name: string; onEvent: (event: WorldEvent)=>void }
interface Dependencies { connect?: (options:{server:string;name:string})=>Promise<WorldConnection>; now?:()=>number }
/** Presentation-only connection. The heartbeat prevents a held control expiring server-side. */
export async function openWorldTransport(options: Options, dependencies: Dependencies={}): Promise<WorldTransport> {
 const connect=dependencies.connect??(value=>multiplayer.world.connect(value));
 const now=dependencies.now??(()=>Date.now());
 const connection=await connect({server:options.server,name:options.name});
 let closed=false,last='',lastAt=-Infinity;
 const sendControls=(value:WorldControls,force=false):boolean=>{
  if(closed)return false;
  const controls=cleanWorldControls(value),stamp=JSON.stringify(controls),at=now();
  if(!force&&stamp===last&&at>=lastAt&&at-lastAt<250)return false;
  connection.send({action:'controls',...controls});last=stamp;lastAt=at;return true;
 };
 const releaseNeutral=()=>{if(!closed)try{sendControls(neutralWorldControls(),true);}catch{/* Closed transport cannot guarantee a final packet. */}};
 let unsubscribe:()=>void;
 try { unsubscribe=connection.subscribe(event=>{if(!closed)options.onEvent(event);}); }
 catch(error){connection.close();throw error;}
 return {
  send(data){if(!closed)connection.send(data);},
  sendControls(value){return sendControls(value);},
  releaseNeutral,
  close(){if(closed)return;releaseNeutral();closed=true;unsubscribe();connection.close();},
 };
}
