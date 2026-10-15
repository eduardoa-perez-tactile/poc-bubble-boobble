# Desktop port harness

Run commands from `bubble-boobble/`, one directory below the Git root. Node.js 22+
and the installed Tactile CLI/release V8 host are required; no npm install is needed. The
playable default is the arcade scene; the original starter and movement scenes
remain independent regression targets. [movement.md](movement.md) documents the
first slice; [numerics.md](numerics.md) explains exact Go arithmetic and RNG.

## Testing boundary

All automated gameplay and UI testing uses the Game Engine: tests, recorded physical
key events, replays, headless sessions, readback viewports, render probes and engine
screenshots. The harness does not require desktop/computer-use access.

Do not launch standalone builds, invoke `npm run desktop` or `desktop:*` probes,
synthesize OS input, take window focus, or use computer/browser automation to
playtest unless the user explicitly requests that specific action. This applies
even when OS automation is available. Missing engine coverage is reported as a
limitation; it does not authorize desktop control or a request for computer access.
The native scripts retained in the repository are outside the default testing workflow.

## Fast daily loop

```sh
npm run harness:editor
npm run harness:reset
npm run harness:quick
```

Reset starts the arcade game in round 1, seed 42, one player, with its ready
countdown skipped. It invokes the recorded dev-only `arcade.reset` cheat in the
open editor, or an existing headless session. A headless session can be started
with `gameengine run --headless --paused`. The editor and host keep their own
world clocks and allocation IDs; those are outside reference canonical state.

Quick validates every cached fixture's provenance and the imported campaign
checksum, runs nine deliberate comparator tests, then seven V8 T0 groups:

- Movement traces and the physical keyboard hold/release/jump path.
- All five complete canonical engine-input traces: smoke and rounds 1/10/24/25.
- Go trigonometry, fused arithmetic and PCG distribution/state cases.
- Desktop menu/profile/settings controls, including short Enter/Space taps and held-key repeats.
- AI companion behavior and the engine-input co-op mode/start/pause/restart path.
- Arcade-derived player falling/jump curves, shoes cadence, wrapping, bubble boosts, and recorded co-op input.
- Empty-bubble scoring, mixed chains, fruit point effects, extra lives, and real engine HUD updates.

A supplied filter replaces the three default groups:

```sh
npm run harness:quick -- '*arcade engine input*'
```

An empty test selection fails. Quick uses committed oracle output, requires no
Go/network access, and performs no cook or rendering-golden check.

## Handoff and milestone gates

```sh
npm run harness:verify
npm run harness:verify-full
npm run harness:milestone
```

Verify runs provenance/comparator checks, the aborted-HTTP-body regression, a
fresh-host cold live-viewport regression, all V8 T0 tests, all desktop T1 tests
(including the complete 20-shot presentation route and its draw budget), the registered
engine replays with their explicit recorded scenes, then `gameengine check`
(typecheck, validation, desktop cook and cooked smoke), followed by the original/
derived audio provenance and nonempty cooked-alias uniqueness guard across all
asset kinds. Empty script/config aliases are ignored. It never changes expected
fixtures, goldens or replay files. Any failed or unavailable required stage blocks
a passing result. Warnings from engine check remain visible. `verify-full` adds
an independently rendered structural replay (230 explicit frames at this checkpoint). Run it at checkpoints;
also regenerate all-tier pipelines whenever materials or rendered flows change.
The regular verify lane retains every regression test and cooked smoke check,
while avoiding that second render of the same full presentation route after every edit.

Milestone is a separate CPU-only Go audit outside the fast lane. It verifies the
pinned checkout, Go version, levels and instrumentation; rebuilds the oracle; runs
all cached pure-simulation comparisons; compares random numerical samples; and
compares up to 1,261 frames for each of 25 independently initialized rounds using
the explicit source-speed profile. The pre-playtest implementation matched all
31,525 snapshots. After the requested top-boundary change, 15 rounds still match
their full traces; ten reach the intentional upward-ceiling difference. Those
rounds check their exact prefix and first boundary difference, then stop rather
than claiming that subsequent diverging gameplay matches Go. Rounds alternate
one/two players and receive fixed movement, jump and fire inputs. These cases do not prove natural
progression from round 1 through the final round or every mechanic boundary.

The October 15 enemy tuning, player traversal and item-proportion corrections intentionally
extend the pinned reference; see [playtest-feedback.md](playtest-feedback.md).
Historical movement-only fixtures exercise the retained `src/movement.ts`
prototype used by `round1.scene`, including its original ceiling. They do not
claim that the playable arcade scene still clamps upward jumps. The pure runner
projects that prototype's fields into canonical state; full arcade cases continue
to run `stepGame` with an explicit source-speed scale of 1 and
`referencePlayerBalance`, and compare every
exported canonical field against their unchanged Go fixtures. Production games
default to 0.8 for normal enemy movement and the gentler player/shooting values
in [player-balance.md](player-balance.md); separate tests cover those defaults.
Both tuning fields are authoritative session state (and part of engine replay
hashes), but are not upstream fields in the Go canonical projection. Source-speed
comparisons do not claim that the new playable difficulty matches original Go.
An engine replay records the real round-three upward wrap through the
cheat/event/fixed-step path and checks the world hash independently on playback.
Two more replays record Settings selection of red and yellow and entry into solo
and co-op gameplay. The presentation route also ends with both new skin previews;
pipeline verification checks their labels and actual body-color pixels on every
recorded GPU tier. See [dragon-skins.md](dragon-skins.md).
Two bubble-color replays exercise firing all four solo colors and simultaneous
co-op shots. Shot `Shooter` metadata is retained in engine world hashes but
excluded explicitly from the Go bubble projection, whose schema has no owner
field. Movement/capture/RNG/sound comparisons still include every original field.

Engine-input parity compares every exported field and sound-event sequence after
each semantic input tick. The pure lane exercises the same simulation without the
engine event/document adapter. Neither establishes pixel similarity to Go, physical
keyboard coverage for every binding, audio-device playback, or OS persistence.
Those need their own presentation/input/service checks. Tactile goldens protect
approved Tactile rendering and do not independently establish Go visual parity.

## Oracle provenance and regeneration

```sh
npm run harness:setup
npm run harness:fixtures -- arcade-round-24-combat
npm run harness:reference-check -- arcade-round-24-combat
node tools/harness/arcade-parity.mjs arcade-round-24-combat
```

`tools/harness/reference.lock.json` pins the upstream revision, campaign checksum,
and Go 1.26.9 archive/checksum. Setup provisions an ignored macOS arm64 toolchain;
other hosts may set `HARNESS_GO` to the exact pinned Go version. Regular tests read
committed JSON and never provision Go. Network/Git are needed only to fetch the
initial checkout and toolchain. Numerical parity currently targets Darwin arm64.

Generation adds the committed adapter/driver to an ignored reference checkout.
The one anchored upstream edit preserves the existing PCG construction while
retaining its source handle for state export. The adapter exposes private counters,
queues and IDs; movement mode invokes the unchanged upstream player routine.
Math/RNG/FMA modes expose standard-library operations. None replace game rules.
The oracle imports only `internal/game` and standard-library packages, without
window/audio initialization.

Generation runs each scenario twice independently, requires byte-identical output,
and runs upstream simulation tests. Fixture headers hash the scenario, levels,
adapter and driver. `reference-check` compares regenerated output without writing
it. Deliberately regenerate every affected fixture after changing an overlay/input,
then review the diffs; never change expectations to conceal a port failure.

A round scenario starts with a campaign suffix; its initial `LevelIndex` is zero.
It is independent round initialization, not a simulated transition from round 1.
The smoke fixture contains 88 inputs plus initial state. Four combat fixtures each
contain 360 inputs plus initial state, covering capture/death, floating drift,
Pulpul steering, the round-24 ceiling, and a scored defeat in the observed traces.

Comparison preserves collection order and uses exact finite float64/discrete
values without blanket tolerances. First divergence includes scenario, frame,
field, expected/actual values, input and surrounding states. Diagnostics go under
ignored `artifacts/`; pure trace exports go under `artifacts/arcade/`.

## Engine replays and editor probes

```sh
npm run harness:record
npm run harness:replay
npm run harness:failure-probe
npm run harness:hot-reload
```

Record explicitly re-records four named tests: starter reset/tap, movement physical
keyboard, arcade engine-input smoke, and the complete desktop presentation route.
Replay verifies their hash streams. The
installed replay CLI omits the recorded scene, so the harness bundles once and
invokes the installed V8 host with explicit `--scene` for each replay:

| Replay | Recorded scene |
| --- | --- |
| `harness_reset_and_tap` | `scenes/main.scene.json` |
| `movement_physical_keyboard_hold_release_and_jump` | `scenes/round1.scene.json` |
| `arcade_engine_input_full_go_parity_reference_round1_smoke` | `scenes/arcade.scene.json` |
| `desktop_complete_presentation_flows` | `scenes/arcade.scene.json` |

A custom replay needs its scene when the name is unknown:

```sh
npm run harness:replay -- tests/replays/example.greplay scenes/arcade.scene.json
```

The three core replays were intentionally re-recorded after adding campaign systems,
input actions and schema state, which change whole-world hashes. Their assertions
and exact oracle expectations still pass. Replay hashes establish engine
determinism; they are independent of the Go comparator's behavioral evidence.

The deliberate failure probe creates a temporary failing assertion and confirms
nonzero exit/useful diagnostics before removing it. Comparator selftests also
corrupt actual traces and check first-divergence diagnostics.

Hot reload probes the running arcade scene by temporarily changing the reset code,
confirming that the live world survives, executing the changed reset, and restoring
the code and original reset behavior. The movement and starter probes remain
available as `harness:movement-hot-reload` and `harness:starter-hot-reload`.
The latest integrated arcade probe measured 601 ms for the change and 607 ms
for restore, retained the running world, verified the changed code executed,
and restored the source. The earlier core probe measured 273 ms. Do not edit
their target files concurrently. A stopped or absent editor is an unavailable
probe, never a passing hot-reload result.

## Environment and measured evidence

2026-10-14, macOS arm64, release V8 host, installed Tactile app runtime:

| Lane | Measured end-to-end time | Result |
| --- | --- | --- |
| Warm default quick | 3.18 s | Comparator + movement + five engine-input cases + numerical tests pass |
| Re-record three engine tests | 2.52 s | All assertions pass; fresh replays saved |
| Explicit-scene replay verification | 0.84 s | All three hash streams pass |
| Live milestone audit | 8.60 s | Cached pure cases, random numerics and all 25 independent rounds pass |
| Full verify of staged core export | 18.73 s | 75 T0, 10 desktop T1, three explicit-scene replays, typecheck/cook/600-frame smoke pass |
| Final integrated quick | 3.49 s | Comparator checks plus 11 movement, five complete engine-input and three Go numerical test cases pass |
| Pre-stateful-audio checkpoint verify | 29.65 s | 85 T0, all 14 desktop T1, four replay streams, typecheck/cook/600-frame smoke and audio guard pass |
| Final integrated verify | 30.62 s | 92 T0, all 14 desktop T1, four refreshed replay streams, typecheck/cook/600-frame smoke and audio guard pass |
| Final cooked T0 | 2.67 s | All 92 tests pass against cooked assets |
| Latest all-tier rendered pipeline recording | 28.27 s | Desktop/mobile/compat each complete all 506 replay steps with 170 actual GPU probes; peak draws 11/9/9, within 14 |
| Final desktop rendered replay check | 9.51 s | Every required page, Ready, round 24, death, particles and elemental effect observed |
| Independent exact export of checkpoint `373e266` | 38.93 s | 85 T0, 14 desktop T1, 170-frame rendered route, four replays, check/cook/600-frame smoke and audio guard pass |

Measurements include child CLI startup but exclude npm wrapper startup. The runner
writes per-stage wall times to ignored `artifacts/<command>-timing.json`. They are
development-machine measurements, not device/performance guarantees. A fresh cook
or asset import may take materially longer and must not be skipped to meet a
fast-lane target. The measured staged core export preceded the pixel/native adapters. Its timing
is historical; the checkpoint verify-full lane also includes the rendered replay check
described below.

The final verify sample is 0.62 seconds above the warm 30-second target. Its
check stage took 14.59 seconds versus 13.48 seconds in the preceding checkpoint,
accounting for most of the difference. Every required test, all 600 cooked smoke
frames and the asset guard remain enabled; this is an observed timing, not a
claimed target pass. That earlier all-tier recording covered the audio/schema checkpoint. The static
renderer changes below have a fresh all-tier recording; old program keys are not
reused as evidence for the new material.

After checkpoint `373e266`, the audio schema added the SFX priority cursor and
platform marker coverage. All four world replays were intentionally refreshed
for that schema change and independently verified. Pure Go fixtures and all
existing rendering goldens remained unchanged.

The installed editor launcher uses the application's supported `--project` flag
because the packaged `gameengine editor` launcher references a missing development
file. `harness:editor` reuses an open project and verifies its edit engine. Set
`HARNESS_EDITOR` to override the application executable.

Hermes is unavailable, so cross-runtime equivalence is unsupported. The desktop
Metal golden does not validate other rendering backends. CI still needs a portable
engine runtime or configured self-hosted runner; the local engine symlink is not a
portable dependency. Pipeline coverage is verified through actual rendered replay
observations as described below; absent coverage is a failure, not a pass.

## Rendered replay and pipeline workaround

The desktop verify lane runs every T1 test with an explicit wildcard filter.
The checkpoint `verify-full` lane also checks `tests/budgets/presentation.json`
through `tools/harness/record-pipelines.mjs --check`. The wildcard changes the installed
CLI's structural-replay scheduling; it does not reduce the selected T1 tests.
The stock structural lane can wait sixty seconds for assets because its
headless replay never requests a frame. The replacement uses public protocol
calls: start a paused host, warm assets with `render.probe`, load the replay,
start performance capture, advance one paused recorded step and request its GPU
frame. The visible, nonempty `PRESS ENTER TO START` layout node proves title
coverage despite the initial desktop document being lazy. Controlled batches of
three recorded steps then alternate with GPU probes and page/effect observations;
the recorded route holds each required phase for at least three steps. Missing
any required phase fails rather than assuming it appeared between requests.
Read-only stats, document observation and replay status calls run together after
each completed GPU probe.

The replacement fails on replay divergence, timeout, missing pipeline records,
excess draw calls or missing rendered coverage. Required coverage includes all
eleven desktop pages, round 24 combat, Ready, death, particles and fire/water/
thunder effects. It writes ignored `artifacts/pipeline-check.json` with actual
frames, page/effect observations, peak draws and performance statistics. This is
a structural/CPU observation on the development host, not a real-time GPU frame
rate claim or image parity proof.

After a rendered flow or material change, record actual pipeline keys for all
three tiers outside the short edit loop:

```sh
node tools/harness/record-pipelines.mjs
```

This writes `pipelines.json` only after every tier completes coverage and budget
checks. The desktop-only check leaves that manifest unchanged:

```sh
node tools/harness/record-pipelines.mjs --check
```

Mobile and compat pipeline warm-up proves route coverage and pipeline creation
on this Metal host. It does not establish mobile/compat RGB parity with Go;
only desktop image captures currently have reviewed regression goldens.

The installed validator currently reports program `7946469ed20397e0` as unknown.
A read-only compilation of its bundled, unchanged
`packages/materials/src/builtin/standard.material.ts` returns exactly that hash.
The validator searches for built-in compiled JSON under the engine's omitted
`crates/gameengine-render/src/materials` source directory. This is a verified
installed-package lookup limitation. Runtime also reports dropping three recorded
built-in 3D keys during the loaded-material mapping pass, while its earlier
warm-up reports 11/11 records and loaded materials still warm their pipelines.
A genuine game-owned re-export of unchanged Standard, including a direct scene
reference and public material preview, did not remove that drop; the experiment
was removed. Actual records and the currently compiled custom material program are
preserved. No duplicate material or invented key is retained merely to silence
the validator. Release packaging must account for this known warning explicitly;
it is not evidence of a stale custom shader. This dropped subset remains a
scoped engine limitation, not a successful game-side compatibility fix.


The final ordinary native window/focus/fullscreen/music interaction gate passed
on 2026-10-14. Actual menu inputs toggled fullscreen and music gain; gameplay
pause held position 0.58 s for 700 ms and resumed to 1.03 s. Own-window focus loss
paused at 1.13 s for 700 ms and resumed to 1.58 s. Saved settings before and after
were fullscreen=true, music=50 and sound=75. The launcher, host and helper exited
and the endpoint closed. Evidence is `artifacts/desktop-platform-integration.json`.
No OS-lock or computer-use permission bypass was used.

That run exposed and fixed the POST effect losing its clock dependency while an
async request was busy. The controller regression now delays health/state by
120 ms and begins with HTTP 503: the old guard fails, while the fixed guard passes
720 steps, five acknowledgements and 183 status polls. Earlier failed runs are
preserved separately; startup baselines wait for saved settings and test inputs
wait for focus and observed changes.


## Cold live viewport and deferred OS surface check

Both verification lanes now run `tools/harness/viewport-smoke.mjs` on its own
fresh host before their screenshot suites. The tool creates a 1920×1080 engine
readback viewport and saves its live RGBA frame before any offscreen screenshot,
material preview or render probe. It requires the top world tile band, the green
player and more than 500 submitted triangles. Earlier offscreen tests could
initialize 3D and conceal the reproduced HUD-only startup failure.

The original dynamic-mesh path failed with zero matching world/player pixels and
125 triangles. The imported static-quad candidate independently passed with
34,380/34,380 tile pixels, 1,136 green player pixels and 1,065 triangles in five
draws. These observations establish world rendering in the engine's live viewport;
they do not establish full Go pixel equality. Evidence is saved under
`artifacts/viewport-smoke.{png,json,log}`.

By explicit user instruction, testing stays inside the Game Engine. Standalone
playtesting, OS/computer control and foreground-window image checks are outside
the authorized workflow, regardless of permission availability, and are deferred
without blocking merge. The required cold engine-viewport regression remains an
active gate; its coverage concerns engine frame contents rather than the OS
compositor's final displayed pixels.


### Static renderer checkpoint observations

After the cold-start repair, all 94 V8 T0 cases passed. Re-recording the four
engine tests took 9.10 seconds; independent explicit-scene verification took
1.40 seconds and passed every stream. The starter and movement files changed
only their bundle-hash headers. The two arcade replays also changed world hashes
because the imported static quad uses presentation entities in place of the
previous dynamic mesh. The schema and pure Go fixtures did not change. These
reviewed world-hash refreshes establish engine determinism, not new Go behavior.

A new actual all-tier pipeline recording took 30.35 seconds. Desktop, mobile and
compat each completed 506 recorded steps and 170 explicit GPU frames, observing
every required page/effect. Peak draws were 11/9/9 against the unchanged limit
of 14; recorded pipeline counts were 11/9/9. This replaces the prior material's
records. It does not establish mobile/compat RGB parity or real-time frame rate.
Evidence is `artifacts/pipeline-recording.json`.

The renderer owner's bounded steady live-viewport sample reported gameplay p95
simulation/presentation times of 0.755/6.706 ms and title p95 times of
0.569/8.873 ms, with five draws and a 2,574-entity pixel pool plus one text entity.
These are development-host CPU observations, not a GPU/device guarantee; see
`artifacts/viewport-static-steady.json` and [rendering.md](rendering.md).

The broadened asset guard rejects the saved pre-fix manifest's duplicate
`pixel-renderer/atlas` texture/data alias. The corrected cooked manifest passes
with 75 unique nonempty aliases and 36 reference audio aliases; original asset
and derived-audio provenance checks also pass. This proves collision detection
and removal, independently of the live-viewport rendering diagnosis.

## AI co-op, arcade motion and scoring integration checkpoint

Local `harness:verify-full` passed in 62.08 s: 171 V8 T0 tests, 25 desktop T1
tests, all 15 registered explicit-scene replays, the cold viewport and bridge
regressions, typecheck, validation, desktop cook, 600-frame cooked smoke and audio
provenance/alias checks. The registry now includes AI mode lifecycle and physical
Enter tap replays alongside motion and scoring regressions.

The five changed Settings screenshots were reviewed: the mode selector adds a
row and moves Back down. Registered replays were recorded again because the new
authoritative mode/controller, confirmation latch, motion phases and balance
fields intentionally change their document hashes. Go oracle fixtures remain
unchanged; their explicit reference profile retains the original Go rules.

All-tier pipeline recording passed with 230 explicit frames per tier and peak
draws 11/9/9 on desktop/mobile/compat (budget 14); the resulting pipeline file
was identical. Engine check still warns about program `7946469ed20397e0` having
no compiled material, despite this complete recording. The existing release
build requires the disclosed pipeline-warning override until that engine
warmup issue is resolved. Existing camera warnings also remain.

All 12 companion logic tests additionally pass with `--memory-class phone-low`.
Previously measured release-host AI simulation p95 was 0.390 ms, with a 21.193 ms
initial graph build on this Mac; these are desktop measurements, not phone
performance claims. Hermes equivalence remains unavailable because this engine
installation has no Hermes host. Testing used engine APIs and headless hosts;
standalone builds and desktop automation are excluded from this workflow.
