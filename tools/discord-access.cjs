/* Server-side eligibility checks. No frontend flags, user tokens or app secrets are trusted. */
'use strict';
const snowflake=value=>typeof value==='string'&&/^[0-9]{15,20}$/.test(value);
const scopes=Object.freeze(['identify','guilds.members.read']);
function policy({guildId,roleIds=[],roleMode='any'}={}){
  if(!snowflake(guildId))return {configured:false,reason:'missing-guild'};
  if(!Array.isArray(roleIds)||roleIds.length>50||!roleIds.every(snowflake)||!['any','all'].includes(roleMode))return {configured:false,reason:'invalid-roles'};
  return {configured:true,guildId,roleIds:[...new Set(roleIds)],roleMode};
}
function evaluate(member,requirements,userId){
  if(!requirements?.configured||!policy(requirements).configured)return {allowed:false,reason:'not-configured'};
  if(!member||typeof member!=='object'||!Array.isArray(member.roles)||!member.roles.every(snowflake))return {allowed:false,reason:'invalid-member'};
  if(userId&&member.user?.id!==userId)return {allowed:false,reason:'wrong-user'};
  if(member.pending===true)return {allowed:false,reason:'membership-pending'};
  const needed=requirements.roleIds;
  const matches=needed.map(role=>member.roles.includes(role));
  if(needed.length&&!(requirements.roleMode==='all'?matches.every(Boolean):matches.some(Boolean)))return {allowed:false,reason:'missing-role'};
  return {allowed:true,reason:needed.length?'role-verified':'membership-verified'};
}
async function verify({accessToken,requirements,userId,signal,fetcher=fetch}){
  if(!requirements?.configured||!snowflake(requirements.guildId))return {allowed:false,reason:'not-configured'};
  if(typeof accessToken!=='string'||!accessToken||accessToken.length>4096)return {allowed:false,reason:'missing-token'};
  if(signal?.aborted)return {allowed:false,reason:'cancelled'};
  const controller=new AbortController(),abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});
  const timer=setTimeout(abort,10000);
  try{
    const response=await fetcher('https://discord.com/api/v10/users/@me/guilds/'+requirements.guildId+'/member',{method:'GET',headers:{Accept:'application/json',Authorization:'Bearer '+accessToken},signal:controller.signal,redirect:'error'});
    if(controller.signal.aborted)return {allowed:false,reason:signal?.aborted?'cancelled':'unavailable'};
    if(!response.ok)return {allowed:false,reason:({401:'login-expired',403:'permission-denied',404:'not-member',429:'rate-limited'})[response.status]||'unavailable'};
    const body=await response.json();if(controller.signal.aborted)return {allowed:false,reason:signal?.aborted?'cancelled':'unavailable'};
    return evaluate(body,requirements,userId);
  }catch(error){return {allowed:false,reason:signal?.aborted?'cancelled':'unavailable'};}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
module.exports={policy,evaluate,verify,scopes};
