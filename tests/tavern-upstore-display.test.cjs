const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const core=require('../assets/js/tavern-core.js');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
function setup(){
  const typing={textContent:''},state={TavernCore:core,parser:core.streamParser(),ensureCurrent(){},document:{getElementById:()=>typing}};
  vm.createContext(state);
  vm.runInContext(html.match(/parser\.onTag\(function\(tag, text\)[^\n]+/)[0],state);
  vm.runInContext(html.match(/function parseUpstore\([^]*?\n\}/)[0],state);
  return {state,typing};
}

for(const heading of ['', '## maintext\n'])test('upstore stays hidden at every network split '+JSON.stringify(heading),()=>{
  const raw=heading+'你抵达城门。\n<branches>\n[进城]\n</branches>\n<upstore>\naddSmallSum:gold:3\nset:place:城门\n</upstore>\n守卫向你点头。';
  for(let split=0;split<=raw.length;split++){
    const {state,typing}=setup();
    state.parser.feed(raw.slice(0,split));
    assert.ok(!typing.textContent.includes('<'),typing.textContent);
    assert.ok(!typing.textContent.includes('gold'),typing.textContent);
    state.parser.feed(raw.slice(split));
    assert.equal(typing.textContent.trim(),'你抵达城门。\n\n\n守卫向你点头。');
    const full=state.parser.flushBuffer();assert.equal(full,raw);
    const parsed=state.parseUpstore(full),before={gold:10};
    assert.deepEqual(core.applyOperations(before,parsed.operations),{gold:13,place:'城门'});
    assert.deepEqual(before,{gold:10});assert.ok(!parsed.cleaned.includes('<upstore>'));
  }
});

test('single-character chunks hide all tag prefixes and an unfinished update without applying it',()=>{
  const {state,typing}=setup(),raw='正文<upstore>\nset:gold:999';
  for(const ch of raw){state.parser.feed(ch);assert.ok(!typing.textContent.includes('<'));assert.ok(!typing.textContent.includes('999'));}
  assert.equal(typing.textContent,'正文');assert.equal(state.parser.flushBuffer(),raw);
  assert.equal(state.parseUpstore(raw).operations.length,0);
});

test('case-insensitive update tags are hidden and ordinary text is preserved',()=>{
  assert.equal(core.visibleUpstore('正文<UPSTORE>set:gold:1</UPSTORE>后文',true),'正文后文');
  assert.equal(core.visibleUpstore('正文<ups',true),'正文');
  assert.equal(core.visibleUpstore('1 < 2，<upper>文字</upper>',true),'1 < 2，<upper>文字</upper>');
  assert.equal(core.visibleUpstore('结尾 <',false),'结尾 <');
});
