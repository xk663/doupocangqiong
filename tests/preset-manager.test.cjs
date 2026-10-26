const {test}=require('node:test');
const assert=require('node:assert/strict');
const M=require('../assets/js/preset-manager.js');
const presets=[{id:'a',name:'A'},{id:'b',name:'B'}],settings={id:'main',activePresetId:'a'};
const chats=[{id:'one',presetId:'a',messages:[{content:'保留正文'}]},{id:'two',presetId:'b'},{id:'three',presetId:''}];
function database(failAt){
  let rows={presets:structuredClone(presets),chats:structuredClone(chats),settings:structuredClone(settings)};
  function fail(at){if(at===failAt)throw Error('quota');}
  const db={presets:{async delete(id){fail('delete');rows.presets=rows.presets.filter(p=>p.id!==id);}},
    chats:{async toArray(){return structuredClone(rows.chats);},async put(c){fail('chat');rows.chats=rows.chats.map(x=>x.id===c.id?c:x);}},
    tavernSettings:{async get(){return structuredClone(rows.settings);},async put(s){fail('settings');rows.settings=s;}},
    async transaction(mode,tables,fn){const previous=structuredClone(rows);try{await fn();}catch(e){rows=previous;throw e;}}};
  return {db,read:()=>rows};
}
test('effective preset honors session binding before default and falls back for stale references',()=>{
  assert.equal(M.effective(presets,settings,{presetId:'b'}).id,'b');
  assert.equal(M.effective(presets,settings,{presetId:'gone'}).id,'a');
  assert.equal(M.effective(presets,{activePresetId:'gone'},null).id,'a');
});
test('deletion migrates every persisted chat reference and default without changing messages',async()=>{
  const {db,read}=database(),before=JSON.stringify({presets,settings,chats});
  const result=await M.remove(db,presets,settings,'a','b');
  assert.deepEqual(read().presets,[presets[1]]);assert.equal(read().settings.activePresetId,'b');
  assert.equal(read().chats[0].presetId,'b');assert.deepEqual(read().chats[0].messages,chats[0].messages);
  assert.equal(read().chats[2].presetId,'');assert.equal(result.chats.length,1);
  assert.equal(JSON.stringify({presets,settings,chats}),before);
});
for(const at of ['chat','settings','delete'])test('failed '+at+' write rolls back deletion and all references',async()=>{
  const {db,read}=database(at),before=structuredClone(read());
  await assert.rejects(M.remove(db,presets,settings,'a','b'),/quota/);assert.deepEqual(read(),before);
});
test('deletion rejects last preset, nonexistent replacement and self replacement',()=>{
  assert.throws(()=>M.deletionPlan([presets[0]],settings,chats,'a','b'),/至少/);
  for(const id of ['a','missing'])assert.throws(()=>M.deletionPlan(presets,settings,chats,'a',id),/替代/);
});
test('deletion changes only the stored default binding and preserves durable player state',async()=>{
  const {db,read}=database();read().settings.playerState={name:'存档中的玩家'};read().settings.playerStateAt=123;
  await M.remove(db,presets,settings,'a','b');
  assert.deepEqual(read().settings.playerState,{name:'存档中的玩家'});assert.equal(read().settings.playerStateAt,123);
});
test('actual activation preserves stored player progress while changing the session and default preset',async()=>{
  const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
  const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8'),{db,read}=database();
  read().settings.playerState={name:'数据库中的玩家'};read().settings.playerStateAt=456;
  const state={db,tavernState:{presets:structuredClone(presets),chats:structuredClone(chats),tavernSettings:structuredClone(settings)},stopTavernStream(){},saveToLocalStorage(){}};
  state.getActiveChat=()=>state.tavernState.chats[0];vm.createContext(state);
  vm.runInContext(html.match(/async function applyActivePreset\([^]*?\n\}/)[0],state);
  await state.applyActivePreset('b');assert.equal(read().settings.activePresetId,'b');assert.equal(read().chats[0].presetId,'b');
  assert.deepEqual(read().settings.playerState,{name:'数据库中的玩家'});assert.equal(read().settings.playerStateAt,456);
});
