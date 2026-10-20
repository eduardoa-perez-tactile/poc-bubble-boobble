/** Portable URL helpers: the game VM deliberately has no DOM or URL global. */
export interface OnlineInvitation { room: string; humans: number }
export function validRoom(room: string): boolean { return /^[0-9]{6}$/.test(room); }
export function validHumans(humans: number): boolean { return Number.isInteger(humans) && humans >= 1 && humans <= 10; }
function queryValue(link: string, key: string): string | undefined {
 const query=link.split('#')[0]!.split('?')[1]??'';
 for(const pair of query.split('&')){const i=pair.indexOf('=');if(i<0)continue;try{if(decodeURIComponent(pair.slice(0,i))===key)return decodeURIComponent(pair.slice(i+1).replace(/\+/g,' '));}catch{return undefined;}}
 return undefined;
}
export function parseInvitation(link: string): OnlineInvitation | null {
 const room=queryValue(link,'room'),raw=queryValue(link,'humans');
 if(!room||!raw||!/^\d{1,2}$/.test(raw))return null;
 const humans=Number(raw);return validRoom(room)&&validHumans(humans)?{room,humans}:null;
}
export function browserGameUrl(link: string): string | null {
 const clean=link.split(/[?#]/)[0]!;
 if(!/^https?:\/\/[^/]+\//.test(clean))return null;
 return clean.endsWith('/')?clean:clean.slice(0,clean.lastIndexOf('/')+1);
}
export function officeArcadeSocket(link: string): string | undefined {
 const base=browserGameUrl(link);
 if(!base)return undefined;
 // Only Office Arcade serves the per-game socket. GitHub Pages remains offline.
 if(!/^https:\/\/webgames\.tactilews\.com\/[^/]+\/$/.test(base))return undefined;
 return base.replace(/^https:/,'wss:')+'socket';
}
export function invitationLink(link: string,room: string,humans: number): string {
 const base=browserGameUrl(link);return base&&validRoom(room)&&validHumans(humans)?`${base}?room=${room}&humans=${humans}`:'';
}
export function onlineError(code: string,message=''): string {
 if(code==='E_MISMATCH')return 'Room settings or game version differ. Use the same link and human count.';
 if(/BUILD|VERSION|COMPAT/.test(code))return 'Different game version. Everyone must reload the same game link.';
 if(/FULL|STARTED/.test(code))return 'This room is full or already playing. Choose a new room code.';
 if(/CONNECT|SOCKET|CLOSED|TIMEOUT/.test(code))return 'Connection lost. Try reconnecting to your seat while other players remain.';
 return message||`Could not join (${code}). Try a new room code.`;
}
