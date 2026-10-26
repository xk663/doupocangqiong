(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./tavern-core.js'));else root.SaveManager=factory(root.TavernCore);})(typeof globalThis!=='undefined'?globalThis:this,function(core){
 'use strict';
 const esc=core.escapeHtml,arg=core.handlerArg;let busy=false,ui={search:'',tab:'all',sort:'recent'};
 const text=(s,n)=>typeof s==='string'?s.trim().slice(0,n):'';
 const field=(id,key)=>'save-'+key+'-'+encodeURIComponent(id);
 function key(){return typeof SAVES_KEY==='undefined'?'doupo_saves':SAVES_KEY;}
 function read(storage=localStorage){const raw=storage.getItem(key());if(!raw)return [];const rows=core.parseJSON(raw);if(!Array.isArray(rows))throw Error('存档库格式异常，已停止写入以保护原数据');return rows;}
 function write(rows,storage=localStorage){try{if(!Array.isArray(rows))throw Error('存档库格式异常');storage.setItem(key(),JSON.stringify(rows));try{if(typeof TitleMenu!=='undefined')TitleMenu.render();}catch{}return true;}catch(e){showToast('存档写入失败，请先导出备份或释放浏览器空间','error');return false;}}
 function usable(s){return !!s&&typeof s.id==='string'&&!!s.player&&typeof s.player==='object'&&!Array.isArray(s.player);}
 function withoutPrevious(s){const c=core.clone(s);delete c.previous;return c;}
 function transition(rows,action,now=Date.now()){
  const out=core.clone(rows);const index=out.findIndex(s=>s?.id===action.id),old=out[index];
  if(action.type==='add'){
   const s=core.redact(action.snapshot);if(!usable(s)||out.some(x=>x?.id===s.id))throw Error('存档标识无效或重复');out.push({...s,name:text(action.name,60)||text(s.player.name,30)+' · 新的篇章',note:text(action.note,300),kind:'manual',updatedAt:now});return out;
  }
  if(action.type==='checkpoint'){
   const s=core.redact(action.snapshot);if(!usable(s))throw Error('恢复点无效');
   const kept=out.filter(x=>!x?.recoveryBeforeLoad||x.pinned||x.deletedAt);kept.push({...s,name:'读档前 · '+text(s.player.name,30),kind:'recovery',recoveryBeforeLoad:true,updatedAt:now});return kept;
  }
  if(index<0||!usable(old))throw Error('存档不存在或已损坏');
  if(action.type==='purge'){if(!old.deletedAt)throw Error('请先移入回收站');out.splice(index,1);return out;}
  if(action.type==='restore'){delete old.deletedAt;return out;}
  if(old.deletedAt)throw Error('请先从回收站恢复存档');
  if(action.type==='trash'){old.deletedAt=now;return out;}
  if(action.type==='pin'){old.pinned=!old.pinned;return out;}
  if(action.type==='edit'){const name=text(action.name,60);if(!name)throw Error('请输入存档名称');old.name=name;old.note=text(action.note,300);old.updatedAt=now;return out;}
  if(action.type==='overwrite'){
   const s=core.redact(action.snapshot);if(!usable(s))throw Error('当前进度无效');out[index]={...s,id:old.id,name:old.name,note:old.note,pinned:!!old.pinned,kind:old.kind||'manual',updatedAt:now,previous:withoutPrevious(old)};return out;
  }
  if(action.type==='previous'){
   if(!usable(old.previous))throw Error('没有可恢复的上一版');out[index]={...withoutPrevious(old.previous),id:old.id,name:old.name,note:old.note,pinned:!!old.pinned,updatedAt:now,previous:withoutPrevious(old)};return out;
  }
  throw Error('未知存档操作');
 }
 function rowsFiltered(rows,options=ui){return rows.filter(s=>{
  if(options.tab==='trash'?!s?.deletedAt:!!s?.deletedAt)return false;
  if(options.tab==='pinned'&&!s?.pinned)return false;if(options.tab==='recovery'&&s?.kind!=='recovery')return false;
  const q=String(options.search||'').toLocaleLowerCase();return !q||[s?.name,s?.note,s?.player?.name,s?.player?.realm,s?.worldState?.location,s?.worldState?.specificSpot].join(' ').toLocaleLowerCase().includes(q);
 }).slice().sort((a,b)=>{if(options.tab!=='trash'&&!!a?.pinned!==!!b?.pinned)return a?.pinned?-1:1;if(options.sort==='name')return String(a?.name||'').localeCompare(String(b?.name||''),'zh-CN');const delta=Number(b?.updatedAt||b?.timestamp||0)-Number(a?.updatedAt||a?.timestamp||0);return options.sort==='oldest'?-delta:delta;});}
 const size=s=>{let n=0;try{n=new Blob([typeof s==='string'?s:JSON.stringify(s)]).size;}catch{}return n>=1048576?(n/1048576).toFixed(1)+' MB':n>=1024?(n/1024).toFixed(1)+' KB':n+' B';};
 const date=value=>Number.isFinite(Number(value))&&Number(value)>0?new Date(Number(value)).toLocaleString('zh-CN'):'日期未记录';
 function summary(s){const p=s.player||{},w=s.worldState||{},t=s.gameTime||{};const chats=Array.isArray(s.tavern?.chats)?s.tavern.chats:[],active=chats.find(c=>c.id===s.tavern?.activeChatId);return {player:p.name||'未命名角色',realm:p.realm||'实力未记录',place:[w.location,w.specificSpot].filter(Boolean).join(' · ')||p.location||'地点未记录',time:t.year?`${t.year}年${t.month||'?'}月${t.day||'?'}日`:'故事日期未记录',messages:Array.isArray(active?.messages)?active.messages.length:0,full:!!s.tavern};}
 function cards(rows){const list=rowsFiltered(rows);if(!list.length)return '<div class="save-library-empty"><span>卷</span><h3>'+((ui.search||ui.tab!=='all')?'没有符合条件的存档':'尚未留下这一卷')+'</h3><p>新建存档记录完整进度，或导入已有 JSON 存档。</p></div>';
  return list.map(s=>{
   if(!usable(s))return '<article class="save-library-card"><h3>异常存档</h3><p>此条数据已保留，无法加载。请先备份浏览器数据后检查。</p></article>';
   const m=summary(s),id=arg(s.id);return `<article class="save-library-card"><div class="save-card-top"><span class="save-kind">${s.deletedAt?'回收站':s.kind==='recovery'?'读档恢复点':'手动存档'}${s.pinned?' · 已置顶':''}</span><small>${size(s)}</small></div><h3>${esc(s.name||'未命名存档')}</h3><p class="save-person">${esc(m.player)} <span>${esc(m.realm)}</span></p><p>${esc(m.place)}</p><div class="save-facts"><span>${esc(m.time)}</span><span>${m.full?m.messages+' 条当前会话消息':'旧版角色存档'}</span></div><p class="save-note">${esc(s.note||'尚未填写备注')}</p><small>${s.deletedAt?'移入回收站于':'记录于'} ${date(s.deletedAt||s.updatedAt||s.timestamp)}</small><div class="save-library-actions">${s.deletedAt?`<button class="save-action-btn primary" onclick="SaveManager.act('restore',${id})">恢复存档</button><button class="save-action-btn" onclick="exportSave(${id})">导出</button><button class="save-action-btn danger" onclick="SaveManager.act('purge',${id})">永久删除</button>`:`<button class="save-action-btn primary" onclick="loadSave(${id})">读取此卷</button><button class="save-action-btn" onclick="exportSave(${id})">导出</button><button class="save-action-btn" onclick="SaveManager.act('pin',${id})">${s.pinned?'取消置顶':'置顶'}</button>`}</div>${s.deletedAt?'':`<details><summary>管理这一卷</summary><label>存档名称<input id="${esc(field(s.id,'name'))}" maxlength="60" value="${esc(s.name||'未命名存档')}"></label><label>备注<textarea id="${esc(field(s.id,'note'))}" maxlength="300">${esc(s.note||'')}</textarea></label><div class="save-library-actions"><button class="save-action-btn" onclick="SaveManager.edit(${id})">保存名称与备注</button><button class="save-action-btn" onclick="SaveManager.act('overwrite',${id})">用当前进度覆盖</button>${usable(s.previous)?`<button class="save-action-btn" onclick="SaveManager.act('previous',${id})">恢复上一版</button>`:''}<button class="save-action-btn danger" onclick="deleteSave(${id})">移入回收站</button></div></details>`}</article>`;
  }).join('');
 }
 function blocked(){return tavernState.isLoading||tavernState.isSending||((typeof SummaryUI!=='undefined'&&SummaryUI.isBusy())||(typeof ResidenceUI!=='undefined'&&ResidenceUI.isBusy()))||(typeof WorldMapBridge!=='undefined'&&WorldMapBridge.isMoving())||(typeof BeautyRoster!=='undefined'&&BeautyRoster.isBusy());}
 function checkedRead(){try{return read();}catch(e){showToast('存档库读取失败：'+e.message,'error');return null;}}
 function create(){
  if(busy||blocked()){showToast('请先结束推演、移动或人物编辑，再保存进度','info');return false;}
  try{if(!GameState.player?.name)throw Error('请先创建角色');const rows=read(),snapshot=buildGameSnapshot(),name=document.getElementById('save-new-name')?.value,note=document.getElementById('save-new-note')?.value;const next=transition(rows,{type:'add',snapshot,name,note});if(!write(next))return false;refresh();showToast('完整进度已保存，不含 API 密钥','success');return true;}catch(e){showToast('无法存档：'+e.message,'error');return false;}
 }
 function act(type,id,details={}){
  if(busy){showToast('正在读取存档，请稍后操作','info');return false;}
  try{const rows=read(),save=rows.find(s=>s?.id===id);if(!save)throw Error('存档不存在');
   if(type==='overwrite'){if(blocked())throw Error('请先结束推演或移动');if(!GameState.player?.name)throw Error('当前没有可保存的角色');if(!confirm('用当前完整进度覆盖「'+(save.name||'存档')+'」？将保留一份上一版以便恢复。'))return false;details.snapshot=buildGameSnapshot();}
   if(type==='previous'&&!confirm('恢复「'+(save.name||'存档')+'」的上一版？当前版本也会保留，游戏进度不会立即加载。'))return false;
   if(type==='purge'&&!confirm('永久删除回收站中的「'+(save.name||'存档')+'」？此操作不可撤销，请先确认已导出备份。'))return false;
   const next=transition(rows,{...details,type,id});if(!write(next))return false;refresh();showToast(type==='trash'?'已移入回收站，可以恢复':type==='restore'?'存档已从回收站恢复':'存档更新已保存','success');return true;
  }catch(e){showToast('未更改存档：'+e.message,'error');return false;}
 }
 function edit(id){return act('edit',id,{name:document.getElementById(field(id,'name'))?.value,note:document.getElementById(field(id,'note'))?.value});}
 async function load(id){
  if(busy||blocked()){showToast('请先停止推演、移动或人物编辑，再读取存档','info');return false;}
  const rows=checkedRead();if(!rows)return false;const save=rows.find(s=>s?.id===id&&!s.deletedAt);if(!usable(save)){showToast('存档不存在或已损坏','error');return false;}
  try{validateGameSnapshot(save);}catch(e){showToast('无法读取：'+e.message,'error');return false;}
  const protect=!!GameState.player?.name;
  if(!confirm('读取「'+(save.name||'未命名存档')+'」？'+(protect?'会先保存当前进度为读档恢复点。':'此操作会进入该存档的人生。')))return false;
  busy=true;let checkpointSaved=false;refresh();
  try{
   if(protect){const next=transition(rows,{type:'checkpoint',snapshot:buildGameSnapshot()});if(!write(next))return false;checkpointSaved=true;}
   const entering=GameState.phase!=='game';await restoreGameSnapshot(save);
   if(entering){GameState.phase='game';showView('view-game');initGameWorld();}
   closeAllModals();showToast(save.tavern?'完整进度已恢复':'角色已恢复；旧版存档不包含聊天历史','success');return true;
  }catch(e){showToast('读取未完成：'+e.message+(checkpointSaved?'；读档前恢复点仍已保留':''),'error');return false;}finally{busy=false;refresh();}
 }
 function download(save){const name=text(save.player?.name,30).replace(/[\\/:*?"<>|]/g,'_')||'角色';const blob=new Blob([JSON.stringify(core.redact(save),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='斗破苍穹_'+name+'_'+String(save.id).replace(/[^\w-]/g,'_').slice(0,60)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 function exportOne(id){const rows=checkedRead();if(!rows)return false;const save=rows.find(s=>s?.id===id);if(!usable(save)){showToast('存档不存在或已损坏','error');return false;}download(save);showToast('已发起 JSON 存档下载，请妥善保管聊天与角色资料','info');return true;}
 async function importFile(file){
  if(!file)return false;if(busy){showToast('正在读档，请稍后导入','info');return false;}
  try{if(file.size>20*1024*1024)throw Error('文件超过20MB，请拆分或检查内容');const raw=await file.text();if(busy)throw Error('正在读档，请稍后重新导入');const save=core.redact(validateGameSnapshot(core.parseJSON(raw)));if(!usable(save)||!Number.isFinite(Number(save.timestamp))||Number(save.timestamp)<=0)throw Error('缺少有效的存档标识或日期');const rows=read();
   const copy=core.clone(save);copy.id='save-'+crypto.randomUUID();delete copy.deletedAt;delete copy.recoveryBeforeLoad;copy.kind='manual';copy.name=text(copy.name,60)||'导入存档';if(rows.some(s=>s?.id===save.id))copy.name=text(copy.name+' · 导入副本',60);copy.importedAt=Date.now();if(!write([...rows,copy]))return false;refresh();showToast('存档已导入为独立副本，尚未加载','success');return true;
  }catch(e){showToast('导入失败：'+e.message,'error');return false;}
 }
 function controls(){return '<div class="save-library-toolbar"><label>搜索存档<input id="save-search" placeholder="名称、角色、地点或备注" oninput="SaveManager.filter(\'search\',this.value)"></label><label>显示<select id="save-tab" onchange="SaveManager.filter(\'tab\',this.value)"><option value="all">全部存档</option><option value="pinned">已置顶</option><option value="recovery">读档恢复点</option><option value="trash">回收站</option></select></label><label>排序<select id="save-sort" onchange="SaveManager.filter(\'sort\',this.value)"><option value="recent">最近更新</option><option value="oldest">最早更新</option><option value="name">存档名称</option></select></label></div>';}
 function open(){ui={search:'',tab:'all',sort:'recent'};showModal('<section class="save-library"><header><span>山河留卷 · SAVE LIBRARY</span><h2>存档管理</h2><p>留住此刻，也为下一段人生留一条归路。</p></header><div class="save-library-top"><button class="save-action-btn primary" onclick="createSave()">＋ 新建完整存档</button><button class="save-action-btn" onclick="document.getElementById(\'save-import-file\').click()">导入 JSON</button><input id="save-import-file" type="file" accept=".json" hidden onchange="importSave(this.files[0]);this.value=\'\'"></div><details class="save-new-options"><summary>新存档名称与备注（可选）</summary><label>名称<input id="save-new-name" maxlength="60" placeholder="默认使用角色名"></label><label>备注<textarea id="save-new-note" maxlength="300" placeholder="例如：进入魔兽山脉之前"></textarea></label></details>'+controls()+'<p id="save-library-status" class="save-library-status"></p><div id="save-list-container" class="save-library-grid"></div><p class="save-library-help">移入回收站后可恢复；覆盖保留上一版。读取前保留最近一次恢复点，置顶可保留旧恢复点。导出文件包含聊天与角色资料，不含 API 密钥。</p></section>');refresh();}
 function refresh(){const container=document.getElementById('save-list-container');if(!container)return;try{const rows=read();container.innerHTML=cards(rows);const status=document.getElementById('save-library-status');if(status)status.textContent=(busy?'正在读取存档… · ':'')+'显示 '+rowsFiltered(rows).length+' 份 · 本机 '+rows.filter(s=>!s?.deletedAt).length+' 份存档 · 回收站 '+rows.filter(s=>s?.deletedAt).length+' 份 · 存档库约 '+size(rows);}catch(e){container.innerHTML='<div class="save-library-empty"><h3>存档库暂时无法读取</h3><p>'+esc(e.message)+'</p><p>原数据未被覆盖，请保留浏览器数据并检查备份。</p></div>';}}
 function filter(key,value){if(key==='search')ui.search=text(value,120);else if(key==='tab'&&['all','pinned','recovery','trash'].includes(value))ui.tab=value;else if(key==='sort'&&['recent','oldest','name'].includes(value))ui.sort=value;refresh();}
 return {read,write,transition,rowsFiltered,summary,cards,create,act,edit,load,exportOne,importFile,open,refresh,filter,isBusy:()=>busy};
});
