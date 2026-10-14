// Controlled initial-state injection for development cheats and parity tests only.
// Runtime gameplay never imports this module or reads expected oracle output.
import type {GameState,Level} from './types';
import {createGame} from './game';
export interface ArcadeScenario {
 name:string; seed:number; round:number; players:number; fullCampaign?:boolean;
 setup?:Partial<GameState>;
 spans:{ticks:number;players:{Move:number;Jump:boolean;Fire:boolean}[];paused:boolean}[];
}
export function scenarioGame(levels:Level[],scenario:ArcadeScenario):GameState {
 const g=createGame(scenario.fullCampaign?levels:levels.slice(scenario.round-1),scenario.seed,scenario.players);
 applyScenarioSetup(g,scenario.setup);
 return g;
}
export function applyScenarioSetup(g:GameState,setup?:Partial<GameState>):void {
 if(!setup)return;
 // Scenarios provide complete array entries and complete nested structs. Only
 // supplied top-level fields change, matching the oracle JSON state overlay.
 const patch=JSON.parse(JSON.stringify(setup)) as Partial<GameState>;
 if(patch.RNG!==undefined)throw new Error('Controlled scenarios preserve the seeded reference RNG');
 Object.assign(g,patch);
}
