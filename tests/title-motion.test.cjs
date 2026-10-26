const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../assets/js/title-motion.js'),'utf8');
function harness(reduce=false){
  const frames=new Map(),observers=[],contexts=[];let serial=0;
  function element(){
    const classes=new Set();const listeners={};
    return {style:{},dataset:{},listeners,children:[],attributes:{},className:'',textContent:'',
      classList:{contains:x=>classes.has(x),add:x=>classes.add(x),remove:x=>classes.delete(x),toggle(x,on){if(on===undefined)on=!classes.has(x);if(on)classes.add(x);else classes.delete(x);}},
      getBoundingClientRect:()=>({left:0,top:0,width:1024,height:650}),
      addEventListener:(name,fn)=>{listeners[name]=fn;},setAttribute(name,value){this.attributes[name]=value;},removeAttribute(name){delete this.attributes[name];},
      prepend(x){this.children.unshift(x);},append(x){this.children.push(x);},remove(){},
      getContext(type){if(type==='webgl')return null;if(this.context)return this.context;
        const c={lines:0,washes:0,clearRect(){this.lines=0;this.washes=0;},stroke(){this.lines++;},fillRect(){this.washes++;},createRadialGradient(){return {addColorStop(){}};},createLinearGradient(){return {addColorStop(){}};}};
        for(const k of ['setTransform','beginPath','moveTo','lineTo','bezierCurveTo','quadraticCurveTo','closePath','save','restore','translate','rotate','scale','fill'])c[k]=()=>{};
        this.context=c;contexts.push(c);return c;}
    };
  }
  const root=element(),footer=element(),image=Object.assign(element(),{naturalWidth:1672,complete:true}),surface=element(),petals=element();root.classList.add('active');
  let scene=null;
  root.querySelector=s=>s==='.landing-footer'?footer:scene;
  const doc={readyState:'complete',hidden:false,listeners:{},getElementById:()=>root,addEventListener(name,fn){this.listeners[name]=fn;},createElement(tag){const e=element();if(tag==='div'){scene=e;e.querySelector=s=>s==='img'?image:s==='.title-motion-petals'?petals:surface;}return e;}};
  const media={matches:reduce,addEventListener(){}};
  const sandbox={document:doc,window:{devicePixelRatio:1,addEventListener(){}},matchMedia:()=>media,
    requestAnimationFrame(fn){frames.set(++serial,fn);return serial;},cancelAnimationFrame:id=>frames.delete(id),
    MutationObserver:class{constructor(fn){observers.push(fn);}observe(){}},ResizeObserver:class{constructor(fn){this.fn=fn;}observe(){this.fn();}}};
  vm.runInNewContext(source,sandbox);
  const toggle=footer.children[0];
  function frame(t){const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn(t));}
  return {root,doc,frames,frame,toggle,refresh:()=>observers[0]()};
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
