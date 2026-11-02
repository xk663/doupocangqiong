/* Discord OAuth and community access live on the server. Nothing is persisted to game storage. */
'use strict';
const {randomBytes}=require('node:crypto');
const access=require('./discord-access.cjs');
const random=()=>randomBytes(32).toString('base64url');
const opaque=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{43}$/.test(value);
const snowflake=value=>typeof value==='string'&&/^[0-9]{15,20}$/.test(value);
// Community ID supplied by the owner. No role restriction is requested.
const defaultGuildId='1134557553011998840';
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const reasons={
 'login-required':'请使用 Discord 登录，加入类脑社区并通过验证后进入。',
 'not-member':'当前账号尚未加入类脑社区。请确认社区和登录账号，加入后重新验证。',
 'membership-pending':'尚未完成社区的成员筛选，请在 Discord 内完成后重新验证。',
 'login-expired':'登录已过期，请重新授权。',
 'permission-denied':'没有取得社区成员读取权限，请重新授权。',
 'rate-limited':'Discord 暂时限制了查询频率，请稍后重试。',
 unavailable:'暂时无法向 Discord 核验成员资格，请稍后重试。'
};
// Only fixed error categories cross the server boundary. Never log provider bodies,
// authorization codes, cookies, client secrets or user access tokens.
const failures={
 session:'授权会话已过期或浏览器校验未通过，请重新点击下方按钮登录。',
 code:'授权回调缺少有效的授权码，请重新登录。',
 network:'服务端无法连接 Discord，请检查服务器网络或代理后重新登录。',
 'network-blocked':'服务端访问 Discord 被运行环境拒绝，请让维护者检查联网权限后重新登录。',
 client:'Discord 应用凭据未通过验证，请让维护者核对本机应用 ID 与 Client Secret。',
 grant:'Discord 授权码已失效或回调地址不一致，请核对回调配置并重新登录。',
 provider:'Discord 暂时无法完成授权，请稍后重新登录。',
 token:'Discord 没有返回所需的登录权限，请重新登录并确认身份与社区成员读取权限。',
 identity:'未能核验 Discord 登录身份，请重新登录。',
 capacity:'服务器登录会话已满，请稍后重新登录。',
 unknown:'Discord 授权未完成，请重新登录；若持续出现，请联系站点维护者。'
};
const networkCodes=new Set(['EACCES','EPERM','ENOTFOUND','EAI_AGAIN','ECONNRESET','ECONNREFUSED','ETIMEDOUT','UND_ERR_CONNECT_TIMEOUT','UND_ERR_HEADERS_TIMEOUT','UND_ERR_SOCKET','ERR_TLS_CERT_ALTNAME_INVALID','CERT_HAS_EXPIRED','DEPTH_ZERO_SELF_SIGNED_CERT','TIMEOUT']);
class DiscordFailure extends Error{constructor(reason,stage,networkCode){super('Discord authorization failed');this.reason=reason;this.stage=stage;this.networkCode=networkCode;}}
function configuration(env=process.env){
 const origin=new URL(env.DISCORD_PUBLIC_ORIGIN||'http://127.0.0.1:8090');
 if(origin.username||origin.password||origin.search||origin.hash||origin.pathname!=='/'||!['http:','https:'].includes(origin.protocol))throw Error('DISCORD_PUBLIC_ORIGIN must be an origin without a path');
 if(origin.protocol!=='https:'&&!['127.0.0.1','localhost'].includes(origin.hostname))throw Error('Public Discord access requires HTTPS');
 if(!snowflake(env.DISCORD_CLIENT_ID))throw Error('Set DISCORD_CLIENT_ID to your public Application ID');
 if(typeof env.DISCORD_CLIENT_SECRET!=='string'||!env.DISCORD_CLIENT_SECRET.trim())throw Error('Set DISCORD_CLIENT_SECRET on the server only');
 const requirements=access.policy({guildId:env.DISCORD_GUILD_ID||defaultGuildId});
 if(!requirements.configured)throw Error('Set DISCORD_GUILD_ID to the verified community server ID');
 return {origin:origin.origin,clientId:env.DISCORD_CLIENT_ID,clientSecret:env.DISCORD_CLIENT_SECRET,requirements};
}
function createGate({origin,clientId,clientSecret,requirements,fetcher=fetch,now=Date.now,onDiagnostic=event=>console.warn('[Discord authorization]',JSON.stringify(event))}={}){
 // Validate again for callers that do not use the environment helper.
 const config=configuration({DISCORD_PUBLIC_ORIGIN:origin,DISCORD_CLIENT_ID:clientId,DISCORD_CLIENT_SECRET:clientSecret,DISCORD_GUILD_ID:requirements?.guildId});
 if(!requirements?.configured||requirements.roleIds?.length)throw Error('This gate is configured for community membership only');
 origin=config.origin;requirements=config.requirements;
 const secure=origin.startsWith('https:'),prefix=secure?'__Host-':'',sessionName=prefix+'doupo_discord_session',stateName=prefix+'doupo_discord_state';
 const states=new Map(),sessions=new Map(),attempts=new Map();
 const callback=origin+'/auth/discord/callback',limit=1000,recheck=5*60*1000;
 const cookie=(name,value,age)=>name+'='+value+'; Path=/; HttpOnly; SameSite=Lax; Max-Age='+age+(secure?'; Secure':'');
 const readCookie=(req,name)=>{
  const entries=String(req.headers.cookie||'').slice(0,8192).split(';').map(x=>x.trim()).filter(x=>x.startsWith(name+'='));
  return entries.length===1?entries[0].slice(name.length+1):'';
 };
 const headers=res=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'; form-action 'self' https://discord.com; base-uri 'none'; frame-ancestors 'none'");
 };
 const page=(res,status,message,canLogin=true)=>{
  headers(res);
  // no-referrer makes native form POSTs send Origin:null in Chromium. Keep the
  // same-origin login POST identifiable while suppressing cross-origin referrers.
  res.setHeader('Referrer-Policy','same-origin');
  res.writeHead(status,{'Content-Type':'text/html; charset=utf-8'});
  res.end(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>类脑社区验证 · 斗破苍穹</title><style>*{box-sizing:border-box}body{margin:0;min-height:100dvh;display:grid;place-items:center;padding:24px;background:#eef1e8;color:#284b42;font:18px/1.8 system-ui,sans-serif}main{width:min(100%,560px);padding:clamp(24px,6vw,48px);background:#fffdf7;border:1px solid #d6dfcf;border-radius:24px;box-shadow:0 20px 80px #284b4215}small{font-size:16px;color:#647d70}h1{font-size:30px;line-height:1.4;margin:10px 0 24px}p{margin:0 0 24px}button{font:inherit;min-height:52px;width:100%;padding:12px 20px;background:#315e50;color:white;border:0;border-radius:12px;cursor:pointer}button:focus-visible{outline:3px solid #ba893c;outline-offset:4px}</style><main><small>斗破苍穹 · 独立前端</small><h1>类脑社区验证</h1><p role="status">${escape(message)}</p>${canLogin?'<form method="post" action="/auth/discord/login"><button type="submit">使用 Discord 登录并验证</button></form>':''}<p style="margin:24px 0 0"><small>仅核验身份与社区成员资格。本地存档、预设和 API 配置不会随登录上传。</small></p></main></html>`);
 };
 const json=(res,status,body)=>{headers(res);res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(body));};
 const redirect=(res,to,cookies)=>{headers(res);res.writeHead(303,{Location:to,...(cookies?{'Set-Cookie':cookies}:{})});res.end();};
 const fail=(res,reason,error)=>{
  reason=Object.hasOwn(failures,reason)?reason:'unknown';
  const event={event:'authorization-failed',reason};
  if(['token','identity'].includes(error?.stage))event.stage=error.stage;
  if(networkCodes.has(error?.networkCode))event.networkCode=error.networkCode;
  try{onDiagnostic(event);}catch{}
  redirect(res,'/auth/discord/failed?reason='+reason);
 };
 const prune=()=>{for(const map of [states,sessions,attempts])for(const[key,value]of map)if(value.expires<=now())map.delete(key);};
 async function discord(url,options={}){
  let response;const stage=url.endsWith('/token')?'token':'identity';
  try{response=await fetcher(url,{...options,signal:AbortSignal.timeout(10000),redirect:'error'});}
  catch(error){
   const codes=[error?.code,error?.cause?.code,...(Array.isArray(error?.cause?.errors)?error.cause.errors.map(item=>item?.code):[])];
   const code=codes.find(value=>networkCodes.has(value))||(['TimeoutError','AbortError'].includes(error?.name)?'TIMEOUT':undefined);
   throw new DiscordFailure(['EACCES','EPERM'].includes(code)?'network-blocked':'network',stage,code);
  }
  if(!response.ok){
   if(url==='https://discord.com/api/oauth2/token'){
    let kind;try{kind=(await response.json())?.error;}catch{}
    if(kind==='invalid_client'||response.status===401)throw new DiscordFailure('client');
    if(kind==='invalid_grant')throw new DiscordFailure('grant');
   }
   throw new DiscordFailure(url.endsWith('/users/@me')&&response.status===401?'identity':'provider');
  }
  try{return await response.json();}catch{throw new DiscordFailure(url.endsWith('/token')?'token':'identity');}
 }
 async function authorized(req){
  const id=readCookie(req,sessionName),session=opaque(id)&&sessions.get(id);
  if(!id)return {allowed:false,reason:'login-required'};
  if(!session||session.expires<=now())return {allowed:false,reason:'login-expired'};
  if(now()-session.checked>=recheck){
   // Coalesce parallel asset loads into one check, never grant while a check is pending.
   session.checking??=access.verify({accessToken:session.token,requirements,userId:session.userId,fetcher}).then(result=>{
    if(result.allowed&&session.expires>now())session.checked=now();else sessions.delete(id);
    return result;
   }).finally(()=>{session.checking=null;});
   const result=await session.checking;if(!result.allowed)return result;
  }
  return session.expires>now()&&sessions.has(id)?{allowed:true}:{allowed:false,reason:'login-expired'};
 }
 return async function gate(req,res,url){
  prune();
  if(url.pathname==='/auth/discord/login'){
   if(req.method!=='POST')return json(res,405,{error:'Use POST to sign in'}),true;
   if(req.headers.origin!==origin)return json(res,403,{error:'Origin denied'}),true;
   const address=req.socket.remoteAddress||'unknown',attempt=attempts.get(address)||{count:0,expires:now()+60000};
   if(attempt.count>=10||states.size>=limit||(!attempts.has(address)&&attempts.size>=limit))return page(res,429,'登录尝试过于频繁，请稍后重试。',false),true;
   attempt.count++;attempts.set(address,attempt);
   const previous=readCookie(req,stateName);for(const[id,value]of states)if(value.binding===previous)states.delete(id);
   const state=random(),binding=random();states.set(state,{binding,expires:now()+10*60*1000});
   const target=new URL('https://discord.com/oauth2/authorize');
   target.search=new URLSearchParams({client_id:clientId,redirect_uri:callback,response_type:'code',scope:access.scopes.join(' '),state}).toString();
   redirect(res,target.href,[cookie(stateName,binding,600)]);return true;
  }
  if(url.pathname==='/auth/discord/callback'){
   if(req.method!=='GET')return json(res,405,{error:'Use GET for the callback'}),true;
   const state=url.searchParams.get('state'),pending=opaque(state)&&states.get(state),binding=readCookie(req,stateName);
   if(url.searchParams.getAll('state').length!==1||!pending||pending.binding!==binding)return fail(res,'session'),true;
   states.delete(state);res.setHeader('Set-Cookie',cookie(stateName,'',0));
   if(url.searchParams.has('error'))return redirect(res,'/auth/discord/cancelled'),true;
   const code=url.searchParams.get('code');
   if(url.searchParams.getAll('code').length!==1||!code||code.length>2048)return fail(res,'code'),true;
   try{
    const token=await discord('https://discord.com/api/oauth2/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,grant_type:'authorization_code',code,redirect_uri:callback}).toString()});
    const granted=new Set(typeof token?.scope==='string'?token.scope.split(' '):[]);
    if(token?.token_type?.toLowerCase()!=='bearer'||typeof token.access_token!=='string'||!token.access_token||token.access_token.length>4096||!Number.isFinite(token.expires_in)||token.expires_in<=0||!access.scopes.every(scope=>granted.has(scope)))throw new DiscordFailure('token');
    const user=await discord('https://discord.com/api/v10/users/@me',{headers:{Authorization:'Bearer '+token.access_token}});
    if(!snowflake(user?.id))throw new DiscordFailure('identity');
    const result=await access.verify({accessToken:token.access_token,requirements,userId:user.id,fetcher});
    if(!result.allowed)return redirect(res,'/auth/discord/denied?reason='+encodeURIComponent(reasons[result.reason]?result.reason:'unavailable')),true;
    if(sessions.size>=limit)throw new DiscordFailure('capacity');
    const old=readCookie(req,sessionName);sessions.delete(old);
    const id=random(),seconds=Math.min(3600,Math.floor(token.expires_in));
    if(seconds<1)throw new DiscordFailure('token');
    sessions.set(id,{token:token.access_token,userId:user.id,expires:now()+seconds*1000,checked:now(),checking:null});
    redirect(res,'/',[cookie(stateName,'',0),cookie(sessionName,id,seconds)]);return true;
   }catch(error){return fail(res,error instanceof DiscordFailure?error.reason:'unknown',error),true;}
  }
  if(url.pathname==='/auth/discord/logout'){
   if(req.method!=='POST')return json(res,405,{error:'Use POST to sign out'}),true;
   if(req.headers.origin!==origin)return json(res,403,{error:'Origin denied'}),true;
   sessions.delete(readCookie(req,sessionName));redirect(res,'/',[cookie(sessionName,'',0)]);return true;
  }
  if(url.pathname==='/auth/discord/cancelled')return page(res,401,'你已取消 Discord 授权，可以重新登录。'),true;
  if(url.pathname==='/auth/discord/failed')return page(res,503,Object.hasOwn(failures,url.searchParams.get('reason'))?failures[url.searchParams.get('reason')]:failures.unknown),true;
  if(url.pathname==='/auth/discord/denied')return page(res,403,Object.hasOwn(reasons,url.searchParams.get('reason'))?reasons[url.searchParams.get('reason')]:reasons.unavailable),true;
  const result=await authorized(req);
  if(url.pathname==='/auth/discord/status')return json(res,result.allowed?200:401,{authenticated:result.allowed,community:'类脑'}),true;
  if(!result.allowed){
   res.setHeader('Set-Cookie',cookie(sessionName,'',0));
   if(req.method==='GET'&&String(req.headers.accept||'').includes('text/html'))page(res,401,reasons[result.reason]||'请使用 Discord 登录，加入类脑社区并通过验证后进入。');
   else json(res,401,{error:'Community verification required'});
   return true;
  }
  // Apply these to the protected app without imposing the login page's restrictive CSP.
  res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Content-Type-Options','nosniff');
  return false;
 };
}
module.exports={configuration,createGate};
