const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const core = require('../assets/js/model-probe-core.js');
const api = {id:'a',url:'https://test.invalid/v1',model:'m',backend:'openai'};
function harness(run) {
  const nodes = [], chat = {id:'c',messages:[]}, apis = [api];
  function element(tag) {
    const node = {tag, children:[], textContent:'', appendChild(child){this.children.push(child);}, setAttribute(){},
      showModal(){this.open=true;}, close(){this.open=false;}, remove(){}, addEventListener(){}};
    nodes.push(node); return node;
  }
  const message = {id:'m1',content:'旧回复',modelProbeTarget:core.target(api,api.model),modelAudit:{version:1,status:'match'}};
  chat.messages.push(message);
  let timer, delay;
  const state = {document:{body:element('body'),createElement:element},GameState:{settings:{apis}},getActiveChat:()=>chat,
    ModelProbeCore:{...core,run},tavernState:{isSending:false},AbortController,
    setTimeout(fn,ms){timer=fn;delay=ms;},clearTimeout(){timer=null;}};
  vm.createContext(state);
  for (const file of ['model-route-ui','model-probe-ui']) vm.runInContext(fs.readFileSync('assets/js/'+file+'.js','utf8'),state);
  return {ui:state.ModelProbeUI,message,chat,apis,nodes,timeout(){assert.equal(delay,45000);timer();},
    find:(cls)=>nodes.findLast(node=>node.className===cls)};
}
test('settings and reply entry points send nothing until started and use the recorded model', async () => {
  let calls=0;
  const h=harness(async (selected,model) => {
    calls++;assert.equal(selected.id,'a'); assert.equal(model,'m');
    return {status:'operational',http:200,elapsed:52,expected:'7',answer:'7',question:'3 + 4 = ?',audit:{observedModel:'returned'}};
  });
  h.ui.button(h.message).onclick();assert.equal(calls,0);
  h.apis[0]={...api,model:'another'};
  await h.find('model-probe-action').onclick();assert.equal(calls,1);
  assert.match(h.find('model-probe-result').textContent,/通过.*HTTP 200.*52 ms/);
  assert.ok(h.nodes.some(n=>n.textContent.includes('returned')));
  h.ui.cancel();h.ui.openApi('a');assert.equal(calls,1);
});
test('changed and missing historical targets cannot issue a test',async () => {
  const h=harness(()=>assert.fail());
  h.ui.open(h.message);
  h.apis[0]={...api,url:'https://changed.invalid'};
  await h.find('model-probe-action').onclick();
  assert.equal(h.find('model-probe-action').disabled,true);
  delete h.message.modelProbeTarget;
  h.ui.open(h.message);assert.equal(h.find('model-probe-action').disabled,true);
});
test('duplicate starts are ignored, switching chats aborts, and timeouts allow retry',async () => {
  let calls=0,signal;
  const h=harness((api,model,s)=>{calls++;signal=s;return new Promise((_,reject)=>s.addEventListener('abort',()=>reject(Error('aborted'))));});
  h.ui.open(h.message);
  const start=h.find('model-probe-action'),pending=start.onclick();await start.onclick();assert.equal(calls,1);
  h.chat.id='changed';h.ui.sync();await pending;assert.equal(signal.aborted,true);assert.equal(h.find('model-probe-dialog').open,false);
  h.ui.openApi('a');const retry=h.find('model-probe-action');const slow=retry.onclick();h.timeout();await slow;
  assert.match(h.find('model-probe-result').textContent,/超时/);assert.equal(retry.disabled,false);
});
