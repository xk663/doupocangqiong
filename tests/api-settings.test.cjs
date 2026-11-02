const test=require('node:test'),assert=require('node:assert/strict'),api=require('../assets/js/api-settings.js'),fs=require('node:fs'),vm=require('node:vm'),core=require('../assets/js/tavern-core.js');
test('model endpoints normalize compatible base and full chat URLs without duplicate v1',()=>{for(const url of ['https://example.com/v1','https://example.com/v1/','https://example.com/v1/chat/completions'])assert.equal(api.modelsURL({url}),'https://example.com/v1/models');assert.equal(api.modelsURL({url:'http://localhost:11434',backend:'ollama'}),'http://localhost:11434/api/tags');assert.equal(api.modelsURL({url:'http://localhost:5001',backend:'kobold'}),'http://localhost:5001/api/v1/model');assert.throws(()=>api.modelsURL({url:'javascript:bad'}));});
test('local model lists allow an empty key and parse OpenAI, Ollama, and Kobold replies',async()=>{let request;const rows=await api.fetchModels({url:'http://localhost:11434',backend:'ollama'},async(url,opts)=>{request={url,opts};return{ok:true,json:async()=>({models:[{name:'local-model'}]})};});assert.deepEqual(rows,['local-model']);assert.equal(request.opts.headers.Authorization,undefined);assert.deepEqual(api.modelNames({data:[{id:'a'},{id:'a'}]}),['a']);assert.deepEqual(api.modelNames({result:'kobold'}),['kobold']);});
test('model query reports authentication failure without printing a key',async()=>{await assert.rejects(api.fetchModels({url:'https://example.com/v1',apiKey:'SECRET'},async()=>({ok:false,status:401})),e=>e.message.includes('认证失败')&&!e.message.includes('SECRET'));});
function setup(){const state={TavernCore:core,GameState:{settings:{apis:[{id:'one',name:'旧',url:'https://example.com/v1',model:'test',backend:'openai',enabled:true}],activeApi:'one'}},document:{getElementById(){return null;}},saveToLocalStorage:()=>true,showToast(){},console,URL,AbortController,setTimeout,clearTimeout};vm.createContext(state);vm.runInContext(fs.readFileSync('assets/js/api-settings.js','utf8'),state);return state;}
test('API edits persist and roll back in-memory settings on storage failure',()=>{const s=setup();s.ApiSettings.change('one','name','新');assert.equal(s.GameState.settings.apis[0].name,'新');s.saveToLocalStorage=()=>false;s.ApiSettings.change('one','model','未保存');assert.equal(s.GameState.settings.apis[0].model,'test');s.ApiSettings.change('one','__proto__',{bad:1});assert.equal({}.bad,undefined);});
test('Gemini backend, thinking and fixed relay settings survive the normal settings path',()=>{const s=setup();s.ApiSettings.change('one','backend','gemini');s.ApiSettings.change('one','thinkingLevel','low');s.ApiSettings.change('one','localRelay',true);const a=s.GameState.settings.apis[0];assert.equal(a.backend,'gemini');assert.equal(a.thinkingLevel,'low');assert.equal(a.localRelay,true);s.ApiSettings.change('one','localRelay','yes');assert.equal(s.GameState.settings.apis[0].localRelay,true);s.ApiSettings.change('one','thinkingLevel','invalid');assert.equal(s.GameState.settings.apis[0].thinkingLevel,'low');});
test('a stale model query cannot overwrite a changed endpoint',async()=>{const s=setup();let finish;s.fetch=()=>new Promise(resolve=>finish=resolve);const pending=s.ApiSettings.sync('one');s.ApiSettings.change('one','url','https://other.example/v1');finish({ok:true,json:async()=>({data:[{id:'stale'}]})});await pending;assert.equal(s.GameState.settings.apis[0].url,'https://other.example/v1');assert.equal(s.GameState.settings.apis[0].model,'test');});

function controls(s){
 const nodes={
  'api-cards-container':{innerHTML:'',querySelectorAll:()=>[{dataset:{apiId:'one'},open:true},{dataset:{apiId:'two'},open:false}]},
  'api-model-input-one':{value:'test'},'api-model-select-one':{value:'',disabled:false},
  'sync-status-one':{textContent:'',setAttribute(){}},'api-model-query-one':{disabled:false,textContent:'查询模型'}
 };
 s.document.getElementById=id=>nodes[id]||null;return nodes;
}
test('queried models render as visible selectable options and preserve the expanded API card',async()=>{
 const s=setup(),nodes=controls(s);s.GameState.settings.apis.push({id:'two',url:'https://second.example/v1',models:[]});
 s.fetch=async()=>({ok:true,json:async()=>({data:[{id:'test'},{id:'second-model'}]})});
 await s.ApiSettings.sync('one');const html=nodes['api-cards-container'].innerHTML;
 assert.match(html,/<select id="api-model-select-one"[^>]*>/);assert.doesNotMatch(html,/<datalist/);
 assert.match(html,/<option value="test" selected>test<\/option>/);assert.match(html,/<option value="second-model"/);
 assert.match(html,/data-api-id="one" open/);assert.doesNotMatch(html,/data-api-id="two" open/);
 assert.equal(s.GameState.settings.apis[0].models.length,2);
 assert.doesNotMatch(html.match(/<button id="api-model-query-one"[^>]*>/)[0],/\sdisabled/);assert.match(html,/已保存 2 个模型/);
});
test('selecting a queried model updates the saved configuration and manual field, with rollback on save failure',()=>{
 const s=setup(),nodes=controls(s);s.GameState.settings.apis[0].models=['test','second-model'];
 let saved;s.saveToLocalStorage=()=>{saved=JSON.parse(JSON.stringify(s.GameState.settings));return true;};
 assert.equal(s.ApiSettings.pickModel('one','second-model'),true);assert.equal(saved.apis[0].model,'second-model');
 assert.equal(nodes['api-model-input-one'].value,'second-model');assert.equal(nodes['api-model-select-one'].value,'second-model');
 assert.equal(s.ApiSettings.pickModel('one','not-listed'),false);
 s.saveToLocalStorage=()=>false;assert.equal(s.ApiSettings.pickModel('one','test'),false);
 assert.equal(s.GameState.settings.apis[0].model,'second-model');assert.equal(nodes['api-model-select-one'].value,'second-model');
});
test('refreshing lists and query failures preserve the selected or manually configured model',async()=>{
 const s=setup(),nodes=controls(s);s.GameState.settings.apis[0].model='manual-model';
 s.fetch=async()=>({ok:true,json:async()=>({data:[{id:'listed-model'}]})});await s.ApiSettings.sync('one');
 assert.equal(s.GameState.settings.apis[0].model,'manual-model');assert.match(nodes['api-cards-container'].innerHTML,/当前手填模型已保留/);
 const before=JSON.stringify(s.GameState.settings);s.fetch=async()=>({ok:false,status:401});await s.ApiSettings.sync('one');
 assert.equal(JSON.stringify(s.GameState.settings),before);assert.match(nodes['sync-status-one'].textContent,/认证失败/);
 s.fetch=async()=>({ok:true,json:async()=>({data:[]})});await s.ApiSettings.sync('one');assert.equal(JSON.stringify(s.GameState.settings),before);
 assert.equal(nodes['api-model-query-one'].disabled,false);
});
test('credential and relay changes discard stale results even when the address is unchanged',async()=>{
 for(const [field,value]of [['apiKey','NEW-TEST-KEY'],['localRelay',true]]){
  const s=setup(),nodes=controls(s);s.GameState.settings.apis[0].models=['old'];let finish;
  s.fetch=()=>new Promise(resolve=>finish=resolve);const pending=s.ApiSettings.sync('one');
  s.ApiSettings.change('one',field,value);finish({ok:true,json:async()=>({data:[{id:'stale'}]})});await pending;
  assert.deepEqual(Array.from(s.GameState.settings.apis[0].models),[]);assert.equal(s.GameState.settings.apis[0].model,'test');
  assert.equal(nodes['api-model-select-one'].disabled,true);assert.equal(nodes['api-model-query-one'].disabled,false);
 }
});
test('failed persistence retains the previous model list and reports no successful save',async()=>{
 const s=setup(),nodes=controls(s);s.GameState.settings.apis[0].models=['old'];s.saveToLocalStorage=()=>false;
 s.fetch=async()=>({ok:true,json:async()=>({data:[{id:'new'}]})});await s.ApiSettings.sync('one');
 assert.deepEqual(Array.from(s.GameState.settings.apis[0].models),['old']);assert.equal(s.GameState.settings.apis[0].model,'test');
 assert.match(nodes['sync-status-one'].textContent,/未能保存/);
});
test('Gemini lists omit explicitly unsupported embedding models and normalize duplicate names',async()=>{
 const rows=await api.fetchModels({url:'https://example.com',backend:'gemini'},async()=>({ok:true,json:async()=>({models:[
  {name:'models/gemini-chat',supportedGenerationMethods:['generateContent']},
  {name:'models/embedding',supportedGenerationMethods:['embedContent']},
  {name:'gemini-chat'},{name:'models/gemini-proxy'}
 ]})}));assert.deepEqual(rows,['gemini-chat','gemini-proxy']);
});
test('malformed list responses do not echo credentials or server body fragments in UI errors',async()=>{
 await assert.rejects(api.fetchModels({url:'https://example.com/v1',apiKey:'SECRET'},async()=>({ok:true,json:async()=>{throw new SyntaxError('SECRET <html>provider body');}})),error=>error.message.includes('JSON')&&!/SECRET|<html>/.test(error.message));
 const s=setup(),nodes=controls(s);s.GameState.settings.apis[0].models=['<img src=x onerror=alert(1)>'];s.ApiSettings.render();
 assert.doesNotMatch(nodes['api-cards-container'].innerHTML,/<img/);assert.match(nodes['api-cards-container'].innerHTML,/&lt;img/);
});
test('blank endpoints report the missing address without a request',async()=>{
 const s=setup(),nodes=controls(s);s.GameState.settings.apis[0].url='';s.fetch=()=>{throw Error('Must not request');};
 await s.ApiSettings.sync('one');assert.match(nodes['sync-status-one'].textContent,/请先填写接口地址/);
});
