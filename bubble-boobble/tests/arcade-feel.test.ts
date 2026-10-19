import { unpackFeel } from '../src/arcade/juice';
import pixels from '../assets/pixel-renderer/pixels.json';
import { PopBurst } from '../src/arcade/arcade.cheats';
import { expect, worldTest, renderTest } from '@gameengine/test';
import campaign from '../data/levels.json';
import { createPartyGame } from '../src/arcade/party';
import { bubble } from '../src/arcade/bubbles';
import { advanceFeel, emptyFeel, bubblePose, cueQuads, popQuads, arenaBackdrop } from '../src/arcade/juice';
import { composedColorAt, orderedArrays } from '../src/arcade/pixel-renderer/ordered';
import { PartyReset, PartyRescue, PartyBossDuel, PartyVictory } from '../src/arcade/party.cheats';
import { FeelShowcase } from '../src/arcade/juice.cheats';
import { session } from '../src/arcade/session';
import { ArcadeFeel, DesktopIntent } from '../src/schema.gen';
import { desktopSaveState } from '../src/desktop/save';
import { PlaySound } from '@gameengine/runtime';
const scene='scenes/arcade.scene.json';
worldTest('feel pixel solids compose behind translucent original art with exact RGB',()=>{
 const quads=[{image:'solid/#123456',x:0,y:0,w:100,h:100}];
 expect(composedColorAt(quads,0,20,20)).toBe(0xff563412);
 const geometry=orderedArrays(quads);expect(geometry.vertices).toBe(4);
 expect(Array.from(geometry.arrays.colors.slice(0,4))).toEqual([18,52,86,255]);
 const [key,source]=Object.entries(pixels).find(([,s])=>s.partial)!;
 const at=source.pixels.findIndex((v,i)=>i%4===3&&v>0&&v<255),texel=(at-3)/4;
 const overlay={image:key,x:0,y:0,w:source.width,h:source.height};
 const a=source.pixels[at]!,expected=[18,52,86].map((base,i)=>Math.min(255,Math.round(source.pixels[at-3+i]!+base*(255-a)/255)));
 const c=composedColorAt([...quads,overlay],1,texel%source.width+.5,Math.floor(texel/source.width)+.5);
 expect([c&255,(c>>>8)&255,(c>>>16)&255]).toEqual(expected);
 expect(orderedArrays([...quads,overlay]).partialRuns).toBeGreaterThan(0);
});
worldTest('feel bubble deformation preserves center and never changes match geometry',()=>{
 const b={...bubble(200,220),Age:0},before=JSON.stringify(b),pose=bubblePose(b);
 expect(pose.w).toBeGreaterThan(pose.h);expect(pose.x+pose.w/2).toBe(222);expect(pose.y+pose.h/2).toBe(290);
 expect(JSON.stringify(b)).toBe(before);
 b.EnemyID=1;b.CapturedAge=1;b.Age=40;expect(bubblePose(b).h).toBeGreaterThan(bubblePose(b).w);
});
worldTest('feel landing rescue and boss transitions are bounded expire and freeze on pause',()=>{
 const g=createPartyGame(campaign,42,Array.from({length:6},()=> 'human'));
 g.Players[0]!.Ground=false;g.Players[0]!.VY=8;g.Players[1]!.Downed=true;let f=advanceFeel(emptyFeel(),g,1);
 g.Tick++;g.Players[0]!.Ground=true;g.Players[1]!.Downed=false;f=advanceFeel(f,g,2);
 expect(f.cues.map(c=>c.kind)).toEqual(['land','rescue']);
 const before=JSON.stringify(g),clock=f.clock;g.Paused=true;f=advanceFeel(f,g,40);expect(f.clock).toBe(clock);
 g.Paused=false;expect(JSON.stringify(g)).toBe(before);
 f=advanceFeel(f,g,120);expect(f.cues.length).toBe(0);
});
worldTest('feel reduced effects remove ambient and celebration clutter while retaining rescue cues',()=>{
 const g=createPartyGame(campaign,42);const f=emptyFeel();
 f.cues=[{kind:'rescue',x:200,y:200,at:0,slot:0},{kind:'victory',x:384,y:200,at:0,slot:0}];
 expect(cueQuads(f,true).length).toBeGreaterThan(0);expect(cueQuads(f,true).length).toBeLessThan(cueQuads(f).length);
 expect(arenaBackdrop(g,true).length).toBeLessThan(arenaBackdrop(g).length);
 g.Particles=Array.from({length:100},()=>({X:200,Y:200,VX:0,VY:0,Ground:false,Text:'',Life:14}));
 expect(popQuads(g).length).toBeLessThanOrEqual(288);
});
worldTest('feel party audio coalesces simultaneous shots and keeps important cues higher priority',async({step,cheat,input,world,audio})=>{
 await step(10);await cheat(PartyReset,{humans:6});await step(2);
 for(let i=1;i<=6;i++)input.action(`partyFire${i}`,1);await step(1);
 const shots=world.events(PlaySound).filter(s=>s.sound==='audio/bubble-shot');expect(shots.length).toBe(1);expect(shots[0]!.maxVoices).toBe(3);
 expect(audio.status().banks['audio/juice.bank']?.ready).toBe(true);
 await cheat(PopBurst,{});const pop=world.events(PlaySound).find(s=>s.sound==='audio/bubble-pop')!;expect(pop.priority).toBeGreaterThan(shots[0]!.priority);
 input.emit(DesktopIntent,{action:'effects'});await step(1);expect(desktopSaveState.get().settings.reducedEffects).toBe(true);
},{scene});
renderTest('feel six player capture chain rescue boss and results fit every aspect',async({step,cheat,input,render,world,audio})=>{
 input.view(768,720,1);await step(10);await cheat(PartyReset,{humans:6});await step(2);await cheat(FeelShowcase,{});
 render.expectScreenshot('bubble_showcase',{width:768,height:720});
 let peak=0;
 for(const [width,height] of [[768,720],[1680,720],[640,960]]){
  input.view(width!,height!,1);await step(2);peak=Math.max(peak,render.stats({width:width!,height:height!}).drawCalls);
  render.expectScreenshot(`arena_${width}x${height}`,{width:width!,height:height!});
 }
 await cheat(PartyRescue,{});input.action('partyMove1',1);
 for(let t=0;t<60;t++) {input.action('partyMove1',1);await step(1);const state=unpackFeel(world.resource(ArcadeFeel));if(state.cues.some((c:{kind:string})=>c.kind==='rescue'))break;}
 input.action('partyMove1',0);

 expect(unpackFeel(world.resource(ArcadeFeel)).cues.some((c:{kind:string})=>c.kind==='rescue')).toBe(true);
 expect(audio.sounds().some(s=>s.sound==='audio/rescue')).toBe(true);
 render.expectScreenshot('rescue',{width:768,height:720});
 await cheat(PartyReset,{wave:10,humans:6});await step(2);await cheat(PartyBossDuel,{captured:true});await step(1);
 render.expectScreenshot('boss_capture',{width:768,height:720});
 await cheat(PartyVictory,{});await step(12);
 render.expectScreenshot('victory',{width:768,height:720});
 input.emit(DesktopIntent,{action:'effects'});await step(2);
 render.expectScreenshot('reduced_victory',{width:768,height:720});
 expect(peak).toBeLessThanOrEqual(14);console.log(JSON.stringify({peakDrawCalls:peak}));
},{scene,memory:'phone-low'});
