const test=require('node:test'),assert=require('node:assert/strict');
const core=require('../assets/js/tavern-core.js'),settings=require('../assets/js/api-settings.js');
const api={backend:'gemini',url:'http://localhost:8080',model:'gemini-3.8-flash',apiKey:'TEST-ONLY'};
const packet=(text,finish)=>({candidates:[{content:{parts:[{text:'thought must not display',thought:true},{text}]},...(finish?{finishReason:finish}:{})}]});
function stream(text){const bytes=new TextEncoder().encode(text);let i=0;return new Response(new ReadableStream({pull(c){if(i===bytes.length)return c.close();c.enqueue(bytes.slice(i,i+1));i++;}}),{headers:{'content-type':'text/event-stream'}});}
test('Gemini native endpoints normalize roots, v1beta, legacy v1 and full streaming URLs',()=>{
 for(const base of ['http://localhost:8080','http://localhost:8080/','http://localhost:8080/v1','http://localhost:8080/v1beta','http://localhost:8080/v1beta/models','http://localhost:8080/v1beta/models/old:streamGenerateContent?alt=sse'])assert.equal(core.endpoint(base,'gemini','models/gemini-3.8-flash',true),'http://localhost:8080/v1beta/models/gemini-3.8-flash:streamGenerateContent?alt=sse');
 assert.equal(core.endpoint('https://example.org/proxy','gemini','gemini-4-argon'),'https://example.org/proxy/v1beta/models/gemini-4-argon:generateContent');assert.throws(()=>core.endpoint(api.url,'gemini','../escape'));assert.throws(()=>core.endpoint(api.url+'?key=TEST','gemini'));
});
test('actual requests use x-goog-api-key, native roles, system instruction and correct sampling fields',async()=>{
 let sent;const text=await core.request(api,[{role:'system',content:'系统A'},{role:'developer',content:'系统B'},{role:'user',content:'问题'},{role:'assistant',content:'回答'},{role:'system',content:'深度注入'},{role:'user',content:'新问题'}],{max_tokens:256,temperature:0,top_p:0,thinkingLevel:'low',jsonMode:true},null,async(url,opts)=>{sent={url,...opts};return Response.json(packet('完整正文','STOP'));});
 assert.equal(text,'完整正文');assert.ok(sent.url.endsWith(':generateContent'));assert.equal(sent.headers['x-goog-api-key'],'TEST-ONLY');assert.equal(sent.headers.Authorization,undefined);const b=JSON.parse(sent.body);assert.deepEqual(b.systemInstruction.parts,[{text:'系统A'},{text:'系统B'}]);assert.deepEqual(b.contents.map(c=>c.role),['user','model','user']);assert.equal(b.contents[2].parts[0].text,'【系统补充】\n深度注入');assert.equal(b.contents[2].parts[1].text,'新问题');assert.equal(b.generationConfig.temperature,0);assert.equal(b.generationConfig.topP,0);assert.equal(b.generationConfig.maxOutputTokens,256);assert.equal(b.generationConfig.thinkingConfig.thinkingLevel,'low');assert.equal(b.generationConfig.responseMimeType,'application/json');assert.equal(b.stream,undefined);
});
test('Gemini SSE handles split UTF8, multiline chunks, thought-only packets and STOP without DONE',async()=>{
 const raw='data:'+JSON.stringify(packet('你好'))+'\r\n\r\ndata: '+JSON.stringify(packet('，世界','STOP'))+'\n\n';let visible='';const text=await core.request(api,[{role:'user',content:'测试'}],{max_tokens:256},chunk=>visible+=chunk,async(url)=>{assert.ok(url.endsWith(':streamGenerateContent?alt=sse'));return stream(raw);});assert.equal(text,'你好，世界');assert.equal(visible,text);assert.ok(!visible.includes('thought'));
});
test('truncated, blocked, malformed and thought-only replies cannot commit as successful text',async()=>{
 for(const data of [packet('半截','MAX_TOKENS'),packet('','STOP'),{promptFeedback:{blockReason:'SAFETY'}},{candidates:[{finishReason:'SAFETY'}]},packet('未完成')])await assert.rejects(core.request(api,[],{},null,async()=>Response.json(data)));
 await assert.rejects(core.readStream(stream('data:'+JSON.stringify(packet('半截'))+'\n\n'),'gemini'),/不完整/);
 await assert.rejects(core.readStream(stream('data:'+JSON.stringify(packet('半截','MAX_TOKENS'))+'\n\n'),'gemini'),/token 上限/);
 await assert.rejects(core.readStream(stream('data: {bad}\n\n'),'gemini'),/无法解析/);
});
test('abort wakes a stalled Gemini stream and never returns a partial completion',async()=>{
 const ctl=new AbortController();const response=new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('data:'+JSON.stringify(packet('已输出'))+'\n\n'));}}));
 const pending=core.readStream(response,'gemini',()=>ctl.abort(),ctl.signal);await assert.rejects(pending,{name:'AbortError'});
});
test('model listing uses native authentication and removes models/ prefixes',async()=>{
 assert.equal(settings.modelsURL(api),'http://localhost:8080/v1beta/models');const names=await settings.fetchModels(api,async(url,opts)=>{assert.equal(url,'http://localhost:8080/v1beta/models');assert.equal(opts.headers['x-goog-api-key'],'TEST-ONLY');assert.equal(opts.headers.Authorization,undefined);return Response.json({models:[{name:'models/gemini-4-argon'},{name:'models/gemini-3.8-flash'}]});});assert.deepEqual(names,['gemini-4-argon','gemini-3.8-flash']);
});
test('unsupported thinking modes and tool messages fail before a network request',async()=>{
 const noNetwork=()=>{throw Error('unexpected network');};await assert.rejects(core.request({...api,model:'gemini-4-argon'},[],{thinkingLevel:'minimal'},null,noNetwork),/不支持 minimal/);await assert.rejects(core.request({...api,model:'gemini-2.5-pro'},[],{thinkingLevel:'low'},null,noNetwork),/模型默认/);await assert.rejects(core.request(api,[{role:'tool',content:'x'}],{},null,noNetwork),/工具消息/);
});

test('same-origin relay routing is explicit and restricted to the configured local Gemini service',()=>{assert.equal(core.transportURL({...api,localRelay:true},core.endpoint(api.url,'gemini',api.model,true)),'/__gemini_proxy/v1beta/models/gemini-3.8-flash:streamGenerateContent?alt=sse');assert.throws(()=>core.transportURL({...api,localRelay:true},'https://example.org/v1beta/models'));assert.equal(core.transportURL(api,'https://example.org/v1beta/models'),'https://example.org/v1beta/models');});
