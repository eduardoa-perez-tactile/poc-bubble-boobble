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
