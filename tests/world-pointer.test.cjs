const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');

function fixture(scene='world'){
 const listeners={},ground=[],selected=[];let top=200;
 const host={addEventListener:(type,fn)=>listeners[type]=fn,removeEventListener(){},focus(){},getBoundingClientRect:()=>({left:100,top,width:800,height:600})};
 const s={performance,DoupoWorldData:{worldWidth:1600,worldHeight:1000},matchMedia:()=>({matches:false}),document:{addEventListener(){},removeEventListener(){}}};vm.createContext(s);vm.runInContext(fs.readFileSync('assets/js/world-renderer.js','utf8')+';this.Renderer=WorldRenderer;',s);
 const r=new s.Renderer(host,(...args)=>selected.push(args),p=>ground.push(p));Object.assign(r,{width:800,height:600,fit:.5,model:{scene:{id:scene},npcs:[]},tapTargets:[]});r.transform=()=>{};r.installInput();
 function event(type,x,y,extra={}){listeners[type]({type,pointerId:1,clientX:x,clientY:y,target:{closest:()=>null,setPointerCapture(){}},...extra});}
 function tap(x,y){event('pointerdown',x,y);event('pointerup',x,y);}
 return {r,event,tap,ground,selected,scrollTo(value){top=value;}};
}

test('native taps reach the same ground before and after scrolling, without needing a Pixi event',()=>{
 const s=fixture();s.tap(500,500);assert.deepEqual([s.ground[0].x,s.ground[0].y],[50,50]);
 s.scrollTo(-100);s.tap(500,200);assert.deepEqual([s.ground[1].x,s.ground[1].y],[50,50]);assert.equal(s.selected.length,0);
});
test('zoomed and panned ground taps retain their actual map coordinate',()=>{
 const s=fixture();s.r.zoom=2;s.r.pan={x:100,y:-50};s.tap(760,350);assert.deepEqual([s.ground[0].x,s.ground[0].y],[60,40]);
});
test('a displaced mainland label and its point each select exactly once, while its leader stays passable',()=>{
 const s=fixture();s.r.tapTargets=[{node:{id:'city',x:10,y:10},box:{x:500,y:300,w:120,h:30}}];
 s.tap(650,515);s.tap(180,300);assert.deepEqual(s.selected,[['city'],['city']]);assert.equal(s.ground.length,0);
 s.tap(450,410);assert.equal(s.ground.length,1);assert.equal(s.selected.length,2);
});
test('local names and NPC figures select their destination without also firing a ground trip',()=>{
 const s=fixture('wutan');s.r.tapTargets=[{node:{id:'market',x:50,y:50},text:{width:160,height:30}}];s.r.model.npcs=[{id:'merchant',locationId:'shop',x:20,y:30}];
 s.tap(500,515);s.tap(272.5,392.5);assert.deepEqual(s.selected,[['market'],['shop','merchant']]);assert.equal(s.ground.length,0);
});
test('panning, cancelled touches, outside releases and native buttons never start a ground trip',()=>{
 const s=fixture();s.event('pointerdown',300,300);s.event('pointermove',330,300);s.event('pointerup',330,300);
 s.event('pointerdown',300,300);s.event('pointercancel',300,300);s.event('pointerup',300,300);
 s.event('pointerdown',300,300);s.event('pointerup',950,300);
 const button={closest:()=>({})};s.event('pointerdown',300,300,{target:button});s.event('pointerup',300,300,{target:button});
 assert.equal(s.ground.length,0);assert.equal(s.selected.length,0);
});
