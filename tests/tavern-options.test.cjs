const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const core=require('../assets/js/tavern-core.js');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');

function setup(){
  function node(tag){return {tag,children:[],style:{},textContent:'',appendChild(child){this.children.push(child);}};}
  const input={value:''},typing=node('div'),sent=[];
  const state={TavernCore:core,GameState:{player:{name:'旅人'},settings:{}},tavernState:{tavernSettings:{}},
    document:{createDocumentFragment:()=>node('fragment'),createElement:node,getElementById:id=>id==='tavern-input'?input:typing},
    applyRegexScripts:text=>text,sendTavernMessage:()=>sent.push(input.value),ensureCurrent(){}};
  vm.createContext(state);
  for(const name of ['getOutputTags','parseGameModeOutput','parseBranchOptions','buildAssistantMessageDOM','selectTavernOption','assembleTavernPrompt']){
    const match=html.match(new RegExp('function '+name+'\\([^]*?\\n\\}'));
    assert.ok(match,name);vm.runInContext(match[0],state);
  }
  return {state,sent,typing};
}
function flatten(n){return [n,...n.children.flatMap(flatten)];}

test('default request asks for one branches option block; pure text keeps its own format',()=>{
  const {state}=setup();
  const prompt=state.assembleTavernPrompt({userInput:'继续',preview:true}).systemMsg;
  assert.ok(!prompt.includes('## option'));
  assert.match(prompt,/行动选项仅使用一个 <branches><\/branches> 块输出/);
  for(const kind of ['快速推进','最合理','最中立','最善良','NSFW'])assert.ok(prompt.includes(kind));
  state.tavernState.tavernSettings.pureTextMode=true;
  const pure=state.assembleTavernPrompt({userInput:'继续',preview:true}).systemMsg;
  assert.match(pure,/【选项】/);assert.ok(!pure.includes('行动选项仅使用一个'));
});

for(const format of ['branches','legacy'])test(format+' options render and click sends exact text without mutating history',()=>{
  const {state,sent}=setup();
  const options=['去坊市问问','先休息'];
  const suffix=format==='branches'?'<branches>\n'+options.map(s=>'['+s+']').join('\n')+'\n</branches>':'## option\n'+options.map(s=>'- [ ] '+s).join('\n');
  const msg={content:'## maintext\n你走到城门。\n\n'+suffix+'\n\n## sum\n抵达城门。'};
  const original=msg.content,nodes=flatten(state.buildAssistantMessageDOM(msg));
  assert.equal(nodes.find(n=>n.className==='msg-maintext').textContent,'你走到城门。');
  const buttons=nodes.filter(n=>n.tag==='button');
  assert.deepEqual(buttons.map(n=>n.textContent),options);
  buttons.forEach(n=>n.onclick());assert.deepEqual(sent,options);
  assert.equal(msg.content,original);
});

test('display filter preserves ordinary text, trailing narrative and summary; hides unfinished blocks',()=>{
  assert.equal(core.visibleBranches('正文\n<BRANCHES>\n[行动]\n</BRANCHES>\n后文'),'正文\n\n后文');
  assert.equal(core.visibleBranches('正文<branches>\n[未完成'),'正文');
  assert.equal(core.visibleBranches('1 < 2，<branching>普通文字</branching>'),'1 < 2，<branching>普通文字</branching>');
  assert.equal(core.visibleBranches('正文<bra',true),'正文');
  assert.equal(core.visibleBranches('结尾 <'),'结尾 <');
  const {state}=setup();
  const nodes=flatten(state.buildAssistantMessageDOM({content:'普通正文<branches>[行动]</branches>'}));
  assert.equal(nodes.find(n=>n.className==='msg-maintext').textContent,'普通正文');
  assert.deepEqual(nodes.filter(n=>n.tag==='button').map(n=>n.textContent),['行动']);
});

test('actual streaming display callback hides branches across every character boundary and preserves raw reply',()=>{
  const {state,typing}=setup();
  state.parser=core.streamParser();
  const callback=html.match(/parser\.onTag\(function\(tag, text\)[^\n]+/);
  assert.ok(callback);vm.runInContext(callback[0],state);
  const raw='## maintext\n你走到城门。\n<branches>\n[去坊市问问]\n[先休息]\n</branches>';
  for(const ch of raw){
    state.parser.feed(ch);
    assert.ok(!/[<>\[\]]/.test(typing.textContent),typing.textContent);
    assert.ok(!typing.textContent.includes('去坊市问问'));
    assert.ok(!typing.textContent.includes('先休息'));
  }
  assert.equal(typing.textContent.trim(),'你走到城门。');
  assert.equal(state.parser.flushBuffer(),raw);
});
