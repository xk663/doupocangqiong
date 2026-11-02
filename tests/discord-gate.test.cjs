'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const http=require('node:http');
const {configuration,createGate}=require('../tools/discord-gate.cjs');
const {createServer}=require('../tools/serve.cjs');
const access=require('../tools/discord-access.cjs');
const guild='1134557553011998840',client='111111111111111111',user='444444444444444444';
const secret='SYNTHETIC-CLIENT-SECRET',token='SYNTHETIC-ACCESS-TOKEN';
async function start(t,{member=()=>Response.json({user:{id:user},roles:[]}),tokenBody,tokenReply,clock}={}){
 const calls=[],diagnostics=[];let gate;
 const fetcher=async(url,options)=>{
  calls.push({url,options});
  if(url==='https://discord.com/api/oauth2/token')return tokenReply?tokenReply():Response.json(tokenBody||{access_token:token,token_type:'Bearer',expires_in:7200,scope:'identify guilds.members.read'});
  if(url==='https://discord.com/api/v10/users/@me')return Response.json({id:user});
  assert.equal(url,'https://discord.com/api/v10/users/@me/guilds/'+guild+'/member');
  return member();
 };
 const server=createServer({gate:(...args)=>gate(...args),enableRelay:false,fetcher:async()=>{throw Error('Relay must not be called');}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);}));
 const origin='http://127.0.0.1:'+server.address().port;
 gate=createGate({origin,clientId:client,clientSecret:secret,requirements:access.policy({guildId:guild}),fetcher,now:clock||Date.now,onDiagnostic:event=>diagnostics.push(event)});
 const get=(path,options={})=>fetch(origin+path,{redirect:'manual',...options});
 const post=path=>get(path,{method:'POST',headers:{Origin:origin}});
 async function begin(){
  const response=await post('/auth/discord/login');assert.equal(response.status,303);
  const target=new URL(response.headers.get('location'));
  const cookie=response.headers.getSetCookie()[0].split(';')[0];
  return {response,target,cookie,state:target.searchParams.get('state')};
 }
 async function complete(login=undefined){
  login??=await begin();
  const response=await get('/auth/discord/callback?'+new URLSearchParams({code:'SYNTHETIC-CODE',state:login.state}),{headers:{Cookie:login.cookie}});
  const session=response.headers.getSetCookie().find(x=>x.startsWith('doupo_discord_session='))?.split(';')[0];
  return {...login,response,session};
 }
 return {get,post,begin,complete,origin,calls,diagnostics};
}
test('configuration requires an owned application and HTTPS for public sites; owner community is the default',()=>{
 assert.throws(()=>configuration({}),/CLIENT_ID/);
 assert.throws(()=>configuration({DISCORD_CLIENT_ID:client}),/CLIENT_SECRET/);
 assert.throws(()=>configuration({DISCORD_PUBLIC_ORIGIN:'http://public.example',DISCORD_CLIENT_ID:client,DISCORD_CLIENT_SECRET:secret}),/HTTPS/);
 for(const origin of ['https://site.example/path','https://user:pass@site.example','https://site.example?x=1'])assert.throws(()=>configuration({DISCORD_PUBLIC_ORIGIN:origin,DISCORD_CLIENT_ID:client,DISCORD_CLIENT_SECRET:secret}));
 assert.equal(configuration({DISCORD_CLIENT_ID:client,DISCORD_CLIENT_SECRET:secret}).requirements.guildId,guild);
});
test('anonymous users receive a readable login page; direct assets, alternate entry pages and relay are protected',async t=>{
 const {get,calls}=await start(t);
 const page=await get('/',{headers:{Accept:'text/html'}});assert.equal(page.status,401);
 const html=await page.text();assert.match(html,/使用 Discord 登录并验证/);assert.doesNotMatch(html,/登录已过期/);
 // Native browser form submissions need a real Origin; their Discord redirect
 // must also be permitted by the login document's form-action policy.
 assert.equal(page.headers.get('referrer-policy'),'same-origin');
 assert.match(page.headers.get('content-security-policy'),/form-action 'self' https:\/\/discord\.com;/);
 for(const path of ['/index.html','/game.html','/map.html','/sillytavern.html','/assets/js/tavern-core.js','/assets/images/title-gu-reunion.webp','/__gemini_proxy/v1beta/models']){
  const response=await get(path);assert.equal(response.status,401);assert.equal(response.headers.get('cache-control'),'no-store');assert.doesNotMatch(await response.text(),/SYNTHETIC|function build/);
 }
 assert.equal(calls.length,0);
});
test('official OAuth flow binds state to this browser, sends minimal scopes and keeps tokens off the client',async t=>{
 const {begin,complete,get,origin,calls}=await start(t),login=await begin();
 assert.equal(login.target.origin,'https://discord.com');assert.equal(login.target.pathname,'/oauth2/authorize');
 assert.equal(login.target.searchParams.get('scope'),'identify guilds.members.read');
 assert.equal(login.target.searchParams.get('redirect_uri'),origin+'/auth/discord/callback');
 assert.equal(login.response.headers.get('referrer-policy'),'no-referrer');
 assert.match(login.response.headers.getSetCookie()[0],/HttpOnly; SameSite=Lax/);
 const result=await complete(login);assert.equal(result.response.headers.get('location'),'/');assert.ok(result.session);
 assert.equal(calls.length,3);
 const form=new URLSearchParams(calls[0].options.body);assert.equal(form.get('client_secret'),secret);assert.equal(form.get('grant_type'),'authorization_code');
 assert.equal(calls[2].options.headers.Authorization,'Bearer '+token);
 const headers={Cookie:result.session};
 assert.equal((await get('/index.html',{headers})).status,200);
 assert.equal((await get('/assets/js/preset-ui.js',{headers})).status,200);
 const status=await get('/auth/discord/status',{headers});assert.deepEqual(await status.json(),{authenticated:true,community:'类脑'});
 const exposed=JSON.stringify([...result.response.headers])+await result.response.text();assert.doesNotMatch(exposed,/SYNTHETIC/);
 for(const path of ['/tools/discord-gate.cjs','/tests/fixtures/presets.html','/docs/discord-community-auth.md','/index.html.bak','/.env'])assert.equal((await get(path,{headers})).status,403);
 assert.equal((await get('/__gemini_proxy/v1beta/models',{headers})).status,404);
});
test('foreign origins, forged cookies, missing state, wrong browser and consumed callbacks cannot authorize',async t=>{
 const {begin,get,complete,calls}=await start(t);
 assert.equal((await get('/auth/discord/login',{method:'POST',headers:{Origin:'https://foreign.example'}})).status,403);
 assert.equal((await get('/auth/discord/login',{method:'POST',headers:{Origin:'null'}})).status,403);
 assert.equal((await get('/auth/discord/login',{method:'POST'})).status,403);
 assert.equal((await get('/auth/discord/login')).status,405);
 assert.equal((await get('/auth/discord/status',{headers:{Cookie:'doupo_discord_session='+'x'.repeat(43)}})).status,401);
 const login=await begin();
 for(const path of ['/auth/discord/callback?code=FORGED','/auth/discord/callback?code=FORGED&state='+login.state]){
  const response=await get(path);assert.equal(response.headers.get('location'),'/auth/discord/failed?reason=session');
 }
 assert.equal(calls.length,0);
 const success=await complete(login);assert.ok(success.session);
 const replay=await complete(login);assert.equal(replay.response.headers.get('location'),'/auth/discord/failed?reason=session');assert.equal(calls.length,3);
});
test('non-members, incomplete community screening and insufficient OAuth scopes never receive a session',async t=>{
 for(const member of [()=>new Response('',{status:404}),()=>Response.json({user:{id:user},roles:[],pending:true}),()=>new Response('',{status:429}),()=>Response.json({roles:[]})]){
  const fixture=await start(t,{member});const result=await fixture.complete();
  assert.equal(result.session,undefined);assert.match(result.response.headers.get('location'),/^\/auth\/discord\/denied/);
  assert.equal((await fixture.get('/index.html')).status,401);
 }
 const fixture=await start(t,{tokenBody:{access_token:token,token_type:'Bearer',expires_in:3600,scope:'identify'}});
 assert.equal((await fixture.complete()).response.headers.get('location'),'/auth/discord/failed?reason=token');assert.equal(fixture.calls.length,1);
});
test('state expires; cancellation cleans callback URLs without network calls; login attempts are bounded',async t=>{
 let time=1000;const {begin,get,post,calls}=await start(t,{clock:()=>time});
 const cancelled=await begin();const response=await get('/auth/discord/callback?'+new URLSearchParams({error:'access_denied',state:cancelled.state}),{headers:{Cookie:cancelled.cookie}});
 assert.equal(response.headers.get('location'),'/auth/discord/cancelled');assert.equal(calls.length,0);
 const expired=await begin();time+=600001;
 assert.equal((await get('/auth/discord/callback?code=OLD&state='+expired.state,{headers:{Cookie:expired.cookie}})).headers.get('location'),'/auth/discord/failed?reason=session');
 for(let i=0;i<10;i++)assert.equal((await post('/auth/discord/login')).status,303);
 assert.equal((await post('/auth/discord/login')).status,429);assert.equal(calls.length,0);
});
test('membership is rechecked after five minutes and parallel asset loads share one check; leaving denies access',async t=>{
 let time=1000,joined=true;
 const fixture=await start(t,{clock:()=>time,member:async()=>{await new Promise(resolve=>setImmediate(resolve));return joined?Response.json({user:{id:user},roles:[]}):new Response('',{status:404});}});
 const result=await fixture.complete(),headers={Cookie:result.session};
 await fixture.get('/auth/discord/status',{headers});assert.equal(fixture.calls.length,3);
 time+=300001;
 const responses=await Promise.all(['/index.html','/assets/js/preset-ui.js','/auth/discord/status'].map(path=>fixture.get(path,{headers})));
 assert.ok(responses.every(response=>response.status===200));assert.equal(fixture.calls.length,4);
 time+=300001;joined=false;
 assert.equal((await fixture.get('/assets/js/preset-ui.js',{headers})).status,401);
 assert.equal((await fixture.get('/index.html',{headers})).status,401);assert.equal(fixture.calls.length,5);
});
test('sessions expire at one hour and logout requires a same-origin POST',async t=>{
 let time=1000;const fixture=await start(t,{clock:()=>time});const result=await fixture.complete(),headers={Cookie:result.session};
 assert.equal((await fixture.get('/auth/discord/logout',{headers})).status,405);
 assert.equal((await fixture.get('/auth/discord/logout',{method:'POST',headers:{...headers,Origin:'https://foreign.example'}})).status,403);
 assert.equal((await fixture.get('/auth/discord/logout',{method:'POST',headers:{...headers,Origin:fixture.origin}})).status,303);
 assert.equal((await fixture.get('/auth/discord/status',{headers})).status,401);
 const newer=await fixture.complete();time+=3600001;
 assert.equal((await fixture.get('/index.html',{headers:{Cookie:newer.session}})).status,401);
});
test('published server accepts only the configured host even behind a reverse proxy',async t=>{
 const server=createServer({publicOrigin:'https://app.example',gate:async(req,res)=>{res.end('gate');return true;}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);}));
 const request=host=>new Promise((resolve,reject)=>{const req=http.get({host:'127.0.0.1',port:server.address().port,headers:{Host:host}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});req.on('error',reject);});
 assert.equal(await request('app.example'),200);assert.equal(await request('other.example'),403);
});
test('callback failures identify network and application problems without exposing provider bodies or credentials',async t=>{
 const cases=[
  ['network-blocked',()=>{throw new TypeError('SENSITIVE raw failure '+secret,{cause:{code:'EACCES'}});},/运行环境拒绝/],
  ['network',()=>{throw new Error('SENSITIVE network address '+token);},/无法连接 Discord/],
  ['client',()=>Response.json({error:'invalid_client',error_description:secret},{status:401}),/应用凭据未通过/],
  ['grant',()=>Response.json({error:'invalid_grant',error_description:'SYNTHETIC-CODE'},{status:400}),/授权码已失效/],
  ['provider',()=>new Response(secret,{status:503}),/暂时无法完成授权/],
  ['token',()=>new Response('SENSITIVE invalid JSON '+token),/没有返回所需的登录权限/]
 ];
 for(const [reason,tokenReply,message]of cases){
  const fixture=await start(t,{tokenReply}),result=await fixture.complete();
  assert.equal(result.session,undefined);assert.equal(result.response.headers.get('location'),'/auth/discord/failed?reason='+reason);
  const page=await fixture.get(result.response.headers.get('location'));
  const html=await page.text();assert.match(html,message);
  assert.deepEqual(fixture.diagnostics,[{event:'authorization-failed',reason,...(['network','network-blocked'].includes(reason)?{stage:'token'}:{}),...(reason==='network-blocked'?{networkCode:'EACCES'}:{})}]);
  assert.doesNotMatch(html+JSON.stringify(fixture.diagnostics)+JSON.stringify([...result.response.headers]),/SENSITIVE|SYNTHETIC|Bearer/);
  assert.equal((await fixture.get('/index.html')).status,401);
 }
});
