import { expect, worldTest } from '@gameengine/test';
import { DesktopIntent } from '../src/schema.gen.ts';
import { desktopSave, desktopSaveState, initialDesktopSave, type DesktopSave } from '../src/desktop/save.ts';
import { desktopState, initialDesktopState } from '../src/desktop/state.ts';
import { desktopModel } from '../src/desktop/model.ts';
import { dragonSkins, cycleDragonSkin, isDragonSkin } from '../src/desktop/skins.ts';
const scene = 'scenes/arcade.scene.json';

worldTest('desktop skins cycle ten saved names in both directions and label the active dragon', () => {
  expect(dragonSkins).toEqual(['green','blue','red','yellow','purple','orange','cyan','pink','ivory','slate']);
  let state = initialDesktopSave;
  for (const avatar of ['blue','red','yellow','purple','orange','cyan','pink','ivory','slate','green']) {
    const result = desktopSave.apply(state,'setting',{action:'avatar',delta:25});
    expect(result.ok).toBe(true); if (!result.ok) return;
    state = result.state;
    expect(state.profiles[0]!.avatar).toBe(avatar);
    const model = desktopModel({...initialDesktopState,screen:'settings'},state);
    expect(model.avatar).toBe(avatar);
    expect(model.buttons[0]!.label).toBe(`DRAGON: ${avatar.toUpperCase()}`);
  }
  for (const avatar of ['slate','ivory','pink','cyan','orange','purple','yellow','red','blue','green']) {
    const result = desktopSave.apply(state,'setting',{action:'avatar',delta:-25});
    expect(result.ok).toBe(true); if (!result.ok) return;
    state = result.state;
    expect(state.profiles[0]!.avatar).toBe(avatar);
  }
  expect(cycleDragonSkin('slate')).toBe('green');
  expect(cycleDragonSkin('green',-1)).toBe('slate');
}, {scene});

worldTest('desktop skins preserve v1 green and blue saves and per-profile red yellow choices on reload', () => {
  const legacy: DesktopSave = JSON.parse(JSON.stringify(initialDesktopSave));
  legacy.profiles[0] = {...legacy.profiles[0]!,avatar:'blue',high_score:12345,best_round:7,played:4,won:1,lost:3,xp:150};
  legacy.settings = {music:25,sound:100,fullscreen:true};
  expect(desktopSave.load({v:1,state:legacy})).toEqual(legacy);
  const created = desktopSave.apply(legacy,'create','BUB');
  expect(created.ok).toBe(true); if (!created.ok) return;
  let state = created.state;
  expect(state.profiles[0]).toEqual(legacy.profiles[0]);
  expect(state.profiles[1]!.avatar).toBe('green');
  for (let i=0;i<3;i++) {
    const changed=desktopSave.apply(state,'setting',{action:'avatar',delta:25});
    expect(changed.ok).toBe(true); if (!changed.ok) return;
    state=changed.state;
  }
  const selected=desktopSave.apply(state,'select',0);
  expect(selected.ok).toBe(true); if (!selected.ok) return;
  const changed=desktopSave.apply(selected.state,'setting',{action:'avatar',delta:25});
  expect(changed.ok).toBe(true); if (!changed.ok) return;
  const loaded=desktopSave.load(JSON.parse(JSON.stringify(desktopSave.store(changed.state))));
  expect(loaded.profiles.map(p=>p.avatar)).toEqual(['red','yellow']);
  expect(loaded.active).toBe(0);
  expect({...loaded.profiles[0]!,avatar:'blue'}).toEqual(legacy.profiles[0]);
  expect(loaded.settings).toEqual(legacy.settings);
  expect(desktopSave.store(loaded).v).toBe(1);
}, {scene});

worldTest('desktop skins reject unknown saved avatars without silently replacing profiles', () => {
  for (const value of ['', 'teal', 'RED', 'yellow/walk', null, 7]) {
    expect(isDragonSkin(value)).toBe(false);
    const state = JSON.parse(JSON.stringify(initialDesktopSave));
    state.profiles[0].avatar=value;
    let rejected=false;
    try { desktopSave.load({v:1,state}); } catch { rejected=true; }
    expect(rejected).toBe(true);
    expect(state.profiles[0].avatar).toBe(value);
  }
  for (const avatar of dragonSkins) expect(isDragonSkin(avatar)).toBe(true);
}, {scene});

worldTest('desktop skins physical settings arrows wrap reverse and persist distinct profile choices', async ({input,step,app,services}) => {
  await step(5); expect(desktopSaveState.loaded()).toBe(true);
  input.emit(DesktopIntent,{action:'settings'}); await step(1);
  expect(desktopState.get().selected).toBe(0);
  const key = async (code:number) => { input.key(code,true); await step(1); input.key(code,false); await step(1); };
  // Physical ArrowRight and ArrowLeft use the same menuX action as the shipped UI.
  input.key(51,true); await step(1);
  expect(desktopSaveState.get().profiles[0]!.avatar).toBe('blue');
  await step(3); expect(desktopSaveState.get().profiles[0]!.avatar).toBe('blue');
  input.key(51,false); await step(1);
  await key(51); expect(desktopSaveState.get().profiles[0]!.avatar).toBe('red');
  await key(51); expect(desktopSaveState.get().profiles[0]!.avatar).toBe('yellow');
  await key(51); expect(desktopSaveState.get().profiles[0]!.avatar).toBe('purple');
  await key(51); expect(desktopSaveState.get().profiles[0]!.avatar).toBe('orange');
  for(const avatar of ['cyan','pink','ivory','slate','green']){await key(51);expect(desktopSaveState.get().profiles[0]!.avatar).toBe(avatar);}
  await key(50); expect(desktopSaveState.get().profiles[0]!.avatar).toBe('slate');
  input.action('confirm',1); await step(1); input.action('confirm',0); await step(1);
  expect(desktopSaveState.get().profiles[0]!.avatar).toBe('green');
  await key(51); await key(51);
  input.emit(DesktopIntent,{action:'new-profile'}); await step(1);
  input.emit(DesktopIntent,{action:'name',value:'BUB'}); await step(1);
  input.emit(DesktopIntent,{action:'create-profile'}); await step(1);
  expect(desktopSaveState.get().profiles[1]!.avatar).toBe('green');
  input.emit(DesktopIntent,{action:'settings'}); await step(1);
  for(let i=0;i<7;i++)await key(50);
  expect(desktopSaveState.get().profiles.map(p=>p.avatar)).toEqual(['red','yellow']);
  app.background(); await step(2);
  const writes=services.calls('storage.write').filter(call=>call.params.name==='meta-bubblebobble-desktop');
  expect(writes.length).toBeGreaterThan(0);
  const loaded=desktopSave.load(writes.at(-1)!.params.data);
  expect(loaded.profiles.map(p=>p.avatar)).toEqual(['red','yellow']);
  expect(loaded.active).toBe(1);
  input.emit(DesktopIntent,{action:'profile:0'}); await step(1);
  expect(desktopSaveState.get().profiles[0]!.avatar).toBe('red');
}, {scene});
