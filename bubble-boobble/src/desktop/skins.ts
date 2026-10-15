// Stable saved names and settings order shared by profiles and presentation.
export const dragonSkins = ['green', 'blue', 'red', 'yellow', 'purple', 'orange'] as const;
export type DragonSkin = typeof dragonSkins[number];
export function isDragonSkin(value: unknown): value is DragonSkin {
  return typeof value === 'string' && dragonSkins.some(skin => skin === value);
}
export function cycleDragonSkin(current: DragonSkin, direction = 1): DragonSkin {
  const index = dragonSkins.indexOf(current);
  return dragonSkins[(index + (direction < 0 ? -1 : 1) + dragonSkins.length) % dragonSkins.length]!;
}
