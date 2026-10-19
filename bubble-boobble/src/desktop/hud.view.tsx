import { defineView, Screen, Widget } from '@gameengine/ui';
import type { GameState } from '../arcade/types.ts';
import type { DesktopSave } from './save.ts';
import { partyColors, partyNames, partySurvivorCount, partyFinisher, partyStartGraceTicks } from '../arcade/party-config';
export interface HudModel {startCue?:string;startHint?:string;showStartCue?:boolean;startGo?:boolean;celebrationColor?:typeof partyColors[number]|'none';party?:boolean;highTitle?:string;name:string;score:string;round:string;high:string;lives:string;enemies:string;banner:string;hint:string;detail?:string;showBanner:boolean;clear:boolean;freeze:string;shade:'normal'|'pause'|'result'}
export function hudModel(g:GameState,s:DesktopSave,shade:HudModel['shade']='normal'):HudModel {
 if(g.Party){
  const p=g.Party,boss=p.Boss,rest=p.Phase==='rest',prepare=p.Phase==='prepare';
  const captured=boss?.Mode==='captured'&&g.State===1;
  const go=!rest&&!prepare&&g.State===1&&g.LevelTicks<(boss?180:partyStartGraceTicks);
  const finisher=partyFinisher(g),award=finisher!==undefined&&(rest||g.State===4)&&shade!=='pause';
  const skin=finisher===undefined?undefined:g.Players[finisher]?.Skin;
  const celebrationColor=award?(partyColors.find(c=>c===skin)??partyColors[finisher!]!):'none';
  const startCue=prepare?String(Math.ceil(p.Timer/60)):go&&g.LevelTicks<60?'GO!':'';
  const survivors=partySurvivorCount(g);
  const seconds=Math.ceil(p.Timer/60),wave=boss?'BOSS':`WAVE ${p.Wave}`;
  return {startCue,startHint:prepare&&p.Wave===1?'GET READY - MOVE AT GO!':'MOVE, JUMP AND SHOOT',showStartCue:shade==='normal'&&!!startCue,startGo:!prepare,celebrationColor,party:true,highTitle:boss?'BOSS HP':survivors===1?'LAST DRAGON':'DRAGONS',shade,name:'TEAM SCORE',score:String(g.Score).padStart(7,'0'),
   round:`WAVE ${p.Wave} / ${p.BossWave}`,high:boss?`${boss.HP} / ${boss.MaxHP}`:`${survivors} / ${p.Slots.filter(s=>s!=='empty').length}`,lives:'',enemies:'',
   banner:award?`${partyNames[finisher!]} - LAST KILL!`:captured?'POP THE GIANT BUBBLE!':rest?`WAVE ${p.Wave+1} IN ${seconds}S`:prepare?`${wave} IN ${seconds}S`:go?`${wave} - GO!`:'',
   hint:award?`WAVE ${p.Wave} CLEAR!`:captured?'TOUCH IT TO FINISH':rest?'REST - COLLECT REWARDS':prepare?(p.Timer>90?'ENEMIES ARRIVING':p.Wave===1?'WAIT FOR GO!':'GET INTO POSITION'):go?(boss?'GRAB A THUNDER PICKUP':'CLEAR ALL ENEMIES'):'',
   detail:award?(g.State===4?'FINAL BOSS FINISHER':`NEXT WAVE IN ${seconds}S`):captured?'ANY DRAGON CAN DO IT':prepare?(p.Wave===1?'PRACTICE SHOTS - MOVE AT GO!':'MOVE, JUMP AND SHOOT'):boss&&go?'BLOW AND POP TO FIRE LIGHTNING':rest?'MOVE, JUMP AND SHOOT':go?'2S SAFE START - CLEAR ALL ENEMIES':'',
   showBanner:award||shade!=='result'&&(captured||rest||prepare||go),clear:rest,freeze:shade!=='result'&&!captured&&!rest&&!prepare&&!go?(boss?(boss.Mode==='windup'?'BOTTLE SPREAD - DODGE!':'POP THUNDER BUBBLES!'):survivors===1?'LAST DRAGON STANDING':''):''};
 }
 const p=s.profiles[s.active]!;const clear=g.State===2;const ready=g.State===0;const hurry=g.Hurry&&g.State===1&&g.LevelTicks<1980&&g.Tick%30<24;
 return {shade,name:g.Players.length===2?'TEAM SCORE':p.name,score:String(g.Score).padStart(7,'0'),round:`ROUND ${String(g.Level.number).padStart(2,'0')}`,high:String(Math.max(g.Score,p.high_score)).padStart(7,'0'),lives:`x${g.Players[0]?.Lives??0}`,enemies:g.Players.length===2?`x${g.Players[1]!.Lives}`:`ENEMIES ${String(g.Enemies.filter(e=>e.State!==2).length).padStart(2,'0')}`,banner:clear?'ROUND CLEAR!':ready?`ROUND ${String(g.Level.number).padStart(2,'0')}`:'HURRY UP!',hint:clear?`COLLECT YOUR BONUS  ${Math.ceil(g.Countdown/60)}`:ready?'GET READY':'',showBanner:clear||ready||hurry,clear,freeze:g.Freeze>0?`TIME STOP ${Math.ceil(g.Freeze/60)}`:''};
}
const sample:HudModel={shade:'normal',name:'PLAYER1',score:'0000000',round:'ROUND 01',high:'0000000',lives:'x3',enemies:'ENEMIES 03',banner:'ROUND 01',hint:'GET READY',showBanner:true,clear:false,freeze:''};
export const DesktopHudView=defineView<HudModel>({name:'DesktopHUD',samples:{ready:sample,playing:{...sample,showBanner:false},clear:{...sample,banner:'ROUND CLEAR!',hint:'COLLECT YOUR BONUS  3',clear:true}},render:model=><Screen safeArea class="desktop-screen desktop-hud-screen"><Widget doc="desktop-hud" id="desktop-hud" class="desktop-hud" props={{startCue:()=>model().startCue??'',startHint:()=>model().startHint??'',showStartCue:()=>!!model().showStartCue,startGo:()=>!!model().startGo,celebrationColor:()=>model().celebrationColor??'none',highTitle:()=>model().highTitle??'HIGH SCORE',party:()=>!!model().party,shade:()=>model().shade,name:()=>model().name,score:()=>model().score,round:()=>model().round,high:()=>model().high,lives:()=>model().lives,enemies:()=>model().enemies,banner:()=>model().banner,hint:()=>model().hint,detail:()=>model().detail??'',showBanner:()=>model().showBanner,clear:()=>model().clear,freeze:()=>model().freeze}}/></Screen>});
