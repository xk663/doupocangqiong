const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const core=require('../assets/js/tavern-core.js'),route=require('../assets/js/model-route-core.js');
const requested='gemini-4-argon-high',actual='gemini-3.8-flash-high';
const api={backend:'gemini',url:'https://example.test',model:requested};
const packet=(text,extra={})=>({candidates:[{content:{parts:[{text}]},finishReason:'STOP'}],...extra});
function sse(packets){const bytes=new TextEncoder().encode(packets.map(p=>'data:'+JSON.stringify(p)+'\r\n\r\n').join(''));let offset=0;return new Response(new ReadableStream({pull(c){if(offset===bytes.length)return c.close();c.enqueue(bytes.slice(offset,++offset));}}),{headers:{'content-type':'text/event-stream'}});}

test('native JSON metadata reports routing after text, without changing the reply or request',async()=>{
  const events=[];let wire,audit;
  const text=await core.request(api,[],{onModelAudit:value=>{audit=value;events.push('audit');}},chunk=>events.push(chunk),async(url,opts)=>{wire=JSON.parse(opts.body);return Response.json(packet('完整正文',{modelVersion:actual}));});
  assert.equal(text,'完整正文');assert.deepEqual(events,['完整正文','audit']);assert.equal(audit.status,'mismatch');assert.equal(audit.requestedModel,requested);assert.deepEqual(audit.reportedModels,[actual]);assert.equal(audit.evidence[0].source,'response.modelVersion');assert.equal(wire.onModelAudit,undefined);
});

test('Gemini metadata arriving alone in the last fragmented SSE packet is retained',async()=>{
  let audit,visible='',calls=0;
  const text=await core.request(api,[],{onModelAudit:value=>{calls++;audit=value;assert.equal(visible,'故事正文');}},chunk=>visible+=chunk,async()=>sse([packet('故事正文'),{modelVersion:actual}]));
  assert.equal(text,'故事正文');assert.equal(calls,1);assert.equal(audit.status,'mismatch');assert.deepEqual(audit.reportedModels,[actual]);
});

test('compatible stream metadata prefers an explicit actual model over an echoed model name',async()=>{
  let audit;
  const text=await core.request({...api,backend:'openai'},[],{onModelAudit:value=>audit=value},()=>{},async()=>sse([{model:requested,choices:[{delta:{content:'正文'}}]},{model:requested,actual_model:actual,choices:[]}]));
  assert.equal(text,'正文');assert.deepEqual(audit.reportedModels,[actual]);assert.equal(audit.status,'mismatch');
});

test('matching model prefixes, absent metadata and model self-identification are distinguished',async()=>{
  for(const [extra,status] of [[{modelVersion:'models/'+requested},'match'],[{},'unverified']]){
    let audit;await core.request(api,[],{onModelAudit:value=>audit=value},null,async()=>Response.json(packet('我是 '+actual+'。',{...extra})));
    assert.equal(audit.status,status);if(status==='unverified')assert.deepEqual(audit.reportedModels,[]);
  }
});

test('explicit response headers survive echoed bodies, with only bounded model fields collected',async()=>{
  let audit;await core.request(api,[],{onModelAudit:value=>audit=value},null,async()=>Response.json(packet('正文',{model:requested}),{headers:{'x-actual-model':actual,'authorization':'DO-NOT-COLLECT'}}));
  assert.equal(audit.status,'mismatch');assert.deepEqual(audit.reportedModels,[actual]);assert.equal(audit.evidence[0].source,'header.x-actual-model');assert.ok(!JSON.stringify(audit).includes('DO-NOT-COLLECT'));
});

test('changed stream model IDs are not hidden by a later matching chunk',async()=>{
  let audit;await core.request(api,[],{onModelAudit:value=>audit=value},()=>{},async()=>sse([packet('前半',{modelVersion:actual}),packet('后半',{modelVersion:requested})]));
  assert.equal(audit.status,'conflict');assert.equal(audit.observedModel,requested);assert.deepEqual(audit.reportedModels,[actual,requested]);
});

test('a final explicit version cannot be crowded out by compatible model chatter',()=>{
  const audit=route.create(requested);for(let i=0;i<40;i++)audit.observe({model:'model-'+i});audit.observe({modelVersion:actual});
  assert.equal(audit.result().status,'mismatch');assert.deepEqual(audit.result().reportedModels,[actual]);assert.ok(audit.result().evidence.length<=24);
});

test('aborted, failed and incomplete responses never publish a completed model audit',async()=>{
  let calls=0;const controller=new AbortController();
  await assert.rejects(core.request(api,[],{signal:controller.signal,onModelAudit:()=>calls++},()=>controller.abort(),async()=>sse([packet('正文',{modelVersion:actual})])),{name:'AbortError'});
  await assert.rejects(core.request(api,[],{onModelAudit:()=>calls++},null,async()=>new Response('failure',{status:503})));
  await assert.rejects(core.request(api,[],{onModelAudit:()=>calls++},null,async()=>Response.json({modelVersion:actual,candidates:[]})));
  assert.equal(calls,0);
});

function ui(){
  function element(tag){return {tag,children:[],attributes:{},textContent:'',className:'',set innerHTML(value){throw Error('unsafe HTML');},setAttribute(k,v){this.attributes[k]=v;},appendChild(child){child.parent=this;this.children.push(child);return child;},remove(){if(this.parent)this.parent.children=this.parent.children.filter(c=>c!==this);}};}
  const body=element('body'),host=element('div');host.id='notifications-container';body.appendChild(host);
  function find(node,id){if(node.id===id)return node;for(const child of node.children){const match=find(child,id);if(match)return match;}return null;}
  const state={document:{body,createElement:element,getElementById:id=>find(body,id)},Set};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../assets/js/model-route-ui.js'),'utf8'),state);
  return {ui:state.ModelRouteUI,host,text(node){return node.textContent+node.children.map(c=>this.text(c)).join(' ');}};
}
test('the red warning is dismissible, does not auto-appear for unknown/matching models, and treats metadata as text',()=>{
  const h=ui();h.ui.notify({status:'unverified'});h.ui.notify({status:'match'});assert.equal(h.host.children.length,0);
  const audit={version:1,status:'mismatch',requestedModel:requested,reportedModels:['<img src=x onerror=alert(1)>'],evidence:[null,{source:'response.modelVersion'}]};
  h.ui.notify(audit);assert.equal(h.host.children.length,1);const warning=h.host.children[0];assert.equal(warning.attributes.role,'alert');assert.ok(h.text(warning).includes(requested));assert.ok(h.text(warning).includes('<img src=x onerror=alert(1)>'));
  assert.doesNotThrow(()=>h.ui.record(audit));h.ui.notify(audit);assert.equal(h.host.children.length,1);
  h.host.children[0].children[0].children[1].onclick();assert.equal(h.host.children.length,0);
});

test('Sub2API reads nested Gemini versions, first declarations and terminal OpenAI SSE declarations',async()=>{
  const gemini=route.create('version','gemini');
  gemini.observe({response:{response:{modelVersion:'version'}}});assert.equal(gemini.result().status,'match');
  gemini.observe({modelVersion:'outer',response:{modelVersion:'ignored'}});assert.deepEqual(gemini.result().reportedModels,['version','outer']);
  const payload='event: response.created\ndata: {"response":{"model":"first"},"model":"echo","choices":[{"delta":{"content":"ok"}}]}\n\nevent: response.completed\ndata: {"response":{"model":"GROK-4.6-build"}}\n\n';
  let audit;await core.request({url:'https://example.test',model:'grok-4.6-latest'},[],{onModelAudit:r=>audit=r},()=>{},async()=>new Response(payload,{headers:{'content-type':'text/event-stream'}}));
  assert.equal(audit.observedModel,'GROK-4.6-build');assert.equal(audit.status,'conflict');
  const grok=route.create('grok-4.6-latest');grok.observe({model:'GROK-4.6-build'});assert.equal(grok.result().status,'match');
  const chat=route.create('first');chat.observe({model:'first'});chat.observe({model:'second'});assert.equal(chat.result().observedModel,'first');assert.equal(chat.result().status,'conflict');
});
