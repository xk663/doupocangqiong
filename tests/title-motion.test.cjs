const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../assets/js/title-motion.js'),'utf8');
function harness(reduce=false,options={}){
  const frames=new Map(),observers=[],resizers=[],contexts=[];let serial=0;
  function element(){
    const classes=new Set();const listeners={};
    return {style:{},dataset:{},listeners,children:[],attributes:{},className:'',textContent:'',
      classList:{contains:x=>classes.has(x),add:x=>classes.add(x),remove:x=>classes.delete(x),toggle(x,on){if(on===undefined)on=!classes.has(x);if(on)classes.add(x);else classes.delete(x);}},
      getBoundingClientRect:()=>({left:0,top:0,width:options.width||1024,height:options.height||650}),
      addEventListener:(name,fn)=>{listeners[name]=fn;},setAttribute(name,value){this.attributes[name]=value;},removeAttribute(name){delete this.attributes[name];},
      prepend(x){this.children.unshift(x);},append(x){this.children.push(x);},remove(){},
      getContext(type){if(type==='webgl')return null;if(this.context)return this.context;
        const c={lines:0,washes:0,clears:0,clearRect(){this.clears++;this.lines=0;this.washes=0;},stroke(){this.lines++;},fillRect(){this.washes++;},createRadialGradient(){return {addColorStop(){}};},createLinearGradient(){return {addColorStop(){}};}};
        for(const k of ['setTransform','beginPath','moveTo','lineTo','bezierCurveTo','quadraticCurveTo','closePath','save','restore','translate','rotate','scale','fill'])c[k]=()=>{};
        this.context=c;contexts.push(c);return c;}
    };
  }
  const root=element(),html=element(),footer=element(),image=Object.assign(element(),{naturalWidth:1672,complete:true}),surface=element(),petals=element();root.classList.add('active');
  let scene=null;
  root.querySelector=s=>s==='.landing-footer'?footer:scene;
  const doc={readyState:'complete',hidden:false,documentElement:html,listeners:{},getElementById:()=>root,addEventListener(name,fn){this.listeners[name]=fn;},createElement(tag){const e=element();if(tag==='div'){scene=e;e.querySelector=s=>s==='img'?image:s==='.title-motion-petals'?petals:surface;}return e;}};
  const media={matches:reduce,addEventListener(){}};
  const sandbox={document:doc,window:{devicePixelRatio:options.dpr||1,addEventListener(){}},matchMedia:()=>media,
    requestAnimationFrame(fn){frames.set(++serial,fn);return serial;},cancelAnimationFrame:id=>frames.delete(id),
    MutationObserver:class{constructor(fn){observers.push(fn);}observe(){}},ResizeObserver:class{constructor(fn){this.fn=fn;resizers.push(fn);}observe(){this.fn();}}};
  vm.runInNewContext(source,sandbox);
  const toggle=footer.children[0];
  function frame(t){const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn(t));}
  return {root,doc,frames,frame,toggle,surface,petals,contexts,refresh:()=>observers[0](),resize(width,height){options.width=width;options.height=height;resizers.forEach(fn=>fn());}};
}
test('title animation stops outside the title view and resumes with one frame loop',()=>{
  const h=harness();assert.equal(h.frames.size,1);h.frame(0);assert.equal(h.frames.size,1);
  h.root.classList.remove('active');h.refresh();assert.equal(h.frames.size,0);
  h.root.classList.add('active');h.refresh();h.refresh();assert.equal(h.frames.size,1);
  h.doc.hidden=true;h.doc.listeners.visibilitychange();assert.equal(h.frames.size,0);
  h.doc.hidden=false;h.doc.listeners.visibilitychange();assert.equal(h.frames.size,1);
});
test('reduced motion defaults to static and the pause control stops pending work',()=>{
  const h=harness(true);assert.equal(h.frames.size,0);assert.equal(h.toggle.attributes['aria-pressed'],'true');
  h.toggle.listeners.click();assert.equal(h.frames.size,1);h.frame(0);
  h.toggle.listeners.click();assert.equal(h.frames.size,0);
});

test('high-DPI phones gain scene resolution without allocating unbounded canvases on rotation',()=>{
  const h=harness(false,{width:873,height:339,dpr:2.75});
  assert.ok(h.surface.width>873*1.5,'the scene is sharper than the old DPR cap');
  for(const [width,height] of [[873,339],[393,800],[3840,2160]]){
    h.resize(width,height);
    assert.ok(h.surface.width*h.surface.height<=1920*1080,'bounded full-scene buffer');
    assert.ok(h.petals.width*h.petals.height<=400000,'bounded decorative buffer');
    assert.ok(h.surface.width>0&&h.surface.height>0);
    assert.equal(h.frames.size,1,'resizing never creates an extra animation loop');
  }
});

test('animation skips excess display frames, then stops when paused or hidden',()=>{
  const h=harness();
  for(const now of [0,16,32,48,64,80,96])h.frame(now);
  assert.equal(h.contexts[0].clears,3,'decorations share the bounded scene cadence');
  assert.equal(h.frames.size,1);
  h.toggle.listeners.click();assert.equal(h.frames.size,0);
  const painted=h.contexts[0].clears;
  h.frame(160);assert.equal(h.contexts[0].clears,painted);
  h.toggle.listeners.click();assert.equal(h.frames.size,1);
  h.doc.hidden=true;h.doc.listeners.visibilitychange();assert.equal(h.frames.size,0);
});

test('a custom background suspends the hidden title renderer and restoring default resumes one loop',()=>{
  const h=harness();h.frame(0);
  h.doc.documentElement.classList.add('has-user-background');h.refresh();
  assert.equal(h.frames.size,0);
  const painted=h.contexts[0].clears;h.frame(100);assert.equal(h.contexts[0].clears,painted);
  h.doc.documentElement.classList.remove('has-user-background');h.refresh();h.refresh();
  assert.equal(h.frames.size,1);
});
