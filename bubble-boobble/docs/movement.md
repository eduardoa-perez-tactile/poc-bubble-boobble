# Round 1 movement slice

The desktop start scene is `scenes/round1.scene.json`: exact imported round-one tiles,
original green dragon frames, 60-tick ready delay, movement, one-way ascent/swept landing,
wall clamps, ceiling, vertical wrap, jump buffer and coyote time. Arrow keys or A/D/W;
Escape toggles pause. Space is reserved for reference bubble fire in the next slice.

`npm run harness:editor` opens/reuses this project. `npm run harness:reset` now starts
Play and resets `port.movement` (the named movement scenario). The editor stays open.
The starter remains in `scenes/main.scene.json` with its existing reset cheat/tests.
`npm run harness:hot-reload` verifies movement reload (0.271 s changed / 0.269 s restored),
world retention and execution of the changed/restored reset code. The older
`harness:starter-hot-reload` probe requires that starter scene; it is not movement coverage.

## Evidence and limits

`npm run harness:quick` checks all cached fixture provenance, comparator self-tests and
movement T0 cases. `npm run harness:verify` runs all T0, desktop T1, both replays and check.
The fixture generator supports all `movement-*` scenario names alongside the original
reference smoke scenario. Oracle generation runs twice and runs upstream simulation tests.

Eight controlled scenarios compare every player field represented by the movement slice,
walked distance, jumps, tick, pause and jump sound events exactly, each frame. The overlay
calls upstream `updatePlayer` unchanged and excludes enemies, bubbles and bonus processing;
this is **movement projection parity**, never full-match parity. Initial state comes from
scenario inputs, including an obstructed spawn resolved independently by each runner.
Player powers are explicitly outside this projection. Additional T0 cases cover ready, semantic input and held/released physical arrow keys.
T1 captures at 768x720, 1680x720 and 640x960 check containment and <=4 draws; reviewed visually.
Go-versus-Tactile automated visual parity is pending, as are combat and campaign progression.

The overlay/driver gained an explicit controlled movement mode; the original smoke fixture
changed only its provenance hashes. Imported campaign bytes match the existing pinned hash.
The scene generator (`node tools/port/import.mjs`, then `gameengine fmt`) reads these bytes.
Metadata GUIDs survive regeneration. Reference pixels/float64 state are separate from
presentation-only VisualOffset/Sprite fields; no engine physics approximation is used.

The installed replay CLI ignores a test's scene option and loads the project default.
The harness therefore verifies the retained starter replay with the installed V8 host's
explicit `--scene`, discovered through `gameengine doctor`; movement uses the normal CLI.
The starter replay was recorded again after adding input actions. It is not rebased to the
movement world. Both actual replay verifications must pass; missing coverage is not a pass.

2026-10-14, Apple M2 Max, installed release V8/Metal host: quick 0.744 s; full verify 6.012 s;
editor scenario reset 1.150 s. A paused headless 600-step movement capture measured sim-step
p95 0.057 ms, max 1.56 ms, GC max 0.12 ms, no >4 ms pauses, ~64 MB process memory.
The reference-size rendered board used two draw calls. Headless frame/script aggregates
include protocol batching and are not device frame-time estimates. Real GPU/thermal
measurements and heavier combat budgets remain pending. Hermes is absent (the explicit
`--js both` probe fails), CI runtime provisioning and release pipeline recording remain pending.
The opaque border warning on tile 12 is original artwork, intentionally preserved.
