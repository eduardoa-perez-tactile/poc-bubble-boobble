# Stateful YM PCM source

This isolated Go helper uses the pinned original `internal/ym.Stream` unchanged.
It creates **one** synthesizer per process and calls `ym.New(data, true)`. The
pinned YM player handles loop-frame wrap while keeping chip/filter state alive.
There is no emulator reimplementation, PCM splice, seek or loop reset.

## Build and wire contract

From the project root, with exact Go 1.26.9 (the pinned local toolchain is shown):

```sh
# Explicit one-time dependency setup; launch itself keeps GOPROXY=off.
.cache/toolchains/go/bin/go -C tools/desktop/ym-source mod download
.cache/toolchains/go/bin/go -C tools/desktop/ym-source build -o ../../../.cache/desktop/ym-source .
.cache/desktop/ym-source --track "$PWD/assets/reference/audio/bubble-1.ym" --loop=true --frames 48000 > .cache/desktop/ym-one-second.pcm
```

`--track` must be an absolute path whose filename is `bubble-1.ym` through
`bubble-5.ym`. The launcher resolves its fixed known resource whitelist; this
helper does not expose a network API. `--loop` defaults to true. `--frames N`
limits output to N stereo frames; omitted/zero streams until cancellation (or
EOF with `--loop=false`). Negative and overflowing frame counts are rejected.

Stdout contains **only raw 48,000 Hz stereo signed PCM16 little endian**, with
identical left/right channels and the reference's integer divide-by-two gain.
There is no header, framing message, fade, normalization, volume adjustment or
track identifier in the byte stream. Consumers retain partial pipe reads and
assemble four bytes per stereo frame. Diagnostics go to stderr; success exits
zero and invalid arguments/load/write errors exit nonzero. An unavailable
track produces no PCM. SIGTERM/SIGINT terminate the process, including while
stdout is blocked; a closed consumer pipe causes standard SIGPIPE termination.

The source is pull-based: one 16 KiB copy buffer and the original 8 KiB mono
buffer, plus the loaded track/synthesizer and bounded OS pipe. There is no
producer goroutine or growable PCM queue. Consumer backpressure blocks further
synthesis. Keep the same process and bounded consumer queue for pause/resume;
pause consumption without throwing away queued samples. Terminate it on track
change and start the new track at zero. Native integration and queue cursor
proof belong to `native/`; the desktop launcher builds and packages this helper
with verified original YM files. Launch builds use exact Go 1.26.9 and cached
pinned modules with networking disabled; run the explicit harness setup first.

Track mapping is unchanged: theme=1, menu/opening=2, hurry=3, gameover=4, win=5.

## Pinned provenance

Reference revision: `783cf6aa26ac3c57cdab43f2d7a5b3725a3991cc`.
`internal/ym/stream.go` is byte-identical to that reference, SHA-256
`299085352bb31ee24e09459c3d9ec727e0ecaeb4112fc3972560bbb1f70b21a4`.
Its original MIT license is alongside it.

The synthesis dependency is exactly
`github.com/olivierh59500/ym-player v0.0.0-20260913215440-3f73bdca82e5`, module
sum `h1:TNP4PkhH/3bCosR556/63adijcXwmTQhYCqDI49SEko=`. `go.sum` pins its module
metadata as well. No Ebitengine dependency or audio device is needed.

## Deterministic proof

```sh
YM_SOURCE_TEST_TRACK="$PWD/assets/reference/audio/bubble-1.ym" .cache/toolchains/go/bin/go -C tools/desktop/ym-source test ./...
python3 tools/desktop/ym-source/probe.py
```

The probe builds a separate oracle inside a temporary ignored command directory
of the pinned reference module; that oracle imports the original reader directly.
It deletes the temporary command source after building. It compares all output
bytes for every track across the first and second loop plus 4,096 frames after
the second boundary. `expected-pcm.json` pins input hashes, dependency sums,
frame counts and whole/window PCM hashes. The full machine-local report is
`.cache/desktop/ym-source-proof.json`. Proof metadata uses read-only reflection
on the pinned library to observe frame count/rate/loop point; production helper
code does not use reflection or inspect decoder internals.

All five files use a 50 Hz register rate and loop frame zero:

| track | first/repeat PCM frames | compared frames | old finite-export frames | extra terminal frames |
|---|---:|---:|---:|---:|
| bubble-1 | 2,212,800 | 4,429,696 | 2,215,936 | 3,136 |
| bubble-2 | 490,560 | 985,216 | 491,520 | 960 |
| bubble-3 | 621,120 | 1,246,336 | 622,592 | 1,472 |
| bubble-4 | 552,000 | 1,108,096 | 552,960 | 960 |
| bubble-5 | 277,440 | 558,976 | 278,528 | 1,088 |

The committed WAV PCM matches the original `loop=false` output exactly. The
extra terminal segment is **not all silence**: track 1 contains 1,464 nonzero
frames there; tracks 2–5 each contain 488. The decoder finishes its 4,096-frame
Compute buffer after the logical end; its next fill reports EOF. The first
finite-versus-continuous mismatch occurs exactly at each logical first-loop
boundary. Therefore repeating the entire exported WAV adds an incorrect tail
and resets chip state; trimming the tail alone also fails waveform parity.
The probe records both whole-WAV and trimmed-first-loop repeat mismatches.

The probe also leaves stdout unread, verifies that the helper stays blocked,
and sends SIGTERM with a two-second termination deadline. This proves bounded
transport cancellation, not device playback quality or native pause/resume.

A local macOS arm64 offline throughput check synthesized 4,429,696 stereo frames
(92.285 seconds) to `/dev/null` in about 0.02 s, with 4,374,528 bytes maximum
resident memory and 2,867,656 bytes peak memory footprint (`/usr/bin/time -l`).
This is an offline source measurement, not an audio callback/device deadline.
`go test -race ./...` and `go vet ./...` also pass with the pinned test track.
