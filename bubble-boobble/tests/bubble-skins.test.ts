import {expect,renderTest,worldTest} from '@gameengine/test';
import type {RenderContext} from '@gameengine/test';
import campaign from '../data/levels.json';
import pixels from '../assets/pixel-renderer/pixels.json';
import {arcadeDrawPlan,referenceFrame} from '../src/arcade/presentation';
import {sourceFrame} from '../src/arcade/pixel-renderer/palettes';
import {bubble} from '../src/arcade/bubbles';
import {createGame} from '../src/arcade/game';
import {EnemyState} from '../src/arcade/types';
import type {GameState,Level} from '../src/arcade/types';
import {ResetArcade} from '../src/arcade/arcade.cheats';
import {session} from '../src/arcade/session';
import {desktopSaveState} from '../src/desktop/save';
import {ArcadeInput,DesktopIntent} from '../src/schema.gen';

const scene='scenes/arcade.scene.json';
const skins=['green','blue','red','yellow'] as const;
type Skin=typeof skins[number];
const colors:Record<Skin,readonly [number,number,number]>={green:[0,255,0],blue:[0,170,255],red:[255,0,0],yellow:[255,220,0]};
const sourcePixels=pixels as Record<string,{width:number;height:number;pixels:number[]}>;
const frame=(skin:Skin,age:number)=>referenceFrame(skin==='green'?'bubble':`${skin}/bubble`,Math.min(age,30));

// Check actual bright rim texels, away from texture edges and other actors.
function expectShotPixels(game:GameState,skin:Skin,render:RenderContext){
 const draws=arcadeDrawPlan(game,skin);
 for(const b of game.Bubbles){
  const color=b.Shooter===1?'blue':skin;
  const draw=draws.find(d=>d.x===b.X&&d.y===b.Y+48&&d.w===44)!;
  expect(draw.image).toBe(frame(color,b.Age));
  const source=sourcePixels[sourceFrame(draw.image)]!,points:[number,number][]=[];
  for(let y=1;y<source.height-1&&points.length<8;y++)for(let x=1;x<source.width-1&&points.length<8;x++){
   const at=(y*source.width+x)*4,p=source.pixels;
   if(p[at]===0&&p[at+1]===255&&p[at+2]===0&&p[at+3]===255)
    points.push([Math.floor(draw.x+(x+.5)*draw.w/source.width),Math.floor(draw.y+(y+.5)*draw.h/source.height)]);
  }
  expect(points.length).toBe(8);
  for(const point of render.probe({width:768,height:720,points}).points)
   expect(point.rgba).toEqual([...colors[color],255]);
 }
}

worldTest('bubble skins normal frames follow shooter with legacy player one default',()=>{
 for(const skin of skins)for(const Shooter of [undefined,0,1])for(const Age of [0,10,20,30]){
  const game=createGame(campaign as Level[],42,2);
  game.Bubbles=[{...bubble(300,300),ID:100,Shooter,Age}];
  const draw=arcadeDrawPlan(game,skin).find(d=>d.x===300&&d.y===348)!;
  const selected=Shooter===1?'blue':skin;
  const expected=`reference/${selected==='green'?'':selected+'/'}bubble/${Age/10}`;
  expect(draw.image).toBe(expected);expect(draw.w).toBe(44);expect(draw.h).toBe(44);
  expect(sourceFrame(draw.image)).toBe(`reference/bubble/${Age/10}`);
 }
},{scene});

worldTest('bubble skins preserve warning elemental and trapped variants for both shooters',()=>{
 for(const skin of skins)for(const Shooter of [0,1]){
  const game=createGame(campaign as Level[],42,2),enemy=game.Enemies[0]!;
  const b={...bubble(300,300),ID:100,Shooter,Age:30};game.Bubbles=[b];
  for(const element of ['water','fire','thunder']){
   b.Element=element;
   expect(arcadeDrawPlan(game,skin).find(d=>d.x===300&&d.y===348)!.image).toBe(referenceFrame(`${element}-bubble`,30));
  }
  b.Element='';b.Age=451;
  expect(arcadeDrawPlan(game,skin).find(d=>d.x===300&&d.y===348)!.image).toBe(referenceFrame('bubble-warning',451));
  b.EnemyID=enemy.ID;enemy.State=EnemyState.Trapped;
  for(const [age,state] of [[0,'bubble'],[1001,'warning'],[1201,'escape']] as const){
   b.CapturedAge=age;
   expect(arcadeDrawPlan(game,skin).find(d=>d.x===300&&d.y===348)!.image).toBe(referenceFrame(`${enemy.Kind}/${state}`,451));
  }
 }
},{scene});

for(const players of [1,2])renderTest(`bubble skins actual fire input ${players===1?'all solo colors':'simultaneous co-op colors'}`,async({input,step,cheat,render})=>{
 input.view(768,720,1);await step(5);
 for(const skin of players===1?skins:['red','yellow'] as const){
  for(let tries=0;desktopSaveState.get().profiles[0]!.avatar!==skin&&tries<4;tries++){
   input.emit(DesktopIntent,{action:'avatar'});await step(1);
  }
  expect(desktopSaveState.get().profiles[0]!.avatar).toBe(skin);
  await cheat(ResetArcade,{round:1,seed:42,players,ready:false});
  for(let player=0;player<players;player++)input.emit(ArcadeInput,{player,move:0,jump:false,fire:true,paused:false});
  await step(1);
  for(let player=0;player<players;player++)input.emit(ArcadeInput,{player,move:0,jump:false,fire:false,paused:false});
  await step(5);
  const game=session.get().game!;
  expect(game.Counters.Blown).toBe(players);expect(game.Bubbles.length).toBe(players);
  expect(game.Bubbles.map(b=>b.Shooter)).toEqual(players===1?[0]:[0,1]);
  expectShotPixels(game,skin,render);
  render.expectDrawCalls('<=',8,{width:768,height:720});
  render.expectScreenshot(skin,{width:768,height:720});
 }
},{scene});
