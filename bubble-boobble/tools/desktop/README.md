# macOS desktop presentation adapter

This project adapter works around missing desktop fullscreen and music
pause/resume transport controls in the installed runtime. Original YM files and
converted WAVs have distinct asset aliases: `reference/audio/bubble-N` is source
YM data and `reference/audio/music-bubble-N` is playable converted music. Source
and cooked audio tests verify engine music fallback loads these WAV aliases.
It changes no engine sources or
installed binaries. It currently supports **macOS arm64 only**.

From `bubble-boobble/`:

```sh
npm run desktop
npm run desktop:integration
```

The launcher requires the project's installed engine link, Node.js and Apple's
command-line compiler/signing tools. It reserves `127.0.0.1:47681`, copies the
installed V8 host and WebGPU library into ignored
`.cache/desktop/BubbleBoobble.app`, builds the
project Objective-C adapter, and ad-hoc signs the **copied** executable with the
JIT/library-loading entitlements required by V8 and this adapter. It hashes the
original host before/after packaging and refuses an unexpected change. The copied
application is signed and started through public LaunchServices (`open -n -W`)
with the current game bundle and native platform services. A per-launch identity
and its own executable path verify the native host PID; cleanup targets that PID
rather than the separate `open` process. Its stdout/stderr are forwarded from
private per-launch log files.

The game-owned dylib loads only into that copied process. Public AppKit APIs
control that process's own NSWindow. Fullscreen is **borderless desktop mode**:
it saves/restores window frame/style and covers the current screen, with the Dock
and menu bar set to auto-hide. It does not claim a separate macOS fullscreen Space.
No Accessibility or Apple Events permission is used; no other app is controlled.

The adapter reads desired presentation state and reports observed NSWindow and
AVAudioPlayer state at 20 Hz. The TypeScript `DesktopPlatformBridge` is an optional
`defineUI` controller, using public `net.fetch` plus the app lifecycle callback.
It reads settings and canonical pause state, then sends only changed preferences
or a two-second heartbeat. Connection transitions emit recorded `DesktopIntent`
actions `native-audio` with value `1` or `0`, for the game to select native music
versus its standard engine fallback. The controller is exported from `src/main.ts`. The recorded native availability
flag makes the engine Music bus silent while native music is connected, then
restores the standard engine fallback when disconnected. SFX remain independent.

Native music uses AVAudioPlayer with the five committed converted WAV tracks.
Volume/mute map directly to player volume. Pause calls `pause` and resume calls
`play` on the same player, preserving `currentTime`; changing track starts its new
WAV at zero. Background app lifecycle requests pause without advancing music.
Each WAV repeats its exported PCM segment (`numberOfLoops = -1`) without fades.
The pinned reference decoder (`stsound/ymmusic.go`, `player`) wraps
`currentFrame` to `loopFrame` without resetting the YM chip. These WAVs were
exported with `loop=false`, so repeating the first PCM segment does not preserve
that continuous chip/filter state; the decoder's 4096-frame read buffering may
also leave a terminal tail in the export. Music waveform equivalence across loop
boundaries is therefore not established. Sound effects stay on the engine's SFX bus,
which already owns the saved sound level and mute setting.

The loopback protocol exposes `/health`, authenticated `/state`, `/status`, `/game`, and `/input`. `/game` is a read-only
projection reported by the game client. `/input` accepts only eight fixed game
keys plus own-window hide/restore and posts them into this process's own Cocoa queue for bounded integration
probes; it cannot control another process.
Each launch generates a random 256-bit bearer token. It refuses browser Origin
headers, unknown fields, invalid ranges, arbitrary track names, and large bodies.
Only the five known project audio filenames can reach native file loading. The
HTTP service binds loopback only and performs no general file or command access.
State-file updates use atomic rename; native status writes are atomic too. Native
music pauses if its request-file heartbeat becomes older than five seconds, so a
dead launcher/client cannot leave orphaned music running indefinitely.

`probe.mjs` aliases the integrated bounded own-game probe. It drives actual
menu/settings and pause inputs, verifies game-reported screens, native fullscreen
dimensions and volume changes, and exact paused music position across 700 ms
before resuming. It checks rejected unauthorized, browser-origin and arbitrary
track requests and restores initial fullscreen/music preferences. Its evidence is
written to ignored `artifacts/desktop-platform-integration.json`; logs go beside
it. The GUI probe requires an unlocked desktop and waits for ordinary foreground
activation before sending keys; it does not unlock or bypass the OS lock. Clicking
the game window is the normal user activation path if macOS declines activation. Focus is read from Cocoa at 20 Hz. After a focused-to-unfocused transition during
play, the client emits a recorded pause intent; an unfocused startup does not
pause. The probe hides/restores only its own game window and verifies canonical
pause and music position retention. It does not switch to or control another
application, verify device listening quality, or claim waveform equivalence.

The launcher is a developer distribution path, not a notarized release package.
Windows/Linux, macOS x64, native fullscreen Spaces, device audio quality, and a
redistributable installer have not been verified. Normal engine/editor runs can
keep their existing fallback when no adapter is present.
