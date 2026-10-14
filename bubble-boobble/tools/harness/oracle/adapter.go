// Harness-only overlay: preserves the upstream RNG construction and exposes private state.
// This file is added to the ignored pinned checkout, never to the shipped game.
package game

import (
	"encoding/hex"
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
  if p != nil { g.Players[0] = *p }
  if spawn != nil { g.Players[0].X, g.Players[0].Y = g.spawnPosition(*spawn) }
}
func (g *Game) OracleMovementStep(in Input) {
  g.Sounds = g.Sounds[:0]
  if g.Paused { return }
  g.Tick++
  g.updatePlayer(0, in)
}
