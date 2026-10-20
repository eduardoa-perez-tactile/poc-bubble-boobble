import { expect, worldTest, renderTest } from '@gameengine/test';
import campaign from '../data/levels.json';
import { createPartyGame, preparePartyWave } from '../src/arcade/party';
import { copyGame, defeat } from '../src/arcade/game';
import { partyRanking } from '../src/arcade/party-config';
import { stepBoss } from '../src/arcade/boss';
import { desktopModel } from '../src/desktop/model';
import { initialDesktopState, desktopState } from '../src/desktop/state';
import { initialDesktopSave } from '../src/desktop/save';
import { PartyReset, PartyVictory, PartyHit } from '../src/arcade/party.cheats';

worldTest('dragon results credit finishing kills once and preserve totals across waves and copies',()=>{
 const g=createPartyGame(campaign,42,['human','ai','human','empty','ai','empty']);
 const enemies=g.Enemies.slice();
 defeat(g,enemies[0]!,1,2);defeat(g,enemies[0]!,1,2);defeat(g,enemies[1]!,2,1);
 defeat(g,enemies[2]!,1,2);defeat(g,enemies[3]!,1,3);defeat(g,enemies[4]!,1);
 expect(partyRanking(g).map(r=>`${r.slot}:${r.kills}`).join(',')).toBe('2:2,1:1,0:0,4:0');
 const clone=copyGame(g);clone.Party!.Kills![2]=99;expect(g.Party!.Kills![2]).toBe(2);
 g.Players[2]!.Lives=0;g.Party!.Wave++;preparePartyWave(g);
 expect(partyRanking(g)[0]!.slot).toBe(2);expect(partyRanking(g)[0]!.kills).toBe(2);
 const fresh=createPartyGame(campaign,42);expect(partyRanking(fresh).every(r=>r.kills===0)).toBe(true);
});
worldTest('dragon results credit the boss finisher and share ranks for equal kills',()=>{
 const g=createPartyGame(campaign,42);g.Party!.Wave=10;preparePartyWave(g);g.Party!.Phase='boss';
 const b=g.Party!.Boss!;b.Mode='captured';b.Timer=30;g.Players[0]!.X=b.X;g.Players[0]!.Y=b.Y;
 stepBoss(g);expect(g.State).toBe(4);expect(g.Party!.Kills![0]).toBe(1);
 const m=desktopModel({...initialDesktopState,screen:'result',partyRun:true,dragonResults:[{slot:2,kills:5},{slot:0,kills:5},{slot:1,kills:1}]},initialDesktopSave);
 expect(m.ranking.map(r=>r.rank).join(',')).toBe('01,01,03');expect(m.podium.map(r=>r.name).join(',')).toBe('BUB,EMBER,BOB');expect(m.resultList.length).toBe(0);expect(m.resultChampion).toBe('JOINT KILL LEADERS / 5 KILLS');
});
worldTest('dragon results podium and list contain every entrant exactly once including small teams',()=>{
 for(const count of [1,2,6,10]){
  const results=Array.from({length:count},(_,slot)=>({slot,kills:20-slot}));
  const m=desktopModel({...initialDesktopState,screen:'result',partyRun:true,dragonResults:results},initialDesktopSave);
  expect(m.podium[1]!.name).toBe('BUB');expect(m.podium.filter(r=>r.occupied).length).toBe(Math.min(3,count));
  expect(m.resultList.length).toBe(Math.max(0,count-3));
  expect(m.podium.filter(r=>r.occupied).length+m.resultList.length).toBe(count);
  expect(m.resultList.map(r=>r.kills).join(',')).toBe(results.slice(3).map(r=>String(r.kills)).join(','));
 }
});
const scene='scenes/arcade.scene.json';
renderTest('dragon results victory and defeat show all ten dragons and usable safe buttons',async({step,cheat,input,render,ui})=>{
 let peak=0;
 for(const won of [true,false]){
  input.view(768,720,1);await step(5);await cheat(PartyReset,{team:10,humans:10,wave:10});await step(2);
  if(won){await cheat(PartyVictory,{});await step(2);}else{for(let slot=0;slot<10;slot++)await cheat(PartyHit,{slot});await step(2);}
  expect(desktopState.get().screen).toBe('result');expect(desktopState.get().dragonResults!.length).toBe(10);
  expect(desktopState.get().won).toBe(won);await step(65);
  for(const [width,height] of [[768,720],[1680,720],[640,960],[904,2316],[1620,2160]]){
   input.view(width!,height!,1);await step(1);const stats=render.stats({width:width!,height:height!});
   const buttons=ui.interactables().filter(b=>b.label==='PLAY AGAIN'||b.label==='MAIN MENU');expect(buttons.length).toBe(2);
   for(const button of buttons){const r=ui.rect(button.id!)!;expect(r.x>=0&&r.y>=0&&r.x+r.width<=width!+1&&r.y+r.height<=height!+1).toBe(true);}
   render.expectScreenshot(`${won?'victory':'defeat'}_${width}x${height}`,{width:width!,height:height!});
   peak=Math.max(peak,stats.drawCalls);expect(stats.drawCalls).toBeLessThanOrEqual(14);
  }
 }
 console.log(JSON.stringify({resultPeakDrawCalls:peak}));
},{scene,memory:'phone-low'});
