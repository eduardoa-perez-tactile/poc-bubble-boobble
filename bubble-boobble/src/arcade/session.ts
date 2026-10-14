import { defineDoc } from '@gameengine/runtime';
import type { DocHandle, DocValue } from '@gameengine/runtime';
import type { GameState } from './types.ts';
export type ArcadeSession = { active: boolean; mode: string; game: GameState | null };
// Ordered reference collections and logical IDs are authoritative world document state.
// Only mutable actor paths are copied each step; campaign/level content is shared.
export const session = defineDoc('arcade.session', { active: false, mode: 'campaign', game: null } as DocValue) as unknown as DocHandle<ArcadeSession>;
