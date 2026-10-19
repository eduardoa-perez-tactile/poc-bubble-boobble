import { unpackFeel } from '../src/arcade/juice';
import { FeedbackCluster, FeelShowcase } from '../src/arcade/juice.cheats';
import { ArcadeFeel, DesktopIntent } from '../src/schema.gen';
import { expect, worldTest, renderTest } from '@gameengine/test';
import campaign from '../data/levels.json';
import { createPartyGame } from '../src/arcade/party';
import { arcadeDrawPlan } from '../src/arcade/presentation';
import { advanceFeel, emptyFeel, cueQuads, dragonShadow, dragonBadges } from '../src/arcade/juice';
import { PartyReset, PartyHit } from '../src/arcade/party.cheats';
import { desktopState } from '../src/desktop/state';
import { session } from '../src/arcade/session';
const scene='scenes/arcade.scene.json';
worldTest('feedback shooting Space cannot restart a defeated boss run',async({step,cheat,input})=>{
 await step(5);await cheat(PartyReset,{wave:10,humans:6});await step(2);
 input.key(37,true);await step(1);
 for(let slot=0;slot<6;slot++)await cheat(PartyHit,{slot});
 expect(desktopState.get().screen).toBe('result');const tick=session.get().game!.Tick;
 for(let i=0;i<30;i++){
  input.key(37,false);await step(1);input.key(37,true);await step(1);
  expect(desktopState.get().screen).toBe('result');
 }
 expect(session.get().game!.Tick).toBe(tick);
 input.key(37,false);await step(2);input.key(38,true);await step(1);
 expect(desktopState.get().screen).toBe('play');
},{scene});
worldTest('feedback airborne dragons do not carry a fixed black line beneath them',()=>{
 const g=createPartyGame(campaign,42,Array.from({length:6},()=> 'human'));
 const p=g.Players[0]!;p.Y=450;p.Ground=false;p.VY=-6;p.Invincible=0;
 expect(arcadeDrawPlan(g).filter(d=>d.image==='solid/#071322'&&d.x===p.X+9&&d.y===p.Y+95).length).toBe(0);
});
worldTest('feedback overhead badges explicitly distinguish players and AI',()=>{
 const g=createPartyGame(campaign,42);
 const labels=arcadeDrawPlan(g).filter(d=>d.text&&!d.footer).map(d=>d.text);
 expect(labels.includes('BUB')).toBe(true);expect(labels.includes('BOB AI')).toBe(true);
});
worldTest('feedback jumping and landing produce small short lived dust bursts',()=>{
 const g=createPartyGame(campaign,42,Array.from({length:6},()=> 'human')),p=g.Players[0]!;
 p.Ground=true;p.VY=0;let f=advanceFeel(emptyFeel(),g,1);
 g.Tick++;p.Ground=false;p.VY=-6;p.Y-=6;f=advanceFeel(f,g,2);
 expect(f.cues.some(c=>c.kind==='jump')).toBe(true);expect(cueQuads(f).length).toBeGreaterThanOrEqual(4);
 g.Tick++;p.VY=8;f=advanceFeel(f,g,3);
 g.Tick++;p.Ground=true;p.VY=0;f=advanceFeel(f,g,4);
 expect(f.cues.some(c=>c.kind==='land')).toBe(true);
 expect(cueQuads({...f,cues:f.cues.filter(c=>c.kind==='land')}).length).toBeGreaterThanOrEqual(6);
 f=advanceFeel(f,g,80);expect(cueQuads(f).length).toBe(0);
});

declare const __gameengine_host:(op:string,arg:string)=>string;
worldTest('feedback results require release and a fresh controller confirmation after the guard',async({step,cheat,input})=>{
 await step(5);await cheat(PartyReset,{wave:10,humans:6});await step(2);
 __gameengine_host('test.input',JSON.stringify([{type:'gamepadButton',pad:0,button:0,down:true}]));await step(1);
 for(let slot=0;slot<6;slot++)await cheat(PartyHit,{slot});
 expect(desktopState.get().screen).toBe('result');
 input.emit(DesktopIntent,{action:'restart'});await step(1);expect(desktopState.get().screen).toBe('result');
 await step(60);expect(desktopState.get().screen).toBe('result');expect(desktopState.get().resultReady).toBe(false);
 __gameengine_host('test.input',JSON.stringify([{type:'gamepadButton',pad:0,button:0,down:false}]));await step(1);
 expect(desktopState.get().resultReady).toBe(true);
 __gameengine_host('test.input',JSON.stringify([{type:'gamepadButton',pad:0,button:0,down:true}]));await step(1);
 expect(desktopState.get().screen).toBe('play');
},{scene});
worldTest('feedback shadows stay on supporting platforms and shrink with altitude',()=>{
 const g=createPartyGame(campaign,42),p=g.Players[0]!;
 g.Level={...g.Level,tiles:Array.from({length:26},(_,row)=>Array.from({length:32},()=>row===25?1:0))};
 p.X=320;p.Y=556;p.Ground=true;const before=JSON.stringify(g),ground=dragonShadow(g,p);
 expect(ground.length).toBe(3);expect(ground[1]!.w).toBe(30);expect(JSON.stringify(g)).toBe(before);
 p.Y=460;p.Ground=false;const air=dragonShadow(g,p);
 expect(air[1]!.w).toBeLessThan(ground[1]!.w);expect(air[1]!.y).toBe(ground[1]!.y);
 p.Y=200;expect(dragonShadow(g,p).length).toBe(0);
});
worldTest('feedback clustered badges stay legible separate and inside the arena',()=>{
 const g=createPartyGame(campaign,42);
 for(const p of g.Players){p.X=340;p.Y=400;p.Downed=false;p.Lives=1;}
 const badges=dragonBadges(g);expect(badges.length).toBe(10);
 for(let i=0;i<badges.length;i++){
  const a=badges[i]!;expect(a.x>=48&&a.y>=64&&a.x+a.w<=720&&a.y+a.h<=656).toBe(true);
  for(const b of badges.slice(i+1))expect(a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y).toBe(false);
 }
 const f=emptyFeel();f.cues=[{kind:'rescue',x:364,y:472,slot:4,at:0}];
 const saved=arcadeDrawPlan(g,'green',f).find(d=>d.text==='SAVED!')!;
 for(const b of badges)expect(saved.x<b.x+b.w&&saved.x+70>b.x&&saved.y-10<b.y+b.h&&saved.y>b.y).toBe(false);
});
renderTest('feedback jump dust grounded shadows nameplates and guarded results remain readable',async({step,cheat,input,render,world,ui})=>{
 input.view(768,720,1);await step(5);await cheat(PartyReset,{humans:6,countdown:180});await step(3);
 await step(session.get().game!.Party!.Timer);
 input.action('partyJump1',1);await step(1);
 let f=unpackFeel(world.resource(ArcadeFeel));
 expect(f.cues.some((c:{kind:string})=>c.kind==='jump')).toBe(true);render.expectScreenshot('takeoff',{width:768,height:720});
 await step(12);render.expectScreenshot('airborne',{width:768,height:720});
 for(let i=0;i<100&&!session.get().game!.Players[0]!.Ground;i++)await step(1);
 f=unpackFeel(world.resource(ArcadeFeel));expect(f.cues.some((c:{kind:string;at:number})=>c.kind==='land'&&f.clock-c.at<2)).toBe(true);
 render.expectScreenshot('landing',{width:768,height:720});
 let peak=0;
 for(const [width,height] of [[768,720],[1680,720],[640,960]]){
  input.view(width!,height!,1);await step(1);peak=Math.max(peak,render.stats({width:width!,height:height!}).drawCalls);
  render.expectScreenshot(`landing_${width}x${height}`,{width:width!,height:height!});
 }
 await cheat(PartyReset,{humans:2});await step(2);await cheat(FeelShowcase,{});
 render.expectScreenshot('mixed_badges',{width:768,height:720});
 await cheat(FeedbackCluster,{});render.expectScreenshot('clustered_badges',{width:768,height:720});
 await cheat(PartyReset,{wave:10,humans:6});await step(2);
 for(let slot=0;slot<6;slot++)await cheat(PartyHit,{slot});
 expect(desktopState.get().screen).toBe('result');await step(1);render.expectScreenshot('defeat_guard',{width:768,height:720});
 await step(46);expect(desktopState.get().resultReady).toBe(true);render.expectScreenshot('defeat_ready',{width:768,height:720});
 render.stats({width:768,height:720});const restart=ui.interactables().find(b=>b.label==='PLAY AGAIN')!;
 await ui.press(restart.id!);await step(1);expect(desktopState.get().screen).toBe('play');
 expect(peak).toBeLessThanOrEqual(14);console.log(JSON.stringify({peakDrawCalls:peak}));
},{scene,memory:'phone-low'});
