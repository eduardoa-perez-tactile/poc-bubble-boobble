import { expect, worldTest } from '@gameengine/test';
import { arcadeDrawPlan } from '../src/arcade/presentation';
import campaign from '../data/levels.json';
import { createPartyGame, partyWaveBudget, preparePartyWave } from '../src/arcade/party';
import { partyEnemyFormation } from '../src/arcade/party-spawns';
import { blocked, solid } from '../src/arcade/physics';
import { ActorSize, Tile, type PartySlot } from '../src/arcade/types';

worldTest('party placement supports ground monsters and gives every enemy a clear separate body',()=>{
 for(const team of [6,10])for(let active=1;active<=team;active++){
  const slots:PartySlot[]=Array.from({length:team},(_,i)=>i<active?'human':'empty');
  const g=createPartyGame(campaign,42,slots);
  for(let wave=1;wave<=9;wave++){
   g.Party!.Wave=wave;preparePartyWave(g);
   expect(g.Enemies.length).toBe(partyWaveBudget(wave,active));
   for(const e of g.Enemies){
    expect(blocked(g,e.X,e.Y,ActorSize)).toBe(false);
    if(!['monsta','pulpul'].includes(e.Kind)){
     expect(e.Ground).toBe(true);expect(e.VY).toBe(0);
     const feet=e.Y+ActorSize;expect(feet%Tile).toBe(0);
     for(let col=Math.floor(e.X/Tile);col<=Math.floor((e.X+ActorSize-.01)/Tile);col++)
      expect(solid(g,col,feet/Tile)).toBe(true);
    }
    for(const other of g.Enemies)if(other.ID!==e.ID)
     expect(Math.abs(e.X-other.X)<ActorSize&&Math.abs(e.Y-other.Y)<ActorSize).toBe(false);
    for(const p of g.Players)if(p.Lives>0)
     expect(Math.abs(e.X-p.X)<ActorSize&&Math.abs(e.Y-p.Y)<ActorSize).toBe(false);
   }
  }
 }
});

worldTest('party placement reserves scarce footing for walkers before flyers and rejects low ceilings',()=>{
 const g=createPartyGame(campaign,42,['human','empty','empty','empty','empty','empty']);
 g.Level={...g.Level,tiles:g.Level.tiles.map(row=>row.map(()=>0))};
 // A two-tile ledge fits one 44-pixel body, regardless of the enemy list order.
 g.Level.tiles[10]![10]=1;g.Level.tiles[10]![11]=1;
 const formation=partyEnemyFormation(g,['monsta','zenchan']);
 expect(formation[1]!.Ground).toBe(true);expect(formation[1]!.Y).toBe(10*Tile-ActorSize);
 expect(formation[0]!.Ground).toBe(false);
 expect(blocked(g,formation[0]!.X,formation[0]!.Y,ActorSize)).toBe(false);
 expect(partyEnemyFormation(g,['pulpul'])[0]!.Ground).toBe(true);
 // One tile of overhead space is too short: a flyer must use a clear air pocket.
 for(let row=3;row<=8;row++){g.Level.tiles[row]![10]=1;g.Level.tiles[row]![11]=1;}
 const flyer=partyEnemyFormation(g,['monsta'])[0]!;
 expect(flyer.Ground).toBe(false);expect(blocked(g,flyer.X,flyer.Y,ActorSize)).toBe(false);
});

worldTest('party placement all enemy artwork falls from above then lands on its supported target',()=>{
 const g=createPartyGame(campaign,42,Array.from({length:10},()=> 'human'));
 g.Party!.Wave=9;preparePartyWave(g);
 const positions=g.Enemies.map(e=>[e.X,e.Y,e.Ground,e.VY]);
 for(const timer of [180,170,150,120,90,1]){
  g.Party!.Timer=timer;
  const draws=arcadeDrawPlan(g);
  for(let index=0;index<g.Enemies.length;index++){
   const e=g.Enemies[index]!,t=Math.max(0,Math.min(1,(180-timer-index%6*5)/60));
   const y=-48+(e.Y+96)*(1-(1-t)*(1-t));
   expect(draws.some(d=>d.image.startsWith(`reference/${e.Kind}/`)&&d.x===e.X&&d.y===y)).toBe(true);
  }
  expect(g.Enemies.map(e=>[e.X,e.Y,e.Ground,e.VY])).toEqual(positions);
 }
});
