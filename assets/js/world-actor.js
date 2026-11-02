// Every form is one complete illustrated figure. No cropped rider, mount or wing assembly.
class WorldActor {
 // Leases pin live atlases. An evicted URL cannot reload until its unload has finished.
 static assets=new Map();
 static retiring=new Map();
 static assetClock=0;
 static async acquire(url,kind='actor'){
  let entry=this.assets.get(url);
  if(!entry){
   const barrier=this.retiring.get(url)||Promise.resolve();entry={url,kind,refs:0,at:++this.assetClock,ready:false};this.assets.set(url,entry);
   entry.promise=barrier.then(()=>PIXI.Assets.load(url)).then(texture=>{entry.ready=true;return texture;},error=>{if(this.assets.get(url)===entry)this.assets.delete(url);throw error;});
  }
  entry.refs++;entry.at=++this.assetClock;
  try{const texture=await entry.promise;let released=false;return {texture,release:()=>{if(released)return;released=true;entry.refs--;entry.at=++this.assetClock;this.trimAssets();}};}
  catch(error){entry.refs--;this.trimAssets();throw error;}
 }
 static trimAssets(all=false){
  for(const kind of ['actor','background']){
   const idle=[...this.assets.values()].filter(e=>e.kind===kind&&e.ready&&e.refs===0).sort((a,b)=>a.at-b.at),keep=all?0:kind==='actor'?2:1;
   while(idle.length>keep){const entry=idle.shift();this.assets.delete(entry.url);const unload=Promise.resolve().then(()=>PIXI.Assets.unload?.(entry.url)).catch(()=>{});this.retiring.set(entry.url,unload);unload.then(()=>{if(this.retiring.get(entry.url)===unload)this.retiring.delete(entry.url);});}
  }
 }
 static loadDOMImage(url,img){
  if(typeof Image==='undefined'){if(img)img.src=url;return Promise.resolve(img);}
  return new Promise((resolve,reject)=>{img=img||new Image();let timer;const finish=error=>{clearTimeout(timer);img.onload=null;img.onerror=null;error?reject(error):resolve(img);};img.onload=()=>finish();img.onerror=()=>finish(Error('角色贴图载入失败，请重试或检查登录状态'));timer=setTimeout(()=>finish(Error('角色贴图载入超时，请重试')),10000);img.src=url;if(img.complete&&img.naturalWidth)finish();});
 }
 constructor({world,fallback,avatar,form='walk',worldWidth=DoupoWorldData.worldWidth,worldHeight=DoupoWorldData.worldHeight}){this.world=world;this.fallback=fallback;this.worldWidth=worldWidth;this.worldHeight=worldHeight;this.avatar=avatar;this.form=Object.hasOwn(WorldNavigation.forms,form)?form:'walk';this.image=avatar.sheets[this.form];this.textures=[];this.height=100;this.direction=0;this.frame=0;this.time=0;}
 frames(texture){const list=[],w=texture.width/4,h=texture.height/3;for(let row=0;row<3;row++)for(let col=0;col<4;col++){const rect=this.form==='flight'&&this.avatar.flightFrames?.frames[row*4+col],frame=rect?new PIXI.Rectangle(rect.x,rect.y,rect.width,rect.height):new PIXI.Rectangle(col*w,row*h,w,h);const f=new PIXI.Texture({source:texture.source,frame,...(rect?{orig:new PIXI.Rectangle(0,0,w,h),trim:new PIXI.Rectangle(rect.trimX,rect.trimY,rect.width,rect.height)}:{})});list.push(f);this.textures.push(f);}return list;}
 async init(){
  if(this.fallback){await WorldActor.loadDOMImage(this.image);if(!this.destroyed)this.createDOM();return this;}
  const lease=await WorldActor.acquire(this.image);if(this.destroyed){lease.release();return this;}this.assetLease=lease;this.heroFrames=this.frames(lease.texture);
  this.root=new PIXI.Container();this.shadow=new PIXI.Graphics().ellipse(0,0,22,7).fill({color:0x203d2c,alpha:.25});this.root.addChild(this.shadow);
  this.effects=new PIXI.Graphics();this.root.addChild(this.effects);this.hero=new PIXI.Sprite(this.heroFrames[0]);this.hero.anchor.set(.5,.94);this.root.addChild(this.hero);this.world.addChild(this.root);this.layout();return this;
 }
 createDOM(){
  this.dom=document.createElement('div');this.dom.className='world-player-rig';this.dom.dataset.form=this.form;this.dom.setAttribute('role','img');this.dom.setAttribute('aria-label',this.avatar.name+' · '+WorldNavigation.forms[this.form].label);
  this.domShadow=document.createElement('div');this.domShadow.className='world-rig-shadow';this.dom.appendChild(this.domShadow);this.domHero=document.createElement('div');this.domHero.className='world-rig-hero';this.domHero.style.backgroundImage='url("'+this.image+'")';if(this.form==='flight'&&this.avatar.flightFrames){this.domHero.style.backgroundImage='none';this.domFrame=document.createElement('div');this.domFrame.style.position='absolute';this.domFrame.style.backgroundImage='url("'+this.image+'")';this.domFrame.style.backgroundRepeat='no-repeat';this.domHero.appendChild(this.domFrame);}this.dom.appendChild(this.domHero);this.fallback.appendChild(this.dom);this.layout();
 }
 size(height){if(Math.abs(height-this.height)<.1)return;this.height=height;this.layout();}
 pose(p,direction=0,frame=0,time=0,moving=false,motion=true){
  this.position={x:p.x,y:p.y};this.direction=direction;this.frame=frame;this.time=time;this.moving=moving;this.motion=motion;
  if(this.root)this.root.position.set(p.x*this.worldWidth/100,p.y*this.worldHeight/100);
  if(this.dom){this.dom.style.left=p.x+'%';this.dom.style.top=p.y+'%';this.dom.classList.toggle('moving',moving);this.dom.classList.toggle('still',!motion);}this.layout();
 }
 layout(){
  if(this.destroyed)return;const h=this.height,d=this.direction||0,flight=this.form==='flight',ride=this.form==='convoy',f=flight&&this.motion?[0,1,0,2][Math.floor(this.time/220)%4]:this.frame||0,scale=(ride?1.35:flight?1.45:1)*(this.avatar.visualScale?.[this.form]||1),lift=flight?h*(.12+(this.motion?Math.sin(this.time/300)*.025:0)):0;
  const mirror=d===3&&this.avatar.mirrorWest?.[this.form],column=mirror?1:d;
  if(this.hero){this.hero.texture=this.heroFrames[f*4+column];this.hero.height=h*scale;this.hero.width=this.hero.height*this.hero.texture.width/this.hero.texture.height;this.hero.y=-lift;this.hero.scale.x=(mirror?-1:1)*Math.abs(this.hero.scale.x);}
  if(this.shadow){this.shadow.scale.set(h/110*(ride?1.4:1),flight?.65:1);this.shadow.alpha=flight?.5:1;}
  if(this.effects){this.effects.clear();if(this.moving&&this.motion&&this.form==='convoy'){const v=[[0,1],[1,0],[0,-1],[-1,0]][d];for(let i=1;i<=4;i++){const t=(this.time/450+i/4)%1,dist=(.15+t*.5)*h,x=-v[0]*dist,y=-v[1]*dist;this.effects.ellipse(x,y+3,(3+t*4)*h/100,(2+t*2)*h/100).fill({color:0xb9a378,alpha:(1-t)*.3});}}}
  if(this.domHero)Object.assign(this.domHero.style,{width:h*scale*1.125+'px',height:h*scale+'px',top:-lift+'px',transform:'translate(-50%,-94%) scaleX('+(mirror?-1:1)+')',backgroundSize:'400% 300%',backgroundPosition:(column/3*100)+'% '+(f/2*100)+'%'});
  if(this.domFrame){const meta=this.avatar.flightFrames,rect=meta.frames[f*4+column],ratio=h*scale/(meta.height/3);Object.assign(this.domFrame.style,{left:rect.trimX*ratio+'px',top:rect.trimY*ratio+'px',width:rect.width*ratio+'px',height:rect.height*ratio+'px',backgroundSize:meta.width*ratio+'px '+meta.height*ratio+'px',backgroundPosition:-rect.x*ratio+'px '+(-rect.y*ratio)+'px'});}
  if(this.domShadow){this.domShadow.style.width=h*(ride?.52:.35)+'px';this.domShadow.style.height=h*.1+'px';this.domShadow.style.opacity=flight?'.15':'.25';}
 }
 destroy(){if(this.destroyed)return;this.destroyed=true;this.dom?.remove();this.root?.destroy({children:true});for(const f of this.textures)f.destroy();this.textures=[];this.assetLease?.release();this.assetLease=null;}
}
if(typeof module==='object'&&module.exports)module.exports=WorldActor;
