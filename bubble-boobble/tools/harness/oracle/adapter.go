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
