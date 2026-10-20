import { partySize } from '../arcade/party-config';
import type { DesktopState } from './state.ts';
import type { DesktopSave } from './save.ts';
export interface DesktopRect {x:number;y:number;width:number;height:number}
/** Logical rectangles from the pinned Go App.buttons/editorButtons tables. */
export function desktopButtonRect(s:DesktopState,p:DesktopSave,index:number):DesktopRect|null {
 const rect=(x:number,y:number,width:number,height=38)=>({x,y,width,height});
 switch(s.screen){
 case 'party':return index<partySize?partyCardRect(index):index===partySize?rect(242,612,284,44):index===partySize+1?rect(48,612,152,44):null;
 case 'menu':return index>=0&&index<3?rect(218,328+index*60,332,44):null;
 case 'modes':return index===0?rect(100,168,272,380):index===1?rect(396,168,272,380):index===2?rect(264,606,240,44):null;
 case 'profiles':if(index<p.profiles.length)return rect(164,132+index*46,440,36);return index===p.profiles.length?rect(164,532,440):index===p.profiles.length+1?rect(264,594,240):null;
 case 'new-profile':if(index<36)return rect(104+(index%10)*56,252+Math.floor(index/10)*48,48);return [rect(440,396,104),rect(552,396,104),rect(164,520,440),rect(164,570,440)][index-36]??null;
 case 'settings':return index<7?rect(164,154+index*50,440):null;
 case 'scores':case 'help':case 'credits':return index===0?rect(264,624,240):null;
 case 'pause':return index<(s.partyRun?4:3)?rect(164,320+index*50,440):null;
 case 'result':return index>=0&&index<2?rect(80+index*312,617,296,44):null;
 case 'editor':if(index<5){const x=[24,76,336,388,468][index]!,w=[40,248,40,68,68][index]!;return rect(x,91,w,30);}if(index<16)return rect(554,146+(index-5)*35,190,30);if(index<20)return rect([24,156,288,452][index-16]!,594,[116,116,148,84][index-16]!,30);return index===20?rect(24,642,304,30):index===21?rect(344,642,192,30):null;
 default:return null;
 }
}

/** Shared reference-canvas positions for UI hit targets and pixel portraits. */
export function partyCardRect(index:number):DesktopRect {return {x:24+(index%5)*146,y:132+Math.floor(index/5)*230,width:136,height:214};}
export function partyGridSelection(selected:number,x:number,y:number):number {
 if(selected<partySize){
   if(x)return Math.floor(selected/5)*5+(selected%5+x+5)%5;
   if(y<0)return selected>=5?selected-5:selected;
   if(y>0)return selected<5?selected+5:selected%5<2?partySize+1:partySize;
 }else{
   if(x)return selected===partySize?partySize+1:partySize;
   if(y<0)return selected===partySize?8:5;
 }
 return selected;
}

/** Mode cards navigate horizontally; the lower Back button is reachable vertically. */
export function modeGridSelection(selected:number,x:number,y:number):number {
 if(x&&selected<2)return selected===0?1:0;
 if(y>0&&selected<2)return 2;
 if(y<0&&selected===2)return 0;
 return selected;
}
