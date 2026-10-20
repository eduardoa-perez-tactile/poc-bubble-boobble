/**
 * Emscripten 6.0.10 fd_sync uses Asyncify, which cannot unwind the engine's nested
 * wasm -> game JS -> wasm service call. IDBFS autoPersist already schedules durable
 * writes asynchronously after filesystem mutations. A browser fsync therefore
 * acknowledges the synchronous memory flush; IndexedDB completes outside the wasm call.
 * Patch only this exported loader, never the installed SDK or shared source checkout.
 */
export function browserSaveCompatibility(source, engineVersion='0.1.13') {
  // 0.1.14 introduced engine-owned browser persistence and flush completion.
  // Keep that implementation intact; this workaround is only for the old SDK.
  if(engineVersion!=='0.1.13')return source;
  const begin='var _fd_sync=function(fd){';
  const end=';_fd_sync.isAsync=true;';
  const start=source.indexOf(begin),stop=source.indexOf(end,start);
  if(start<0||stop<0||!source.slice(start,stop).includes('return Asyncify.handleAsync(innerFunc)'))throw Error('Pinned Emscripten fd_sync changed; review browser save compatibility.');
  return source.slice(0,start)+`var _fd_sync=function(fd){try{var stream=SYSCALLS.getStreamFromFD(fd);return stream.stream_ops?.fsync?.(stream)||0}catch(e){if(!(e.name==="ErrnoError"))throw e;return e.errno}};_fd_sync.isAsync=false;`+source.slice(stop+end.length);
}
