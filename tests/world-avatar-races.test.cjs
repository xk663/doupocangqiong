const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const nav=require('../assets/js/world-navigation.js'),data=require('../assets/js/world-data.js');
const defer=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
class Node {
 constructor(){this.children=[];this.style={};this.dataset={};this.position={set(){}};this.scale={set(){}};this.anchor={set(){}};this.classList={toggle(){}};}
 addChild(n){if(this.destroyed)throw Error('destroyed scene');n.parent?.removeChild(n);n.parent=this;this.children.push(n);return n;}
 appendChild(n){return this.addChild(n);}
 removeChild(n){this.children=this.children.filter(x=>x!==n);n.parent=null;return n;}
 remove(){this.parent?.removeChild(this);}
 replaceChildren(...nodes){for(const n of [...this.children])this.removeChild(n);for(const n of nodes)this.addChild(n);}
 setAttribute(k,v){this[k]=v;}
 on(){}
 destroy(){if(this.destroyed)throw Error('double destroy');this.destroyed=true;this.remove();for(const n of [...this.children])n.destroy();}
}
class Graphics extends Node {rect(){return this;}fill(){return this;}circle(){return this;}stroke(){return this;}ellipse(){return this;}moveTo(){return this;}lineTo(){return this;}closePath(){return this;}quadraticCurveTo(){return this;}}
function renderer(dom=false){
 const gates=new Map(),backgrounds=new Map(),actors=[],leases=[];
 class Actor {
  constructor(opts){Object.assign(this,opts);this.form=opts.form||'walk';this.image=this.avatar.sheets[this.form];actors.push(this);}
  static async acquire(url){await backgrounds.get(url)?.promise;const lease={texture:{url},released:0,release(){this.released++;assert.equal(this.released,1);}};leases.push(lease);return lease;}
  static trimAssets(){}
  static async loadDOMImage(url,img){await backgrounds.get(url)?.promise;return img;}
  async init(){await gates.get(this.avatar.id)?.promise;if(this.destroyed)return this;if(this.fallback){this.dom=new Node();this.dom.className='world-player-rig';this.fallback.appendChild(this.dom);}else{this.root=new Node();this.world.addChild(this.root);}return this;}
  pose(p){assert.ok(!this.destroyed);this.position=p;}
  size(){}
  destroy(){if(this.destroyed)return;this.destroyed=true;this.root?.destroy();this.dom?.remove();}
 }
 const sandbox={WorldActor:Actor,WorldNavigation:nav,DoupoWorldData:data,WorldCore:{hash:()=>1},matchMedia:()=>({matches:false}),PIXI:{Container:Node,Sprite:Node,Graphics,Text:Node},document:{createElement:()=>new Node(),createElementNS:()=>new Node()}};
 vm.createContext(sandbox);vm.runInContext(fs.readFileSync('assets/js/world-renderer.js','utf8')+';globalThis.Renderer=WorldRenderer;',sandbox);
 const host=new Node();host.getBoundingClientRect=()=>({width:800,height:500});const r=new sandbox.Renderer(host,()=>{});r.width=800;r.height=500;r.fit=.5;r.motion=false;
 r.app={stage:new Node(),ticker:{started:false},render(){},start(){this.ticker.started=true;},stop(){this.ticker.started=false;},destroy(){this.stage.destroy();}};
 r.world=new Node();r.app.stage.addChild(r.world);if(dom){r.mode='dom';r.fallbackEl=new Node();r.app=undefined;r.world=undefined;}
 const model=(id,scene='wutan')=>({scene:{id:scene,art:'bg-'+scene,name:scene},nodes:[],npcs:[],routes:[],routeIds:[],pose:{x:50,y:50,direction:0},avatar:nav.avatars.find(a=>a.id===id),form:'walk'});
 return {r,host,gates,backgrounds,actors,leases,model};
}
for(const dom of [false,true])test((dom?'lightweight':'Pixi')+' keeps the old figure during loading and only commits the last requested figure',async()=>{
 const {r,host,gates,model}=renderer(dom);await r.render(model('xiaoyan'));const old=r.actor,visible=dom?r.fallbackEl:r.app.stage;
 gates.set('xuner',defer());const b=r.render(model('xuner'));await flush();assert.equal(r.actor,old);assert.ok(!old.destroyed);
 gates.set('xiaoyixian',defer());const c=r.render(model('xiaoyixian'));await flush();assert.equal(r.actor,old);assert.ok(!old.destroyed);
 gates.get('xiaoyixian').resolve();assert.equal(await c,true);assert.equal(r.actor.avatar.id,'xiaoyixian');assert.ok(old.destroyed);
 gates.get('xuner').resolve();assert.equal(await b,false);assert.equal(r.actor.avatar.id,'xiaoyixian');assert.equal(host.dataset.actorAvatar,'xiaoyixian');assert.equal(host.dataset.actorLoading,'false');assert.equal(host.dataset.actorError,'false');assert.equal(r.pending.size,0);
 if(dom)assert.equal(visible.children.filter(n=>n.className==='world-player-rig').length,1);else assert.equal(visible.children.length,1);
 r.destroy();
});
for(const dom of [false,true])test((dom?'lightweight':'Pixi')+' retains the live figure on failure and ignores stale failures',async()=>{
 const {r,host,gates,model}=renderer(dom);await r.render(model('xiaoyan'));const original=r.actor;
 gates.set('xuner',defer());const b=r.render(model('xuner'));await flush();gates.get('xuner').reject(Error('network'));await assert.rejects(b,/保留原画面/);assert.equal(r.actor,original);assert.ok(!original.destroyed);assert.equal(r.actorReady,false);assert.equal(host.dataset.actorError,'true');
 gates.set('medusa',defer());const stale=r.render(model('medusa'));await flush();assert.equal(await r.render(model('xiaoyixian')),true);gates.get('medusa').reject(Error('late network'));assert.equal(await stale,false);assert.equal(r.actor.avatar.id,'xiaoyixian');assert.equal(host.dataset.actorError,'false');r.destroy();
});
test('leaving during a background load releases the late lease and never attaches a scene after destruction',async()=>{
 const {r,backgrounds,leases,model}=renderer();backgrounds.set('bg-wutan',defer());const pending=r.render(model('xiaoyan'));r.destroy();backgrounds.get('bg-wutan').resolve();assert.equal(await pending,false);assert.equal(leases.length,1);assert.equal(leases[0].released,1);assert.equal(r.pending.size,0);assert.equal(r.actor,null);
});

test('committing a loaded map draws its first frame without waiting for ticker or user input',async()=>{
 const {r,model}=renderer();let draws=0;r.app.renderer={resize(){}};r.app.ticker.started=true;r.app.render=()=>draws++;
 await r.render(model('xiaoyan'));assert.ok(draws>0);r.destroy();
});

for(const dom of [false,true])test((dom?'lightweight':'Pixi')+' commits scene-specific wide dimensions atomically with its actor',async()=>{
 const {r,model,gates}=renderer(dom);await r.render(model('xiaoyan'));const oldWidth=r.W,wide=model('xuner','world');wide.scene.width=1920;wide.scene.height=819;gates.set('xuner',defer());const pending=r.render(wide);await flush();assert.equal(r.W,oldWidth);gates.get('xuner').resolve();assert.equal(await pending,true);assert.equal(r.W,1920);assert.equal(r.H,819);assert.ok(r.W*r.fit<=r.width+.001);assert.ok(r.H*r.fit<=r.height+.001);if(!dom){assert.equal(r.actor.worldWidth,1920);assert.equal(r.actor.worldHeight,819);}await r.render(model('xiaoyan'));assert.equal(r.W,data.worldWidth);assert.equal(r.H,data.worldHeight);r.destroy();
});

test('the real actor uses its own wide scene dimensions without changing saved percentage coordinates',()=>{
 const Actor=actorCache({}),a=new Actor({world:{},avatar:nav.avatars[0],worldWidth:1920,worldHeight:819});let pixel;a.root={position:{set(x,y){pixel={x,y};}}};a.pose({x:25,y:75});assert.deepEqual(pixel,{x:480,y:614.25});assert.deepEqual({...a.position},{x:25,y:75});
});
function actorCache(assets){const sandbox={WorldNavigation:nav,DoupoWorldData:data,PIXI:{Assets:assets},module:{exports:{}}};vm.createContext(sandbox);vm.runInContext(fs.readFileSync('assets/js/world-actor.js','utf8'),sandbox);return sandbox.module.exports;}
test('returning to an evicted atlas waits for unload before loading a fresh source',async()=>{
 const retired=defer(),loads=[],unloads=[],textures=new Map();const Actor=actorCache({async load(url){loads.push(url);const t={url,destroyed:false};textures.set(url,t);return t;},async unload(url){unloads.push(url);if(url==='A')await retired.promise;textures.get(url).destroyed=true;}});
 for(const url of ['A','B','C']){const lease=await Actor.acquire(url);lease.release();}await flush();assert.ok(unloads.includes('A'));
 const again=Actor.acquire('A');await flush();assert.equal(loads.filter(u=>u==='A').length,1);retired.resolve();const live=await again;assert.equal(loads.filter(u=>u==='A').length,2);assert.equal(live.texture.destroyed,false);live.release();Actor.trimAssets(true);await flush();
});
test('live atlases remain pinned while the unused atlas cache stays bounded',async()=>{
 const unloaded=[];const Actor=actorCache({async load(url){return {url};},async unload(url){unloaded.push(url);}});const live=await Actor.acquire('live');
 for(let i=0;i<12;i++){const lease=await Actor.acquire('idle-'+i);lease.release();}await flush();assert.ok(!unloaded.includes('live'));assert.equal(Actor.assets.size,3);live.release();live.release();Actor.trimAssets(true);await flush();assert.equal(Actor.assets.size,0);assert.ok(unloaded.includes('live'));
});
test('an actor destroyed during atlas loading never creates a root and releases its acquired source',async()=>{
 const gate=defer(),Actor=actorCache({load:()=>gate.promise,async unload(){}}),a=new Actor({world:new Node(),avatar:nav.avatars[0]});const pending=a.init();a.destroy();gate.resolve({width:1536,height:1024});await pending;assert.equal(a.root,undefined);assert.equal([...Actor.assets.values()][0].refs,0);Actor.trimAssets(true);await flush();
});

test('retrying a failed figure reloads the saved choice without executing a game action',async()=>{
 const core=require('../assets/js/world-core.js'),state=core.initial(data,'wutan-market','retry');
 const ctx={state,player:{name:'测试角色',gender:'male',realm:'斗王·一星',inventory:[],exploration:state},economy:{gold:40},gameTime:{hour:8,minute:0},worldState:{location:'乌坦城'},questSystem:{quests:[],completed:[],failed:[]}};
 const elements=new Map(),models=[];let commits=0,fail=true;
 function element(){return {value:'',innerHTML:'',hidden:true,disabled:false,style:{},classList:{add(){},toggle(){}},addEventListener(){},setAttribute(){},querySelector(selector){if(!elements.has(selector))elements.set(selector,element());return elements.get(selector);}};}
 const host=element();host.isConnected=true;
 const sandbox={WorldCore:core,WorldNavigation:nav,DoupoWorldData:data,matchMedia:()=>({matches:false}),PIXI:{},WorldActor:class {},WorldRenderer:class {async init(){return this;}setMotion(){}resize(){}render(model){models.push(model);return fail?Promise.reject(Error('保留原画面')):Promise.resolve(true);}},document:{createElement:element,head:{append(){}}}};
 vm.createContext(sandbox);vm.runInContext(fs.readFileSync('assets/js/world-bridge.js','utf8'),sandbox);sandbox.WorldMapBridge.configure({read:()=>ctx,commit(){commits++;},isBusy:()=>false,toast(){}});vm.runInContext(fs.readFileSync('assets/js/world-ui.js','utf8'),sandbox);
 const before=JSON.stringify(ctx),view=await sandbox.WorldMapUI.mount(host);await view.renderPromise;
 const retry=host.querySelector('[data-map-action=retry-avatar]');assert.equal(retry.hidden,false);assert.equal(retry.disabled,false);
 fail=false;const count=models.length;view.action('retry-avatar',{});await view.renderPromise;
 assert.equal(models.length,count+1);assert.equal(models.at(-1).avatar.id,state.avatarId);assert.equal(retry.hidden,true);assert.equal(commits,0);assert.equal(JSON.stringify(ctx),before);
});
