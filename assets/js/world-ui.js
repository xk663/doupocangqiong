var WorldMapUI=(function(){
 'use strict';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let loading;const instances=new WeakMap();
 function script(src){return new Promise((resolve,reject)=>{const el=document.createElement('script');el.src=src;el.onload=resolve;el.onerror=()=>{el.remove();reject(Error('地图组件载入失败，请重试'));};document.head.append(el);});}
 function dependencies(){if(!loading)loading=(async()=>{if(typeof PIXI==='undefined')await script('assets/vendor/pixi-8.22.0.min.js');if(typeof WorldActor==='undefined')await script('assets/js/world-actor.js');if(typeof WorldRenderer==='undefined')await script('assets/js/world-renderer.js');})().catch(e=>{loading=null;throw e;});return loading;}
 const button=(action,text,extra='',disabled=false)=>'<button type="button" data-map-action="'+action+'" '+extra+(disabled?' disabled':'')+'>'+text+'</button>';
 class MapView{
  constructor(host){this.host=host;this.data=WorldMapBridge.data();this.scene=null;this.selected=null;this.mode='walk';this.filter='all';this.query='';this.routes=false;this.fog=false;this.follow=true;this.running=false;this.motion=!matchMedia('(prefers-reduced-motion: reduce)').matches;}
  async init(){
   this.host.classList.add('world-map-root');this.host.innerHTML='<div class="world-atlas"><header class="world-heading"><div><span class="world-eyebrow">山 河 行 旅 · EXPLORATION</span><h2>一卷山河，万种人生</h2></div><div class="world-supplies"></div></header><nav class="world-scenes" aria-label="地图层级"></nav><div class="world-play-controls"><div class="world-avatar-options" role="radiogroup" aria-label="选择地图形象"></div><div class="world-form-options" role="radiogroup" aria-label="选择移动方式"></div><p class="world-form-hint"></p></div><div class="world-workspace"><section class="world-stage"><div class="world-scene-caption"></div><div class="world-canvas" tabindex="0" role="application" aria-label="动态探索地图，点击地面行走，WASD或方向键步行，拖动平移，滚轮缩放"></div><div class="world-map-tools">'+button('zoom-in','＋','aria-label="放大地图"')+button('zoom-out','−','aria-label="缩小地图"')+button('reset','全景')+button('locate','定位自己')+button('rest','原地休整')+'</div><div class="world-context-card" hidden></div><div class="world-walkbar" hidden><span class="world-walk-label">正在行走</span><progress max="100" value="0" aria-label="行走进度"></progress>'+button('stop','停步 · Esc')+'</div><div class="world-map-legend">点击地面行走 · 点击人物靠近交谈<span>拖动平移 · 滚轮缩放</span></div></section><aside class="world-side" aria-label="地点与行动"><div class="world-search"><input type="search" aria-label="搜索已知地点" placeholder="寻一处山河…"><select aria-label="地点层级"><option value="all">全部层级</option><option value="surface">地表</option><option value="underground">地下</option><option value="independent">独立空间</option></select></div><details class="world-directory"><summary>已知地点目录</summary><div class="world-place-list"></div></details><div class="world-detail"></div></aside></div><footer class="world-footer"><span class="world-status" role="status" aria-live="polite">正在展开山河画卷…</span><label><input type="checkbox" data-map-toggle="follow" checked>跟随</label><label><input type="checkbox" data-map-toggle="routes">道路</label><label><input type="checkbox" data-map-toggle="fog">薄雾</label><label><input type="checkbox" data-map-toggle="motion" '+(this.motion?'checked':'')+'>微动效</label></footer></div>';
   this.host.addEventListener('click',e=>{const b=e.target.closest('[data-map-action]');if(b&&!b.disabled)this.action(b.dataset.mapAction,b.dataset);});
   this.host.querySelector('input[type=search]').addEventListener('input',e=>{this.query=e.target.value;this.directory();});
   this.host.querySelector('select').addEventListener('change',e=>{this.filter=e.target.value;this.update();});
   this.host.addEventListener('change',e=>{const key=e.target.dataset.mapToggle;if(key){this[key]=e.target.checked;if(key==='motion')this.renderer?.setMotion(this.motion);else if(key==='follow'){if(this.renderer)this.renderer.follow=this.follow;}else this.update();}});
   this.unsubscribe=WorldMapBridge.subscribe(()=>{if(this.host.isConnected)this.update();else this.destroy();});
   this.update();
   try{await dependencies();this.renderer=await new WorldRenderer(this.host.querySelector('.world-canvas'),(id,npc)=>this.move({nodeId:id,npcId:npc}),point=>this.move({point,sceneId:this.scene})).init();this.renderer.setMotion(this.motion);this.renderer.onStop=()=>this.action('stop',{});this.update();this.status('点击街巷或小径行走；点击人物会自动靠近，WASD亦可步行。');}catch(e){this.status(e.message+'；可继续使用地点目录。');this.host.querySelector('.world-directory').open=true;}
  }
  status(text){this.host.querySelector('.world-status').textContent=text;}
  ctx(){return WorldMapBridge.getContext();}
  positions(){return this.data.nodes.filter(n=>this.scene==='world'?n.scene==='world':n.scene===this.scene||n.id===this.scene).map(n=>n.id===this.scene&&n.localPosition?{...n,x:n.localPosition[0],y:n.localPosition[1]}:n);}
  directory(){const c=this.ctx();const list=this.positions().filter(n=>c.state.discovered.includes(n.id)&&(this.filter==='all'||(this.filter==='surface'?['surface','hidden-surface','surface-and-underground'].includes(n.layer):this.filter==='underground'?['underground','surface-and-underground'].includes(n.layer):['independent-space','special-space','void-space'].includes(n.layer)))&&n.name.includes(this.query));this.host.querySelector('.world-place-list').innerHTML=list.map(n=>button('select',esc(n.name)+(c.state.visited.includes(n.id)?' <small>已到访</small>':''),'data-id="'+n.id+'"')).join('')||'<p class="world-muted">没有已知地点。线索需要在旅途中获得。</p>';if(this.query)this.host.querySelector('.world-directory').open=true;}
  update(){
   if(this.running&&!WorldMapBridge.isMoving())this.renderer?.stopWalking();
   const c=this.ctx(),s=c.state,d=this.data;const root=WorldCore.rootOf(d,s.locationId);this.mode=s.movementMode||'walk';
   if(this.lastLocation!==s.locationId){this.scene=s.scene;this.selected=s.locationId;this.lastLocation=s.locationId;}
   this.scene=this.scene||s.scene;this.selected=this.selected||s.locationId;
   const scene=d.scenes.find(x=>x.id===this.scene)||d.scenes[0],hour=String(c.gameTime.hour||0).padStart(2,'0'),minute=String(c.gameTime.minute||0).padStart(2,'0');
   this.host.querySelector('.world-supplies').innerHTML='<span class="world-avatar-badge">'+WorldNavigation.avatar(c.player.gender,s.avatarId).name+'形象</span><span>行旅精力 <strong>'+s.vigor+'</strong><small>/100</small></span><span>金币 <strong>'+esc(c.economy.gold)+'</strong></span><span>干粮 <strong>'+WorldCore.inventoryCount(c,'干粮')+'</strong> · 水囊 <strong>'+WorldCore.inventoryCount(c,'水囊')+'</strong></span>';
   this.host.querySelector('.world-scenes').innerHTML=d.scenes.map(x=>button('scene',esc(x.name),'data-id="'+x.id+'" aria-pressed="'+(this.scene===x.id)+'"',x.id!=='world'&&root!==x.id&&!s.visited.includes(x.id))).join('')+'<span>'+hour+':'+minute+' · '+esc(c.worldState.weather||'晴')+'</span>';
   this.host.querySelector('.world-scene-caption').innerHTML='<span>卷 '+String(d.scenes.indexOf(scene)+1).padStart(2,'0')+'</span><h3>'+esc(scene.name)+'</h3><p>'+esc(scene.subtitle)+'</p>';
   this.controls(c);this.directory();this.detail(c);this.contextCard(c);const rest=this.host.querySelector('.world-map-tools [data-map-action=rest]');if(rest)rest.disabled=WorldMapBridge.isBusy();
   const nodes=this.positions().filter(n=>s.discovered.includes(n.id)&&(this.filter==='all'||(this.filter==='independent'?/space/.test(n.layer):n.layer.includes(this.filter)))).map(n=>({...n,known:true,visited:s.visited.includes(n.id)}));
   const nearby=WorldCore.nearbyNpcs(d,c),pins=nearby.map(n=>{const pos=nodes.find(x=>x.id===n.locationId);return pos?{...n,x:pos.x,y:pos.y}:null;}).filter(Boolean);
   const p=this.selected?WorldCore.plan(d,c,this.selected,this.mode):null;
   const pose=WorldNavigation.position(d,s),rootNode=WorldCore.node(d,root),displayPose=this.scene==='world'?{sceneId:'world',x:rootNode.x,y:rootNode.y,direction:pose.direction}:this.scene===pose.sceneId?pose:null;
   if(!this.running)this.renderPromise=this.renderer?.render({scene,nodes,npcs:pins,routes:this.scene==='world'?d.edges:[],routeIds:this.scene==='world'?p?.edges||[]:[],showRoutes:this.routes,fog:this.fog,selected:this.selected,playerId:this.scene==='world'?root:s.locationId,pose:displayPose,avatar:WorldNavigation.avatar(c.player.gender,s.avatarId),form:this.mode}).catch(e=>this.status('地图显示异常：'+e.message));
  }
  controls(c){
   const s=c.state,busy=WorldMapBridge.isBusy()||this.preparing;
   this.host.querySelector('.world-avatar-options').innerHTML=WorldNavigation.avatars.map(a=>button('appearance','<span class="world-choice-portrait" style="background-image:url('+a.image+')"></span><span><strong>'+a.name+'</strong><small>'+a.subtitle+'</small></span>','role="radio" aria-checked="'+(a.id===s.avatarId)+'" aria-label="'+a.name+'地图形象" data-id="'+a.id+'"',busy)).join('');
   this.host.querySelector('.world-form-options').innerHTML=Object.values(WorldNavigation.forms).map(f=>button('mode','<span class="world-form-icon">'+({walk:'行',convoy:'驿',flight:'翼'}[f.id])+'</span><span>'+f.name+'<small>'+(f.id==='flight'&&WorldCore.rank(c.player.realm)<5?'斗王解锁':{walk:'沿路漫步',convoy:'骑乘赶路',flight:'直线御空'}[f.id])+'</small></span>','role="radio" aria-checked="'+(f.id===this.mode)+'" data-id="'+f.id+'"',busy||f.id==='flight'&&WorldCore.rank(c.player.realm)<5)).join('');
   this.host.querySelector('.world-form-hint').textContent=s.pose.airborne?'当前悬空 · 飞到道路附近后可切换落地形态':WorldNavigation.forms[this.mode].description+' · 形象不改变属性';
  }
  contextCard(c){
   const card=this.host.querySelector('.world-context-card');if(!card)return;const people=WorldCore.nearbyNpcs(this.data,c).filter(n=>n.available),npc=people.find(n=>n.id===this.selectedNpc)||people[0];
   card.hidden=this.running||WorldMapBridge.isMoving()||!npc;if(card.hidden)return;
   card.innerHTML='<span class="world-context-title">'+esc(npc.name)+' <small>'+esc(npc.role)+'</small></span><span class="world-muted">已经走到人物附近</span><div>'+button('talk','打听消息','data-npc="'+npc.id+'"')+button('llm','自由交谈','data-npc="'+npc.id+'" class="world-primary"')+'</div>';
  }
  detail(c){
   const d=this.data,s=c.state,n=WorldCore.node(d,this.selected);if(!n||!s.discovered.includes(n.id)){this.selected=s.locationId;return this.detail(c);}
   const pose=WorldNavigation.position(d,s),target=n.id===this.scene?n.localPosition:[n.x,n.y],local=this.scene!=='world'&&pose.sceneId===this.scene,here=local?WorldNavigation.distance(pose,{x:target[0],y:target[1]})<=4:n.id===s.locationId,trip=local?WorldCore.walkPlan(d,c,this.scene,{x:target[0],y:target[1]},this.mode):WorldCore.plan(d,c,n.id,this.mode),locked=WorldCore.gate(d,s,n.id,c.player);const busy=WorldMapBridge.isBusy();
   let html='<div class="world-location-heading"><span class="world-eyebrow">'+(here?'此刻 · 你在这里':s.visited.includes(n.id)?'曾经到访':'远方 · 已知地点')+'</span><h3>'+esc(n.name)+'</h3><p>'+esc(n.desc)+'</p></div>';
   if(locked)html+='<p class="world-notice">'+esc(locked)+'</p>';
   if(!here){
    if(trip.ids)html+='<div class="world-trip"><p>'+trip.ids.map(id=>esc(WorldCore.node(d,id).name)).join(' → ')+'</p><div><strong>'+trip.hours+'<small> 小时</small></strong><span>'+trip.gold+' 金币<br>精力 −'+trip.energy+'</span><span>干粮 −'+trip.food+'<br>水囊 −'+trip.water+'</span></div></div>';
    if(local&&trip.ok)html+='<p class="world-muted">'+WorldNavigation.forms[this.mode].label+'约 '+Math.round(trip.hours*60)+' 分钟 · 精力 −'+trip.energy+' · '+trip.gold+' 金币</p>';
    if(!trip.ok)html+='<p class="world-muted">'+esc(trip.reason)+'</p>';
    html+=button('travel','走到 '+esc(n.name),'class="world-primary"',busy||!trip.ok)+'<p class="world-muted">点击地图地点会直接开始行走，途中可停步。</p>';
   }else html+='<div class="world-actions">'+button('explore','探寻周边','class="world-primary"',busy)+button('rest','就地休整','',busy)+'</div><p class="world-muted">探寻：2小时 / 8精力。休整：城镇6小时 / 2金币，野外露营8小时。</p>';
   if(d.scenes.some(x=>x.id===n.id)&&n.id!=='world')html+=button('scene','展开 '+esc(n.name)+' 街巷','data-id="'+n.id+'" class="world-text-button"',WorldCore.rootOf(d,s.locationId)!==n.id&&!s.visited.includes(n.id));
   const proposal=WorldMapBridge.getProposal();if(proposal)html+='<section class="world-proposal"><h4>推演中的行动建议</h4><p>'+esc(proposal.type==='travel'?'前往 '+WorldCore.node(d,proposal.targetId).name:({explore:'探寻周边',rest:'休整',talk:'打听消息'}[proposal.type]))+'</p><p class="world-muted">确认后由地图规则检查并结算。</p>'+button('proposal','确认执行','',busy)+button('dismiss','忽略')+'</section>';
   const people=WorldCore.nearbyNpcs(d,c);if(people.length){html+='<section class="world-section"><h4>人间烟火 <small>原创地方人物</small></h4>';for(const npc of people){const quest=s.quests.find(q=>q.npcId===npc.id),available=npc.available;
    html+='<article class="world-person"><div class="world-avatar">'+esc(npc.name[0])+'</div><div class="world-person-info"><strong>'+esc(npc.name)+'</strong><span>'+esc(npc.role)+' · 信任 '+(s.trust[npc.id]||0)+'</span><small>'+esc(WorldCore.node(d,npc.locationId)?.name)+' · '+(available?'可交谈':'需先靠近')+'</small></div><div class="world-person-actions">'+button('npc-place','寻人','data-id="'+npc.locationId+'"')+button('talk','打听','data-npc="'+npc.id+'"',busy||!available)+button('llm','自由交谈','data-npc="'+npc.id+'"',busy||!available)+button(quest?.status==='active'?'complete':'accept',quest?.status==='completed'?'已交付':quest?'交付委托':'接取委托','data-npc="'+npc.id+'"',busy||!available||quest?.status==='completed')+'</div>';
    if(quest?.status==='active')html+='<p class="world-muted">'+(quest.kind==='herbs'?'交付低阶药材 ×3（现有 '+WorldCore.inventoryCount(c,'低阶药材')+'）':'到访 '+esc(WorldCore.node(d,quest.target)?.name)+' 后返回')+'</p>';
    if(npc.shop&&available)html+='<div class="world-shop"><span>行旅补给</span>'+d.trade.map(item=>'<div><span>'+esc(item.name)+' <small>'+item.price+'金</small></span>'+button('buy','购入 ×1','data-npc="'+npc.id+'" data-item="'+item.id+'"',busy)+(item.sell?button('sell','售出 · '+item.sell+'金','data-npc="'+npc.id+'" data-item="'+item.id+'"',busy||!WorldCore.inventoryCount(c,item.name)):'')+'</div>').join('')+'</div>';
    html+='</article>'; }html+='</section>';}
   html+='<section class="world-section"><h4>行旅手札 <small>'+s.visited.length+'处足迹</small></h4>'+(s.journal.length?'<ol class="world-journal">'+s.journal.slice(-5).reverse().map(e=>'<li>'+esc(e.text)+'</li>').join('')+'</ol>':'<p class="world-muted">旅程尚未落笔。与人交谈，或走向远方。</p>')+'</section>';
   html+='<details class="world-source"><summary>地点出处与设计说明</summary><p>'+(n.sourceType==='novel-evidence'?'小说地点线索：'+esc((n.sources||[]).map(x=>typeof x==='object'?JSON.stringify(x):x).join('；')):'为游玩设计的原创地点与互动。')+'</p><p>画面布局、道路耗时、精力、物价和地方人物均为游戏设计值。独立空间通过入口连接，不代表地表方位。</p></details>';
   this.host.querySelector('.world-detail').innerHTML=html;
  }
  async move(request){
   if(this.running||this.preparing){if(request.nodeId&&request.nodeId===this.activeRequest?.nodeId)return;this.queued=request;if(this.localMotion)this.renderer?.stopWalking('retarget');this.status(this.localMotion?'正在调整行进方向…':'已更新下一处目的地，抵达当前路段后继续。');return;}
   if(WorldMapBridge.isBusy()){this.status('请等推演完成后再行走。');return;}
   this.activeRequest=request;this.preparing=true;this.cancelRequested=false;let lease;try{
    await this.renderPromise;if(request.sceneId&&request.sceneId!==this.scene)throw Error('地图层级已变化，请重新点选目的地');let c=this.ctx();const d=this.data,pose=WorldNavigation.position(d,c.state);let node=request.nodeId?WorldCore.node(d,request.nodeId):null;if(request.point&&this.scene==='world'){node=this.positions().filter(n=>c.state.discovered.includes(n.id)).map(n=>({n,d:WorldNavigation.distance(n,request.point)})).filter(n=>n.d<=8).sort((a,b)=>a.d-b.d)[0]?.n;if(!node)throw Error('大陆图请点选城镇与入口；进入地区后可在地面自由移动');}
    if(node){const locked=WorldCore.gate(d,c.state,node.id,c.player);if(locked)throw Error(locked);this.selected=node.id;this.selectedNpc=request.npcId;}
    const root=WorldCore.rootOf(d,c.state.locationId),targetRoot=node?WorldCore.rootOf(d,node.id):null;
    const local=!node||pose.sceneId!=='world'&&targetRoot===root;this.localMotion=local;let trip,points,action;if(local&&this.scene==='world'){this.scene=pose.sceneId;this.update();await this.renderPromise;this.renderer?.centerActor();return;}
    if(local){if(this.scene!==pose.sceneId)throw Error('请先切回角色当前所在的地区');const p=request.point||(node.id===root?{x:node.localPosition[0],y:node.localPosition[1]}:{x:node.x,y:node.y});trip=WorldCore.walkPlan(d,c,pose.sceneId,p,this.mode);if(!trip.ok){if(trip.reason==='已经到达这里'){this.update();return;}throw Error(trip.reason);}points=trip.points;action={type:'walk',sceneId:pose.sceneId,x:trip.target.x,y:trip.target.y,mode:this.mode};}
    else{trip=WorldCore.plan(d,c,node.id,this.mode);if(!trip.ok)throw Error(trip.reason);this.scene='world';this.update();await this.renderPromise;points=trip.ids.map(id=>WorldCore.node(d,WorldCore.rootOf(d,id))).map(n=>({x:n.x,y:n.y})).filter((p,i,a)=>!i||WorldNavigation.distance(p,a[i-1])>.01);action={type:'travel',targetId:node.id,mode:this.mode};}
    if(!this.renderer)throw Error('地图画面尚未载入，请稍后再试');if(this.renderer.actorReady===false)throw Error('角色贴图尚未载入，请稍后重试或刷新地图');
    this.update();await this.renderPromise;if(this.renderer.actorReady===false)throw Error('角色贴图未能载入，请刷新地图后重试');if(this.cancelRequested)throw Error('已取消行走');this.running=true;this.preparing=false;lease=WorldMapBridge.beginMovement();if(lease===null)throw Error('另一个行动正在进行，请稍候');
    this.running=true;this.activeMode=this.mode;this.detail(this.ctx());this.contextCard(this.ctx());const bar=this.host.querySelector('.world-walkbar'),label=bar.querySelector('.world-walk-label'),progress=bar.querySelector('progress');bar.hidden=false;label.textContent=WorldNavigation.forms[this.mode].label+' · '+(node?.name||'所选道路');this.status('角色正在行走，途中可按 Esc 停步。');
    const result=await this.renderer.animatePath(points,{mode:this.activeMode,duration:local?undefined:Math.max(this.activeMode==='flight'?650:this.activeMode==='convoy'?900:1100,Math.min(10000,points.slice(1).reduce((n,p,i)=>n+WorldNavigation.distance(points[i],p),0)/WorldNavigation.forms[this.activeMode].speed*1000)),onProgress:p=>{progress.value=Math.round(p*100);}});
    if(result.reason==='hidden')this.queued=null;
    if(!result.completed){if(local&&result.position&&WorldNavigation.distance(pose,result.position)>.15)action={type:'walk',sceneId:pose.sceneId,x:result.position.x,y:result.position.y,mode:this.activeMode};else action=null;}
    const next=WorldMapBridge.finishMovement(lease,action);lease=undefined;if(next)this.status(result.completed?next.message:'已在途中停步，位置与步行消耗已保存。');else this.status('已停步，本次行旅未结算。');
   }catch(e){this.status(e.message);if(lease!==undefined)WorldMapBridge.finishMovement(lease,null);}
   finally{this.running=false;this.preparing=false;this.localMotion=false;const bar=this.host.querySelector('.world-walkbar');if(bar)bar.hidden=true;this.update();if(this.queued){const queued=this.queued;this.queued=null;this.move(queued);}}
  }
  action(type,attrs){
   if(type==='select'||type==='npc-place'){this.move({nodeId:attrs.id});return;}
   if(type==='travel'){this.move({nodeId:this.selected});return;}
   if(type==='stop'){this.cancelRequested=true;this.queued=null;this.renderer?.stopWalking();return;}
   if(type==='scene'){if(this.running||this.preparing){this.status('先停步再切换地图层级');return;}this.scene=attrs.id;const root=WorldCore.rootOf(this.data,this.ctx().state.locationId);this.selected=attrs.id==='world'?root:attrs.id;this.filter='all';this.host.querySelector('select').value='all';this.query='';this.host.querySelector('input[type=search]').value='';this.update();return;}
   if(type==='mode'){if(this.preparing||this.running){this.status('先停步再切换移动形态');return;}WorldMapBridge.execute({type:'movement-mode',mode:attrs.id});return;}
   if(type==='appearance'){if(this.preparing||this.running){this.status('先停步再切换形象');return;}WorldMapBridge.execute({type:'appearance',avatarId:attrs.id});return;}
   if(type==='zoom-in'||type==='zoom-out'){this.renderer?.zoomAt(type==='zoom-in'?1.25:.8);return;}
   if(type==='reset'){this.renderer?.reset();return;}
   if(type==='locate'){this.scene=this.ctx().state.scene;this.selected=this.ctx().state.locationId;this.update();this.renderer?.centerActor();return;}
   if(type==='llm'){WorldMapBridge.talkIntent(attrs.npc);return;}
   if(type==='dismiss'){WorldMapBridge.clearProposal();return;}
   let a={type};if(type==='travel')a={type,targetId:this.selected,mode:this.mode};if(['talk','accept','complete','buy','sell'].includes(type))a={type,npcId:attrs.npc,itemId:attrs.item,qty:1};if(type==='proposal')a=WorldMapBridge.getProposal();
   if(a?.type==='travel'){if(a.mode&&a.mode!==this.mode&&!WorldMapBridge.execute({type:'movement-mode',mode:a.mode}))return;this.move({nodeId:a.targetId});return;}
   if(a){const result=WorldMapBridge.execute(a);if(result)this.status(result.message);}
  }
  destroy(){this.queued=null;this.renderer?.stopWalking();WorldMapBridge.cancelMovement();this.unsubscribe?.();this.renderer?.destroy();instances.delete(this.host);}
 }
 return {async mount(host){if(!host)return;const existing=instances.get(host);if(existing){existing.update();existing.renderer?.resize();return existing;}const view=new MapView(host);instances.set(host,view);await view.init();return view;}};
})();
