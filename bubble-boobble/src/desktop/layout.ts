import type { DesktopState } from './state.ts';
import type { DesktopSave } from './save.ts';
export interface DesktopRect {x:number;y:number;width:number;height:number}
/** Logical rectangles from the pinned Go App.buttons/editorButtons tables. */
export function desktopButtonRect(s:DesktopState,p:DesktopSave,index:number):DesktopRect|null {
 const rect=(x:number,y:number,width:number,height=38)=>({x,y,width,height});
 switch(s.screen){
 case 'party':return index<8?rect(164,160+index*54,440):null;
 case 'menu':if(index===0)return rect(218,328,332,44);if(index>=1&&index<=6)return rect(104+((index-1)%2)*290,392+Math.floor((index-1)/2)*52,270);return index===7?rect(264,570,240):index===8?rect(218,622,332):null;
 case 'profiles':if(index<p.profiles.length)return rect(164,132+index*46,440,36);return index===p.profiles.length?rect(164,532,440):index===p.profiles.length+1?rect(264,594,240):null;
 case 'new-profile':if(index<36)return rect(104+(index%10)*56,252+Math.floor(index/10)*48,48);return [rect(440,396,104),rect(552,396,104),rect(164,520,440),rect(164,570,440)][index-36]??null;
 case 'settings':return index<6?rect(164,180+index*50,440):null;
 case 'scores':case 'help':case 'credits':return index===0?rect(264,624,240):null;
 case 'pause':return index<(s.partyRun?4:3)?rect(164,320+index*50,440):null;
 case 'result':return index<2?rect(164,450+index*50,440):null;
 case 'editor':if(index<5){const x=[24,76,336,388,468][index]!,w=[40,248,40,68,68][index]!;return rect(x,91,w,30);}if(index<16)return rect(554,146+(index-5)*35,190,30);if(index<20)return rect([24,156,288,452][index-16]!,594,[116,116,148,84][index-16]!,30);return index===20?rect(24,642,304,30):index===21?rect(344,642,192,30):null;
 default:return null;
 }
}
