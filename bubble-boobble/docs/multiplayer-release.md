# Office Arcade release

The current [Dynamic online Wave Survival](multiplayer-dynamic-worlds.md) build is live at [Play Bubble Madness](https://webgames.tactilews.com/bubble-madness-mp-86dc75d-20261021t081826-1882/). It uses authoritative worlds with immediate start and joining during combat. The historical `cd5516d` URL and ZIP below remain the previous fixed-match implementation.

This game uses Trond's [live Office Arcade guide](https://webgames.tactilews.com/agents/), re-read on 21 October 2026. Office Arcade runs the exported authoritative engine server directly; the client connects to the same publication's secure `/socket` endpoint. There is no project-owned Node server or health wrapper.

## One-command deployment and updates

The previous fixed-match publication is live at [Bubble Madness multiplayer](https://webgames.tactilews.com/bubble-madness-mp-cd5516d-20261020t141208-1fa6/) (20 October 2026, publication ID `f3a94c84-7c08-420e-994b-2019e3031296`, built code revision `cd5516d`). Office Arcade reported `published`; `check_game` returned HTTP 200 with no missing linked files. A separate secure WebSocket upgrade to the hosted `/socket` succeeded. These checks do not establish browser gameplay.

From this project directory, on the office network/VPN:

```sh
npm run arcade:deploy -- --zip build/arcade/bubble-madness-polish-86dc75d.zip
```

For each update, first build fresh matching browser/Linux exports from the same clean code revision using the build instructions below. Then deploy them together in one command:

```sh
npm run arcade:deploy -- --web /absolute/path/to/web-export --server /absolute/path/to/linux-server-export
```

That form verifies and packages the exports before upload. Alternatively, supply a newly verified ZIP with `--zip`. Supplying an old ZIP deploys that ZIP's recorded revision; it does not build current source. The script needs only Node and office/VPN access for a prepackaged ZIP; packing exports also needs the existing ZIP tools. No account or credentials are required.

`tools/arcade/deploy.mjs` validates the ZIP checksum receipt, generates a unique `bubble-madness-mp-COMMIT-TIMESTAMP-NONCE` address, uploads once, polls until `published` or `failed`, and runs `check_game`. Every deployment gets a new URL because Office Arcade does not overwrite existing addresses. The previous publication remains available. Use `--prefix NAME` to change the generated prefix, or `--slug UNUSED-NAME` for an explicit address. A local JSON receipt in `build/arcade/deployments/` records the exact build, publication state, file check and play/socket URLs, with `browserVerified: false`.

Use `--dry-run --zip RELEASE.zip` for local validation without any network calls. The default publication wait is ten minutes; `--timeout-seconds` changes it. After an interruption or timeout, do not upload again: resume monitoring the original address instead:

```sh
npm run arcade:deploy -- --resume bubble-madness-mp-cd5516d-20261020t141208-1fa6
```

Resume never prepares or uploads another release. The initial receipt is preserved, with a separate resume receipt. Failure exits nonzero and never reports queued as published. Unknown server states and HTTP/tool errors stop the command for inspection. It does not install a recurring job or automatically publish on Git pushes. Browser acceptance remains governed by `PROJECT.md`.

## Current HUD, end-flow and background-connection release

The current build is [Play Bubble Madness](https://webgames.tactilews.com/bubble-madness-mp-86dc75d-20261021t081826-1882/), published on 21 October from clean revision `86dc75d291f611af5880075c06a22577be4bc6af`. It includes the compact online HUD, reserved arena space, manual results after a minimum three-second Game Over stage, five-second authoritative AI handover and the hidden-window socket correction. The Chrome enemy-entry hitch remains unconfirmed; no performance fix for that symptom is claimed.

[Ubuntu Linux CI 39568110753](https://github.com/eduardoa-perez-tactile/poc-bubble-boobble/actions/runs/39568110753) passed 24 tooling tests, actual production world startup, library resolution and socket upgrade. Clean browser export `build/arcade/web-86dc75d/` and Linux export `build/arcade/ci-86dc75d/server-linux-x64/` passed exact script/config/input pairing. Both contain script SHA-256 `b80e23579500e2156f114d87290e1ae62a54b5f36e5769e0d8db7d4d42efdd5f`.

ZIP `build/arcade/bubble-madness-polish-86dc75d.zip`: 56,501,903 bytes, SHA-256 `23a9910342ddd63808060cc6ff51311efc664f66d73f8de679a966731263b90e`. Reports: `.gameengine/online-polish-release-verify-final.json` and `.gameengine/online-polish-release-package-final.json`. The release gate now requires browser shell `bubble-web-v3`; the first packaging attempt correctly stopped on its stale v2 expectation. Both targets were rebuilt from the new clean revision after correcting that check; no exports were restamped.

Office Arcade reported `published`, entry and linked-file checks passed, and an independent secure WebSocket upgrade passed. The hosted `player.js` SHA-256 matches the clean export (`0dae997850e4668771925fc2f2d1d356b5663160198fe1f8e0a3c6db7e955ccd`); hosted metadata confirms the exact revision and shell v3. Receipt: `build/arcade/deployments/bubble-madness-mp-86dc75d-20261021t081826-1882-deploy-1792570706649-5518.json`. Extra checks: `.gameengine/online-polish-hosted-{socket,shell}.json`. Browser gameplay and window-switch acceptance remain unverified under the project workflow preference. Earlier publications retain their original builds.

## Previous performance release

That performance build is [Play Bubble Madness](https://webgames.tactilews.com/bubble-madness-mp-8509a49-20261020t152237-19da/), published from clean revision `8509a4910afe0669ee04de710e453192567a632a`. [Linux CI 39447593321](https://github.com/eduardoa-perez-tactile/poc-bubble-boobble/actions/runs/39447593321) passed production world startup, library resolution and WebSocket upgrade. Browser export `build/arcade/web-8509a49/` and server export `build/arcade/ci-8509a49/server-linux-x64/` passed exact pairing and packaging.

Release ZIP: `build/arcade/bubble-madness-performance-8509a49.zip`, 56,499,465 bytes, SHA-256 `53cc1c67109f71179846a86eb577d7319978684d330f360569a1748564a05177`. Both targets contain exact script SHA-256 `981275e7c0462ef480d11c8c2bf63057c5675b43d10b892eb2846937c8278822`. Reports: `.gameengine/performance-release-verify.json` and `.gameengine/performance-release-package.json`.

Publication, linked-file checks and an independent hosted secure WebSocket upgrade passed. Receipt: `build/arcade/deployments/bubble-madness-mp-8509a49-20261020t152237-19da-deploy-1792509757460-6e09.json`. [Performance findings](multiplayer-performance.md) record measurements and the 50 ms interpolation buffer. Chrome gameplay acceptance remains pending; the previous URLs keep their previous builds.

## Initial dynamic-world release artifact

Clean game revision `989dd4747d5b442ee0c87080fefba2f931791b57` now has a matching release browser export and Linux authority. [Ubuntu 24.04 CI run 39444147208](https://github.com/eduardoa-perez-tactile/poc-bubble-boobble/actions/runs/39444147208) passed 23 tooling tests, the real release cook, production world startup, shared-library checks and WebSocket upgrade. Its ready metadata confirms `world: true`. Static pairing and packaging passed with byte-identical cooked scripts and matching world configuration/input.

| Evidence | Project-relative path / value |
|---|---|
| Browser export | `build/arcade/web-989dd47/` |
| Linux server export | `build/arcade/ci-989dd47/server-linux-x64/` |
| Verified release ZIP | `build/arcade/bubble-madness-dynamic-989dd47.zip` |
| ZIP receipt | `build/arcade/bubble-madness-dynamic-989dd47.zip.json` |
| Pair / package reports | `.gameengine/dynamic-release-verify.json`, `.gameengine/dynamic-release-package.json` |
| ZIP bytes | `56497160` |
| ZIP SHA-256 | `0b838e58cfeebc870c9675bcfe32b5d3fb8b2b143e3dc7ff19c5874d8c670f3c` |
| Exact cooked script SHA-256 | `f9be30be853702c08032d5e2ac076ae0613d3a2b5bdcc7653d787683f732c302` |

This package was published on 20 October 2026 at [Play Bubble Madness](https://webgames.tactilews.com/bubble-madness-mp-989dd47-20261020t150140-1341/). Office Arcade reached `published`; entry/linked-file checks and an independent hosted secure WebSocket upgrade passed. Browser gameplay remains unverified. The deployment command above uses the current follow-up ZIP. Later documentation-only commits preserve its original built source identity. Native cooked-authority gameplay evidence is separate in [the dynamic-world specification](multiplayer-dynamic-worlds.md); actual browser acceptance remains unverified.

## Previous fixed-match release artifact

The actual browser and authoritative Linux exports from clean game revision `cd5516d91da52dc1d6fa96c7663c00ef126177a3` passed `arcade:verify` and were packaged successfully. The final [Ubuntu24.04 CI run 39435591999](https://github.com/eduardoa-perez-tactile/poc-bubble-boobble/actions/runs/39435591999) passed all 15 tooling tests, the real release cook, production authoritative game load, shared-library checks and WebSocket upgrade. The full-source release check, including the pipeline gate, typecheck, cook and 600-frame cooked smoke, also passed without a bypass.

| Evidence | Project-relative path / value |
|---|---|
| Browser export | `build/arcade/web-cd5516d/` |
| Complete Linux server export | `build/arcade/ci-cd5516d/server-linux-x64/` |
| Verified release ZIP | `build/arcade/bubble-madness-multiplayer-cd5516d.zip` |
| ZIP receipt | `build/arcade/bubble-madness-multiplayer-cd5516d.zip.json` |
| Static pair / package reports | `.gameengine/online-release-verify.json`, `.gameengine/online-release-package.json` |
| ZIP bytes | `56482515` |
| ZIP SHA-256 | `22062f49ee398085f8c1bcc7a1f573a29f07443784c7a531e29003dcda53a1bd` |
| Exact cooked-script SHA-256, both targets | `86592386670aa8d0758ae79a51ca5a08fc279b38820f74fab501a79084d4163b` |
| Engine version / source revision | `0.1.15` / `f4334da17701bf419fabae9f806d9e34edd947b0` |

The recorded pair can be rechecked from the game project directory:

```sh
npm run arcade:verify -- --web build/arcade/web-cd5516d --server build/arcade/ci-cd5516d/server-linux-x64
```

It was packaged with the following command; use a fresh output path if repeating it because existing outputs are refused:

```sh
npm run arcade:package -- --web build/arcade/web-cd5516d --server build/arcade/ci-cd5516d/server-linux-x64 --out build/arcade/bubble-madness-multiplayer-cd5516d.zip
```

A later documentation-only commit does not change this built game's script identity. Keep the artifact attributed to its recorded `cd5516d` revision and provenance; do not relabel or restamp it as a later revision. The ZIP was published using the deployment script above; actual browser multiplayer acceptance remains deferred.

## Current feasibility

The working machine is macOS arm64. Engine 0.1.15's server builder explicitly refuses cross-target exports (`E_CROSS`): Linux x64 must be built on Linux x64 because V8 and Dawn prebuilts are specific to the OS. No Docker, Podman, Colima or Orb runtime is on this machine's PATH. The game repository's read-only Actions runners endpoint reports zero registered self-hosted runners; the engine repository's runner inventory is inaccessible to this account. Existing GitHub Pages CI deploys prebuilt artifacts and does not establish a Linux engine toolchain.

Further archive inspection established a build path that does not require proprietary source access on CI. The public [v0.1.15 distribution](https://github.com/tactilegames/game-engine-releases/releases/tag/v0.1.15) includes `TactileGameEngine-0.1.15-linux-x64.tar.gz`. Its checksum matches the official release checksum file. It contains the real production `target/player/release/gameengine-host` and WebGPU library, the CLI and the cooker. The production host is built with `v8,desktop,shipped`, without the debug protocol; `desktop` includes the authoritative match-server feature. The `shipped` feature only changes Windows console handling. Inspection of the actual ELF host and library found only standard C/C++ runtime dependencies plus the adjacent WebGPU library, with maximum glibc symbol requirement 2.34, compatible with the arcade's glibc 2.39. Actual authoritative loading and startup subsequently passed in the Ubuntu24.04 CI run below.

**Engine 0.1.15 guide/CLI gap:** `build server` unconditionally calls `requireEngineCheckout`, so the official installed Linux distribution cannot use that command even though it already carries a suitable production server executable. `tools/arcade/prebuilt-server.mjs` provides an explicit assembly workaround: verify the pinned official runtime archive, invoke the real engine CLI's release cook, then export that exact official production host as `gameengine-server`, its WebGPU library, complete cooked content and the same `server.json` contract as the source builder. It never substitutes a Node simulation, pretends a dry run is runnable, creates a fake source checkout or overrides match identities.

The [Linux server workflow](../../.github/workflows/office-arcade-server.yml) runs this path on GitHub-hosted Ubuntu 24.04, then loads the actual cooked game in the production host and verifies its real WebSocket upgrade. It uploads a TAR artifact that preserves permissions. It uses public checksummed engine binaries, needs no private engine source/token and does not publish or contact Office Arcade. **[Run 39433292713](https://github.com/eduardoa-perez-tactile/poc-bubble-boobble/actions/runs/39433292713) succeeded** for source `d3048539129a3b1574fef50744c0be5f8a0d3d26`; the server job completed in 35 seconds. It passed the actual release cook, Linux library resolution, authoritative cooked-game startup and RFC6455 upgrade, then uploaded the permission-preserving server TAR. That initial evidence applies to the recorded revision; the final matching pair is established by run 39435591999 and the artifact evidence above. Regenerate both targets after gameplay/build changes. It runs automatically only for pushes to `codex/online-wave-survival`, allowing this new feature workflow to build before merging. It also retains `workflow_dispatch` for reuse once registered on the default branch. Each pushed feature revision gets a fresh build; retain its source SHA when pairing artifacts. The source-build route below remains available when an authorized full Linux engine checkout exists.

## Build server with the official runtime

On a fresh Linux x64 checkout of the same clean committed game revision as the web export:

```sh
npm run arcade:fetch-runtime -- --out /absolute/path/to/gameengine-runtime
npm run arcade:build-prebuilt-server -- --runtime-root /absolute/path/to/gameengine-runtime --out build/arcade/server-linux-x64
npm run arcade:smoke-server -- --server build/arcade/server-linux-x64
```

The checked-in `tools/arcade/runtime-pins.json` records the engine version, source release commit, official archive URL and SHA-256. Updating it requires inspecting and verifying a new engine release; do not silently select latest. The fetch step extracts into a dedicated location and writes download/binary checksums. Assembly requires a clean game revision, refuses existing output and points a fresh checkout's ignored `.gameengine/engine` link at that runtime; it refuses to replace an established different link. It restores generated browser release flags even when cook fails. All arcade exporters force both `GAMEENGINE_NATIVE_SYSTEMS=off` and `GAMEENGINE_TRANSPILE=off` through one shared environment helper, so browser and server use stock TypeScript with identical transpiler metadata settings. The helper overrides inherited/caller values. Disabling native acceleration alone is insufficient: the source checkout automatically adds system-source metadata when its engine crates are present, while the installed Linux runtime omits that map without a ready native SDK; those script differences change the engine match identity. No proprietary game/engine binary is compiled in this route.

The release helpers also support the current `multiplayer.world` configuration. The prebuilt exporter mirrors the engine builder's world contract in `server.json`: `authority: "server"`, `target: "linux-x64"`, port 8787, `world: true` and `players: null`. The cooked project declares its world input marker, public document and send cadence. The verifier requires matching world configuration on both targets and rejects inconsistent server metadata; the production smoke checker requires a world-ready record (`world: true`) rather than accepting a fixed-match startup. Exact cooked-script/config/input equality and clean provenance remain mandatory. These helper tests do not establish a new compiled dynamic-world release by themselves.

The smoke result proves target library resolution, authoritative cooked-game loading and an RFC6455 WebSocket upgrade. It does not join players, run a browser or prove shared gameplay/reconnect. The workflow's artifact includes both the complete server directory and that separate startup report. Fetch and unpack it locally with `gh run download` and `tar`, preserving the server directory unchanged, then combine it with the matching release web export using the verification/package commands below.

## Build matching exports

First complete engine correctness, release pipeline and regression checks. Use one clean committed game revision and exact engine release source tag for both targets. Keep the engine source free of tracked modifications. Derive source release identity from its exact `vX.Y.Z` Git tag: engine 0.1.15 source still carries `engine-version.json` value `0.1.9`, while release staging rewrites the installed distribution field. The verifier records that source metadata separately and does not edit the checkout to make it match. The existing web exporter checks the source tag against the installed SDK version. Game source stamps include revision, dirty state and a SHA-256 of tracked and nonignored source files; exports from different source contents cannot be combined.

Build the browser target through the existing web exporter, which retains virtual controls, save compatibility and the splash. Its ignored `.gameengine/web-toolchain.json` must point to the exact same real engine directory supplied here. The wrapper resolves both paths and refuses a mismatch before building, then verifies that actual checkout is a clean exact release tag:

```sh
npm run arcade:build-web -- --engine-root /absolute/path/to/engine-source
```

On Ubuntu 24.04 x64, check out the exact same clean game revision and engine release. Install the engine source's documented Linux build prerequisites and pinned Rust/Node/pnpm toolchain there, using an approved build environment. The server needs the engine's normal desktop build dependencies even though it never opens a GPU device. Do not copy macOS prebuilts into that checkout. Run:

```sh
npm run arcade:build-server -- --engine-root /absolute/path/to/engine-source --out /absolute/path/to/server-export
```

That wrapper executes the guide's actual `build server --target linux-x64 --authority server --port 8787` command, then records `arcade-build.json`. During the server cook it temporarily sets the generated browser release presentation flags (`DEVELOPMENT_BUILD=false`, `WEB_BUILD=true`), then restores the source in `finally`. The normal web pre-build hook uses those same values. This matters because the engine hashes the entire bundled script, including presentation; platform-specific flags would otherwise cause `E_MISMATCH` even with identical sim rules. It does not install prerequisites, alter global tools or start a server. Keep all exported files, permissions and bundled libraries when transferring the server export back. Build directly on Ubuntu 24.04 or an ABI-compatible older environment; a newer glibc binary may fail in the arcade's glibc 2.39 runtime.

An already-created export can be stamped on its original build machine with `node tools/arcade/run.mjs stamp --engine-root ROOT --export EXPORT --target web` (or `linux-x64`). A stamp is a local provenance record, not a cryptographic attestation of the build process. Never stamp a stale export as if it were freshly built.

The actual clean `a915d3a` browser/Linux exports exposed the transpiler-metadata mismatch above and were correctly rejected by the cooked-script verifier. After aligning both environment flags, a pure bundle comparison using the full-source and public-runtime CLIs produced identical 3,745,111-byte scripts with SHA-256 `86592386670aa8d0758ae79a51ca5a08fc279b38820f74fab501a79084d4163b`. Both actual targets were then rebuilt from clean revision `cd5516d`, and the full cooked-artifact verifier passed with that same exact script SHA-256. The paired release ZIP and final CI evidence are recorded above; the scratch proof was followed by real export verification.

## Verify and package

```sh
npm run arcade:verify -- --web build/web --server /absolute/path/to/server-export
npm run arcade:package -- --web build/web --server /absolute/path/to/server-export --out build/arcade/bubble-madness-release.zip
```

The verifier requires a real release web report, full game exports, preserved controls/splash, clean matching source/engine provenance, unchanged export checksums, ELF64 Linux x86_64 server and WebGPU library, authoritative realtime server config and port 8787. It extracts `gameengine/bundle.js` and `gameengine/project.gameengine.json` from each real `code.gpak`, comparing exact script bytes and game/version/multiplayer config and input mappings. Engine 0.1.15's match identity uses the project version and an xxh3 hash of that script; differing cooked scripts are a release blocker even if Git revisions match. Platform-specific texture manifests need not be byte-identical. Missing manifest-listed bundles, symlinks and common secret/cache paths fail verification.

The ZIP has `arcade.json`, the complete `site/`, the complete `server/` and `release-evidence.json`. The engine-exported README/run scripts/Dockerfile may remain in `server/` as part of the full export, but Office Arcade runs the manifest entry itself and does not execute uploaded scripts or Dockerfiles. The packager preserves executable bits, checks ZIP integrity and enforces the compressed 1 GiB limit. It writes a neighbouring `.zip.json` receipt with ZIP SHA-256 and build identity and leaves a `.contents/` directory for review. Existing output paths are refused.

These are static artifact checks. They do not prove glibc or shared-library compatibility, successful startup, socket upgrade, ten-client capacity, browser rendering or reconnect. Those remain separate acceptance gates.

## Previous fixed-match verification and limits

The authoritative harness passed four active ten-dragon matches: ten humans for 1,200 frames at 4/2-frame latency/jitter, two humans/eight AI for 900 frames at 10/6, and five/five plus one/nine for 600 frames each at 4/2. Every case executed its active-gameplay/roster assertion and passed hash agreement without divergence or desync. The final summary is `.gameengine/multiplayer-evidence/summary.json`; timings and stall counts are recorded in the experience log. Server timings ranged from 2.56 to 6.14 ms/tick and exceeded the roughly 2 ms rollback guidance, so smooth internet play is not established by those passes.

Final native V8 T0 regression passed 283 tests with recorded offline baseline hashes preserved; the phone-low selection passed 12 tests on the M2 Max engine host, and V8/WebAssembly parity passed 11 tests per lane without mismatches. Fifteen pure Node release-tooling tests pass. Actual Linux startup and WebSocket upgrade passed in the linked CI run above. These establish separate logic, artifact-tooling and Linux startup evidence; no actual browser multiplayer playtest has run.

The full desktop-tier combined suite passed 332/332 cases with a peak of 11 draws against the 14-draw limit. The mobile-tier combined suite completed 332 cases with 321 passes and 11 failures. An exact pre-feature `48cb9a7` mobile T1 baseline reproduced those same 11 failed test names and first error lines (37/48 passes), so the mobile comparison introduced zero new failures while retaining the known baseline failures. Mobile structural checks passed at 9/14 draws. Recorded pipeline counts are 10 compat, 16 desktop and 10 mobile. These full-suite totals predate four additional lifecycle-review tests. The later focused lifecycle selection passed 16/16 on desktop and 16/16 on mobile, including all four new review cases.

Independent review identified stale result state on new-room entry and an engine match object surviving a closed transport. UI fixes reset results, cache the reclaim token before best-effort leave and explicitly tear down the closed local match so it cannot keep simulating. This code-level lifecycle follow-up does not establish browser reconnect; token reclaim still depends on a surviving room with other connected peers.

The installed-SDK final check passed typecheck, validation, desktop cook and 600 cooked smoke frames. Its pipeline checker falsely labels built-in material program `7946469ed20397e0` stale because the installed distribution omits `crates/gameengine-render/src/materials/*.gen.json`. The full exact engine source contains that valid hash in `standard.gen.json` at line 144, and its direct source-CLI `pipelineIssues` check returned `ok: true, issues: []` without a bypass. Recapturing alone cannot fix the installed checker metadata. The full matching source CLI subsequently passed the real release check, including its pipeline gate, typecheck, desktop cook and 600 cooked smoke frames, without removing a valid program or bypassing validation. The matching final browser/server ZIP is verified and published as recorded above; deployed gameplay remains unverified.

## Read-only deployment inspection

These commands only query the documented stateless JSON-RPC HTTP endpoint, from office/VPN:

```sh
npm run arcade:list
npm run arcade:status -- --slug bubble-madness-mp
npm run arcade:check -- --slug bubble-madness-mp
```

A successful `check_game` validates the entry page and directly linked files. It does not play the game or check every runtime asset. Read-only inspection on 20 October found `snake-engine` and `curvecoaster`; query again before selecting a new address.

## Explicit publication, when requested

Re-read the live guide before uploading. Only run publication after the user requests publication and the concrete release has passed its gates:

```sh
npm run arcade:publish -- --slug NEW-AVAILABLE-SLUG --zip build/arcade/bubble-madness-release.zip
```

The command validates the ZIP receipt, calls `list_games`, refuses an occupied slug, calls `prepare_publish` with exactly `{slug, multiplayer: true}`, and uploads the raw ZIP using the returned URL and headers. It accepts only the documented same-origin HTTPS upload contract and stops on JSON-RPC/tool/HTTP errors. HTTP 202 is reported as **queued**. Use `arcade:status` until the returned state is `published` or `failed`; queued is not successful deployment. Use `arcade:check` after publication, then the returned play and secure socket URLs. Existing or failed publication addresses cannot be overwritten.

The authorized first deployment used `prepare_publish`, uploaded this verified ZIP and reached `published`. Office Arcade offers no public egress, host mounts or host ports; only `/tmp` is suitable for temporary writes. A process restart loses in-memory matches.

## Acceptance still required

For the previous fixed-match release, Linux dependency resolution, authoritative cooked-game startup and WebSocket upgrade passed in CI run 39435591999. The dynamic implementation has separate local native-world/socket evidence in [its specification](multiplayer-dynamic-worlds.md); its matching release exports passed the current artifact gate above, while new deployment evidence remains pending. Browser gameplay acceptance for the dynamic release then requires its new published URL: verify two separate browser contexts share movement, jump, fire, capture/rescue and match outcome, collect console/request failures and screenshots, and exercise disconnect/rejoin according to the verified engine policy. Additionally test ten actual browser clients and mixed human/AI rooms. Record source/build identity and distinguish engine network harness results, static checks and browser observations.

`PROJECT.md` restricts playtesting to engine APIs and specifically requires an explicit user request for browser automation. Browser acceptance remains deferred under that rule; a socket upgrade or static check cannot substitute for it. Draft findings for Trond in the experience log. Sending messages to Slack requires a user request.
