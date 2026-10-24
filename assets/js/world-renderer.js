class WorldRenderer {
 constructor(host,select,onGround){this.onGround=onGround;this.follow=true;this.host=host;this.select=select;this.W=DoupoWorldData.worldWidth;this.H=DoupoWorldData.worldHeight;this.zoom=1;this.pan={x:0,y:0};this.pointers=new Map();this.cleanups=[];this.motion=!matchMedia('(prefers-reduced-motion: reduce)').matches;this.generation=0;this.loaded=[];this.active=true;}
 async init(){
  try{
   if(new URLSearchParams(location.search).get('mapRenderer')==='lightweight')throw Error('lightweight');
   this.app=new PIXI.Application();await this.app.init({resizeTo:this.host,backgroundAlpha:0,antialias:true,resolution:Math.min(devicePixelRatio||1,1.5),autoDensity:true,autoStart:false,preference:'webgl'});
   this.host.dataset.renderer='pixi';this.host.appendChild(this.app.canvas);this.canvas=this.app.canvas;this.world=new PIXI.Container();this.app.stage.addChild(this.world);this.app.ticker.maxFPS=30;
   this.app.ticker.add(t=>{if(!this.active)return;this.time=(this.time||0)+t.deltaMS/1000;for(const item of this.animated||[]){item.obj.y=item.y+Math.sin(this.time*1.3+item.phase)*1.2;}if(this.playerHalo)this.playerHalo.alpha=.35+Math.sin(this.time*2)*.15;});
   this.bind(this.canvas,'webglcontextlost',e=>{e.preventDefault();this.fallback('图形设备暂不可用，已切换轻量地图');});
  }catch{this.fallback('使用轻量地图，地点与旅行功能仍然可用');}
  this.installInput();this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(this.host);
  this.visibilityObserver=new IntersectionObserver(entries=>{this.active=entries[0]?.isIntersecting&&!document.hidden;this.syncTicker();});this.visibilityObserver.observe(this.host);
  this.bind(document,'visibilitychange',()=>{this.active=!document.hidden&&!!this.host.getClientRects().length;this.syncTicker();});
  this.resize();return this;
 }
 bind(el,event,cb,options){el.addEventListener(event,cb,options);this.cleanups.push(()=>el.removeEventListener(event,cb,options));}
 fallback(reason){
  if(this.fallbackEl)return;this.mode='dom';if(this.app){this.app.stop();if(this.app.canvas)this.app.canvas.hidden=true;}
  this.fallbackEl=document.createElement('div');this.fallbackEl.className='world-fallback';this.fallbackEl.style.width=this.W+'px';this.fallbackEl.style.height=this.H+'px';this.host.appendChild(this.fallbackEl);this.canvas=this.fallbackEl;
  this.host.dataset.renderer='lightweight';this.host.setAttribute('aria-description',reason);
 }
 installInput(){
  const el=this.host;
  this.bind(el,'pointerdown',e=>{if(e.target.closest('button'))return;this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});e.target.setPointerCapture?.(e.pointerId);this.last={x:e.clientX,y:e.clientY};this.moved=false;this.pinch=null;});
  this.bind(el,'pointermove',e=>{
   if(!this.pointers.has(e.pointerId))return;this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
   if(this.pointers.size===2){const p=[...this.pointers.values()],dist=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);if(this.pinch)this.zoomAt(dist/this.pinch,(p[0].x+p[1].x)/2-el.getBoundingClientRect().left,(p[0].y+p[1].y)/2-el.getBoundingClientRect().top);this.pinch=dist;this.moved=true;return;}
   const dx=e.clientX-this.last.x,dy=e.clientY-this.last.y;if(Math.abs(dx)+Math.abs(dy)>2)this.moved=true;this.pan.x+=dx;this.pan.y+=dy;this.last={x:e.clientX,y:e.clientY};this.transform();
  });
  const end=e=>{if(this.mode==='dom'&&!this.moved&&e.type==='pointerup'&&!e.target.closest('button')){const rect=el.getBoundingClientRect(),scale=(this.fit||.5)*this.zoom;this.onGround?.({x:(e.clientX-rect.left-(this.width-this.W*scale)/2-this.pan.x)/scale/this.W*100,y:(e.clientY-rect.top-(this.height-this.H*scale)/2-this.pan.y)/scale/this.H*100});}this.pointers.delete(e.pointerId);this.pinch=null;if(this.pointers.size)this.last=[...this.pointers.values()][0];};this.bind(el,'pointerup',end);this.bind(el,'pointercancel',end);
  this.bind(el,'wheel',e=>{e.preventDefault();const rect=el.getBoundingClientRect();this.zoomAt(Math.exp(-e.deltaY*.001),e.clientX-rect.left,e.clientY-rect.top);},{passive:false});
  this.bind(el,'keydown',e=>{if(e.target!==el)return;const keys={ArrowLeft:[40,0],ArrowRight:[-40,0],ArrowUp:[0,40],ArrowDown:[0,-40]};if(e.key==='Escape'){e.preventDefault();this.stopWalking();return;}if(['w','a','s','d','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();const steps={w:[0,-7],a:[-7,0],s:[0,7],d:[7,0],ArrowLeft:[-7,0],ArrowRight:[7,0],ArrowUp:[0,-7],ArrowDown:[0,7]},v=steps[e.key],p=this.actorPosition||this.model?.pose;if(p&&!this.walking)this.onGround?.({x:p.x+v[0],y:p.y+v[1]});return;}if(e.key==='+'||e.key==='=')this.zoomAt(1.2);if(e.key==='-')this.zoomAt(.8);});
 }
 resize(){const r=this.host.getBoundingClientRect();if(!r.width||!r.height)return;this.width=r.width;this.height=r.height;this.fit=Math.min(r.width/this.W,r.height/this.H);if(this.app?.renderer&&this.mode!=='dom')this.app.renderer.resize(r.width,r.height);this.transform();}
 transform(){
  const scale=(this.fit||.5)*this.zoom;
  const boundX=this.W*scale*.7,boundY=this.H*scale*.7;this.pan.x=Math.max(-boundX,Math.min(boundX,this.pan.x));this.pan.y=Math.max(-boundY,Math.min(boundY,this.pan.y));
  const x=(this.width-this.W*scale)/2+this.pan.x,y=(this.height-this.H*scale)/2+this.pan.y;
  if(this.world){this.world.scale.set(scale);this.world.position.set(x,y);for(const item of this.labels||[])item.alpha=this.zoom>1.4||item.priority?1:.55;}
  if(this.fallbackEl)this.fallbackEl.style.transform=`translate(${x}px,${y}px) scale(${scale})`;
  this.sizeAvatar();this.draw();
 }
 zoomAt(factor,x=this.width/2,y=this.height/2){
  const old=(this.fit||.5)*this.zoom;this.zoom=Math.max(.65,Math.min(5,this.zoom*factor));const next=(this.fit||.5)*this.zoom;
  const oldX=(this.width-this.W*old)/2+this.pan.x,oldY=(this.height-this.H*old)/2+this.pan.y;
  this.pan.x=x-(x-oldX)*next/old-(this.width-this.W*next)/2;this.pan.y=y-(y-oldY)*next/old-(this.height-this.H*next)/2;this.transform();
 }
 reset(){this.zoom=1;this.pan={x:0,y:0};this.transform();}
 centerActor(){const p=this.actorPosition;if(!p)return;this.zoom=Math.max(1.6,this.zoom);const scale=(this.fit||.5)*this.zoom;this.pan.x=-(p.x/100*this.W-this.W/2)*scale;this.pan.y=-(p.y/100*this.H-this.H/2)*scale;this.transform();}
 focus(id){const n=this.model?.nodes.find(n=>n.id===id);if(!n)return;this.zoom=Math.max(1.4,this.zoom);this.pan.x=-(n.x/100*this.W-this.W/2)*(this.fit||.5)*this.zoom;this.pan.y=-(n.y/100*this.H-this.H/2)*(this.fit||.5)*this.zoom;this.transform();}
 draw(){if(this.app?.renderer&&this.mode!=='dom'&&!this.app.ticker.started)this.app.render();}
 syncTicker(){if(!this.app||this.mode==='dom')return;if(this.active&&this.motion)this.app.start();else{this.app.stop();this.draw();}}
 setMotion(value){this.motion=value;this.syncTicker();}
 async render(model){
  const changedScene=this.model?.scene.id!==model.scene.id;this.model=model;const generation=++this.generation;
  if(changedScene)this.reset();
  if(this.mode==='dom'){this.renderFallback();return;}
  let texture;
  try{texture=await PIXI.Assets.load(model.scene.art);}catch{this.fallback('底图载入失败，可继续使用地点目录');this.renderFallback();return;}
  if(generation!==this.generation||this.destroyed)return;
  if(!this.loaded.includes(model.scene.art))this.loaded.push(model.scene.art);
  const old=this.world.removeChildren();for(const item of old)item.destroy({children:true});for(const frame of this.avatarFrames||[])frame.destroy();this.avatarFrames=[];this.avatarSprite=null;this.actorRoot=null;this.labels=[];this.animated=[];
  const background=new PIXI.Sprite(texture);background.width=this.W;background.height=this.H;this.world.addChild(background);background.eventMode='static';background.cursor='crosshair';background.on('pointertap',e=>{if(!this.moved){const p=this.world.toLocal(e.global);this.onGround?.({x:p.x/this.W*100,y:p.y/this.H*100});}});
  if(model.fog){const veil=new PIXI.Graphics().rect(0,0,this.W,this.H).fill({color:0xeaf0d9,alpha:.12});this.world.addChild(veil);}
  const points=new Map(model.nodes.map(n=>[n.id,n]));
  const lines=new PIXI.Graphics();
  for(const edge of model.routes){const a=points.get(edge.a),b=points.get(edge.b);if(!a||!b)continue;const highlight=model.routeIds.includes(edge.id);if(!highlight&&!model.showRoutes)continue;const ax=a.x*this.W/100,ay=a.y*this.H/100,bx=b.x*this.W/100,by=b.y*this.H/100;lines.moveTo(ax,ay).quadraticCurveTo((ax+bx)/2,(ay+by)/2-15,bx,by).stroke({color:highlight?0xfff3be:0x607c63,width:highlight?6:2,alpha:highlight?.95:.22});}
  this.world.addChild(lines);
  for(const n of model.nodes){
   if(!n.known)continue;const marker=new PIXI.Container();marker.position.set(n.x*this.W/100,n.y*this.H/100);
   const selected=n.id===model.selected,visited=n.visited;
   const dot=new PIXI.Graphics().circle(0,0,selected?15:10).fill({color:selected?0x315e4c:0xf9f5e4,alpha:.96}).stroke({color:selected?0xc9ad67:0x668269,width:2});marker.addChild(dot);
   if(visited)marker.addChild(new PIXI.Graphics().circle(0,0,4).fill(0x5f8c6a));
   const text=new PIXI.Text({text:n.name,style:{fontFamily:'Noto Serif SC, serif',fontSize:model.scene.id==='world'?21:25,fontWeight:'500',fill:0x254938,stroke:{color:0xfff9e4,width:5},align:'center'}});text.anchor.set(.5,0);text.y=17;text.priority=selected||['wutan','qingshan','shimo','capital','holy-pill','blackcorner'].includes(n.id);this.labels.push(text);marker.addChild(text);
   marker.eventMode='static';marker.cursor='pointer';marker.on('pointertap',()=>{if(!this.moved)this.select(n.id);});this.world.addChild(marker);
  }
  for(const npc of model.npcs){const pin=new PIXI.Container();pin.position.set(npc.x*this.W/100+25,npc.y*this.H/100-15);const body=new PIXI.Graphics().ellipse(0,16,10,4).fill({color:0x334b3a,alpha:.25}).moveTo(-6,13).lineTo(0,-2).lineTo(6,13).closePath().fill(0x9b6446).circle(0,-5,5).fill(0xe4cba0);pin.addChild(body);pin.eventMode='static';pin.cursor='pointer';pin.on('pointertap',()=>{if(!this.moved)this.select(npc.locationId,npc.id);});this.world.addChild(pin);this.animated.push({obj:pin,y:pin.y,phase:WorldCore.hash(npc.id)%20});}
  await this.createAvatar(model,generation);
  this.transform();this.syncTicker();
  while(this.loaded.length>2){const url=this.loaded.shift();if(url!==model.scene.art)PIXI.Assets.unload(url).catch(()=>{});}
 }
 renderFallback(){
  const model=this.model;if(!model||!this.fallbackEl)return;
  this.fallbackEl.replaceChildren();const img=document.createElement('img');img.src=model.scene.art;img.alt=model.scene.name+'无字地形图';img.width=this.W;img.height=this.H;this.fallbackEl.appendChild(img);
  const points=new Map(model.nodes.map(n=>[n.id,n])),ns='http://www.w3.org/2000/svg';const svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 '+this.W+' '+this.H);svg.setAttribute('aria-hidden','true');svg.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none';
  for(const edge of model.routes){const a=points.get(edge.a),b=points.get(edge.b),highlight=model.routeIds.includes(edge.id);if(!a||!b||!highlight&&!model.showRoutes)continue;const line=document.createElementNS(ns,'path'),ax=a.x*this.W/100,ay=a.y*this.H/100,bx=b.x*this.W/100,by=b.y*this.H/100;line.setAttribute('d',`M ${ax} ${ay} Q ${(ax+bx)/2} ${(ay+by)/2-15} ${bx} ${by}`);line.setAttribute('fill','none');line.setAttribute('stroke',highlight?'#fff3be':'#607c63');line.setAttribute('stroke-width',highlight?'6':'2');svg.appendChild(line);}this.fallbackEl.appendChild(svg);
  for(const npc of model.npcs){const b=document.createElement('button');b.className='world-fallback-pin world-fallback-npc';b.textContent=npc.name;b.setAttribute('aria-label','交互人物 '+npc.name);b.style.left=npc.x+'%';b.style.top=(npc.y-4)+'%';b.onclick=()=>this.select(npc.locationId,npc.id);this.fallbackEl.appendChild(b);}
  for(const n of model.nodes.filter(n=>n.known)){const button=document.createElement('button');button.className='world-fallback-pin'+(n.id===model.selected?' selected':'');button.textContent=(n.id===model.playerId?'◆ ':'')+n.name;button.style.left=n.x+'%';button.style.top=n.y+'%';button.onclick=()=>this.select(n.id);this.fallbackEl.appendChild(button);}this.createFallbackAvatar(model);this.transform();
 }
 async createAvatar(model,generation){
  const pose=model.pose;if(!pose)return;this.actorPosition={...pose};const avatar=model.avatar||WorldNavigation.avatar('male');
  try{const texture=await PIXI.Assets.load(avatar.image);if(generation!==this.generation)return;this.avatarFrames=[];
   const width=texture.width/4,height=texture.height/3;for(let row=0;row<3;row++)for(let col=0;col<4;col++)this.avatarFrames.push(new PIXI.Texture({source:texture.source,frame:new PIXI.Rectangle(col*width,row*height,width,height)}));
   this.actorRoot=new PIXI.Container();const shadow=new PIXI.Graphics().ellipse(0,0,22,8).fill({color:0x1d3b26,alpha:.25});this.actorRoot.addChild(shadow);
   this.avatarSprite=new PIXI.Sprite(this.avatarFrames[pose.direction||0]);this.avatarSprite.anchor.set(.5,.97);this.actorRoot.addChild(this.avatarSprite);this.world.addChild(this.actorRoot);this.setActorPose(pose,pose.direction||0,0);
  }catch{const mark=new PIXI.Container();mark.addChild(new PIXI.Graphics().circle(0,-10,13).fill(0x345d45));this.actorRoot=mark;this.world.addChild(mark);this.setActorPose(pose,0,0);}
 }
 createFallbackAvatar(model){
  if(!model.pose)return;const avatar=model.avatar||WorldNavigation.avatar('male');this.domAvatar=document.createElement('div');this.domAvatar.className='world-walking-avatar';this.domAvatar.setAttribute('role','img');this.domAvatar.setAttribute('aria-label',avatar.name+'地图角色');this.domAvatar.style.backgroundImage='url("'+avatar.image+'")';this.fallbackEl.appendChild(this.domAvatar);this.actorPosition={...model.pose};this.setActorPose(model.pose,model.pose.direction||0,0);
 }
 sizeAvatar(){
  const scale=(this.fit||.5)*this.zoom,height=Math.min(270,(this.width<600?58:78)/scale);
  if(this.avatarSprite){this.avatarSprite.height=height;this.avatarSprite.width=height*(this.avatarSprite.texture.width/this.avatarSprite.texture.height);}
  if(this.domAvatar){this.domAvatar.style.height=height+'px';this.domAvatar.style.width=height*1.125+'px';}
 }
 setActorPose(p,direction=0,frame=0){
  this.actorPosition={x:p.x,y:p.y};this.actorDirection=direction;
  if(this.actorRoot){this.actorRoot.position.set(p.x*this.W/100,p.y*this.H/100);if(this.avatarSprite&&this.avatarFrames?.length)this.avatarSprite.texture=this.avatarFrames[frame*4+direction];}
  if(this.domAvatar){this.domAvatar.style.left=p.x+'%';this.domAvatar.style.top=p.y+'%';this.domAvatar.style.backgroundPosition=(direction/3*100)+'% '+(frame/2*100)+'%';}
  this.sizeAvatar();this.draw();
 }
 stopWalking(){if(this.walking){cancelAnimationFrame(this.walking.raf);const walk=this.walking;this.walking=null;this.host.dataset.walking='false';walk.finish({completed:false,position:{...this.actorPosition}});this.clearWalkingPath();this.setActorPose(this.actorPosition,this.actorDirection,0);}}
 clearWalkingPath(){if(this.walkLine){this.walkLine.destroy();this.walkLine=null;}if(this.walkTarget){this.walkTarget.destroy();this.walkTarget=null;}this.domTrail?.remove();this.domTrail=null;}
 animatePath(points,options={}){
  this.stopWalking();if(!points?.length)return Promise.resolve({completed:false});const path=points.map(p=>({...p}));let total=0;const lengths=[];for(let i=1;i<path.length;i++){const n=WorldNavigation.distance(path[i-1],path[i]);lengths.push(n);total+=n;}
  if(total<.01)return Promise.resolve({completed:true,position:path.at(-1)});
  const duration=options.duration||Math.max(500,total/11*1000),target=path.at(-1);this.host.dataset.walking='true';
  if(this.mode!=='dom'&&this.world){this.walkLine=new PIXI.Graphics();this.walkLine.moveTo(path[0].x*this.W/100,path[0].y*this.H/100);for(const p of path.slice(1))this.walkLine.lineTo(p.x*this.W/100,p.y*this.H/100);this.walkLine.stroke({color:0xfff1af,width:4,alpha:.8});this.world.addChild(this.walkLine);this.walkTarget=new PIXI.Graphics().circle(0,0,18).stroke({color:0x567c52,width:4}).circle(0,0,7).fill(0xf7e7a0);this.walkTarget.position.set(target.x*this.W/100,target.y*this.H/100);this.world.addChild(this.walkTarget);if(this.actorRoot)this.world.addChild(this.actorRoot);}
  else if(this.fallbackEl){this.domTrail=document.createElement('div');this.domTrail.className='world-walking-target';this.domTrail.style.left=target.x+'%';this.domTrail.style.top=target.y+'%';this.fallbackEl.appendChild(this.domTrail);}
  return new Promise(finish=>{const walk={finish,elapsed:0,last:performance.now(),raf:0};this.walking=walk;
   const tick=now=>{if(this.walking!==walk||this.destroyed)return;const dt=Math.min(60,now-walk.last);walk.last=now;if(!this.host.getClientRects().length){this.stopWalking();return;}if(document.hidden){walk.raf=requestAnimationFrame(tick);return;}
    walk.elapsed+=dt;const progress=Math.min(1,walk.elapsed/duration),p=WorldNavigation.sample(path,progress),direction=p.direction,frame=this.motion?[0,1,0,2][Math.floor(walk.elapsed/135)%4]:0;this.setActorPose(p,direction,frame);
    if(this.follow&&this.zoom>1.05){const scale=(this.fit||.5)*this.zoom;this.pan.x+=(-(p.x/100*this.W-this.W/2)*scale-this.pan.x)*.09;this.pan.y+=(-(p.y/100*this.H-this.H/2)*scale-this.pan.y)*.09;this.transform();}
    options.onProgress?.(progress,p);if(progress<1)walk.raf=requestAnimationFrame(tick);else{this.walking=null;this.host.dataset.walking='false';this.setActorPose(target,direction,0);this.clearWalkingPath();finish({completed:true,position:target});}
   };walk.raf=requestAnimationFrame(tick);
  });
 }
 destroy(){this.stopWalking();this.destroyed=true;this.generation++;this.resizeObserver?.disconnect();this.visibilityObserver?.disconnect();for(const clean of this.cleanups)clean();if(this.app)this.app.destroy(true,{children:true,texture:false});this.host.replaceChildren();}
}
