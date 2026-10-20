import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { browserSaveCompatibility } from './save-compat.mjs';
test('browser file flush stays synchronous and preserves filesystem errors',()=>{
 const original='var _fd_sync=function(fd){return Asyncify.handleAsync(innerFunc)};_fd_sync.isAsync=true;';
 let flushed=0;
 const scope={SYSCALLS:{getStreamFromFD(fd){if(fd===9)throw {name:'ErrnoError',errno:8};return {stream_ops:{fsync(){flushed++;}}};}}};
 runInNewContext(browserSaveCompatibility(original),scope);
 assert.equal(scope._fd_sync(1),0);assert.equal(flushed,1);assert.equal(scope._fd_sync(9),8);
 assert.equal(scope._fd_sync.isAsync,false);
});
test('unknown loader refuses the compatibility patch',()=>{
 assert.throws(()=>browserSaveCompatibility('new loader'),/changed/);
});
test('current SDK keeps engine-owned browser persistence untouched',()=>{
 const source='var _fd_sync=function(fd){return Asyncify.handleAsync(innerFunc)};_fd_sync.isAsync=true;';
 for(const version of ['0.1.14','0.1.15'])assert.equal(browserSaveCompatibility(source,version),source);
});
