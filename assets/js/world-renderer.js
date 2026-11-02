class WorldRenderer {
 static labelPlan(nodes,{selected,zoom,scale,width,height,W,H,pan}){
  const major=new Set(['wutan','qingshan','shimo','capital','tager','blackcorner','outer','tianya','zhongzhou','holy-pill','beast-region','ancient-city']);
  const boxes=[],result=[],offsetX=(width-W*scale)/2+pan.x,offsetY=(height-H*scale)/2+pan.y;
  const sorted=nodes.map(n=>({n,priority:n.id===selected?100:major.has(n.id)?80:['city','town','region','macro-region','academy'].includes(n.type)?50:20})).sort((a,b)=>b.priority-a.priority||a.n.id.localeCompare(b.n.id));
  for(const {n,priority} of sorted){
   const x=n.x*W*scale/100+offsetX,y=n.y*H*scale/100+offsetY,font=priority===100?17:16,text=n.name;
   const visible=x>=0&&x<=width&&y>=0&&y<=height;
   const item={id:n.id,text,font,visible:false,dx:0,dy:14};result.push(item);if(!visible)continue;
   const w=Math.min(width-8,[...text].length*font+8),h=font*1.45,candidates=[[0,14],[0,-h-14],[w/2+14,-h/2],[-w/2-14,-h/2],[w/2+10,14],[-w/2-10,-h-14]];
   // Every on-screen public point retains its full name. Search outward only when neighbours collide.
   for(let radius=28;radius<=Math.max(width,height);radius+=28)for(let angle=0;angle<16;angle++)candidates.push([Math.cos(angle*Math.PI/8)*radius,Math.sin(angle*Math.PI/8)*radius]);
   for(const [dx,dy] of candidates){const box={x:Math.max(4,Math.min(width-w-4,x+dx-w/2)),y:Math.max(4,Math.min(height-h-4,y+dy)),w,h};
    if(boxes.some(b=>box.x<b.x+b.w+6&&box.x+box.w+6>b.x&&box.y<b.y+b.h+4&&box.y+box.h+4>b.y))continue;
    boxes.push(box);Object.assign(item,{visible:true,dx:box.x+w/2-x,dy:box.y-y,box});break;
   }
   if(!item.visible){const box={x:Math.max(4,Math.min(width-w-4,x-w/2)),y:Math.max(4,Math.min(height-h-4,y+14)),w,h};Object.assign(item,{visible:true,dx:box.x+w/2-x,dy:box.y-y,box});}
  }
  return result;
 }
 constructor(host,select,onGround){this.onGround=onGround;this.follow=true;this.host=host;this.select=select;this.W=DoupoWorldData.worldWidth;this.H=DoupoWorldData.worldHeight;this.zoom=1;this.pan={x:0,y:0};this.pointers=new Map();this.heldKeys=new Set();this.cleanups=[];this.motion=!matchMedia('(prefers-reduced-motion: reduce)').matches;this.generation=0;this.pending=new Set();this.active=true;}
 async init(){
  // File URLs can display local images, but cannot fetch/upload them as WebGL textures.
  // Choose the existing image/CSS renderer before Pixi attempts to load any assets.
  if(globalThis.location?.protocol==='file:'){
   this.fallback('直接打开本地文件时使用轻量地图，行走与人物切换仍然可用');
  }else try{
   if(new URLSearchParams(location.search).get('mapRenderer')==='lightweight')throw Error('lightweight');
   this.app=new PIXI.Application();await this.app.init({resizeTo:this.host,backgroundAlpha:0,antialias:true,resolution:Math.min(devicePixelRatio||1,1.5),autoDensity:true,autoStart:false,preference:'webgl'});
   this.host.dataset.renderer='pixi';this.host.appendChild(this.app.canvas);this.canvas=this.app.canvas;this.world=new PIXI.Container();this.app.stage.addChild(this.world);this.app.ticker.maxFPS=30;
   this.app.ticker.add(t=>{if(!this.active)return;if(this.actor&&!this.walking&&this.actorPosition)this.actor.pose(this.actorPosition,this.actorDirection||0,0,(this.time||0)*1000,false,this.motion);this.time=(this.time||0)+t.deltaMS/1000;for(const item of this.animated||[]){item.obj.y=item.y+Math.sin(this.time*1.3+item.phase)*1.2;}if(this.playerHalo)this.playerHalo.alpha=.35+Math.sin(this.time*2)*.15;});
   this.bind(this.canvas,'webglcontextlost',e=>{e.preventDefault();this.fallback('图形设备暂不可用，已切换轻量地图');});
  }catch{this.fallback('使用轻量地图，地点与旅行功能仍然可用');}
  this.installInput();this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(this.host);
  this.visibilityObserver=new IntersectionObserver(entries=>{this.active=entries[0]?.isIntersecting&&!document.hidden;if(this.active)this.resize();this.syncTicker();this.draw(true);});this.visibilityObserver.observe(this.host);
  this.bind(document,'visibilitychange',()=>{this.active=!document.hidden&&!!this.host.getClientRects().length;if(this.active)this.resize();this.syncTicker();this.draw(true);});
  this.resize();return this;
 }
 bind(el,event,cb,options){el.addEventListener(event,cb,options);this.cleanups.push(()=>el.removeEventListener(event,cb,options));}
 fallback(reason){
  if(this.fallbackEl)return;this.generation++;this.cancelPending();this.stopWalking('renderer');this.mode='dom';if(this.app){this.app.stop();if(this.app.canvas)this.app.canvas.hidden=true;}
  this.fallbackEl=document.createElement('div');this.fallbackEl.className='world-fallback';this.fallbackEl.style.width=this.W+'px';this.fallbackEl.style.height=this.H+'px';this.host.appendChild(this.fallbackEl);this.canvas=this.fallbackEl;
  this.host.dataset.renderer='lightweight';this.host.setAttribute('aria-description',reason);if(this.model)this.render(this.model).catch(e=>this.onError?.(e.message));
 }
 installInput(){
  const el=this.host;
  this.bind(el,'pointerdown',e=>{if(e.target.closest('button'))return;el.focus?.({preventScroll:true});this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});e.target.setPointerCapture?.(e.pointerId);this.last={x:e.clientX,y:e.clientY};this.dragOrigin={...this.last};this.moved=false;this.pinch=null;});
  this.bind(el,'pointermove',e=>{
   if(!this.pointers.has(e.pointerId))return;this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
   if(this.pointers.size===2){const p=[...this.pointers.values()],dist=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);if(this.pinch)this.zoomAt(dist/this.pinch,(p[0].x+p[1].x)/2-el.getBoundingClientRect().left,(p[0].y+p[1].y)/2-el.getBoundingClientRect().top);this.pinch=dist;this.moved=true;return;}
   if(!this.moved&&Math.hypot(e.clientX-this.dragOrigin.x,e.clientY-this.dragOrigin.y)<6)return;this.moved=true;this.manualCameraUntil=performance.now()+1200;const dx=e.clientX-this.last.x,dy=e.clientY-this.last.y;this.pan.x+=dx;this.pan.y+=dy;this.last={x:e.clientX,y:e.clientY};this.transform();
  });
  // Use one native pointer path for both renderers. Pixi hit testing can miss taps
  // after the scrollable map changes layout; dragging must never start a trip.
  const end=e=>{if(this.pointers.has(e.pointerId)&&!this.moved&&e.type==='pointerup'&&!e.target.closest('button'))this.tapAt(e.clientX,e.clientY);this.pointers.delete(e.pointerId);this.pinch=null;if(this.pointers.size)this.last=[...this.pointers.values()][0];};this.bind(el,'pointerup',end);this.bind(el,'pointercancel',end);
  this.bind(el,'wheel',e=>{e.preventDefault();const rect=el.getBoundingClientRect();this.zoomAt(Math.exp(-e.deltaY*.001),e.clientX-rect.left,e.clientY-rect.top);},{passive:false});
  const keyOf=key=>({ArrowLeft:'a',ArrowRight:'d',ArrowUp:'w',ArrowDown:'s'}[key]||key.toLowerCase());
  this.bind(el,'keydown',e=>{if(e.target!==el||e.ctrlKey||e.metaKey||e.altKey)return;const key=keyOf(e.key);if(key==='escape'){e.preventDefault();this.releaseKeys();if(this.onStop)this.onStop();else this.stopWalking();return;}if(['w','a','s','d'].includes(key)){e.preventDefault();if(this.model?.scene.id==='world'){if(this.heldKeys.has(key))return;this.heldKeys.add(key);this.keyboardTarget();return;}const steps={w:[0,-7],a:[-7,0],s:[0,7],d:[7,0]},v=steps[key],p=this.actorPosition||this.model?.pose;if(p&&(!this.walking||this.lastMoveKey!==key)){this.lastMoveKey=key;this.onGround?.({x:p.x+v[0],y:p.y+v[1]});}return;}if(e.key==='+'||e.key==='=')this.zoomAt(1.2);if(e.key==='-')this.zoomAt(.8);});
  this.bind(el,'keyup',e=>{const key=keyOf(e.key);this.lastMoveKey=null;if(!this.heldKeys.delete(key))return;e.preventDefault();if(this.heldKeys.size)this.keyboardTarget();else this.releaseKeys();});
  this.bind(el,'blur',()=>this.releaseKeys());
  this.bind(document,'visibilitychange',()=>{if(document.hidden)this.releaseKeys();});
 }
 tapAt(clientX,clientY){
  const rect=this.host.getBoundingClientRect(),scale=(this.fit||.5)*this.zoom,x=clientX-rect.left,y=clientY-rect.top;
  if(!this.width||!this.height||x<0||y<0||x>rect.width||y>rect.height)return;
  const ox=(this.width-this.W*scale)/2+this.pan.x,oy=(this.height-this.H*scale)/2+this.pan.y;
  const contains=b=>b&&x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h;
  if(this.mode!=='dom'){
   for(const npc of [...(this.model?.npcs||[])].reverse()){const px=ox+(npc.x*this.W/100+25)*scale,py=oy+(npc.y*this.H/100-15)*scale;if(Math.hypot(x-px,y-py)<=Math.max(14,20*scale)){this.select(npc.locationId,npc.id);return;}}
   for(const record of [...(this.tapTargets||[])].reverse()){
    const px=ox+record.node.x*this.W*scale/100,py=oy+record.node.y*this.H*scale/100;
    const label=this.model?.scene.id==='world'?record.box:{x:px-record.text.width*scale/2,y:py+17*scale,w:record.text.width*scale,h:record.text.height*scale};
    if(Math.hypot(x-px,y-py)<=Math.max(12,15*scale)||contains(label)){this.select(record.node.id);return;}
   }
  }
  const point={x:(x-ox)/scale/this.W*100,y:(y-oy)/scale/this.H*100};
  if(point.x>=0&&point.x<=100&&point.y>=0&&point.y<=100)this.onGround?.(point);
 }
 keyboardTarget(){
  const keys=this.heldKeys,p=this.actorPosition||this.model?.pose,dx=Number(keys.has('d'))-Number(keys.has('a')),dy=Number(keys.has('s'))-Number(keys.has('w'));if(!p)return;
  if(!dx&&!dy){if(this.keyboardDriving){this.keyboardDriving=false;if(this.onStop)this.onStop();else this.stopWalking();}return;}
  const distance=Math.min(dx>0?(100-p.x)/dx:dx<0?-p.x/dx:Infinity,dy>0?(100-p.y)/dy:dy<0?-p.y/dy:Infinity);if(distance<.15)return;
  this.keyboardDriving=true;this.onGround?.({x:Math.max(0,Math.min(100,p.x+dx*distance)),y:Math.max(0,Math.min(100,p.y+dy*distance)),input:'keyboard'});
 }
 releaseKeys(){this.heldKeys.clear();if(!this.keyboardDriving)return;this.keyboardDriving=false;if(this.onStop)this.onStop();else this.stopWalking();}
 resize(){const r=this.host.getBoundingClientRect();if(!r.width||!r.height)return;this.width=r.width;this.height=r.height;this.fit=Math.min(r.width/this.W,r.height/this.H);if(this.app?.renderer&&this.mode!=='dom')this.app.renderer.resize(r.width,r.height);this.transform();this.draw(true);}
 transform(){
  if(!Number.isFinite(this.width)||!Number.isFinite(this.height)||this.width<=0||this.height<=0)return;
  const scale=(this.fit||.5)*this.zoom;
  const boundX=Math.max(0,(this.W*scale-this.width)/2),boundY=Math.max(0,(this.H*scale-this.height)/2);this.pan.x=Math.max(-boundX,Math.min(boundX,this.pan.x));this.pan.y=Math.max(-boundY,Math.min(boundY,this.pan.y));
  const x=(this.width-this.W*scale)/2+this.pan.x,y=(this.height-this.H*scale)/2+this.pan.y;
  if(this.world){this.world.scale.set(scale);this.world.position.set(x,y);if(!this.labelRecords?.length)for(const item of this.labels||[])item.alpha=this.zoom>1.4||item.priority?1:.55;}
  if(this.fallbackEl)this.fallbackEl.style.transform=`translate(${x}px,${y}px) scale(${scale})`;
  this.layoutLabels(scale);
  this.sizeAvatar();this.draw();
 }
 layoutLabels(scale){
  if(!this.labelRecords?.length)return;const key=[scale.toFixed(4),this.pan.x.toFixed(1),this.pan.y.toFixed(1),this.width,this.height].join(':');if(this.labelLayoutKey===key)return;this.labelLayoutKey=key;
  const placements=WorldRenderer.labelPlan(this.labelRecords.map(r=>r.node),{selected:this.labelSelected,zoom:this.zoom,scale,width:this.width,height:this.height,W:this.W,H:this.H,pan:this.pan}),byId=new Map(placements.map(p=>[p.id,p]));
  for(const record of this.labelRecords){const p=byId.get(record.node.id);record.box=p.visible?p.box:null;if(record.text){record.text.visible=p.visible;record.text.text=p.text;record.text.style.fontSize=p.font;record.text.scale.set(1/scale);record.text.x=p.dx/scale;record.text.y=p.dy/scale;record.text.alpha=1;}
   const end={x:Math.max(p.dx-p.box?.w/2||0,Math.min(p.dx+p.box?.w/2||0,0)),y:Math.max(p.dy,Math.min(p.dy+p.font*1.45,0))},length=Math.hypot(end.x,end.y),leader=p.visible&&length>8&&(Math.abs(p.dx)>20||p.dy>30||p.dy<-40);
   if(record.dot)record.dot.hitArea={contains:(x,y)=>Math.hypot(x,y)<=18/scale};
   if(record.text?.parent){if(!record.leader){record.leader=new PIXI.Graphics();record.leader.eventMode='none';if(record.text.parent.addChildAt)record.text.parent.addChildAt(record.leader,0);else record.text.parent.addChild(record.leader);}record.leader.clear();if(leader)record.leader.moveTo(0,0).lineTo(end.x/scale,end.y/scale).stroke({color:0x365945,width:1/scale,alpha:.65});}
   if(record.button){record.button.style.transform=`translate(-50%,-50%) scale(${1/scale})`;record.label.hidden=!p.visible;record.label.textContent=p.text;record.label.style.fontSize=p.font+'px';record.label.style.left=(12+p.dx)+'px';record.label.style.top=(12+p.dy)+'px';if(!record.leader){record.leader=document.createElement('span');record.leader.className='world-label-leader';record.button.appendChild(record.leader);}record.leader.hidden=!leader;record.leader.style.width=length+'px';record.leader.style.transform='rotate('+Math.atan2(end.y,end.x)+'rad)';}}
  this.host.dataset.visibleLabels=String(placements.filter(p=>p.visible).length);
 }
 zoomAt(factor,x=this.width/2,y=this.height/2){
  const old=(this.fit||.5)*this.zoom;this.zoom=Math.max(1,Math.min(5,this.zoom*factor));const next=(this.fit||.5)*this.zoom;
  const oldX=(this.width-this.W*old)/2+this.pan.x,oldY=(this.height-this.H*old)/2+this.pan.y;
  this.pan.x=x-(x-oldX)*next/old-(this.width-this.W*next)/2;this.pan.y=y-(y-oldY)*next/old-(this.height-this.H*next)/2;this.transform();
 }
 reset(){this.zoom=1;this.pan={x:0,y:0};this.transform();}
 centerActor(){const p=this.actorPosition;if(!p)return;this.zoom=Math.max(1.6,this.zoom);const scale=(this.fit||.5)*this.zoom;this.pan.x=-(p.x/100*this.W-this.W/2)*scale;this.pan.y=-(p.y/100*this.H-this.H/2)*scale;this.transform();}
 focus(id){const n=this.model?.nodes.find(n=>n.id===id);if(!n)return;this.zoom=Math.max(this.model.scene.id==='world'?2.4:1.4,this.zoom);this.pan.x=-(n.x/100*this.W-this.W/2)*(this.fit||.5)*this.zoom;this.pan.y=-(n.y/100*this.H-this.H/2)*(this.fit||.5)*this.zoom;this.transform();}
 draw(force=false){if(this.app?.renderer&&this.mode!=='dom'&&(force||!this.app.ticker.started))this.app.render();}
 syncTicker(){if(!this.app||this.mode==='dom')return;if(this.active&&this.motion)this.app.start();else{this.app.stop();this.draw();}}
 setMotion(value){this.motion=value;this.syncTicker();}
 cancelPending(){for(const ticket of this.pending||[])this.disposePending(ticket);}
 disposePending(ticket){if(!ticket||ticket.done)return;ticket.done=true;this.pending.delete(ticket);ticket.actor?.destroy();ticket.world?.destroy({children:true});ticket.background?.release();ticket.dom?.replaceChildren();}
 valid(ticket){return !this.destroyed&&!ticket.done&&ticket.generation===this.generation;}
 markActor(model){this.actorReady=true;this.host.dataset.actorLoading='false';this.host.dataset.actorError='false';this.host.dataset.actorAvatar=this.actor?.avatar.id||'';this.host.dataset.actorForm=this.actor?.form||'';this.host.dataset.actorX=this.actorPosition?.x??'';this.host.dataset.actorY=this.actorPosition?.y??'';this.host.setAttribute('aria-description',this.actor?this.actor.avatar.name+' · '+WorldNavigation.forms[this.actor.form].label:'此地区暂未显示角色');this.onReady?.();}
 retireWorld(actor,world,background){if(world&&actor?.root?.parent===world)world.removeChild(actor.root);actor?.destroy();world?.destroy({children:true});background?.release();}
 async render(model){
  if(this.destroyed)return false;const generation=++this.generation;this.cancelPending();this.model=model;this.actorReady=false;this.host.dataset.actorLoading='true';
  const ticket={generation,done:false,width:model.scene.width||DoupoWorldData.worldWidth,height:model.scene.height||DoupoWorldData.worldHeight};this.pending.add(ticket);
  try{
   if(this.mode==='dom')return await this.renderFallback(model,ticket);const W=ticket.width,H=ticket.height;
   const backgroundLease=await WorldActor.acquire(model.scene.art,'background');
   if(!this.valid(ticket)){backgroundLease.release();if(this.destroyed)WorldActor.trimAssets(true);return false;}ticket.background=backgroundLease;
   const texture=ticket.background.texture,stage=new PIXI.Container();ticket.world=stage;stage.eventMode='none';const labels=[],animated=[],labelRecords=[],tapTargets=[];
   const background=new PIXI.Sprite(texture);background.width=W;background.height=H;stage.addChild(background);
  if(model.fog){const veil=new PIXI.Graphics().rect(0,0,W,H).fill({color:0xeaf0d9,alpha:.12});stage.addChild(veil);}
  const points=new Map(model.nodes.map(n=>[n.id,n]));
  const lines=new PIXI.Graphics();
  for(const edge of model.routes){const a=points.get(edge.a),b=points.get(edge.b);if(!a||!b)continue;const highlight=model.routeIds.includes(edge.id);if(!highlight&&!model.showRoutes)continue;const ax=a.x*W/100,ay=a.y*H/100,bx=b.x*W/100,by=b.y*H/100;lines.moveTo(ax,ay).quadraticCurveTo((ax+bx)/2,(ay+by)/2-15,bx,by).stroke({color:highlight?0xfff3be:0x607c63,width:highlight?6:2,alpha:highlight?.95:.22});}
  stage.addChild(lines);
  for(const n of model.nodes){
   if(!n.known)continue;const marker=new PIXI.Container();marker.position.set(n.x*W/100,n.y*H/100);
   const selected=n.id===model.selected,visited=n.visited;
   const dot=new PIXI.Graphics().circle(0,0,selected?15:10).fill({color:selected?0x315e4c:0xf9f5e4,alpha:.96}).stroke({color:selected?0xc9ad67:0x668269,width:2});marker.addChild(dot);
   if(visited)marker.addChild(new PIXI.Graphics().circle(0,0,4).fill(0x5f8c6a));
   const text=new PIXI.Text({text:n.name,style:{fontFamily:'Noto Serif SC, serif',fontSize:model.scene.id==='world'?21:25,fontWeight:'500',fill:0x254938,stroke:{color:0xfff9e4,width:5},align:'center'}});text.anchor.set(.5,0);text.y=17;text.priority=selected||['wutan','qingshan','shimo','capital','holy-pill','blackcorner'].includes(n.id);labels.push(text);marker.addChild(text);const target={node:n,text,dot};tapTargets.push(target);if(model.scene.id==='world')labelRecords.push(target);
   stage.addChild(marker);
  }
  for(const npc of model.npcs){const pin=new PIXI.Container();pin.position.set(npc.x*W/100+25,npc.y*H/100-15);const body=new PIXI.Graphics().ellipse(0,16,10,4).fill({color:0x334b3a,alpha:.25}).moveTo(-6,13).lineTo(0,-2).lineTo(6,13).closePath().fill(0x9b6446).circle(0,-5,5).fill(0xe4cba0);pin.addChild(body);stage.addChild(pin);animated.push({obj:pin,y:pin.y,phase:WorldCore.hash(npc.id)%20});}
  await this.createAvatar(model,ticket);
   if(!this.valid(ticket)){this.disposePending(ticket);return false;}
   const oldActor=this.actor,oldWorld=this.world,oldBackground=this.backgroundLease,changedScene=this.committedScene!==model.scene.id;
   this.app.stage.addChild(stage);this.W=W;this.H=H;this.world=stage;this.actor=ticket.actor||null;this.actorRoot=this.actor?.root||null;this.backgroundLease=ticket.background;this.labels=labels;this.animated=animated;this.tapTargets=tapTargets;this.labelRecords=labelRecords;this.labelSelected=model.selected;this.labelLayoutKey=null;
   ticket.done=true;this.pending.delete(ticket);this.committedScene=model.scene.id;
   this.retireWorld(oldActor,oldWorld,oldBackground);
   if(changedScene){this.zoom=1;this.pan={x:0,y:0};}this.resize();if(model.pose)this.setActorPose(model.pose,model.pose.direction||0,0);else this.actorPosition=null;
   this.markActor(model);this.transform();this.syncTicker();this.draw(true);return true;
  }catch(error){
   const current=this.valid(ticket);this.disposePending(ticket);if(!current)return false;
   this.actorReady=false;this.host.dataset.actorLoading='false';this.host.dataset.actorError='true';const message=this.actor?'新角色或地图载入失败，已保留原画面；请重试，必要时检查登录状态。':'角色或地图载入失败，请重试或检查登录状态。';this.host.setAttribute('aria-description',message);throw Error(message,{cause:error});
  }
 }
 async renderFallback(model,ticket){
  if(!model||!this.fallbackEl)return false;const W=ticket.width,H=ticket.height,target=document.createElement('div'),labelRecords=[];ticket.dom=target;
  const img=document.createElement('img');img.alt=model.scene.name+'无字地形图';img.width=W;img.height=H;target.appendChild(img);
  const points=new Map(model.nodes.map(n=>[n.id,n])),ns='http://www.w3.org/2000/svg';const svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 '+W+' '+H);svg.setAttribute('aria-hidden','true');svg.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none';
  for(const edge of model.routes){const a=points.get(edge.a),b=points.get(edge.b),highlight=model.routeIds.includes(edge.id);if(!a||!b||!highlight&&!model.showRoutes)continue;const line=document.createElementNS(ns,'path'),ax=a.x*W/100,ay=a.y*H/100,bx=b.x*W/100,by=b.y*H/100;line.setAttribute('d',`M ${ax} ${ay} Q ${(ax+bx)/2} ${(ay+by)/2-15} ${bx} ${by}`);line.setAttribute('fill','none');line.setAttribute('stroke',highlight?'#fff3be':'#607c63');line.setAttribute('stroke-width',highlight?'6':'2');svg.appendChild(line);}target.appendChild(svg);
  for(const npc of model.npcs){const b=document.createElement('button');b.className='world-fallback-pin world-fallback-npc';b.textContent=npc.name;b.setAttribute('aria-label','交互人物 '+npc.name);b.style.left=npc.x+'%';b.style.top=(npc.y-4)+'%';b.onclick=()=>this.select(npc.locationId,npc.id);target.appendChild(b);}
  for(const n of model.nodes.filter(n=>n.known)){const button=document.createElement('button');button.className='world-fallback-pin'+(n.id===model.selected?' selected':'');if(model.scene.id==='world'){button.className+=' world-landmark';button.setAttribute('aria-label',n.name);button.title=n.name;const label=document.createElement('span');label.className='world-pin-label';button.appendChild(label);labelRecords.push({node:n,button,label});}else button.textContent=(n.id===model.playerId?'◆ ':'')+n.name;button.style.left=n.x+'%';button.style.top=n.y+'%';button.onclick=()=>this.select(n.id);target.appendChild(button);}ticket.actor=model.pose?new WorldActor({fallback:target,avatar:model.avatar||WorldNavigation.avatar('male'),form:model.form}):null;
  await Promise.all([WorldActor.loadDOMImage(model.scene.art,img),ticket.actor?.init()]);
  if(!this.valid(ticket)){this.disposePending(ticket);return false;}
  const changedScene=this.committedScene!==model.scene.id;this.retireWorld(this.actor,this.world,this.backgroundLease);this.world=null;this.backgroundLease=null;
  this.W=W;this.H=H;this.fallbackEl.style.width=W+'px';this.fallbackEl.style.height=H+'px';this.fallbackEl.replaceChildren(...target.children);this.actor=ticket.actor;this.actorRoot=null;this.labels=[];this.animated=[];this.labelRecords=labelRecords;this.labelSelected=model.selected;this.labelLayoutKey=null;ticket.done=true;this.pending.delete(ticket);this.committedScene=model.scene.id;
  if(changedScene){this.zoom=1;this.pan={x:0,y:0};}this.resize();if(model.pose)this.setActorPose(model.pose,model.pose.direction||0,0);else this.actorPosition=null;
  this.markActor(model);this.transform();return true;
 }
 async createAvatar(model,ticket){
  if(!model.pose)return;ticket.actor=new WorldActor({world:ticket.world,worldWidth:ticket.width,worldHeight:ticket.height,avatar:model.avatar||WorldNavigation.avatar('male'),form:model.form});await ticket.actor.init();
 }
 sizeAvatar(){const scale=(this.fit||.5)*this.zoom,height=Math.min(270,(this.width<600?58:78)/scale);this.actor?.size(height);}
 setActorPose(p,direction=0,frame=0,time=0){this.actorPosition={x:p.x,y:p.y};this.actorDirection=direction;this.actor?.pose(p,direction,frame,time,!!this.walking,this.motion);this.sizeAvatar();this.draw();}
 stopWalking(reason='stop'){if(this.walking){cancelAnimationFrame(this.walking.raf);const walk=this.walking;this.walking=null;this.host.dataset.walking='false';walk.finish({completed:false,reason,position:{...this.actorPosition}});this.clearWalkingPath();this.setActorPose(this.actorPosition,this.actorDirection,0);}}
 clearWalkingPath(){if(this.walkLine){this.walkLine.destroy();this.walkLine=null;}if(this.walkTarget){this.walkTarget.destroy();this.walkTarget=null;}this.domTrail?.remove();this.domTrail=null;}
 animatePath(points,options={}){
  this.stopWalking();if(!points?.length)return Promise.resolve({completed:false});const path=points.map(p=>({...p}));let total=0;const lengths=[];for(let i=1;i<path.length;i++){const n=WorldNavigation.distance(path[i-1],path[i]);lengths.push(n);total+=n;}
  if(total<.01)return Promise.resolve({completed:true,position:path.at(-1)});
  const duration=options.duration||Math.max(350,total/WorldNavigation.forms[options.mode||this.model.form||'walk'].speed*1000),target=path.at(-1);this.host.dataset.walking='true';
  if(this.mode!=='dom'&&this.world){this.walkLine=new PIXI.Graphics();this.walkLine.moveTo(path[0].x*this.W/100,path[0].y*this.H/100);for(const p of path.slice(1))this.walkLine.lineTo(p.x*this.W/100,p.y*this.H/100);this.walkLine.stroke({color:0xfff1af,width:4,alpha:.8});this.world.addChild(this.walkLine);this.walkTarget=new PIXI.Graphics().circle(0,0,18).stroke({color:0x567c52,width:4}).circle(0,0,7).fill(0xf7e7a0);this.walkTarget.position.set(target.x*this.W/100,target.y*this.H/100);this.world.addChild(this.walkTarget);if(this.actorRoot)this.world.addChild(this.actorRoot);}
  else if(this.fallbackEl){this.domTrail=document.createElement('div');this.domTrail.className='world-walking-target';this.domTrail.style.left=target.x+'%';this.domTrail.style.top=target.y+'%';this.fallbackEl.appendChild(this.domTrail);}
  return new Promise(finish=>{const walk={finish,elapsed:0,last:performance.now(),raf:0};this.walking=walk;
   const tick=now=>{if(this.walking!==walk||this.destroyed)return;const dt=Math.min(60,now-walk.last);walk.last=now;if(!this.host.getClientRects().length){this.stopWalking('hidden');return;}if(document.hidden){walk.raf=requestAnimationFrame(tick);return;}
    walk.elapsed+=dt;const progress=Math.min(1,walk.elapsed/duration),p=WorldNavigation.sample(path,progress),direction=p.direction,frame=this.motion?[0,1,0,2][Math.floor(walk.elapsed/135)%4]:0;this.setActorPose(p,direction,frame,walk.elapsed);
    if(this.follow&&this.zoom>1.05&&now>(this.manualCameraUntil||0)){const scale=(this.fit||.5)*this.zoom,dx=(p.x/100*this.W-this.W/2)*scale+this.pan.x,dy=(p.y/100*this.H-this.H/2)*scale+this.pan.y,alpha=1-Math.exp(-dt/140);if(Math.abs(dx)>this.width*.22)this.pan.x-=dx*alpha;if(Math.abs(dy)>this.height*.24)this.pan.y-=dy*alpha;this.transform();}
    options.onProgress?.(progress,p);if(progress<1)walk.raf=requestAnimationFrame(tick);else{this.walking=null;this.host.dataset.walking='false';this.setActorPose(target,direction,0);this.clearWalkingPath();finish({completed:true,position:target});}
   };walk.raf=requestAnimationFrame(tick);
  });
 }
 destroy(){this.stopWalking();this.destroyed=true;this.generation++;this.cancelPending();this.retireWorld(this.actor,this.world,this.backgroundLease);this.actor=null;this.world=null;this.backgroundLease=null;WorldActor.trimAssets(true);this.resizeObserver?.disconnect();this.visibilityObserver?.disconnect();for(const clean of this.cleanups)clean();if(this.app)this.app.destroy(true,{children:true,texture:false});this.host.replaceChildren();}
}
