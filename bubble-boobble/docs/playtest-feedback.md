# October 15 playtest corrections

The comparison source remains `olivierh59500/go-bubblebobble` at
`783cf6aa26ac3c57cdab43f2d7a5b3725a3991cc`, pinned in
`tools/harness/reference.lock.json`. Original fixtures and imported art remain
reference evidence, rather than expectations rewritten to match these changes.

## Enemy speed

Before this tuning change the port used the original speed: ordinary enemies move 2.5 pixels per tick
(150 pixels/second at 60 Hz); angry enemies move 3.5 (210 pixels/second).
Invaders multiply these speeds by 1.5. Pulpul retains the original sinusoidal
movement. At that point the player moved 3 pixels per tick, or 5 with shoes.
The later [player balance tuning](player-balance.md) now sets 2.5/3.5 and
reduces bubble speed, range and firing frequency.

The Go entry point calls `ebiten.SetTPS(60)` and advances the match once per
update. The engine project uses a 1/60-second fixed step, and `ArcadeStep`
advances the match once per fixed step. Hurry-up starts after 1,800 unfrozen
playing ticks (30 active seconds); trapped-enemy escape can also cause anger.
The first five rounds were compared against the pinned Go oracle for 361
snapshots each: all 1,805 complete canonical states matched.

The player then requested 20% slower normal enemies. Production games now start
with authoritative `NormalEnemySpeedScale = 0.8`: ordinary movement is 2 pixels
per tick (120 pixels/second), and normal Invaders move 3 (180 pixels/second).
Both axes of Monsta and the complete Pulpul movement expressions are scaled.
Angry/hurry-up movement, jump impulses, gravity, projectiles, attack cooldowns,
and the 30-second hurry timer retain their original values. The scale persists
through level transitions and copied session state.

Reproduce the CPU-only source comparison with
`node tools/harness/enemy-speed-audit.mjs` after `npm run harness:setup`.
It rebuilds the pinned oracle, verifies source/toolchain/campaign provenance,
and checks those 1,805 states plus six pause/freeze/hurry boundary states using
the explicit source configuration (`NormalEnemySpeedScale = 1` and
`PlayerBalance = referencePlayerBalance`). The unchanged
Go fixtures in the other pure/engine input oracle tests also select that profile;
they are not claims that the new playable difficulty matches original Go state.
The dev-only `arcade.reset` cheat exposes the numeric scale for controlled tests.
`tests/arcade-enemy-speed.test.ts` separately checks the production default and
normal/angry movement and timing rules.

## Player traversal

The pinned Go `moveActor` clamps all actors to `Y >= Tile`. The port translated
that correctly, but it prevents the requested upward traversal. The playable
arcade scene now treats player movement separately: upper platforms remain
one-way on ascent, and an upward exit through aligned top and bottom openings
returns the player at the bottom with upward velocity preserved. Existing
downward wrapping and enemy movement retain their previous behavior.

This is an intentional gameplay correction requested after playtesting, rather
than a claim that the Go implementation supports upward wrapping. The isolated
`round1.scene` movement prototype retains its historical reference tests.

## Item proportions

Go's `sprite` helper stretches source images into square destination boxes.
The port copied that behavior, including 15-by-10 candy art stretched to 32-by-32
pickups and 24-by-24 HUD icons. Pickups and their HUD/editor icons now retain
source aspect ratio, centered inside their existing destination boxes. Square
art and gameplay collision dimensions are unaffected. This intentionally
improves on the reference's item presentation; imported texels are unchanged.

## Verification scope

Local macOS arm64 V8/Metal validation on October 15:

- `npm run harness:verify-full`: passed in 44.851 seconds; 109 logic tests,
  15 visual tests, five independent replay verifications, typecheck, validation,
  desktop cook, 600-step cooked smoke, and asset provenance/alias checks.
- Cold live viewport: all 34,380 tested tile-band pixels present, 1,136 green
  player pixels, five draws and 1,065 triangles, without an offscreen warm-up.
- Original-speed Go comparisons and the separate six-kind production movement
  audit pass; original Go fixtures and art bytes are unchanged.
- The real round-three upward traversal is tested through a recorded cheat,
  input event and `ArcadeStep`, then independently replayed with world hashes.
- All-tier presentation recording observed every required page/effect over 627
  steps and 210 rendered frames per tier. Peak draws are 11/9/9 for
  desktop/mobile/compat, below the existing limit of 14. No new material program
  was required. Desktop protocol-driven CPU p95 was 1.237 ms per simulation
  step and 2.584 ms per sampled presentation frame, with 211 MiB process memory;
  these are desktop host observations, not real-time or phone performance.
- Five existing visual baselines changed for item dimensions or enemy positions;
  two new captures cover all pickups/HUD powers and editor item icons. Screenshot
  thresholds were not loosened.

The standalone editor's old accepted golden also contained smoothed edges absent
from the current renderer. An isolated render of exact pre-change `edf77f2`
confirmed this inherited difference: fresh old-code versus new-code rendering
differs only inside the two item boxes (491 pixels). The refreshed image therefore
does not conceal a new unrelated rendering change.

The longer original-speed campaign study reaches the changed ceiling in ten
rounds. Its exact comparisons stop at the first intentional boundary difference;
the remaining 15 round traces still compare all 1,261 frames. This does not claim
full reference parity after players take the newly permitted traversal path.
The audit verifies 25,315 matching prefix states and ten boundary frames with
only the expected player Y/VY differences. Nine comparator selftests pass,
including rejection of collateral score/RNG/player changes and proof that
post-boundary frames are not simulated or claimed.

Tests use the game-engine runtime and its rendering APIs. OS input/focus,
display-surface behavior, audio-device playback, and phone GPU/thermal behavior
are outside these checks. Computer-use access is not required or requested.
Hermes is not installed, so cross-runtime verification is deferred. The existing
original opaque tile-12 warning and the installed engine's unregistered built-in
Standard pipeline-program warning remain; neither required an engine change.
