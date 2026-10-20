# Shareable browser build

Bubble Madness exports the real Tactile engine as WebAssembly/WebGPU, served by GitHub Pages:
https://eduardoa-perez-tactile.github.io/poc-bubble-boobble/

Desktop WebGPU browsers are the initial target. Keyboard controls work for solo, AI co-op and
local two-player co-op; standard-map controllers feed the same recorded engine input. The
bridge allocates up to ten stable seats, releasing held buttons on disconnect/focus loss.
Physical controller hardware still requires playtesting. Mobile gameplay touch controls and
the unused level generator are outside this release scope.

## Local toolchain

The installed engine SDK must match a full tagged engine source checkout. Machine-specific
paths live only in ignored `.gameengine/web-toolchain.json`:

```json
{
  "engineRoot": "/path/to/engine-source",
  "cargoHome": "/path/to/cargo",
  "rustupHome": "/path/to/rustup",
  "emsdkRoot": "/path/to/emsdk",
  "rustToolchain": "1.94.1"
}
```

For SDK 0.1.15, use source tag v0.1.15, Emscripten 6.0.10 and Rust 1.94.1 with
wasm32-unknown-emscripten. Build the wasm test host using the engine's
`node tools/wasm/build.mjs --host` with that scoped toolchain. An existing matching setup,
such as Street Fighter's, can be reused by pointing these ignored paths at it.
`npm run web:inspect` verifies the required files and matching source tag. Never commit the
engine, toolchains, generated exports or save data. Export runs the source checkout's CLI;
install its dependencies, including `es6-promise`, there. The installed editor's reduced SDK
dependency set does not include that browser runtime package.

## Build and verify

```sh
npm ci
npm run web:inspect
npm run web:parity
npm run web:build
npm run web:serve
```

The export is `build/web/site/`. Serve the whole folder over HTTPS or localhost; wasm uses
`application/wasm`. The launch click unlocks audio. Browser music uses existing converted WAV
tracks, without the macOS native YM helper. Saves use the engine's IndexedDB filesystem, with
a stable web identity; they are browser/origin-local and may be unavailable in private storage.

`npm run web:test` performs isolated headless Chrome/Metal WebGPU acceptance with keyboard
navigation, rendering, pause/resume, fullscreen, resizing, virtual gamepad input, native inactive-tab suspension/resume and save/reload.
It never launches a desktop game or focuses the user's browser. Screenshots and results go to
`build/web-qa/`. This command uses Google Chrome installed on the machine. It is browser QA,
not a claim about physical controller hardware, audible output, other browsers or mobile GPU performance.

The shareable build uses the engine's `probe` configuration for frame/hash diagnostics and
records no development menu capability. `WEB_CONFIG=release npm run web:build` opts into the
engine's full release gates; release pipeline coverage must be current first.

## Publish

The browser loading screen uses the game's arcade font, logo, palette and ten dragon sprites.
Its HTML, styles and event-driven loading indicator live in `web/splash.html`, `web/splash.css`
and `web/splash.mjs`; `tools/web/splash-shell.mjs` installs them during export. Bootstrap art is
copied outside the game packs so it can display before the engine loads. `web/splash/logo.webp`
is a 700px-wide version of `assets/branding/bubble-madness-logo.png`, exported at WebP quality 95
with its transparency intact; the font and portraits are copied unchanged.

After a fresh web build, `npm run web:preview-splash` captures loading, ready, expanded controls
and error states in `artifacts/browser-splash/`, checks five viewport sizes, and verifies the
real engine's loading-to-ready transition. This isolated headless capture never starts gameplay
or opens the user's browser. The normal deployment checks remain required before publishing.

Commit the finished source, then run `npm run web:verify`. It records native checks, the real
V8/WebAssembly test lane, a fresh web export and browser acceptance for that exact clean SHA.
`npm run web:publish` refuses dirty/stale/unverified artifacts. It uploads only the compiled
static site to a prerelease and dispatches `.github/workflows/web-playtest.yml` on main.
The workflow deploys the supplied artifact; GitHub-hosted CI does not build the proprietary engine.
Check the deployment completes and the public `playtest-build.json` matches the verified SHA.

When the project's engine-only playtest restriction applies, use
`npm run web:verify -- --defer-browser-playtest` and
`npm run web:publish -- --defer-browser-playtest`. Native checks, WebAssembly parity and a
clean export remain mandatory. Browser gameplay acceptance is recorded as **deferred**, not
passed, with the exact command and policy reason disclosed in the release notes. Both commands
require the explicit flag; a real failed browser test or stale evidence cannot be waived by it.

The browser menu replaces Quit with How to Play. Fullscreen in Settings opens an explicit
browser button, because browsers require a direct user gesture for fullscreen. F11 also opens
that dialog. The level editor/generator is not exposed from the public menu.

## Browser save compatibility

Engine 0.1.14 and later own browser persistence and flush completion. Their exported
loaders are kept unchanged. For engine 0.1.13 only, Emscripten 6.0.10 implements `fd_sync`
using Asyncify. Saving from a nested
wasm → game JavaScript → wasm service call crashes that path. The export applies a checked,
project-local loader patch: the file flush is synchronous in memory, while the existing IDBFS
autoPersist writes asynchronously to IndexedDB. The engine shell also flushes on backgrounding.
No installed/shared engine files are changed. Browser acceptance verifies actual persisted
settings and campaign progress, then reloads the game. Unsupported loader versions fail the
patch check rather than silently exporting an unverified save path.

The native visual gate explicitly selects `--gpu-tier desktop`, matching this release and
the project's reference images. Phone-low residency is checked separately on the six-player
capture/rescue/boss/results scenario: running every screenshot test with a residency mode
that renders every simulation step changes intermediate UI/particle animation snapshots.
One pre-existing desktop boss-soak golden was reviewed against clean main and refreshed: the
branch and clean-main actual pixels matched exactly, including all game objects/HUD; the old
reference differed at bubble glow edges. No snapshot thresholds or gameplay assertions were relaxed.
