import { goSin } from './trig';
import type { GameState, Player, Bubble } from './types';
import type { PixelQuad } from './pixel-renderer/types';

// Opaque pixel primitives join the existing ordered batch: no extra texture,
// blend pass, particle entity or unbounded effect pool.
export const feelColors = ['#73f5aa','#63caff','#ff7a99','#ffe17c','#c9a0ff','#ffb16a'] as const;
export function rect(out:PixelQuad[],color:string,x:number,y:number,w:number,h:number) {
  if(w>0&&h>0)out.push({image:`solid/${color}`,x:Math.round(x),y:Math.round(y),w:Math.max(1,Math.round(w)),h:Math.max(1,Math.round(h))});
}
export function ring(out:PixelQuad[],x:number,y:number,r:number,color:string,age=0) {
  for(let i=0;i<12;i++) {
    const a=i*Math.PI/6, size=age>12?2:3;
    rect(out,color,x+goSin(a+Math.PI/2)*r-size/2,y+goSin(a)*r-size/2,size,size);
  }
}
export function sparkle(out:PixelQuad[],x:number,y:number,color:string,size=3) {
  rect(out,color,x-size,y,2*size+1,1);rect(out,color,x,y-size,1,2*size+1);
}
export function bubblePose(b:Bubble) {
  const emission=Math.max(0,1-b.Age/9),capture=b.EnemyID?Math.max(0,1-b.CapturedAge/12):0;
  const wobble=goSin(b.Age*.18+b.ID)* (b.Floating?1.8:.6);
  const w=44+emission*12-capture*7+wobble,h=44-emission*9+capture*9-wobble;
  return {x:b.X+22-w/2,y:b.Y+70-h/2,w,h};
}
export function dragonPose(p:Player,tick:number,landAge=99,turnAge=99) {
  let sx=1,sy=1,dx=0;
  if(!p.Ground){const stretch=p.VY<0?.08:.04;sx-=stretch;sy+=stretch;}
  if(p.Shoot>0){const kick=p.Shoot/12;sx+=.1*kick;sy-=.07*kick;dx=-p.Dir*3*kick;}
  if(p.Ground&&Math.abs(p.VX)>0){const stride=goSin(p.WalkFrame*.6)*.025;sx+=stride;sy-=stride;}
  if(landAge<9){const t=1-landAge/9;sx+=.16*t;sy-=.13*t;}
  if(turnAge<6)sx-=.12*(1-turnAge/6);
  return {x:p.X+24-24*sx+dx,y:p.Y+96-48*sy,w:48*sx,h:48*sy};
}
const themes=[
  ['#0c152b','#12223a','#192f48','#28465c'],
  ['#1b1530','#281e40','#362b50','#574365'],
  ['#0b242d','#12333c','#1a434a','#326263'],
] as const;
export function arenaBackdrop(g:GameState,reduced=false):PixelQuad[] {
  const out:PixelQuad[]=[],c=themes[Math.floor((g.Party!.Wave-1)/3)%themes.length]!;
  rect(out,c[0],24,72,720,576);
  // Distant arches and staggered masonry give the stationary arena depth.
  for(let i=0;i<8;i++){
    const x=50+i*94,height=130+(i*73%170);
    rect(out,c[1],x,648-height,60,height);rect(out,c[2],x+8,648-height,44,3);
    rect(out,c[0],x+17,664-height,26,height-16);
  }
  for(let i=0;i<14;i++){
    const x=58+(i*157%650),y=110+(i*83%480);
    rect(out,c[1],x,y,34,2);
  }
  if(!reduced)for(let i=0;i<10;i++){
    const phase=(g.Tick+i*37)%240,y=620-phase*2;
    sparkle(out,60+(i*163%648),y,c[3],phase%60<10?2:1);
  }
  return out;
}
export type FeelCue={kind:'land'|'turn'|'rescue'|'boss-hit'|'clear'|'victory'|'capture';x:number;y:number;at:number;slot:number;};
type Snapshot={tick:number;wave:number;phase:string;state:number;hp:number;bossMode:string;players:{x:number;y:number;ground:boolean;dir:number;downed:boolean;lives:number}[]};
export type FeelState={clock:number;step:number;previous:Snapshot|null;cues:FeelCue[];};
export const emptyFeel=():FeelState=>({clock:0,step:0,previous:null,cues:[]});
/** Bounded presentation history; persisted in a sim:false resource, never in match state. */
export function advanceFeel(old:FeelState,g:GameState,step:number):FeelState {
  const previous=old.previous,reset=!previous||g.Tick<previous.tick||g.Party!.Wave<previous.wave;
  const clock=reset?0:old.clock+(g.Paused?0:Math.max(0,step-old.step));
  const cues=reset?[]:old.cues.filter(c=>clock-c.at<75);
  const add=(kind:FeelCue['kind'],x:number,y:number,slot=0)=>cues.push({kind,x,y,slot,at:clock});
  if(!reset&&g.Tick!==previous.tick){
    for(let i=0;i<g.Players.length;i++){
      const p=g.Players[i]!,before=previous.players[i];
      if(!before||p.Downed||p.Lives===0)continue;
      if(before.downed)add('rescue',p.X+24,p.Y+72,i);
      else if(p.Ground&&!before.ground&&Math.abs(p.Y-before.y)<80)add('land',p.X+24,p.Y+96,i);
      if(before.dir!==p.Dir)add('turn',p.X+24,p.Y+96,i);
    }
    const b=g.Party!.Boss;
    if(b&&b.HP<previous.hp&&b.Mode!=='captured')add('boss-hit',b.X+48,b.Y+96);
    if(b?.Mode==='captured'&&previous.bossMode!=='captured')add('capture',b.X+48,b.Y+96);
    if(g.Party!.Phase==='rest'&&previous.phase!=='rest')add('clear',384,175);
    if(g.State===4&&previous.state!==4)add('victory',384,230);
  }
  return {clock,step,cues:cues.slice(-32),previous:{tick:g.Tick,wave:g.Party!.Wave,phase:g.Party!.Phase,state:g.State,hp:g.Party!.Boss?.HP??0,bossMode:g.Party!.Boss?.Mode??'',players:g.Players.map(p=>({x:p.X,y:p.Y,ground:p.Ground,dir:p.Dir,downed:!!p.Downed,lives:p.Lives}))}};
}
export function cueQuads(state:FeelState,reduced=false):PixelQuad[] {
  const out:PixelQuad[]=[];
  for(const c of state.cues){
    const age=state.clock-c.at,color=feelColors[c.slot%6]!;
    if(c.kind==='land'||c.kind==='turn'){
      if(age>=12||reduced)continue;
      for(const dir of [-1,1])rect(out,'#94aabc',c.x+dir*(8+age*1.5),c.y-2-age*.3,Math.max(1,5-age*.35),2);
    }else if(c.kind==='rescue'){
      if(age<28)ring(out,c.x,c.y-age*.5,24+age*.8,color,age);
      if(!reduced&&age<28)for(let i=0;i<4;i++)sparkle(out,c.x+(i-1.5)*16,c.y-age*1.8+(i%2)*8,'#fff3c4');
    }else if(c.kind==='boss-hit'){
      if(age<10)ring(out,c.x,c.y,28+age*3,'#fff3c4',age);
    }else if(c.kind==='capture'){
      if(age<35)ring(out,c.x,c.y,40+age*1.1,'#9de8ff',age);
    }else if(!reduced&&age<65){
      const count=c.kind==='victory'?36:18;
      for(let i=0;i<count;i++){
        const vx=((i*17%23)-11)*.48,vy=-2.5-(i%7)*.6;
        rect(out,feelColors[i%6]!,c.x+vx*age,c.y+vy*age+.055*age*age,age>45?2:3,age>45?2:5);
      }
    }
  }
  return out;
}
export function popQuads(g:GameState,reduced=false):PixelQuad[]{
  const out:PixelQuad[]=[];
  // A fixed cap keeps mass chain clears from flooding the arena.
  for(const p of g.Particles.filter(p=>!p.Text).slice(-18)){
    const age=15-p.Life,cx=p.X+22,cy=p.Y+70+age*.6;
    ring(out,cx,cy,7+age*1.8,age<4?'#fff3c4':'#85cfe0',age);
    if(!reduced)for(let i=0;i<4;i++){
      const a=i*Math.PI/2+.6,r=10+age*2.2;
      rect(out,feelColors[i%6]!,cx+goSin(a)*r,cy+goSin(a+Math.PI/2)*r+age*.4,age<7?3:2,age<7?3:2);
    }
  }
  return out;
}
