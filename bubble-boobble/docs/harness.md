# Harness bootstrap and daily use

The harness is implemented; the game remains the starter bubble demo. No Go-versus-Tactile gameplay parity is claimed. This bootstrap establishes a pinned oracle, exact comparison, reproducible interactive setup, engine tests/replay, a visual golden, and measured feedback lanes.

## Requirements

Run the following from `bubble-boobble/` (the project directory, one level below the Git root).

- Node.js 22+ and npm; the harness uses standard-library modules and needs no npm dependency install.
- Installed Tactile Game Engine with the CLI on PATH and a release V8 host. Run `gameengine doctor --json` to diagnose it. Open this project with the installed editor to establish its local `.gameengine/engine` link. `gameengine skills update --auto` refreshes project guidance; engine caches and generated guidance copies are ignored.
- Go is needed only to generate/audit reference fixtures. `npm run harness:setup` provisions checksum-verified Go 1.26.9 in ignored `.cache/toolchains/` on macOS arm64. Other platforms can supply `HARNESS_GO` pointing to Go 1.26.9. No system Go installation or PATH change is made.
- Network/Git are needed only for initial reference fetch and Go provisioning. Cached fixture tests, engine tests/replay and editor reset do not use network access.
- The desktop golden currently targets Metal. Another backend requires separately reviewed goldens; do not automatically update them in verify.

The packaged app's CLI `gameengine editor` currently expects a missing development-launcher file. `harness:editor` uses the installed application's supported `--project` flag, or `HARNESS_EDITOR` when supplied, and verifies that this project's edit engine is running. It reuses an already-open project. It does not close another editor project or accept UI permission prompts.

## Daily loop

```sh
npm run harness:editor
npm run harness:reset
npm run harness:quick
```

The editor is preferred for reset when this project is open; otherwise reset targets an existing headless session (`gameengine run --headless --paused`). Reset runs the recorded dev-only `harness.reset` cheat. The `starter-tap` scenario clears all bubbles and score, places one stationary blue bubble at the origin, and suppresses random starter spawns. Tap it to pop it. Reset again to reproduce that same gameplay setup. The world clock, entity allocation IDs, and unused random stream are not rewound; they are deliberately excluded from this controlled starter scenario, not claimed as whole-world identity.

Quick runs five Node comparator tests and the selected V8 T0 harness test. A different engine test filter can be supplied:

```sh
npm run harness:quick -- '*harness*'
```

The command fails when a filter matches no tests. Go fixtures are cached, and no cook runs in this lane.

## Before a feature handoff

```sh
npm run harness:verify
```

Verify checks fixture provenance and the comparator, all V8 T0 tests, the desktop T1 starter golden, the committed starter replay, and `gameengine check` (typecheck, validation, desktop cook and cooked smoke). It fails on actual check failures; release-readiness warnings are printed. The missing `pipelines.json` warning remains: record campaign/render-flow coverage before release.

Reference fixtures and Tactile replay hashes are independent checks. The reference fixture covers ready, movement/shooting, pause, and resume inside upstream Go. Tactile tests cover only the existing starter and reset plumbing. Campaign mechanics remain pending until the port implements them.

## Reference oracle and regeneration

```sh
npm run harness:setup
npm run harness:fixtures
npm run harness:reference-check
```

The lock file pins upstream Git revision, level checksum, and Go archive/version. Generation fetches an ignored checkout in `.cache/reference/`, adds the committed adapter/driver, and makes exactly one anchored instrumentation change: the existing RNG construction calls an equivalent helper retaining its PCG source so its binary state can be exported. No gameplay rule is replaced. One game is run per oracle process; the package-level source handle exists only in this headless tool.

The adapter includes authoritative snapshots, public/private bonus counters, pending bonuses, next logical ID, special-spawn count, extra-life threshold and RNG state. Go null collections are preserved exactly in this wire format. The driver runs only `internal/game` plus standard-library imports; window/audio dependencies are not loaded.

Generation runs the oracle twice independently and requires byte-identical output, then runs upstream `internal/game` tests. `reference-check` also requires exact agreement with the committed fixture without rewriting it. `fixtures` deliberately writes the expected file; inspect its diff before committing. Headers contain hashes of level content, scenario, adapter and driver. Normal quick/verify checks those against committed inputs and never regenerate expected values.

The initial scenario lives at `tests/scenarios/reference-round1-smoke.json`, with 88 input frames plus initial state. Generate a named scenario with `npm run harness:fixtures -- <name>`. Round selection currently constructs the campaign suffix beginning at that round; it is a standalone scenario, not proof of progression from round 1. Later campaign parity scenarios must start with the full campaign and drive or explicitly set up the intended transition.

Compare an actual exported trace against a fixture:

```sh
node tools/harness/run.mjs compare tests/fixtures/reference-round1-smoke.expected.json artifacts/actual.json
```

Comparison preserves actor/collection order, uses exact discrete and float comparisons, exits nonzero on divergence, and reports the first frame, simulation tick, field, input and adjacent states. `artifacts/first-divergence.json` holds details. Until a port runner exists, this is comparison infrastructure rather than a gameplay-parity command. Use the header and frame format of the fixture when implementing that runner.

## Reproduction and harness probes

```sh
npm run harness:record
npm run harness:replay
npm run harness:failure-probe
npm run harness:hot-reload
```

Record re-records the named starter T0 replay; review it before committing. Replay verifies every engine hash. The failure probe temporarily creates a failing engine assertion, verifies exit status/diagnostic, and removes its test file in `finally`. Comparator tests separately corrupt a reference trace and verify that the real comparison CLI fails; their expected diagnostics live in `artifacts/selftest/`.

Hot-reload is an opt-in probe for an open editor Play session. It temporarily changes the controlled starter circle's color, waits for the editor's reload confirmation, proves the current world survived, then resets to prove the changed code executes. It restores the source and resets to the original color. It rejects a paused Play session and fails when reload exceeds two seconds. It never changes gameplay rules or expected reference output. Do not edit `src/harness.cheats.ts` concurrently with this probe.

For behavior-preserving refactors, use the engine hash-trace baseline workflow in [port-harness.md](port-harness.md). Do not regenerate a replay/golden to conceal an unexplained failure.

## Measured bootstrap evidence

2026-10-14, macOS arm64, Apple M2 Max, release V8 host, installed Tactile app 0.1.11:

| Check | Observed wall time | Result |
| --- | --- | --- |
| Warm quick command (excluding npm wrapper startup) | 0.59 s | Five comparator tests and focused T0 passed |
| Initial reference generation | 6.51 s | Two runs identical; upstream sim tests passed |
| Warm reference audit | 0.36–1.29 s | Two runs match committed fixture |
| Editor reset | 0.81 s | Controlled state reproduced |
| Editor save-to-reload confirmation | 0.27 s each way | World preserved, new/restored code executed |
| Warm full verify | 3.12–3.35 s | Comparator, all three T0 tests, T1 golden, replay, typecheck/cook/600-frame smoke passed |
| Engine replay verification | 0.32 s | Hash stream verified |

The runner writes end-to-end timing reports to ignored `artifacts/`. Timings include child command startup but exclude starting npm itself; they are development-machine measurements. The hot-reload time is save to confirmation, with execution independently proved afterward.

All three T0 tests also passed against freshly cooked content. Both deliberate failure probes returned nonzero with the expected diagnostics. The T1 golden was visually inspected before committing it. Go provisioning was tested using the pinned archive and checksum. The starter/contracts recovery point is `main` commit `8fe0169`; this harness is the first feature slice.

A paused 600-step starter capture measured sim-step p95 0.024 ms, max 1.89 ms, no >4 ms GC pauses, and approximately 60 MB process memory. Its rendered controlled frame had two draw calls. These are plumbing baselines for one circle, not estimates for the future game's load or GPU/thermal performance. Establish game budgets with representative port scenarios.

Hermes is not installed, so cross-runtime equivalence remains unavailable and is not part of the verified V8 desktop bootstrap. CI is not configured: the installed runtime needs a portable distribution or a configured self-hosted runner first. Go port-parity coverage is pending; release pipelines are pending. These limitations are surfaced by `harness:coverage` and the contracts, not silently counted as passes.
