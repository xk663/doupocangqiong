const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const core=require('../assets/js/tavern-core.js');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');

function setup(){
  let height=1000,top=120,nextHeight=1400,callback;
  const frames=[],writes=[];
  const list={style:{scrollBehavior:'smooth'},clientHeight:200,_renderedChatId:'a',
    get scrollHeight(){return height;},get scrollTop(){return top;},
    set scrollTop(value){top=Math.max(0,Math.min(value,height-this.clientHeight));writes.push({top,behavior:this.style.scrollBehavior});},
    set textContent(value){height=0;top=0;},set innerHTML(value){height=100;top=0;},
    appendChild(){height=nextHeight;}};
  const typing={parentElement:list,_text:'',set textContent(text){this._text=text;height=1000+text.length*10;},get textContent(){return this._text;}};
  let chat={id:'a',messages:[{role:'user',content:'历史消息'}]};
  const state={TavernCore:core,ensureCurrent(){},parser:{onTag(fn){callback=fn;}},
    document:{getElementById:id=>id==='tavern-typing'?typing:list,createDocumentFragment:()=>({appendChild(){}}),createElement:()=>({dataset:{}})},
    getActiveChat:()=>chat,requestAnimationFrame:fn=>frames.push(fn)};
  vm.createContext(state);
  vm.runInContext(html.match(/function renderTavernMessages\([^]*?\n\}/)[0],state);
  vm.runInContext(html.match(/parser\.onTag\(function\(tag, text\)[^\n]+/)[0],state);
  return {state,list,typing,writes,frames,emit:text=>callback('maintext',text),setChat:value=>{chat=value;},setNextHeight:value=>{nextHeight=value;}};
}

test('reading older messages keeps its offset across rebuild and smooth scrolling is temporarily disabled',()=>{
  const {state,list,writes}=setup();state.renderTavernMessages();
  assert.equal(list.scrollTop,120);assert.equal(list.scrollHeight,1400);
  assert.equal(writes.at(-1).behavior,'auto');assert.equal(list.style.scrollBehavior,'smooth');
});

test('readers at or near the bottom follow newly rendered messages',()=>{
  for(const top of [800,780]){const {state,list}=setup();list.scrollTop=top;state.renderTavernMessages();assert.equal(list.scrollTop,1200);}
});

test('opening a different chat starts at its latest messages',()=>{
  const {state,list,setChat}=setup();setChat({id:'b',messages:[{role:'user',content:'另一会话'}]});
  state.renderTavernMessages();assert.equal(list.scrollTop,1200);assert.equal(list._renderedChatId,'b');
  list.scrollTop=200;state.renderTavernMessages();assert.equal(list.scrollTop,200);
});

test('source navigation after render cannot be overridden by a queued bottom scroll',()=>{
  const {state,list,frames}=setup();list.scrollTop=800;state.renderTavernMessages();
  list.scrollTop=260;frames.forEach(fn=>fn());assert.equal(list.scrollTop,260);
});

test('reset and empty selection clear render metadata, and shorter history clamps safely',()=>{
  const {state,list,setChat,setNextHeight}=setup();
  list.scrollTop=600;setNextHeight(400);state.renderTavernMessages();assert.equal(list.scrollTop,200);
  setChat({id:'a',messages:[]});state.renderTavernMessages();assert.equal(list.scrollTop,0);assert.equal(list._lastRenderedCount,0);
  setChat(null);state.renderTavernMessages();assert.equal(list._renderedChatId,null);
});

test('stream follows bottom, pauses when the reader scrolls up, and resumes when they return',()=>{
  const {list,emit,writes}=setup();list.scrollTop=800;
  emit('新的故事');assert.equal(list.scrollTop,list.scrollHeight-list.clientHeight);
  assert.equal(writes.at(-1).behavior,'auto');assert.equal(list.style.scrollBehavior,'smooth');
  list.scrollTop=120;emit('新的故事继续展开');assert.equal(list.scrollTop,120);
  list.scrollTop=list.scrollHeight-list.clientHeight;emit('新的故事继续展开，人物走入街道');
  assert.equal(list.scrollTop,list.scrollHeight-list.clientHeight);
});

test('replacing a long streaming preview preserves a reader inside that preview',()=>{
  const {state,list,emit,setNextHeight}=setup();
  list.scrollTop=800;emit('故事'.repeat(100));list.scrollTop=1500;
  setNextHeight(3200);state.renderTavernMessages();assert.equal(list.scrollTop,1500);
});
