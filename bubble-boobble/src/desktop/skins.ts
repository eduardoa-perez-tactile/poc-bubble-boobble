// Stable saved names and settings order shared by profiles and presentation.
import { partyColors } from '../arcade/party-config';
export const dragonSkins = partyColors;
export type DragonSkin = typeof dragonSkins[number];
export function isDragonSkin(value: unknown): value is DragonSkin {
  return typeof value === 'string' && dragonSkins.some(skin => skin === value);
}
export function cycleDragonSkin(current: DragonSkin, direction = 1): DragonSkin {
  const index = dragonSkins.indexOf(current);
  return dragonSkins[(index + (direction < 0 ? -1 : 1) + dragonSkins.length) % dragonSkins.length]!;
}
