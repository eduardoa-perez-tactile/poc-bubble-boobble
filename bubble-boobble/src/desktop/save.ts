import { defineMeta, refuse } from '@gameengine/meta';
import { metaInWorld } from '@gameengine/meta/world';
import type { Level } from '../arcade/types.ts';
import { validateLevel } from './editor.ts';
import { cycleDragonSkin, isDragonSkin, type DragonSkin } from './skins.ts';
export interface Profile {name:string;avatar:DragonSkin;high_score:number;best_round:number;played:number;won:number;lost:number;xp:number}
export interface DesktopSave {profiles:Profile[];active:number;settings:{music:number;sound:number;fullscreen:boolean;reducedEffects?:boolean};custom_level:Level|null}
const profile=(name:string):Profile=>({name,avatar:'green',high_score:0,best_round:1,played:0,won:0,lost:0,xp:0});
// strings.TrimSpace/ToUpper in Go do not expand a Unicode rune into ASCII letters.
const trimName=(name:string)=>name.replace(/^[\t\n\v\f\r \u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+|[\t\n\v\f\r \u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+$/g,'');
const upperName=(name:string)=>Array.from(name,c=>{const upper=c.toUpperCase();return Array.from(upper).length===1?upper:c;}).join('');
export function validateName(name:string):string {
 const bytes=Array.from(name,c=>{const n=c.codePointAt(0)!;return n<128?1:n<2048?2:n<65536?3:4;}).reduce((sum,n)=>sum+n,0);
 if(name!==trimName(name)||bytes<1||bytes>16)return 'use 1 to 16 characters';
 if(!/^[A-Za-z0-9 _-]+$/.test(name))return 'use letters, numbers, spaces, - or _';
 return '';
}
export const validName=(name:string)=>validateName(name)==='';
export const initialDesktopSave:DesktopSave={profiles:[profile('PLAYER1')],active:0,settings:{music:50,sound:75,fullscreen:false},custom_level:null};
export const desktopSave = defineMeta({name:'bubblebobble-desktop',version:1,initial:initialDesktopSave,
  actions:{
    create:(s:DesktopSave,name:string)=>{name=upperName(trimName(name));const error=validateName(name);if(error)refuse(error);if(s.profiles.length>=8)refuse('all eight profile slots are occupied');if(s.profiles.some(p=>p.name.toUpperCase()===name))refuse('that profile already exists');return {...s,profiles:[...s.profiles,profile(name)],active:s.profiles.length};},
    select:(s:DesktopSave,index:number)=>index>=0&&index<s.profiles.length?{...s,active:index}:s,
    setting:(s:DesktopSave,p:{action:string;delta:number})=>{if(p.action==='effects')return {...s,settings:{...s.settings,reducedEffects:!s.settings.reducedEffects}};if(p.action==='avatar')return {...s,profiles:s.profiles.map((v,i)=>i===s.active?{...v,avatar:cycleDragonSkin(v.avatar,p.delta)}:v)};if(p.action==='fullscreen')return {...s,settings:{...s.settings,fullscreen:!s.settings.fullscreen}};if(p.action==='music'||p.action==='sound')return {...s,settings:{...s.settings,[p.action]:(s.settings[p.action]+p.delta+125)%125}};return s;},
    custom:(s:DesktopSave,level:Level)=>{const error=validateLevel(level);if(error)refuse(error);return {...s,custom_level:level};},
    record:(s:DesktopSave,p:{won:boolean;score:number;round:number})=>({...s,profiles:s.profiles.map((v,i)=>i!==s.active?v:{...v,played:v.played+1,won:v.won+(p.won?1:0),lost:v.lost+(p.won?0:1),xp:v.xp+(p.won?75:25),high_score:Math.max(v.high_score,p.score),best_round:Math.max(v.best_round,p.won?25:Math.min(25,Math.max(1,p.round)))})}),
  },invariants:{valid:(s:DesktopSave)=>s.profiles.length>=1&&s.profiles.length<=8&&Number.isInteger(s.active)&&s.active>=0&&s.active<s.profiles.length&&new Set(s.profiles.map(p=>p.name.toUpperCase())).size===s.profiles.length&&s.profiles.every(p=>validName(p.name)&&isDragonSkin(p.avatar)&&p.played>=0&&p.won>=0&&p.lost>=0&&p.played===p.won+p.lost&&[p.played,p.won,p.lost,p.xp,p.high_score,p.best_round].every(Number.isInteger)&&p.xp>=0&&p.high_score>=0&&p.best_round>=1&&p.best_round<=25)&&Number.isInteger(s.settings.music)&&Number.isInteger(s.settings.sound)&&s.settings.music>=0&&s.settings.music<=100&&s.settings.sound>=0&&s.settings.sound<=100&&(!s.custom_level||!validateLevel(s.custom_level))},
});
export const desktopSaveState=metaInWorld(desktopSave,{persist:true});
export const leaderboard=(s:DesktopSave)=>[...s.profiles].sort((a,b)=>b.high_score-a.high_score||b.won-a.won);
