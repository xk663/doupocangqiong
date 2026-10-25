(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./tavern-core.js'),require('./beauty-roster.js'));else root.BeautyChronicle=factory(root.TavernCore,root.BeautyRoster);})(typeof globalThis!=='undefined'?globalThis:this,function(core,roster){
 'use strict';
 const names=['萧薰儿','彩鳞','小医仙','云韵','雅妃','纳兰嫣然','紫妍','曹颖','夭夜','韩月'];
 const aliases={'熏儿':'萧薰儿','薰儿':'萧薰儿','萧熏儿':'萧薰儿','美杜莎':'彩鳞','美杜莎女王':'彩鳞','云芝':'云韵'};
 const clean=(s,n)=>typeof s==='string'?s.trim().slice(0,n):'';
 function explicitCloseness(name,evidence){
  // Only recover the literal, current player relationship. Do not infer affection from cooperation.
  const escaped=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const subject='(?:'+[name,...Object.keys(aliases).filter(k=>aliases[k]===name)].map(escaped).join('|')+')';
  const qualifiers='(?:目前|现在|还|仍|只是|只算|仅仅|仅|是|之间|的关系|关系|\\s)*';
  const uncertain=/(?:如果|假如|假设|也许|可能|似乎|听说|据说|传闻|曾经|当年|过去|以前|回忆|希望|将来|未来|不再|不是|并非|[？?])/;
  for(const sentence of evidence.split(/[。！!；;\n]/)){
   if(uncertain.test(sentence))continue;
   // A direct named statement, e.g. "小医仙与你还只是普通相识".
   if(new RegExp(subject+'(?:与你|和你)'+qualifiers+'普通相识').test(sentence))return '普通相识';
  }
  const speech=new RegExp(subject+'(?:对你)?(?:说|道|表示)[：:]?[“"]([^”"]*)[”"]','g');
  for(const match of evidence.matchAll(speech)){
   const quote=match[1];if(uncertain.test(quote)||!/(?:与你|和你)/.test(quote))continue;
   if(/(?:与|和|对)(?!你)[\u4e00-\u9fff]{2,}/.test(quote))continue;
   if(new RegExp('我们'+qualifiers+'普通相识').test(quote))return '普通相识';
  }
  return '';
 }
 function clock(body,previous){
  const checkpoints=[...String(body).matchAll(/<scene_checkpoint\b[^>]*data-time=["']([^"']+)["'][^>]*>/gi)];
  const status=String(body).match(/<ui_sys\b[^>]*>([\s\S]*?)<\/ui_sys>/i);
  const firstLine=String(body).trim().split('\n')[0];
  const raw=checkpoints.length?checkpoints.at(-1)[1]:status?status[1].replace(/<[^>]*>/g,' '):/^(?:时间[：:]\s*)?\d{1,6}年/.test(firstLine)?firstLine:'';
  const normalized=raw.replace(/(十一|十二|十|[一二三四五六七八九])月/g,(_,m)=>({'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10,'十一':11,'十二':12}[m])+'月');
  const dates=[...normalized.matchAll(/(\d{1,6})年\s*(\d{1,2})月\s*(\d{1,2})日(?:\s*(\d{1,2}):(\d{2}))?/g)];
  if(!dates.length)return previous||null;
  const d=dates.at(-1),year=+d[1],month=+d[2],day=+d[3],hour=+(d[4]||0),minute=+(d[5]||0);
  if(month<1||month>12||day<1||day>30||hour>23||minute>59)return previous||null;
  return {year,month,day,hour,minute,label:`${year}年${month}月${day}日 ${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`};
 }
 function age(row,time){if(!row||!Number.isFinite(row.age))return '未知';if(!row.ageAt||!time)return row.age+'岁（记录时）';const serial=t=>t.year*360+t.month*30+t.day;return Math.max(0,row.age+Math.floor((serial(time)-serial(row.ageAt))/360))+'岁（按正文历年估算）';}
 function apply(previous,raw,body,time,turnId){
  if(typeof raw!=='string'||raw.length>20000)throw Error('人物档案响应过长');
  const data=core.parseJSON(raw.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,''));
  if(!data||!Array.isArray(data.characters)||data.characters.length>10)throw Error('人物档案格式错误');
  const out=core.clone(previous||{records:{}});out.records=out.records||{};out.clock=time;
  const source=body.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ');
  for(const item of data.characters){
   if(!item||typeof item!=='object')continue;const name=Object.hasOwn(aliases,item.name)?aliases[item.name]:item.name;if(!roster.list(out,true).some(c=>c.name===name))continue;
   const evidence=clean(item.evidence,300);if(!evidence||!source.includes(evidence))continue;
   const row=out.records[name]||{events:[]};
   if(!row.locks?.age&&Number.isInteger(item.age)&&item.age>=0&&item.age<100000&&new RegExp('(?:年龄|年方|年仅|年纪|芳龄|今年)?[^。！？]{0,12}'+item.age+'\\s*岁').test(evidence)){row.age=item.age;row.ageAt=time;}
   const realm=clean(item.realm,60);if(!row.locks?.realm&&realm&&evidence.includes(realm))row.realm=realm;
   for(const key of roster.relations){const value=clean(item[key],key==='promises'?400:180);if(value&&!row.locks?.[key])row[key]=value;}
   if(!clean(item.closeness,180)&&!row.locks?.closeness){const explicit=explicitCloseness(name,evidence);if(explicit)row.closeness=explicit;}
   const event=clean(item.event,400);if(event){row.events=(row.events||[]).filter(e=>e.turnId!==turnId);row.events.push({text:event,evidence,time:time?.label||'正文未标明日期',turnId});row.events=row.events.slice(-40);}
   row.updatedAt=time?.label||'正文未标明日期';out.records[name]=row;
  }
  out.lastTurn=turnId;out.error='';return out;
 }
 const instruction='你是当前存档的人物档案记录员。只从本轮正文提取以下人物的实际经历、明确年龄、当前斗气修为：'+names.join('、')+'。不推演画外剧情，不用原著后期境界填补未知。正文为唯一事实依据，旧档案仅供去重。仅输出JSON：{"characters":[{"name":"彩鳞","age":25,"realm":"斗皇","event":"本轮经历简述","evidence":"正文内连续原句"}]}。age/realm/event均可省略，evidence必须逐字摘录，年龄只有正文明确写出岁数才填写。没有新事实返回{"characters":[]}。不要修改正文时间，不输出HTML。';
 async function update(previous,body,config,signal,turnId,requester=core.request){
  const time=clock(body,previous?.clock),base=core.clone(previous||{records:{}});base.clock=time;
  if(!config?.enabled)return base;
  if(!config.url||!config.model)return {...base,error:'人物API未完整配置，本轮保留原档案'};
  const ctl=new AbortController(),abort=()=>ctl.abort();signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)ctl.abort();const timer=setTimeout(abort,25000);
  try{
   const allowed=roster.list(base,true);
   const recent=Object.fromEntries(allowed.filter(c=>base.records[c.name]).map(c=>[c.name,{...base.records[c.name],events:(base.records[c.name].events||[]).slice(-3)}]));
   const rules=instruction+' 本轮人物白名单以用户数据中的allowed为准，包含玩家原创人物。逐项检查trust信任、closeness亲近、stance立场、grievance恩怨、promises承诺，使用简短文字，只有本轮正文有证据时才更新；未改变或未明确就省略。正文明确写出与玩家“普通相识”时，必须填写closeness:"普通相识"，不能只写进event；同理，明确的承诺须写promises。evidence应覆盖人物、玩家关系及其依据，逐字引用。愿意合作只支持stance，不自动代表trust提高或closeness亲密。不要把其他人物之间的关系、假设、传闻、过去关系当作当前与玩家的关系。各维度独立，不把信任等同恋爱或服从。锁定字段不可覆盖，不抹去仍有效的旧承诺，区分承诺成立与兑现。';
   const raw=await requester(config,[{role:'system',content:rules},{role:'user',content:JSON.stringify({time:time?.label||'未知',allowed:allowed.map(c=>({name:c.name,bio:c.bio})),previous:recent,body:body.slice(-24000)})}],{model:config.model,temperature:0,max_tokens:2400,thinkingLevel:config.thinkingLevel,jsonMode:config.backend==='gemini',signal:ctl.signal});
   core.checkAbort(signal);if(ctl.signal.aborted)throw Error('timeout');return apply(base,raw,body,time,turnId);
  }catch(e){core.checkAbort(signal);return {...base,error:ctl.signal.aborted?'人物API超时，本轮保留原档案':'人物API更新失败，本轮保留原档案'};}finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
 }
 const esc=core.escapeHtml;
 function settings(){const c=GameState.settings.beautyApi||{};return `<details class="journal-guide beauty-api"><summary>人物动态 · 独立 API 配置</summary><p>正文生成后额外请求一次，只更新有正文证据的人物。失败保留原档案；可随主聊天一起停止。配置后用于之后的新回合。</p><label><input id="beauty-enabled" type="checkbox" ${c.enabled?'checked':''}>启用每轮自动更新（额外消耗模型额度）</label><label>接口类型<select id="beauty-backend">${[['openai','OpenAI 兼容'],['gemini','Gemini 原生 / AI Studio 反代'],['ollama','Ollama'],['kobold','KoboldCPP']].map(([v,n])=>`<option value="${v}" ${c.backend===v?'selected':''}>${n}</option>`).join('')}</select></label><label>接口地址<input id="beauty-url" placeholder="https://服务地址/v1" value="${esc(c.url||'')}"></label><label>API Key（本地无认证可留空）<input id="beauty-key" type="password" autocomplete="off" value="${esc(c.apiKey||'')}"></label><label>模型标识<input id="beauty-model" value="${esc(c.model||'')}" placeholder="填写服务商的模型名称"></label><label><input id="beauty-relay" type="checkbox" ${c.localRelay?'checked':''}>本机反代同源通道（仅 Gemini localhost:8080）</label><p>反代未开放跨域时开启；页面需由 node tools/serve.cjs 启动。</p><label>Gemini 思考级别（其他接口忽略）<select id="beauty-thinking">${[['default','模型默认'],['low','低'],['medium','中'],['high','高']].map(([v,n])=>`<option value="${v}" ${(c.thinkingLevel||'default')===v?'selected':''}>${n}</option>`).join('')}</select></label><p>Gemini 地址填反代根地址或 /v1beta，使用原生协议。Gemini 2.5 请选择模型默认。</p><button class="journal-button" onclick="BeautyChronicle.save()">保存人物 API 配置</button><p>仅保存在本浏览器，Key 不随存档导出。以正文最后一个时间锚点为准；未写日期则沿用已知日期，年龄按已知岁数与正文历年估算。</p></details>`;}
 function save(){try{const get=id=>document.getElementById('beauty-'+id);const c={enabled:get('enabled').checked,backend:get('backend').value,url:get('url').value.trim(),apiKey:get('key').value.trim(),model:get('model').value.trim(),thinkingLevel:get('thinking').value,localRelay:get('relay').checked};if(c.enabled){core.endpoint(c.url,c.backend,c.model);if(!c.model)throw Error('请填写模型标识');}const before=GameState.settings;GameState.settings={...before,beautyApi:c};if(!saveToLocalStorage()){GameState.settings=before;return;}showToast('人物 API 配置已保存，下轮正文生效','success');}catch(e){showToast(e.message,'error');}}
 function card(name){const state=GameState.player.beautyChronicle,row=state?.records?.[name];return `<section class="beauty-current"><h4>当前故事档案</h4><dl><dt>年龄</dt><dd>${esc(age(row,state?.clock))}</dd><dt>实力</dt><dd>${esc(row?.realm||'未知')}${row?.locks?.realm?'<small> · 已锁定</small>':''}</dd></dl>${row?.events?.length?'<details><summary>已记录经历 · '+row.events.length+'</summary>'+row.events.slice().reverse().map(e=>`<p><small>${esc(e.time)}</small><br>${esc(e.text)}</p>`).join('')+'</details>':'<p>尚无正文经历记录。</p>'}</section>`;}
 return {names,clock,age,apply,update,settings,save,card};
});
