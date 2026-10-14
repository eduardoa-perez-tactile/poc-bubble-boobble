import { createMemo, Sprite, View, type Accessor } from '@gameengine/ui';
/** Go's UI counter advances at 60 Hz; presentation never writes the deterministic world. */
export const walkFrame = (frame:number) => Math.floor(Math.max(0,frame)/10)%7;
export const walkSprite = (avatar:string,frame:number) => `reference/${avatar}/walk/${walkFrame(frame)}`;
export function menuBubble(index:number,frame:number) {
 const radius=8+(index%4)*5;
 let y=(index*91-Math.floor(frame/2))%720;
 if(y<0)y+=720;
 return {x:(index*137+39)%768,y,radius};
}
export function MenuBubbles(p:{frame:Accessor<number>}) {
 const frame=createMemo(()=>Math.floor(p.frame()/2)*2);
 return View({class:'desktop-menu-bubbles',children:Array.from({length:18},(_,i)=>{
  const radius=8+(i%4)*5;
  return View({id:`desktop-bubble-${i}`,class:'desktop-menu-bubble',style:()=>{const b=menuBubble(i,frame());return {left:b.x-radius,top:b.y-radius,width:radius*2,height:radius*2};}});
 })});
}
export function MenuDragons(p:{frame:Accessor<number>}) {
 const frame=createMemo(()=>walkFrame(p.frame()));
 return View({class:'desktop-menu-dragons',children:[Sprite({id:'desktop-green-dragon',class:'desktop-menu-green',src:()=>`reference/green/walk/${frame()}`,flip:'x'}),Sprite({id:'desktop-blue-dragon',class:'desktop-menu-blue',src:()=>`reference/blue/walk/${frame()}`})]});
}
export function ProfileDragon(p:{frame:Accessor<number>;avatar:Accessor<string>}){
 const frame=createMemo(()=>walkFrame(p.frame()));
 return Sprite({class:'desktop-settings-dragon',src:()=>`reference/${p.avatar()}/walk/${frame()}`});
}
