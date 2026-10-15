import type { DesktopState } from './state.ts';
import { leaderboard, type DesktopSave } from './save.ts';
import { editorTools } from './editor.ts';
export interface DesktopButton {key:string;label:string}
const button=(key:string,label:string):DesktopButton=>({key,label});
export function getDesktopButtons(s:DesktopState,p:DesktopSave):DesktopButton[]{
 switch(s.screen){
 case 'title':return [button('menu','PRESS ENTER TO START')];
 case 'menu':return [button('start','START GAME'),button('profiles','PROFILES'),button('scores','HIGH SCORES'),button('editor','LEVEL EDITOR'),button('settings','SETTINGS'),button('help','HOW TO PLAY'),button('credits','CREDITS'),button('quit','QUIT')];
 case 'profiles':return [...p.profiles.map((v,i)=>button(`profile:${i}`,`${i===p.active?'* ':''}${v.name}`)),button('new-profile','NEW PROFILE'),button('menu','BACK')];
 case 'new-profile':return [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('').map(c=>button(`char:${c}`,c)),button('char: ','SPACE'),button('delete-char','DEL'),button('create-profile','CREATE PROFILE'),button('profiles','CANCEL')];
 case 'settings':return [button('avatar',`DRAGON: ${p.profiles[p.active]!.avatar.toUpperCase()}`),button('music',`MUSIC: ${p.settings.music}%`),button('sound',`SOUND: ${p.settings.sound}%`),button('fullscreen',`FULLSCREEN: ${p.settings.fullscreen?'ON':'OFF'}`),button('play-mode',`MODE: ${s.playMode==='ai'?'AI CO-OP':s.playMode==='human'?'HUMAN CO-OP':'SOLO'}`),button('menu','BACK')];
 case 'pause':return [button('resume','RESUME'),button('restart','RESTART'),button('leave',s.custom?'BACK TO EDITOR':'END RUN')];
 case 'result':return [button('restart','PLAY AGAIN'),button('leave',s.custom?'BACK TO EDITOR':'MAIN MENU')];
 case 'editor':return [button('template-prev','<'),button('template',`COPY ROUND ${String(s.template+1).padStart(2,'0')}`),button('template-next','>'),button('new','NEW'),button('undo','UNDO'),...editorTools.map((t,i)=>button(`tool:${i}`,`${i===s.tool?'> ':''}${t}`)),button('save-level','SAVE'),button('load-level','LOAD'),button('test-level','PLAY TEST'),button('menu','BACK'),button('element',`BUBBLES: ${s.level.special.toUpperCase()||'NONE'}`),button('theme',`TILE: ${String(s.level.number).padStart(2,'0')}`)];
 case 'play':return [];
 default:return [button('menu','BACK')];
 }
}
const help='MOVE — LEFT / RIGHT OR A / D\nJUMP — UP OR W - HOLD TO BOUNCE ON BUBBLES\nBLOW BUBBLES — SPACE OR CTRL - TOUCH A BUBBLE TO POP IT\nTAKE A BREAK — ESC TO PAUSE / F11 FULLSCREEN / M MUTE\nGAMEPAD — STICK OR D-PAD / A JUMP / X FIRE / START PAUSE\nBONUSES — CANDIES, SHOES, RINGS, PARASOLS, CLOCK, DYNAMITE\nELEMENTS — WATER FLOWS, LIGHTNING STRIKES, FIRE SPREADS\nCO-OP — CHOOSE MODE IN SETTINGS / PLAYER 2: J L MOVE, I JUMP, K FIRE\nSURVIVE — 3 LIVES / ENEMIES GET ANGRY AFTER 30 SECONDS';
export function desktopModel(s:DesktopState,p:DesktopSave,frame=0,nativeFullscreen=false){
 const profile=p.profiles[p.active]!;let title='',subtitle='',body='';
 switch(s.screen){case 'title':case 'menu':subtitle=`${profile.name}  /  BEST ${String(profile.high_score).padStart(7,'0')}${!s.playMode||s.playMode==='solo'?'':s.playMode==='ai'?'  /  AI CO-OP':'  /  HUMAN CO-OP'}`;break;

 case 'profiles':title='PLAYER PROFILES';subtitle='SELECT A PLAYER OR CREATE A NEW PROFILE';break;
 case 'new-profile':title='NEW PLAYER';subtitle='YOUR NAME: UP TO 16 LETTERS OR NUMBERS';body=s.name+'_';break;
 case 'settings':title='SETTINGS';subtitle='ENTER TO CHANGE / LEFT AND RIGHT TO ADJUST';body=`${profile.name} / PLAYER LEVEL ${Math.floor(profile.xp/100)+1}\nPLAYED ${profile.played} WON ${profile.won} LOST ${profile.lost} XP ${profile.xp}`;break;
 case 'scores':title='HIGH SCORES';subtitle='LOCAL PLAYERS / ALL CAMPAIGN RUNS';body='PLAYER       SCORE       ROUND       W / L\n'+leaderboard(p).map(v=>`${v.name}   ${String(v.high_score).padStart(7,'0')}   ${String(v.best_round).padStart(2,'0')}   ${v.won}/${v.lost}`).join('\n');break;
 case 'help':title='HOW TO PLAY';subtitle='TRAP THE ENEMIES. POP THE BUBBLES. COLLECT THE FRUIT.';body=help;break;
 case 'credits':title='CREDITS';subtitle='A FAN REMAKE OF THE ARCADE CLASSIC';body='ORIGINAL GAME AND CHARACTERS\nTAITO\n\nGAME ADAPTATION AND LEVEL DESIGN\nMALAKH SOFTWARE - 2026\n\nGO EDITION POWERED BY EBITENGINE\n\nSOFTWARE LICENSE: MIT\nARTWORK AND AUDIO BELONG TO THEIR OWNERS';break;
 case 'pause':title='PAUSED';break;
 case 'result':title=s.won?'YOU WIN!':'GAME OVER';subtitle=s.custom?'CUSTOM LEVEL PLAY TEST COMPLETE':s.won?'ALL 25 ROUNDS CLEARED. WELL PLAYED!':'A NEW ADVENTURE IS ONE BUBBLE AWAY.';body=`SCORE ${String(s.score).padStart(7,'0')}\n${s.custom?'':`BEST ${String(profile.high_score).padStart(7,'0')} / LEVEL ${Math.floor(profile.xp/100)+1} / XP ${profile.xp}`}`;break;
 }
 const buttons=getDesktopButtons(s,p).map((b,i)=>({...b,selected:i===s.selected}));
 const rows:{key:string;cells:{key:string;label:string;image:string}[]}[]=[];
 const profiles=p.profiles.map((v,i)=>({key:`profile:${i}`,label:`${i===p.active?'* ':''}${v.name}`,avatar:v.avatar,selected:i===s.selected}));
 const scores=leaderboard(p).map((v,i)=>({key:String(i),name:v.name,score:String(v.high_score).padStart(7,'0'),round:String(v.best_round).padStart(2,'0'),record:`${v.won}/${v.lost}`}));
 const keyRows=Array.from({length:4},(_,i)=>({key:String(i),keys:buttons.slice(i*10,Math.min(36,i*10+10))}));
 return {resultScore:`SCORE  ${String(s.score).padStart(7,'0')}`,resultStats:`BEST ${String(profile.high_score).padStart(7,'0')}  /  LEVEL ${Math.floor(profile.xp/100)+1}  /  XP ${profile.xp}`,showResultStats:!s.custom,frame,name:s.name,avatar:profile.avatar,profiles,scores,keyRows,statsName:`${profile.name}  /  PLAYER LEVEL ${Math.floor(profile.xp/100)+1}`,stats:`PLAYED ${profile.played}  WON ${profile.won}  LOST ${profile.lost}  XP ${profile.xp}`,profileCount:p.profiles.length,enemyCount:`ENEMIES ${String(s.level.enemies.length).padStart(2,'0')} / 32`,selected:s.selected,page:s.screen,title,subtitle,body,status:s.status.toUpperCase()||(!nativeFullscreen&&p.settings.fullscreen&&s.screen==='settings'?'FULLSCREEN REQUIRES ENGINE WINDOW SUPPORT':''),buttons:s.screen==='new-profile'?buttons.slice(-2):buttons,keys:s.screen==='new-profile'?buttons.slice(0,-2):[],rows,logo:s.screen==='title'||s.screen==='menu',editor:s.screen==='editor',keyboard:s.screen==='new-profile',toolbar:buttons.slice(0,5),tools:buttons.slice(5,16),editorButtons:buttons.slice(16,20),footer:buttons.slice(20)};
}
export type DesktopModel=ReturnType<typeof desktopModel>;
