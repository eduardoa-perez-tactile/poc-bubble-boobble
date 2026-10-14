import type {ArcadeScenario} from '../src/arcade/scenarios';
import setup0 from './scenarios/boundary-bonus-pending-drain.json';
import expected0 from './fixtures/boundary-bonus-pending-drain.expected.json';
import setup1 from './scenarios/boundary-bonus-threshold-order.json';
import expected1 from './fixtures/boundary-bonus-threshold-order.expected.json';
import setup2 from './scenarios/boundary-bubble-bounce.json';
import expected2 from './fixtures/boundary-bubble-bounce.expected.json';
import setup3 from './scenarios/boundary-bubble-chain.json';
import expected3 from './fixtures/boundary-bubble-chain.expected.json';
import setup4 from './scenarios/boundary-bubble-escape.json';
import expected4 from './fixtures/boundary-bubble-escape.expected.json';
import setup5 from './scenarios/boundary-campaign-win.json';
import expected5 from './fixtures/boundary-campaign-win.expected.json';
import setup6 from './scenarios/boundary-clear-full-campaign.json';
import expected6 from './fixtures/boundary-clear-full-campaign.expected.json';
import setup7 from './scenarios/boundary-element-fire.json';
import expected7 from './fixtures/boundary-element-fire.expected.json';
import setup8 from './scenarios/boundary-element-thunder.json';
import expected8 from './fixtures/boundary-element-thunder.expected.json';
import setup9 from './scenarios/boundary-element-water.json';
import expected9 from './fixtures/boundary-element-water.expected.json';
import setup10 from './scenarios/boundary-power-clock.json';
import expected10 from './fixtures/boundary-power-clock.expected.json';
import setup11 from './scenarios/boundary-power-dynamite.json';
import expected11 from './fixtures/boundary-power-dynamite.expected.json';
import setup12 from './scenarios/boundary-power-orange-parasol.json';
import expected12 from './fixtures/boundary-power-orange-parasol.expected.json';
import setup13 from './scenarios/boundary-power-purple-parasol.json';
import expected13 from './fixtures/boundary-power-purple-parasol.expected.json';
import setup14 from './scenarios/boundary-power-red-parasol.json';
import expected14 from './fixtures/boundary-power-red-parasol.expected.json';
import setup15 from './scenarios/boundary-powers-coop-revival.json';
import expected15 from './fixtures/boundary-powers-coop-revival.expected.json';
export const boundaryCases=[
 [setup0 as ArcadeScenario,expected0],
 [setup1 as ArcadeScenario,expected1],
 [setup2 as ArcadeScenario,expected2],
 [setup3 as ArcadeScenario,expected3],
 [setup4 as ArcadeScenario,expected4],
 [setup5 as ArcadeScenario,expected5],
 [setup6 as ArcadeScenario,expected6],
 [setup7 as ArcadeScenario,expected7],
 [setup8 as ArcadeScenario,expected8],
 [setup9 as ArcadeScenario,expected9],
 [setup10 as ArcadeScenario,expected10],
 [setup11 as ArcadeScenario,expected11],
 [setup12 as ArcadeScenario,expected12],
 [setup13 as ArcadeScenario,expected13],
 [setup14 as ArcadeScenario,expected14],
 [setup15 as ArcadeScenario,expected15],
] as const;
