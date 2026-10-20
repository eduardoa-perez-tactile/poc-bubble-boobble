import { openBrowserFullscreen } from './browser';
import { developmentMenuEnabled } from './development';
import { read, app, Time } from '@gameengine/runtime';
import { createEffect, untrack, onCleanup, defineUI, emit, useDoc, useResource, views, type ViewHandle } from '@gameengine/ui';
import { DesktopIntent, ArcadeControl, ArcadeAudio } from '../schema.gen.ts';
import { desktopState } from './state.ts';
import { desktopSaveState } from './save.ts';
import { desktopModel, getDesktopButtons, type DesktopModel } from './model.ts';
import { DesktopResultsView, DesktopView, DesktopEditorView, DesktopMenuView, DesktopAccountView, DesktopPartyView, DesktopModeView } from './desktop.view.tsx';
import { session } from '../arcade/session.ts';
import { DesktopHudView, hudModel, type HudModel } from './hud.view.tsx';
const desktopUI=defineUI({name:'DesktopUI',root(){
 const control=useResource(ArcadeControl),clock=useResource(Time),platform=useResource(ArcadeAudio);
 let developmentReported=false;
 createEffect(()=>{if(control()?.active&&!developmentReported){developmentReported=true;emit(DesktopIntent,{action:'development-menu',index:developmentMenuEnabled?1:0});}});
 const state=useDoc(desktopState),save=useDoc(desktopSaveState),arcade=useDoc(session);
 let fullscreenPreference:boolean|undefined;
 createEffect(()=>{const value=save().settings.fullscreen;if(!desktopSaveState.loaded())return;if(fullscreenPreference!==undefined&&value!==fullscreenPreference)openBrowserFullscreen();fullscreenPreference=value;});
 onCleanup(app.onLifecycle(phase=>{const s=session.get();if(phase==='background'&&desktopState.get().screen==='play'&&control()?.active&&s.active&&s.game&&!s.game.Paused)emit(DesktopIntent,{action:'pause'});}));
 let hud:ViewHandle<HudModel>|undefined;
 createEffect(()=>{const g=arcade().game;if(control()?.active&&g&&['play','pause'].includes(state().screen)){const m=hudModel(g,save(),state().screen==='pause'?'pause':state().screen==='result'?'result':'normal');if(hud)hud.update(m);else hud=views.push(DesktopHudView,m);}else{hud?.close({immediate:state().screen==='result'});hud=undefined;}});
 let handle:ViewHandle<DesktopModel>|undefined;let screen='';
 createEffect(()=>{const s=state(),p=save();const name=!control()?.active?'':s.screen==='play'?'':s.screen==='result'?'result':s.screen==='modes'?'modes':s.screen==='party'?'party':s.screen==='editor'?'editor':s.screen==='title'||s.screen==='menu'?'main':['profiles','scores','new-profile','settings'].includes(s.screen)?'account':'menu';const model=desktopModel(s,p,untrack(()=>clock()?.step??0),platform()?.native??false);if(name!==screen){handle?.close({immediate:name==='result'||screen==='result'});handle=undefined;screen=name;if(name)handle=views.push(name==='result'?DesktopResultsView:name==='modes'?DesktopModeView:name==='party'?DesktopPartyView:name==='editor'?DesktopEditorView:name==='main'?DesktopMenuView:name==='account'?DesktopAccountView:DesktopView,model,{onIntent:(action)=>{if(/^\d+,\d+$/.test(action)){const [x,y]=action.split(',').map(Number);emit(DesktopIntent,{action:'paint',value:'',index:0,x:x!,y:y!});}else {const key=action==='space'?'char: ':action;const index=getDesktopButtons(state(),save()).findIndex(b=>b.key===key);if(index>=0)emit(DesktopIntent,{action:'select',index});emit(DesktopIntent,{action:key,value:'',index:0,x:0,y:0});}}});}else handle?.update(model);});
 createEffect(()=>{const t=clock();if(t)void t.step;if(t&&control()?.active&&handle&&['title','menu','profiles','new-profile','settings'].includes(state().screen)){const frame=t.step;handle.update(previous=>previous.frame===frame?previous:{...previous,frame});}});
 return null;
}});

export const DesktopUI={...desktopUI,resources:[...desktopUI.resources,read(ArcadeControl),read(Time),read(ArcadeAudio)]};
