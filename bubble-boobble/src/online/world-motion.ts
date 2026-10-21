import { State, type GameState } from '../arcade/types';

/** One 20 Hz snapshot interval: 50 ms of display buffering, never client physics. */
export const WORLD_MOTION_STEPS = 3;
const MAX_TRAVEL = 96;
const collections = ['Players','Enemies','Bubbles','Effects'] as const;
type Collection = typeof collections[number];
interface Pose { key:number;x:number;y:number }
export interface WorldMotion {
 room:string|null;player:number;tick:number;gameTick:number;receivedStep:number;
 from:Record<Collection,Pose[]>;boss:{x:number;y:number}|null;
}
export function emptyWorldMotion():WorldMotion{return {room:null,player:-1,tick:-1,gameTick:-1,receivedStep:0,from:{Players:[],Enemies:[],Bubbles:[],Effects:[]},boss:null};}
const near=(a:{X:number;Y:number},b:{X:number;Y:number})=>Math.abs(a.X-b.X)<=MAX_TRAVEL&&Math.abs(a.Y-b.Y)<=MAX_TRAVEL;
const age=(actor:object)=>'Age' in actor&&typeof actor.Age==='number'?actor.Age:-1;
const key=(actor:object,index:number,kind:Collection)=>kind==='Players'?index:(actor as {ID:number}).ID;
/** Called only by the snapshot-consuming sim system. The saved state is compact prior poses. */
export function captureWorldMotion(previous:GameState|null,next:GameState,old:WorldMotion,room:string,player:number,tick:number,step:number,reset=false):WorldMotion{
 const motion={...emptyWorldMotion(),room,player,tick,gameTick:next.Tick,receivedStep:step};
 if(reset||!previous||old.room!==room||old.player!==player||old.tick>=tick||previous.State!==State.Playing||next.State!==State.Playing||previous.Paused||next.Paused||previous.LevelIndex!==next.LevelIndex||previous.Level.number!==next.Level.number||previous.Party?.Wave!==next.Party?.Wave||previous.Party?.Phase!==next.Party?.Phase||next.Tick<=previous.Tick)return motion;
 for(const kind of collections){
  const before=previous[kind],after=next[kind];
  const prior=new Map(before.map((actor,index)=>[key(actor,index,kind),actor]));
  for(let index=0;index<after.length;index++){
   const actor=after[index]!,id=key(actor,index,kind),oldActor=prior.get(id);
   if(!oldActor||!near(oldActor,actor)||age(actor)<age(oldActor))continue;
   if(kind!=='Players'&&previous.Tick-age(oldActor)!==next.Tick-age(actor))continue;
   if(kind==='Players'){
    const a=previous.Players[id],b=next.Players[id];
    if(!a||!b||a.Downed!==b.Downed||a.Lives!==b.Lives||a.Dead!==0||b.Dead!==0||a.Skin!==b.Skin||b.Invincible>a.Invincible)continue;
   }else if(kind==='Enemies'){
    const a=oldActor as GameState['Enemies'][number],b=actor as GameState['Enemies'][number];
    if(a.Kind!==b.Kind||a.State!==b.State||a.CarriedBy!==b.CarriedBy)continue;
   }else if(kind==='Bubbles'){
    const a=oldActor as GameState['Bubbles'][number],b=actor as GameState['Bubbles'][number];
    if(a.EnemyID!==b.EnemyID||a.Element!==b.Element||a.Removed||b.Removed)continue;
   }else if((oldActor as GameState['Effects'][number]).Element!==(actor as GameState['Effects'][number]).Element)continue;
   motion.from[kind].push({key:id,x:oldActor.X,y:oldActor.Y});
  }
 }
 const a=previous.Party?.Boss,b=next.Party?.Boss;
 if(a&&b&&a.Mode===b.Mode&&a.HP===b.HP&&b.Tick>=a.Tick&&near(a,b))motion.boss={x:a.X,y:a.Y};
 return motion;
}
/** Presentation-only shallow display rows. No authoritative object is modified or fully cloned. */
export function sampleWorldMotion(game:GameState,motion:WorldMotion,step:number,alpha=0):GameState{
 if(motion.room===null||motion.gameTick!==game.Tick||game.State!==State.Playing)return game;
 const t=Math.max(0,Math.min(1,(step-motion.receivedStep+Math.max(0,Math.min(1,alpha)))/WORLD_MOTION_STEPS));
 if(t>=1)return game;
 const display={...game};
 for(const kind of collections){
  if(!motion.from[kind].length)continue;
  const prior=new Map(motion.from[kind].map(p=>[p.key,p]));
  // Unkeyed projectiles/items/particles intentionally snap; array positions are not identities.
  (display as unknown as Record<string,unknown>)[kind]=game[kind].map((actor,index)=>{
   const p=prior.get(key(actor,index,kind));
   return p?{...actor,X:p.x+(actor.X-p.x)*t,Y:p.y+(actor.Y-p.y)*t}:actor;
  });
 }
 if(motion.boss&&game.Party?.Boss){const b=game.Party.Boss,p=motion.boss;display.Party={...game.Party,Boss:{...b,X:p.x+(b.X-p.x)*t,Y:p.y+(b.Y-p.y)*t}};}
 return display;
}
