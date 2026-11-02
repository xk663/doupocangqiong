'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {create}=require('../assets/js/tavern-failure-ui.js');
function setup(){const storage=new Map();const store={getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)};
 const document={createElement(tag){return {tag,children:[],textContent:'',attributes:{},setAttribute(k,v){this.attributes[k]=v;},appendChild(child){this.children.push(child);},set innerHTML(value){throw Error('Unsafe HTML rendering');}};}};
 return {storage,store,document,ui:create({getStorage:()=>store,getDocument:()=>document,getSecrets:()=>['SYNTHETIC-KEY']})};
}
const request=(id='r',chatId='c')=>({id,chatId,phase:'response',controller:new AbortController()});
test('a failed stream retains received prose, stage and reason across reload without storing a credential',()=>{
 const {ui,store,storage}=setup(),r=request();ui.capture(r,'<game>已收到的正文。');ui.capture(r,'</game>');
 ui.record(r,Error('连接中断 SYNTHETIC-KEY'));const saved=ui.get('c');assert.equal(saved.body,'<game>已收到的正文。</game>');assert.equal(saved.phase,'response');assert.match(saved.message,/连接中断/);
 assert.ok(!JSON.stringify([...storage]).includes('SYNTHETIC-KEY'));
 const restored=create({getStorage:()=>store});assert.equal(restored.get('c').body,saved.body);assert.equal(restored.get('other'),null);
});
test('failed replies are rendered as inert uncommitted text and error details do not auto-dismiss',()=>{
 const {ui}=setup(),r=request();ui.capture(r,'<img src=x onerror=alert(1)>响应片段');ui.record(r,Error('服务连接失败'));
 const card=ui.render('c'),details=card.children.find(child=>child.tag==='details');assert.equal(card.attributes.role,'alert');assert.match(card.children[0].textContent,/接收模型响应/);
 assert.equal(details.children.find(child=>child.tag==='pre').textContent,'<img src=x onerror=alert(1)>响应片段');assert.match(card.children.map(n=>n.textContent).join(''),/不代表剧情已生效/);
 assert.ok(ui.render('c'));ui.clear('c');assert.equal(ui.render('c'),null);
});
test('cancellation, committed requests and other chats never turn into failed story messages',()=>{
 const {ui}=setup();for(const r of [request('aborted'),{...request('committed'),committed:true}]){if(r.id==='aborted')r.controller.abort();ui.capture(r,'不能提交');assert.equal(ui.record(r,Error('失败')),undefined);}
 assert.equal(ui.get('c'),null);const r=request();ui.capture(r,'片段');assert.equal(ui.record(r,Object.assign(Error('cancelled'),{name:'AbortError'})),undefined);assert.equal(ui.get('c'),null);
});
test('response copies and retained failures are bounded; a storage failure leaves the current page usable',()=>{
 const {ui,store}=setup(),r=request();ui.capture(r,'字'.repeat(210000));ui.record(r,Error('中断'));assert.equal(ui.get('c').body.length,200000);assert.equal(ui.get('c').receivedCharacters,210000);
 for(let i=0;i<7;i++)ui.record(request('r'+i,'c'+i),Error('失败'));assert.equal(ui.get('c'),null);assert.equal(ui.get('c0'),null);assert.ok(ui.get('c6'));
 store.setItem=()=>{throw Error('quota');};ui.record(request('quota','quota'),Error('无法保存'));assert.ok(ui.get('quota'));assert.match(ui.render('quota').children.map(n=>n.textContent).join(''),/刷新前/);
});
test('malformed saved records and credential lookup failures cannot break failure handling',()=>{
 const {store}=setup();store.setItem('doupo_failed_turns_v1','{"version":1,"rows":[null,{}, {"chatId":"c","body":"x","phase":"constructor"}]}');
 const ui=create({getStorage:()=>store,getSecrets:()=>{throw Error('unavailable');}});assert.equal(ui.get('c'),null);assert.doesNotThrow(()=>ui.record(request(),Error('safe failure')));assert.equal(ui.get('c').message,'safe failure');
});
