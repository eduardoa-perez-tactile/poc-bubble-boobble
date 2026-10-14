package main

import (
	"bytes"
	"os"
	"path/filepath"
	"testing"
)

func TestRejectMalformedContractWithoutPCM(t *testing.T) {
	for _, args := range [][]string{
		{}, {"--track", "bubble-1.ym"}, {"--track", "/tmp/bubble-6.ym"},
		{"--track", "/tmp/bubble-1.ym", "--frames", "-1"},
		{"--track", "/tmp/bubble-1.ym", "--frames", "9223372036854775807"},
	} {
		var out, diag bytes.Buffer
		if err := run(args, &out, &diag); err == nil || out.Len() != 0 {
			t.Fatalf("invalid contract %v: %v PCM=%d", args, err, out.Len())
		}
	}
}

func TestFiniteFramesAndStereo(t *testing.T) {
	track := os.Getenv("YM_SOURCE_TEST_TRACK")
	if track == "" {
		t.Skip("set YM_SOURCE_TEST_TRACK to pinned bubble-N.ym")
	}
	track, _ = filepath.Abs(track)
	var a, b, diag bytes.Buffer
	if err := run([]string{"--track", track, "--frames", "17003"}, &a, &diag); err != nil {
		t.Fatal(err)
	}
	if err := run([]string{"--track", track, "--frames", "17003"}, &b, &diag); err != nil {
		t.Fatal(err)
	}
	if a.Len() != 17003*4 || !bytes.Equal(a.Bytes(), b.Bytes()) || diag.Len() != 0 {
		t.Fatal("finite PCM frame count, determinism or diagnostics")
	}
	nonzero := false
	for i := 0; i < a.Len(); i += 4 {
		p := a.Bytes()[i : i+4]
		if !bytes.Equal(p[:2], p[2:]) {
			t.Fatal("stereo channel mismatch")
		}
		nonzero = nonzero || p[0] != 0 || p[1] != 0
	}
	if !nonzero {
		t.Fatal("silent source")
	}
}
