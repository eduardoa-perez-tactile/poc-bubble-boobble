/** Go's UI counter advances at 60 Hz; presentation never writes the deterministic world. */
export const walkFrame = (frame:number) => Math.floor(Math.max(0,frame)/10)%7;
export function menuBubble(index:number,frame:number) {
 const radius=8+(index%4)*5;
 let y=(index*91-Math.floor(frame/2))%720;
 if(y<0)y+=720;
 return {x:(index*137+39)%768,y,radius};
}
