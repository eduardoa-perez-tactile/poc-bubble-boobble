// Numeric session configuration in pixels/tick, pixels, and simulation ticks.
// Jump, gravity, bounce, capture, and powerup acquisition rules stay separate.
export interface PlayerBalance {
  MoveSpeed: number;
  ShoesSpeed: number;
  BubbleSpeed: number;
  BlueBubbleSpeed: number;
  BubbleRange: number;
  PinkBubbleRange: number;
  FireCooldown: number;
  YellowFireCooldown: number;
}
export const productionPlayerBalance: Readonly<PlayerBalance> = Object.freeze({
  MoveSpeed: 2.5,
  ShoesSpeed: 3.5,
  BubbleSpeed: 6,
  BlueBubbleSpeed: 9,
  BubbleRange: 160,
  PinkBubbleRange: 240,
  FireCooldown: 24,
  YellowFireCooldown: 12,
});
// Explicit original numeric configuration for source-oracle audits; gameplay
// selects production defaults. There is no environment-dependent sim branch.
export const referencePlayerBalance: Readonly<PlayerBalance> = Object.freeze({
  MoveSpeed: 3,
  ShoesSpeed: 5,
  BubbleSpeed: 8,
  BlueBubbleSpeed: 16,
  BubbleRange: 200,
  PinkBubbleRange: 400,
  FireCooldown: 18,
  YellowFireCooldown: 5,
});
