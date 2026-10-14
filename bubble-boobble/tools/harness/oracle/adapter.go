// Harness-only overlay: preserves the upstream RNG construction and exposes private state.
// This file is added to the ignored pinned checkout, never to the shipped game.
package game

import (
	"encoding/hex"
	"encoding/json"
	"math/rand/v2"
)

var oracleSource *rand.PCG

func oracleRandom(seed uint64) *rand.Rand {
	oracleSource = rand.NewPCG(seed, seed^0xa0761d6478bd642f)
	return rand.New(oracleSource)
}

func (g *Game) OracleState() any {
	rng, err := oracleSource.MarshalBinary()
	if err != nil {
		panic(err)
	}
	return struct {
		Snapshot                            Snapshot
		LevelIndex                          int
		Custom                              bool
		Counters                            Counters
		WaterStage                          int
		Pending                             []PowerUp
		SpawnedSpecial, NextID, ExtraLifeAt int
		RNG                                 string
	}{g.Snapshot(), g.LevelIndex, g.Custom, g.Counters, g.Counters.waterStage,
		append([]PowerUp{}, g.Counters.pending...), g.spawnedSpecial, g.nextID, g.extraLifeAt, hex.EncodeToString(rng)}
}

// Controlled movement lane calls the unchanged upstream player routine, excluding
// enemies/combat/bonuses. It does not claim whole-match parity.
func (g *Game) OracleMovementSetup(p *Player, spawn *Cell) {
	g.State = Playing
	g.Countdown = 0
	if p != nil {
		g.Players[0] = *p
	}
	if spawn != nil {
		g.Players[0].X, g.Players[0].Y = g.spawnPosition(*spawn)
	}
}
func (g *Game) OracleMovementStep(in Input) {
	g.Sounds = g.Sounds[:0]
	if g.Paused {
		return
	}
	g.Tick++
	g.updatePlayer(0, in)
}

// State injection only. JSON supplies controlled initial fields; every subsequent
// tick still runs the unchanged upstream StepPlayers implementation and RNG.
// Private fields are exposed explicitly because encoding/json cannot set them.
func (g *Game) OracleSetup(raw []byte) error {
	if len(raw) == 0 || string(raw) == "null" {
		return nil
	}
	if err := json.Unmarshal(raw, g); err != nil {
		return err
	}
	var private struct {
		WaterStage                          *int
		Pending                             *[]PowerUp
		SpawnedSpecial, NextID, ExtraLifeAt *int
	}
	if err := json.Unmarshal(raw, &private); err != nil {
		return err
	}
	if private.WaterStage != nil {
		g.Counters.waterStage = *private.WaterStage
	}
	if private.Pending != nil {
		g.Counters.pending = append([]PowerUp{}, (*private.Pending)...)
	}
	if private.SpawnedSpecial != nil {
		g.spawnedSpecial = *private.SpawnedSpecial
	}
	if private.NextID != nil {
		g.nextID = *private.NextID
	}
	if private.ExtraLifeAt != nil {
		g.extraLifeAt = *private.ExtraLifeAt
	}
	return nil
}
