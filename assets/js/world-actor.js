// Every form is one complete illustrated figure. No cropped rider, mount or wing assembly.
class WorldActor {
 constructor({world,fallback,avatar,form='walk'}){this.world=world;this.fallback=fallback;this.avatar=avatar;this.form=Object.hasOwn(WorldNavigation.forms,form)?form:'walk';this.image=avatar.sheets[this.form];this.textures=[];this.height=100;this.direction=0;this.frame=0;this.time=0;}
 frames(texture){const list=[],w=texture.width/4,h=texture.height/3;for(let row=0;row<3;row++)for(let col=0;col<4;col++){const f=new PIXI.Texture({source:texture.source,frame:new PIXI.Rectangle(col*w,row*h,w,h)});list.push(f);this.textures.push(f);}return list;}
 async init(){
  if(this.fallback){this.createDOM();return this;}
  const texture=await PIXI.Assets.load(this.image);if(this.destroyed)return this;this.heroFrames=this.frames(texture);
  this.root=new PIXI.Container();this.shadow=new PIXI.Graphics().ellipse(0,0,22,7).fill({color:0x203d2c,alpha:.25});this.root.addChild(this.shadow);
  this.effects=new PIXI.Graphics();this.root.addChild(this.effects);this.hero=new PIXI.Sprite(this.heroFrames[0]);this.hero.anchor.set(.5,.94);this.root.addChild(this.hero);this.world.addChild(this.root);this.layout();return this;
 }
 createDOM(){
  this.dom=document.createElement('div');this.dom.className='world-player-rig';this.dom.dataset.form=this.form;this.dom.setAttribute('role','img');this.dom.setAttribute('aria-label',this.avatar.name+' · '+WorldNavigation.forms[this.form].label);
  this.domShadow=document.createElement('div');this.domShadow.className='world-rig-shadow';this.dom.appendChild(this.domShadow);this.domHero=document.createElement('div');this.domHero.className='world-rig-hero';this.domHero.style.backgroundImage='url("'+this.image+'")';this.dom.appendChild(this.domHero);this.fallback.appendChild(this.dom);this.layout();
 }
 size(height){if(Math.abs(height-this.height)<.1)return;this.height=height;this.layout();}
 pose(p,direction=0,frame=0,time=0,moving=false,motion=true){
  this.position={x:p.x,y:p.y};this.direction=direction;this.frame=frame;this.time=time;this.moving=moving;this.motion=motion;
  if(this.root)this.root.position.set(p.x*DoupoWorldData.worldWidth/100,p.y*DoupoWorldData.worldHeight/100);
  if(this.dom){this.dom.style.left=p.x+'%';this.dom.style.top=p.y+'%';this.dom.classList.toggle('moving',moving);this.dom.classList.toggle('still',!motion);}this.layout();
 }
 layout(){
  if(this.destroyed)return;const h=this.height,d=this.direction||0,flight=this.form==='flight',ride=this.form==='convoy',f=flight&&this.motion?[0,1,0,2][Math.floor(this.time/220)%4]:this.frame||0,scale=ride?1.35:flight?1.45:1,lift=flight?h*(.12+(this.motion?Math.sin(this.time/300)*.025:0)):0;
  const mirror=d===3&&this.avatar.mirrorWest?.[this.form],column=mirror?1:d;
  if(this.hero){this.hero.texture=this.heroFrames[f*4+column];this.hero.height=h*scale;this.hero.width=this.hero.height*this.hero.texture.width/this.hero.texture.height;this.hero.y=-lift;this.hero.scale.x=(mirror?-1:1)*Math.abs(this.hero.scale.x);}
  if(this.shadow){this.shadow.scale.set(h/110*(ride?1.4:1),flight?.65:1);this.shadow.alpha=flight?.5:1;}
  if(this.effects){this.effects.clear();if(this.moving&&this.motion&&this.form!=='walk'){const v=[[0,1],[1,0],[0,-1],[-1,0]][d];for(let i=1;i<=4;i++){const t=(this.time/450+i/4)%1,dist=(.15+t*.5)*h,x=-v[0]*dist,y=-v[1]*dist;if(flight)this.effects.moveTo(x,y-lift).lineTo(x-v[0]*h*.16,y-v[1]*h*.16-lift).stroke({color:this.avatar.tint,width:2,alpha:(1-t)*.45});else this.effects.ellipse(x,y+3,(3+t*4)*h/100,(2+t*2)*h/100).fill({color:0xb9a378,alpha:(1-t)*.3});}}}
  if(this.domHero)Object.assign(this.domHero.style,{width:h*scale*1.125+'px',height:h*scale+'px',top:-lift+'px',transform:'translate(-50%,-94%) scaleX('+(mirror?-1:1)+')',backgroundSize:'400% 300%',backgroundPosition:(column/3*100)+'% '+(f/2*100)+'%'});
  if(this.domShadow){this.domShadow.style.width=h*(ride?.52:.35)+'px';this.domShadow.style.height=h*.1+'px';this.domShadow.style.opacity=flight?'.15':'.25';}
 }
 destroy(){this.destroyed=true;this.dom?.remove();this.root?.destroy({children:true});for(const f of this.textures)f.destroy();this.textures=[];}
}
if(typeof module==='object'&&module.exports)module.exports=WorldActor;
