/* Browser adaptation of Sub2API channel_monitor_challenge.go and channel_monitor_checker.go. */
(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./tavern-core.js'), require('./model-profile-core.js'), require('./model-route-core.js'));
  else root.ModelProbeCore = factory(root.TavernCore, root.ModelResponseProfile, root.ModelRouteCore);
})(typeof globalThis !== 'undefined' ? globalThis : this, function(transport, profile, ModelRoute) {
  'use strict';
  function target(api, model) {
    const backend = api.backend || 'openai';
    return {version:3, apiId:api.id, backend, model, localRelay:!!api.localRelay,
      endpointDigest:profile.endpointDigest(transport.endpoint(api.url, backend, model, false))};
  }

  // Resolve the original endpoint with the current credential, including records from the older inspector.
  function resolveTarget(record, apis) {
    const api = record && apis.find(item => item.id === record.apiId && item.enabled !== false);
    if (!api || !record.model || (api.backend || 'openai') !== record.backend || !!api.localRelay !== record.localRelay) return null;
    try {
      return target(api, record.model).endpointDigest === record.endpointDigest ? api : null;
    } catch { return null; }
  }

  function challenge(random = Math.random) {
    let a = 1 + Math.floor(random() * 50), b = 1 + Math.floor(random() * 50);
    const plus = random() < 0.5;
    if (!plus && a < b) [a, b] = [b, a];
    const question = a + (plus ? ' + ' : ' - ') + b + ' = ?';
    return {question, expected:String(plus ? a + b : a - b),
      prompt:'Calculate and respond with ONLY the number, nothing else.\n\nQ: 3 + 5 = ?\nA: 8\n\nQ: 12 - 7 = ?\nA: 5\n\nQ: ' + question + '\nA:'};
  }

  async function run(api, model, signal, fetcher = fetch, now = () => performance.now()) {
    const problem = challenge(), backend = api.backend || 'openai';
    const messages = [{role:'user', content:problem.prompt}];
    const headers = {'Content-Type':'application/json'}, key = api.apiKey || api.key;
    let body;
    if (backend === 'gemini') {
      if (key) headers['x-goog-api-key'] = key;
      body = {contents:[{role:'user', parts:[{text:problem.prompt}]}], generationConfig:{maxOutputTokens:50}};
    } else {
      if (key && backend === 'openai') headers.Authorization = 'Bearer ' + key;
      body = transport.requestBody(api, messages, {model, max_tokens:50}, false);
    }
    const url = transport.transportURL(api, transport.endpoint(api.url, backend, model, false));
    const start = now();
    const response = await fetcher(url, {method:'POST', headers, body:JSON.stringify(body), signal});
    if (!response.ok) {
      await response.body?.cancel();
      return {status:'error', http:response.status, elapsed:Math.floor(now() - start), question:problem.question};
    }
    const data = await response.json();
    const elapsed = Math.floor(now() - start);
    const reply = backend === 'gemini' ? data?.candidates?.[0]?.content?.parts?.filter(part => !part?.thought && typeof part?.text === 'string').map(part => part.text).join('')
      : backend === 'ollama' ? data?.message?.content : backend === 'kobold' ? data?.results?.[0]?.text : data?.choices?.[0]?.message?.content;
    const answer = typeof reply === 'string' ? reply : '';
    const correct = (answer.match(/-?\d+/g) || []).includes(problem.expected);
    const audit = ModelRoute.create(model, backend);
    audit.headers(response.headers);
    audit.observe(data);
    return {status:data?.error ? 'error' : !correct ? 'failed' : elapsed >= 6000 ? 'degraded' : 'operational',
      http:response.status, elapsed, question:problem.question, expected:problem.expected, answer:answer.slice(0, 200), audit:audit.result()};
  }
  return {target, resolveTarget, challenge, run};
});
