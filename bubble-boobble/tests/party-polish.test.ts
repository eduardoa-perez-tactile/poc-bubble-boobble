import { expect, worldTest, renderTest } from '@gameengine/test';
import { PlaySound } from '@gameengine/runtime';
import campaign from '../data/levels.json';
import { createPartyGame, preparePartyWave } from '../src/arcade/party';
import { stepGame } from '../src/arcade/game';
import { arcadeDrawPlan } from '../src/arcade/presentation';
import { item } from '../src/arcade/items';
import { hudModel } from '../src/desktop/hud.view';
import { initialDesktopSave } from '../src/desktop/save';
import { PartyReset, PartyClear } from '../src/arcade/party.cheats';
import { PopBurst, ResetArcade } from '../src/arcade/arcade.cheats';
import { session } from '../src/arcade/session';
const scene='scenes/arcade.scene.json',idle={Move:0,Jump:false,Fire:false};

worldTest('party polish flyers descend and idle without moving their simulation formation',()=>{
 const g=createPartyGame(campaign,42,Array.from({length:6},()=> 'human'));
 const formation=g.Enemies.map(e=>[e.X,e.Y,e.Age]),e=g.Enemies.find(e=>e.Kind==='monsta')!;
 const dragonDraws=arcadeDrawPlan(g).filter(d=>d.image.includes('/bubble/'));
 expect(dragonDraws.length).toBe(0);
 const first=()=>arcadeDrawPlan(g).find(d=>d.x===e.X&&d.image.includes(`/${e.Kind}/`))!;
 expect(first().y).toBe(-48);
 for(let tick=0;tick<30;tick++)stepGame(g,idle);
 expect(first().y).toBeGreaterThan(-48);expect(first().y).toBeLessThan(e.Y+48);
 for(let tick=0;tick<70;tick++)stepGame(g,idle);
 expect(first().y).toBe(e.Y+48);const frame=first().image;
 for(let tick=0;tick<10;tick++)stepGame(g,idle);
 expect(first().image).not.toBe(frame);expect(first().y).toBe(e.Y+48);
 expect(g.Enemies.map(e=>[e.X,e.Y,e.Age])).toEqual(formation);
});

worldTest('party polish benefit descriptions use three letters or fewer',()=>{
 const g=createPartyGame(campaign,42);
 for(const [power,tag] of Object.entries({pink_candy:'RNG',blue_candy:'SPD',yellow_candy:'RAP',shoes:'RUN',clock:'TIM',dynamite:'BOM',orange_parasol:'DEF',red_parasol:'DEF',purple_parasol:'DEF',crystal_ring:'PTS',amethyst_ring:'PTS',ruby_ring:'PTS'})) {
  g.Items=[{...item(300,200),Power:power}];const label=arcadeDrawPlan(g).find(d=>d.y===234)!;
  expect(label.text).toBe(tag);expect(label.text.length).toBeLessThanOrEqual(3);
 }
});

worldTest('party polish HUD explains rest arrival positioning and go',()=>{
 const g=createPartyGame(campaign,42);g.Party!.Phase='rest';g.Party!.Timer=300;g.State=2;
 let hud=hudModel(g,initialDesktopSave);expect(hud.banner).toBe('WAVE 2 IN 5S');expect(hud.hint).toBe('REST - COLLECT REWARDS');expect(hud.detail).toBe('MOVE, JUMP AND SHOOT');
 g.Party!.Timer=60;expect(hudModel(g,initialDesktopSave).banner).toBe('WAVE 2 IN 1S');
 g.Party!.Wave++;preparePartyWave(g);hud=hudModel(g,initialDesktopSave);expect(hud.banner).toBe('WAVE 2 IN 3S');expect(hud.hint).toBe('ENEMIES ARRIVING');
 for(let tick=0;tick<100;tick++)stepGame(g,idle);
 expect(hudModel(g,initialDesktopSave).hint).toBe('GET INTO POSITION');
 for(let tick=0;tick<80;tick++)stepGame(g,idle);
 expect(hudModel(g,initialDesktopSave).banner).toBe('WAVE 2 - GO!');
 for(let tick=0;tick<120;tick++)stepGame(g,idle);
 expect(hudModel(g,initialDesktopSave).showBanner).toBe(false);
});

worldTest('party polish six real pops coalesce while classic cues retain their original mix',async({cheat,step,input,world})=>{
 await step(3);await cheat(PartyReset,{wave:1,humans:6});await step(2);await cheat(PopBurst,{});
 expect(session.get().game!.Sounds.filter(s=>s==='pop').length).toBe(6);
 expect(world.events(PlaySound).filter(s=>s.sound==='audio/bubble-pop').length).toBe(1);
 input.action('partyFire1',1);await step(1);expect(world.events(PlaySound).map(s=>s.sound)).toEqual(['audio/bubble-shot']);
 input.action('partyFire1',0);await step(1);await cheat(ResetArcade,{ready:false});await cheat(PopBurst,{});
 expect(session.get().game!.Sounds).toEqual(['pop']);expect(world.events(PlaySound).map(s=>s.sound)).toEqual(['reference/audio/pop']);
},{scene});

renderTest('party polish readable countdown falling enemies and rest practice shots',async({cheat,step,input,render,ui})=>{
 input.view(768,720,1);await step(3);await cheat(PartyReset,{wave:1,humans:6,countdown:180});await step(30);
 const background=render.probe({width:768,height:720,points:[[110,56]]}).points[0]!.rgba;
 for(let channel=0;channel<3;channel++)expect(Math.abs(background[channel]!-[18,30,52][channel]!)).toBeLessThanOrEqual(6);
 render.expectScreenshot('arriving',{width:768,height:720});
 await step(70);render.expectScreenshot('positioning',{width:768,height:720});
 await step(80);render.expectScreenshot('go',{width:768,height:720});
 await cheat(PartyClear,{});await step(2);input.action('partyFire1',1);await step(6);
 expect(session.get().game!.Bubbles.length).toBeGreaterThan(0);
 expect(render.probe({width:768,height:720,points:[[110,140]]}).points[0]!.rgba.slice(0,3)).toEqual([12,21,43]);
 render.expectScreenshot('rest_shooting',{width:768,height:720});
 for(const [width,height] of [[768,720],[1680,720],[640,960]]){
  input.view(width!,height!,1);await step(1);render.expectDrawCalls('<=',14,{width:width!,height:height!});
  const panel=ui.rect('desktop-hud.banner')!;
  expect(panel.x>=0&&panel.y>=0&&panel.x+panel.width<=width!&&panel.y+panel.height<=height!).toBe(true);
  for(const name of ['banner-title','banner-hint','party-detail']){
   const label=ui.rect(`desktop-hud.${name}`)!;
   expect(label.x>=panel.x&&label.y>=panel.y&&label.x+label.width<=panel.x+panel.width&&label.y+label.height<=panel.y+panel.height).toBe(true);
  }
 }
},{scene});
