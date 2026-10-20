import { installTouchControls } from './touch-controls.mjs';
/** Browser input is translated to recorded engine events; game state stays in the engine. */
export class GamepadBridge {
  constructor(send, count = 10) {
    this.send = send;
    this.slots = Array(count).fill(null);
    this.previous = Array.from({length:count},()=>({buttons:new Map(),axes:[0,0]}));
  }
  poll(devices, enabled = true, force = false, virtual = null) {
    const pads = Array.from(devices ?? []).filter(p=>p?.connected && p.mapping==='standard').sort((a,b)=>a.index-b.index);
    for(let seat=0;seat<this.slots.length;seat++) if(!pads.some(p=>p.index===this.slots[seat])) this.slots[seat]=null;
    for(const pad of pads) if(!this.slots.includes(pad.index)) {const free=this.slots.indexOf(null);if(free>=0)this.slots[free]=pad.index;}
    for(let seat=0;seat<this.slots.length;seat++) {
      const pad=enabled?pads.find(p=>p.index===this.slots[seat]):null;
      const old=this.previous[seat];
      // W3C standard buttons -> SDL3 A/B/X/Y, Start and D-pad used by the game.
      for(const [physical,canonical] of [[0,0],[1,1],[2,2],[3,3],[9,6],[12,11],[13,12],[14,13],[15,14]]) {
        const down=!!pad?.buttons[physical]?.pressed || (enabled && seat===0 && !!virtual?.down(canonical));
        if(down!==(old.buttons.get(canonical)??false)||force)this.send([5,seat,0,0,0,canonical,null,Number(down),0]);
        old.buttons.set(canonical,down);
      }
      for(let axis=0;axis<2;axis++) {
        const analog=Number(pad?.axes[axis])||0;
        const dpad=axis===0?Number(!!pad?.buttons[15]?.pressed)-Number(!!pad?.buttons[14]?.pressed):Number(!!pad?.buttons[13]?.pressed)-Number(!!pad?.buttons[12]?.pressed);
        const physical=Math.abs(dpad)>Math.abs(analog)?dpad:analog;
        const touch=enabled&&seat===0?(virtual?.axis(axis)??0):0;
        const raw=Math.abs(touch)>Math.abs(physical)?touch:physical;
        const value=Math.abs(raw)<.25?0:Math.max(-1,Math.min(1,raw));
        if(value!==old.axes[axis]||force)this.send([6,seat,0,value,0,axis,null,0,0]);
        old.axes[axis]=value;
      }
    }
    return this.slots.filter(p=>p!==null).length;
  }
}

/** Local online menus release mapped input and require a fresh press when resumed. */
export class OnlineControlGate {
  constructor(reset) { this.reset=reset;this.online=false;this.playing=false;this.held=new Set();this.blocked=new Set();this.padNeutral=false; }
  set(online,playing) {
    if(this.online===online&&this.playing===playing)return;
    this.online=online;this.playing=playing;
    if(online&&!playing){for(const key of this.held)this.blocked.add(key);this.padNeutral=true;this.reset();}
    if(!online){this.blocked.clear();this.padNeutral=false;}
  }
  suspend() { if(this.online){for(const key of this.held)this.blocked.add(key);this.padNeutral=true;}this.reset(); }
  key(code,down) {
    const gameplay=/^(Arrow(Left|Right|Up|Down)|Key[WASDJ]|Space|ControlLeft|ControlRight)$/.test(code);
    if(!gameplay)return false;
    if(!down){this.held.delete(code);this.blocked.delete(code);return false;}
    this.held.add(code);
    if(this.online&&!this.playing)this.blocked.add(code);
    return this.online&&(!this.playing||this.blocked.has(code));
  }
  padsAllowed(devices) {
    if(this.online&&!this.playing)return false;
    if(this.online&&this.padNeutral){
      const held=Array.from(devices??[]).some(p=>p?.connected&&(p.buttons.some(b=>b.pressed)||p.axes.some(v=>Math.abs(v)>=.25)));
      if(held)return false;
      this.padNeutral=false;
    }
    return true;
  }
}

export function installControls(canvas,queue) {
  const bridge=new GamepadBridge(event=>queue.push(event));
  const gate=new OnlineControlGate(()=>queue.reset());

  const dialog=document.createElement('dialog');dialog.id='browser-fullscreen';
  dialog.innerHTML='<h2>Fullscreen</h2><p>Make more room for bubbles.</p><button id="enter-fullscreen">ENTER FULLSCREEN</button> <button id="close-fullscreen">BACK</button><p id="fullscreen-status" role="status"></p>';
  document.body.append(dialog);
  const share=document.createElement('dialog');share.id='browser-invitation';
  share.innerHTML='<h2>Invite dragons</h2><p>Share this link. Everyone must join before the match starts.</p><input id="invitation-url" readonly aria-label="Invitation link"><p><button id="copy-invitation">COPY LINK</button> <button id="close-invitation">BACK</button></p><p id="invitation-status" role="status"></p>';
  document.body.append(share);
  share.querySelector('#close-invitation').onclick=()=>share.close();
  share.addEventListener('close',()=>{canvas.focus();wake();});
  share.querySelector('#copy-invitation').onclick=async()=>{
    const field=share.querySelector('#invitation-url');field.select();
    try{await navigator.clipboard.writeText(field.value);share.querySelector('#invitation-status').textContent='Link copied.';}
    catch{share.querySelector('#invitation-status').textContent='Select and copy the link above.';}
  };
  const poll=pad=>{const devices=navigator.getGamepads?.()??[];return bridge.poll(devices,gate.padsAllowed(devices)&&!dialog.open&&!share.open&&!document.hidden&&document.hasFocus()&&document.activeElement===canvas,queue.resetPending,pad);};
  const touch=installTouchControls(canvas,poll);
  const wake=()=>document.dispatchEvent(new Event('bubble-visibility'));
  const open=()=>{if(dialog.open)return;touch.reset();queue.reset();dialog.querySelector('#enter-fullscreen').textContent=document.fullscreenElement?'EXIT FULLSCREEN':'ENTER FULLSCREEN';dialog.showModal();wake();};
  Object.defineProperty(globalThis,'__bubbleBrowser',{value:Object.freeze({protocol:1})});
  window.addEventListener('message',event=>{
    if(event.origin!==location.origin||!Array.from(document.querySelectorAll('iframe')).some(frame=>frame.contentWindow===event.source))return;
    if(event.data?.type!=='bubble-browser-v1')return;
    if(event.data.action==='fullscreen')open();
    if(event.data.action==='invitation'&&typeof event.data.url==='string'){
      let link;try{link=new URL(event.data.url);}catch{return;}
      if(link.origin!==location.origin)return;
      touch.reset();queue.reset();share.querySelector('#invitation-url').value=link.href;
      share.querySelector('#invitation-status').textContent='';if(!share.open)share.showModal();wake();
    }
    if(event.data.action==='screen'&&typeof event.data.screen==='string'){gate.set(event.data.online===true,event.data.screen==='play');touch.setPlaying(event.data.screen==='play');poll(touch.pad);}
  });
  dialog.querySelector('#close-fullscreen').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>{canvas.focus();wake();});
  dialog.querySelector('#enter-fullscreen').onclick=async()=>{
    dialog.close();
    try {if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();canvas.focus();}
    catch {dialog.showModal();dialog.querySelector('#fullscreen-status').textContent='Fullscreen is unavailable in this browser. Choose BACK to continue.';wake();}
  };
  canvas.addEventListener('keydown',event=>{
    if(event.code==='F11'){event.preventDefault();event.stopImmediatePropagation();if(!event.repeat)open();}
  },true);
  window.addEventListener('keydown',event=>{if(gate.key(event.code,true)){event.preventDefault();event.stopImmediatePropagation();}},true);
  window.addEventListener('keyup',event=>gate.key(event.code,false),true);
  window.addEventListener('blur',()=>{if(gate.online){gate.suspend();touch.reset();}else queue.reset();});
  return {
    hidden:()=>document.hidden||dialog.open||share.open,
    poll(){poll(touch.pad);},
  };
}
