const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {webcrypto} = require('node:crypto');
const core = require('../assets/js/tavern-core.js');
const html = fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
function source(name) {
  const match = html.match(new RegExp('(?:async )?function ' + name + '\\([^]*?\\n\\}'));
  assert.ok(match, name + ' exists'); return match[0];
}
function context(names, overrides = {}) {
  const elements = new Map();
  function el(id) {
    if (!elements.has(id)) elements.set(id,{id,value:'',textContent:'',style:{},appendChild(child){elements.set(child.id,child);},remove(){elements.delete(this.id);}});
    return elements.get(id);
  }
  const records = new Map(), notices = [], storage = new Map();
  function table(name) { return {async put(value){records.set(name + ':' + value.id,core.clone(value));},async bulkPut(values){for(const value of values)await this.put(value);}}; }
  const db = {chats:table('chats'),lorebooks:table('lorebooks'),presets:table('presets'),characterCard:table('characterCard'),tavernSettings:table('tavernSettings'),
    async transaction(mode,tables,callback){const previous=new Map(records);let aborted=false;try{await callback({abort(){aborted=true;}});if(aborted)throw core.abortError();}catch(e){records.clear();for(const [k,v]of previous)records.set(k,v);throw e;}}};
  const chat={id:'chat-a',messages:[],variables:{gold:10},presetId:'preset',lorebookIds:[]};
  const state = {BeautyRoster:require('../assets/js/beauty-roster.js'),BeautyChronicle:require('../assets/js/beauty-chronicle.js'),StoryQuests:require('../assets/js/story-quests.js'),TavernCore:core,LoreCatalog:require('../assets/js/lore-catalog.js'),TavernWiring:require('../assets/js/tavern-wiring.js'),DoupoUserFlames:require('../assets/js/user-flames.js'),console,AbortController,crypto:webcrypto,URL,FormData,Blob,Set,Date,
    document:{getElementById:el,createElement(){return {id:'',textContent:'',className:'',remove(){elements.delete(this.id);}};}},
    db,tavernState:{isLoading:false,isSending:false,chats:[chat],activeChatId:'chat-a',presets:[{id:'preset',settings:{}}],lorebooks:[],activeLorebookIds:[],tavernSettings:{},characterCard:{id:'active',name:'角色'}},
    GameState:{player:{name:'玩家',desireLust:0},settings:{apis:[{id:'api',url:'https://example.com/v1',apiKey:'LOCAL-SECRET'}]},phase:'title'},GameTime:{day:1},WorldState:{location:'A'},TimeRewind:{snapshots:[],maxSnapshots:20},SAVES_KEY:'doupo_saves',RACES:[],
    localStorage:{getItem(k){return storage.get(k)||null;},setItem(k,v){storage.set(k,v);}},
    showToast(msg,type){notices.push({msg,type});},renderTavernMessages(){},renderTavernSessionList(){},updateTavernInfo(){},initGameWorld(){},closeAllModals(){},renderSaveList(){},
    createChatMessage(role,content){return {id:webcrypto.randomUUID(),role,content};},getActiveChat(){return state.tavernState.chats.find(c=>c.id===state.tavernState.activeChatId);},
    assembleTavernPrompt(){return {messages:[],estimatedTokens:4,removedMessages:0};},matchLorebookEntries(){return [];},StreamParser:core.streamParser,
    applyRegexScripts(text){return text;},saveToLocalStorage(){return true;},takeSnapshot(){},createDefaultTavernSettings(){return {id:'main'};},
    ...overrides};
  vm.createContext(state);vm.runInContext(fs.readFileSync(path.join(__dirname,'../assets/js/save-manager.js'),'utf8'),state);if(names.includes('runTavernTurn'))vm.runInContext(source('prepareTavernRequest'),state);for(const name of names)vm.runInContext(source(name),state);
  return {state,records,notices,storage,el};
}

test('all HTML entry scripts remain syntactically valid',()=>{
  for(const file of ['index.html','game.html','sillytavern.html'])for(const match of fs.readFileSync(path.join(__dirname,'..',file),'utf8').matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))new vm.Script(match[1]);
});
const entry=(id,keys,content,extra={})=>({id,keys,content,enabled:true,...extra});
test('lorebooks recurse through eligible entries, skip disabled entries and stop cycles',()=>{
  const books=[{id:'book',name:'book',entries:[entry('a',['alpha'],'beta'),entry('b',['beta'],'gamma'),entry('c',['gamma'],'alpha'),entry('disabled',['beta'],'secret',{enabled:false})]}];
  assert.deepEqual(core.matchLorebooks('alpha',books).map(m=>m.entry.id),['a','b','c']);
  assert.deepEqual(core.matchLorebooks('alpha',books,{maxDepth:0}).map(m=>m.entry.id),['a']);
  books[0].entries[0].noRecurse=true;
  assert.deepEqual(core.matchLorebooks('alpha',books).map(m=>m.entry.id),['a']);
});
test('selective secondary keys require primary plus the configured secondary logic',()=>{
  const book={id:'b',entries:[entry('x',['castle'],'lore',{selective:true,secondaryKeys:['rain','night'],selectiveLogic:'and'})]};
  assert.equal(core.matchLorebooks('castle rain',[book]).length,0);
  assert.equal(core.matchLorebooks('rain night',[book]).length,0);
  assert.equal(core.matchLorebooks('castle rain night',[book]).length,1);
  assert.equal(core.matchLorebooks('castle rain night',[book],{budget:1}).length,0);
});
test('custom preset keeps character/lore, nested order and message roles',()=>{
  const plan=core.promptPlan({preset:{prompts:[{identifier:'main',content:'MAIN',enabled:true},{identifier:'jailbreak',content:'LAST',role:'user',enabled:true}],prompt_order:[{character_id:100000,order:[{identifier:'main'},{identifier:'charDescription'},{identifier:'worldInfoBefore'},{identifier:'chatHistory'},{identifier:'jailbreak'},{identifier:'userInput'}]}]},characterCard:{name:'角色',description:'CHARACTER'},lorebookMatches:[{position:0,bookName:'b',entry:{content:'LORE'}}]});
  const result=core.composePrompt({plan,history:[{role:'user',content:'old'}],userInput:'CURRENT'});
  assert.deepEqual(result.messages.map(m=>m.content),['MAIN','CHARACTER','[b] LORE','old','LAST','CURRENT']);
  assert.equal(result.messages.find(m=>m.content==='LAST').role,'user');
  assert.equal(result.messages.filter(m=>m.content==='CURRENT').length,1);
});
test('disabled preset block stays excluded and depth injections use history distance',()=>{
  const plan=core.promptPlan({preset:{prompts:[{identifier:'main',content:'SECRET'},{identifier:'d',content:'DEPTH',injection_position:1,injection_depth:1}],prompt_order:[{identifier:'main',enabled:false},{identifier:'d'}]}});
  const out=core.composePrompt({plan,history:[{role:'user',content:'u'},{role:'assistant',content:'a'}],userInput:'now'});
  assert.equal(out.messages.some(m=>m.content==='SECRET'),false);
  assert.deepEqual(out.messages.map(m=>m.content),['u','DEPTH','a','now']);
});
test('context budget reserves output capacity and prunes complete old turns',()=>{
  const plan=core.promptPlan({characterCard:{description:'fixed'}});
  const result=core.composePrompt({plan,userInput:'current',history:[{role:'user',content:'x'.repeat(1000)},{role:'assistant',content:'old reply'},{role:'user',content:'recent'}],maxContext:120,maxOutput:40});
  assert.equal(result.removedMessages,2);assert.ok(result.estimatedTokens<=80);assert.equal(result.messages.at(-1).content,'current');
  assert.throws(()=>core.composePrompt({plan:core.promptPlan({characterCard:{description:'x'.repeat(1000)}}),maxContext:100,maxOutput:50}),/预算/);
});
test('content parsing accumulates split sections and plain text',()=>{
  let shown='';const p=core.streamParser();p.onTag((tag,text)=>{if(tag==='maintext')shown=text;});
  p.feed('## main');p.feed('text\n你好');p.feed('，世界');assert.equal(shown,'你好，世界');
  p.feed('\n## option\n- 继续');assert.equal(shown,'你好，世界');
  const plain=core.streamParser();plain.onTag((tag,text)=>shown=text);plain.feed('Hello');plain.feed(' world');assert.equal(shown,'Hello world');
});
function streamResponse(text,step=1,type='text/event-stream'){
  const bytes=new TextEncoder().encode(text);let offset=0;
  return new Response(new ReadableStream({pull(controller){if(offset>=bytes.length)return controller.close();controller.enqueue(bytes.slice(offset,offset+step));offset+=step;}}),{headers:{'content-type':type}});
}
test('SSE handles UTF-8 boundaries, CRLF, data without space, DONE and EOF remainder',async()=>{
  const payload='data:{"choices":[{"delta":{"content":"你好"}}]}\r\n\r\ndata: {"choices":[{"delta":{"content":"世界"}}]}\r\n\r\ndata:[DONE]\r\n\r\n';
  assert.equal(await core.readStream(streamResponse(payload),'openai',()=>{}),'你好世界');
  assert.equal(await core.readStream(streamResponse('data:{"choices":[{"delta":{"content":"尾部"}}]}'),'openai'),'尾部');
  await assert.rejects(core.readStream(streamResponse('data:{"error":{"message":"provider failed"}}\n\n'),'openai'),/provider failed/);
});
test('Ollama NDJSON preserves final record without newline',async()=>{
  assert.equal(await core.readStream(streamResponse('{"message":{"content":"a"}}\n{"message":{"content":"b"}}'),'ollama'),'ab');
});
test('endpoint normalization accepts both base URLs and full local endpoints',()=>{
  assert.equal(core.endpoint('http://localhost:11434/api/chat','ollama'),'http://localhost:11434/api/chat');
  assert.equal(core.endpoint('http://localhost:5001/api/v1/generate/','kobold'),'http://localhost:5001/api/v1/generate');
  assert.equal(core.endpoint('https://example.com/v1/','openai'),'https://example.com/v1/chat/completions');
  assert.throws(()=>core.endpoint('javascript:alert(1)','openai'),/HTTP/);
});
test('requests pass signal and zero sampling values; Kobold JSON is decoded as text',async()=>{
  const controller=new AbortController();let sent;
  const fetcher=async(url,opts)=>{sent={url,...opts};return Response.json({results:[{text:'story'}]});};
  assert.equal(await core.request({backend:'kobold',url:'http://localhost:5001/api/v1/generate'},[],{temperature:0,top_p:0,signal:controller.signal},()=>{},fetcher),'story');
  assert.equal(sent.signal,controller.signal);assert.equal(JSON.parse(sent.body).temperature,0);
  controller.abort();await assert.rejects(core.request({url:'https://example.com'},[],{signal:controller.signal},null,fetcher),{name:'AbortError'});
});
test('redaction and JSON parsing remove credential fields and prototype keys',()=>{
  const data=core.parseJSON('{"__proto__":{"polluted":true},"settings":{"apis":[{"id":"a","apiKey":"SECRET","key":"SECRET"}],"discordWebhook":"SECRET"}}');
  const safe=core.redact(data);assert.equal(JSON.stringify(safe).includes('SECRET'),false);assert.equal({}.polluted,undefined);
  assert.deepEqual(core.applyOperations(core.parseJSON('{"gold":10}'),[{type:'addSmallSum',key:'gold',amount:3},{type:'toggle',key:'active'},{type:'set',key:'__proto__',value:'bad'}]),{gold:13,active:true});
});
test('JSON and PNG tEXt character cards preserve Unicode; invalid cards fail clearly',async()=>{
  const data={spec:'chara_card_v2',data:{name:'萧薰儿',description:'人物描述',first_mes:'你好'}};
  const chunk=Buffer.from('chara\0'+Buffer.from(JSON.stringify(data)).toString('base64'));const png=Buffer.alloc(8+12+chunk.length);Buffer.from([137,80,78,71,13,10,26,10]).copy(png);png.writeUInt32BE(chunk.length,8);png.write('tEXt',12);chunk.copy(png,16);
  const card=await core.importCard({name:'card.png',size:png.length,arrayBuffer:async()=>png.buffer.slice(png.byteOffset,png.byteOffset+png.length)});
  assert.equal(card.name,'萧薰儿');assert.equal(card.firstMessage,'你好');
  await assert.rejects(core.importCard({name:'bad.json',size:2,text:async()=>'{}'}),/名称和描述/);
});
const turnFunctions=['runTavernTurn','setTavernSendingUI','stopTavernStream','regenerateLastTavern','parseUpstore','extractVariables','mergeVariables'];

test('residence metadata commits with the visible reply and regeneration does not duplicate events',async()=>{
 const ResidenceCore=require('../assets/js/residence-core.js'),line='你在营帐里调息了一刻。';
 const reply=line+'<residence_updates>'+JSON.stringify([{action:'record',kind:'meditation',title:'调息一刻',evidence:line}])+'</residence_updates>';
 const {state,records}=context(turnFunctions,{ResidenceCore,callLLMStream:async()=>reply});
 state.WorldState={location:'石漠城',specificSpot:'向导营地'};
 await state.runTavernTurn('在驻地调息',false);
 assert.equal(state.GameState.player.residence.events.length,1);
 assert.ok(!state.getActiveChat().messages.at(-1).content.includes('residence_updates'));
 assert.equal(records.get('tavernSettings:main').playerState.residence.events.length,1);
 await state.runTavernTurn('',true);assert.equal(state.GameState.player.residence.events.length,1);
});
test('flame events persist atomically with narrative, hide metadata and survive regeneration without duplicates',async()=>{
 const FlameCore=require('../assets/js/flame-core.js'),line='向导听说青莲地心火藏在岩浆之中。';
 const reply=line+'<flame_updates>'+JSON.stringify([{rank:19,stage:'heard',source:'told',evidence:line}])+'</flame_updates>';
 const {state,records}=context(turnFunctions,{FlameCore,HEAVENLY_FLAMES:[{rank:19,name:'青莲地心火'}],callLLMStream:async()=>reply});
 await state.runTavernTurn('询问异火线索',false);
 assert.equal(state.GameState.player.flameChronicle.records[19].stage,'heard');assert.equal(records.get('tavernSettings:main').playerState.flameChronicle.records[19].events.length,1);assert.ok(!state.getActiveChat().messages.at(-1).content.includes('flame_updates'));
 await state.runTavernTurn('',true);assert.equal(state.GameState.player.flameChronicle.records[19].events.length,1);
});
test('failed flame turn persistence cannot advance the current life fire record',async()=>{
 const FlameCore=require('../assets/js/flame-core.js'),line='向导听说青莲地心火藏在岩浆之中。';
 const {state}=context(turnFunctions,{FlameCore,HEAVENLY_FLAMES:[{rank:19,name:'青莲地心火'}],callLLMStream:async()=>line+'<flame_updates>'+JSON.stringify([{rank:19,stage:'heard',source:'told',evidence:line}])+'</flame_updates>'});
 state.db.tavernSettings.put=async()=>{throw Error('quota');};await state.runTavernTurn('打听消息',false);assert.equal(state.GameState.player.flameChronicle,undefined);
});

test('failed residence turn storage never advances the in-memory residence ledger',async()=>{
 const ResidenceCore=require('../assets/js/residence-core.js'),line='杜青禾在门前向你问好。';
 const {state}=context(turnFunctions,{ResidenceCore,callLLMStream:async()=>line+'<residence_updates>'+JSON.stringify([{action:'record',kind:'visit',title:'故人来访',evidence:line}])+'</residence_updates>'});
 state.WorldState={location:'青山镇',specificSpot:'客栈'};
 state.db.tavernSettings.put=async()=>{throw Error('quota');};
 await state.runTavernTurn('等候故人',false);assert.equal(state.GameState.player.residence,undefined);
});

function installWorldBridge(state){
  state.WorldCore=require('../assets/js/world-core.js');state.DoupoWorldData=require('../assets/js/world-data.js');
  state.Economy={gold:40};state.GameTime={era:'斗气历',year:1,month:1,day:1,hour:8,minute:0,totalHours:0};state.WorldState={location:'乌坦城'};
  state.QuestSystem={quests:[],completed:[],failed:[]};state.StudioState={};
  Object.assign(state.GameState.player,{realm:'斗之气·三段',inventory:[{name:'干粮',qty:4},{name:'水囊',qty:4}]});
  state.getTimeString=()=>state.GameTime.hour+':'+state.GameTime.minute;state.renderTimeDisplay=()=>{};
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../assets/js/world-bridge.js'),'utf8'),state);
  state.WorldMapBridge.ensure();state.GameState.player.exploration.pose={sceneId:'wutan',x:48,y:50,direction:0};return state.WorldMapBridge;
}

test('actual map commit persists one runtime envelope and rewind restores location, time and goods',async()=>{
 const {state,storage}=context(['saveToLocalStorage','takeSnapshot','rewindToSnapshot','stopTavernStream']);
 const bridge=installWorldBridge(state);const before=core.clone(state.GameState.player.exploration);
 assert.ok(bridge.execute({type:'travel',targetId:'qingshan'}));assert.equal(state.GameState.player.exploration.locationId,'qingshan');assert.equal(state.GameTime.hour,14);
 const saved=JSON.parse(storage.get('doupo_runtime'));assert.equal(saved.player.exploration.locationId,'qingshan');assert.equal(saved.gameTime.hour,14);assert.equal(saved.worldState.specificSpot,'青山镇');
 const snap=state.TimeRewind.snapshots[0];assert.ok(snap);await state.rewindToSnapshot(snap.id);assert.equal(state.GameState.player.exploration.locationId,'wutan');assert.equal(state.GameTime.hour,8);assert.equal(state.GameState.player.exploration.vigor,before.vigor);
});

test('actual map quota failure rolls back player, economy, time and added snapshot',()=>{
 const {state}=context(['saveToLocalStorage','takeSnapshot']);const bridge=installWorldBridge(state);const before=JSON.stringify({player:state.GameState.player,economy:state.Economy,time:state.GameTime,world:state.WorldState,settings:state.GameState.settings});state.localStorage.setItem=()=>{throw Error('quota');};
 assert.equal(bridge.execute({type:'buy',npcId:'su-merchant',itemId:'food',qty:1}),null);
 assert.equal(JSON.stringify({player:state.GameState.player,economy:state.Economy,time:state.GameTime,world:state.WorldState,settings:state.GameState.settings}),before);assert.equal(state.TimeRewind.snapshots.length,0);
});

test('actual assembler injects map facts once and respects pure-text mode',()=>{
 const {state}=context(['assembleTavernPrompt','createPreset']);installWorldBridge(state);const opts={preset:state.createPreset(),userInput:'查看附近'};
 let text=state.assembleTavernPrompt(opts).messages.map(m=>m.content).join('\n');assert.equal((text.match(/【地图已确认事实】/g)||[]).length,1);assert.match(text,/苏掌柜/);assert.match(text,/world_action/);
 state.tavernState.tavernSettings.pureTextMode=true;text=state.assembleTavernPrompt(opts).messages.map(m=>m.content).join('\n');assert.ok(!text.includes('地图行动可选协议'));
});

test('LLM response offers a validated map action without executing or displaying the control tag',async()=>{
 const {state}=context(turnFunctions,{callLLMStream:async()=>'<maintext>可以先到青山镇看看。</maintext><world_action>{"type":"travel","targetId":"qingshan","mode":"walk"}</world_action>'});const bridge=installWorldBridge(state);
 await state.runTavernTurn('问路',false);assert.equal(state.GameState.player.exploration.locationId,'wutan');assert.equal(state.GameTime.hour,8);assert.equal(bridge.getProposal().targetId,'qingshan');assert.ok(!state.getActiveChat().messages.at(-1).content.includes('world_action'));
});

test('regenerating narrative after map travel preserves map-owned inventory and position',async()=>{
 const {state}=context(turnFunctions,{callLLMStream:async()=>'<maintext>新的叙述。</maintext>'});const bridge=installWorldBridge(state);
 await state.runTavernTurn('问路',false);assert.ok(bridge.execute({type:'travel',targetId:'qingshan'}));const before=core.clone(state.GameState.player);
 await state.runTavernTurn('',true);assert.equal(state.GameState.player.exploration.locationId,'qingshan');assert.deepEqual(state.GameState.player.inventory,before.inventory);assert.equal(state.GameTime.hour,14);
});

test('a walking character cannot start an overlapping LLM turn',async()=>{
 let calls=0;const {state,notices}=context(turnFunctions,{callLLMStream:async()=>{calls++;return 'reply';}});const bridge=installWorldBridge(state);const token=bridge.beginMovement();await state.runTavernTurn('交谈',false);assert.equal(calls,0);assert.equal(state.getActiveChat().messages.length,0);assert.ok(notices.some(n=>n.msg.includes('停步')));bridge.finishMovement(token,null);
});

test('avatar and form saves do not crowd rewind history, while the next real movement still snapshots',()=>{
 const {state,storage}=context(['saveToLocalStorage','takeSnapshot']);const bridge=installWorldBridge(state);bridge.execute({type:'appearance',avatarId:'xiaoyixian'});bridge.execute({type:'movement-mode',mode:'convoy'});assert.equal(state.TimeRewind.snapshots.length,0);assert.equal(state.GameState.player.history,undefined);assert.equal(JSON.parse(storage.get('doupo_runtime')).player.exploration.avatarId,'xiaoyixian');assert.ok(bridge.execute({type:'walk',sceneId:'wutan',x:49,y:65,mode:'convoy'}));assert.equal(state.TimeRewind.snapshots.length,1);assert.ok(state.GameState.player.history.length);assert.equal(state.GameState.player.exploration.movementMode,'convoy');
});
test('successful replay replaces one assistant and applies state updates exactly once',async()=>{
  const {state}=context(turnFunctions,{callLLMStream:async()=> '正文<upstore>addSmallSum:gold:3 toggle:active</upstore>'});
  await state.runTavernTurn('前往坊市',false);assert.equal(state.getActiveChat().variables.gold,13);assert.equal(state.getActiveChat().variables.active,true);
  await state.regenerateLastTavern();assert.equal(state.getActiveChat().messages.length,2);assert.equal(state.getActiveChat().variables.gold,13);assert.equal(state.getActiveChat().variables.active,true);
});
test('a new-life request uses its session narrator and selected location without overwriting imported cards',async()=>{
 let assembled;
 const {state}=context(turnFunctions,{WorldState:{location:'魔兽山脉外围',specificSpot:'青山镇药铺外'},assembleTavernPrompt(opts){assembled=opts;return {messages:[],estimatedTokens:0,removedMessages:0};},callLLMStream:async()=> '新的故事'});
 state.tavernState.characterCard={name:'用户导入角色',description:'保留'};
 state.getActiveChat().characterCard={name:'斗气大陆',description:'独立叙事'};
 await state.runTavernTurn('打听采药队',false);
 assert.equal(assembled.characterCard.name,'斗气大陆');assert.equal(assembled.location,'魔兽山脉外围 · 青山镇药铺外');assert.equal(state.tavernState.characterCard.name,'用户导入角色');
});
test('stop never falls back and restores usable UI; pending input can be replayed',async()=>{
  let calls=0,start;const started=new Promise(r=>start=r);
  const {state,el}=context(turnFunctions,{callLLMStream:async(messages,opts)=>{calls++;start();return new Promise((resolve,reject)=>opts.signal.addEventListener('abort',()=>reject(core.abortError()),{once:true}));},callLLM:async()=>{throw Error('Unexpected fallback');}});
  const send=state.runTavernTurn('继续',false);await started;state.stopTavernStream();await send;
  assert.equal(calls,1);assert.equal(state.tavernState.isSending,false);assert.equal(el('tavern-input').disabled,false);assert.equal(state.getActiveChat().messages.length,1);
  state.callLLMStream=async()=> '重试成功';await state.regenerateLastTavern();assert.equal(state.getActiveChat().messages.length,2);
});
test('reset or chat switch cannot be overwritten by a delayed completion',async()=>{
  let finish,start;const started=new Promise(r=>start=r);
  const {state,records}=context(turnFunctions,{callLLMStream:async()=>{start();return new Promise(r=>finish=r);}});
  const send=state.runTavernTurn('行动',false);await started;state.stopTavernStream();state.getActiveChat().messages=[];await state.db.chats.put(state.getActiveChat());state.tavernState.activeChatId='other';finish('旧回复');await send;
  assert.equal(records.get('chats:chat-a').messages.length,0);assert.equal(state.GameState.player.name,'玩家');
});
test('snapshot round trip includes chat/world state and keeps only matching local credentials',async()=>{
  const names=['buildGameSnapshot','validateGameSnapshot','restoreGameSnapshot','stopTavernStream'];
  const {state,records}=context(names);
  const save=state.buildGameSnapshot();assert.equal(JSON.stringify(save).includes('LOCAL-SECRET'),false);
  state.GameTime.day=9;state.getActiveChat().variables.gold=999;await state.restoreGameSnapshot(save);
  assert.equal(state.GameTime.day,1);assert.equal(state.getActiveChat().variables.gold,10);assert.equal(state.GameState.settings.apis[0].apiKey,'LOCAL-SECRET');assert.ok(records.has('chats:chat-a'));
});
test('quota failure does not show a false save success',()=>{
  const {state,notices}=context(['buildGameSnapshot','createSave','saveSaves','getSaves'],{localStorage:{getItem(){return null;},setItem(){throw Error('QuotaExceeded');}}});
  assert.equal(state.createSave(),false);assert.equal(notices.some(n=>n.type==='success'),false);
});
test('save names and handler arguments remain escaped',()=>{
  const {state}=context(['renderSaveListInner','escapeHtml']);
  const result=state.renderSaveListInner([{id:'x\');alert(1);//',name:'<img src=x onerror=alert(1)>',timestamp:1,player:{name:'<svg>'}}]);
  assert.equal(result.includes('<img'),false);assert.equal(result.includes('<svg>'),false);assert.ok(result.includes('&quot;'));
});

test('restoring saves retains beauty credentials only for the matching local endpoint and backend',async()=>{
 const {state}=context(['restoreGameSnapshot','validateGameSnapshot','stopTavernStream'],{Economy:{},StudioState:{},QuestSystem:{}});
 state.GameState.settings.beautyApi={url:'http://localhost:8080',backend:'gemini',apiKey:'LOCAL-BEAUTY-KEY'};
 const data={player:{name:'恢复角色'},settings:{beautyApi:{url:'http://localhost:8080',backend:'gemini',apiKey:'IMPORTED-SECRET'}}};await state.restoreGameSnapshot(data);assert.equal(state.GameState.settings.beautyApi.apiKey,'LOCAL-BEAUTY-KEY');
 await state.restoreGameSnapshot({...data,settings:{beautyApi:{url:'https://other.example',backend:'gemini'}}});assert.equal(state.GameState.settings.beautyApi.apiKey,'');
});

test('an asynchronous restore rolls back its database writes if the current life changes',async()=>{
 const {state,records}=context(['restoreGameSnapshot','validateGameSnapshot','stopTavernStream','buildGameSnapshot'],{Economy:{},StudioState:{},QuestSystem:{}});const saved=state.buildGameSnapshot();state.db.presets.bulkPut=async()=>{state.GameState.player={name:'新人生'};};await assert.rejects(state.restoreGameSnapshot(saved),/已变化/);assert.equal(state.GameState.player.name,'新人生');assert.equal(records.size,0);
});

test('the actual application assembler includes defaults alongside custom preset content',()=>{
  const {state}=context(['assembleTavernPrompt','createPreset']);
  state.tavernState.characterCard={name:'薰儿',description:'UNIQUE_CHARACTER'};
  const preset=state.createPreset();preset.prompts[0].content='CUSTOM_MAIN';
  const result=state.assembleTavernPrompt({preset,userInput:'CURRENT_INPUT',lorebookMatches:[{bookName:'世界书',position:0,entry:{content:'UNIQUE_LORE'}}]});
  const text=result.messages.map(m=>m.content).join('\n');
  for(const value of ['CUSTOM_MAIN','UNIQUE_CHARACTER','UNIQUE_LORE'])assert.ok(text.includes(value));
  assert.equal(result.messages.filter(m=>m.content==='CURRENT_INPUT').length,1);
});

test('actual outbound chat request includes global lore, prompt regex and player name once',async()=>{
  let outbound;
  const {state}=context([...turnFunctions,'assembleTavernPrompt'],{regexScripts:[{findRegex:'原词',replaceString:'青莲',placement:1}],callLLMStream:async(messages)=>{outbound=messages;return '回复';}});
  state.GameState.player.name='测试旅人';state.getActiveChat().userName='玩家';
  state.tavernState.activeLorebookIds=['global'];
  state.tavernState.lorebooks=[{id:'global',name:'已启用',entries:[entry('l',['青莲'],'{{user}}的 UNIQUE_GLOBAL_LORE')]}];
  await state.runTavernTurn('原词',false);
  assert.ok(outbound);const all=outbound.map(m=>m.content).join('\n');assert.ok(all.includes('测试旅人的 UNIQUE_GLOBAL_LORE'));
  assert.equal(outbound.filter(m=>m.role==='user'&&m.content==='青莲').length,1);
  assert.equal(state.getActiveChat().messages[0].content,'原词');
  assert.equal(state.tavernState.lastRequestInspection.selection.trace[0].status,'included');
});

test('request inspection detects preset-blocked lore and preview does not generate dice',()=>{
  let rolls=0;const {state}=context(['prepareTavernRequest','assembleTavernPrompt'],{generateDicePool(){rolls++;},getDicePoolText(){return 'DICE';}});
  state.GameState.player.name='测试者';state.tavernState.activeLorebookIds=['b'];
  state.tavernState.lorebooks=[{id:'b',name:'书',entries:[entry('e',['关键词'],'HIDDEN_LORE')]}];
  state.tavernState.presets=[{id:'preset',prompt_order:[{identifier:'worldInfoBefore',enabled:false}],settings:{}}];
  const before=JSON.stringify(state.GameState);const out=state.prepareTavernRequest(state.getActiveChat(),'关键词',[],true);
  assert.equal(rolls,0);assert.equal(out.selection.trace[0].status,'preset-disabled');assert.equal(JSON.stringify(state.GameState),before);
  assert.ok(!out.result.messages.some(m=>m.content.includes('HIDDEN_LORE')));
});

test('lore selection save failure preserves both global and chat binding',async()=>{
  const {state,notices}=context(['toggleLorebookActive'],{renderSettingsTab(){},stopTavernStream(){}});
  state.db.tavernSettings.put=async()=>{throw Error('quota');};
  await state.toggleLorebookActive('book',true);
  assert.equal(state.tavernState.activeLorebookIds.length,0);assert.equal(state.getActiveChat().lorebookIds.length,0);
  assert.ok(notices.some(n=>n.type==='error'));
});
test('a failed cloud upload retains the old backup and performs no deletion',async()=>{
  const calls=[];
  const {state,notices}=context(['syncToCloud','validateWebhook','buildGameSnapshot'],{fetch:async(url,opts)=>{calls.push({url,...opts});return new Response('',{status:503});}});
  state.GameState.settings.discordWebhook='https://discord.com/api/webhooks/123/TEST';state.GameState.settings.lastBackupIds=['old'];
  await state.syncToCloud();assert.equal(calls.length,1);assert.equal(state.GameState.settings.lastBackupIds[0],'old');assert.equal(notices.some(n=>n.type==='success'),false);
  const upload=await calls[0].body.get('file').text();assert.equal(upload.includes('LOCAL-SECRET'),false);
});
test('a successful cloud backup records the new backup before deleting the old one',async()=>{
  const calls=[];
  const {state,storage}=context(['syncToCloud','validateWebhook','buildGameSnapshot'],{fetch:async(url,opts)=>{calls.push({url,...opts});if(opts.method==='DELETE')return new Response('',{status:200});return Response.json({id:'new'});}});
  state.GameState.settings.discordWebhook='https://discord.com/api/webhooks/123/TEST';state.GameState.settings.lastBackupIds=['old'];
  await state.syncToCloud();assert.equal(state.GameState.settings.lastBackupIds[0],'new');assert.equal(calls[1].method,'DELETE');assert.ok(storage.has('doupo_cloud_backup'));
});
test('database startup preserves edited default and empty user lorebooks',async()=>{
  const books=[{id:'default',name:'斗破苍穹世界观',engineVersion:2,entries:[entry('user-edited',['x'],'my edited lore')]},{id:'empty',name:'新世界书',entries:[]}];
  const {state,records}=context(['initTavernDB'],{createDefaultLorebook(){throw Error('Existing books must not be overwritten');},createDefaultCharacterCard(){return {id:'active'};},syncTavernSettingsFromLocal(){}});
  state.db.lorebooks.toArray=async()=>core.clone(books);state.db.presets.toArray=async()=>[{id:'p',settings:{}}];state.db.characterCard.get=async()=>({id:'active'});state.db.tavernSettings.get=async()=>({id:'main'});state.db.chats.orderBy=()=>({reverse:()=>({toArray:async()=>[]})});
  await state.initTavernDB();assert.equal(state.tavernState.lorebooks.length,2);assert.equal(state.tavernState.lorebooks[0].entries[0].content,'my edited lore');assert.equal(state.tavernState.isLoading,false);
});
test('legacy non-recursion selection migrates without dropping book contents',async()=>{
  const {state,records}=context(['initTavernDB'],{createDefaultLorebook(){throw Error('No seed needed');},createDefaultCharacterCard(){return {id:'active'};},syncTavernSettingsFromLocal(){}});
  state.db.lorebooks.toArray=async()=>[{id:'old',entries:[entry('a',['x'],'saved content',{selective:true})]}];state.db.presets.toArray=async()=>[{id:'p',settings:{}}];state.db.characterCard.get=async()=>({id:'active'});state.db.tavernSettings.get=async()=>({id:'main'});state.db.chats.orderBy=()=>({reverse:()=>({toArray:async()=>[]})});
  await state.initTavernDB();const migrated=records.get('lorebooks:old');assert.equal(migrated.entries[0].excludeRecursion,true);assert.equal(migrated.entries[0].selective,false);assert.equal(migrated.entries[0].content,'saved content');
});
test('rewind uses its own chat and cloned snapshot state',async()=>{
  const {state,records}=context(['rewindToSnapshot','stopTavernStream']);state.TimeRewind.snapshots=[{id:'snap',chatId:'chat-a',messages:[{role:'user',content:'old'}],variables:{gold:2},player:{name:'old player'}}];
  await state.rewindToSnapshot('snap');assert.equal(state.getActiveChat().variables.gold,2);state.getActiveChat().variables.gold=9;assert.equal(state.TimeRewind.snapshots[0].variables.gold,2);assert.equal(records.get('tavernSettings:main').playerState.name,'old player');
  state.tavernState.activeChatId='other';await state.rewindToSnapshot('snap');assert.equal(state.GameState.player.name,'old player');
});
test('runtime persistence restores one atomic player/settings/world revision',()=>{
  const {state,storage}=context(['saveToLocalStorage','loadFromLocalStorage'],{Economy:{gold:8},StudioState:{level:2},QuestSystem:{quests:[{id:'q'}]}});
  assert.equal(state.saveToLocalStorage(),true);
  state.GameState.player.name='changed';state.GameTime.day=99;state.Economy.gold=0;state.QuestSystem.quests=[];
  storage.set('doupo_player','{"name":"stale compatibility copy"}');
  assert.equal(state.loadFromLocalStorage(),true);assert.equal(state.GameState.player.name,'玩家');assert.equal(state.GameTime.day,1);assert.equal(state.Economy.gold,8);assert.equal(state.QuestSystem.quests.length,1);
});
test('quota failure during runtime write preserves the previous valid envelope',()=>{
  const {state,storage}=context(['saveToLocalStorage'],{Economy:{},StudioState:{},QuestSystem:{}});
  assert.equal(state.saveToLocalStorage(),true);const previous=storage.get('doupo_runtime');state.GameState.player.name='not persisted';
  state.localStorage.setItem=()=>{throw Error('QuotaExceeded');};assert.equal(state.saveToLocalStorage(),false);assert.equal(storage.get('doupo_runtime'),previous);
});

test('supplemented flame lore reaches actual assembled requests and respects disabled entries',()=>{
  const supplement=require('../assets/js/user-flames.js');
  const {state}=context(['createDefaultLorebook','createLorebook','createLorebookEntry','assembleTavernPrompt','createPreset']);
  const book=state.createDefaultLorebook();
  for(const fire of supplement.flames){
    const matches=core.matchLorebooks('寻找'+fire.name,[book]);
    const text=state.assembleTavernPrompt({preset:state.createPreset(),userInput:'寻找'+fire.name,lorebookMatches:matches}).messages.map(m=>m.content).join('\n');
    assert.ok(text.includes(fire.summary));
    assert.ok(text.includes('项目补充设定'));
    const own=book.entries.find(e=>e.keys.includes(fire.name));
    own.enabled=false;
    assert.equal(core.matchLorebooks(fire.name,[book]).some(m=>m.entry.id===own.id),false);
    own.enabled=true;
  }
});

test('old bundled flame lore migrates once while edited and imported lore remains unchanged',()=>{
  const supplement=require('../assets/js/user-flames.js');
  const code=fs.readFileSync(path.join(__dirname,'../assets/js/user-flames.js'),'utf8');
  const old=JSON.parse(code.match(/var legacy=(\[[\s\S]*?\]);/)[1]);
  const book={name:'斗破苍穹世界观',entries:old.map((e,i)=>({...e,id:'old-'+i,enabled:false,position:2}))};
  book.entries.push({...old[0],id:'custom',keys:[...old[0].keys],content:'用户修改内容'});
  assert.equal(supplement.migrateBook(book),true);
  assert.equal(supplement.migrateBook(book),false);
  for(const e of book.entries.slice(0,3)){assert.equal(e.enabled,false);assert.equal(e.position,2);assert.ok(e.id.startsWith('old-'));assert.equal(e.sourceType,'user-supplement');}
  assert.equal(book.entries[3].content,'用户修改内容');
  const imported={name:'导入世界书',entries:old};
  assert.equal(supplement.migrateBook(imported),false);
});

test('flame catalogue has unique ranks and names matching user modifications',()=>{
  const table=html.match(/const HEAVENLY_FLAMES = (\[[\s\S]*?\n\]);/)[1];
  const fires=vm.runInNewContext(table,{DoupoUserFlames:require('../assets/js/user-flames.js')});
  assert.equal(fires.length,23);assert.equal(new Set(fires.map(f=>f.name)).size,23);
  assert.equal(new Set(fires.map(f=>f.id)).size,23);
  for(let i=0;i<23;i++)assert.equal(fires[i].rank,i+1);
  for(const [rank,name] of [[16,'火云水炎'],[17,'火山石焰'],[18,'风怒龙炎'],[19,'青莲地心火'],[20,'幽冥毒火'],[21,'阴阳双炎'],[22,'万兽灵火'],[23,'玄黄炎']])assert.equal(fires[rank-1].name,name);
  const {state}=context(['buildFlamesView'],{HEAVENLY_FLAMES:fires});
  state.document.addEventListener=()=>{};
  state.escapeHtml=core.escapeHtml;
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../assets/js/journal-panels.js'),'utf8'),state);
  state.buildFlamesView();
  const rendered=state.document.getElementById('game-view-flames').innerHTML;
  assert.equal(rendered.includes('undefined'),false);
  assert.equal((rendered.match(/>项目补充<\/span>/g)||[]).length,3);
  for(const f of fires.filter(f=>f.sourceType==='user-supplement')){assert.ok(f.summary.length<65);assert.ok(rendered.includes(f.summary));assert.ok(!rendered.includes(f.desc));}
});

test('gameplay preference appears once in budgeted payload and never mutates history',()=>{
 const {state}=context(['assembleTavernPrompt']);const history=[{role:'user',content:'旧对话'}];
 state.GameState.settings.gameplayPrompt={enabled:true,text:'CUSTOM_GAMEPLAY_MARKER'};
 const opts={history,userInput:'本轮输入',preview:true};const r=state.assembleTavernPrompt(opts);
 assert.equal(r.messages.filter(m=>m.content.includes('CUSTOM_GAMEPLAY_MARKER')).length,1);
 assert.equal(history.length,1);assert.equal(history[0].content,'旧对话');
 state.GameState.settings.gameplayPrompt.enabled=false;
 assert.ok(!JSON.stringify(state.assembleTavernPrompt(opts)).includes('CUSTOM_GAMEPLAY_MARKER'));
 state.GameState.settings.gameplayPrompt={enabled:true,text:'   '};
 assert.ok(!JSON.stringify(state.assembleTavernPrompt(opts)).includes('【玩家玩法偏好】'));
});
test('gameplay save persists enabled text and rolls back in-memory config on storage error',()=>{
 const {state,el,notices}=context(['saveGameplayPrompt','saveToLocalStorage'],{Economy:{},StudioState:{},QuestSystem:{}});
 el('gameplay-enabled').checked=true;el('gameplay-prompt').value='慢节奏探索';state.saveGameplayPrompt();
 assert.equal(state.GameState.settings.gameplayPrompt.text,'慢节奏探索');
 const original=state.GameState.settings.gameplayPrompt;
 state.localStorage.setItem=()=>{throw Error('quota')};el('gameplay-prompt').value='未保存';state.saveGameplayPrompt();
 assert.equal(state.GameState.settings.gameplayPrompt,original);assert.equal(notices.at(-1).type,'error');
});

test('four gameplay slots independently inject enabled nonempty text in stable order',()=>{
 const {state}=context(['assembleTavernPrompt']);
 state.GameState.settings.gameplayPrompt={enabled:true,text:'CUSTOM_SLOT'};
 state.GameState.settings.gameplayExtras={clear:{enabled:true,text:'CLEAR_SLOT'},shushan:{enabled:false,text:'SHUSHAN_SLOT'},intense:{enabled:true,text:'INTENSE_SLOT'}};
 const r=state.assembleTavernPrompt({userInput:'行动',preview:true});const payload=JSON.stringify(r.messages);
 for(const marker of ['CUSTOM_SLOT','CLEAR_SLOT','INTENSE_SLOT'])assert.equal(payload.split(marker).length-1,1);
 assert.ok(!payload.includes('SHUSHAN_SLOT'));assert.ok(payload.indexOf('CLEAR_SLOT')<payload.indexOf('INTENSE_SLOT'));assert.ok(payload.indexOf('INTENSE_SLOT')<payload.indexOf('CUSTOM_SLOT'));
});

test('optional gameplay switches never alter the enabled clear prompt',()=>{
 const {state}=context(['assembleTavernPrompt']);
 const line='不主动引入色情情节，不将人物外貌、身体接触或日常交流色情化。';
 const original='保留前文。\n'+line+'\n保留后文。';
 state.GameState.settings.gameplayExtras={clear:{enabled:true,text:original},shushan:{enabled:false,text:''},intense:{enabled:false,text:''}};
 const extras=state.GameState.settings.gameplayExtras;
 for(const [a,b] of [[false,false],[true,false],[false,true],[true,true],[true,false],[false,false]]){
  extras.shushan.enabled=a;extras.intense.enabled=b;
  const messages=state.assembleTavernPrompt({userInput:'行动',preview:true}).messages;
  const block=messages.find(m=>m.content.includes('【玩家玩法偏好 · 清水】')).content;
  assert.ok(block.includes(line));assert.ok(block.includes('保留前文。'));assert.ok(block.includes('保留后文。'));
  assert.equal(extras.clear.text,original);
 }
});

test('story quests commit with the assistant turn, survive saving and regenerate without duplicates',async()=>{
 const update={action:'create',name:'商道补给',desc:'商人提出补水建议',objective:'买到水囊',grade:'黄',reward:'约定报酬'};
 const {state,records}=context(turnFunctions,{callLLMStream:async()=> '正文<quest_updates>'+JSON.stringify([update])+'</quest_updates>'});
 await state.runTavernTurn('问商人',false);assert.equal(state.GameState.player.storyQuests.active.length,1);
 assert.ok(!state.getActiveChat().messages.at(-1).content.includes('quest_updates'));
 assert.equal(records.get('tavernSettings:main').playerState.storyQuests.active.length,1);
 const id=state.GameState.player.storyQuests.active[0].id;await state.regenerateLastTavern();assert.equal(state.GameState.player.storyQuests.active.length,1);assert.equal(state.GameState.player.storyQuests.active[0].id,id);
});

test('an assistant save failure leaves no phantom story quest',async()=>{
 const {state,notices}=context(turnFunctions,{callLLMStream:async()=>'<quest_updates>'+JSON.stringify([{action:'create',name:'测试',desc:'情景',objective:'目标',grade:'玄'}])+'</quest_updates>'});
 const put=state.db.chats.put;state.db.chats.put=async v=>{if(v.messages.at(-1)?.role==='assistant')throw Error('quota');return put(v);};
 await state.runTavernTurn('行动',false);assert.equal(state.GameState.player.storyQuests,undefined);assert.ok(notices.some(n=>n.type==='error'));
});

test('beauty records share the narrative transaction and regeneration restores pre-turn records',async()=>{
 const module=require('../assets/js/beauty-chronicle.js');let runs=0;
 const {state,records}=context(turnFunctions,{callLLMStream:async()=>'<ui_sys>2年9月16日 08:00</ui_sys>小医仙今年18岁，修为斗师。',BeautyChronicle:{update:(previous,body,config,signal,id)=>module.update(previous,body,{enabled:true,url:'https://example.com/v1',model:'test'},signal,id,async()=>{runs++;return JSON.stringify({characters:[{name:'小医仙',age:18,realm:'斗师',event:'拜访青山镇',evidence:'小医仙今年18岁，修为斗师。'}]});})}});
 await state.runTavernTurn('拜访',false);assert.equal(state.GameState.player.beautyChronicle.records['小医仙'].events.length,1);assert.equal(records.get('tavernSettings:main').playerState.beautyChronicle.clock.year,2);
 await state.regenerateLastTavern();assert.equal(runs,2);assert.equal(state.GameState.player.beautyChronicle.records['小医仙'].events.length,1);
 const saved=JSON.stringify(state.GameState.player);const put=state.db.chats.put;state.db.chats.put=async v=>{if(v.messages.at(-1)?.role==='assistant')throw Error('quota');return put(v);};await state.runTavernTurn('继续',false);assert.equal(JSON.stringify(state.GameState.player),saved);
});

test('actual outbound prompts carry original characters, independent relations and correction locks once',()=>{
 const {state}=context(['assembleTavernPrompt']);const roster=require('../assets/js/beauty-roster.js');let s=roster.edit(null,{type:'add',name:'柳知秋',bio:'山中药师'});s=roster.edit(s,{type:'correct',name:'柳知秋',values:{realm:'斗师',trust:'信任',closeness:'疏远'},locks:{realm:true}});state.GameState.player.beautyChronicle=s;
 const out=state.assembleTavernPrompt({userInput:'拜访',preview:true});const text=JSON.stringify(out.messages);assert.equal(text.split('【本次人生人物档案】').length-1,1);for(const v of ['柳知秋','山中药师','斗师','信任','疏远','locks'])assert.ok(text.includes(v));
 const before=roster.edit(null,{type:'add',name:'旧分支人物'});const regenerated=JSON.stringify(state.assembleTavernPrompt({userInput:'拜访',preview:true,beautyState:before}).messages);assert.ok(regenerated.includes('旧分支人物'));assert.ok(!regenerated.includes('柳知秋'));
});
