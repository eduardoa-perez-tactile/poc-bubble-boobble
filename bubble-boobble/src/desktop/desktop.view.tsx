import { createMemo, defineView, Screen, Widget } from '@gameengine/ui';
import { desktopModel, type DesktopModel } from './model.ts';
import { initialDesktopState } from './state.ts';
import { initialDesktopSave } from './save.ts';
export const DesktopView=defineView<DesktopModel>({name:'Desktop',samples:Object.fromEntries((['help','credits','pause','result'] as const).map(screen=>[screen,desktopModel({...initialDesktopState,screen},initialDesktopSave)])),render:(model,{intent})=><Screen safeArea class="desktop-screen"><Widget doc="desktop-shell" id="desktop-shell" class={()=>`desktop-shell desktop-${model().page}`}  props={{resultScore:()=>model().resultScore,resultStats:()=>model().resultStats,showResultStats:()=>model().showResultStats,page:()=>model().page as Exclude<DesktopModel['page'],'party'>,title:()=>model().title,subtitle:()=>model().subtitle,body:()=>model().body,status:()=>model().status,buttons:()=>model().buttons,keys:()=>model().keys,rows:()=>model().rows,logo:()=>model().logo}} onIntent={(_,e)=>intent(e.item??e.path.at(-1)!)}/></Screen>});
export const DesktopEditorView=defineView<DesktopModel>({name:'DesktopEditor',samples:{round1:desktopModel({...initialDesktopState,screen:'editor'},initialDesktopSave)},render:(model,{intent})=><Screen safeArea class="desktop-screen"><Widget doc="desktop-editor" class="desktop-editor" props={{enemyCount:()=>model().enemyCount,subtitle:()=>model().subtitle,status:()=>model().status,rows:()=>model().rows,toolbar:()=>model().toolbar,tools:()=>model().tools,buttons:()=>model().editorButtons,footer:()=>model().footer,copyLabel:()=>model().toolbar[1]?.label??"COPY ROUND 01",elementLabel:()=>model().footer[0]?.label??"BUBBLES: NONE",themeLabel:()=>model().footer[1]?.label??"TILE: 01",sel0:()=>model().selected===0,sel1:()=>model().selected===1,sel2:()=>model().selected===2,sel3:()=>model().selected===3,sel4:()=>model().selected===4,sel16:()=>model().selected===16,sel17:()=>model().selected===17,sel18:()=>model().selected===18,sel19:()=>model().selected===19,sel20:()=>model().selected===20,sel21:()=>model().selected===21}} onIntent={(_,e)=>intent(e.item??e.path.at(-1)!)}/></Screen>});

export const DesktopMenuView=defineView<DesktopModel>({
 name:'DesktopMenu',
 samples:{main:desktopModel({...initialDesktopState,screen:'menu'},initialDesktopSave),title:desktopModel(initialDesktopState,initialDesktopSave),titleHidden:desktopModel(initialDesktopState,initialDesktopSave,66)},
 render:(model,{intent})=><Screen safeArea class="desktop-screen"><Widget doc="desktop-menu" id="desktop-main" class="desktop-menu"
 props={{subtitle:()=>model().subtitle,titleMode:()=>model().page==='title',promptVisible:()=>model().frame%90<65,status:()=>model().status,showStatus:()=>!!model().status,startSelected:()=>model().selected===0,profilesSelected:()=>model().selected===1,scoresSelected:()=>model().selected===2,editorSelected:()=>model().selected===3,settingsSelected:()=>model().selected===4,helpSelected:()=>model().selected===5,creditsSelected:()=>model().selected===6,quitSelected:()=>model().selected===7,partySelected:()=>model().selected===8}}
 onIntent={(_,e)=>intent(e.path.at(-1)!)}/></Screen>,
});
const accountSamples=Object.fromEntries((['profiles','scores','new-profile','settings'] as const).map(screen=>[screen,desktopModel({...initialDesktopState,screen,name:'BUB'},initialDesktopSave)]));
export const DesktopAccountView=defineView<DesktopModel>({
 name:'DesktopAccount',samples:accountSamples,
 render:(model,{intent})=>{
  const profiles=createMemo(()=>model().profiles);
  const name=createMemo(()=>model().name+(model().frame%60<30?'_':''));
  return <Screen safeArea class="desktop-screen"><Widget doc="desktop-account" id="desktop-account" class="desktop-account"
   props={{page:()=>model().page as 'profiles'|'scores'|'new-profile'|'settings',title:()=>model().title,subtitle:()=>model().subtitle,name,status:()=>model().status,showStatus:()=>!!model().status,statsName:()=>model().statsName,stats:()=>model().stats,avatarName:()=>model().avatar,profiles,scores:()=>model().scores,keyRows:()=>model().keyRows,settings:()=>model().buttons,
   backSelected:()=>model().page==='profiles'?model().selected===model().profileCount+1:model().selected===0,newSelected:()=>model().selected===model().profileCount,spaceSelected:()=>model().selected===36,deleteSelected:()=>model().selected===37,createSelected:()=>model().selected===38,cancelSelected:()=>model().selected===39}}
   onIntent={(_,e)=>intent(e.item??e.path.at(-1)!)}/></Screen>;
 },
});

export const DesktopPartyView=defineView<DesktopModel>({name:'PartyLobby',samples:{team:desktopModel({...initialDesktopState,screen:'party',selected:6},initialDesktopSave)},render:(model,{intent})=><Screen safeArea class="desktop-screen"><Widget doc="party-lobby" id="party-lobby" class="desktop-party" props={{buttons:()=>model().buttons,status:()=>model().status}} onIntent={(_,e)=>intent(e.item??e.path.at(-1)!)}/></Screen>});
