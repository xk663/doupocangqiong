const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const data=require('../assets/js/world-data.js'),nav=require('../assets/js/world-navigation.js');

function fixture(protocol){
 const selected=[],sources=[],listeners=new Map();let pixiInitializations=0;
 class Element {
  constructor(){this.children=[];this.style={};this.dataset={};this.classList={toggle(){}};}
  appendChild(el){this.children.push(el);return el;}
  replaceChildren(...els){this.children=els;}
  setAttribute(key,value){this[key]=value;}
  addEventListener(type,fn){listeners.set(type,fn);}
  removeEventListener(){}
  getBoundingClientRect(){return {left:0,top:0,width:900,height:600};}
  getClientRects(){return [this.getBoundingClientRect()];}
  remove(){}
  set src(value){sources.push(value);this.complete=true;this.naturalWidth=1536;queueMicrotask(()=>this.onload?.());}
 }
 class Observer {observe(){}disconnect(){}}
 class Application {
  constructor(){pixiInitializations++;this.canvas=new Element();this.stage={addChild(){}};this.renderer={resize(){}};this.ticker={add(){},started:false};}
  async init(){}
  render(){}stop(){}destroy(){}
 }
 class Container {constructor(){this.scale={set(){}};this.position={set(){}};}destroy(){}}
 const sandbox={DoupoWorldData:data,WorldNavigation:nav,location:{protocol,search:''},URLSearchParams,performance,setTimeout,clearTimeout,queueMicrotask,
  matchMedia:()=>({matches:false}),devicePixelRatio:1,ResizeObserver:Observer,IntersectionObserver:Observer,
  document:{hidden:false,createElement:()=>new Element(),createElementNS:()=>new Element(),addEventListener(){},removeEventListener(){}},
  Image:class extends Element {},PIXI:{Application,Container,Assets:{load(){throw Error('File mode must never fetch a WebGL texture');}}}};
 vm.createContext(sandbox);
 for(const file of ['world-actor.js','world-renderer.js'])vm.runInContext(fs.readFileSync('assets/js/'+file,'utf8'),sandbox);
 vm.runInContext('this.Renderer=WorldRenderer',sandbox);
 const host=new Element(),r=new sandbox.Renderer(host,(id,npc)=>selected.push([id,npc]));
 return {r,host,sources,selected,listeners,pixiInitializations:()=>pixiInitializations};
}

test('direct-file mode loads the map and all avatar forms without fetching Pixi textures',async()=>{
 const {r,host,sources,selected,pixiInitializations}=fixture('file:');await r.init();
 assert.equal(pixiInitializations(),0);assert.equal(host.dataset.renderer,'lightweight');
 const point={id:'market',name:'坊市长街',x:50,y:50,known:true};
 for(const avatar of nav.avatars)for(const form of Object.keys(nav.forms)){
  const model={scene:{id:'wutan',name:'乌坦城',art:'assets/images/world/world-wutan.webp'},nodes:[point],npcs:[],routes:[],routeIds:[],pose:{x:50,y:50,direction:0},avatar,form};
  assert.equal(await r.render(model),true);assert.equal(host.dataset.actorAvatar,avatar.id);assert.equal(host.dataset.actorForm,form);
  assert.equal(host.dataset.actorError,'false');assert.ok(sources.includes(avatar.sheets[form]));
  assert.equal(r.fallbackEl.children.filter(el=>el.className==='world-player-rig').length,1);
  r.setActorPose({x:56,y:42},1,1,250);assert.equal(r.actor.dom.style.left,'56%');assert.equal(r.actor.dom.style.top,'42%');
 }
 assert.ok(sources.includes('assets/images/world/world-wutan.webp'));
 r.fallbackEl.children.find(el=>el.className?.startsWith('world-fallback-pin')).onclick();assert.equal(selected[0][0],'market');
 assert.equal(pixiInitializations(),0);r.destroy();
});

test('HTTP and HTTPS keep their existing Pixi renderer',async()=>{
 for(const protocol of ['http:','https:']){const {r,host,pixiInitializations}=fixture(protocol);await r.init();assert.equal(pixiInitializations(),1);assert.equal(host.dataset.renderer,'pixi');assert.equal(r.fallbackEl,undefined);r.destroy();}
});

test('the map entry loads actor and renderer scripts under file URLs without depending on Pixi',async()=>{
 const core=require('../assets/js/world-core.js');
 for(const protocol of ['file:','http:']){
  const elements=new Map(),scripts=[],state=core.initial(data,'wutan-market','file-mode');
  const ctx={state,player:{name:'隔离旅人',gender:'female',realm:'斗王·一星',inventory:[],exploration:state},economy:{gold:0},gameTime:{hour:8,minute:0},worldState:{location:'乌坦城'},questSystem:{quests:[],completed:[],failed:[]}};
  function element(){return {value:'',innerHTML:'',hidden:true,disabled:false,style:{},classList:{add(){},toggle(){}},addEventListener(){},setAttribute(){},querySelector(selector){if(!elements.has(selector))elements.set(selector,element());return elements.get(selector);}};}
  const host=element();host.isConnected=true;
  const sandbox={WorldCore:core,WorldNavigation:nav,DoupoWorldData:data,location:{protocol},matchMedia:()=>({matches:false}),document:{createElement:element,head:{append(el){
   scripts.push(el.src);
   if(el.src.includes('pixi-'))sandbox.PIXI={};
   if(el.src.endsWith('world-actor.js'))sandbox.WorldActor=class {};
   if(el.src.endsWith('world-renderer.js'))sandbox.WorldRenderer=class {async init(){return this;}setMotion(){}resize(){}async render(){return true;}};
   el.onload();
  }}}};
  vm.createContext(sandbox);for(const file of ['world-bridge.js','world-ui.js'])vm.runInContext(fs.readFileSync('assets/js/'+file,'utf8'),sandbox);
  sandbox.WorldMapBridge.configure({read:()=>ctx,commit(){throw Error('Loading the map must not modify a save');},isBusy:()=>false,toast(){}});
  const view=await sandbox.WorldMapUI.mount(host);await view.renderPromise;assert.ok(view.renderer);
  assert.deepEqual(scripts,protocol==='file:'?['assets/js/world-actor.js','assets/js/world-renderer.js']:['assets/vendor/pixi-8.22.0.min.js','assets/js/world-actor.js','assets/js/world-renderer.js']);
 }
});
