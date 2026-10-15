# Player vertical traversal

This is an intentional gameplay change requested during playtesting, beyond pinned
Go revision `783cf6aa26ac3c57cdab43f2d7a5b3725a3991cc`. Its
`internal/game/physics.go` clamps every actor to `Y >= Tile`; the TypeScript port
previously matched that clamp. The reference fixtures remain unchanged.

Players now pass upward through platforms without a blanket top clamp. After the
whole body exits above the board, an upward-moving player wraps through a paired
top/bottom opening that fits the full body. Adding `Height + ActorSize` preserves
overshoot and upward velocity, so the player rises visibly through the bottom gap.
A closed border does not wrap. Returning downward ignores the offscreen row-zero
roof, so a player cannot land entirely outside the visible board. Existing
bottom-to-top wrapping and enemy ceiling behavior remain unchanged.

Bubble jumping keeps the reference rules: hold jump while descending onto an
eligible bubble older than 20 ticks to receive a `-10.5` vertical boost without
popping it. That existing boost can now carry the player through a top opening.

`tests/arcade-player-traversal.test.ts` covers synthetic edge cases, co-op,
reference bubble eligibility, and real campaign rounds 1 and 3. These are explicit
player-traversal regressions, not claims of Go parity at the changed boundary.
