/** Go's UI counter advances at 60 Hz; presentation never writes the deterministic world. */
export const walkFrame = (frame:number) => Math.floor(Math.max(0,frame)/10)%7;
export function menuBubble(index:number,frame:number) {
 const radius=8+(index%4)*5;
 let y=Math.floor(index*91-frame*(0.35+index%4*0.2))%720;
 if(y<0)y+=720;
 return {x:(index*137+39)%768+Math.round(Math.sin((frame+index*29)/90)*12),y,radius};
}

/** Short, staggered hops, then a quiet hold. Each dragon keeps its own space. */
export function menuDragon(index:number,frame:number,reduced=false) {
 const phase=((Math.max(0,frame)-index*12)%360+360)%360;
 const active=!reduced&&phase<48,t=active?phase/48:0;
 const hop=Math.round(Math.sin(t*Math.PI)*26);
 const sway=active?Math.round(Math.sin(t*Math.PI*2)*4):0;
 return {x:40+index*70+sway,y:596-hop,tick:active?phase:0,flip:index<5?1:-1};
}
