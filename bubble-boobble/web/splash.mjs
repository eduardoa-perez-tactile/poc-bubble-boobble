/** Reflect the engine's loading status without taking over its launch lifecycle. */
export function installSplash(document = globalThis.document) {
  const launch = document.querySelector('#launch');
  const status = document.querySelector('#status');
  const start = document.querySelector('#start');
  const progress = document.querySelector('#load-progress');
  if (!launch || !status || !start || !progress) throw new Error('Browser splash is missing a required engine element.');
  const update = () => {
    if (launch.hidden) return;
    // fail() hides Start; only the engine can declare readiness or a failure.
    const phase = start.hidden ? 'error' : start.disabled ? 'loading' : 'ready';
    launch.dataset.phase = phase;
    progress.hidden = phase === 'error';
    if (phase === 'ready') progress.value = 1;
    else {
      const files = /^Loading game (\d+)\/(\d+)$/.exec(status.textContent ?? '');
      if (files && Number(files[2]) > 0) progress.value = Math.min(1, Number(files[1]) / Number(files[2]));
      else progress.removeAttribute('value');
    }
  };
  const observer = new MutationObserver(update);
  observer.observe(status, { childList: true, characterData: true, subtree: true });
  observer.observe(start, { attributes: true, attributeFilter: ['disabled', 'hidden'] });
  observer.observe(launch, { attributes: true, attributeFilter: ['hidden'] });
  update();
  return () => observer.disconnect();
}
