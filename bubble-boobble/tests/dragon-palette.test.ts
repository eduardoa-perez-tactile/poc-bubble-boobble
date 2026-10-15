import {expect,renderTest,worldTest} from '@gameengine/test';
import type {TestWorld} from '@gameengine/test';
import {MeshRenderer,MaterialGlobals} from '@gameengine/runtime';
import {referenceFrame} from '../src/arcade/presentation.ts';
import {pixelRect} from '../src/arcade/pixel-renderer/index.ts';
import {framePalette,paletteColor,sourceFrame} from '../src/arcade/pixel-renderer/palettes.ts';
import {composedColorAt,orderedArrays} from '../src/arcade/pixel-renderer/ordered.ts';
import type {PixelQuad} from '../src/arcade/pixel-renderer/types.ts';
import pixels from '../assets/pixel-renderer/pixels.json';
import {SpriteSizing} from '../src/arcade/arcade.cheats.ts';
import {session} from '../src/arcade/session.ts';
import {arcadeDrawPlan} from '../src/arcade/presentation.ts';

const sources=pixels as Record<string,{width:number;height:number;pixels:number[]}>;
const frames=Object.keys(sources).filter(name=>name.startsWith('reference/green/')).sort();
const scene='scenes/pixel-prototype.scene.json';
worldTest('dragon palette preserves every original frame mask eyes and belly',()=>{
 expect(frames.length).toBe(19);
 for(const skin of ['red','yellow'])for(const frame of frames){
  const alias=frame.replace('/green/',`/${skin}/`),source=sources[frame]!;
  expect(sourceFrame(alias)).toBe(frame);
  expect(pixelRect(alias).slice(1)).toEqual(pixelRect(frame).slice(1));
  for(const flip of [false,true]) {
   const draws:PixelQuad[]=[{image:'solid/black',x:0,y:0,w:source.width,h:source.height},
    {image:alias,x:0,y:0,w:source.width,h:source.height,flip}];
   for(let y=0;y<source.height;y++)for(let x=0;x<source.width;x++){
    const i=(y*source.width+(flip?source.width-1-x:x))*4,p=source.pixels;
    const original=(p[i]!|p[i+1]!<<8|p[i+2]!<<16|p[i+3]!<<24)>>>0;
    const expected=paletteColor(original,framePalette(alias));
    expect(expected>>>24).toBe(original>>>24);
    if((original&0xffffff)!==0x00ff00&&(original&0xffffff)!==0x00ffff)
      expect(expected).toBe(original);
    const actual=composedColorAt(draws,1,x+.5,y+.5);
    expect(actual&0xffffff).toBe(original>>>24?expected&0xffffff:0);
   }
  }
 }
},{scene});

function prepare(world:TestWorld){
 for(const row of world.all(MeshRenderer))world.despawn(row.entity);
 world.setResource(MaterialGlobals,{v0:[0,0,0,0]});
}
function show(world:TestWorld,draws:PixelQuad[]){
 const geometry=orderedArrays(draws,1/45,384,360),a=geometry.arrays;
 for(let q=0;q<geometry.vertices/4;q++){
  const p=q*12,u=q*8,k=q*16;
  const left=a.positions[p]!,bottom=a.positions[p+1]!,right=a.positions[p+6]!,top=a.positions[p+7]!;
  world.spawn({LocalTransform:{position:[(left+right)/2,(bottom+top)/2,a.positions[p+2]!],scale:[right-left,top-bottom,1]},
   MeshRenderer:{mesh:'pixel-renderer/static-quad.gltf',material:'materials/pixel-ordered.mat.json',color:[1,1,1,1],castShadows:false,receiveShadows:false},
   MaterialParams:{params:a.uvs[u]!<0?[-1,a.colors[k]!/255,a.colors[k+1]!/255,a.colors[k+2]!/255]:[a.uvs[u]!,a.uvs[u+5]!,a.uvs[u+2]!-a.uvs[u]!,a.uvs[u+1]!-a.uvs[u+5]!]}});
 }
}
renderTest('dragon palette all original animation frames',async({input,world,step,render})=>{
 input.view(768,720,1);await step(2);prepare(world);
 const draws:PixelQuad[]=[];
 for(let row=0;row<frames.length;row++)for(let col=0;col<6;col++){
  const skin=['green','red','yellow'][col%3]!;
  draws.push({image:frames[row]!.replace('/green/',`/${skin}/`),x:24+col*112,y:14+row*36,w:28,h:28,flip:col>=3});
 }
 show(world,draws);await step(2);
 render.expectDrawCalls('<=',4,{width:768,height:720});
 render.expectScreenshot('all-frames',{width:768,height:720,threshold:0,maxCap:0});
},{scene});

worldTest('bubble palette preserves all shot frame geometry alpha and non-rim texels',()=>{
 for(let frame=0;frame<4;frame++)for(const skin of ['blue','red','yellow']){
  const original=referenceFrame('bubble',frame*10),alias=referenceFrame(`${skin}/bubble`,frame*10);
  expect(alias).toBe(`reference/${skin}/bubble/${frame}`);
  expect(sourceFrame(alias)).toBe(original);
  expect(pixelRect(alias).slice(1)).toEqual(pixelRect(original).slice(1));
  const source=sources[original]!,palette=framePalette(alias);
  for(let i=0;i<source.pixels.length;i+=4){
   const p=source.pixels,rgba=(p[i]!|p[i+1]!<<8|p[i+2]!<<16|p[i+3]!<<24)>>>0;
   const color=paletteColor(rgba,palette);
   expect(color>>>24).toBe(rgba>>>24);
   if((rgba&0xffffff)!==0x00ff00&&(rgba&0xffffff)!==0x00bb00)expect(color).toBe(rgba);
  }
 }
 // Blue dragons remain their original supplied artwork, not a virtual skin.
 expect(framePalette('reference/blue/walk/0')).toBe(0);
 expect(sourceFrame('reference/blue/walk/0')).toBe('reference/blue/walk/0');
},{scene});

renderTest('bubble palette all original shot frames',async({input,world,step,render})=>{
 input.view(768,720,1);await step(2);prepare(world);
 const draws:PixelQuad[]=[];
 for(let frame=0;frame<4;frame++)for(let col=0;col<8;col++){
  const skin=['green','blue','red','yellow'][col%4]!;
  draws.push({image:referenceFrame(skin==='green'?'bubble':`${skin}/bubble`,frame*10),
   x:24+col*88,y:64+frame*136,w:44,h:44,flip:col>=4});
 }
 show(world,draws);await step(2);
 render.expectDrawCalls('<=',4,{width:768,height:720});
 render.expectScreenshot('shot-frames',{width:768,height:720,threshold:0,maxCap:0});
},{scene});

renderTest('dragon palette production composed colors retain encoded source RGB',async({input,step,cheat,render})=>{
 input.view(768,720,1);await step(2);await cheat(SpriteSizing);await step(2);
 const draws=arcadeDrawPlan(session.get().game!),food=draws.find(d=>d.image==='reference/food/1/0')!,source=sources[food.image]!;
 const points:[number,number][]=[],expected:number[][]=[];
 const layers:PixelQuad[]=[{image:'solid/black',x:0,y:0,w:768,h:720},...draws];
 for(let y=Math.ceil(food.y);y<food.y+food.h;y++)for(let x=Math.ceil(food.x);x<food.x+food.w;x++){
  const sx=Math.floor((x+.5-food.x)*source.width/food.w),sy=Math.floor((y+.5-food.y)*source.height/food.h);
  const a=source.pixels[(sy*source.width+sx)*4+3]!;
  if(a<=0||a>=255||points.length>=64)continue;
  const color=composedColorAt(layers,draws.indexOf(food)+1,x+.5,y+.5);
  points.push([x,y]);expected.push([color&255,(color>>>8)&255,(color>>>16)&255,255]);
 }
 expect(points.length).toBeGreaterThan(0);
 const actual=render.probe({width:768,height:720,points});
 for(let i=0;i<points.length;i++)expect(actual.points[i]!.rgba).toEqual(expected[i]!);
},{scene:'scenes/arcade.scene.json'});

renderTest('dragon palette GPU masks flips clips and source-over agree',async({input,world,step,render})=>{
 input.view(768,720,1);await step(2);prepare(world);
 const variants:PixelQuad[]=[];
 let y=12;
 for(const size of [48,96,36,28])for(const flip of [false,true]){
  variants.push({image:referenceFrame('green/walk',40),x:80,y,w:size,h:size,flip});y+=size+8;
 }
 // Actual canvas clipping at the left edge, in both orientations.
 variants.push({image:referenceFrame('green/shoot',20),x:-8,y:530,w:48,h:48},
  {image:referenceFrame('green/dead',10),x:-8,y:598,w:48,h:48,flip:true});
 show(world,variants);await step(2);
 const points: [number,number][]=[];
 for(const draw of variants)for(let row=0;row<7;row++)for(let col=0;col<7;col++){
  const x=Math.floor(draw.x+(col+.5)*draw.w/7),y=Math.floor(draw.y+(row+.5)*draw.h/7);
  if(x>=0)points.push([x,y]);
 }
 const probe=()=>{
  const result:number[][]=[];
  for(let i=0;i<points.length;i+=64)result.push(...render.probe({width:768,height:720,points:points.slice(i,i+64)}).points.map(p=>p.rgba));
  return result;
 };
 const green=probe();
 expect(green.filter(rgba=>rgba[0]===0&&rgba[1]===255&&rgba[2]===0).length).toBeGreaterThan(20);
 for(const skin of ['red','yellow']){
  for(const row of world.all(MeshRenderer))world.despawn(row.entity);
  show(world,variants.map(draw=>({...draw,image:draw.image.replace('/green/',`/${skin}/`)})));
  await step(2);const actual=probe();
  for(let i=0;i<points.length;i++){
   const rgba=green[i]!,packed=(rgba[0]!|rgba[1]!<<8|rgba[2]!<<16|rgba[3]!<<24)>>>0;
   const expected=paletteColor(packed,skin==='red'?1:2);
   expect(actual[i]!).toEqual([expected&255,(expected>>>8)&255,(expected>>>16)&255,expected>>>24]);
  }
 }
 // A partial-alpha food sprite covers the dragon. Independent per-channel
 // source-over proves the CPU resolves the skin BEFORE blending the effect.
 const food=sources['reference/food/1/0']!,dragon=sources['reference/green/walk/0']!;
 let partial=0;
 for(const skin of ['red','yellow']){
  const draws:PixelQuad[]=[{image:'solid/black',x:0,y:0,w:48,h:48},
   {image:`reference/${skin}/walk/0`,x:0,y:0,w:48,h:48},
   {image:'reference/food/1/0',x:0,y:0,w:48,h:48}];
  const alphaPoints:[number,number][]=[],expectedColors:number[][]=[];
  for(let yy=0;yy<48;yy++)for(let xx=0;xx<48;xx++){
   const at=(Math.floor((yy+.5)*food.height/48)*food.width+Math.floor((xx+.5)*food.width/48))*4;
   const dp=(Math.floor((yy+.5)*dragon.height/48)*dragon.width+Math.floor((xx+.5)*dragon.width/48))*4;
   const p=dragon.pixels,f=food.pixels,a=f[at+3]!;
   if(a===0||a===255||p[dp]!==0||p[dp+1]!==255||p[dp+2]!==0)continue;
   const body=skin==='red'?[255,0,0]:[255,220,0],color=composedColorAt(draws,2,xx+.5,yy+.5);
   for(let c=0;c<3;c++)expect((color>>>(8*c))&255).toBe(Math.round(f[at+c]!+body[c]!*(255-a)/255));
   if(alphaPoints.length<64){alphaPoints.push([xx,yy]);expectedColors.push([color&255,(color>>>8)&255,(color>>>16)&255,255]);}
   partial++;
  }
  for(const row of world.all(MeshRenderer))world.despawn(row.entity);
  show(world,draws);await step(2);
  const actual=render.probe({width:768,height:720,points:alphaPoints});
  for(let i=0;i<alphaPoints.length;i++)expect(actual.points[i]!.rgba).toEqual(expectedColors[i]!);
 }
 expect(partial).toBeGreaterThan(0);
},{scene});
