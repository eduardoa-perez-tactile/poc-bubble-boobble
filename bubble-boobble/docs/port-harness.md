# Strict-port harness contract

Current progress: movement and the campaign/desktop core are merged through PR #3.
Game-owned rendering and native desktop adapters are the next verification slice.
The strict-port contract below continues to govern subsequent slices.

Bootstrap status (historical): bootstrap implemented on `codex/port-harness`. See [harness.md](harness.md) for commands and measured evidence. This paragraph describes the original bootstrap gate; gameplay has since been ported.

## Objective and reference

Fast iteration is a prerequisite. Each change must be immediately playable, reproducible, and checked against the Go reference where its behavior has been ported.

Reference: https://github.com/olivierh59500/go-bubblebobble
Pinned revision: `783cf6aa26ac3c57cdab43f2d7a5b3725a3991cc`.
Target: desktop, using the existing `bubble-boobble/` project inside the repository root. Preserve the Go remake's behavior and assets. Android Bluetooth is a later platform scope.

## Feedback lanes

Run commands from `bubble-boobble/`.

| Lane | When | Checks | Feedback target on this development machine |
| --- | --- | --- | --- |
| Live | Every save | Editor hot reload, console errors, current scenario | Ordinary script changes playable within 2 seconds |
| Quick | Each behavior change | Selected V8 T0 tests and matching cached Go fixtures | Within 5 seconds warm |
| Verify | Before a feature handoff/merge | All implemented parity cases, T0, selected T1 captures, engine check | Within 30 seconds warm |
| Milestone | Campaign/system milestones | All 25 rounds, long replays, cooked tests, presentation and performance cases | Report duration; keep outside the edit loop |

These are targets, not measured guarantees. Time commands end-to-end, including compilation and host startup. If a lane misses its target, identify and fix its bottleneck before growing its workload. Reference generation, full cooking, and screenshots do not run on every save.

Current supported commands:

```sh
gameengine test --js v8 --filter '*movement*'
gameengine test --js v8
gameengine test --tier t1 --js v8 --gpu-tier desktop
gameengine check
gameengine test --cooked --js v8
```

The movement filter becomes useful after the port tests exist. `gameengine test --changed` runs all tests when gameplay source changes; use named filters for the narrow loop.

## Cross-language behavioral oracle

Build a small headless Go driver against the pinned reference's `internal/game`; do not depend on Ebitengine, a window, audio hardware, or Bluetooth for this lane. The driver must live in a generated checkout under the reference module so Go's `internal` import rules permit access. Keep that checkout and binaries in ignored cache; commit the driver source, revision lock, fixture inputs, and expected outputs to this repository.

Do not rewrite reference rules in the driver. For access to unexported test state, add a narrowly scoped generated test adapter in the reference's `game` package. Record and review this overlay separately from pristine reference code. Provide a reproducible fixture regeneration command; regular tests consume committed outputs and do not require Go or network access.

Each scenario contains a version, reference revision/content checksum, seed, level or controlled initial state, and per-tick input for each player. Inputs represent `Move`, `Jump`, `Fire`, and pause changes. Record the initial state and state after every simulation tick, with engine startup/loading ticks excluded explicitly.

Both runners export a canonical state in reference pixel coordinates, with positive Y downward. Compare:

- Match phase, pause, tick counters, countdown, freeze, hurry, round and score.
- Every player's position, velocity, ground state, facing, lives, jump buffer/coyote state, last-jump state, cooldowns, invulnerability, death timer, powers and walk animation counter.
- Enemies, bubbles, projectiles, items, effects and particles: reference order/IDs, state, positions, velocities, ages, lifetimes and relationships.
- Bonus counters, water stages, pending bonuses, special spawn count, next logical ID and next extra-life threshold.
- The sound-event sequence emitted on each tick.

Reference logical IDs are independent of engine entity IDs. Preserve insertion and processing order; canonical serialization must not hide a gameplay-order difference.

Discrete fields and event order compare exactly. Begin with exact finite float64 comparison for arithmetic-only cases. Go versus engine deterministic trigonometry needs an explicit numerical study before adopting any field-specific tolerance. Never introduce a blanket tolerance or hide a different collision, event, score, or transition tick.

The RNG algorithms differ. For strict seed-based parity, supply a reference-compatible deterministic RNG implementation whose state lives in engine sim resources, subject to confirming the engine integration convention. Until that is available, controlled cases may inject reference-generated initial directions/phases and must label seed-based campaign parity as uncovered. The engine's default seed alone is not a parity guarantee.

Failures exit nonzero and report scenario, first divergent tick, logical object, field, expected/actual value, input, and nearby state. Save diagnostics under ignored `artifacts/`; support rerunning only the failing scenario. Unsupported cases are reported as pending, never as passed.

## Scenario corpus

Start with harness plumbing and the existing starter behavior; port scenarios become active as each mechanic lands:

1. Movement: walls, one-way ascent/landing, wrap, obstructed spawn resolution, jump buffer/coyote boundaries.
2. Bubbles: fire cadence, swept capture, range, float, lifetime, bounce/pop distinction, adjacent chains, escape, round-24 ceiling.
3. Enemies: each of six types, anger, obstacle turns, attacks/projectile sweeps, two-player target selection.
4. Bonuses: every threshold and power, pending queue order, fruit, chain scoring, extra lives, elemental effects, partial clock freeze, parasol round changes.
5. Flow: ready, clear, win, death/respawn, pause/focus loss, restart/end-run accounting; two-player sim survival/revival.
6. Campaign: exact data validation for all 25 layouts and 140 spawns, fixed-input traces, long-run entity-growth checks.

Translate the upstream test cases first. Add boundary cases and real bugs as minimal permanent scenarios.

## Engine determinism and interactive reproduction

Engine replays verify Tactile determinism; they do not establish Go parity. Keep both lanes.

```sh
gameengine test --record-replays --filter '<scenario>'
gameengine replay verify tests/replays/<scenario>.greplay
```

For a behavior-preserving refactor, record a baseline before editing and compare afterward:

```sh
gameengine test --hash-trace .gameengine/base --filter '<scenario>'
gameengine test --hash-trace-baseline .gameengine/base --filter '<scenario>'
```

Record per-system checkpoints only when diagnosing divergence. Do not regenerate expected results merely to clear a failure.

Provide dev-only `defineCheat` commands for named scenario reset, round selection, and controlled states. A reset must reproduce the same initial state and seed without restarting the editor. Tests and interactive debugging use the same scenario inputs. Production sim never branches on DEV; release builds exclude cheat sources.

Validate keyboard bindings through at least one real input-path test in addition to semantic-input parity tests. Hot reload preserves the running world, so state-affecting edits require a deterministic scenario reset before comparison. Schema edits require generation and completion of the editor's host rebuild before tests/checks run.

## Presentation and performance

Use the supplied screenshots as visual references. Add reproducible Go captures with fixed scene/input/tick conditions before claiming automated visual parity. Compare at 768 x 720 logical resolution, then verify containment at desktop window extremes. Rendering differences from text rasterization need scoped reviewed allowances; geometry, sprite frame, mirroring and layering must match.

Capture representative ready/play/pause/death/chain/elemental/round-24/result states. Goldens protect the approved Tactile rendering; they do not independently prove similarity to Go. Inspect updates before committing them.

Measure a release host on this machine using a heavy scenario: step/script time, JS allocation/GC, draw calls, pipeline creation, memory and cooked size. Establish budget files from measured baselines before imposing regression thresholds. Record pipelines from budget replays when new rendered flows land. Report timings as development-machine measurements, not device guarantees.

## Harness bootstrap gate

Before port gameplay:

- Commit this contract and the Git workflow; preserve a clean starter baseline.
- Add runnable commands for quick, verify, fixture regeneration and individual scenario replay; document working directory and dependencies.
- Pin/fetch the reference reproducibly and provision Go 1.26+ for oracle generation.
- Generate at least one Go fixture, prove its repeated output is identical, and test canonical comparison with a deliberate mismatch.
- Prove that starter engine tests/replay run, a deliberate failure gives useful diagnostics, and quick-lane wall time is measured.
- Establish interactive named-scenario reset and verify editor hot reload; leave missing port coverage explicitly pending.

No Go-versus-port parity is claimed until a matching implemented mechanic is compared. No gameplay is added solely to satisfy this bootstrap.

## Initial environment, 2026-10-14 (before bootstrap)

Starter V8 T0 tests: 2 passed. Release host reported approximately 12 ms and 29 ms for their test bodies; these exclude full CLI startup and are not feedback-lane timings. Previous engine check passed including a 600-frame cooked smoke; pipeline recording is absent.

Go is unavailable on PATH. Hermes host is not installed; `gameengine test --js both` fails before running. No editor currently has this project open. Bootstrap must make the required V8 desktop loop work. Cross-runtime checks remain explicitly blocked until Hermes is provisioned; do not rebuild the bundled engine silently. V8-only checks do not prove cross-runtime determinism.
