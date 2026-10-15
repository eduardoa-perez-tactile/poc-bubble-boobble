import type { PartySlot } from './types';
/** Fixed identities and spawn areas for the first shared-screen prototype. */
export const partyColors = ['green','blue','red','yellow','purple','orange'] as const;
export const partySpawnColumns = [3,8,13,18,23,28] as const;
export const defaultPartySlots: PartySlot[] = ['human','ai','ai','ai','ai','ai'];
export const partyPrepareTicks = 180;
export const partyBreakTicks = 300;
