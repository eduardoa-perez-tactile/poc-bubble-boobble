import { ActionState, defineDoc, defineSystem, query, read, WorldView, write, type DocHandle, type DocValue, type WorldInputFrame } from '@gameengine/runtime';
import { ArcadeControl, OnlineLocalControls, OnlineWorldInput, OnlineWorldSnapshot } from '../schema.gen';
import campaign from '../../data/levels.json';
import { session } from '../arcade/session';
import type { Level } from '../arcade/types';
import { advanceWorld, createWorldState, type WorldState } from './world-rules';
import { hydratePublicGame, isPublicWorld, projectWorld, type PublicWorld } from './world-public';

export const authoritativeWorld = defineDoc('online.world.private', {started:false,state:createWorldState()} as unknown as DocValue) as unknown as DocHandle<{started:boolean;state:WorldState}>;
export const publicWorld = defineDoc('online.world.public', {version:1,tick:0,rooms:[],peers:[]} as unknown as DocValue) as unknown as DocHandle<PublicWorld>;
export interface ClientWorldView {player:number;room:string|null;tick:number}
export const clientWorldView = defineDoc('online.world.client', {player:-1,room:null,tick:-1} as unknown as DocValue) as unknown as DocHandle<ClientWorldView>;

/** Only server-stamped input can initialize the authority. Clients never run room gameplay. */
export const OnlineWorldAuthority = defineSystem({name:'OnlineWorldAuthority',after:['ArcadeBoot'],events:[OnlineWorldInput],run(ctx){
 const frames=ctx.inputData<WorldInputFrame>(OnlineWorldInput),previous=authoritativeWorld.get();
 const events=frames.flatMap(frame=>Array.isArray(frame.events)?frame.events:[]);
 if(!previous.started&&!events.some(event=>event.kind==='start'))return;
 const state=advanceWorld(previous.state,events,campaign as Level[]);
 authoritativeWorld.set({started:true,state});
 if(!previous.started||state.tick%3===0)publicWorld.set(projectWorld(state));
}});

/** Full snapshots are transient recorded payloads, never strings in interned event columns. */
export const OnlineWorldClient = defineSystem({name:'OnlineWorldClient',after:['ArcadeStep'],events:[OnlineWorldSnapshot],resources:[write(ArcadeControl),write(WorldView)],run(ctx){
 for(const packet of ctx.inputData<{player:number;document:unknown;playing:boolean;reset?:boolean}>(OnlineWorldSnapshot)){
  if(!Number.isInteger(packet.player)||packet.player<0||!isPublicWorld(packet.document))continue;
  const previous=clientWorldView.get(),data=packet.document;
  if(!packet.reset&&data.tick<previous.tick)continue;
  const room=packet.playing?data.rooms.find(room=>room.owners.includes(packet.player)):undefined;
  const selected=room?.id??null;
  clientWorldView.set({player:packet.player,room:selected,tick:data.tick});
  if(room?.game){
   session.set({active:true,mode:'online',game:hydratePublicGame(room.game)});
   ctx.setField(ArcadeControl,'active',true);
   ctx.set(WorldView,{center:[384,360],orthoSize:360,designAspect:768/720,fit:'Contain'});
  }else if(!room){
   const current=session.get();if(current.mode==='online'&&current.active)session.set({...current,active:false});
  }else if(previous.room!==selected){
   // A room omitted by packet pacing must not show the previous room's arena.
   const current=session.get();if(current.mode==='online'&&current.active)session.set({...current,active:false});
  }
 }
}});

/** Native actions remain local presentation data; the transport stamps the actual server actor. */
export const OnlineWorldControls = defineSystem({name:'OnlineWorldControls',stage:'LateUpdate',query:query(read(ActionState)),resources:[write(OnlineLocalControls)],run(ctx,q){
 let move=0,jump=false,fire=false;
 for(const chunk of q.chunks())for(let i=0;i<chunk.length;i++){
  const value=chunk.col(ActionState);
  if(chunk.is(ActionState,i,'name','move'))move+=value.value[i]!;
  if(chunk.is(ActionState,i,'name','jump'))jump ||= value.pressed[i]!==0;
  if(chunk.is(ActionState,i,'name','fire'))fire ||= value.pressed[i]!==0;
 }
 ctx.set(OnlineLocalControls,{move:Math.max(-1,Math.min(1,move)),jump,fire});
}});
