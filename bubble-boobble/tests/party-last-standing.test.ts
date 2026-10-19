import { expect, worldTest, renderTest } from '@gameengine/test';
import campaign from '../data/levels.json';
import { createPartyGame } from '../src/arcade/party';
import { stepGame } from '../src/arcade/game';
import { hurtPlayer } from '../src/arcade/player';
import { alive, State, type PartySlot } from '../src/arcade/types';
import { PartyReset, PartyHit } from '../src/arcade/party.cheats';
import { session } from '../src/arcade/session';
import { desktopState } from '../src/desktop/state';
import { hudModel } from '../src/desktop/hud.view';
import { initialDesktopSave } from '../src/desktop/save';
const idle={Move:0,Jump:false,Fire:false};

worldTest('party last standing every dragon slot can keep the run alive after all teammates fall',()=>{
 for(let survivor=0;survivor<6;survivor++) {
  const g=createPartyGame(campaign,42,Array.from({length:6},()=> 'human'));
  for(let tick=0;tick<180;tick++)stepGame(g,idle);
  for(let i=0;i<6;i++)if(i!==survivor){g.Players[i]!.Invincible=0;hurtPlayer(g,i);}
  stepGame(g,idle);expect(g.State).toBe(State.Playing);expect(g.Players.filter(alive).length).toBe(1);
  const dragon=g.Players[survivor]!,x=dragon.X,blown=g.Counters.Blown;dragon.Cooldown=0;
  stepGame(g,Array.from({length:6},(_,i)=>i===survivor?{Move:-1,Jump:false,Fire:true}:idle));
  expect(dragon.X).toBeLessThan(x);expect(g.Counters.Blown).toBeGreaterThan(blown);expect(g.State).toBe(State.Playing);
  dragon.Invincible=0;hurtPlayer(g,survivor);stepGame(g,idle);expect(g.State).toBe(State.GameOver);
 }
});

worldTest('party last standing only shows defeat when the final bot falls through recorded engine inputs',async({cheat,step})=>{
 await step(3);await cheat(PartyReset,{wave:1,humans:1});await step(2);
 for(let slot=0;slot<5;slot++)await cheat(PartyHit,{slot});
 expect(session.get().game!.Players.filter(alive).length).toBe(1);expect(alive(session.get().game!.Players[5]!)).toBe(true);
 expect(desktopState.get().screen).toBe('play');const tick=session.get().game!.Tick;await step(1);expect(session.get().game!.Tick).toBe(tick+1);
 await cheat(PartyHit,{slot:5});expect(session.get().game!.State).toBe(State.GameOver);expect(desktopState.get().screen).toBe('result');expect(desktopState.get().won).toBe(false);
},{scene:'scenes/arcade.scene.json'});

renderTest('party last standing remaining dragon gets a clear HUD notice before defeat',async({cheat,step,input,render})=>{
 input.view(768,720,1);await step(3);await cheat(PartyReset,{wave:1,humans:6});await step(2);
 for(let slot=0;slot<5;slot++)await cheat(PartyHit,{slot});
 await step(126);const hud=hudModel(session.get().game!,initialDesktopSave);
 expect(hud.highTitle).toBe('LAST DRAGON');expect(hud.high).toBe('1 / 6');expect(hud.freeze).toBe('LAST DRAGON STANDING');
 render.expectDrawCalls('<=',14,{width:768,height:720});render.expectScreenshot('last_dragon_standing',{width:768,height:720});
 await cheat(PartyHit,{slot:5});expect(desktopState.get().screen).toBe('result');render.expectScreenshot('team_defeat',{width:768,height:720});
},{scene:'scenes/arcade.scene.json'});

worldTest('party last standing a surviving AI continues after the only human falls and empty slots do not count',()=>{
 const slots:PartySlot[]=['human','empty','empty','empty','empty','ai'];
 const g=createPartyGame(campaign,42,slots);for(let tick=0;tick<180;tick++)stepGame(g,idle);
 g.Players[0]!.Invincible=0;hurtPlayer(g,0);stepGame(g,idle);
 expect(g.State).toBe(State.Playing);expect(alive(g.Players[5]!)).toBe(true);expect(g.Players.filter(alive).length).toBe(1);
 g.Players[5]!.Invincible=0;hurtPlayer(g,5);stepGame(g,idle);expect(g.State).toBe(State.GameOver);
});

worldTest('party last standing a full wipe ends the run during preparation or rest as well as combat',()=>{
 for(const phase of ['prepare','rest','combat'] as const){
  const g=createPartyGame(campaign,42);g.Party!.Phase=phase;g.Party!.Timer=300;
  for(let i=0;i<g.Players.length;i++){g.Players[i]!.Invincible=0;hurtPlayer(g,i);}
  stepGame(g,idle);expect(g.State).toBe(State.GameOver);
 }
});
