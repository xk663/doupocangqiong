const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{webcrypto}=require('node:crypto');
const C=require('../assets/js/preset-core.js'),T=require('../assets/js/tavern-core.js'),M=require('../assets/js/preset-manager.js');
function setup(session,initialId='a'){
  const a=C.importPreset({name:'A',prompts:[{identifier:'first',content:'FIRST'},{identifier:'second',content:'SECOND'},{identifier:'main',content:'MAIN'}],prompt_order:[{character_id:100000,order:[{identifier:'first',enabled:true},{identifier:'second',enabled:true},{identifier:'main',enabled:true}]}]},'a');
  const b=C.copy(a);b.id='b';b.name='B';let box=null,name=null,markup='',fail=false,closed=0,fields=[],settingFields=[],triggerBox=null;
  const guard={hidden:true,innerHTML:'',scrollIntoView(){}},badge={classList:{toggle(){}},textContent:''},stored=new Map(),notices=[],reveals=[];let listPane,editorPane;
  function mount(html){markup=html;const initialName=html.match(/id="preset-workbench-name"[^>]*value="([^"]*)"/)[1];name={value:initialName,defaultValue:initialName};listPane={scrollTop:0,scrollIntoView(){reveals.push('list');}};editorPane={scrollTop:0,scrollIntoView(){reveals.push('editor');}};box={querySelectorAll:s=>s==='[data-prompt]'?fields:s==='[data-setting]'?settingFields:[],querySelector:s=>s==='.preset-prompt-list'?listPane:s==='.preset-prompt-editor'?editorPane:triggerBox,setAttribute(){},removeAttribute(){},contains:()=>true,set outerHTML(value){mount(value);}};fields=[];settingFields=[];triggerBox=null;}
  const state={PresetCore:C,TavernCore:T,PresetManager:M,crypto:webcrypto,
    document:{getElementById:id=>({'preset-workbench':box,'preset-workbench-name':name,'preset-leave-guard':guard,'preset-draft-status':badge,'preset-copy-name':{value:'Copy'}}[id]||null)},
    tavernState:{presets:[a,b],tavernSettings:{activePresetId:'a'},chats:[]},GameState:{settings:{apis:[]}},getTavernApi:()=>({backend:'openai'}),
    showModal:mount,showToast:text=>notices.push(text),closeAllModals(){closed++;box=null;},renderSettingsTab(){},
    db:{presets:{async put(p){if(fail)throw Error('quota');stored.set(p.id,structuredClone(p));}}},
    createPresetPrompt:()=>({identifier:webcrypto.randomUUID(),name:'New',content:'',role:'system'})};
  const events={};if(session){state.window={addEventListener:(name,callback)=>events[name]=callback};state.sessionStorage={getItem:key=>session.get(key)||null,setItem(key,value){if(session.fail)throw Error('quota');session.set(key,value);},removeItem:key=>session.delete(key)};state.setTimeout=()=>1;state.clearTimeout=()=>{};}
  vm.createContext(state);vm.runInContext(fs.readFileSync(path.join(__dirname,'../assets/js/preset-ui.js'),'utf8'),state);
  state.PresetUI.open(initialId);
  return {state,ui:state.PresetUI,events,stored,notices,guard,reveals,get listPane(){return listPane;},get editorPane(){return editorPane;},get name(){return name;},get box(){return box;},get markup(){return markup;},get closed(){return closed;},fail:v=>{fail=v;},fields:v=>{fields=v;},settingsFields:v=>{settingFields=v;},triggers:v=>{triggerBox={querySelectorAll:()=>v.map(k=>({dataset:{trigger:k}}))};}};
}
test('reordering only changes the draft until save, then changes real outgoing order',async()=>{
  const h=setup();h.ui.move(1,-1);assert.equal(h.state.tavernState.presets[0].prompt_order[0].order[0].identifier,'first');
  await h.ui.save();const p=h.stored.get('a');
  const messages=T.composePrompt({plan:T.promptPlan({preset:p}),userInput:'USER'}).messages;
  assert.deepEqual(messages.map(m=>m.content),['SECOND','FIRST','MAIN','USER']);
});

const draftKey='doupo_preset_editor_draft_v1:a';
function refreshEvent(h){const event={returnValue:'untouched',preventDefault(){throw Error('Refresh must not be blocked');}};h.events.beforeunload(event);assert.equal(event.returnValue,'untouched');}
test('viewing and switching prompts leaves native refresh unblocked and creates no backup',()=>{
  const session=new Map(),h=setup(session);h.ui.editPrompt('second');refreshEvent(h);assert.equal(session.size,0);assert.equal(h.ui.guardClose(h.box,()=>{}),false);
});
test('CRLF text normalized by the browser is not counted as an edit during viewing',()=>{
  const h=setup(new Map());h.state.tavernState.presets[0].prompts[0].content='first\r\nline';h.ui.open('a');h.fields([{type:'textarea',dataset:{prompt:'0',field:'content'},defaultValue:'first\nline',value:'first\nline'}]);
  h.ui.editPrompt('second');refreshEvent(h);assert.equal(h.ui.guardClose(h.box,()=>{}),false);assert.equal(h.state.tavernState.presets[0].prompts[0].content,'first\r\nline');
});
test('refresh preserves provisional form values and reopens them as a draft without committing the preset',()=>{
  const session=new Map(),first=setup(session);first.name.value='Refresh draft';first.ui.changed();refreshEvent(first);assert.ok(session.has(draftKey));assert.equal(first.stored.size,0);
  const restored=setup(session);assert.equal(restored.name.value,'Refresh draft');assert.equal(restored.state.tavernState.presets[0].name,'A');assert.equal(restored.stored.size,0);assert.ok(restored.notices.some(text=>text.includes('已恢复刷新前')));
});
test('incomplete JSON is backed up as raw input instead of forcing a parse or blocking refresh',()=>{
  const session=new Map(),h=setup(session);h.ui.switchTab('sampling');h.settingsFields([{tagName:'TEXTAREA',type:'textarea',dataset:{setting:'stop',json:''},defaultValue:'[]',value:'["incomplete'}]);h.ui.changed();refreshEvent(h);
  const record=JSON.parse(session.get(draftKey));assert.ok(record.raw.some(row=>row.value==='["incomplete'));assert.equal(record.tab,'sampling');assert.deepEqual(record.draft.settings.stop,[]);
});
test('opening another preset after reload does not replace an earlier unsaved draft',()=>{
  const session=new Map(),first=setup(session);first.name.value='Draft A';refreshEvent(first);const original=session.get(draftKey);
  const second=setup(session,'b');second.name.value='Draft B';refreshEvent(second);assert.equal(session.get(draftKey),original);assert.ok(session.has('doupo_preset_editor_draft_v1:b'));
});
test('a select with an implicit first option is clean until its value actually changes',()=>{
  const session=new Map(),h=setup(session),field={tagName:'SELECT',dataset:{setting:'apiId'},value:'',options:[{value:'',selected:true,defaultSelected:false},{value:'other',selected:false,defaultSelected:false}]};
  h.settingsFields([field]);refreshEvent(h);assert.equal(session.size,0);field.value='other';refreshEvent(h);assert.ok(session.has(draftKey));
});
test('confirmed saving/discarding clears the refresh backup while failed saving retains it',async()=>{
  const session=new Map(),h=setup(session);h.name.value='Draft';refreshEvent(h);h.fail(true);await h.ui.save();assert.ok(session.has(draftKey));
  h.fail(false);await h.ui.save();assert.equal(session.has(draftKey),false);
  const discard=setup(session);discard.name.value='Discard';refreshEvent(discard);discard.ui.guardClose(discard.box,()=>{});await discard.ui.resolveLeave('discard');assert.equal(session.has(draftKey),false);
});
test('unavailable session storage cannot trap refresh or replace a prior valid backup',()=>{
  const session=new Map(),h=setup(session);h.name.value='First draft';refreshEvent(h);const original=session.get(draftKey);session.fail=true;h.name.value='Latest draft';refreshEvent(h);assert.equal(session.get(draftKey),original);assert.equal(h.state.tavernState.presets[0].name,'A');
});
test('a stale refresh backup cannot overwrite a changed preset and remains recoverable',()=>{
  const session=new Map(),h=setup(session);h.name.value='Old draft';refreshEvent(h);const raw=session.get(draftKey),saved=JSON.parse(raw);saved.baseline='older-version';session.set(draftKey,JSON.stringify(saved));
  const fresh=setup(session);assert.equal(fresh.name.value,'A');refreshEvent(fresh);assert.equal(JSON.parse(session.get(draftKey)).name,'Old draft');assert.ok(fresh.notices.some(text=>text.includes('原预设已变化')));
});

test('selecting a later prompt preserves list position, reveals its editor and retains unsaved content',async()=>{
  const h=setup();h.listPane.scrollTop=700;h.editorPane.scrollTop=260;h.fields([{dataset:{prompt:'0',field:'content'},type:'textarea',value:'UNSAVED FIRST'}]);
  h.ui.editPrompt('second');assert.equal(h.listPane.scrollTop,700);assert.equal(h.editorPane.scrollTop,0);assert.equal(h.reveals.at(-1),'editor');assert.ok(h.markup.includes('<h3>second</h3>'));
  h.editorPane.scrollTop=140;h.ui.toggle(1,false);assert.equal(h.listPane.scrollTop,700);assert.equal(h.editorPane.scrollTop,140);
  h.ui.showPromptList();assert.equal(h.reveals.at(-1),'list');await h.ui.save();assert.equal(h.stored.get('a').prompts[0].content,'UNSAVED FIRST');
  h.ui.open('b');assert.equal(h.listPane.scrollTop,0);
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
