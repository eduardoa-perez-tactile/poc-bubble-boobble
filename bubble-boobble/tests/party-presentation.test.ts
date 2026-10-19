import { partyNames } from '../src/arcade/party-config';
import { createBoss } from '../src/arcade/boss';
import {expect, worldTest, renderTest} from '@gameengine/test';
import {MaterialGlobals, MeshRenderer} from '@gameengine/runtime';
import {createGame} from '../src/arcade/game.ts';
import {arcadeDrawPlan, referenceFrame} from '../src/arcade/presentation.ts';
import {enableCompanion} from '../src/arcade/companion.ts';
import {bubble} from '../src/arcade/bubbles.ts';
import {dragonSkins} from '../src/desktop/skins.ts';
import {framePalette, paletteColor, sourceFrame} from '../src/arcade/pixel-renderer/palettes.ts';
import {orderedArrays} from '../src/arcade/pixel-renderer/ordered.ts';
import pixels from '../assets/pixel-renderer/pixels.json';
import campaign from '../data/levels.json';
import type {GameState, Level} from '../src/arcade/types.ts';
const scene = 'scenes/pixel-prototype.scene.json';
function party(): GameState {
  const g = createGame(campaign as Level[], 1);
  g.Party = {Wave:1, BossWave:10, Phase:'prepare', Timer:180, Slots:['human','ai','ai','ai','ai','ai'], ToSpawn:0, SpawnTick:0, Spawned:0, Telegraphs:[]};
  const base = g.Players[0]!;
  g.Players = dragonSkins.slice(0,6).map((Skin, index) => ({...base, Power:{...base.Power}, Skin, X:72 + index * 120, Y:556, Ground:true, Invincible:0}));
  g.Items=[]; g.Enemies=[];
  g.Bubbles=dragonSkins.slice(0,6).map((_,Shooter)=>({...bubble(72 + Shooter*120,400),Shooter,Age:30}));
  return g;
}
worldTest('party presentation six dragons and shots use independent identities', () => {
  const g=party(), draws=arcadeDrawPlan(g,'red');
  const colors=[[0,255,0],[0,170,255],[255,0,0],[255,220,0],[180,90,255],[255,135,0]];
  expect(referenceFrame('green/bubble',30)).toBe(referenceFrame('bubble',30));
  for(let index=0;index<6;index++) {
    const skin=dragonSkins[index]!, x=72+index*120;
    expect(draws.find(d=>d.x===x&&d.y===604)!.image).toBe(referenceFrame(`${skin}/walk`,0));
    const shot=draws.find(d=>!d.footer&&d.image===referenceFrame(skin==='green'?'bubble':`${skin}/bubble`,30))!;
    expect(shot.x+shot.w/2).toBe(x+22);expect(shot.y+shot.h/2).toBe(470);
    expect(draws.filter(d=>d.footer&&d.image===referenceFrame(`${skin}/walk`,0)).length).toBe(1);
    expect(draws.some(d=>d.text===partyNames[index]&&!d.footer)).toBe(true);
    for(const indicator of draws.filter(d=>d.text.startsWith(partyNames[index]!)))expect(indicator.color).toEqual(colors[index]);
  }
  const before=JSON.stringify(g); arcadeDrawPlan(g); expect(JSON.stringify(g)).toBe(before);
  delete g.Party; g.Players=g.Players.slice(0,2);
  expect(arcadeDrawPlan(g,'yellow').find(d=>d.x===192&&d.y===604)!.image).toBe(referenceFrame('blue/walk',0));
},{scene});
worldTest('party presentation rescue boss telegraphs and text remain within canvas', () => {
  const g=party(); g.Party!.Phase='boss';g.Party!.Timer=0;g.Players[5]!.Downed=true; enableCompanion(g,4);
  g.Party!.Boss={...createBoss(6),X:320,Y:80,HP:12,MaxHP:20};
  g.Party!.Telegraphs=[{X:120,Y:100,Ticks:20}];
  const draws=arcadeDrawPlan(g);
  expect(draws.some(d=>d.text==='TANGO HELP')).toBe(true);
  expect(draws.find(d=>d.text==='TANGO HELP')!.color).toEqual([255,135,0]);
  expect(draws.some(d=>d.text==='PLUM AI'&&!d.footer)).toBe(false);
  expect(draws.some(d=>d.text==='PLUM AI'&&d.footer)).toBe(true);
  expect(draws.some(d=>d.image===referenceFrame('orange/bubble',30)&&d.w===60)).toBe(true);
  expect(draws.some(d=>d.image===referenceFrame('boss/move',0)&&d.w===96)).toBe(true);
  expect(draws.some(d=>d.image.startsWith('derived/boss/'))).toBe(true);
  expect(draws.some(d=>d.text==='!')).toBe(true);
  for(const d of draws.filter(d=>d.text)) {
    expect(d.x).toBeGreaterThanOrEqual(0); expect(d.x).toBeLessThan(768);
    expect(d.y).toBeGreaterThanOrEqual(0); expect(d.y).toBeLessThan(720);
  }
},{scene});
worldTest('party palette new colors preserve every original dragon and bubble alpha', () => {
  const sources=pixels as Record<string,{pixels:number[]}>;
  for(const skin of ['purple','orange','cyan','pink','ivory','slate']) for(const original of Object.keys(sources).filter(n=>n.startsWith('reference/green/')||n.startsWith('reference/bubble/'))) {
    const alias=original.replace('/green/',`/${skin}/`).replace('reference/bubble/',`reference/${skin}/bubble/`);
    expect(sourceFrame(alias)).toBe(original);
    expect(framePalette(alias)).toBeGreaterThan(5);
    const p=sources[original]!.pixels;
    for(let i=0;i<p.length;i+=4) {
      const packed=(p[i]!|p[i+1]!<<8|p[i+2]!<<16|p[i+3]!<<24)>>>0;
      const color=paletteColor(packed,framePalette(alias));
      expect(color>>>24).toBe(packed>>>24);
      if(p[i]!==0||((p[i+1]!==255&&p[i+1]!==187)||p[i+2]!==0)) {
        if(['orange','cyan','pink','ivory','slate'].includes(skin)&&p[i]===255&&p[i+1]===255&&p[i+2]===0&&original.includes('/green/'))continue;
        expect(color).toBe(packed);
      }
    }
  }
},{scene});
renderTest('party palette ten dragon GPU body and matching bubbles',async({input,world,step,render})=>{
  input.view(768,720,1); await step(2);
  for(const row of world.all(MeshRenderer))world.despawn(row.entity);
  world.setResource(MaterialGlobals,{v0:[0,0,0,0]});
  const draws=dragonSkins.flatMap((skin,index)=>[
    {image:referenceFrame(`${skin}/walk`,0),x:24+index%5*148,y:80+Math.floor(index/5)*290,w:72,h:72},
    {image:referenceFrame(skin==='green'?'bubble':`${skin}/bubble`,30),x:24+index%5*148,y:210+Math.floor(index/5)*290,w:72,h:72},
  ]);
  const a=orderedArrays(draws,1/45,384,360).arrays;
  for(let q=0;q<a.positions.length/12;q++) {
    const p=q*12,u=q*8,k=q*16;
    const left=a.positions[p]!,bottom=a.positions[p+1]!,right=a.positions[p+6]!,top=a.positions[p+7]!;
    world.spawn({LocalTransform:{position:[(left+right)/2,(bottom+top)/2,a.positions[p+2]!],scale:[right-left,top-bottom,1]},
      MeshRenderer:{mesh:'pixel-renderer/static-quad.gltf',material:'materials/pixel-ordered.mat.json',color:[1,1,1,1],castShadows:false,receiveShadows:false},
      MaterialParams:{params:a.uvs[u]!<0?[-1,a.colors[k]!/255,a.colors[k+1]!/255,a.colors[k+2]!/255]:[a.uvs[u]!,a.uvs[u+5]!,a.uvs[u+2]!-a.uvs[u]!,a.uvs[u+1]!-a.uvs[u+5]!]}});
  }
  await step(2);
  const sources=pixels as Record<string,{width:number;height:number;pixels:number[]}>;
  for(const draw of draws) {
    const source=sources[sourceFrame(draw.image)]!,p=source.pixels;
    const offset=p.findIndex((_,i)=>i%4===0&&p[i]===0&&p[i+1]===255&&p[i+2]===0&&p[i+3]===255);
    // Blue uses supplied artwork; probe all generated palettes and original green.
    if(offset<0)continue;
    const texel=offset/4,x=Math.floor(draw.x+(texel%source.width+.5)*draw.w/source.width),y=Math.floor(draw.y+(Math.floor(texel/source.width)+.5)*draw.h/source.height);
    const color=paletteColor(0xff00ff00,framePalette(draw.image));
    expect(render.probe({width:768,height:720,points:[[x,y]]}).points[0]!.rgba).toEqual([color&255,(color>>>8)&255,(color>>>16)&255,255]);
  }
  render.expectDrawCalls('<=',4,{width:768,height:720});
  render.expectScreenshot('ten-colors',{width:768,height:720});
},{scene});

worldTest('party boss captured animation uses the original complete arcade bubble frames',()=>{
 const g=party();g.Party!.Phase='boss';g.Party!.Boss={...createBoss(6),X:320,Y:400,HP:0,Mode:'captured'};
 for(let frame=0;frame<4;frame++){
  g.Party!.Boss!.Tick=frame*10;
  const draws=arcadeDrawPlan(g),boss=draws.filter(d=>d.image.startsWith('derived/boss/'));
  expect(boss.length).toBe(1);expect(boss[0]!.image).toBe(`derived/boss/captured-${frame}`);
  expect(boss[0]!.x+boss[0]!.w/2).toBe(368);expect(boss[0]!.y+boss[0]!.h).toBe(544);expect(boss[0]!.w).toBeGreaterThan(92);expect(boss[0]!.w).toBeLessThan(100);
  expect(draws.some(d=>d.x===312&&d.w===112)).toBe(false);
 }
});
