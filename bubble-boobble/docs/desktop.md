# Desktop shell and local progress

The desktop shell is a controller/view/document split. `src/desktop/state.ts` receives recorded `DesktopIntent` events in `DesktopSystem`; `DesktopUI` reads documents and places previewable views. Both are gated by `ArcadeControl.active`, so older movement/starter scenes remain independent. UI documents under `ui/docs/desktop-*.ui.json` were authored through `gameengine ui doc` and are editable in the engine editor.

`desktopGameRequest` is the sim interface consumed by the arcade owner. Every request increments `sequence`; actions are `start`, `playtest`, `pause`, `resume`, `quit` (leave a run), and `exit` (close the desktop application). A playtest includes the exact lowercase Go level object in `customLevel`. Helpers `showDesktopPause`, `setDesktopRunScore`, and `finishDesktopRun` are sim-only hooks for the arcade integration. Campaign restart/leave accounts for one lost run; completion records once; custom playtests never affect profile statistics.

Progress uses a versioned, persisted engine meta document (`meta:bubblebobble-desktop`). Defaults and progression match the pinned Go save semantics: PLAYER1/green, music 50, sound 75, one to eight case-insensitively unique profiles, names of 1–16 ASCII letters/numbers/spaces/hyphen/underscore with no surrounding whitespace, 25 XP for a loss and 75 XP for a win, best score and best round, and 100 XP per displayed player level. Storage location and serialized envelope are engine-native; importing/exporting the original Go save file is not implemented. A failed or incompatible save follows the engine's preservation policy and does not silently overwrite that save.

Editor logic keeps the reference 32×26 grid, protected two-column side walls, six enemy kinds, 32-enemy maximum, actor head clicks stored as feet two rows below, 50-entry undo history, campaign copy, empty template, 25 tile themes, special-bubble cycle and 16 bubbles per nonempty element. Saves and playtest requests validate against the reference level rules. `paint-begin`/`paint-end` group one pointer gesture into one undo entry. The renderer owns the preview at logical rectangle [24,146,512,416]; the UI document leaves it transparent.

Controls consume `menuY`, `menuX`, `confirm`, `profileConfirm`, `back`, `delete`, `fullscreen`, `undo`, `save` and `playtest` action names plus recorded `TextInput`. Menus emit intents; views never access the world. Arcade input, desktop exit and audio volume application belong to arcade/platform integration. F11 persists the fullscreen preference. The game-owned macOS launcher applies it as reversible borderless desktop fullscreen; ordinary engine/editor runs show a capability notice when that adapter is unavailable. The UI subscribes to `app.onLifecycle` in presentation and emits a recorded pause request when active gameplay backgrounds. Native focus-loss responses re-read the current screen/game before emitting pause, so a late response cannot replace a result or menu screen. A focused T0 regression covers those transitions. Native adapter details and proof commands are in [tools/desktop/README.md](../tools/desktop/README.md).

## Verification status

`tests/desktop.test.ts` now has 12 passing V8 T0 cases, including actual physical Ctrl-left/right and Cmd-left/right Z/S shortcuts, F5, Tab, profile/name handling, saves, editor rules and recorded settings. Modifier requirements are checked from held key actions because this runtime ignores binding `mods` fields. Unmodified S/Z do not invoke editor shortcuts. P/F/B remain no-ops, matching the pinned implementation despite its footer hint.

Scoped T1 cases protect actual name-keyboard hit rectangles, title animation and Ready/Clear/Pause/Win layout. Result score and statistics use separate reference sizes/positions; the pause panel is opaque; UI transitions are instant. Root presentation-flow captures cover 17 distinct states. Goldens establish inspected regression baselines, not full Go image parity.

The main-menu logo/buttons, editor buttons, Help/Credits labels, profile rows/buttons, score-table columns, settings/avatar/statistics layout, name keyboard and HUD/banner text use reference logical coordinates. Fixed 768×720 document roots are centered in the containing reference canvas; a wide main-menu render was inspected, and the renderer owner verified the three arcade resize captures. Title/menu bubbles, the seven-frame dragon walk, title prompt blink and name caret use the shared engine `Time.step` presentation phase. That phase is read by presentation; no animation writes the simulation.

The previous dynamic renderer's release-host menu-overlay measurement (`artifacts/desktop-menu-perf.json`) captured 600 sim steps and 37 presentation frames: presentation p50 0.496 ms, p95 0.685 ms, maximum 4.078 ms; sim-step p95 0.209 ms, no hitch steps; maximum GC pause 0.386 ms; process memory 165 MiB. The subsequent rendered sample used six draw calls and 334 instances. The previous round-25 match remained active behind that overlay, so these are combined game-plus-overlay measurements, not isolated menu costs. The paused host's whole-frame maximum is not a playable-frame-rate verdict.

The nearest renderer owns sprites, menu circles, logo/portraits and encoded-RGB dimming. UI documents retain the editable labels/buttons and their reference coordinates. Original Go save-file interchange and a portable notarized desktop distribution remain outside the implemented storage/launcher path. Text rasterization has no automated cross-renderer allowance yet. Fresh Go captures now run through LaunchServices; tile-boundary pixels vary even between repeated pristine Go launches, and are reported explicitly in [rendering.md](rendering.md).

## Desktop audio transport

The launcher packages the pinned original continuous YM decoder and a bounded
AVAudioSourceNode transport. Initial controls precede audio output; pause and mute
retain the source cursor, muted track changes wait for unmute, and background
menus/results keep playing. Per-launch bundle identity prevents an editor Play
world from controlling the native app. The ordinary editor uses the distinct
converted-WAV fallback. See the adapter README for exact PCM loop, pause,
shutdown, client-isolation evidence and the passing ordinary native GUI gate.

Seven engine audio tests cover actual fallback loading/handoff, bank-stop mute,
first-cue reload, per-cue gain, zero-volume gating and 24-voice saturation.
Strictly descending recorded priorities retain older voices at the global cap;
per-sound caps are disabled so they cannot steal before that policy. The signed
cursor resets only after mute stops the bank, and fails before integer wrap.
Pure simulation sound lists remain unchanged.

## Live viewport startup

The black-world regression was reproduced with the engine's live viewport API:
HUD text rendered while dynamic world geometry did not. Comparing the working
`round1.scene` isolated the difference between its ordinary sprites and the arcade
world's dynamic mesh. The arcade renderer now uses a shared static quad with
instanced atlas rectangles and colors, preserving the original draw plan and
encoded source-over composition. A cold viewport test verifies actual world
pixels before any offscreen screenshot can initialize the missing path. See
[rendering.md](rendering.md) for evidence and sampling limits.

Testing uses game-engine APIs only. Actual OS-native window surface verification
is deferred under the user's instruction; it does not block merging passing
engine checks. The prior native control checks did not establish visible world
rendering and must not be treated as pixel-output proof.

Steady measurements of the replacement use 120 individual live viewport frames
per case. Two-player round 25 has simulation p95 0.755 ms and presentation p95
6.706 ms, five draws, 335 visible instances and 216.8 MiB process memory. Title
has simulation p95 0.569 ms and presentation p95 8.873 ms, five draws, 1,547
visible instances and 233.6 MiB memory. The retained pool contains 2,574 visual
entities, including one text slot. These are engine viewport measurements, not
OS-display frame-rate claims; evidence is `artifacts/viewport-static-steady.json`.

## Bubble Madness branding and mode selection

The public title and application name are **Bubble Madness**. The title/menu logo
uses `assets/branding/bubble-madness-logo.png`, a transparent 1477×1065 RGBA edit
created with built-in ImageGen. The edit prompt preserves the existing yellow
cloud, orange rim and pink outlined lettering while replacing the bottom word
“BOBBLE” with “MADNESS”. Original reference artwork and atlas texels are unchanged.
The new logo is a UI icon; the old logo is retained only as reference evidence.

Start Game opens an illustrated two-card selector: Classic starts the existing
campaign, and Bubble Madness opens the ten-dragon setup. Left/right selects a
card; confirm continues; Back/Escape returns to the main menu.

All main menus contain exactly Start Game, Settings and Quit. The title and menu
show all ten dragons, fitted in one row above the navigation hint. Their
staggered hop-and-walk bursts repeat every six seconds while bubbles drift
upward at different speeds with gentle sideways movement. Buttons stay fixed;
Reduced Effects holds both decorations still. The player/high-score line is
removed from the title and main menu. Profiles,
High Scores, Level Editor, How to Play and Credits remain available to internal
engine tooling, but have no main-menu buttons. The recorded development flag
still identifies build capabilities; it does not change the menu choices.

Engine tests exercise all three menu hit targets, starts of both modes,
keyboard/pad navigation, ten portrait draw entries and screen bounds at
768×720, 1680×720, 640×960 and 2160×720. Build artifacts are packaged without
launching the standalone application, per PROJECT.md.

For build-gate verification, `tools/desktop/verify-menu-build.mjs` extracts the
exact JavaScript from an assembled build's `code.gpak` and runs it on a diagnostic
headless engine host. It checks the recorded flag and the visible button labels.
`gameengine run --cooked` alone is insufficient for this assertion: that command
loads cooked assets but still supplies a newly bundled development script.
The earlier exact-script checks passed with eight buttons/true for dev and two
buttons/false for release. Reports are in ignored `artifacts/menu-build-*.json`.
