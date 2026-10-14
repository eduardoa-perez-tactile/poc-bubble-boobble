import { defineDoc, defineSystem, query, read, ActionState, TextInput, PointerHover, PointerDown } from '@gameengine/runtime';
import type { DocHandle, DocValue } from '@gameengine/runtime';
import { DesktopIntent, ArcadeControl } from '../schema.gen.ts';
import campaignData from '../../data/levels.json';
import type { Level } from '../arcade/types.ts';
import { cloneLevel, paintLevel, validateLevel } from './editor.ts';
import { desktopSaveState } from './save.ts';
import { desktopButtonRect } from './layout.ts';
import { getDesktopButtons } from './model.ts';
const campaign=campaignData as Level[];
export type DesktopScreen='title'|'menu'|'profiles'|'new-profile'|'settings'|'scores'|'help'|'credits'|'editor'|'play'|'pause'|'result';
export interface DesktopState {screen:DesktopScreen;name:string;status:string;statusStartedStep:number;selected:number;custom:boolean;recorded:boolean;won:boolean;score:number;round:number;tool:number;template:number;painting:boolean;deleteHeldAt:number;level:Level;history:Level[]}
export const initialDesktopState:DesktopState={screen:'title',name:'',status:'',statusStartedStep:-1,selected:0,custom:false,recorded:false,won:false,score:0,round:1,tool:0,template:0,painting:false,deleteHeldAt:-1,level:cloneLevel(campaign[0]!),history:[]};
export const desktopState=defineDoc('desktop-ui',initialDesktopState as unknown as DocValue) as unknown as DocHandle<DesktopState>;
export interface DesktopGameRequest {sequence:number;action:string;players:number;level:number;customLevel:Level|null}
export const desktopGameRequest=defineDoc('desktop-game-request',{sequence:0,action:'',players:1,level:1,customLevel:null} as DocValue) as unknown as DocHandle<DesktopGameRequest>;
const request=(action:string,custom=false)=>desktopGameRequest.set({sequence:desktopGameRequest.get().sequence+1,action,players:1,level:1,customLevel:custom?cloneLevel(desktopState.get().level):null});
export function showDesktopPause(paused=true){const s=desktopState.get();desktopState.set({...s,screen:paused?'pause':'play',selected:0});}
export function finishDesktopRun(won:boolean,score:number,round:number){const s=desktopState.get();if(!s.recorded&&!s.custom&&desktopSaveState.loaded())desktopSaveState.dispatch('record',{won,score,round},0);desktopState.set({...s,screen:'result',recorded:true,won,score,round,selected:0});}
export function setDesktopRunScore(score:number,round:number){const s=desktopState.get();if(s.score!==score||s.round!==round)desktopState.set({...s,score,round});}
export function desktopAction(action:string,value='',index=0,x=0,y=0,now=0){
 let s=desktopState.get();const patch=(p:Partial<DesktopState>)=>{s={...s,...p,...(p.status!==undefined?{statusStartedStep:-1}:{})};desktopState.set(s);};
 const navigate=(screen:DesktopScreen)=>patch({screen,selected:0,status:''});
 const remember=()=>patch({history:[...s.history,cloneLevel(s.level)].slice(-50)});
 if(action==='navigate'){navigate(value as DesktopScreen);return;}
 if(action==='select'){patch({selected:index});return;}
 if(action==='name'){patch({name:value.slice(0,16)});return;}
 if(action==='space')action='char: ';
 if(action.startsWith('char:')){patch({name:(s.name+action.slice(5)).slice(0,16)});return;}
 if(action.startsWith('profile:')){desktopSaveState.dispatch('select',Number(action.slice(8)),now);navigate('menu');return;}
 if(action.startsWith('tool:')){patch({tool:Number(action.slice(5))});return;}
 if(['menu','profiles','settings','scores','help','credits','editor'].includes(action)){navigate(action as DesktopScreen);return;}
 if(action==='new-profile'){patch({name:''});navigate('new-profile');return;}
 if(action==='create-profile'){if(!desktopSaveState.loaded()){patch({status:'SAVE IS LOADING'});return;}const r=desktopSaveState.dispatch('create',s.name,now);if(r.ok)navigate('profiles');else patch({status:r.reason});return;}
 if(action==='delete-char'){patch({name:s.name.slice(0,-1)});return;}
 if(['avatar','music','sound','fullscreen'].includes(action)){if(desktopSaveState.loaded())desktopSaveState.dispatch('setting',{action,delta:index===-1?-25:25},now);return;}
 if(action==='pause'){request('pause');showDesktopPause();return;}
 if(action==='resume'){request('resume');navigate('play');return;}
 if(action==='start'||action==='restart'||action==='test-level'){
  const custom=action==='test-level'||action==='restart'&&s.custom;
  if(custom){const error=validateLevel(s.level);if(error){patch({status:error});return;}}
  if(action==='restart'&&!s.recorded&&!s.custom&&desktopSaveState.loaded())desktopSaveState.dispatch('record',{won:false,score:s.score,round:s.round},now);
  request(custom?'playtest':'start',custom);patch({screen:'play',custom,recorded:false,score:0,round:1,selected:0});return;
 }
 if(action==='leave'){if(!s.recorded&&!s.custom&&desktopSaveState.loaded())desktopSaveState.dispatch('record',{won:false,score:s.score,round:s.round},now);request('quit');navigate(s.custom?'editor':'menu');return;}
 if(action==='quit'){request('exit');return;}
 if(action==='template-prev'||action==='template-next'){patch({template:(s.template+(action==='template-prev'?24:1))%25});return;}
 if(action==='template'){remember();patch({level:cloneLevel(campaign[s.template]!),status:'ROUND COPIED'});return;}
 if(action==='new'){remember();const l=cloneLevel(campaign[0]!);l.enemies=[];l.special='';l.special_count=0;for(let r=1;r<25;r++)for(let c=2;c<30;c++)l.tiles[r]![c]=0;patch({level:l});return;}
 if(action==='undo'){const l=s.history.at(-1);if(l)patch({level:l,history:s.history.slice(0,-1)});return;}
 if(action==='paint-begin'){remember();patch({painting:true});return;}
 if(action==='paint-end'){patch({painting:false});return;}
 if(action==='paint'){if(!s.painting)remember();patch({level:paintLevel(s.level,x,y,index===-1?1:s.tool)});return;}
 if(action==='save-level'){const error=validateLevel(s.level);if(error){patch({status:error});return;}if(!desktopSaveState.loaded()){patch({status:'SAVE IS LOADING'});return;}const r=desktopSaveState.dispatch('custom',cloneLevel(s.level),now);patch({status:r.ok?'CUSTOM LEVEL SAVED':r.reason});return;}
 if(action==='load-level'){const l=desktopSaveState.get().custom_level;if(!l){patch({status:'NO CUSTOM LEVEL SAVED YET'});return;}remember();patch({level:cloneLevel(l),status:'CUSTOM LEVEL LOADED'});return;}
 if(action==='element'){remember();const choices=['','water','thunder','fire'];const special=choices[(choices.indexOf(s.level.special)+1)%4]!;patch({level:{...s.level,special,special_count:special?16:0}});return;}
 if(action==='theme'){remember();const number=s.level.number%25+1;patch({level:{...s.level,number,tiles:s.level.tiles.map(row=>row.map(t=>t?number:0))}});}
}
export const DesktopSystem=defineSystem({name:'DesktopSystem',resources:[read(ArcadeControl)],query:query(read(ActionState)),events:[DesktopIntent,TextInput,PointerHover,PointerDown],run(ctx,q){
 if(!ctx.get(ArcadeControl).active)return;
 const status=desktopState.get();if(status.status){if(status.statusStartedStep<0)desktopState.set({...status,statusStartedStep:ctx.step});else if(ctx.step-status.statusStartedStep>=300)desktopState.set({...status,status:'',statusStartedStep:-1});}
 if(desktopState.get().screen==='title'&&ctx.events.count(PointerDown))desktopAction('menu');
 for(const pointer of ctx.events.read(PointerHover)){const s=desktopState.get(),p=desktopSaveState.get(),buttons=getDesktopButtons(s,p);for(let i=0;i<buttons.length;i++){const r=desktopButtonRect(s,p,i);if(r&&pointer.world[0]>=r.x&&pointer.world[0]<r.x+r.width&&720-pointer.world[1]>=r.y&&720-pointer.world[1]<r.y+r.height&&s.selected!==i){desktopAction('select','',i);break;}}}
 for(const e of ctx.events.read(DesktopIntent))desktopAction(e.action,e.value,e.index,e.x,e.y,ctx.time);
 for(const c of q.chunks())for(let i=0;i<c.length;i++)if(c.is(ActionState,i,'name','fullscreen')&&c.col(ActionState).justPressed[i])desktopAction('fullscreen','',0,0,0,ctx.time);
 let s=desktopState.get();if(s.screen==='play')return;
 let editorModifier=false;for(const c of q.chunks())for(let i=0;i<c.length;i++)if(c.is(ActionState,i,'name','editorModifier')&&c.col(ActionState).pressed[i])editorModifier=true;
 if(s.screen==='new-profile')for(const e of ctx.events.read(TextInput))desktopAction('name',desktopState.get().name+e.text.replace(/[^A-Za-z0-9 _-]/g,'').toUpperCase());
 for(const c of q.chunks())for(let i=0;i<c.length;i++){
  const a=c.col(ActionState);s=desktopState.get();
  if(s.screen==='new-profile'&&c.is(ActionState,i,'name','delete')){if(a.pressed[i]){const started=s.deleteHeldAt<0?ctx.step:s.deleteHeldAt;if(s.deleteHeldAt<0)desktopState.set({...s,deleteHeldAt:started});const held=ctx.step-started;if(held===0||held>30&&held%3===0)desktopAction('delete-char');}else if(s.deleteHeldAt>=0)desktopState.set({...s,deleteHeldAt:-1});}
  if(!a.justPressed[i])continue;const buttons=getDesktopButtons(s,desktopSaveState.get());
  if(c.is(ActionState,i,'name','menuY')){const selected=(s.selected+(a.value[i]!<0?-1:1)+buttons.length)%buttons.length;desktopAction('select','',selected);}
  if(c.is(ActionState,i,'name','menuX')&&s.screen==='settings'){const b=buttons[s.selected];if(b)desktopAction(b.key,'',a.value[i]!<0?-1:1);}
  if((s.screen!=='new-profile'&&c.is(ActionState,i,'name','confirm'))||(s.screen==='new-profile'&&c.is(ActionState,i,'name','profileConfirm'))){const b=buttons[s.selected];if(b)desktopAction(b.key,'',0,0,0,ctx.time);}
  if(c.is(ActionState,i,'name','back'))desktopAction(s.screen==='pause'?'resume':s.screen==='new-profile'?'profiles':'menu');
  if(s.screen==='editor'){if(editorModifier&&c.is(ActionState,i,'name','undo'))desktopAction('undo');if(editorModifier&&c.is(ActionState,i,'name','save'))desktopAction('save-level');if(c.is(ActionState,i,'name','playtest'))desktopAction('test-level');}
 }
}});
