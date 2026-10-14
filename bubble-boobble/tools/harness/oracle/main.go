// Runs upstream simulation only; no Ebitengine or audio imports.
package main

import (
	"bubblebobble/internal/game"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math"
	"math/rand/v2"
	"os"
	"strconv"
)

type Span struct {
	Ticks   int          `json:"ticks"`
	Players []game.Input `json:"players"`
	Paused  bool         `json:"paused"`
}
type Scenario struct {
	FullCampaign bool            `json:"fullCampaign"`
	Setup        json.RawMessage `json:"setup"`
	RNGCount     int             `json:"rngCount"`
	FMAs         [][3]float64    `json:"fmas"`
	Angles       []float64       `json:"angles"`
	Spawn        *game.Cell      `json:"spawn"`
	Mode         string          `json:"mode"`
	Player       *game.Player    `json:"player"`
	Name         string          `json:"name"`
	Seed         uint64          `json:"seed"`
	Round        int             `json:"round"`
	Players      int             `json:"players"`
	Spans        []Span          `json:"spans"`
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
	if scenario.Mode == "rng" {
		source := rand.NewPCG(scenario.Seed, scenario.Seed^0xa0761d6478bd642f)
		rng := rand.New(source)
		frames := []Frame{}
		bounds := []int{1, 2, 3, 4, 7, 16, 25, 100, 1000, 9007199254740991}
		for i := 0; i < scenario.RNGCount; i++ {
			u := rng.Uint64()
			f := rng.Float64()
			n := bounds[i%len(bounds)]
			v := rng.IntN(n)
			state, _ := source.MarshalBinary()
			frames = append(frames, Frame{i, nil, struct {
				Uint64  string
				Float64 float64
				N, IntN int
				RNG     string
			}{strconv.FormatUint(u, 16), f, n, v, hex.EncodeToString(state)}})
		}
		return json.NewEncoder(os.Stdout).Encode(frames)
	}
	if scenario.Mode == "fma" {
		frames := []Frame{}
		for i, v := range scenario.FMAs {
			frames = append(frames, Frame{i, nil, struct{ A, B, C, Result float64 }{v[0], v[1], v[2], math.FMA(v[0], v[1], v[2])}})
		}
		return json.NewEncoder(os.Stdout).Encode(frames)
	}
	if scenario.Mode == "math" {
		frames := []Frame{}
		for i, x := range scenario.Angles {
			frames = append(frames, Frame{i, nil, struct{ X, Sin, Cos float64 }{x, math.Sin(x), math.Cos(x)}})
		}
		return json.NewEncoder(os.Stdout).Encode(frames)
	}
	levels, err := game.LoadCampaign(os.DirFS("resources"))
	if err != nil {
		return err
	}
	if scenario.Round < 1 || scenario.Round > len(levels) {
		return fmt.Errorf("invalid round")
	}
	// Slicing selects the desired round without duplicating upstream loading rules.
	selected := levels[scenario.Round-1:]
	if scenario.FullCampaign {
		selected = levels
	}
	g, err := game.NewPlayers(selected, scenario.Seed, scenario.Players)
	if err != nil {
		return err
	}
	if scenario.Mode == "movement" {
		g.OracleMovementSetup(scenario.Player, scenario.Spawn)
	}
	if err := g.OracleSetup(scenario.Setup); err != nil {
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
			if scenario.Mode == "movement" {
				if len(span.Players) != 1 || span.Players[0].Fire {
					return fmt.Errorf("movement requires one non-firing input")
				}
				g.OracleMovementStep(span.Players[0])
			} else {
				g.StepPlayers(span.Players)
			}
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
