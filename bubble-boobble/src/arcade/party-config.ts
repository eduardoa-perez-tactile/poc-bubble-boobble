import { alive, type GameState, type PartySlot } from './types';
export const partyColors = ['green','blue','red','yellow','purple','orange','cyan','pink','ivory','slate'] as const;
// Bub and Bob are the original Taito pair; the remaining names are our cast.
export const partyNames = ['BUB','BOB','EMBER','SUNNY','PLUM','TANGO','MIST','ROSIE','PEARL','FLINT'] as const;
export const partySize = partyColors.length;
export const partySpawnColumns = [3,8,13,18,23,28] as const;
export const partySpawns = [4,12,20,28,36].flatMap(col=>[{col,row:29},{col,row:24}]);
export function partySpawn(index:number, count:number) {
  return count>6 ? partySpawns[index]! : {col:partySpawnColumns[index]!,row:25};
}
export const defaultPartySlots: PartySlot[] = partyColors.map((_,i)=>i===0?'human':'ai');
export const partyPrepareTicks = 180;
export const partyBreakTicks = 300;
export function partySurvivorCount(g:GameState):number {
  return g.Players.reduce((count,dragon,index)=>count+(g.Party!.Slots[index]!=='empty'&&alive(dragon)?1:0),0);
}

export const partyStartGraceTicks=120;
export const partyLastKillTicks=120;
export function recordPartyLastKill(g:GameState,slot:number|undefined) {
 const p=g.Party;
 if(!p||!['combat','boss'].includes(p.Phase)||slot===undefined||!Number.isInteger(slot)||slot<0||slot>=p.Slots.length||p.Slots[slot]==='empty'||p.LastKill?.Wave===p.Wave)return;
 p.LastKill={Slot:slot,Wave:p.Wave,Tick:g.Tick};
}
export function partyFinisher(g:GameState):number|undefined {
 const last=g.Party?.LastKill;
 return last&&last.Wave===g.Party!.Wave&&(g.Tick-last.Tick<partyLastKillTicks||g.State===4)?last.Slot:undefined;
}

/** Credit the dragon that finishes the enemy, including elemental and boss kills. */
export function recordPartyKill(g:GameState,slot:number|undefined) {
 const p=g.Party;
 if(!p||slot===undefined||!Number.isInteger(slot)||slot<0||slot>=p.Slots.length||p.Slots[slot]==='empty')return;
 p.Kills??=p.Slots.map(()=>0);
 p.Kills[slot]=(p.Kills[slot]??0)+1;
}
export interface DragonResult {slot:number;kills:number;mode?:'human'|'ai'}
export function partyRanking(g:GameState):DragonResult[] {
 return g.Party?g.Party.Slots.flatMap((mode,slot)=>mode==='empty'?[]:[{slot,kills:g.Party!.Kills?.[slot]??0,mode}]).sort((a,b)=>b.kills-a.kills||a.slot-b.slot):[];
}
