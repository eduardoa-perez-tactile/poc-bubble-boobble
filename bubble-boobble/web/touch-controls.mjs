/** Browser-only pointer state; changes reach the sim as recorded controller input. */
export class VirtualPad {
  constructor() { this.pointers = new Map(); this.stick = null; }
  press(id, button) { this.pointers.set(id, button); }
  beginStick(id, x, y) {
    if (this.stick) return false;
    this.stick = { id, x, y, dx: 0, dy: 0 };
    return true;
  }
  moveStick(id, x, y) {
    if (this.stick?.id !== id) return false;
    const dx = x - this.stick.x, dy = y - this.stick.y;
    const distance = Math.hypot(dx, dy), scale = distance > 32 ? 32 / distance : 1;
    this.stick.dx = dx * scale;
    this.stick.dy = dy * scale;
    return true;
  }
  axis(axis) { return axis === 0 && this.stick ? this.stick.dx / 32 : 0; }
  release(id) {
    this.pointers.delete(id);
    if (this.stick?.id === id) this.stick = null;
  }
  reset() { this.pointers.clear(); this.stick = null; }
  down(button) {
    for (const held of this.pointers.values()) if (held === button) return true;
    return false;
  }
}

export function installTouchControls(canvas, onChange) {
  const pad = new VirtualPad();
  const panel = document.createElement('nav');
  panel.id = 'touch-controls';
  panel.setAttribute('aria-label', 'Player one touch controls');
  panel.hidden = true;
  panel.innerHTML = `<div class="touch-zone" aria-label="Press and drag to move">
    <div class="touch-stick" hidden><div class="touch-nub"></div></div>
  </div><button class="touch-pause" data-pad="6" aria-label="Pause">Ⅱ</button>
  <div class="touch-actions"><button data-pad="0" class="touch-jump">JUMP</button><button data-pad="2" class="touch-fire">FIRE</button></div>`;
  document.body.append(panel);
  const zone = panel.querySelector('.touch-zone');
  const stick = panel.querySelector('.touch-stick');
  const nub = panel.querySelector('.touch-nub');
  const buttons = panel.querySelectorAll('button');
  const available = matchMedia('(any-pointer: coarse)');
  const launch = document.querySelector('#launch');
  let playing = false;
  const paint = () => {
    stick.hidden = !pad.stick;
    if (!pad.stick) return;
    stick.style.left = `${pad.stick.x}px`;
    stick.style.top = `${pad.stick.y}px`;
    nub.style.transform = `translate(${pad.stick.dx}px, ${pad.stick.dy}px)`;
  };
  const reset = () => {
    pad.reset();
    paint();
    onChange(pad);
    for (const button of buttons) button.classList.remove('held');
  };
  const update = () => {
    panel.hidden = !(playing && available.matches && !!launch?.hidden && !document.hidden && !document.querySelector('#browser-fullscreen')?.open);
    if (panel.hidden) reset();
  };
  const position = event => {
    const rect = zone.getBoundingClientRect();
    return [event.clientX - rect.left, event.clientY - rect.top];
  };
  zone.addEventListener('pointerdown', event => {
    if (panel.hidden || event.button !== 0) return;
    const [x, y] = position(event);
    if (!pad.beginStick(event.pointerId, x, y)) return;
    event.preventDefault();
    canvas.focus({preventScroll:true});
    zone.setPointerCapture(event.pointerId);
    paint();
    onChange(pad);
  });
  zone.addEventListener('pointermove', event => {
    const [x, y] = position(event);
    if (!pad.moveStick(event.pointerId, x, y)) return;
    event.preventDefault();
    paint();
    onChange(pad);
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) zone.addEventListener(type, event => {
    if (pad.stick?.id !== event.pointerId) return;
    pad.release(event.pointerId);
    paint();
    onChange(pad);
  });
  for (const button of buttons) {
    button.addEventListener('pointerdown', event => {
      if (event.button !== 0 || panel.hidden) return;
      event.preventDefault();
      canvas.focus({preventScroll:true});
      button.setPointerCapture(event.pointerId);
      pad.press(event.pointerId, Number(button.dataset.pad));
      button.classList.add('held');
      onChange(pad);
    });
    const release = event => {
      pad.release(event.pointerId);
      onChange(pad);
      button.classList.toggle('held', pad.down(Number(button.dataset.pad)));
    };
    for (const name of ['pointerup','pointercancel','lostpointercapture']) button.addEventListener(name, release);
  }
  panel.addEventListener('contextmenu', event => event.preventDefault());
  canvas.addEventListener('blur', reset);
  window.addEventListener('blur', reset);
  window.addEventListener('resize', reset);
  document.addEventListener('visibilitychange', update);
  document.addEventListener('bubble-visibility', update);
  available.addEventListener('change', update);
  new MutationObserver(update).observe(launch, {attributes:true,attributeFilter:['hidden']});
  update();
  return { pad, reset, setPlaying(value) { if (playing !== value) { playing = value; reset(); update(); } } };
}
