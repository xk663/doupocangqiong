const test=require('node:test'),assert=require('node:assert/strict');const {createServer}=require('../tools/serve.cjs');
async function start(t,fetcher){const server=createServer({fetcher});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);}));return {base:'http://127.0.0.1:'+server.address().port,server};}
test('local relay forwards native headers and streaming bytes to a fixed upstream without storing credentials',async t=>{
 let sent;const{base}=await start(t,async(url,opts)=>{sent={url,...opts};return new Response('data: {"ok":true}\n\n',{headers:{'content-type':'text/event-stream'}});});
 const response=await fetch(base+'/__gemini_proxy/v1beta/models/gemini-3.8-flash:streamGenerateContent?alt=sse',{method:'POST',headers:{'content-type':'application/json','x-goog-api-key':'TEST-ONLY'},body:'{"contents":[]}'});assert.equal(response.status,200);assert.equal(await response.text(),'data: {"ok":true}\n\n');assert.equal(sent.url,'http://localhost:8080/v1beta/models/gemini-3.8-flash:streamGenerateContent?alt=sse');assert.equal(sent.headers['x-goog-api-key'],'TEST-ONLY');assert.equal(sent.headers.Authorization,undefined);assert.equal(sent.body.toString(),'{"contents":[]}');
});
test('relay denies other origins, arbitrary destinations, sensitive paths and unsupported methods',async t=>{
 let calls=0;const{base}=await start(t,async()=>{calls++;return Response.json({models:[]});});
 assert.equal((await fetch(base+'/__gemini_proxy/v1beta/models',{headers:{Origin:'https://untrusted.example'}})).status,403);
 for(const route of ['/__gemini_proxy/https://evil.example','/__gemini_proxy/v1beta/models?target=https://evil.example','/.git/config','/a%5c..%5c.git%5cconfig'])assert.ok([400,403].includes((await fetch(base+route)).status));
 assert.equal((await fetch(base+'/__gemini_proxy/v1beta/models',{method:'DELETE'})).status,400);assert.equal(calls,0);
 const response=await fetch(base+'/__gemini_proxy/v1beta/models',{headers:{Origin:base}});assert.equal(response.status,200);assert.equal(calls,1);
});
test('relay preserves upstream errors without exposing extra headers and serves the real page',async t=>{const{base}=await start(t,async()=>Response.json({error:'unavailable'},{status:500,headers:{'x-private':'never-forward'}}));const response=await fetch(base+'/__gemini_proxy/v1beta/models');assert.equal(response.status,500);assert.equal(response.headers.get('x-private'),null);assert.equal((await response.json()).error,'unavailable');assert.equal((await fetch(base+'/index.html')).status,200);});
