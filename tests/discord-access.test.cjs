const {test}=require('node:test'),assert=require('node:assert/strict');
const access=require('../tools/discord-access.cjs');
const guild='111111111111111111',role='222222222222222222',otherRole='333333333333333333',user='444444444444444444';
test('community authorization requests identity and own membership scopes only',()=>{assert.deepEqual(access.scopes,['identify','guilds.members.read']);});
test('missing community or malformed role configuration never grants access',()=>{
  for(const config of [{},{guildId:'not-a-server'},{guildId:guild,roleIds:['wrong']},{guildId:guild,roleMode:'invalid'}])assert.equal(access.evaluate({roles:[]},access.policy(config)).allowed,false);
});
test('membership-only and optional any/all role policies stay separate',()=>{
  assert.equal(access.evaluate({roles:[]},access.policy({guildId:guild})).allowed,true);
  const any=access.policy({guildId:guild,roleIds:[role,otherRole]});assert.equal(access.evaluate({roles:[role]},any).allowed,true);assert.equal(access.evaluate({roles:[]},any).reason,'missing-role');
  const all=access.policy({guildId:guild,roleIds:[role,otherRole],roleMode:'all'});assert.equal(access.evaluate({roles:[role]},all).allowed,false);assert.equal(access.evaluate({roles:[role,otherRole]},all).allowed,true);
});
test('malformed, pending or mismatched member responses cannot authorize a user',()=>{
  const config=access.policy({guildId:guild});for(const member of [null,{},[],{roles:['not-a-role']},{roles:[],pending:true},{roles:[],user:{id:'another-user'}}])assert.equal(access.evaluate(member,config,user).allowed,false);
});
test('verification queries only the official membership endpoint and does not expose its bearer token',async()=>{
  let call;const result=await access.verify({accessToken:'SYNTHETIC-TOKEN',requirements:access.policy({guildId:guild,roleIds:[role]}),userId:user,fetcher:async(url,options)=>{call={url,options};return Response.json({user:{id:user},roles:[role]});}});
  assert.equal(result.allowed,true);assert.equal(call.url,'https://discord.com/api/v10/users/@me/guilds/'+guild+'/member');assert.equal(call.options.headers.Authorization,'Bearer SYNTHETIC-TOKEN');assert.ok(call.options.signal);assert.doesNotMatch(JSON.stringify(result),/SYNTHETIC-TOKEN|Bearer/);
});
test('expired authorization, missing membership and API failures deny access without retries',async()=>{
  for(const [status,reason]of [[401,'login-expired'],[403,'permission-denied'],[404,'not-member'],[429,'rate-limited'],[500,'unavailable']]){let calls=0;const result=await access.verify({accessToken:'SYNTHETIC-TOKEN',requirements:access.policy({guildId:guild}),fetcher:async()=>{calls++;return new Response('',{status});}});assert.equal(result.allowed,false);assert.equal(result.reason,reason);assert.equal(calls,1);}
});
test('cancellation makes no follow-up calls and malformed JSON never opens the gate',async()=>{
  const controller=new AbortController();controller.abort();let calls=0;const config={accessToken:'SYNTHETIC-TOKEN',requirements:access.policy({guildId:guild}),fetcher:async()=>{calls++;return new Response('not JSON');}};
  assert.equal((await access.verify({...config,signal:controller.signal})).reason,'cancelled');assert.equal(calls,0);assert.equal((await access.verify(config)).allowed,false);assert.equal(calls,1);
});
