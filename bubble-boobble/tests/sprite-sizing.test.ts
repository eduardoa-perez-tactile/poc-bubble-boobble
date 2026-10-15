import {expect, renderTest, worldTest} from '@gameengine/test';
import {SpriteSizing} from '../src/arcade/arcade.cheats.ts';
import {session} from '../src/arcade/session.ts';
import {arcadeDrawPlan, fittedItemImage, referenceFrame} from '../src/arcade/presentation.ts';
import sprites from '../data/sprites.json';
import atlas from '../assets/pixel-renderer/atlas-layout.json';
import {DesktopIntent} from '../src/schema.gen.ts';

const itemNames = Object.keys(sprites).filter(name => name.startsWith('food/') ||
  referenceFrame(name,0).startsWith('reference/items/'));
worldTest('pickup sprite source aspects preserve box centers and square art', () => {
  expect(itemNames.length).toBe(37);
  for (const name of itemNames) for (const size of [24,30,32]) {
    const draw = fittedItemImage(name,0,100,200,size);
    const rect = (atlas.rects as Record<string,number[]>)[draw.image]!;
    expect(draw.w / draw.h).toBeCloseTo(rect[2]! / rect[3]!,6);
    expect(Math.max(draw.w,draw.h)).toBeCloseTo(size,6);
    expect(draw.x + draw.w / 2).toBeCloseTo(100 + size / 2,6);
    expect(draw.y + draw.h / 2).toBeCloseTo(200 + size / 2,6);
    if (rect[2] === rect[3]) {
      expect(draw.w).toBe(size);expect(draw.h).toBe(size);
      expect(draw.x).toBe(100);expect(draw.y).toBe(200);
    }
  }
  for(const name of ['pink_candy','blue_candy','yellow_candy']) {
    const draw=fittedItemImage(name,0,100,200,32);
    expect(draw.w).toBe(32);expect(draw.h).toBeCloseTo(64/3,6);
    expect(draw.y).toBeCloseTo(200+16/3,6);
  }
},{scene:'scenes/arcade.scene.json'});

renderTest('pickup sprite natural proportions', async ({input,step,cheat,render}) => {
  input.view(768,720,1);
  await step(2);
  await cheat(SpriteSizing);
  await step(2);
  expect(session.get().game!.Items.length).toBe(37);
  expect(arcadeDrawPlan(session.get().game!).filter(draw => draw.image.includes('/items/')).length).toBe(19);
  const candies=arcadeDrawPlan(session.get().game!).filter(draw=>draw.image.includes('_candy'));
  expect(candies.length).toBe(6);
  for(const draw of candies) expect(draw.w/draw.h).toBeCloseTo(1.5,6);
  // Actual engine pixels prove the square's empty bands were restored. Before
  // this change candy texels filled both bands despite the15:10 source aspect.
  const regions: [number,number,number,number][]=[];
  for(const draw of candies.filter(draw=>!draw.footer)) {
    const boxTop=Math.round(draw.y+(draw.h-32)/2);
    regions.push([Math.round(draw.x),boxTop,32,4],[Math.round(draw.x),boxTop+28,32,4]);
  }
  const bands=render.probe({width:768,height:720,regions});
  for(const band of bands.regions) expect(band.max.slice(0,3)).toEqual([0,0,0]);
  render.expectDrawCalls('<=',8,{width:768,height:720});
  render.expectScreenshot('pickups',{width:768,height:720});
  input.emit(DesktopIntent,{action:'navigate',value:'editor'});
  await step(2);
  render.expectScreenshot('editor-icons',{width:768,height:720});
},{scene:'scenes/arcade.scene.json'});
