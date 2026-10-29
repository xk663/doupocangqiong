const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const core=require('../assets/js/tavern-core.js');
const wiring=require('../assets/js/tavern-wiring.js');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
function setup(sessionCard,globalCard){
  const original={id:'old',messages:[],...(sessionCard?{characterCard:sessionCard}:{})},saved=new Map();
  let requestCard;
  const state={crypto:webcrypto,TavernCore:core,TavernWiring:wiring,
    GameState:{player:{name:'旅人'},settings:{}},WorldState:{location:'乌坦城'},
    tavernState:{chats:[original],activeChatId:'old',presets:[],lorebooks:[],activeLorebookIds:[],tavernSettings:{},characterCard:globalCard},
    db:{transaction:async(mode,tables,fn)=>fn(),chats:{put:async chat=>saved.set(chat.id,structuredClone(chat))},tavernSettings:{put:async()=>{}}},
    stopTavernStream(){},renderTavernSessionList(){},renderTavernMessages(){},updateTavernInfo(){},
    createChatMessage:(role,content)=>({role,content}),
    assembleTavernPrompt(opts){requestCard=opts.characterCard;return {messages:[]};}};
  state.getActiveChat=()=>state.tavernState.chats.find(c=>c.id===state.tavernState.activeChatId);
  vm.createContext(state);
  for(const name of ['createChatSession','createNewTavernChat','prepareTavernRequest']){
    const match=html.match(new RegExp('(?:async )?function '+name+'\\([^]*?\\n\\}'));
    assert.ok(match,name);vm.runInContext(match[0],state);
  }
  return {state,saved,original,requestCard:()=>requestCard};
}
test('new chat consistently inherits session card, persists an independent copy and uses it after reload',async()=>{
  const card={name:'角色A',firstMessage:'A的开场',description:'A的设定',extensions:{notes:['原设定']}},global={name:'角色B',firstMessage:'B的开场'};
  const {state,saved,original,requestCard}=setup(card,global),before=JSON.stringify(original);
  await state.createNewTavernChat();const chat=state.getActiveChat();
  assert.equal(chat.characterName,'角色A');assert.match(chat.name,/^角色A - 对话 /);
  assert.equal(chat.messages[0].content,'A的开场');assert.deepEqual(chat.characterCard,card);
  assert.notEqual(chat.characterCard,card);assert.notEqual(chat.characterCard.extensions,card.extensions);
  assert.equal(JSON.stringify(original),before);
  card.extensions.notes[0]='修改旧卡';global.firstMessage='修改全局开场';
  assert.equal(chat.characterCard.extensions.notes[0],'原设定');
  const restored=JSON.parse(JSON.stringify(saved.get(chat.id)));
  state.prepareTavernRequest(restored,'你好',restored.messages,true);
  assert.equal(requestCard().name,'角色A');assert.equal(requestCard().description,'A的设定');
  assert.equal(requestCard().extensions.notes[0],'原设定');
});
test('without a session card the global card supplies name, opening and a separate snapshot',async()=>{
  const card={name:'全局角色',firstMessage:'全局开场',description:'初始设定'};
  const {state,original}=setup(null,card);await state.createNewTavernChat();const chat=state.getActiveChat();
  assert.equal(chat.characterName,'全局角色');assert.equal(chat.messages[0].content,'全局开场');
  card.description='后续修改';assert.equal(chat.characterCard.description,'初始设定');
  assert.equal(original.characterCard,undefined);
});
test('session card with no opening never borrows an unrelated global opening',async()=>{
  const {state}=setup({name:'静默角色',firstMessage:''},{name:'其他角色',firstMessage:'不应出现'});
  await state.createNewTavernChat();assert.equal(state.getActiveChat().messages.length,0);
  assert.equal(state.getActiveChat().characterCard.name,'静默角色');
});
test('missing cards create an empty independent session without rewriting old chats',async()=>{
  const {state,original}=setup(null,null);await state.createNewTavernChat();
  assert.equal(state.getActiveChat().characterName,'角色');assert.equal(state.getActiveChat().messages.length,0);
  assert.equal(JSON.stringify(state.getActiveChat().characterCard),'{}');assert.equal(original.characterCard,undefined);
});

test('explicit selected-card chat uses imported B while preserving old A session',async()=>{
 const {state,original,saved}=setup({name:'角色A',description:'A设定',firstMessage:'A开场'},{name:'旧全局'});
 state.db.characterCard={put:async()=>{}};state.openTavernCharacterModal=()=>{};state.showToast=()=>{};
 vm.runInContext(html.match(/async function importCharacterCard\([^]*?\n\}/)[0],state);
 await state.importCharacterCard({target:{files:[{name:'b.json',size:100,text:async()=>JSON.stringify({name:'角色B',description:'B设定',first_mes:'B开场'})}]}});
 await state.createNewTavernChat(true);const chat=state.getActiveChat();assert.equal(chat.characterName,'角色B');assert.equal(chat.messages[0].content,'B开场');assert.equal(original.characterCard.name,'角色A');assert.equal(saved.get(chat.id).characterCard.description,'B设定');
});
test('failed new-chat transaction does not activate a phantom session',async()=>{
 const {state}=setup({name:'角色A'},{name:'角色B'});state.db.transaction=async()=>{throw Error('quota');};
 await assert.rejects(state.createNewTavernChat(true),/quota/);assert.equal(state.tavernState.activeChatId,'old');assert.equal(state.tavernState.chats.length,1);
});
