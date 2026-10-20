import { app, multiplayer, services, type MatchStatus, type JoinOptions } from '@gameengine/runtime';
import { defineUI, emit, onCleanup, onUiFrame, views, type ViewHandle } from '@gameengine/ui';
import { DesktopIntent } from '../schema.gen';
import { session } from '../arcade/session';
import { partyNames, partyRanking } from '../arcade/party-config';
import { initialDesktopState, desktopState } from '../desktop/state';
import { initialDesktopSave } from '../desktop/save';
import { desktopModel, type DesktopModel } from '../desktop/model';
import { DesktopResultsView } from '../desktop/desktop.view';
import { DesktopHudView, hudModel, type HudModel } from '../desktop/hud.view';
import { openBrowserInvitation, reportBrowserScreen } from '../desktop/browser';
import { invitationLink, officeArcadeSocket, onlineError, parseInvitation, validHumans, validRoom } from './room';
import { OnlineBarView, OnlineRoomView, type OnlineRoomModel } from './room.view';

/** Connection state is presentation-only: none of it is written to a world document. */
export const OnlineUI=defineUI({name:'OnlineUI',root(){
 let room=String(Math.floor(Math.random()*900000)+100000),humans=2,launch='',server:string|undefined;
 let reconnect:JoinOptions|undefined,disconnected=false;
 let open=false,localMenu=false,invitation=false,message='',joined=new Set<number>(),requested=false,disposed=false,wasOnline=false;
 let lobby:ViewHandle<OnlineRoomModel>|undefined,bar:ViewHandle<{identity:string}>|undefined,hud:ViewHandle<HudModel>|undefined,result:ViewHandle<DesktopModel>|undefined;
 let lobbyStamp='',barStamp='',hudStamp='',resultStamp='',reported='',lastDesktopScreen='';
 const release=()=>{try{multiplayer.setInput(0,[0,0]);}catch{/* No transport in isolated previews. */}};
 const closeViews=()=>{lobby?.close({immediate:true});bar?.close({immediate:true});hud?.close({immediate:true});result?.close({immediate:true});lobby=undefined;bar=undefined;hud=undefined;result=undefined;lobbyStamp=barStamp=hudStamp=resultStamp='';};
 void services.system.launchLink().then(value=>{if(disposed)return;launch=value.url??'';server=officeArcadeSocket(launch);const invite=parseInvitation(launch);if(invite){room=invite.room;humans=invite.humans;open=true;}}).catch(()=>{/* Native/dev can use configured multiplayer.server. */});
 function leave(toMenu=false){reconnect=undefined;disconnected=false;wasOnline=false;release();multiplayer.leave();emit(DesktopIntent,{action:'online-exit',index:toMenu?1:0});requested=false;localMenu=false;invitation=false;joined.clear();message='';open=!toMenu;closeViews();}
 function disconnect(status:MatchStatus){
  if(disconnected)return;
  // The engine retains match() after socket loss while ordinary steps resume. Clear it
  // immediately; recovery is best effort and only the local credentials survive here.
  reconnect=status.seat&&status.room?{server:status.server??server,room:status.room,players:status.players??humans,seat:status.seat,mode:'realtime',sync:'input'}:undefined;
  disconnected=true;open=true;requested=false;wasOnline=false;localMenu=false;
  release();multiplayer.leave();emit(DesktopIntent,{action:'online-exit'});
  message=reconnect?'MATCH CONNECTION ENDED. TRY RECONNECTING WHILE OTHER PLAYERS REMAIN.':'MATCH CONNECTION ENDED. CREATE A NEW ROOM.';
 }
 function intent(action:string){
  const status=multiplayer.status(),running=!disconnected&&status.phase==='running',waiting=status.phase==='waiting'||status.phase==='connecting',closed=disconnected||status.phase==='closed';
  if(action==='menu'){localMenu=true;release();return;}
  if(action==='back'){
   if(running||waiting||closed){leave();return;}
   open=false;message='';emit(DesktopIntent,{action:'menu'});return;
  }
  if(action==='connect'){
   if(running){localMenu=false;invitation=false;return;}
   if(closed){
    const options=reconnect??(status.seat&&status.room?{server:status.server??server,room:status.room,players:status.players??humans,seat:status.seat,mode:'realtime' as const,sync:'input' as const}:undefined);
    if(options){release();message='RECONNECTING TO YOUR DRAGON';requested=true;disconnected=false;try{multiplayer.join(options);}catch(e){disconnected=true;message=e instanceof Error?e.message:String(e);}return;}
    leave();room=String(Math.floor(Math.random()*900000)+100000);return;
   }
   if(waiting){invitation=!invitation;const link=invitationLink(launch,room,humans);if(link)openBrowserInvitation(link);return;}
   if(!validRoom(room)||!validHumans(humans)){message='ENTER A SIX-DIGIT ROOM CODE AND 1–10 HUMANS';return;}
   release();joined.clear();message='';requested=true;invitation=false;
   try{multiplayer.join({...(server?{server}:{}),room:`wave-${room}`,players:humans,mode:'realtime',sync:'input'});}catch(e){requested=false;message=e instanceof Error?e.message:String(e);}
   return;
  }
  if(running||waiting)return;
  if(action==='less')humans=Math.max(1,humans-1);
  if(action==='more')humans=Math.min(10,humans+1);
  if(action==='delete')room=room.slice(0,-1);
  if(action==='new-code')room=String(Math.floor(Math.random()*900000)+100000);
  if(/^digit-[0-9]$/.test(action))room=(room.length===6?'':room)+action.slice(-1);
  message='';
 }
 onCleanup(app.onLifecycle(phase=>{if(phase==='background'){release();if(multiplayer.status().phase==='running')localMenu=true;}}));
 onCleanup(()=>{disposed=true;release();closeViews();});
 onCleanup(onUiFrame(()=>{
  const status:MatchStatus=multiplayer.status();
  const desktopScreen=desktopState.get().screen;if(desktopScreen==='online'&&lastDesktopScreen!=='online')open=true;lastDesktopScreen=desktopScreen;
  for(const event of multiplayer.events()){
   if(event.type==='welcome'){joined.add(event.player);requested=true;disconnected=false;reconnect=undefined;}
   if(event.type==='joined'&&event.player!==null)joined.add(event.player);
   if(event.type==='left'){if(event.player!==null)joined.delete(event.player);if(status.phase==='running')message='A PLAYER DISCONNECTED / THEIR LAST INPUT MAY CONTINUE';}
   if(event.type==='error')message=onlineError(event.code,event.message);
   if(event.type==='closed')disconnect(status);
   if(event.type==='desync'){release();localMenu=true;message=`MATCH OUT OF SYNC AT FRAME ${event.frame}. LEAVE AND CREATE A NEW ROOM.`;}
  }
  if(status.phase==='closed')disconnect(status);
  const running=!disconnected&&status.phase==='running',waiting=!disconnected&&(status.phase==='waiting'||status.phase==='connecting');
  const current=session.get();
  const g=running&&current.active&&current.mode==='online'?current.game:null;
  if(status.error)message=onlineError(status.error.code,status.error.message);
  if(running){open=true;wasOnline=true;humans=status.players??humans;const matchRoom=/^wave-([0-9]{6})(?:-|$)/.exec(status.room??'');if(matchRoom)room=matchRoom[1]!;}
  // A rebuilt world starts its presentation afresh; running status restores the whole UI.
  if(!running&&wasOnline&&status.phase==='idle'){open=true;wasOnline=false;localMenu=false;}
  const closed=disconnected||status.phase==='closed';
  const visible=open||waiting||running||requested||closed;
  if(!visible){if(reported){reported='';reportBrowserScreen(desktopScreen);}closeViews();return;}
  const gameEnded=running&&current.active&&!!g&&(g.State===3||g.State===4);
  const playing=running&&!!g&&!gameEnded&&!localMenu;
  const nextReported=playing?'play':'online';if(reported!==nextReported){reported=nextReported;reportBrowserScreen(nextReported,true);}
  if(running&&g){
   const model=hudModel(g,initialDesktopSave,gameEnded?'result':'normal');const stamp=JSON.stringify(model);
   if(stamp!==hudStamp){hudStamp=stamp;if(hud)hud.update(model);else hud=views.push(DesktopHudView,model);}
  }else{hud?.close({immediate:true});hud=undefined;hudStamp='';}
  if(playing){
   const index=status.player??0;const identity=`YOU: ${partyNames[index]??'DRAGON'} / P${index+1}  |  ROOM ${room}  |  ${humans} HUMANS + ${10-humans} AI`;
   if(identity!==barStamp){barStamp=identity;if(bar)bar.update({identity});else bar=views.push(OnlineBarView,{identity},{onIntent:intent});}
  }else{bar?.close({immediate:true});bar=undefined;barStamp='';}
  if(gameEnded&&!localMenu){
   lobby?.close({immediate:true});lobby=undefined;lobbyStamp='';
   const base=desktopModel({...initialDesktopState,screen:'result',partyRun:true,won:g!.State===4,score:g!.Score,round:g!.Party?.Wave??1,resultReady:true,dragonResults:partyRanking(g!),partySlots:g!.Party!.Slots},initialDesktopSave);
   const model={...base,resultEyebrow:'ONLINE WAVE SURVIVAL / TEAM RESULTS',resultHint:'NEW MATCH REQUIRES A NEW ROOM',buttons:[{key:'online-again',label:'NEW ONLINE ROOM',selected:true},{key:'online-leave',label:'LEAVE MATCH',selected:false}]};
   const stamp=JSON.stringify(model);if(stamp!==resultStamp){resultStamp=stamp;if(result)result.update(model);else result=views.push(DesktopResultsView,model,{onIntent:(action)=>{leave(action==='online-leave');room=String(Math.floor(Math.random()*900000)+100000);}});}
   return;
  }
  result?.close({immediate:true});result=undefined;resultStamp='';
  if(playing){lobby?.close({immediate:true});lobby=undefined;lobbyStamp='';return;}
  const setup=!running&&!waiting&&!closed;
  const link=invitationLink(launch,room,humans);
  const model:OnlineRoomModel={title:running?'LOCAL MENU':closed?'MATCH ENDED':'ONLINE WAVE SURVIVAL',subtitle:running?'THE MATCH CONTINUES WHILE THIS MENU IS OPEN':'TEN DRAGONS / ONE SHARED ARENA',room:`ROOM ${room.padEnd(6,'_')}`,humans:`${humans} ${humans===1?'HUMAN':'HUMANS'} + ${10-humans} AI`,setup,
   detail:running?'Leaving releases your seat. A dropped connection can reconnect.':invitation&&link?link:waiting?'Share this room code and human count with your friends.':'Choose humans first. Use the same room code and count on every device.',
   status:message||(status.phase==='connecting'?'CONNECTING TO MATCH SERVER':waiting?`WAITING FOR ${humans} HUMANS / ${joined.size} CONNECTIONS OBSERVED`:closed?'CREATE A NEW ROOM TO PLAY AGAIN':server?'OFFICE ARCADE / READY TO CONNECT':'LOCAL SERVER / OPEN THE OFFICE ARCADE BUILD TO PLAY ONLINE'),primary:running?'RESUME':waiting?'INVITATION':closed?(reconnect||status.seat?'RECONNECT':'NEW ROOM'):'CREATE / JOIN',secondary:running?'LEAVE MATCH':waiting?'CANCEL':'BACK'};
  const stamp=JSON.stringify(model);if(stamp!==lobbyStamp){lobbyStamp=stamp;if(lobby)lobby.update(model);else lobby=views.push(OnlineRoomView,model,{onIntent:intent});}
 }));
 return null;
}});
