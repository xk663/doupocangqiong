const {test}=require('node:test');
const assert=require('node:assert/strict');
const {describe}=require('../assets/js/title-menu.js');
test('saved preferences alone never enable Continue',()=>{
  const x=describe({player:{name:'',race:''},settings:{apis:[{id:'configured'}]}},{},()=>[]);
  assert.equal(x.available,false);assert.equal(x.source,'empty');
});
test('current life owns its summary even when a newer named slot exists',()=>{
  let reads=0;const x=describe({player:{name:'当前角色',race:'human',realm:'斗师 · 一星'}},{location:'青山镇'},()=>{reads++;return [{id:'other',timestamp:999,player:{name:'别的人生'}}];});
  assert.equal(x.source,'current');assert.equal(x.name,'当前角色');assert.equal(x.details,'斗师 · 一星 · 青山镇');assert.equal(reads,0);
});
test('saved slot summary follows Continue ordering and ignores the recycle bin',()=>{
  const x=describe({player:{}},{location:'默认地点'},()=>[
    {id:'trash',deletedAt:1,updatedAt:9999,player:{name:'已删除'}},
    {id:'old',timestamp:10,player:{name:'旧存档'}},
    {id:'latest',timestamp:1,updatedAt:50,player:{name:'最新存档',realm:'斗者'},worldState:{location:'石漠城'}}
  ]);
  assert.equal(x.source,'save');assert.equal(x.name,'最新存档');assert.equal(x.details,'斗者 · 石漠城');
});
test('unfinished creation resumes as creation without inventing strength or location',()=>{
  const x=describe({phase:'creation',player:{worldMode:'canon',creationStep:3,name:'新角色'}},{},()=>{throw Error('must not read slots');});
  assert.equal(x.available,true);assert.equal(x.label,'继续创角');assert.equal(x.details,'创角进度 · 第 4 步');
});
test('unreadable slots yield an actionable status without changing data',()=>{
  const state={player:{},settings:{}};const before=JSON.stringify(state);
  const x=describe(state,{},()=>{throw Error('corrupt');});
  assert.equal(x.source,'error');assert.equal(x.available,false);assert.equal(JSON.stringify(state),before);
});
test('trashing a manual snapshot preserves the independent current autosave and clearing it leaves no trashed fallback',()=>{
  const slots=[{id:'manual',deletedAt:123,player:{name:'同一角色',race:'human'}}];
  const current=describe({player:{name:'同一角色',race:'human'}},{},()=>slots);
  assert.equal(current.source,'current');assert.equal(current.available,true);
  const cleared=describe({player:{}},{},()=>slots);
  assert.equal(cleared.source,'empty');assert.equal(cleared.available,false);
});
