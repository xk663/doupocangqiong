/* Shared, framework-free chat logic. Also importable by the Node regression suite. */
(function(root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TavernCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  var blocked = new Set(['__proto__', 'prototype', 'constructor']);
  var secrets = /^(api_?key|key|authorization|access_?token|refresh_?token|token|password|secret|discordWebhook|discordAuthCode)$/i;
  function clone(value, redact) {
    if (Array.isArray(value)) return value.map(function(v) { return clone(v, redact); });
    if (!value || typeof value !== 'object') return value;
    var out = {};
    Object.keys(value).forEach(function(k) {
      if (!blocked.has(k) && !(redact && secrets.test(k))) out[k] = clone(value[k], redact);
    });
    return out;
  }
  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function(c) {
      return {'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c];
    });
  }
  // For legacy inline handlers inside a double-quoted HTML attribute.
  function handlerArg(value) { return escapeHtml(JSON.stringify(String(value))); }
  function estimateTokens(text) {
    var value = String(text || '');
    var cjk = (value.match(/[\u2e80-\u9fff\uf900-\ufaff]/g) || []).length;
    return Math.ceil(cjk * 1.5 + (value.length - cjk) / 3) + 4;
  }
  function geminiBase(base) {
    var url=new URL(base);
    if(!/^https?:$/.test(url.protocol)||url.username||url.password)throw new Error('接口地址必须使用 HTTP 或 HTTPS');
    if([...url.searchParams.keys()].some(function(k){return k!=='alt';}))throw new Error('Gemini 地址不要附带查询参数，密钥请填写在 Key 栏');
    var path=url.pathname.replace(/\/+$/,'').replace(/\/models\/[^/]+:(?:streamGenerateContent|generateContent)$/,'').replace(/\/models$/,'');
    if(/\/v1$/.test(path))path=path.replace(/\/v1$/,'/v1beta');
    else if(!/\/v1beta$/.test(path))path+='/v1beta';
    url.pathname=path;url.search='';url.hash='';return url.href.replace(/\/$/,'');
  }
  function endpoint(base, backend, model, stream) {
    if(backend==='gemini'){
      var prefix=geminiBase(base);if(!model)return prefix;
      model=String(model).replace(/^models\//,'');
      if(!/^[A-Za-z0-9._-]+$/.test(model))throw new Error('Gemini 模型标识无效');
      return prefix+'/models/'+encodeURIComponent(model)+(stream?':streamGenerateContent?alt=sse':':generateContent');
    }
    var url = new URL(base);
    if (!/^https?:$/.test(url.protocol) || url.username || url.password) throw new Error('接口地址必须使用 HTTP 或 HTTPS');
    var suffix = backend === 'ollama' ? '/api/chat' : backend === 'kobold' ? '/api/v1/generate' : '/chat/completions';
    var path = url.pathname.replace(/\/+$/, '');
    if (!path.endsWith(suffix)) {
      if (backend === 'ollama' || backend === 'kobold') path = path.replace(/\/(?:api(?:\/v1)?|v1)$/, '');
      path += suffix;
    }
    url.pathname = path;
    url.hash = '';
    return url.href;
  }
  function abortError() { var error = new Error('推演已阻断'); error.name = 'AbortError'; return error; }
  function transportURL(api,url){
    if(api.backend!=='gemini'||!api.localRelay)return url;
    var target=new URL(url);
    if(!['localhost','127.0.0.1'].includes(target.hostname)||target.port!=='8080'||target.protocol!=='http:'||!target.pathname.startsWith('/v1beta/'))throw new Error('本机通道仅支持 http://localhost:8080 的 Gemini 原生接口');
    return '/__gemini_proxy'+target.pathname+target.search;
  }
  function checkAbort(signal) { if (signal && signal.aborted) throw abortError(); }

  function matchLorebooks(text, books, options) {
    options = options || {};
    var maxDepth = options.maxDepth == null ? 3 : options.maxDepth;
    var budget = options.budget == null ? 8192 : options.budget;
    var seen = new Set(options.existing || []), used = 0, result = [], queue = [];
    var entries = [];
    var trace = options.trace;
    function record(item, status, depth) {
      if (!trace) return;
      var id=item.book.id+':'+item.entry.id, row=trace.find(function(x){return x.id===id;});
      if(row && row.status==='matched')return;
      var value={id:id,bookId:item.book.id,bookName:item.book.name,entryId:item.entry.id,label:item.entry.comment || (item.entry.keys || []).join('、') || '无名称条目',status:status,depth:depth};
      if(row)Object.assign(row,value);else trace.push(value);
    }
    (books || []).forEach(function(b) { (b.entries || []).forEach(function(e) { entries.push({ book:b, entry:e }); }); });
    entries.sort(function(a, b) { return (b.entry.priority ?? b.entry.order ?? 0) - (a.entry.priority ?? a.entry.order ?? 0); });
    function hits(keys, input) { return (keys || []).filter(Boolean).map(function(k) { return input.includes(String(k).toLowerCase()); }); }
    function matches(e, input) {
      if (!hits(e.keys, input).some(Boolean)) return false;
      if (!e.selective || !(e.secondaryKeys || []).filter(Boolean).length) return true;
      var values = hits(e.secondaryKeys, input), logic = e.selectiveLogic ?? 0;
      if (logic === 1 || logic === 'not_all') return !values.every(Boolean);
      if (logic === 2 || logic === 'not_any') return !values.some(Boolean);
      if (logic === 3 || logic === 'and') return values.every(Boolean);
      return values.some(Boolean);
    }
    function scan(input, depth) {
      entries.forEach(function(item) {
        var e = item.entry, identity = item.book.id + ':' + e.id;
        if (e.enabled === false || e.disable === true) {record(item,'disabled',depth);return;}
        if (seen.has(identity) || seen.has(e.id)) return;
        if (depth > 0 && (e.excludeRecursion || e.exclude_recursion || e.constant)) return;
        if (!(depth === 0 && e.constant) && !matches(e, input)) {record(item,'no-match',depth);return;}
        var cost = estimateTokens(e.content);
        if (used + cost > budget) {record(item,'budget',depth);return;}
        record(item,'matched',depth);
        seen.add(identity); used += cost;
        result.push({bookId:item.book.id, bookName:item.book.name, entry:e, position:e.position || 0, isConstant:!!e.constant, isRecursive:depth > 0});
        if (!e.noRecurse && !e.preventRecursion && !e.prevent_recursion && depth < maxDepth) queue.push({text:String(e.content || '').toLowerCase(), depth:depth + 1});
      });
    }
    scan(String(text || '').toLowerCase(), 0);
    while (queue.length) { var next = queue.shift(); scan(next.text, next.depth); }
    return result;
  }

  function promptPlan(options) {
    var preset = options.preset || {}, card = options.characterCard || {}, groups = {before:[], after:[], depth:[]};
    (options.lorebookMatches || []).forEach(function(m) {
      var p = Number(m.position) || 0;
      if (p < 2) groups[p === 0 ? 'before' : 'after'].push('[' + m.bookName + '] ' + m.entry.content);
      else groups.depth.push({role:'system', content:'[' + m.bookName + '] ' + m.entry.content, depth:p - 2, order:m.entry.order ?? 100});
    });
    var aliases = {system_main:'main', system_nsfw:'nsfw', world_info_before:'worldInfoBefore', world_info_after:'worldInfoAfter', char_description:'charDescription', char_personality:'charPersonality', world_info:'worldInfo'};
    function id(v) { return aliases[v] || v; }
    var dynamic = {
      main:preset.prompt_main || '', nsfw:preset.prompt_nsfw || '', jailbreak:preset.jailbreak || '',
      worldInfoBefore:groups.before.join('\n\n'), worldInfoAfter:groups.after.join('\n\n'), worldInfo:groups.before.concat(groups.after).join('\n\n'),
      charDescription:card.description || '', charPersonality:card.personality || '', scenario:card.scenario || '',
      personaDescription:options.persona || '', dialogueExamples:card.mes_example || '', chatHistory:null, userInput:null
    };
    var prompts = (preset.prompts || []).map(function(p) { return Object.assign({}, p, {identifier:id(p.identifier)}); });
    var configured = preset.prompt_order || [];
    if (configured.some(function(p) { return Array.isArray(p.order); })) {
      var group = configured.find(function(p) { return String(p.character_id) === String(options.characterId || 100000); });
      configured = (group || configured.find(function(p) { return p.order && p.order.length; }) || {}).order || [];
    }
    if (!configured.length) configured = (preset.promptOrder || []).map(function(p) { return {identifier:id(p.id), enabled:p.enabled}; });
    if (!configured.length) configured = prompts.map(function(p) { return {identifier:p.identifier, enabled:p.enabled}; });
    if (!configured.length) configured = Object.keys(dynamic).filter(function(k) { return k !== 'worldInfo'; }).map(function(k) { return {identifier:k}; });
    var has = new Set(), blocks = [], depth = groups.depth.slice();
    function add(config) {
      var identifier = id(config.identifier || config.id), p = prompts.find(function(v) { return v.identifier === identifier; });
      if (has.has(identifier)) return;
      has.add(identifier);
      if (config.enabled === false || (p && p.enabled === false)) return;
      p = p || {};
      if (identifier === 'chatHistory' || identifier === 'userInput') { blocks.push({marker:identifier}); return; }
      var content = Object.prototype.hasOwnProperty.call(dynamic, identifier) ? dynamic[identifier] : p.content;
      if ((identifier === 'main' || identifier === 'nsfw' || identifier === 'jailbreak') && p.content) content = p.content;
      if (!content) return;
      var replacements = {user:options.userName || '玩家', char:card.name || '角色', scenario:card.scenario || '', personality:card.personality || '', description:card.description || '', location:options.location || ''};
      content = String(content).replace(/\{\{(user|char|scenario|personality|description|location)\}\}/g, function(_, key) { return replacements[key]; });
      var block = {role:['system','user','assistant'].includes(p.role) ? p.role : 'system', content:content};
      if ([1,6].includes(Number(p.injection_position))) { block.depth = Number(p.injection_position) === 6 ? 4 : Math.max(0, Number(p.injection_depth) || 0); block.order = p.injection_order ?? 100; depth.push(block); }
      else blocks.push(block);
    }
    configured.forEach(add);
    // Newly added editor blocks absent from an old order still remain usable.
    prompts.forEach(function(p) { if (!has.has(p.identifier)) add(p); });
    ['charDescription','charPersonality','scenario','worldInfoBefore','worldInfoAfter'].forEach(function(k) {
      if (!has.has(k) && !(k.startsWith('worldInfo') && has.has('worldInfo'))) add({identifier:k});
    });
    // History/input cannot be silently disabled: they define the turn itself.
    if (!blocks.some(function(b) { return b.marker === 'chatHistory'; })) blocks.push({marker:'chatHistory'});
    if (!blocks.some(function(b) { return b.marker === 'userInput'; })) blocks.push({marker:'userInput'});
    // Depth-injected lore uses the same macros as ordinary preset blocks.
    depth.forEach(function(d){d.content=String(d.content||'').replace(/\{\{(user|char|location)\}\}/g,function(_,key){return key==='user'?(options.userName||'玩家'):key==='char'?(card.name||'角色'):(options.location||'');});});
    return {blocks:blocks, depth:depth};
  }
  function composePrompt(options) {
    var plan = options.plan, history = (options.history || []).map(function(m) { return {role:m.role, content:String(m.content || '')}; });
    var maxContext = Number(options.maxContext) || 32768, reserve = Number(options.maxOutput) || 1024;
    var limit = maxContext - reserve;
    if (limit <= 0) throw new Error('最大回复长度必须小于上下文容量');
    function build() {
      var inserted = history.map(function() { return []; }); inserted.push([]);
      plan.depth.slice().sort(function(a,b) { return a.order - b.order; }).forEach(function(d) {
        inserted[Math.max(0, history.length - d.depth)].push({role:d.role, content:d.content});
      });
      history.forEach(function(m, i) { inserted[i].push(m); });
      var result = options.system ? [{role:'system', content:options.system}] : [];
      plan.blocks.forEach(function(b) {
        if (b.marker === 'chatHistory') inserted.forEach(function(items) { result.push.apply(result, items); });
        else if (b.marker === 'userInput') { if (options.userInput) result.push({role:'user', content:options.userInput}); }
        else result.push({role:b.role, content:b.content});
      });
      return result;
    }
    var messages = build(), removed = 0;
    function cost() { return messages.reduce(function(n,m) { return n + estimateTokens(m.content); },0); }
    while (cost() > limit && history.length) {
      history.shift(); removed++;
      // Do not leave an assistant response without the user turn it belongs to.
      while (history.length && history[0].role === 'assistant') { history.shift(); removed++; }
      messages = build();
    }
    if (cost() > limit) throw new Error('角色、世界书和固定规则超出上下文预算，请减少启用内容或提高上下文容量');
    return {messages:messages, estimatedTokens:cost(), removedMessages:removed, estimateOnly:true};
  }

  // Content protocol parser: retain the entire accumulated response; chunks are not sections.
  function geminiBody(messages,options,api){
    var contents=[],system=[],started=false;
    (messages||[]).forEach(function(m){
      if(typeof m.content!=='string')throw new Error('Gemini 当前仅支持文本消息');
      if((m.role==='system'||m.role==='developer')&&!started){system.push({text:m.content});return;}
      if(!['system','developer','user','assistant'].includes(m.role))throw new Error('Gemini 当前不支持工具消息');
      started=true;var role=m.role==='assistant'?'model':'user',text=(m.role==='system'||m.role==='developer'?'【系统补充】\n':'')+m.content;
      if(contents.length&&contents[contents.length-1].role===role)contents[contents.length-1].parts.push({text:text});
      else contents.push({role:role,parts:[{text:text}]});
    });
    if(!contents.length)contents.push({role:'user',parts:[{text:'请根据系统设定继续。'}]});
    var config={};
    if(options.max_tokens!==undefined)config.maxOutputTokens=options.max_tokens;
    if(options.temperature!==undefined)config.temperature=options.temperature;
    if(options.top_p!==undefined)config.topP=options.top_p;
    var thinking=options.thinkingLevel||api.thinkingLevel;
    if(thinking&&thinking!=='default'){
      if(!['minimal','low','medium','high'].includes(thinking))throw new Error('Gemini 思考级别无效');
      var model=String(options.model||api.model||'');
      if(/gemini-2\.5/.test(model))throw new Error('Gemini 2.5 请使用模型默认思考级别');
      if(thinking==='minimal'&&/gemini-(?:4|3\.8)/.test(model))throw new Error('当前模型不支持 minimal 思考级别，请选择 low');
      config.thinkingConfig={thinkingLevel:thinking};
    }
    if(options.jsonMode)config.responseMimeType='application/json';
    var body={contents:contents,generationConfig:config};if(system.length)body.systemInstruction={parts:system};return body;
  }
  function geminiReply(data){
    if(data.error)throw new Error('Gemini 返回错误，请检查模型和接口配置');
    if(data.promptFeedback&&data.promptFeedback.blockReason)throw new Error('Gemini 拒绝处理本次输入');
    var c=data.candidates&&data.candidates[0];
    if(!c)return {text:'',finish:null};
    if(c.finishReason&&c.finishReason!=='STOP')throw new Error(c.finishReason==='MAX_TOKENS'?'Gemini 输出达到 token 上限，本轮未提交；请增加预设输出额度或降低思考级别':'Gemini 回复未正常完成，本轮未提交');
    return {text:((c.content&&c.content.parts)||[]).filter(function(p){return !p.thought&&typeof p.text==='string';}).map(function(p){return p.text;}).join(''),finish:c.finishReason};
  }
  function streamParser() {
    var text = '', listeners = [];
    function emit() {
      var found = false, re = /(?:^|\n)##\s*(\w+)[ \t]*\r?\n/g, markers = [], m;
      while ((m = re.exec(text))) markers.push({tag:m[1].toLowerCase(), start:m.index, end:re.lastIndex});
      markers.forEach(function(marker, i) {
        var content = text.slice(marker.end, i + 1 < markers.length ? markers[i + 1].start : text.length).trim();
        listeners.forEach(function(fn) { fn(marker.tag, content); }); found = true;
      });
      if (!found) listeners.forEach(function(fn) { fn('maintext', text); });
    }
    return {feed:function(chunk) { text += chunk; emit(); }, onTag:function(fn) { listeners.push(fn); }, reset:function() { text = ''; }, flushBuffer:function() { emit(); return text; }};
  }

  async function readStream(response, backend, onChunk, signal) {
    var reader = response.body.getReader(), decoder = new TextDecoder(), pending = '', eventData = [], full = '', done = false, geminiFinish=null;
    function accept(payload) {
      if (payload === '[DONE]') { done = true; return; }
      var data;
      try { data = JSON.parse(payload); } catch (_) { throw new Error('模型返回了无法解析的流式数据'); }
      if (data.error) throw new Error(backend==='gemini'?'Gemini 返回错误，请检查模型和接口配置':typeof data.error === 'string' ? data.error : data.error.message || '模型返回错误');
      var gemini=backend==='gemini'?geminiReply(data):null;
      if(gemini&&gemini.finish)geminiFinish=gemini.finish;
      var content = gemini?gemini.text:backend === 'ollama' ? data.message && data.message.content : backend === 'kobold' ? data.token : data.choices && data.choices[0] && data.choices[0].delta && data.choices[0].delta.content;
      if (content) { full += content; if (onChunk) onChunk(content, full); }
    }
    function flushEvent() { if (eventData.length) { accept(eventData.join('\n')); eventData = []; } }
    function line(value) {
      if (backend === 'ollama') { if (value.trim()) accept(value); return; }
      if (!value) { flushEvent(); return; }
      if (value.startsWith('data:')) eventData.push(value.slice(5).replace(/^ /,''));
    }
    function drain(final) {
      var match;
      while ((match = /\r\n|\n|\r/.exec(pending))) {
        if (!final && match[0] === '\r' && match.index === pending.length - 1) break;
        var value = pending.slice(0, match.index); pending = pending.slice(match.index + match[0].length); line(value);
        if (done) return;
      }
      if (final && pending) { line(pending); pending = ''; }
      if (final) flushEvent();
    }
    var onAbort=function(){reader.cancel().catch(function(){});};
    if(signal)signal.addEventListener('abort',onAbort,{once:true});
    try {
      while (!done) {
        checkAbort(signal);
        var chunk = await reader.read();
        checkAbort(signal);
        if (chunk.done) { pending += decoder.decode(); drain(true); break; }
        pending += decoder.decode(chunk.value, {stream:true}); drain(false);
      }
      if(backend==='gemini'&&(geminiFinish!=='STOP'||!full.trim()))throw new Error('Gemini 流式回复不完整或缺少正文，本轮未提交');
      return full;
    } finally { if(signal)signal.removeEventListener('abort',onAbort);try { await reader.cancel(); } catch (_) {} reader.releaseLock(); }
  }

  async function request(api, messages, options, onChunk, fetcher) {
    options = options || {}; checkAbort(options.signal);
    var backend = api.backend || 'openai', stream = !!onChunk, body, headers = {'Content-Type':'application/json'};
    if(backend==='gemini'){
      if(!options.model&&!api.model)throw new Error('请填写 Gemini 模型标识');
      body=geminiBody(messages,options,api);if(api.apiKey||api.key)headers['x-goog-api-key']=api.apiKey||api.key;
    }
    else if (backend === 'ollama') body = {model:options.model || api.model, messages:messages, stream:stream, options:{temperature:options.temperature ?? 0.7, num_predict:options.max_tokens ?? 1024, top_p:options.top_p ?? 1}};
    else if (backend === 'kobold') {
      // The standard generate endpoint returns JSON; do not mistake that JSON for token text.
      body = {prompt:messages.map(function(m) { return m.role + ': ' + m.content; }).join('\n\n') + '\nassistant:', temperature:options.temperature ?? 0.7, max_length:options.max_tokens ?? 1024, top_p:options.top_p ?? 1};
    } else {
      body = {model:options.model || api.model, messages:messages, stream:stream};
      ['temperature','max_tokens','top_p','frequency_penalty','presence_penalty'].forEach(function(k) { if (options[k] !== undefined) body[k] = options[k]; });
      if (api.apiKey || api.key) headers.Authorization = 'Bearer ' + (api.apiKey || api.key);
    }
    var response = await (fetcher || fetch)(transportURL(api,endpoint(api.url, backend,options.model||api.model,stream)), {method:'POST', headers:headers, body:JSON.stringify(body), signal:options.signal});
    checkAbort(options.signal);
    if (!response.ok) { var error = new Error('模型请求失败（HTTP ' + response.status + '）'); error.status = response.status; throw error; }
    var contentType = (response.headers.get('content-type') || '').toLowerCase();
    if (backend === 'kobold' || !stream || contentType.includes('application/json')) {
      var data = await response.json(); checkAbort(options.signal);
      if (data.error) throw new Error('模型返回错误，请检查模型和接口配置');
      if(backend==='gemini'){
        var reply=geminiReply(data);if(reply.finish!=='STOP'||!reply.text.trim())throw new Error('Gemini 回复不完整或缺少正文，本轮未提交');
        if(onChunk)onChunk(reply.text,reply.text);return reply.text;
      }
      var content = backend === 'kobold' ? data.results && data.results[0] && data.results[0].text : backend === 'ollama' ? data.message && data.message.content : data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
      if (typeof content !== 'string') throw new Error('模型回复缺少正文，请检查接口协议');
      if (onChunk) onChunk(content, content);
      return content;
    }
    return readStream(response, backend, onChunk, options.signal);
  }

  function applyOperations(current, operations) {
    var next = clone(current || {});
    (operations || []).forEach(function(op) {
      if (!op.key || blocked.has(op.key)) return;
      if (op.type === 'addSmallSum') next[op.key] = (Number(next[op.key]) || 0) + op.amount;
      else if (op.type === 'toggle') next[op.key] = !(next[op.key] === true || next[op.key] === 'true' || next[op.key] === 1);
      else if (op.type === 'set') next[op.key] = op.value;
    });
    return next;
  }
  function regeneration(chat) {
    var last = chat.messages.length - 1;
    if (last < 0) throw new Error('暂无可重演的回合');
    if (chat.messages[last].role === 'assistant') last--;
    if (last < 0 || chat.messages[last].role !== 'user') throw new Error('找不到本轮玩家输入');
    var user = chat.messages[last], before = user.turnBefore || (chat.messages[last + 1] || {}).turnBefore;
    if (!before) throw new Error('该旧回合没有状态快照，请通过时空回溯或新回合继续');
    return {content:user.content, messages:clone(chat.messages.slice(0,last + 1)), before:clone(before)};
  }
  function parseJSON(text) {
    if (String(text).length > 20 * 1024 * 1024) throw new Error('文件超过 20 MB 限制');
    return JSON.parse(text, function(k,v) { if (blocked.has(k)) return undefined; return v; });
  }
  async function importCard(file) {
    if (file.size > 20 * 1024 * 1024) throw new Error('角色卡超过 20 MB 限制');
    var json;
    if (/\.png$/i.test(file.name) || file.type === 'image/png') {
      var bytes = new Uint8Array(await file.arrayBuffer());
      if ([137,80,78,71,13,10,26,10].some(function(n,i) { return bytes[i] !== n; })) throw new Error('无效的 PNG 文件');
      var view = new DataView(bytes.buffer), offset = 8;
      while (offset + 12 <= bytes.length) {
        var size = view.getUint32(offset), type = String.fromCharCode.apply(null, bytes.slice(offset + 4, offset + 8));
        if (offset + 12 + size > bytes.length) throw new Error('PNG 数据不完整');
        if (type === 'tEXt') {
          var chunk = bytes.slice(offset + 8, offset + 8 + size), zero = chunk.indexOf(0);
          var key = new TextDecoder().decode(chunk.slice(0,zero));
          if (zero >= 0 && (key === 'chara' || key === 'ccv3')) {
            var encoded = new TextDecoder().decode(chunk.slice(zero + 1));
            var decoded = Uint8Array.from(atob(encoded), function(c) { return c.charCodeAt(0); });
            json = parseJSON(new TextDecoder('utf-8', {fatal:true}).decode(decoded)); break;
          }
        }
        offset += size + 12;
      }
      if (!json) throw new Error('PNG 不包含支持的 chara/ccv3 tEXt 角色卡数据');
    } else json = parseJSON(await file.text());
    var data = json && (json.data || json);
    if (!data || typeof data.name !== 'string' || !data.name.trim() || typeof data.description !== 'string') throw new Error('角色卡必须包含名称和描述');
    var card = clone(data);
    card.id = 'active'; card.name = data.name.trim(); card.firstMessage = data.first_mes || data.firstMessage || '';
    ['personality','scenario','firstMessage'].forEach(function(k) { if (card[k] != null && typeof card[k] !== 'string') throw new Error('角色卡字段类型错误：' + k); });
    return card;
  }
  return {clone:clone, redact:function(v) { return clone(v,true); }, escapeHtml:escapeHtml, handlerArg:handlerArg, estimateTokens:estimateTokens, endpoint:endpoint, transportURL:transportURL, abortError:abortError, checkAbort:checkAbort, matchLorebooks:matchLorebooks, promptPlan:promptPlan, composePrompt:composePrompt, streamParser:streamParser, request:request, readStream:readStream, applyOperations:applyOperations, regeneration:regeneration, parseJSON:parseJSON, importCard:importCard};
});
