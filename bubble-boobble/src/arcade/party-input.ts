import { defineDoc } from '@gameengine/runtime';
import type { DocHandle, DocValue } from '@gameengine/runtime';
import type { Input } from './types';

import { partySize } from './party-config';
export const PARTY_INPUT_SLOTS = partySize;
export type PartyActionKind = 'Move' | 'Jump' | 'Fire' | 'Join' | 'Pause';
export interface PartyAction { slot:number; kind:PartyActionKind; value:number; pressed:boolean; justPressed:boolean }
/** Slot is zero-based. Only exact names party{Kind}{1..10} are accepted. */
export function readPartyAction(name:string,value:number,pressed:boolean,justPressed:boolean):PartyAction|null {
  for(const kind of ['Move','Jump','Fire','Join','Pause'] as const){
    const prefix=`party${kind}`;
    if(!name.startsWith(prefix))continue;
    const suffix=name.slice(prefix.length);
    if(!/^(?:[1-9]|10)$/.test(suffix))continue;
    const slot=Number(suffix)-1;
    if(slot>=0&&slot<PARTY_INPUT_SLOTS)return {slot,kind,value,pressed,justPressed};
  }
  return null;
}
/** Named actions are keyboard fallbacks; pad input is reduced separately below. */
export function applyPartyAction(inputs:Input[],action:PartyAction):void {
  const input=inputs[action.slot];if(!input)return;
  if(action.kind==='Move'&&action.value!==0)input.Move=action.value;
  if(action.kind==='Jump')input.Jump=input.Jump||action.pressed;
  if(action.kind==='Fire')input.Fire=input.Fire||action.pressed;
}
export interface PartyPadState {
  axis:number; axisY:number; left:boolean; right:boolean; up:boolean; down:boolean; jump:boolean; back:boolean; fire:boolean; start:boolean;
}
export interface PartyPadEvent {
  type:string; pad?:number; axis?:number; value?:number; button?:number; down?:boolean;
}
export interface PartyPadFrame {
  pads:PartyPadState[]; inputs:Input[]; joinedSlots:number[]; pause:boolean; menuXEdge:number; menuYEdge:number; menuConfirm:boolean; menuBack:boolean;
}
export function createPartyPads():PartyPadState[] {
  return Array.from({length:PARTY_INPUT_SLOTS},()=>({axis:0,axisY:0,left:false,right:false,up:false,down:false,jump:false,back:false,fire:false,start:false}));
}
/**
 * Reduce recorded raw engine input. The caller MUST store `pads` in a sim document/resource;
 * raw events describe changes, so this state must survive steps and replay/rollback.
 * SDL standard buttons: south=0, west=2, start=6, dpad left/right=13/14.
 */
export function reducePartyPadInput(previous:readonly PartyPadState[],events:readonly PartyPadEvent[]):PartyPadFrame {
  const pads=createPartyPads().map((pad,i)=>({...pad,...previous[i]}));
  const joinedSlots:number[]=[];let pause=false,menuConfirm=false,menuBack=false;
  for(const event of events){
    const slot=event.pad;
    if(slot===undefined||!Number.isInteger(slot)||slot<0||slot>=PARTY_INPUT_SLOTS)continue;
    const pad=pads[slot]!;
    if(event.type==='gamepadAxis'&&event.axis===0&&Number.isFinite(event.value))pad.axis=Math.max(-1,Math.min(1,event.value!));
    if(event.type==='gamepadAxis'&&event.axis===1&&Number.isFinite(event.value))pad.axisY=Math.max(-1,Math.min(1,event.value!));
    if(event.type!=='gamepadButton')continue;
    const down=event.down===true;
    if(event.button===0){if(down&&!pad.jump)menuConfirm=true;pad.jump=down;}
    if(event.button===1){if(down&&!pad.back)menuBack=true;pad.back=down;}
    if(event.button===2)pad.fire=down;
    if(event.button===11)pad.up=down;
    if(event.button===12)pad.down=down;
    if(event.button===13)pad.left=down;
    if(event.button===14)pad.right=down;
    if(event.button===6){
      if(down&&!pad.start){joinedSlots.push(slot);pause=true;}
      pad.start=down;
    }
  }
  const inputs=pads.map(pad=>({Move:pad.left||pad.right?Number(pad.right)-Number(pad.left):Math.abs(pad.axis)<0.25?0:pad.axis,Jump:pad.jump,Fire:pad.fire}));
  let menuXEdge=0,menuYEdge=0;
  for(let i=0;i<PARTY_INPUT_SLOTS;i++){
    const pad=pads[i]!,old=previous[i];
    const x=menuDirection(pad.axis,pad.left,pad.right),y=menuDirection(pad.axisY,pad.up,pad.down);
    if(x&&x!==menuDirection(old?.axis??0,old?.left??false,old?.right??false)&&!menuXEdge)menuXEdge=x;
    if(y&&y!==menuDirection(old?.axisY??0,old?.up??false,old?.down??false)&&!menuYEdge)menuYEdge=y;
  }
  return {pads,inputs,joinedSlots,pause,menuXEdge,menuYEdge,menuConfirm,menuBack};
}

function menuDirection(axis:number,negative:boolean,positive:boolean):number {
  const value=negative||positive?Number(positive)-Number(negative):axis;
  return Math.abs(value)<0.5?0:value<0?-1:1;
}

export const partyPads = defineDoc('party-pads', { pads:createPartyPads() } as unknown as DocValue) as unknown as DocHandle<{pads:PartyPadState[]}>;
/** Call exactly once per sim step, including lobby and pause steps. */
export function updatePartyPads(events:readonly PartyPadEvent[]):PartyPadFrame {
  const frame=reducePartyPadInput(partyPads.get().pads,events);
  if(events.some(event=>event.type==='gamepadButton'||event.type==='gamepadAxis'))partyPads.set({pads:frame.pads});
  return frame;
}
export function resetPartyPads():void { partyPads.set({pads:createPartyPads()}); }
