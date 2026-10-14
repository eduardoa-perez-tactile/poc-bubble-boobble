// ym-source pipes the pinned reference YM stream; it does not reset the synth at loops.
package main

import (
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"bubblebooble/desktop-ym-source/internal/ym"
)

func run(args []string, stdout io.Writer, stderr io.Writer) error {
	flags := flag.NewFlagSet("ym-source", flag.ContinueOnError)
	flags.SetOutput(stderr)
	track := flags.String("track", "", "absolute path to bubble-1.ym through bubble-5.ym")
	loop := flags.Bool("loop", true, "preserve the synthesizer while repeating the track")
	frames := flags.Int64("frames", 0, "maximum stereo PCM frames; zero streams to EOF/cancellation")
	if err := flags.Parse(args); err != nil {
		return err
	}
	base := filepath.Base(*track)
	if flags.NArg() != 0 || !filepath.IsAbs(*track) || len(base) != len("bubble-1.ym") || !strings.HasPrefix(base, "bubble-") || !strings.HasSuffix(base, ".ym") || base[7] < '1' || base[7] > '5' {
		return errors.New("--track must be an absolute path to bubble-1.ym through bubble-5.ym")
	}
	if *frames < 0 || *frames > (1<<63-1)/4 {
		return errors.New("--frames must fit a nonnegative PCM byte count")
	}
	data, err := os.ReadFile(*track)
	if err != nil {
		return err
	}
	stream, err := ym.New(data, *loop)
	if err != nil {
		return err
	}
	defer stream.Close()
	var source io.Reader = stream
	if *frames > 0 {
		source = io.LimitReader(stream, *frames*4)
	}
	// No producer goroutine or application queue: a blocked pipe stops synthesis.
	// Standard SIGTERM/SIGINT terminate even if blocked in Write. SIGPIPE stops
	// the helper when its native consumer closes stdout on a track change.
	_, err = io.CopyBuffer(stdout, source, make([]byte, 4096*4))
	return err
}

func main() {
	if err := run(os.Args[1:], os.Stdout, os.Stderr); err != nil {
		if errors.Is(err, flag.ErrHelp) {
			return
		}
		fmt.Fprintln(os.Stderr, "ym-source:", err)
		os.Exit(1)
	}
}
