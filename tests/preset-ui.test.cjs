const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{webcrypto}=require('node:crypto');
const C=require('../assets/js/preset-core.js'),T=require('../assets/js/tavern-core.js'),M=require('../assets/js/preset-manager.js');
function setup(){
  const a=C.importPreset({name:'A',prompts:[{identifier:'first',content:'FIRST'},{identifier:'second',content:'SECOND'},{identifier:'main',content:'MAIN'}],prompt_order:[{character_id:100000,order:[{identifier:'first',enabled:true},{identifier:'second',enabled:true},{identifier:'main',enabled:true}]}]},'a');
  const b=C.copy(a);b.id='b';b.name='B';let box=null,name=null,markup='',fail=false,closed=0,fields=[],triggerBox=null;
  const guard={hidden:true,innerHTML:'',scrollIntoView(){}},badge={classList:{toggle(){}},textContent:''},stored=new Map(),notices=[];
  function mount(html){markup=html;name={value:html.match(/id="preset-workbench-name"[^>]*value="([^"]*)"/)[1]};box={querySelectorAll:s=>s==='[data-prompt]'?fields:[],querySelector:()=>triggerBox,setAttribute(){},removeAttribute(){},contains:()=>true,set outerHTML(value){mount(value);}};fields=[];triggerBox=null;}
  const state={PresetCore:C,TavernCore:T,PresetManager:M,crypto:webcrypto,
    document:{getElementById:id=>({'preset-workbench':box,'preset-workbench-name':name,'preset-leave-guard':guard,'preset-draft-status':badge,'preset-copy-name':{value:'Copy'}}[id]||null)},
    tavernState:{presets:[a,b],tavernSettings:{activePresetId:'a'},chats:[]},GameState:{settings:{apis:[]}},getTavernApi:()=>({backend:'openai'}),
    showModal:mount,showToast:text=>notices.push(text),closeAllModals(){closed++;box=null;},renderSettingsTab(){},
    db:{presets:{async put(p){if(fail)throw Error('quota');stored.set(p.id,structuredClone(p));}}},
    createPresetPrompt:()=>({identifier:webcrypto.randomUUID(),name:'New',content:'',role:'system'})};
  vm.createContext(state);vm.runInContext(fs.readFileSync(path.join(__dirname,'../assets/js/preset-ui.js'),'utf8'),state);
  state.PresetUI.open('a');
  return {state,ui:state.PresetUI,stored,notices,guard,get name(){return name;},get box(){return box;},get markup(){return markup;},get closed(){return closed;},fail:v=>{fail=v;},fields:v=>{fields=v;},triggers:v=>{triggerBox={querySelectorAll:()=>v.map(k=>({dataset:{trigger:k}}))};}};
}
test('reordering only changes the draft until save, then changes real outgoing order',async()=>{
  const h=setup();h.ui.move(1,-1);assert.equal(h.state.tavernState.presets[0].prompt_order[0].order[0].identifier,'first');
  await h.ui.save();const p=h.stored.get('a');
  const messages=T.composePrompt({plan:T.promptPlan({preset:p}),userInput:'USER'}).messages;
  assert.deepEqual(messages.map(m=>m.content),['SECOND','FIRST','MAIN','USER']);
});
test('drag uses the same order semantics and standard blocks cannot be removed',async()=>{
  const h=setup();h.ui.dragStart({dataTransfer:{setData(){}}},0);h.ui.drop({preventDefault(){}},1);h.ui.removeOrder(2);await h.ui.save();
  assert.deepEqual(h.stored.get('a').prompt_order[0].order.map(o=>o.identifier),['second','first','main']);
});
test('dirty close can cancel, discard, or save without modifying the old preset prematurely',async()=>{
  const h=setup();h.name.value='Edited';let leaves=0;
  assert.equal(h.ui.guardClose(h.box,()=>leaves++),true);assert.equal(h.guard.hidden,false);
  await h.ui.resolveLeave('cancel');assert.equal(leaves,0);assert.equal(h.state.tavernState.presets[0].name,'A');
  h.ui.guardClose(h.box,()=>leaves++);h.fail(true);await h.ui.resolveLeave('save');assert.equal(leaves,0);assert.equal(h.state.tavernState.presets[0].name,'A');
  h.fail(false);await h.ui.resolveLeave('save');assert.equal(leaves,1);assert.equal(h.stored.get('a').name,'Edited');
});
test('switching presets with discard keeps the saved original',async()=>{
  const h=setup();h.name.value='Discard me';h.ui.open('b');assert.equal(h.guard.hidden,false);
  await h.ui.resolveLeave('discard');assert.equal(h.name.value,'B');assert.equal(h.state.tavernState.presets[0].name,'A');
});
test('clean closing does not show a save prompt; save-as creates an independent preset',async()=>{
  const clean=setup();assert.equal(clean.ui.guardClose(clean.box,()=>{}),false);
  const h=setup();h.name.value='Edited';await h.ui.save(true);
  assert.equal(h.state.tavernState.presets.length,3);assert.equal(h.state.tavernState.presets[0].name,'A');
  const copy=h.state.tavernState.presets[2];assert.equal(copy.name,'Copy');assert.notEqual(copy.id,'a');assert.notEqual(copy.prompts,h.state.tavernState.presets[0].prompts);
});
test('checkbox triggers affect requests while imported unsupported trigger types survive editing',async()=>{
  const h=setup();h.ui.editPrompt('first');h.triggers(['continue','quiet']);await h.ui.save();
  const p=h.stored.get('a');assert.deepEqual(Array.from(p.prompts[0].injection_trigger),['continue','quiet']);
  const normal=T.composePrompt({plan:T.promptPlan({preset:p,generationType:'normal'}),userInput:'U'});
  const continuation=T.composePrompt({plan:T.promptPlan({preset:p,generationType:'continue'}),userInput:'U'});
  assert.ok(!normal.messages.some(m=>m.content==='FIRST'));assert.ok(continuation.messages.some(m=>m.content==='FIRST'));
});
test('individual switches omit disabled text from requests while keeping its content and position for reactivation',async()=>{
  const h=setup();h.ui.toggle(0,false);await h.ui.save();let p=h.stored.get('a');
  assert.equal(p.prompts[0].content,'FIRST');assert.equal(p.prompt_order[0].order[0].identifier,'first');
  assert.ok(!T.composePrompt({plan:T.promptPlan({preset:p}),userInput:'U'}).messages.some(m=>m.content==='FIRST'));
  h.ui.open('a');h.ui.toggle(0,true);await h.ui.save();p=h.stored.get('a');
  assert.ok(T.composePrompt({plan:T.promptPlan({preset:p}),userInput:'U'}).messages.some(m=>m.content==='FIRST'));
});

test('editor defaults to the same author order as outgoing messages without manually inserting prompts',async()=>{
 const h=setup(),p=h.state.tavernState.presets[0];p.prompt_order.push({character_id:100001,order:[{identifier:'second',enabled:true},{identifier:'first',enabled:false}]});h.ui.open('a');
 h.ui.toggle(0,false);await h.ui.save();const saved=h.stored.get('a');assert.equal(saved.prompt_order[1].order[0].enabled,false);assert.equal(saved.prompt_order[0].order[0].enabled,true);
 assert.deepEqual(T.composePrompt({plan:T.promptPlan({preset:saved}),userInput:'now'}).messages.map(m=>m.content),['now']);
});
