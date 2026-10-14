import { read, app, Time } from '@gameengine/runtime';
import { createEffect, untrack, onCleanup, defineUI, emit, useDoc, useResource, views, type ViewHandle } from '@gameengine/ui';
import { DesktopIntent, ArcadeControl } from '../schema.gen.ts';
import { desktopState } from './state.ts';
import { desktopSaveState } from './save.ts';
import { desktopModel, getDesktopButtons, type DesktopModel } from './model.ts';
import { DesktopView, DesktopEditorView, DesktopMenuView, DesktopAccountView } from './desktop.view.tsx';
import { session } from '../arcade/session.ts';
import { DesktopHudView, hudModel, type HudModel } from './hud.view.tsx';
const desktopUI=defineUI({name:'DesktopUI',root(){
 const control=useResource(ArcadeControl),clock=useResource(Time);
 const state=useDoc(desktopState),save=useDoc(desktopSaveState),arcade=useDoc(session);
 onCleanup(app.onLifecycle(phase=>{const s=session.get();if(phase==='background'&&control()?.active&&s.active&&s.game&&!s.game.Paused)emit(DesktopIntent,{action:'pause'});}));
 let hud:ViewHandle<HudModel>|undefined;
 createEffect(()=>{const g=arcade().game;if(control()?.active&&g&&['play','pause','result'].includes(state().screen)){const m=hudModel(g,save());if(hud)hud.update(m);else hud=views.push(DesktopHudView,m);}else{hud?.close();hud=undefined;}});
 let handle:ViewHandle<DesktopModel>|undefined;let screen='';
 createEffect(()=>{const s=state(),p=save();const name=!control()?.active?'':s.screen==='play'?'':s.screen==='editor'?'editor':s.screen==='title'||s.screen==='menu'?'main':['profiles','scores','new-profile','settings'].includes(s.screen)?'account':'menu';const model=desktopModel(s,p,untrack(()=>clock()?.step??0));if(name!==screen){handle?.close();handle=undefined;screen=name;if(name)handle=views.push(name==='editor'?DesktopEditorView:name==='main'?DesktopMenuView:name==='account'?DesktopAccountView:DesktopView,model,{onIntent:(action)=>{if(/^\d+,\d+$/.test(action)){const [x,y]=action.split(',').map(Number);emit(DesktopIntent,{action:'paint',value:'',index:0,x:x!,y:y!});}else {const key=action==='space'?'char: ':action;const index=getDesktopButtons(state(),save()).findIndex(b=>b.key===key);if(index>=0)emit(DesktopIntent,{action:'select',index});emit(DesktopIntent,{action:key,value:'',index:0,x:0,y:0});}}});}else handle?.update(model);});
 createEffect(()=>{const t=clock();if(t)void t.step;if(t&&control()?.active&&handle&&['title','menu','profiles','new-profile','settings'].includes(state().screen)){const frame=t.step;handle.update(previous=>previous.frame===frame?previous:{...previous,frame});}});
 return null;
}});

export const DesktopUI={...desktopUI,resources:[...desktopUI.resources,read(ArcadeControl),read(Time)]};
