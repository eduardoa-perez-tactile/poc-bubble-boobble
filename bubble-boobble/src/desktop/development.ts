import { DEV } from '@gameengine/runtime';
import { DEVELOPMENT_BUILD } from './build-flags';

/** Presentation-only capability: record through DesktopIntent before the sim uses it. */
export const developmentMenuEnabled = DEV || DEVELOPMENT_BUILD;
