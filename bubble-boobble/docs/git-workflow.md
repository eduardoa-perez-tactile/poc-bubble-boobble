# Git workflow for fast port iteration

Status: active. The harness (#1), movement (#2), and campaign/desktop core (#3) are merged on `main`. Game-owned desktop workarounds are covered by PR #4 (`codex/port-desktop-workarounds`). See [harness.md](harness.md) for validation.

Repository: https://github.com/eduardoa-perez-tactile/poc-bubble-boobble
Git root: `bubblebooble/`; engine project: `bubblebooble/bubble-boobble/`.
Keep this layout. Run Git at the repository root and engine commands in the project directory.

## Bootstrap

The repository began empty. Initial `main` commit `8fe0169` contains the starter and contracts, with passing starter T0/check evidence. It establishes the recovery point; it is not a completed port. `main` is published to origin as the integration branch.

The initial implementation order was `codex/port-harness`, then `codex/port-movement`.
Each subsequent slice follows the same gates below.

## Daily flow

1. Start each coherent playable slice from current `main`: `codex/port-<slice>` or `codex/fix-<issue>`.
2. Use one active implementation branch for this shared editor checkout. Do not change its branch under a running play session. Use an isolated worktree only for actual independent work.
3. Save, reset the scenario, play, and run the focused quick lane. No commit or PR is needed for each tuning save.
4. Make small local checkpoint commits at working boundaries. Commit implementation and its tests together; failing experiments remain on the feature branch.
5. Before handoff, run verify, inspect visuals if affected, and document known pending coverage. Every completed behavior must have a passing test or replay. Strict-parity claims require oracle evidence.
6. Push the feature branch and create one PR per coherent slice. State resulting behavior, reference cases covered, validation, and any intentional scope limits. Link the PR to the chat.
7. Merge passing PRs into `main` using squash merge. Keep `main` buildable and playable at its current implemented scope. Update the local checkout before starting the next slice.

No GitFlow develop/release branches. No PR per tiny tweak. One slice should be reviewable and deliver visible progress, such as player movement or bubble capture, without bundling all campaign/menu work.

Definition of workflow does not publish changes. Before a merge, obtain user authorization unless already given for that merge/workflow. Pushes and PRs are performed when the user requests execution of this workflow; report remote URLs.

## Gate policy

- Per save: hot reload and scenario reset; no full cook.
- Per behavior change: focused T0 and cached reference comparison for implemented mechanics.
- Per completed slice: full implemented parity suite, V8 T0, relevant T1 and `gameengine check`. Add V8/Hermes equivalence when the Hermes host is available; disclose its absence until then.
- Per milestone: campaign/long-run/cooked/performance checks and updated pipeline coverage.
- Actual test failures block merging; pending future features do not block a partial playable slice.
- By explicit user instruction, computer access must not block progress: when a test cannot run because access is unavailable, record the exact deferred test and reason, merge the authorized work, and continue. Deferred tests are not passing tests. Use Game Engine APIs for testing; do not launch standalone builds, use computer/browser control, synthesize OS input, take window focus, or request computer-use access. This is a workflow restriction even when access is available; only an explicit user request for that specific action changes it. Infrastructure failures unrelated to that access exception must still be reported.

CI must pin/provision a compatible Tactile engine runtime. The current `.gameengine/engine` symlink points into a local macOS app and is not a portable dependency. Do not add a nonfunctional hosted-runner workflow: first establish runtime distribution or a configured self-hosted runner. Until then, record local gate evidence in PRs and identify it as local validation.

## Files and provenance

Commit source/schema/generated schema, scenes, imported source assets and metadata, levels, UI documents, tests, reviewed fixtures/goldens/replays, pipeline recordings, scripts and documentation. Preserve the reference MIT license and asset credits when importing its content. Lock the reference revision and checksums.

Do not commit `.gameengine/`, `node_modules/`, builds, oracle checkouts/binaries, runtime captures/diagnostics, machine-specific paths, credentials or save data. Add ignored cache/artifact paths when harness tooling creates them. Review engine-generated agent/skill/config files individually before initial staging; do not blindly add the entire directory tree.

Do not modify `PROJECT.md` unless the user explicitly asks to place specific guidance there. These workflow contracts live in `docs/`.

## Baseline changes and recovery

Reference fixtures change only after a deliberate reference revision or fixture-input change, with regeneration provenance. Engine goldens/replays change only for explained, inspected behavior/presentation changes. Expected-output changes are visible in the PR and never automatic failure repairs.

Tag verified playable milestones, e.g. `port-m1-core-loop`, after their checks pass. Revert faulty integrated commits; avoid rewriting shared `main`. Never force-push a shared branch or discard uncommitted work. Rebase only private feature work with a clean worktree; otherwise merge current `main` into the branch.
