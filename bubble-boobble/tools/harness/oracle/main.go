// Runs upstream simulation only; no Ebitengine or audio imports.
package main

import (
	"bubblebobble/internal/game"
	"encoding/json"
	"fmt"
	"os"
)

type Span struct {
	Ticks   int          `json:"ticks"`
	Players []game.Input `json:"players"`
	Paused  bool         `json:"paused"`
}
type Scenario struct {
	Name    string `json:"name"`
	Seed    uint64 `json:"seed"`
	Round   int    `json:"round"`
	Players int    `json:"players"`
	Spans   []Span `json:"spans"`
}
type Frame struct {
	Frame int   `json:"frame"`
	Input *Span `json:"input"`
	State any   `json:"state"`
}

func run() error {
	var scenario Scenario
	if err := json.NewDecoder(os.Stdin).Decode(&scenario); err != nil {
		return err
	}
	levels, err := game.LoadCampaign(os.DirFS("resources"))
	if err != nil {
		return err
	}
	if scenario.Round < 1 || scenario.Round > len(levels) {
		return fmt.Errorf("invalid round")
	}
	// Slicing selects the desired round without duplicating upstream loading rules.
	g, err := game.NewPlayers(levels[scenario.Round-1:], scenario.Seed, scenario.Players)
	if err != nil {
		return err
	}
	initial, err := json.Marshal(g.OracleState())
	if err != nil {
		return err
	}
	frames := []Frame{{0, nil, json.RawMessage(initial)}}
	index := 0
	for _, span := range scenario.Spans {
		if span.Ticks < 1 || span.Ticks > 10000 {
			return fmt.Errorf("invalid span duration")
		}
		for i := 0; i < span.Ticks; i++ {
			g.Paused = span.Paused
			g.StepPlayers(span.Players)
			index++
			input := span
			input.Ticks = 1
			// Marshal now: upstream slices mutate on subsequent steps.
			raw, err := json.Marshal(g.OracleState())
			if err != nil {
				return err
			}
			frames = append(frames, Frame{index, &input, json.RawMessage(raw)})
		}
	}
	return json.NewEncoder(os.Stdout).Encode(frames)
}
func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
