/** Browser input is translated to recorded engine events; game state stays in the engine. */
export class GamepadBridge {
  constructor(send, count = 10) {
    this.send = send;
    this.slots = Array(count).fill(null);
    this.previous = Array.from({length:count},()=>({buttons:new Map(),axes:[0,0]}));
  }
  poll(devices, enabled = true, force = false) {
    const pads = Array.from(devices ?? []).filter(p=>p?.connected && p.mapping==='standard').sort((a,b)=>a.index-b.index);
    for(let seat=0;seat<this.slots.length;seat++) if(!pads.some(p=>p.index===this.slots[seat])) this.slots[seat]=null;
    for(const pad of pads) if(!this.slots.includes(pad.index)) {const free=this.slots.indexOf(null);if(free>=0)this.slots[free]=pad.index;}
    for(let seat=0;seat<this.slots.length;seat++) {
      const pad=enabled?pads.find(p=>p.index===this.slots[seat]):null;
      const old=this.previous[seat];
      // W3C standard buttons -> SDL3 A/B/X/Y, Start and D-pad used by the game.
      for(const [physical,canonical] of [[0,0],[1,1],[2,2],[3,3],[9,6],[12,11],[13,12],[14,13],[15,14]]) {
        const down=!!pad?.buttons[physical]?.pressed;
        if(down!==(old.buttons.get(canonical)??false)||force)this.send([5,seat,0,0,0,canonical,null,Number(down),0]);
        old.buttons.set(canonical,down);
      }
      for(let axis=0;axis<2;axis++) {
        const raw=Number(pad?.axes[axis])||0;
        const value=Math.abs(raw)<.25?0:Math.max(-1,Math.min(1,raw));
        if(value!==old.axes[axis]||force)this.send([6,seat,0,value,0,axis,null,0,0]);
        old.axes[axis]=value;
      }
    }
    return this.slots.filter(p=>p!==null).length;
  }
}

export function installControls(canvas,queue) {
  const bridge=new GamepadBridge(event=>queue.push(event));
  const dialog=document.createElement('dialog');dialog.id='browser-fullscreen';
  dialog.innerHTML='<h2>Fullscreen</h2><p>Make more room for bubbles.</p><button id="enter-fullscreen">ENTER FULLSCREEN</button> <button id="close-fullscreen">BACK</button><p id="fullscreen-status" role="status"></p>';
  document.body.append(dialog);
  const wake=()=>document.dispatchEvent(new Event('bubble-visibility'));
  const open=()=>{if(dialog.open)return;queue.reset();dialog.querySelector('#enter-fullscreen').textContent=document.fullscreenElement?'EXIT FULLSCREEN':'ENTER FULLSCREEN';dialog.showModal();wake();};
  Object.defineProperty(globalThis,'__bubbleBrowser',{value:Object.freeze({protocol:1})});
  window.addEventListener('message',event=>{
    if(event.origin!==location.origin||!Array.from(document.querySelectorAll('iframe')).some(frame=>frame.contentWindow===event.source))return;
    if(event.data?.type==='bubble-browser-v1'&&event.data.action==='fullscreen')open();
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
  window.addEventListener('blur',()=>queue.reset());
  return {
    hidden:()=>document.hidden||dialog.open,
    poll(){bridge.poll(navigator.getGamepads?.()??[],!dialog.open&&!document.hidden&&document.hasFocus()&&document.activeElement===canvas,queue.resetPending);},
  };
}
