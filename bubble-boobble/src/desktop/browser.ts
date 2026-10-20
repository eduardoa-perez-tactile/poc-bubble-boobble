import { WEB_BUILD } from './build-flags';
type Parent = { __bubbleBrowser?: { protocol: number }; location?: { origin?: string }; postMessage(value: unknown, origin: string): void };
function browserMessage(message: { action: string; screen?: string }): void {
 if (!WEB_BUILD) return;
 try {
  const parent = (globalThis as unknown as {parent?: Parent}).parent;
  const origin = parent?.location?.origin;
  if (parent?.__bubbleBrowser?.protocol === 1 && origin && origin !== 'null') parent.postMessage({type:'bubble-browser-v1',...message},origin);
 } catch { /* Native and sandboxed hosts have no browser shell. */ }
}

export function openBrowserFullscreen(): void { browserMessage({action:'fullscreen'}); }
/** Presentation-only: menus keep direct touch input, gameplay gets the thumb overlay. */
export function reportBrowserScreen(screen: string): void { browserMessage({action:'screen',screen}); }
