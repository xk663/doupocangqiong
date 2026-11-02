var WorldMapUI=(function(){
 'use strict';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let loading;const instances=new WeakMap();
 function script(src){return new Promise((resolve,reject)=>{const el=document.createElement('script');el.src=src;el.onload=resolve;el.onerror=()=>{el.remove();reject(Error('地图组件载入失败，请重试'));};document.head.append(el);});}
 function dependencies(){if(!loading)loading=(async()=>{if(typeof PIXI==='undefined'&&globalThis.location?.protocol!=='file:')await script('assets/vendor/pixi-8.22.0.min.js');if(typeof WorldActor==='undefined')await script('assets/js/world-actor.js');if(typeof WorldRenderer==='undefined')await script('assets/js/world-renderer.js');})().catch(e=>{loading=null;throw e;});return loading;}
 const button=(action,text,extra='',disabled=false)=>'<button type="button" data-map-action="'+action+'" '+extra+(disabled?' disabled':'')+'>'+text+'</button>';
 class MapView{
  constructor(host){this.host=host;this.data=WorldMapBridge.data();this.scene=null;this.selected=null;this.mode='walk';this.filter='all';this.query='';this.routes=false;this.fog=false;this.follow=true;this.running=false;this.renderRequest=0;this.motion=!matchMedia('(prefers-reduced-motion: reduce)').matches;}
  async init(){
   this.host.classList.add('world-map-root');this.host.innerHTML='<div class="world-atlas"><header class="world-heading"><div><span class="world-eyebrow">山 河 行 旅 · EXPLORATION</span><div class="world-scene-caption"></div></div></header><div class="world-navigation-bar"><nav class="world-scenes" aria-label="地图层级"></nav><div class="world-map-tools">'+button('zoom-in','＋','aria-label="放大地图"')+button('zoom-out','−','aria-label="缩小地图"')+button('reset','全景')+button('locate','定位自己')+button('retry-avatar','重试角色','hidden')+'</div></div><div class="world-play-controls"><div class="world-avatar-options" role="radiogroup" aria-label="选择地图形象"></div><div class="world-form-options" role="radiogroup" aria-label="选择移动方式"></div><p class="world-form-hint"></p></div><div class="world-feedback"><span class="world-status" role="status" aria-live="polite">正在展开山河画卷…</span></div><div class="world-workspace"><section class="world-stage"><div class="world-canvas" tabindex="0" role="application" aria-label="动态探索地图，点击地面行走，WASD或方向键步行，拖动平移，滚轮缩放"></div><div class="world-walkbar" hidden><span class="world-walk-label">正在行走</span><progress max="100" value="0" aria-label="行走进度"></progress>'+button('stop','停步 · Esc')+'</div><div class="world-map-legend">点击地面行走 · 点击人物靠近交谈<span>拖动平移 · 滚轮缩放</span></div></section><aside class="world-side" aria-label="地点与行动"><div class="world-context-card" hidden></div><div class="world-search"><input type="search" aria-label="搜索已知地点" placeholder="寻一处山河…"><select aria-label="地点层级"><option value="all">全部层级</option><option value="surface">地表</option><option value="underground">地下</option><option value="independent">独立空间</option></select></div><details class="world-directory"><summary>已知地点目录</summary><div class="world-place-list"></div></details><section class="world-discovery-board" hidden aria-live="polite"></section><div class="world-detail"></div></aside></div><footer class="world-footer">'+button('encounters','寻访人物')+button('wander','下一处风景')+'<label><input type="checkbox" data-map-toggle="fog">薄雾</label><label><input type="checkbox" data-map-toggle="motion" '+(this.motion?'checked':'')+'>微动效</label></footer></div>';
   this.host.querySelector('.world-map-tools').innerHTML+=button('sheet-left','← 画卷左侧')+button('sheet-right','画卷右侧 →');
   this.host.addEventListener('click',e=>{const b=e.target.closest('[data-map-action]');if(b&&!b.disabled)this.action(b.dataset.mapAction,b.dataset);});
   this.host.querySelector('input[type=search]').addEventListener('input',e=>{this.query=e.target.value;this.directory();});
   this.host.querySelector('select[aria-label="地点层级"]').addEventListener('change',e=>{this.filter=e.target.value;this.update();});
   this.host.addEventListener('change',e=>{if(e.target.matches?.('[data-map-region]')&&e.target.value)this.action('region',{id:e.target.value});});
   this.host.addEventListener('change',e=>{const key=e.target.dataset.mapToggle;if(key){this[key]=e.target.checked;if(key==='motion')this.renderer?.setMotion(this.motion);else if(key==='follow'){if(this.renderer)this.renderer.follow=this.follow;}else this.update();}});
   this.unsubscribe=WorldMapBridge.subscribe(()=>{if(this.host.isConnected)this.update();else this.destroy();});
   this.update();
   try{await dependencies();this.renderer=await new WorldRenderer(this.host.querySelector('.world-canvas'),(id,npc)=>this.selectPoint(id,npc),point=>this.move({point,sceneId:this.scene,input:point.input})).init();this.renderer.setMotion(this.motion);this.renderer.onError=message=>this.renderFailure(message);this.renderer.onReady=()=>{const retry=this.host.querySelector('[data-map-action=retry-avatar]'),recover=retry&&!retry.hidden;if(retry){retry.hidden=true;retry.disabled=false;}if(recover)this.status('角色已重新载入，可以继续行走。');};this.renderer.onStop=()=>this.action('stop',{});this.update();this.status(this.scene==='world'?'点击地面自由行走；按住 WASD / 方向键移动，松开停步。':'点击街巷或小径行走；点击人物会自动靠近，WASD亦可步行。');}catch(e){this.status(e.message+'；可继续使用地点目录。');this.host.querySelector('.world-directory').open=true;}
  }
  status(text,tone='info'){this.host.querySelector('.world-status').textContent=text;this.host.querySelector('.world-feedback').setAttribute('data-tone',tone);}
  renderFailure(message){if(this.destroyed||!this.host.isConnected)return;this.status(message);const retry=this.host.querySelector('[data-map-action=retry-avatar]');if(retry){retry.hidden=false;retry.disabled=false;}}
  ctx(){return WorldMapBridge.getContext();}
  selectPoint(id,npc){const pose=WorldNavigation.position(this.data,this.ctx().state);if(this.scene!=='world'&&pose.sceneId!==this.scene){this.selected=id;this.update();this.status('正在预览地区画景；角色位置和资源未改变。抵达地区入口后才能在此行走。');return;}return this.move({nodeId:id,npcId:npc});}
  positions(){return this.data.nodes.filter(n=>this.scene==='world'?n.scene==='world':n.scene===this.scene||n.id===this.scene).map(n=>n.id===this.scene&&n.localPosition?{...n,name:n.localName||n.name,x:n.localPosition[0],y:n.localPosition[1]}:n);}
  directory(){const c=this.ctx();const list=this.positions().filter(n=>c.state.discovered.includes(n.id)&&(this.filter==='all'||(this.filter==='surface'?['surface','hidden-surface','surface-and-underground'].includes(n.layer):this.filter==='underground'?['underground','surface-and-underground'].includes(n.layer):['independent-space','special-space','void-space'].includes(n.layer)))&&n.name.includes(this.query));this.host.querySelector('.world-place-list').innerHTML=list.map(n=>button('select',esc(n.name)+(c.state.visited.includes(n.id)?' <small>已到访</small>':''),'data-id="'+n.id+'"')).join('')||'<p class="world-muted">没有已知地点。线索需要在旅途中获得。</p>';if(this.query)this.host.querySelector('.world-directory').open=true;}
  update(){
   if(this.running&&!WorldMapBridge.isMoving())this.renderer?.stopWalking();
   const c=this.ctx(),s=c.state,d=this.data;const root=WorldCore.rootOf(d,s.locationId);this.mode=s.movementMode||'walk';
   if(this.lastLocation!==s.locationId){this.scene=s.scene;this.selected=s.locationId;this.lastLocation=s.locationId;}
   this.scene=this.scene||s.scene;this.selected=this.selected||s.locationId;
   const scene=d.scenes.find(x=>x.id===this.scene)||d.scenes[0],hour=String(c.gameTime.hour||0).padStart(2,'0'),minute=String(c.gameTime.minute||0).padStart(2,'0');
   const landmarks=d.nodes.filter(WorldNavigation.publicLandmark),selectedRoot=WorldCore.rootOf(d,this.selected)||root;
   this.host.querySelector('.world-scenes').innerHTML=button('scene','斗气大陆','data-id="world" aria-pressed="'+(this.scene==='world')+'"')+'<select data-map-region aria-label="定位大陆地点">'+landmarks.map(n=>'<option value="'+n.id+'"'+(selectedRoot===n.id?' selected':'')+'>'+esc(n.name)+'</option>').join('')+'</select><span>'+hour+':'+minute+' · '+esc(c.worldState.weather||'晴')+'</span>';
   this.host.querySelector('.world-scene-caption').innerHTML='<span>卷 '+String(d.scenes.indexOf(scene)+1).padStart(2,'0')+'</span><h3>'+esc(scene.name)+'</h3><p>'+esc(scene.subtitle)+'</p>';
   this.controls(c);this.directory();this.detail(c);this.contextCard(c);
   const nodes=this.positions().filter(n=>s.discovered.includes(n.id)&&(this.filter==='all'||(this.filter==='independent'?/space/.test(n.layer):n.layer.includes(this.filter)))).map(n=>({...n,known:true,visited:s.visited.includes(n.id)}));
   const nearby=WorldCore.nearbyNpcs(d,c),pins=nearby.map(n=>{const pos=nodes.find(x=>x.id===n.locationId);return pos?{...n,x:pos.x,y:pos.y}:null;}).filter(Boolean);
   const pose=WorldNavigation.position(d,s),displayPose=this.scene==='world'?WorldNavigation.worldPosition(d,s):this.scene===pose.sceneId?pose:null;
   this.host.querySelector('.world-map-legend').innerHTML=this.scene==='world'?'全部地名已标注 · 点击地面 / WASD 自由移动<span>松开按键停步 · 拖动平移 · 滚轮缩放</span>':pose.sceneId===this.scene?'点击地面行走 · 点击人物靠近交谈<span>拖动平移 · 滚轮缩放</span>':'地区预览 · 点选分支查看独立画景<span>查看不移动角色，也不消耗资源</span>';
   if(!this.running&&this.renderer){const request=++this.renderRequest;const retry=this.host.querySelector('[data-map-action=retry-avatar]');if(retry)retry.disabled=true;this.renderPromise=this.renderer.render({scene,nodes,npcs:pins,routes:[],routeIds:[],showRoutes:false,fog:this.fog,selected:this.selected,playerId:this.scene==='world'?root:s.locationId,pose:displayPose,avatar:WorldNavigation.avatar(c.player.gender,s.avatarId),form:this.mode}).then(committed=>{if(committed&&request===this.renderRequest&&retry){retry.hidden=true;retry.disabled=false;}}).catch(e=>{if(request===this.renderRequest)this.renderFailure(e.message);});}
  }
  controls(c){
   const s=c.state,busy=WorldMapBridge.isBusy()||this.preparing;
   this.host.querySelector('.world-avatar-options').innerHTML=WorldNavigation.avatars.map(a=>button('appearance','<span class="world-choice-portrait" style="background-image:url('+a.image+')"></span><span><strong>'+a.name+'</strong><small>'+a.subtitle+'</small></span>','role="radio" aria-checked="'+(a.id===s.avatarId)+'" aria-label="'+a.name+'地图形象" data-id="'+a.id+'"',busy)).join('');
   this.host.querySelector('.world-form-options').innerHTML=Object.values(WorldNavigation.forms).map(f=>button('mode','<span class="world-form-icon">'+({walk:'行',convoy:'驿',flight:'翼'}[f.id])+'</span><span>'+f.name+'<small>'+(f.id==='flight'&&WorldCore.rank(c.player.realm)<5?'斗王解锁':{walk:'沿路漫步',convoy:'骑乘赶路',flight:'直线御空'}[f.id])+'</small></span>','role="radio" aria-checked="'+(f.id===this.mode)+'" data-id="'+f.id+'"',busy||f.id==='flight'&&WorldCore.rank(c.player.realm)<5)).join('');
   this.host.querySelector('.world-form-hint').textContent=this.scene==='world'?'大陆自由移动 · A左 D右 W上 S下':s.pose.airborne?'当前悬空 · 飞到道路附近后可切换落地形态':WorldNavigation.forms[this.mode].description+' · 形象不改变属性';
  }
  contextCard(c){
   const card=this.host.querySelector('.world-context-card');if(!card)return;const people=WorldCore.nearbyNpcs(this.data,c).filter(n=>n.available),npc=people.find(n=>n.id===this.selectedNpc)||people[0];
   card.hidden=this.running||WorldMapBridge.isMoving()||!npc;if(card.hidden)return;
   const affairs=typeof SceneDialogue!=='undefined'&&SceneDialogue.enabled()?SceneDialogue.relevant(c.player.sceneAgenda,{world:c.worldState,target:{npcId:npc.id}}).filter(r=>r.npcId===npc.id).slice(-2):[];
   const notes=affairs.map(r=>'<span class="world-muted">'+esc(SceneDialogue.states[r.status]+' · '+r.evidence)+'</span>').join('');
   card.innerHTML='<span class="world-context-title">'+esc(npc.name)+' <small>'+esc(npc.role)+'</small></span><span class="world-muted">已经走到人物附近</span>'+notes+'<div>'+button('talk','打听消息','data-npc="'+npc.id+'"')+button('llm','自由交谈','data-npc="'+npc.id+'" class="world-primary"')+'</div>';
  }
  detail(c){
   const d=this.data,s=c.state,source=WorldCore.node(d,this.selected);if(!source||!s.discovered.includes(source.id)){this.selected=s.locationId;return this.detail(c);}const n=source.id===this.scene&&source.localName?{...source,name:source.localName}:source;
   const pose=WorldNavigation.position(d,s),target=n.id===this.scene?n.localPosition:[n.x,n.y],local=this.scene!=='world'&&pose.sceneId===this.scene,free=this.scene==='world'&&WorldNavigation.publicLandmark(n),worldPose=WorldNavigation.worldPosition(d,s),here=local?WorldNavigation.distance(pose,{x:target[0],y:target[1]})<=4:free?WorldNavigation.distance(worldPose,n)<=4:this.scene===pose.sceneId&&n.id===s.locationId,trip=local?WorldCore.walkPlan(d,c,this.scene,{x:target[0],y:target[1]},this.mode):free?WorldCore.roamPlan(d,c,n,this.mode):WorldCore.plan(d,c,n.id,this.mode),locked=WorldCore.gate(d,s,n.id,c.player);const busy=WorldMapBridge.isBusy();
   const region=WorldCore.node(d,this.scene),namedRegion=region&&(n.artOf===region.id||n.id===region.id&&!n.localName),leave=namedRegion?button('leave-region','离开'+esc(region.name),'data-id="'+region.id+'"',busy||this.preparing):'';
   let html='<div class="world-location-heading"><span class="world-eyebrow">'+(here?'此刻 · 你在这里':s.visited.includes(n.id)?'曾经到访':'远方 · 已知地点')+'</span><div class="world-location-title"><h3>'+esc(n.name)+'</h3>'+leave+'</div><p>'+esc(n.desc)+'</p></div>';
   const landscape=typeof PlaceScenes!=='undefined'&&PlaceScenes.get(n.id,this.scene);if(landscape)html='<figure class="world-place-art" data-place-art="'+n.id+'" data-place-scene="'+this.scene+'"><img src="'+PlaceScenes.url(n.id,this.scene)+'" alt="'+esc(landscape.name)+'专属画景" width="960" height="640" loading="lazy" decoding="async"><figcaption>'+esc(landscape.name)+' · 地点画景</figcaption>'+PlaceScenes.statusHTML()+'</figure>'+html;
   if(n.type==='residence'&&here)html+=button('residence','查看此处驻地 ↗','class="world-primary"');
   if(locked)html+='<p class="world-notice">'+esc(locked)+'</p>';
   if(!here){
    if(trip.ids)html+='<div class="world-trip"><p>'+trip.ids.map(id=>esc(WorldCore.node(d,id).name)).join(' → ')+'</p></div>';
    if(trip.ok)html+='<p class="world-muted">'+WorldNavigation.forms[this.mode].label+' · 预计 '+Math.round(trip.hours*60)+' 分钟，途中可随时停步。</p>';
    if(!trip.ok)html+='<p class="world-muted">'+esc(trip.reason)+'</p>';
    html+=button('travel','走到 '+esc(n.name),'class="world-primary"',busy||!trip.ok)+'<p class="world-muted">点击地图地点会直接开始行走，途中可停步。</p>';
   }else{
    const enter=this.scene==='world'&&d.scenes.some(x=>x.id===n.id&&x.id!=='world');
    if(enter)html+=button('enter-region','进入'+esc(n.name),'data-id="'+n.id+'" class="world-primary"',busy||!!locked);
   }
   const proposal=WorldMapBridge.getProposal();if(proposal)html+='<section class="world-proposal"><h4>推演中的行动建议</h4><p>'+esc(proposal.type==='travel'?'前往 '+WorldCore.node(d,proposal.targetId).name:({explore:'探寻周边',rest:'休整',talk:'打听消息'}[proposal.type]))+'</p><p class="world-muted">确认后由地图规则检查并结算。</p>'+button('proposal','确认执行','',busy)+button('dismiss','忽略')+'</section>';
   const people=WorldCore.nearbyNpcs(d,c);if(people.length){html+='<section class="world-section"><h4>人间烟火 <small>原创地方人物</small></h4>';for(const npc of people){const quest=s.quests.find(q=>q.npcId===npc.id),available=npc.available;
    html+='<article class="world-person"><div class="world-avatar">'+esc(npc.name[0])+'</div><div class="world-person-info"><strong>'+esc(npc.name)+'</strong><span>'+esc(npc.role)+' · 信任 '+(s.trust[npc.id]||0)+'</span><small>'+esc(WorldCore.node(d,npc.locationId)?.name)+' · '+(available?'可交谈':'需先靠近')+'</small></div><div class="world-person-actions">'+button('npc-place','寻人','data-id="'+npc.locationId+'"')+button('talk','打听','data-npc="'+npc.id+'"',busy||!available)+button('llm','自由交谈','data-npc="'+npc.id+'"',busy||!available)+button(quest?.status==='active'?'complete':'accept',quest?.status==='completed'?'已交付':quest?'交付委托':'接取委托','data-npc="'+npc.id+'"',busy||!available||quest?.status==='completed')+'</div>';
    if(quest?.status==='active')html+='<p class="world-muted">'+(quest.kind==='herbs'?'交付低阶药材 ×3（现有 '+WorldCore.inventoryCount(c,'低阶药材')+'）':'到访 '+esc(WorldCore.node(d,quest.target)?.name)+' 后返回')+'</p>';
    html+='</article>'; }html+='</section>';}
   html+='<section class="world-section"><h4>行旅手札 <small>'+s.visited.length+'处足迹</small></h4>'+(s.journal.length?'<ol class="world-journal">'+s.journal.slice(-5).reverse().map(e=>'<li>'+esc(e.text)+'</li>').join('')+'</ol>':'<p class="world-muted">旅程尚未落笔。与人交谈，或走向远方。</p>')+'</section>';
   html+='<details class="world-source"><summary>地点出处与设计说明</summary><p>'+(n.sourceType==='novel-evidence'?'小说地点线索：'+esc((n.sources||[]).map(x=>typeof x==='object'?JSON.stringify(x):x).join('；')):'为游玩设计的原创地点与互动。')+'</p><p>画面布局、道路耗时和地方人物均为游戏设计值。独立空间通过入口连接，不代表地表方位。</p></details>';
   this.artDispose?.();this.host.querySelector('.world-detail').innerHTML=html;this.artDispose=typeof PlaceScenes!=='undefined'&&PlaceScenes.bindImages?PlaceScenes.bindImages(this.host.querySelector('.world-detail')):null;
  }
  async move(request){
   if(this.running||this.preparing){if(request.nodeId&&request.nodeId===this.activeRequest?.nodeId)return;this.queued=request;if(this.localMotion)this.renderer?.stopWalking('retarget');this.status(this.localMotion?'正在调整行进方向…':'已更新下一处目的地，抵达当前路段后继续。');return;}
   if(WorldMapBridge.isBusy()){this.status('请等推演完成后再行走。');return;}
   this.activeRequest=request;this.preparing=true;this.cancelRequested=false;let lease;try{
    await this.renderPromise;if(request.sceneId&&request.sceneId!==this.scene)throw Error('地图层级已变化，请重新点选目的地');let c=this.ctx();const d=this.data,pose=WorldNavigation.position(d,c.state);let node=request.nodeId?WorldCore.node(d,request.nodeId):null;
    if(node){const locked=WorldCore.gate(d,c.state,node.id,c.player);if(locked)throw Error(locked);this.selected=node.id;this.selectedNpc=request.npcId;}
    const root=WorldCore.rootOf(d,c.state.locationId),targetRoot=node?WorldCore.rootOf(d,node.id):null;
    const free=this.scene==='world'&&(!node||WorldNavigation.publicLandmark(node)),local=!free&&(!node||pose.sceneId!=='world'&&targetRoot===root);this.localMotion=local||free;let trip,points,action;
    if(free){trip=WorldCore.roamPlan(d,c,request.point||node,this.mode,true);if(!trip.ok){if(trip.reason==='已经到达这里'){this.update();return;}throw Error(trip.reason);}points=trip.points;action={type:'roam',sceneId:'world',x:trip.target.x,y:trip.target.y,mode:this.mode};}
    else if(local){if(this.scene!==pose.sceneId)throw Error('请先切回角色当前所在的地区');const p=request.point||(node.id===root?{x:node.localPosition[0],y:node.localPosition[1]}:{x:node.x,y:node.y});trip=WorldCore.walkPlan(d,c,pose.sceneId,p,this.mode);if(!trip.ok){if(trip.reason==='已经到达这里'){this.update();return;}throw Error(trip.reason);}points=trip.points;action={type:'walk',sceneId:pose.sceneId,x:trip.target.x,y:trip.target.y,mode:this.mode};}
    else{trip=WorldCore.plan(d,c,node.id,this.mode);if(!trip.ok)throw Error(trip.reason);this.scene='world';this.update();await this.renderPromise;points=trip.ids.map(id=>WorldCore.node(d,WorldCore.rootOf(d,id))).map(n=>({x:n.x,y:n.y})).filter((p,i,a)=>!i||WorldNavigation.distance(p,a[i-1])>.01);action={type:'travel',targetId:node.id,mode:this.mode};}
    if(!this.renderer)throw Error('地图画面尚未载入，请稍后再试');if(this.renderer.actorReady===false)throw Error('角色贴图尚未载入，请稍后重试或刷新地图');
    this.update();await this.renderPromise;if(this.renderer.actorReady===false)throw Error('角色贴图未能载入，请刷新地图后重试');if(this.cancelRequested)throw Error('已取消行走');this.running=true;this.preparing=false;lease=WorldMapBridge.beginMovement();if(lease===null)throw Error('另一个行动正在进行，请稍候');
    this.running=true;this.activeMode=this.mode;this.detail(this.ctx());this.contextCard(this.ctx());const bar=this.host.querySelector('.world-walkbar'),label=bar.querySelector('.world-walk-label'),progress=bar.querySelector('progress');bar.hidden=false;label.textContent=WorldNavigation.forms[this.mode].label+' · '+(node?.name||(free?'所选地面':'所选道路'));this.status(trip.limited?trip.limitReason+'，先走当前资源支持的路程；途中可按 Esc 停步。':'角色正在行走，途中可按 Esc 停步。',trip.limited?'warning':'info');
    const result=await this.renderer.animatePath(points,{mode:this.activeMode,duration:local||free?undefined:Math.max(this.activeMode==='flight'?650:this.activeMode==='convoy'?900:1100,Math.min(10000,points.slice(1).reduce((n,p,i)=>n+WorldNavigation.distance(points[i],p),0)/WorldNavigation.forms[this.activeMode].speed*1000)),onProgress:p=>{progress.value=Math.round(p*100);}});
    if(result.reason==='hidden')this.queued=null;
    if(!result.completed){if((local||free)&&result.position&&WorldNavigation.distance(points[0],result.position)>.15)action={type:free?'roam':'walk',sceneId:free?'world':pose.sceneId,x:result.position.x,y:result.position.y,mode:this.activeMode};else action=null;}
    const next=WorldMapBridge.finishMovement(lease,action);lease=undefined;if(next)this.status(result.completed?(trip.limited?next.message+' '+trip.limitReason+'，补充后可继续赶路。':next.message):'已在途中停步，位置与步行消耗已保存。',result.completed&&trip.limited?'warning':'info');else this.status('已停步，本次行旅未结算。');
   }catch(e){this.status(e.message,'warning');if(lease!==undefined)WorldMapBridge.finishMovement(lease,null);}
   finally{this.running=false;this.preparing=false;this.localMotion=false;const bar=this.host.querySelector('.world-walkbar');if(bar)bar.hidden=true;this.update();if(this.queued){const queued=this.queued;this.queued=null;this.move(queued);}}
  }
  discovery(kind){
   const c=this.ctx(),board=this.host.querySelector('.world-discovery-board');if(this.running||this.preparing){this.status('先停步再查看沿途线索');return;}
   board.hidden=false;
   if(kind==='encounters'){
    const people=WorldCore.nearbyNpcs(this.data,c).filter(n=>c.state.discovered.includes(n.locationId));
    board.innerHTML='<h3>此地可寻之人</h3><p>先查看人物所在地点，再决定是否前往。</p>'+people.map(n=>'<article><strong>'+esc(n.name)+'</strong><p>'+esc(n.role)+' · '+esc(WorldCore.node(this.data,n.locationId)?.name)+'</p>'+button('preview','查看位置','data-id="'+n.locationId+'"')+'</article>').join('')+(!people.length?'<p>此地区尚无已知人物，可换一处城镇寻访。</p>':'');
   }else{
    const nodes=this.positions().filter(n=>c.state.discovered.includes(n.id)&&n.id!==c.state.locationId);const fresh=nodes.filter(n=>!c.state.visited.includes(n.id)),pool=fresh.length?fresh:nodes;
    const n=pool[(this.sceneryCursor||0)%Math.max(1,pool.length)];this.sceneryCursor=(this.sceneryCursor||0)+1;
    board.innerHTML=n?'<h3>'+(fresh.length?'未曾到访的一景':'重访此间风景')+'</h3><strong>'+esc(n.name)+'</strong><p>'+esc(n.desc)+'</p>'+button('preview','查看画景与路线','data-id="'+n.id+'"'):'<h3>暂无线索</h3><p>先在当前地区探寻周边，获得新的地点线索。</p>';
   }
   board.innerHTML+=button('close-discovery','收起');board.scrollIntoView?.({block:'nearest',behavior:'smooth'});
  }
  action(type,attrs){
   if(type==='buy'||type==='sell')return;
   if(type==='leave-region'){if(this.running||this.preparing||WorldMapBridge.isBusy()){this.status('请先停步或等待当前行动完成');return;}const pose=WorldNavigation.position(this.data,this.ctx().state),result=pose.sceneId===attrs.id?WorldMapBridge.execute({type:'leave-region',targetId:attrs.id}):{message:'已返回斗气大陆地图。'};if(result){this.scene='world';this.selected=attrs.id;this.query='';this.filter='all';this.host.querySelector('select[aria-label="地点层级"]').value='all';this.host.querySelector('input[type=search]').value='';this.update();this.status(result.message);}return;}
   if(type==='sheet-left'||type==='sheet-right'){const stage=this.host.querySelector('.world-stage');stage?.scrollBy?.({left:(type==='sheet-left'?-1:1)*Math.max(240,this.host.clientWidth*.8),behavior:this.motion?'smooth':'auto'});return;}
   if(type==='enter-region'){if(this.running||this.preparing){this.status('先停步再进入街巷');return;}const pose=WorldNavigation.position(this.data,this.ctx().state);const result=pose.sceneId===attrs.id?{message:'已展开'+WorldCore.node(this.data,attrs.id).name+'地区地图。'}:WorldMapBridge.execute({type:'enter-region',targetId:attrs.id});if(result){this.scene=attrs.id;this.selected=attrs.id;this.query='';this.filter='all';this.host.querySelector('select[aria-label="地点层级"]').value='all';this.host.querySelector('input[type=search]').value='';this.update();this.status(result.message);}return;}
   if(type==='region'){if(this.running||this.preparing){this.status('先停步再切换查看地区');return;}const n=WorldCore.node(this.data,attrs.id);if(!n||!WorldNavigation.publicLandmark(n))return;this.scene='world';this.selected=n.id;this.query='';this.filter='all';this.host.querySelector('select[aria-label="地点层级"]').value='all';this.host.querySelector('input[type=search]').value='';this.update();this.renderPromise?.then(()=>{if(this.destroyed||this.scene!=='world'||this.selected!==n.id)return;this.renderer?.focus(n.id);});this.status('已定位'+n.name+'；查看地图不会移动角色，点击地图后可用 WASD 自由行走。');return;}
   if(type==='retry-avatar'){if(WorldMapBridge.isBusy()||this.preparing){this.status('请先结束当前行动再重试角色');return;}this.status('正在重新载入角色…');this.update();return;}
   if(type==='residence'){if(typeof switchGameView==='function')switchGameView('studio',document.getElementById('sidebar-studio'));else this.status('正式游戏中可在驻地页整理此处档案；居住权限以故事为准。');return;}
   if(type==='encounters'||type==='wander'){this.discovery(type);return;}
   if(type==='close-discovery'){this.host.querySelector('.world-discovery-board').hidden=true;return;}
   if(type==='preview'){this.selected=attrs.id;this.update();this.renderer?.focus(attrs.id);this.host.querySelector('.world-detail').scrollIntoView?.({block:'nearest',behavior:'smooth'});this.status('已查看目的地，点击前往后才会行走与结算。');return;}
   if(type==='select'||type==='npc-place'){this.selectPoint(attrs.id);return;}
   if(type==='travel'){this.move({nodeId:this.selected});return;}
   if(type==='stop'){this.cancelRequested=true;this.queued=null;this.renderer?.stopWalking();return;}
   if(type==='scene'){if(this.running||this.preparing){this.status('先停步再切换地图层级');return;}if(!this.data.scenes.some(s=>s.id===attrs.id))return;this.scene=attrs.id;const root=WorldCore.rootOf(this.data,this.ctx().state.locationId);this.selected=attrs.id==='world'?root:attrs.id;this.filter='all';this.host.querySelector('select[aria-label="地点层级"]').value='all';this.query='';this.host.querySelector('input[type=search]').value='';this.update();this.status('已展开地区地图；查看不改变角色位置，点选分支可看专属画景。');return;}
   if(type==='mode'){if(this.preparing||this.running){this.status('先停步再切换移动形态');return;}WorldMapBridge.execute({type:'movement-mode',mode:attrs.id});return;}
   if(type==='appearance'){if(this.preparing||this.running){this.status('先停步再切换形象');return;}WorldMapBridge.execute({type:'appearance',avatarId:attrs.id});return;}
   if(type==='zoom-in'||type==='zoom-out'){this.renderer?.zoomAt(type==='zoom-in'?1.25:.8);return;}
   if(type==='reset'){this.renderer?.reset();return;}
   if(type==='locate'){this.scene=this.ctx().state.scene;this.selected=this.ctx().state.locationId;this.update();this.renderer?.centerActor();return;}
   if(type==='llm'){WorldMapBridge.talkIntent(attrs.npc);return;}
   if(type==='dismiss'){WorldMapBridge.clearProposal();return;}
   let a={type};if(type==='travel')a={type,targetId:this.selected,mode:this.mode};if(['talk','accept','complete','buy','sell'].includes(type))a={type,npcId:attrs.npc,itemId:attrs.item,qty:1};if(type==='proposal')a=WorldMapBridge.getProposal();
   if(a?.type==='travel'){if(a.mode&&a.mode!==this.mode&&!WorldMapBridge.execute({type:'movement-mode',mode:a.mode}))return;this.move({nodeId:a.targetId});return;}
   if(a){if(['explore','rest'].includes(a.type))return;const result=WorldMapBridge.execute(a);if(result)this.status(result.message);}
  }
  destroy(){this.destroyed=true;this.renderRequest=(this.renderRequest||0)+1;this.artDispose?.();this.queued=null;this.renderer?.stopWalking();WorldMapBridge.cancelMovement();this.unsubscribe?.();this.renderer?.destroy();instances.delete(this.host);}
 }
 async function mount(host){if(!host)return;const existing=instances.get(host);if(existing){existing.update();existing.renderer?.resize();return existing;}const view=new MapView(host);instances.set(host,view);await view.init();return view;}
 return {mount,async focus(host,id){const view=await mount(host);if(!view)throw Error('地图容器不存在');const ctx=view.ctx(),node=view.data.nodes.find(n=>n.id===id);if(!node||!ctx.state.discovered.includes(id))throw Error('地点尚未发现');view.scene=node.scene||'world';view.selected=id;view.query='';view.filter='all';view.update();view.renderer?.reset();view.host.querySelector('.world-directory').open=true;view.status('已查看线索地点，尚未开始旅行。');return true;}};
})();
