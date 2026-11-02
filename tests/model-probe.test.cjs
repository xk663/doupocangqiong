const {test} = require('node:test');
const assert = require('node:assert/strict');
const core = require('../assets/js/model-probe-core.js');
const api = {id:'original', backend:'gemini', url:'http://localhost:8080', localRelay:true, apiKey:'PRIVATE-KEY', model:'gemini-test'};
function expected(prompt) {
  const [, a, op, b] = prompt.match(/Q: (\d+) ([+-]) (\d+) = \?\nA:$/);
  return String(op === '+' ? +a + +b : +a - +b);
}
test('challenge uses inclusive 1–50 and nonnegative subtraction', () => {
  const values = [0, 0.999, 0.5];
  const problem = core.challenge(() => values.shift());
  assert.equal(problem.question, '50 - 1 = ?');
  assert.equal(problem.expected,'49');
  assert.equal(core.challenge(() => 0).expected,'2');
});
test('target lookup retains original model and rejects changed channels or endpoints', () => {
  const record = core.target(api, api.model);
  assert.doesNotMatch(JSON.stringify(record), /PRIVATE-KEY|localhost/);
  assert.equal(core.resolveTarget({...record, version:2}, [{...api, model:'new-default'}]).id, api.id);
  for (const change of [{enabled:false}, {id:'other'}, {url:'https://other.test'}, {backend:'openai'}, {localRelay:false}]) {
    assert.equal(core.resolveTarget(record, [{...api, ...change}]), null);
  }
});
test('both upstream adapters send one bounded challenge, separately report model and 6s threshold', async () => {
  for (const backend of ['gemini','openai','ollama','kobold']) {
    let calls = 0, time = 0;
    const check = await core.run({...api,backend}, api.model, undefined, async (url, init) => {
      calls++;
      const body = JSON.parse(init.body);
      const prompt = body.contents?.[0].parts[0].text || body.messages?.[0].content || body.prompt.split('user: ')[1].split('\nassistant:')[0];
      const text = expected(prompt);
      if (backend === 'gemini') {
        assert.match(url,/^\/__gemini_proxy\/v1beta\/models\/gemini-test:generateContent$/);
        assert.equal(init.headers['x-goog-api-key'],api.apiKey);
        assert.deepEqual(body.generationConfig,{maxOutputTokens:50});
        return Response.json({modelVersion:'other',candidates:[{content:{parts:[{text}]}}]});
      }
      if (backend === 'openai') {
        assert.equal(init.headers.Authorization,'Bearer PRIVATE-KEY');
        assert.deepEqual(body,{model:api.model,messages:[{role:'user',content:prompt}],stream:false,max_tokens:50});
      }
      return Response.json({model:'other',message:{content:text},choices:[{message:{content:text}}],results:[{text}]});
    }, () => time++ * (backend === 'gemini' ? 6000 : 5999));
    assert.equal(calls,1);
    assert.equal(check.status,backend === 'gemini' ? 'degraded' : 'operational');
    assert.equal(check.audit.status,'mismatch');
  }
});
test('invalid answers, missing content, HTTP errors and transport failures remain distinguishable', async () => {
  for (const text of ['1000','-123','']) {
    const result = await core.run(api, api.model, undefined, async () => Response.json({candidates:[{content:{parts:[{text}]}}]}));
    assert.equal(result.status,'failed');
  }
  const err = await core.run(api, api.model, undefined, async () => new Response('SECRET',{status:429}));
  assert.equal(err.http,429); assert.equal(err.status,'error'); assert.doesNotMatch(JSON.stringify(err),/SECRET/);
  await assert.rejects(core.run(api, api.model, undefined, async () => { throw new TypeError('offline'); }), /offline/);
});
