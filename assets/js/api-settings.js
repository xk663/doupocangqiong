(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./tavern-core.js'));else root.ApiSettings=factory(root.TavernCore);})(typeof globalThis!=='undefined'?globalThis:this,function(core){
 'use strict';const jobs=new Map();
 function modelsURL(api){if(api.backend==='gemini')return core.endpoint(String(api.url||'').trim(),'gemini')+'/models';const u=new URL(core.endpoint(String(api.url||'').trim(),api.backend||'openai'));u.pathname=u.pathname.replace(/\/chat\/completions$/,'/models').replace(/\/api\/chat$/,'/api/tags').replace(/\/api\/v1\/generate$/,'/api/v1/model');return u.href;}
 function modelNames(data){const a=Array.isArray(data)?data:Array.isArray(data?.data)?data.data:Array.isArray(data?.models)?data.models:data?.result?[data.result]:[];return [...new Set(a.map(x=>typeof x==='string'?x:x?.id||x?.name||x?.model).filter(x=>typeof x==='string'&&x.trim()).map(x=>x.trim().slice(0,200)))].slice(0,1000);}
 async function fetchModels(api,fetcher=fetch,signal){
  const key=api.apiKey||api.key||'',headers={Accept:'application/json'};
  if(key)headers[api.backend==='gemini'?'x-goog-api-key':'Authorization']=api.backend==='gemini'?key:'Bearer '+key;
  const r=await fetcher(core.transportURL(api,modelsURL(api)),{method:'GET',headers,signal});
  if(!r.ok)throw Error(r.status===401||r.status===403?'认证失败，请检查 Key':r.status===404?'接口不提供模型列表，可直接手填模型':'模型查询失败：HTTP '+r.status);
  let data;try{data=await r.json();}catch{throw Error('模型列表响应不是有效 JSON，请检查接口地址；当前模型已保留');}
  if(api.backend==='gemini'&&Array.isArray(data?.models))data={...data,models:data.models.filter(m=>!Array.isArray(m?.supportedGenerationMethods)||m.supportedGenerationMethods.some(method=>['generateContent','streamGenerateContent'].includes(method)))};
  const rows=[...new Set(modelNames(data).map(m=>api.backend==='gemini'?m.replace(/^models\//,''):m))];
  if(!rows.length)throw Error('未返回可用的聊天模型，可直接手填模型名称');return rows;
 }
 const esc=v=>core.escapeHtml(v??'');const arg=v=>core.handlerArg(v);
 function commit(next){const before=GameState.settings;GameState.settings=next;if(!saveToLocalStorage()){GameState.settings=before;return false;}return true;}
 function reflectModel(id){
  const a=(GameState.settings.apis||[]).find(x=>x.id===id);if(!a)return;
  const input=document.getElementById('api-model-input-'+id),picker=document.getElementById('api-model-select-'+id);
  if(input)input.value=a.model||'';
  if(picker)picker.value=modelNames(a.models||[]).includes(a.model)?a.model:'';
 }
 function change(id,field,value){
  const allowed=['name','url','apiKey','model','backend','enabled','thinkingLevel','localRelay'];if(!allowed.includes(field))return false;
  const next=core.clone(GameState.settings),a=(next.apis||[]).find(x=>x.id===id);if(!a)return false;
  if(field==='backend'&&!['openai','ollama','kobold','gemini'].includes(value))return false;
  if(field==='localRelay'&&typeof value!=='boolean')return false;
  if(field==='thinkingLevel'&&!['default','minimal','low','medium','high'].includes(value))return false;
  const invalidate=['url','backend','apiKey','localRelay'].includes(field)&&a[field]!==value;
  a[field]=value;if(field==='apiKey')a.key=value;
  if(invalidate){a.models=[];a.lastSync=null;}
  if(!commit(next)){if(field==='model')reflectModel(id);return false;}
  if(invalidate){
   jobs.get(id)?.abort();jobs.delete(id);queryState(id,false);
   const picker=document.getElementById('api-model-select-'+id),status=document.getElementById('sync-status-'+id);
   if(picker){picker.innerHTML='<option value="">连接配置已更新，请重新查询</option>';picker.disabled=true;}
   if(status)status.textContent='连接配置已更新，请重新查询模型；当前模型已保留。';
  }
  if(field==='model')reflectModel(id);
  if(field==='enabled'||field==='backend')render(id);return true;
 }
 function pickModel(id,model){const a=(GameState.settings.apis||[]).find(x=>x.id===id);if(!a||!modelNames(a.models||[]).includes(model))return false;return change(id,'model',model);}
 function select(id){const a=(GameState.settings.apis||[]).find(x=>x.id===id);if(!a||a.enabled===false){showToast('请先启用此接口','info');return;}if(commit({...GameState.settings,activeApi:id}))render();}
 function add(){const next=core.clone(GameState.settings);next.apis=next.apis||[];const a={id:'api-'+crypto.randomUUID(),name:'新接口',url:'',apiKey:'',key:'',model:'',backend:'openai',enabled:true,models:[]};next.apis.push(a);if(!next.activeApi)next.activeApi=a.id;if(commit(next)){render();showToast('接口已添加，请依次填写地址、Key和模型','success');}}
 function remove(id){const a=(GameState.settings.apis||[]).find(x=>x.id===id);if(!a)return;if(!confirm('删除接口「'+a.name+'」？'))return;const next=core.clone(GameState.settings);next.apis=next.apis.filter(x=>x.id!==id);if(next.activeApi===id)next.activeApi=next.apis.find(x=>x.enabled!==false)?.id||null;if(next.activeSecondaryApi===id)next.activeSecondaryApi=null;if(commit(next)){jobs.get(id)?.abort();render();}}
 function validate(id){const a=(GameState.settings.apis||[]).find(x=>x.id===id);try{if(!a)throw Error('接口不存在');core.endpoint(a.url,a.backend,a.model);if(!a.model?.trim()&&a.backend!=='kobold')throw Error('请填写或选择模型');if(!saveToLocalStorage())return;showToast('配置已保存，地址格式正确；模型服务连通性以实际请求为准','success');}catch(e){showToast(e.message,'error');}}
 function queryState(id,busy){const button=document.getElementById('api-model-query-'+id),status=document.getElementById('sync-status-'+id);if(button){button.disabled=busy;button.textContent=busy?'查询中…':'查询模型';}status?.setAttribute?.('aria-busy',String(busy));}
 async function sync(id){
  const a=(GameState.settings.apis||[]).find(x=>x.id===id);if(!a)return;
  const message=text=>{const node=document.getElementById('sync-status-'+id);if(node)node.textContent=text;};
  if(!String(a.url||'').trim()){message('请先填写接口地址，再查询模型。');return;}
  jobs.get(id)?.abort();const ctl=new AbortController(),url=a.url,backend=a.backend,key=a.apiKey||a.key,relay=!!a.localRelay;
  jobs.set(id,ctl);message('正在查询模型…');queryState(id,true);const timeout=setTimeout(()=>ctl.abort(),15000);
  try{
   const models=await fetchModels(core.clone(a),fetch,ctl.signal),next=core.clone(GameState.settings),current=(next.apis||[]).find(x=>x.id===id);
   if(ctl.signal.aborted||jobs.get(id)!==ctl||!current||current.url!==url||current.backend!==backend||(current.apiKey||current.key)!==key||!!current.localRelay!==relay)return;
   current.models=models;current.lastSync=Date.now();if(!current.model)current.model=models[0];
   if(commit(next)){jobs.delete(id);render(id);showToast('已同步 '+models.length+' 个模型，请在下拉列表中选择','success');}
   else message('模型列表未能保存，请检查浏览器存储；原配置已保留。');
  }catch(e){if(jobs.get(id)===ctl)message(ctl.signal.aborted?'查询已取消或超时；当前模型已保留':e instanceof TypeError?'无法查询：请检查地址、网络及服务端 CORS；当前模型已保留':e.message);}
  finally{clearTimeout(timeout);if(jobs.get(id)===ctl){jobs.delete(id);queryState(id,false);}}
 }
 function render(openId){
  const host=document.getElementById('api-cards-container');if(!host)return;
  const opened=new Map(Array.from(host.querySelectorAll?.('details[data-api-id]')||[],node=>[node.dataset.apiId,node.open]));
  const apis=GameState.settings.apis||[];
  host.innerHTML=apis.length?apis.map(a=>{
   const models=modelNames(a.models||[]),listed=models.includes(a.model),busy=jobs.has(a.id),isOpen=a.id===openId||(opened.has(a.id)?opened.get(a.id):!a.url);
   return `<details class="settings-card api-config-card" data-api-id="${esc(a.id)}" ${isOpen?'open':''}>
    <summary><strong>${esc(a.name||'未命名')}</strong><span>${a.enabled===false?'已停用':GameState.settings.activeApi===a.id?'主聊天接口':'备用接口'}</span></summary>
    <label class="api-field">名称<input value="${esc(a.name)}" onchange="ApiSettings.change(${arg(a.id)},'name',this.value)"></label>
    <label class="api-field">1 · 接口类型<select onchange="ApiSettings.change(${arg(a.id)},'backend',this.value)">${[['openai','OpenAI 兼容'],['gemini','Gemini 原生 / AI Studio 反代'],['ollama','Ollama 本地'],['kobold','KoboldCPP 本地']].map(([v,t])=>`<option value="${v}" ${a.backend===v?'selected':''}>${t}</option>`).join('')}</select></label>
    <label class="api-field">2 · 地址<input placeholder="https://服务地址/v1" value="${esc(a.url)}" onchange="ApiSettings.change(${arg(a.id)},'url',this.value)"></label>
    <label class="api-field">3 · API Key（本地服务可留空）<input type="password" autocomplete="off" value="${esc(a.apiKey||a.key)}" onchange="ApiSettings.change(${arg(a.id)},'apiKey',this.value)"></label>
    <div class="api-model-controls"><label class="api-field">4 · 选择模型<select id="api-model-select-${esc(a.id)}" aria-label="选择可用模型" ${models.length?'':'disabled'} onchange="ApiSettings.pickModel(${arg(a.id)},this.value)"><option value="" ${listed?'':'selected'} disabled>${models.length?'请选择渠道返回的模型':'请先查询模型列表'}</option>${models.map(m=>`<option value="${esc(m)}" ${a.model===m?'selected':''}>${esc(m)}</option>`).join('')}</select></label><button id="api-model-query-${esc(a.id)}" class="text-btn" ${busy?'disabled':''} onclick="ApiSettings.sync(${arg(a.id)})">${busy?'查询中…':'查询模型'}</button></div>
    <p id="sync-status-${esc(a.id)}" class="wiring-help" role="status" aria-live="polite" aria-busy="${busy}">${busy?'正在查询模型…':models.length?'已保存 '+models.length+' 个模型，可直接下拉选择。'+(a.model&&!listed?' 当前手填模型已保留。':''):'填写地址与 Key 后查询。只获取模型列表，不发送聊天。'}</p>
    <label class="api-field">当前模型标识（也可手填）<input id="api-model-input-${esc(a.id)}" value="${esc(a.model)}" placeholder="填写服务商给出的模型标识" onchange="ApiSettings.change(${arg(a.id)},'model',this.value)"></label>
    ${geminiSettings(a)}<div class="api-actions"><button class="text-btn" onclick="ApiSettings.validate(${arg(a.id)})">保存并校验</button><button class="text-btn" ${a.enabled===false?'disabled':''} onclick="ModelProbeUI.openApi(${arg(a.id)})">路由测试</button><button class="text-btn" onclick="ApiSettings.select(${arg(a.id)})">用于主聊天</button></div>
    <label class="api-enabled"><input type="checkbox" ${a.enabled===false?'':'checked'} onchange="ApiSettings.change(${arg(a.id)},'enabled',this.checked)">启用接口</label><button class="text-btn danger" onclick="ApiSettings.remove(${arg(a.id)})">删除接口</button>
   </details>`;
  }).join(''):'<p class="wiring-help">① 添加接口　② 填地址与 Key　③ 选模型　④ 保存并用于主聊天</p>';
 }
 function geminiSettings(a){if(a.backend!=='gemini')return '';return '<label><input type="checkbox" '+(a.localRelay?'checked':'')+' onchange="ApiSettings.change('+arg(a.id)+',&quot;localRelay&quot;,this.checked)">本机反代同源通道（localhost:8080）</label><p class="wiring-help">反代未允许跨域时开启；页面需由 node tools/serve.cjs 启动。</p><label class="api-field">Gemini 思考级别<select onchange="ApiSettings.change('+arg(a.id)+',&quot;thinkingLevel&quot;,this.value)">'+[['default','模型默认'],['low','低'],['medium','中'],['high','高'],['minimal','极低（仅部分模型支持）']].map(([v,t])=>'<option value="'+v+'" '+((a.thinkingLevel||'default')===v?'selected':'')+'>'+t+'</option>').join('')+'</select></label><p class="wiring-help">地址填反代根地址或 /v1beta；系统自动补齐原生端点。模型填 gemini 名称。Gemini 2.5 请选择模型默认。</p>';}
 function backup(body){body.innerHTML=`<details class="settings-card backup-card"><summary><strong>存档与备份</strong><span>本地／Discord</span></summary><h4>本地存档</h4><p class="wiring-help">导出完整进度，或导入JSON后在存档管理中加载；不含API密钥。</p><div class="api-actions"><button class="text-btn" onclick="ApiSettings.exportProgress()">导出当前进度</button><label class="text-btn">导入存档<input type="file" accept=".json" hidden onchange="importSave(this.files[0])"></label><button class="text-btn" onclick="openSaveManager()">管理与加载</button></div><h4>Discord 云备份</h4><p class="wiring-help">① 保存你自己的 Webhook　② 备份进度　③ 从云端恢复。会上传聊天与角色档案，不含API密钥，无需账号授权。</p><label class="api-field">Webhook 地址<input id="discord-webhook-input" type="password" autocomplete="off" value="${esc(GameState.settings.discordWebhook||'')}" placeholder="https://discord.com/api/webhooks/…"></label><button class="text-btn" onclick="saveDiscordConfig()">保存地址</button><div class="api-actions"><button class="text-btn" onclick="syncToCloud()">备份到云端</button><button class="text-btn" onclick="restoreFromCloud()">从云端恢复</button><button class="text-btn" onclick="restoreFromLocal()">恢复上次备份副本</button></div><details><summary>API 配置的本机备份</summary><p class="wiring-help">含Key，仅存本浏览器，不随存档上传。</p><button class="text-btn" onclick="backupApiConfig()">备份配置</button><button class="text-btn" onclick="restoreApiConfig()">恢复配置</button></details></details>`;}
 function exportProgress(){try{const data=buildGameSnapshot(),url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='doupo-save-'+Date.now()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){showToast('无法导出：'+e.message,'error');}}
 return {modelsURL,modelNames,fetchModels,commit,change,pickModel,select,add,remove,validate,sync,render,backup,exportProgress};
});
