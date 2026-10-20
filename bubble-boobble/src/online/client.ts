import { app, emitInputData, read, services } from '@gameengine/runtime';
import { defineUI, emit, onCleanup, onUiFrame, useResource, views, type ViewHandle } from '@gameengine/ui';
import { DesktopIntent, OnlineLocalControls, OnlineWorldSnapshot } from '../schema.gen';
import { session } from '../arcade/session';
import { partyNames, partyRanking } from '../arcade/party-config';
import { initialDesktopState, desktopState } from '../desktop/state';
import { initialDesktopSave } from '../desktop/save';
import { desktopModel, type DesktopModel } from '../desktop/model';
import { DesktopResultsView } from '../desktop/desktop.view';
import { DesktopHudView, hudModel, type HudModel } from '../desktop/hud.view';
import { reportBrowserScreen } from '../desktop/browser';
import { officeArcadeSocket } from './room';
import { OnlineBarView, OnlineRoomView, type OnlineRoomModel, type OnlineBarModel } from './room.view';
import { browserWorldControls, openWorldTransport, neutralWorldControls, type WorldTransport } from './world-transport';
import { isPublicWorld, type PublicWorld } from './world-public';

/** Connection and menu state remain local; the server owns discovery, slots and gameplay. */
const controller=defineUI({name:'OnlineUI',root(){
 const nativeControls=useResource(OnlineLocalControls);
 let server='ws://127.0.0.1:8787',linkReady=false,disposed=false,connecting=false,failed=false;
 let transport:WorldTransport|undefined,epoch=0,player=-1,data:PublicWorld={version:1,tick:0,rooms:[],peers:[]};
 let open=false,playing=false,localMenu=false,panel:'setup'|'browse'='setup',message='',requested:unknown;
 let lastScreen='',reported='',applied=false,awaitingRoom=false,assignedRoom:string|null=null;
 let selection:{kind:'create';before:string|null}|{kind:'join';room:string}|null=null;
 const selectedRoom=()=>{const room=data.rooms.find(room=>room.owners.includes(player));return room&&(!selection||(selection.kind==='join'?room.id===selection.room:room.id!==selection.before))?room:undefined;};
 let lobby:ViewHandle<OnlineRoomModel>|undefined,bar:ViewHandle<OnlineBarModel>|undefined,hud:ViewHandle<HudModel>|undefined,result:ViewHandle<DesktopModel>|undefined;
 let lobbyStamp='',barStamp='',hudStamp='',resultStamp='';
 const release=()=>transport?.releaseNeutral();
 const apply=()=>{if(player>=0)emitInputData(OnlineWorldSnapshot,JSON.stringify({player,document:data,playing:playing&&!!selectedRoom()}));};
 const closeViews=()=>{lobby?.close({immediate:true});bar?.close({immediate:true});hud?.close({immediate:true});result?.close({immediate:true});lobby=undefined;bar=undefined;hud=undefined;result=undefined;lobbyStamp=barStamp=hudStamp=resultStamp='';};
 const disconnect=()=>{epoch++;transport?.close();transport=undefined;connecting=false;player=-1;requested=undefined;applied=false;assignedRoom=null;selection=null;};
 void services.system.launchLink().then(link=>{if(disposed)return;server=officeArcadeSocket(link.url??'')??server;linkReady=true;}).catch(()=>{linkReady=true;});
 function connect(){
  if(connecting||transport||!linkReady)return;
  connecting=true;failed=false;const token=++epoch;message='CONNECTING TO THE LIVE GAME DIRECTORY';
  void openWorldTransport({server,name:'DRAGON',onEvent:event=>{
   if(disposed||epoch!==token)return;
   if(event.kind==='welcome'){player=event.player;data={version:1,tick:0,rooms:[],peers:[]};message='';emitInputData(OnlineWorldSnapshot,JSON.stringify({player,document:data,playing:false,reset:true}));}
   if(event.kind==='snapshot'){
    if(!isPublicWorld(event.document)){message='INVALID GAME DIRECTORY RECEIVED';return;}
    data=event.document;applied=true;
   }
   if(event.kind==='error'){playing=false;apply();disconnect();failed=true;message=event.error;panel='browse';}
   if(event.kind==='closed'){
    playing=false;apply();disconnect();failed=true;message='CONNECTION LOST. YOUR DRAGON IS NOW CONTROLLED BY AI.';localMenu=false;panel='browse';
   }
  }}).then(value=>{if(disposed||epoch!==token){value.close();return;}transport=value;connecting=false;}).catch(error=>{if(disposed||epoch!==token)return;connecting=false;failed=true;requested=undefined;message=String(error);});
 }
 function send(intent:unknown){try{transport?.send(intent);}catch(error){message=String(error);}}
 function leave(toMenu=false){
  release();send({action:'leave'});playing=false;awaitingRoom=false;assignedRoom=null;selection=null;localMenu=false;requested=undefined;panel='browse';apply();closeViews();
  if(toMenu){open=false;disconnect();emit(DesktopIntent,{action:'online-exit',index:1});}
 }
 function intent(action:string){
  if(action==='menu'){localMenu=true;release();return;}
  if(action==='back'){
   if(playing){leave();return;}
   if(panel==='setup'){panel='browse';message='';connect();return;}
   open=false;disconnect();closeViews();emit(DesktopIntent,{action:'menu'});return;
  }
  if(action==='connect'){
   if(playing){localMenu=false;message='';return;}
   if(panel==='browse'){panel='setup';message='';return;}
   failed=false;selection={kind:'create',before:data.rooms.find(room=>room.owners.includes(player))?.id??null};requested={action:'create'};awaitingRoom=true;playing=true;apply();message='STARTING YOUR GAME';connect();return;
  }
  if(action.startsWith('join:')){
   const room=data.rooms.find(room=>room.id===action.slice(5));
   if(!room||room.ended||room.humans>=10){message='THAT GAME IS FULL OR HAS FINISHED';return;}
   failed=false;selection={kind:'join',room:room.id};requested={action:'join',room:room.id};awaitingRoom=true;playing=true;apply();message='JOINING THE NEXT AVAILABLE DRAGON';connect();
  }
 }
 onCleanup(app.onLifecycle(phase=>{if(phase==='background'){release();if(playing)localMenu=true;}}));
 onCleanup(()=>{disposed=true;playing=false;apply();disconnect();closeViews();});
 onCleanup(onUiFrame(()=>{
  const screen=desktopState.get().screen;
  if(screen==='online'&&lastScreen!=='online'){open=true;panel='setup';failed=false;}
  lastScreen=screen;
  if(!open){if(reported){reportBrowserScreen(screen);reported='';}return;}
  if(!transport&&!connecting&&!failed)connect();
  if(transport&&player>=0&&requested){send(requested);requested=undefined;}
  const fresh=applied;if(applied){applied=false;apply();}
  const room=selectedRoom();
  const peer=data.peers.find(peer=>peer.player===player);
  if(fresh&&peer?.error){message=peer.error;playing=false;awaitingRoom=false;selection=null;assignedRoom=null;localMenu=false;panel='browse';apply();}
  if(playing&&room){message='';awaitingRoom=false;assignedRoom=room.id;selection=null;}
  // Room expiry/eviction returns a connected player to the discoverable game list.
  if(fresh&&playing&&!awaitingRoom&&!room&&!requested&&assignedRoom&&!connecting){playing=false;assignedRoom=null;panel='browse';message='THAT GAME HAS FINISHED. JOIN ANOTHER OR START A NEW ONE.';apply();}
  const current=session.get(),game=playing&&room&&current.active&&current.mode==='online'?current.game:null;
  const ended=!!game&&(game.State===3||game.State===4),inGame=!!game&&!localMenu&&!ended;
  const next=inGame?'play':'online';if(reported!==next){reported=next;reportBrowserScreen(next,true);}
  if(inGame&&transport){const batch=browserWorldControls()??[nativeControls()??neutralWorldControls()];for(const controls of batch)transport.sendControls(controls);}
  if(game){const model=hudModel(game,initialDesktopSave,ended?'result':'normal'),stamp=JSON.stringify(model);if(stamp!==hudStamp){hudStamp=stamp;if(hud)hud.update(model);else hud=views.push(DesktopHudView,model);}}
  else{hud?.close({immediate:true});hud=undefined;hudStamp='';}
  if(inGame&&room){
   const slot=room.owners.indexOf(player),recent=room.notices.filter((notice,index,all)=>data.tick-notice.tick<180&&!all.slice(index+1).some(later=>later.slot===notice.slot));
   const joins=recent.filter(notice=>notice.kind==='join').map(notice=>notice.label),leaves=recent.filter(notice=>notice.kind==='leave').map(notice=>notice.label);
   const notice=[joins.length?`${joins.join(', ')} JOINED`:'',leaves.length?`${leaves.join(', ')} LEFT / AI TOOK OVER`:''].filter(Boolean).join('  |  ');
   const model:OnlineBarModel={identity:`YOU: P${slot+1} ${partyNames[slot]} / ${room.humans} OF 10 PLAYERS / WAVE ${room.wave}`,notice};
   const stamp=JSON.stringify(model);if(stamp!==barStamp){barStamp=stamp;if(bar)bar.update(model);else bar=views.push(OnlineBarView,model,{onIntent:intent});}
  }else{bar?.close({immediate:true});bar=undefined;barStamp='';}
  if(ended&&!localMenu&&game){
   lobby?.close({immediate:true});lobby=undefined;lobbyStamp='';
   const base=desktopModel({...initialDesktopState,screen:'result',partyRun:true,won:game.State===4,score:game.Score,round:game.Party?.Wave??1,resultReady:true,dragonResults:partyRanking(game),partySlots:game.Party!.Slots},initialDesktopSave);
   const model={...base,resultEyebrow:'ONLINE WAVE SURVIVAL / TEAM RESULTS',resultHint:'START AGAIN OR JOIN ANOTHER GAME',buttons:[{key:'online-again',label:'NEW GAME',selected:true},{key:'online-leave',label:'BROWSE GAMES',selected:false}]};
   const stamp=JSON.stringify(model);if(stamp!==resultStamp){resultStamp=stamp;if(result)result.update(model);else result=views.push(DesktopResultsView,model,{onIntent:action=>{leave();if(action==='online-again')panel='setup';}});}return;
  }
  result?.close({immediate:true});result=undefined;resultStamp='';
  if(inGame){lobby?.close({immediate:true});lobby=undefined;lobbyStamp='';return;}
  const menu=!!game&&localMenu,browse=panel==='browse'&&!menu;
  const rooms=data.rooms.map(room=>({key:`join:${room.id}`,title:`${room.title} / WAVE ${room.wave}`,detail:`${room.humans} / 10 PLAYERS / ${room.ended?'FINISHED':room.phase.toUpperCase()}`,label:room.ended?'FINISHED':room.humans>=10?'FULL':'JOIN GAME',disabled:room.ended||room.humans>=10}));
  const model:OnlineRoomModel={title:menu?'LOCAL MENU':browse?'JOIN A GAME':'ONLINE WAVE SURVIVAL',subtitle:menu?'THE GAME CONTINUES WHILE THIS MENU IS OPEN':browse?'GAMES IN PROGRESS / JOIN DURING ANY BATTLE':'START SOLO. FRIENDS CAN JOIN ANY TIME.',detail:menu?'Leaving hands your dragon to AI. You can join again from the game list.':browse?'Pick a game with a free human slot. Your dragon joins immediately.':'Start as one dragon. There is no waiting room or required player count.',status:message||(browse?(rooms.length?'CHOOSE A GAME BELOW':'NO GAMES YET. START THE FIRST ONE.'):'UP TO TEN HUMAN DRAGONS / AI TAKES OVER WHEN YOU LEAVE'),primary:menu?'RESUME':browse?'NEW GAME':'START GAME NOW',secondary:menu?'LEAVE GAME':browse?'BACK':'BROWSE GAMES',setup:!browse&&!menu,rooms,showRooms:browse};
  const stamp=JSON.stringify(model);if(stamp!==lobbyStamp){lobbyStamp=stamp;if(lobby)lobby.update(model);else lobby=views.push(OnlineRoomView,model,{onIntent:intent});}
 }));
 return null;
}});
export const OnlineUI={...controller,resources:[...controller.resources,read(OnlineLocalControls)]};
