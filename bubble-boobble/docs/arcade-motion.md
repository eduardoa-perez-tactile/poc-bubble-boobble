# Arcade-derived player motion

Production player motion now uses a separate jump curve and steady ledge falls,
instead of the Go remake's 0.5 px/tick acceleration and 12 px/tick fall cap.
This is an arcade-derived approximation, not a claim of measured original-ROM parity.

The reference is [BubNext revision 47ad995](https://github.com/dave18/BubNext/tree/47ad995e0488beb40f673729e4145cad24fc843f),
an arcade-derived Spectrum Next port. The relevant routines are `call_42E3`
(ledge fall), `call_46D4` (movement cadence), `call_4912`/`call_4926` (jump updates)
and `data_4AED` (jump displacement/duration table) in `project/src/game.asm`.
`data_1276` and `data_12A7` in `bank0000.asm` provide the normal and shoes cadences;
player initialization selects index 12, and the shoes pickup selects index 19.
Arcade-sized eight-pixel tiles correspond to our 24-pixel tiles: scale 3.

| Behavior | Production motion at 60 simulation ticks/second |
| --- | --- |
| Normal ledge fall | Four 3-pixel steps and one 6-pixel step per five ticks: average 3.6 px/tick |
| Shoes ledge fall | Nine 6-pixel steps and one 3-pixel step per ten ticks: average 5.7 px/tick |
| Jump | 61 movement substeps: stepped rise, apex pause, stepped descent |
| Maximum jump rise | 126 game pixels, with or without shoes |
| Jump to same-height floor from phase zero | 51 ticks normal; 32 ticks with shoes |
| Bubble bounce | Restarts the jump curve; holding Jump still permits bouncing |

Cadence continues while grounded, so a jump started at another phase can vary by
one tick. Existing horizontal tuning (2.5/3.5 px/tick) is retained. One-way platforms,
swept landing checks, and the requested upward/downward screen wrapping remain.
Downward wraps preserve the fall cadence instead of restarting acceleration.
Enemy, defeated-enemy, projectile and item motion retain their independent rules.
Old externally injected upward velocities remain supported until their apex;
ordinary player jumps and bubble boosts always start the new curve.

`MotionTick` and `JumpStep` are authoritative player document state. Copies retain
them; pause freezes them; respawn and level loads create fresh player state.
They are excluded only from the historical Go snapshot projection, whose original
fields remain compared exactly. `referencePlayerBalance.ArcadeMotion = false`
retains the old Go motion for source-oracle tests. Production defaults to true,
including older sessions without the new configuration field.

AI navigation starts jumps with the same helper and simulates the same cadence,
shoes state, collision and wrap rules. Its graph rebuilds when the motion profile
changes and its rollout horizon includes the longer steady falls.

`arcade-player-motion.test.ts` checks both players, free falls, jump milestones,
shoes, real campaign platform reach, bubble boosts, wrapping, copy isolation and
Go-profile compatibility. Three engine-input replays cover normal/shoes falls
and the complete jump with pause/resume. The quick harness includes these tests;
replay verification supplies the recorded arcade scene explicitly.
The earlier exact traversal traces in `arcade-balance-traversal.test.ts` now
explicitly select the historical ballistic profile rather than asserting that
its previous jump timings still describe the new production motion.
