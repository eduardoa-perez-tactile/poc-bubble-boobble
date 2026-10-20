import { createMemo, defineView, Screen, Widget, Particles } from '@gameengine/ui';
import { desktopModel, type DesktopModel } from './model.ts';
import { initialDesktopState } from './state.ts';
import { initialDesktopSave } from './save.ts';
export const DesktopView=defineView<DesktopModel>({name:'Desktop',samples:Object.fromEntries((['help','credits','pause','result'] as const).map(screen=>[screen,desktopModel({...initialDesktopState,screen},initialDesktopSave)])),render:(model,{intent})=><Screen safeArea class="desktop-screen"><Widget doc="desktop-shell" id="desktop-shell" class={()=>`desktop-shell desktop-${model().page}`}  codeAreas={{confetti:()=>Particles({effect:'fx/team-victory.vfx.json',emitting:()=>model().celebrate,restart:()=>model().celebrate?1:0,seed:42,style:{width:'680px',height:'300px'}})}} props={{resultReady:()=>model().resultReady,resultHint:()=>model().resultHint,celebration:()=>model().celebrate?1:0,resultScore:()=>model().resultScore,resultStats:()=>model().resultStats,showResultStats:()=>model().showResultStats,page:()=>model().page as Exclude<DesktopModel['page'],'party'|'modes'>,title:()=>model().title,subtitle:()=>model().subtitle,body:()=>model().body,status:()=>model().status,buttons:()=>model().buttons,keys:()=>model().keys,rows:()=>model().rows,logo:()=>model().logo}} onIntent={(_,e)=>intent(e.item??e.path.at(-1)!)}/></Screen>});
export const DesktopEditorView=defineView<DesktopModel>({name:'DesktopEditor',samples:{round1:desktopModel({...initialDesktopState,screen:'editor'},initialDesktopSave)},render:(model,{intent})=><Screen safeArea class="desktop-screen"><Widget doc="desktop-editor" class="desktop-editor" props={{enemyCount:()=>model().enemyCount,subtitle:()=>model().subtitle,status:()=>model().status,rows:()=>model().rows,toolbar:()=>model().toolbar,tools:()=>model().tools,buttons:()=>model().editorButtons,footer:()=>model().footer,copyLabel:()=>model().toolbar[1]?.label??"COPY ROUND 01",elementLabel:()=>model().footer[0]?.label??"BUBBLES: NONE",themeLabel:()=>model().footer[1]?.label??"TILE: 01",sel0:()=>model().selected===0,sel1:()=>model().selected===1,sel2:()=>model().selected===2,sel3:()=>model().selected===3,sel4:()=>model().selected===4,sel16:()=>model().selected===16,sel17:()=>model().selected===17,sel18:()=>model().selected===18,sel19:()=>model().selected===19,sel20:()=>model().selected===20,sel21:()=>model().selected===21}} onIntent={(_,e)=>intent(e.item??e.path.at(-1)!)}/></Screen>});

export const DesktopMenuView=defineView<DesktopModel>({
 name:'DesktopMenu',
 samples:{development:desktopModel({...initialDesktopState,screen:'menu',developmentMenu:true},initialDesktopSave),main:desktopModel({...initialDesktopState,screen:'menu'},initialDesktopSave),title:desktopModel(initialDesktopState,initialDesktopSave),titleHidden:desktopModel(initialDesktopState,initialDesktopSave,66)},
 render:(model,{intent})=><Screen safeArea class="desktop-screen"><Widget doc="desktop-menu" id="desktop-main" class="desktop-menu"
 props={{titleMode:()=>model().page==='title',promptVisible:()=>model().frame%90<65,status:()=>model().status,showStatus:()=>!!model().status,startSelected:()=>model().selected===0,settingsSelected:()=>model().selected===1,quitSelected:()=>model().selected===2}}
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

export const DesktopPartyView=defineView<DesktopModel>({
 name:'PartyLobby',samples:{team:desktopModel({...initialDesktopState,screen:'party',selected:0},initialDesktopSave)},
 render:(model,{intent})=><Screen safeArea class="desktop-screen"><Widget doc="party-lobby" id="party-lobby" class="desktop-party"
 props={{heading:()=>model().buttons[10]?.label==='RESUME SURVIVAL'?'YOUR DRAGON TEAM':'CHOOSE YOUR DRAGONS',status:()=>model().status,
 mode0:()=>model().partyModes[0]??'OPEN SLOT',sel0:()=>model().selected===0,
 mode1:()=>model().partyModes[1]??'OPEN SLOT',sel1:()=>model().selected===1,
 mode2:()=>model().partyModes[2]??'OPEN SLOT',sel2:()=>model().selected===2,
 mode3:()=>model().partyModes[3]??'OPEN SLOT',sel3:()=>model().selected===3,
 mode4:()=>model().partyModes[4]??'OPEN SLOT',sel4:()=>model().selected===4,
 mode5:()=>model().partyModes[5]??'OPEN SLOT',sel5:()=>model().selected===5,
 mode6:()=>model().partyModes[6]??'OPEN SLOT',sel6:()=>model().selected===6,
 mode7:()=>model().partyModes[7]??'OPEN SLOT',sel7:()=>model().selected===7,
 mode8:()=>model().partyModes[8]??'OPEN SLOT',sel8:()=>model().selected===8,
 mode9:()=>model().partyModes[9]??'OPEN SLOT',sel9:()=>model().selected===9,
 startSelected:()=>model().selected===10,backSelected:()=>model().selected===11,startLabel:()=>model().buttons[10]?.label??'START SURVIVAL'}}
 onIntent={(_,e)=>{const key=e.path.at(-1)!;intent(key.startsWith('dragon-')?`party-slot:${key.slice(7)}`:key);}}/></Screen>,
});

export const DesktopModeView=defineView<DesktopModel>({name:'GameModes',samples:{classic:desktopModel({...initialDesktopState,screen:'modes',selected:0},initialDesktopSave),madness:desktopModel({...initialDesktopState,screen:'modes',selected:1},initialDesktopSave)},render:(model,{intent})=><Screen safeArea class="desktop-screen"><Widget doc="mode-select" id="mode-select" class="desktop-modes" props={{classicSelected:()=>model().selected===0,madnessSelected:()=>model().selected===1,backSelected:()=>model().selected===2}} onIntent={(_,e)=>intent(e.path.at(-1)!)}/></Screen>});

const resultSample=(won:boolean,count=10)=>desktopModel({...initialDesktopState,screen:'result',partyRun:true,won,score:58200,round:10,resultReady:true,dragonResults:Array.from({length:count},(_,slot)=>({slot,kills:30-slot*3}))},initialDesktopSave);
export const DesktopResultsView=defineView<DesktopModel>({
 name:'DragonResults',samples:{victory:resultSample(true),defeat:resultSample(false),sixDragons:resultSample(false,6),soloDragon:resultSample(true,1),twoDragons:resultSample(false,2),classic:desktopModel({...initialDesktopState,screen:'result',resultReady:true},initialDesktopSave)},
 render:(model,{intent})=><Screen safeArea class="desktop-screen desktop-results-screen"><Widget doc="run-results" id="run-results" class="desktop-results"
 props={{eyebrow:()=>model().resultEyebrow,title:()=>model().resultTitle,subtitle:()=>model().resultSubtitle,score:()=>model().resultScore,champion:()=>model().resultChampion,stats:()=>model().resultStats,hint:()=>model().resultHint,won:()=>model().resultWon,party:()=>model().resultParty,moreRanks:()=>model().resultList.length>0,ready:()=>model().resultReady,showStats:()=>model().showResultStats,ranking:()=>model().resultList,podium:()=>model().podium,buttons:()=>model().buttons}}
 codeAreas={{confetti:()=>Particles({effect:'fx/team-victory.vfx.json',emitting:()=>model().celebrate,restart:()=>model().celebrate?1:0,seed:42,style:{width:'672px',height:'193px'}})}}
 onIntent={(_,e)=>intent(e.item??e.path.at(-1)!)}/></Screen>,
});
