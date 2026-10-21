import type { GameState } from '../arcade/types';
import { partyNames, partySurvivorCount } from '../arcade/party-config';
import type { PublicRoom } from './world-public';
import type { OnlineBarModel } from './room.view';

const labels=(items:string[])=>items.slice(0,3).join(', ')+(items.length>3?` +${items.length-3}`:'');
/** One online hierarchy. A personal defeat never becomes a team result. */
export function onlineHudModel(game:GameState,room:PublicRoom,player:number,tick:number):OnlineBarModel{
 const slot=room.owners.indexOf(player),self=game.Players[slot],party=game.Party!,ai=party.Slots.flatMap((kind,index)=>kind==='ai'?[`P${index+1} ${partyNames[index]}`]:[]);
 let objective=party.Phase==='prepare'?`GET READY / STARTS IN ${Math.max(1,Math.ceil(party.Timer/60))}S`:party.Phase==='rest'?`WAVE CLEAR / NEXT WAVE IN ${Math.max(1,Math.ceil(party.Timer/60))}S`:party.Boss?.Mode==='captured'?'POP THE GIANT BUBBLE TO FINISH':party.Boss?.Mode==='windup'?'DODGE THE BOTTLE SPREAD':party.Phase==='boss'?'POP THUNDER BUBBLES TO DAMAGE THE BOSS':'BLOW BUBBLES AND POP ENEMIES';
 if(self?.Downed)objective='YOU ARE DOWN / A TEAMMATE CAN RESCUE YOU';
 else if(self&&(self.Lives<=0||self.Dead>0))objective='YOU ARE OUT / YOUR TEAM IS STILL PLAYING';
 const pending=room.pendingTakeovers??[];
 const countdowns=pending.map(item=>`${item.label}: AI IN ${Math.max(1,Math.ceil(item.remainingTicks/60))}S`);
 const recent=room.notices.filter((notice,index,all)=>tick-notice.tick<180&&!all.slice(index+1).some(later=>later.slot===notice.slot));
 const joined=recent.filter(notice=>notice.kind==='join').map(notice=>notice.label),left=recent.filter(notice=>notice.kind==='leave').map(notice=>notice.label);
 const started=recent.filter(notice=>notice.kind==='ai').map(notice=>notice.label);
 const notice=countdowns.length?labels(countdowns):started.length?`${labels(started)} AI STARTED`:(joined.length?`${labels(joined)} JOINED`:left.length?`${labels(left)} LEFT`:ai.length?`AI DRAGONS: ${labels(ai)}`:'');
 return {score:`TEAM SCORE ${String(game.Score).padStart(7,'0')}`,wave:`WAVE ${party.Wave} / ${party.BossWave}`,alive:`ALIVE ${partySurvivorCount(game)} / ${party.Slots.filter(kind=>kind!=='empty').length}`,identity:`YOU P${slot+1} ${partyNames[slot]??'DRAGON'} / HUMANS ${room.humans}/10 / AI ${ai.length}`,objective,notice};
}
