(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./tavern-core.js'));else root.BeautyRoster=factory(root.TavernCore);})(typeof globalThis!=='undefined'?globalThis:this,function(core){
 'use strict';
 const builtin=['萧薰儿','彩鳞','小医仙','云韵','雅妃','纳兰嫣然','紫妍','曹颖','夭夜','韩月'];
 const fields={age:'年龄',realm:'实力',trust:'信任',closeness:'亲近',stance:'立场',grievance:'恩怨',promises:'承诺'};
 const relations=['trust','closeness','stance','grievance','promises'];
 const forbidden=['__proto__','constructor','prototype','熏儿','薰儿','萧熏儿','美杜莎','美杜莎女王','云芝'];
 const clean=(s,n)=>typeof s==='string'?s.trim().slice(0,n):'';
 const esc=core.escapeHtml,arg=core.handlerArg;
 let saving=false;
 function state(value){const s=core.clone(value||{records:{}});s.records=s.records||{};s.roster=s.roster||{};s.roster.custom=Array.isArray(s.roster.custom)?s.roster.custom:[];s.roster.hidden=Array.isArray(s.roster.hidden)?s.roster.hidden:[];s.roster.order=Array.isArray(s.roster.order)?s.roster.order:[];s.audit=Array.isArray(s.audit)?s.audit:[];return s;}
 function list(value,all=false){const s=state(value),rows=[...builtin.map(name=>({name,custom:false})),...s.roster.custom.map(c=>({...c,custom:true}))];const order=s.roster.order;rows.sort((a,b)=>{const ai=order.indexOf(a.name),bi=order.indexOf(b.name);return (ai<0?999:ai)-(bi<0?999:bi);});return all?rows:rows.filter(c=>!s.roster.hidden.includes(c.name));}
 function edit(value,action){const s=state(value),all=list(s,true);let before,after;
  if(action.type==='add'){
   const name=clean(action.name,24),bio=clean(action.bio,500);if(!name||forbidden.includes(name)||all.some(c=>c.name===name))throw Error('姓名不能为空、重复或与既有人物别名冲突');if(s.roster.custom.length>=30)throw Error('原创人物最多30位');
   s.roster.custom.push({name,bio});s.roster.order.push(name);after={name,bio};
  }else{
   if(!all.some(c=>c.name===action.name))throw Error('人物不存在');
   if(action.type==='hide'){s.roster.hidden=[...new Set([...s.roster.hidden,action.name])];}
   else if(action.type==='restore'){s.roster.hidden=s.roster.hidden.filter(n=>n!==action.name);}
   else if(action.type==='move'){const rows=list(s).map(c=>c.name),i=rows.indexOf(action.name),j=i+(action.direction===-1?-1:1);if(i<0||j<0||j>=rows.length)return s;[rows[i],rows[j]]=[rows[j],rows[i]];s.roster.order=rows;}
   else if(action.type==='correct'){
    const row=s.records[action.name]||{events:[]};before=core.clone(row);row.locks=row.locks||{};
    const custom=s.roster.custom.find(c=>c.name===action.name);if(custom&&Object.hasOwn(action.values||{},'bio')){before.bio=custom.bio;custom.bio=clean(action.values.bio,500);}
    for(const key of Object.keys(fields)){
     if(!Object.hasOwn(action.values||{},key))continue;
     const v=action.values[key];
     if(key==='age'){if(v!==''&&v!==null&&(!Number.isInteger(Number(v))||Number(v)<0||Number(v)>99999))throw Error('年龄须为非负整数，留空表示未知');if(v===''||v===null){delete row.age;delete row.ageAt;}else{row.age=Number(v);row.ageAt=s.clock||null;}}
     else{const text=clean(v,key==='promises'?400:180);if(text)row[key]=text;else delete row[key];}
     row.locks[key]=!!action.locks?.[key];
    }
    row.updatedAt=s.clock?.label||'日期未知';s.records[action.name]=row;after=core.clone(row);if(custom)after.bio=custom.bio;
   }else throw Error('不支持的人物操作');
  }
  s.audit.push({type:action.type,name:action.name||after?.name,time:s.clock?.label||'日期未知',before,after,reason:clean(action.reason,240)||'玩家编辑'});s.audit=s.audit.slice(-80);return s;
 }
 function context(value){const s=state(value),rows=list(s,true).map(c=>{const r=s.records[c.name]||{};return {name:c.name,...(c.custom?{origin:'玩家原创',bio:c.bio}:{}),...Object.fromEntries(Object.keys(fields).filter(k=>r[k]!==undefined).map(k=>[k,r[k]])),locks:r.locks||{}};});return '【本次人生人物档案】以下是已记录事实与玩家设定，隐藏只影响列表展示，不使人物消失。未知值不得补为原著结局。信任、亲近、立场、恩怨与承诺各自独立，邀约可被拒绝。锁定字段须保持，除非玩家先解锁。\n'+JSON.stringify({time:s.clock?.label||'未明确',characters:rows});}
 async function commit(action){
  if(saving||(typeof ResidenceUI!=='undefined'&&ResidenceUI.isBusy())||(typeof SaveManager!=='undefined'&&SaveManager.isBusy())||tavernState.isSending||tavernState.isLoading||(typeof WorldMapBridge!=='undefined'&&WorldMapBridge.isBusy())){showToast('请先结束移动或推演，再编辑人物','info');return false;}
  saving=true;
  try{
   if(!db)throw Error('存档数据库尚未就绪');
   const old=GameState.player,stamp=JSON.stringify(old),chat=tavernState.activeChatId,phase=GameState.phase,next=core.clone(old);next.beautyChronicle=edit(old.beautyChronicle,action);
   const check=()=>{if(GameState.player!==old||JSON.stringify(GameState.player)!==stamp||tavernState.activeChatId!==chat||GameState.phase!==phase||tavernState.isSending)throw Error('当前人生已变化，编辑未保存');};
   await db.transaction('rw',[db.tavernSettings],async()=>{check();await db.tavernSettings.put({...tavernState.tavernSettings,id:'main',activeChatId:chat,playerState:next,playerStateAt:Date.now()});check();});
   GameState.player=next;const local=saveToLocalStorage();refresh();showToast(local?'人物档案已保存':'人物已保存到数据库，本地备份写入失败',local?'success':'info');return true;
  }catch(e){showToast('未保存：'+e.message,'error');return false;}finally{saving=false;}
 }
 function refresh(){if(typeof DoupoPanels!=='undefined'&&DoupoPanels.rankTab==='beauties')DoupoPanels.rankings('beauties');}
 function management(){const s=state(GameState.player.beautyChronicle),hidden=list(s,true).filter(c=>s.roster.hidden.includes(c.name));return `<details class="journal-guide beauty-manager"><summary>管理人物 · 原创与显示顺序</summary><div class="beauty-create"><label>原创人物姓名<input id="beauty-new-name" maxlength="24" placeholder="例如：柳知秋"></label><label>人物设定<textarea id="beauty-new-bio" maxlength="500" placeholder="身份、性格与背景；不会自动建立亲密关系或赠送资源"></textarea></label><button class="journal-button" onclick="BeautyRoster.add()">添加原创人物</button></div><p>卡片可上移、下移或收起；收起保留故事记录，可在此恢复。最多添加30位原创人物。</p>${hidden.map(c=>`<button class="journal-button" onclick="BeautyRoster.commit({type:'restore',name:${arg(c.name)}})">恢复 ${esc(c.name)}</button>`).join('')}${s.audit.length?'<details><summary>档案修改记录 · '+s.audit.length+'</summary>'+s.audit.slice(-15).reverse().map(a=>`<p>${esc(a.time)} · ${esc(a.name)} · ${esc({add:'添加',hide:'收起',restore:'恢复',move:'排序',correct:'纠错'}[a.type]||a.type)}<br>${esc(a.reason)}${a.type==='correct'?'<br>'+Object.keys({...fields,bio:'人物设定'}).filter(k=>JSON.stringify(a.before?.[k])!==JSON.stringify(a.after?.[k])||!!a.before?.locks?.[k]!==!!a.after?.locks?.[k]).map(k=>esc(fields[k]||'人物设定')+': '+esc(a.before?.[k]??'未知')+' → '+esc(a.after?.[k]??'未知')+(a.after?.locks?.[k]?'（锁定）':'')).join('；'):''}</p>`).join('')+'</details>':''}</details>`;}
 async function add(){const name=document.getElementById('beauty-new-name').value,bio=document.getElementById('beauty-new-bio').value;await commit({type:'add',name,bio});}
 function profileField(name,index){const c=list(GameState.player.beautyChronicle,true).find(c=>c.name===name&&c.custom);return c?`<label>人物设定<textarea id="beauty-bio-${index}" maxlength="500">${esc(c.bio||'')}</textarea></label>`:'';}
 function controls(name,index){const r=GameState.player.beautyChronicle?.records?.[name]||{};return `<div class="beauty-relations"><h4>彼此关系</h4><dl>${relations.map(k=>`<dt>${fields[k]}</dt><dd>${esc(r[k]||'尚未确认')}${r.locks?.[k]?'<small> · 已锁定</small>':''}</dd>`).join('')}</dl></div><details class="beauty-actions"><summary>与她互动</summary><label>行动方式<select id="beauty-action-${index}">${Object.entries(actions).map(([k,a])=>`<option value="${k}">${a.label}</option>`).join('')}</select></label><label>具体想法<textarea id="beauty-intent-${index}" maxlength="600" placeholder="补充你的意图，或选择自由行动"></textarea></label><button class="journal-button" onclick="BeautyRoster.draft(${arg(name)},${index})">写入聊天草稿 ↗</button><p>先核实位置与传讯条件；能否见面、接受邀请由正文和她的意愿决定。</p></details><details class="beauty-correction"><summary>纠错与锁定</summary><p>这是玩家修改世界设定，会写入档案；留空表示未知。锁定后人物 API 不覆盖该字段。</p>${profileField(name,index)}${Object.keys(fields).map(k=>`<label>${fields[k]}<input id="beauty-edit-${index}-${k}" ${k==='age'?'type="number" min="0" max="99999" step="1"':'maxlength="'+(k==='promises'?400:180)+'"'} value="${esc(r[k]??'')}"></label><label class="beauty-lock"><input id="beauty-lock-${index}-${k}" type="checkbox" ${r.locks?.[k]?'checked':''}>锁定${fields[k]}</label>`).join('')}<label>修改原因<input id="beauty-reason-${index}" maxlength="240" placeholder="例如：修正上轮误记"></label><button class="journal-button" onclick="BeautyRoster.correct(${arg(name)},${index})">保存纠错</button></details><div class="beauty-order"><button aria-label="上移${esc(name)}" onclick="BeautyRoster.commit({type:'move',name:${arg(name)},direction:-1})">上移</button><button aria-label="下移${esc(name)}" onclick="BeautyRoster.commit({type:'move',name:${arg(name)},direction:1})">下移</button><button onclick="BeautyRoster.commit({type:'hide',name:${arg(name)}})">收起人物</button></div>`;}
 async function correct(name,index){const values={},locks={};for(const key of Object.keys(fields)){values[key]=document.getElementById(`beauty-edit-${index}-${key}`).value;locks[key]=document.getElementById(`beauty-lock-${index}-${key}`).checked;}const bio=document.getElementById('beauty-bio-'+index);if(bio)values.bio=bio.value;await commit({type:'correct',name,values,locks,reason:document.getElementById('beauty-reason-'+index).value});}
 const actions={visit:{label:'拜访',text:'我想拜访她。先核实我是否知道她的位置、路程与见面条件；没有条件就先寻找线索。'},letter:{label:'传信',text:'我想给她传信。先核实可用的传讯渠道、耗时与费用，不默认即时送达。'},invite:{label:'邀约',text:'我想邀请她同行或见面。让她根据自己的目标、关系和处境自主回应，可以拒绝。'},learn:{label:'请教',text:'我想向她请教。先确定我想学的内容、她掌握的能力与愿意付出的条件，不直接获得功法或实力。'},trade:{label:'交易',text:'我想与她商谈交易。先核对双方实际物品、意愿和价格，达成交易后才结算。'},free:{label:'自由行动',text:'按我的具体意图展开互动，保留对方自主判断，不预设互动成功。'}};
 function draft(name,index){
  if(saving||tavernState.isSending||(typeof WorldMapBridge!=='undefined'&&WorldMapBridge.isBusy())){showToast('请先结束移动或推演','info');return;}
  if(!list(GameState.player.beautyChronicle,true).some(c=>c.name===name))return;
  const kind=document.getElementById('beauty-action-'+index).value,intent=clean(document.getElementById('beauty-intent-'+index).value,600);if(!Object.hasOwn(actions,kind))return;if(kind==='free'&&!intent){showToast('请填写你的行动意图','info');return;}
  const text='【与'+name+'互动】\n'+actions[kind].text+(intent?'\n我的具体意图：'+intent:'');
  switchGameView('tavern',document.getElementById('sidebar-tavern'));const input=document.getElementById('tavern-input');if(input){input.value=(input.value.trim()?input.value+'\n\n':'')+text;input.focus();}showToast('互动已追加到草稿，发送后才推进故事','info');
 }
 return {builtin,fields,relations,state,list,edit,context,management,controls,commit,add,correct,draft,isBusy:()=>saving};
});
