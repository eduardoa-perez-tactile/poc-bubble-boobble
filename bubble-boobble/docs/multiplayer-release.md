# Office Arcade release

This game uses Trond's [live Office Arcade guide](https://webgames.tactilews.com/agents/), re-read on 20 October 2026. Office Arcade runs the exported authoritative engine server directly; the client connects to the same publication's secure `/socket` endpoint. There is no project-owned Node server or health wrapper.

## Current feasibility

The working machine is macOS arm64. Engine 0.1.15's server builder explicitly refuses cross-target exports (`E_CROSS`): Linux x64 must be built on Linux x64 because V8 and Dawn prebuilts are specific to the OS. No Docker, Podman, Colima or Orb runtime is on this machine's PATH. The game repository's read-only Actions runners endpoint reports zero registered self-hosted runners; the engine repository's runner inventory is inaccessible to this account. Existing GitHub Pages CI deploys prebuilt artifacts and does not establish a Linux engine toolchain.

Further archive inspection established a build path that does not require proprietary source access on CI. The public [v0.1.15 distribution](https://github.com/tactilegames/game-engine-releases/releases/tag/v0.1.15) includes `TactileGameEngine-0.1.15-linux-x64.tar.gz`. Its checksum matches the official release checksum file. It contains the real production `target/player/release/gameengine-host` and WebGPU library, the CLI and the cooker. The production host is built with `v8,desktop,shipped`, without the debug protocol; `desktop` includes the authoritative match-server feature. The `shipped` feature only changes Windows console handling. Inspection of the actual ELF host and library found only standard C/C++ runtime dependencies plus the adjacent WebGPU library, with maximum glibc symbol requirement 2.34, compatible with the arcade's glibc 2.39. Actual loading/startup must still pass on Linux.

**Engine 0.1.15 guide/CLI gap:** `build server` unconditionally calls `requireEngineCheckout`, so the official installed Linux distribution cannot use that command even though it already carries a suitable production server executable. `tools/arcade/prebuilt-server.mjs` provides an explicit assembly workaround: verify the pinned official runtime archive, invoke the real engine CLI's release cook, then export that exact official production host as `gameengine-server`, its WebGPU library, complete cooked content and the same `server.json` contract as the source builder. It never substitutes a Node simulation, pretends a dry run is runnable, creates a fake source checkout or overrides match identities.

The [Linux server workflow](../../.github/workflows/office-arcade-server.yml) runs this path on GitHub-hosted Ubuntu 24.04, then loads the actual cooked game in the production host and verifies its real WebSocket upgrade. It uploads a TAR artifact that preserves permissions. It uses public checksummed engine binaries, needs no private engine source/token and does not publish or contact Office Arcade. **The workflow has been authored but has not run; no Linux startup result is claimed yet.** It runs automatically only for pushes to `codex/online-wave-survival`, allowing this new feature workflow to build before merging. It also retains `workflow_dispatch` for reuse once registered on the default branch. The coordinator must push the committed feature revision before that initial build can run. The source-build route below remains available when an authorized full Linux engine checkout exists.

## Build server with the official runtime

On a fresh Linux x64 checkout of the same clean committed game revision as the web export:

```sh
npm run arcade:fetch-runtime -- --out /absolute/path/to/gameengine-runtime
npm run arcade:build-prebuilt-server -- --runtime-root /absolute/path/to/gameengine-runtime --out build/arcade/server-linux-x64
npm run arcade:smoke-server -- --server build/arcade/server-linux-x64
```

The checked-in `tools/arcade/runtime-pins.json` records the engine version, source release commit, official archive URL and SHA-256. Updating it requires inspecting and verifying a new engine release; do not silently select latest. The fetch step extracts into a dedicated location and writes download/binary checksums. Assembly requires a clean game revision, refuses existing output and points a fresh checkout's ignored `.gameengine/engine` link at that runtime; it refuses to replace an established different link. It restores generated browser release flags even when cook fails. Native acceleration is disabled for this server cook so the shipped game uses its TypeScript systems and the official stock host. No proprietary game/engine binary is compiled in this route.

The smoke result proves target library resolution, authoritative cooked-game loading and an RFC6455 WebSocket upgrade. It does not join players, run a browser or prove shared gameplay/reconnect. The workflow's artifact includes both the complete server directory and that separate startup report. Fetch and unpack it locally with `gh run download` and `tar`, preserving the server directory unchanged, then combine it with the matching release web export using the verification/package commands below.

## Build matching exports

First complete engine correctness, release pipeline and regression checks. Use one clean committed game revision and exact engine release source tag for both targets. Keep the engine source free of tracked modifications. Game source stamps include revision, dirty state and a SHA-256 of tracked and nonignored source files; exports from different source contents cannot be combined.

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

## Verify and package

```sh
npm run arcade:verify -- --web build/web --server /absolute/path/to/server-export
npm run arcade:package -- --web build/web --server /absolute/path/to/server-export --out build/arcade/bubble-madness-release.zip
```

The verifier requires a real release web report, full game exports, preserved controls/splash, clean matching source/engine provenance, unchanged export checksums, ELF64 Linux x86_64 server and WebGPU library, authoritative realtime server config and port 8787. It extracts `gameengine/bundle.js` and `gameengine/project.gameengine.json` from each real `code.gpak`, comparing exact script bytes and game/version/multiplayer config and input mappings. Engine 0.1.15's match identity uses the project version and an xxh3 hash of that script; differing cooked scripts are a release blocker even if Git revisions match. Platform-specific texture manifests need not be byte-identical. Missing manifest-listed bundles, symlinks and common secret/cache paths fail verification.

The ZIP has `arcade.json`, the complete `site/`, the complete `server/` and `release-evidence.json`. The engine-exported README/run scripts/Dockerfile may remain in `server/` as part of the full export, but Office Arcade runs the manifest entry itself and does not execute uploaded scripts or Dockerfiles. The packager preserves executable bits, checks ZIP integrity and enforces the compressed 1 GiB limit. It writes a neighbouring `.zip.json` receipt with ZIP SHA-256 and build identity and leaves a `.contents/` directory for review. Existing output paths are refused.

These are static artifact checks. They do not prove glibc or shared-library compatibility, successful startup, socket upgrade, ten-client capacity, browser rendering or reconnect. Those remain separate acceptance gates.

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

The implementation task has not run `prepare_publish`, uploaded files or published anything. Office Arcade offers no public egress, host mounts or host ports; only `/tmp` is suitable for temporary writes. A process restart loses in-memory matches.

## Acceptance still required

Run the actual Linux export on its target environment and record loader dependencies, engine startup and authoritative socket behavior. Against the eventual published URL, verify two separate browser contexts share movement, jump, fire, capture/rescue and match outcome, collect console/request failures and screenshots, and exercise disconnect/rejoin according to the verified engine policy. Additionally test ten actual browser clients and mixed human/AI rooms. Record source/build identity and distinguish engine network harness results, static checks and browser observations.

`PROJECT.md` restricts playtesting to engine APIs and specifically requires an explicit user request for browser automation. Browser acceptance remains deferred under that rule; a socket upgrade or static check cannot substitute for it. Draft findings for Trond in the experience log. Sending messages to Slack requires a user request.
