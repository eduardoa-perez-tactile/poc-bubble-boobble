import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer,request} from 'node:http';
import {once} from 'node:events';
import {guardRequest} from './bridge-http.mjs';

test('aborted authenticated request body leaves bridge responsive',async()=>{
 let reading;
 const started=new Promise(resolve=>{reading=resolve;});
 let rejected;
 const caught=new Promise(resolve=>{rejected=resolve;});
 const server=createServer(guardRequest(async(req,res)=>{
  if(req.method==='GET'){res.end('healthy');return;}
  assert.equal(req.headers.authorization,'Bearer test-token');
  try {for await(const chunk of req){reading();}}catch(error){rejected();throw error;}
  res.end('accepted');
 }));
 server.listen(0,'127.0.0.1');await once(server,'listening');
 const port=server.address().port;
 try{
  const post=request({host:'127.0.0.1',port,method:'POST',headers:{authorization:'Bearer test-token','content-length':1000}});
  post.on('error',()=>{});post.write('{');await started;post.destroy();await caught;
  // Allow the rejected async listener to settle; node:test fails on unhandled rejection.
  await new Promise(resolve=>setImmediate(resolve));
  const health=await fetch(`http://127.0.0.1:${port}/health`);
  assert.equal(health.status,200);assert.equal(await health.text(),'healthy');
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
