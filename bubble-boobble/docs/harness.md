# Desktop port harness

Run commands from `bubble-boobble/`, one directory below the Git root. Node.js 22+
and the installed Tactile CLI/release V8 host are required; no npm install is needed. The
playable default is the arcade scene; the original starter and movement scenes
remain independent regression targets. [movement.md](movement.md) documents the
first slice; [numerics.md](numerics.md) explains exact Go arithmetic and RNG.

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
checksum, runs five deliberate comparator tests, then three V8 T0 groups:

- Movement traces and the physical keyboard hold/release/jump path.
- All five complete canonical engine-input traces: smoke and rounds 1/10/24/25.
- Go trigonometry, fused arithmetic and PCG distribution/state cases.

A supplied filter replaces the three default groups:

```sh
npm run harness:quick -- '*arcade engine input*'
```

An empty test selection fails. Quick uses committed oracle output, requires no
Go/network access, and performs no cook or rendering-golden check.

## Handoff and milestone gates

```sh
npm run harness:verify
npm run harness:milestone
```

Verify runs provenance/comparator checks, all V8 T0 tests, all desktop T1 tests,
three engine replays with their explicit recorded scenes, then `gameengine check`
(typecheck, validation, desktop cook and cooked smoke). It never changes expected
fixtures, goldens or replay files. Any failed or unavailable required stage blocks
a passing result. Warnings from engine check remain visible.

Milestone is a separate CPU-only Go audit outside the fast lane. It verifies the
pinned checkout, Go version, levels and instrumentation; rebuilds the oracle; runs
all cached pure-simulation comparisons; compares random numerical samples; and
compares 1,261 frames for each of 25 independently initialized rounds. All 31,525
canonical snapshots currently agree exactly. Rounds alternate one/two players and
receive fixed movement, jump and fire inputs. These cases do not prove natural
progression from round 1 through the final round or every mechanic boundary.

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

Record explicitly re-records three named tests: starter reset/tap, movement physical
keyboard, and arcade engine-input smoke. Replay verifies their hash streams. The
installed replay CLI omits the recorded scene, so the harness bundles once and
invokes the installed V8 host with explicit `--scene` for each replay:

| Replay | Recorded scene |
| --- | --- |
| `harness_reset_and_tap` | `scenes/main.scene.json` |
| `movement_physical_keyboard_hold_release_and_jump` | `scenes/round1.scene.json` |
| `arcade_engine_input_full_go_parity_reference_round1_smoke` | `scenes/arcade.scene.json` |

A custom replay needs its scene when the name is unknown:

```sh
npm run harness:replay -- tests/replays/example.greplay scenes/arcade.scene.json
```

The three replays were intentionally re-recorded after adding campaign systems,
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
The arcade probe measured 273 ms for both change and restore. Do not
edit their target files concurrently. A stopped or absent editor is an unavailable
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

Measurements include child CLI startup but exclude npm wrapper startup. The runner
writes per-stage wall times to ignored `artifacts/<command>-timing.json`. They are
development-machine measurements, not device/performance guarantees. A fresh cook
or asset import may take materially longer and must not be skipped to meet a
fast-lane target. The staged core export excludes the experimental pixel/native adapters. Full verify must
be rerun after their integration.

The installed editor launcher uses the application's supported `--project` flag
because the packaged `gameengine editor` launcher references a missing development
file. `harness:editor` reuses an open project and verifies its edit engine. Set
`HARNESS_EDITOR` to override the application executable.

Hermes is unavailable, so cross-runtime equivalence is unsupported. The desktop
Metal golden does not validate other rendering backends. CI still needs a portable
engine runtime or configured self-hosted runner; the local engine symlink is not a
portable dependency. Missing release pipeline/flow recordings remain visible engine
warnings until representative render flows are recorded. None count as passes.
