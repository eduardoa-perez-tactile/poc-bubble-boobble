// The pinned SDK coalesces complete world snapshots after polling. A suspended
// browser cannot poll, so this game-owned boundary retains one exact packet
// until the SDK resumes. It parses packet metadata without inspecting or
// changing game document fields, and retains the original snapshot bytes.
const MAX_PACKET=256*1024;
const encoder=new TextEncoder(),decoder=new TextDecoder();
const ping=encoder.encode(JSON.stringify({kind:'ping'}));
function bytes(value){
  if(typeof value==='string')return value.length<=MAX_PACKET?encoder.encode(value):null;
  if(value instanceof ArrayBuffer)return value.byteLength<=MAX_PACKET?new Uint8Array(value):null;
  if(ArrayBuffer.isView(value))return value.byteLength<=MAX_PACKET?new Uint8Array(value.buffer,value.byteOffset,value.byteLength):null;
  return null;
}
export function createWorldBackgroundTransport({factory,hidden,decode}){
  const entries=new Set();let disposed=false;
  function create(url,protocols){
    if(disposed)throw new Error('Background transport disposed');
    const socket=factory(url,protocols);
    let world=false,closed=false,latest=null,latestTick=-1;
    const handlers={onopen:null,onmessage:null,onerror:null,onclose:null};
    const deliver=event=>handlers.onmessage?.(event);
    const clear=()=>{latest=null;latestTick=-1;};
    const entry={flush(){if(closed||hidden()||!latest)return;const data=latest;clear();deliver({data:data.buffer});},dispose(){closed=true;clear();entries.delete(entry);}};
    entries.add(entry);
    const wrapper={
      get binaryType(){return socket.binaryType;},set binaryType(value){socket.binaryType=value;},
      get readyState(){return socket.readyState;},get bufferedAmount(){return socket.bufferedAmount;},
      send(data){
        if(!world&&!closed){
          try{const value=bytes(data),hello=value&&JSON.parse(decoder.decode(value));
            world=hello?.kind==='hello'&&hello.version===1&&typeof hello.game==='string'&&typeof hello.build==='string'&&typeof hello.name==='string';
          }catch{/* Generic traffic follows the unmodified SDK path. */}
        }
        return socket.send(data);
      },
      close(...args){entry.dispose();return socket.close(...args);},
    };
    for(const key of Object.keys(handlers))Object.defineProperty(wrapper,key,{get:()=>handlers[key],set:value=>{handlers[key]=value;}});
    socket.onopen=event=>handlers.onopen?.(event);
    socket.onerror=event=>handlers.onerror?.(event);
    socket.onclose=event=>{entry.dispose();handlers.onclose?.(event);};
    socket.onmessage=event=>{
      if(closed)return;
      if(!world||!hidden()){entry.flush();deliver(event);return;}
      let messages;
      try{
        const value=bytes(event.data);if(!value||value.byteLength>MAX_PACKET){deliver(event);return;}
        // Use the pinned SDK batch decoder. Parse all metadata before changing
        // anything, so malformed traffic reaches the SDK once for validation.
        messages=decode(value).map(data=>({data,value:JSON.parse(decoder.decode(data))}));
      }catch{deliver(event);return;}
      for(const message of messages){
        const value=message.value;
        if(value?.kind==='snapshot'&&Number.isSafeInteger(value.tick)&&value.tick>=0&&Object.hasOwn(value,'document')){
          if(value.tick>=latestTick){latest=message.data.slice();latestTick=value.tick;}
        }else if(value?.kind==='ping'){
          // The server requires this protocol heartbeat even while WASM is
          // suspended. No input sequence, ownership, or gameplay is fabricated.
          if(socket.readyState===1&&socket.bufferedAmount+ping.byteLength<=1024*1024){try{socket.send(ping);}catch{/* Native close/error still reaches the SDK. */}}
        }else if(value?.kind!=='pong')deliver({data:message.data.slice().buffer});
      }
    };
    return wrapper;
  }
  return {create,flush(){for(const entry of entries)entry.flush();},dispose(){disposed=true;for(const entry of entries)entry.dispose();}};
}
