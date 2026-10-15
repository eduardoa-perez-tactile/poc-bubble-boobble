import { expect, worldTest } from '@gameengine/test';
import levels from '../data/levels.json';
import { canonicalState, copyGame, createGame, stepGame } from '../src/arcade/game';
import { bubble, shootBubble, updateBubbles } from '../src/arcade/bubbles';
import { EnemyState, State } from '../src/arcade/types';
const idle={Move:0,Jump:false,Fire:false};
const scene='scenes/arcade.scene.json';

worldTest('bubble ownership stores both shooters and survives copies and removal filtering',()=>{
 const g=createGame(levels,42,2);
 shootBubble(g,0);shootBubble(g,1);
 expect(g.Bubbles.map(b=>b.Shooter)).toEqual([0,1]);
 expect(g.Bubbles[0]!.ID).toBeLessThan(g.Bubbles[1]!.ID);
 const copy=copyGame(g);
 expect(copy.Bubbles.map(b=>b.Shooter)).toEqual([0,1]);
 copy.Bubbles[0]!.Removed=true;
 updateBubbles(copy,[idle,idle]);
 expect(copy.Bubbles.length).toBe(1);
 expect(copy.Bubbles[0]!.Shooter).toBe(1);
 expect(g.Bubbles[0]!.Removed).toBe(false);
 expect(g.Bubbles[0]!.Shooter).toBe(0);
 for(const element of ['', 'water', 'fire', 'thunder']) {
  const ambient={...bubble(100,100),Element:element};
  expect(Object.prototype.hasOwnProperty.call(ambient,'Shooter')).toBe(false);
 }
},{scene});

worldTest('bubble ownership Go projection strips only Shooter without mutating stored bubbles',()=>{
 const g=createGame(levels,42,2);
 shootBubble(g,0);shootBubble(g,1);
 const before=JSON.stringify(g);
 const projected=canonicalState(g).Snapshot.Bubbles!;
 for(let i=0;i<projected.length;i++) {
  expect(Object.keys(projected[i]!).sort()).toEqual(Object.keys(g.Bubbles[i]!).filter(k=>k!=='Shooter').sort());
  expect(Object.prototype.hasOwnProperty.call(projected[i],'Shooter')).toBe(false);
 }
 expect(JSON.stringify(g)).toBe(before);
 const stripped=copyGame(g);
 for(const b of stripped.Bubbles)delete b.Shooter;
 expect(canonicalState(stripped)).toEqual(canonicalState(g));
 stripped.Bubbles[0]!.Speed++;
 expect(JSON.stringify(canonicalState(stripped))===JSON.stringify(canonicalState(g))).toBe(false);
 // Unexpected fields must not be silently removed by a broad reference filter.
 const extra=g.Bubbles[0]! as typeof g.Bubbles[number]&{Unexpected:number};
 extra.Unexpected=9;
 const visible=canonicalState(g).Snapshot.Bubbles![0]! as typeof extra;
 expect(visible.Unexpected).toBe(9);
 expect(extra.Shooter).toBe(0);
},{scene});

worldTest('bubble ownership leaves capture trajectory counters RNG and sounds identical over time',()=>{
 const owned=createGame(levels,42,2);
 owned.State=State.Playing;
 owned.Enemies=[owned.Enemies[0]!];
 const enemy=owned.Enemies[0]!;
 Object.assign(enemy,{X:230,Y:150,VY:0,Ground:false,Dir:1});
 Object.assign(owned.Players[0]!,{X:180,Y:148,Dir:1,Invincible:10000});
 Object.assign(owned.Players[1]!,{X:500,Y:148,Dir:-1,Invincible:10000});
 shootBubble(owned,0);shootBubble(owned,1);
 const unowned=copyGame(owned);
 for(const b of unowned.Bubbles)delete b.Shooter;
 expect(owned.Sounds).toEqual(['shoot','shoot']);
 for(let tick=0;tick<240;tick++) {
  stepGame(owned,[idle,idle]);stepGame(unowned,[idle,idle]);
  expect(canonicalState(owned)).toEqual(canonicalState(unowned));
  if(tick===0) {
   expect(owned.Bubbles[0]!.EnemyID).toBe(enemy.ID);
   expect(enemy.State).toBe(EnemyState.Trapped);
   expect(owned.Bubbles.map(b=>b.Shooter)).toEqual([0,1]);
  }
 }
},{scene});
