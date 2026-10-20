import {worldTest,expect} from '@gameengine/test';
import campaign from '../data/levels.json';
import {applyWorldEvents,createWorldState} from '../src/online/world-rules';
import {isPublicWorld,projectWorld,publicBytes,type PublicWorld} from '../src/online/world-public';
import {worldClientPayload} from '../src/online/world-client-payload';

function fourRooms():PublicWorld {
 let state=createWorldState();
 for(let player=0;player<4;player++)state=applyWorldEvents(state,[{kind:'join',player,name:`PRIVATE NAME ${player}`},{kind:'input',player,data:{action:'create'}}],campaign);
 state.tick=321;
 const publicWorld=projectWorld(state);
 publicWorld.peers.push({player:99,room:null,error:'That game is full'});
 return publicWorld;
}
const directory=(document:PublicWorld)=>document.rooms.map(({game,...metadata})=>metadata);
worldTest('online client payload keeps only its owned selected game without mutating discovery or packed data',()=>{
 const source=fourRooms(),before=JSON.stringify(source),selected=source.rooms[2]!;
 expect(source.rooms.filter(room=>!!room.game).length).toBe(4);
 const payload=worldClientPayload(source,2,selected.id,true);
 expect(isPublicWorld(payload)).toBe(true);expect(JSON.stringify(source)).toBe(before);
 expect(payload.rooms.map(room=>!!room.game)).toEqual([false,false,true,false]);
 expect(payload.rooms[2]!.game).toBe(selected.game);
 expect(directory(payload)).toEqual(directory(source));expect(payload.peers).toEqual(source.peers);
 expect(payload.version).toBe(source.version);expect(payload.tick).toBe(321);
 for(const key of ['Campaign','RNG','Companion','Companions','OnlineNavigationGraphs','OnlineNavigationGraphIndices'])expect(JSON.stringify(payload).includes(`"${key}"`)).toBe(false);
 expect(JSON.stringify(payload).includes('PRIVATE NAME')).toBe(false);
});
worldTest('online client browsing payload strips every display game while retaining live rooms notices and errors',()=>{
 const source=fourRooms(),payload=worldClientPayload(source,0,'room-1',false);
 expect(isPublicWorld(payload)).toBe(true);expect(payload.rooms.every(room=>room.game===undefined)).toBe(true);
 expect(directory(payload)).toEqual(directory(source));expect(payload.peers).toEqual(source.peers);
 expect(payload.rooms.every(room=>room.notices.length>0)).toBe(true);
 expect(payload.peers.find(peer=>peer.player===99)!.error).toBe('That game is full');
});
worldTest('online client payload cannot select another player game or reopen a stale room',()=>{
 const source=fourRooms();
 for(const [player,selected] of [[0,'room-2'],[88,'room-1'],[0,'room-999'],[0,null]] as const){
  const payload=worldClientPayload(source,player,selected,true);
  expect(payload.rooms.every(room=>room.game===undefined)).toBe(true);expect(directory(payload)).toEqual(directory(source));
 }
});
worldTest('online client four-room bridge serializes one display or directory only instead of all games',()=>{
 const source=fourRooms(),playing=worldClientPayload(source,1,'room-2',true),browsing=worldClientPayload(source,1,'room-2',false);
 expect(publicBytes(playing)).toBeLessThan(publicBytes(source)*.4);
 expect(publicBytes(browsing)).toBeLessThan(publicBytes(source)*.1);
 expect(playing.rooms.filter(room=>!!room.game).length).toBe(1);
 expect(isPublicWorld(playing)).toBe(true);expect(isPublicWorld(browsing)).toBe(true);
});
