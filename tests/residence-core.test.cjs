const {test}=require('node:test'),assert=require('node:assert/strict');
const R=require('../assets/js/residence-core.js');
const world={location:'石漠城',specificSpot:'向导营地'},time='1年3月1日 08:00';
test('an unregistered location grants neither ownership nor facilities',()=>{
 const s=R.state();assert.equal(R.current(s,world),null);assert.equal(s.places.length,0);
 const p={inventory:[],skills:[]};assert.ok(R.conditions(p,null,'alchemy').every(c=>!c.ready));
 assert.equal(R.scene(world),'camp');assert.equal(R.scene({specificSpot:'客栈房间'}),'inn');assert.equal(R.scene({specificSpot:'崖壁山洞'}),'cave');
});
test('manual records are scoped to a location, immutable, whitelisted and round-trip in a save',()=>{
 const initial=R.state(),input={name:'落脚的营帐',kind:'guest',facilities:['rest','not-real'],note:'仅借宿一夜',gold:999999};
 const s=R.register(initial,input,world,time);assert.equal(initial.places.length,0);assert.equal(s.places[0].kind,'guest');assert.deepEqual(s.places[0].facilities,['rest']);assert.equal(s.places[0].gold,undefined);
 assert.equal(R.current(s,{...world,specificSpot:'城门'}),null);assert.deepEqual(R.state(JSON.parse(JSON.stringify(s))),s);
 assert.throws(()=>R.register(s,{kind:'__proto__'},world,time),/居住方式/);
});
test('activity plans preserve player state and time, validate known skills and invitation targets',()=>{
 const player={name:'阿青',realm:'斗者',inventory:[{name:'低阶药材',qty:4}],skills:[{name:'吐纳术'}],relationships:[{name:'杜青禾'}]},before=JSON.stringify(player);
 for(const kind of ['rest','meditation','alchemy','martial','expand'])assert.match(R.plan({kind,player,world,minutes:60}),/不代表已经过去/);
 assert.match(R.plan({kind:'invite',person:'杜青禾',player,world}),/可以拒绝/);
 assert.throws(()=>R.plan({kind:'martial',target:'天阶秘术',player,world}),/不在当前/);
 assert.throws(()=>R.plan({kind:'invite',person:'药老',player,world}),/当前关系/);
 assert.throws(()=>R.plan({kind:'rest',minutes:-1,player,world}),/时长/);assert.equal(JSON.stringify(player),before);
});
test('metadata is hidden and malformed blocks never corrupt visible story text',()=>{
 assert.equal(R.extract('正文<residence_updates>not JSON</residence_updates>').cleaned,'正文');assert.equal(R.extract('正文<residence_updates>[]').errors.length,1);
 assert.equal(R.visible('清晨起身。<residence_updates>[{}]'),'清晨起身。');
});
test('only literal visible-body evidence can create a record; retries are idempotent',()=>{
 const event={action:'record',kind:'rest',title:'休整一刻',evidence:'你在营帐内调息了一刻。'};
 const body='## thinking\n你获得一座庄园。\n## maintext\n你在营帐内调息了一刻。';
 const first=R.apply(null,[event],{body,world,time,source:'chat|turn'});assert.equal(first.state.events.length,1);
 const again=R.apply(first.state,[event],{body,world,time,source:'chat|turn'});assert.equal(again.state.events.length,1);assert.equal(again.changes.length,0);
 assert.equal(R.apply(null,[{...event,evidence:'你获得一座庄园。'}],{body,world,time,source:'t'}).state.events.length,0);
 assert.equal(R.apply(null,[{...event,time:'9999年'}],{body,world,time}).state.events[0].time,time);
 assert.equal(R.apply(null,[event],{body,world,time,source:'chat|turn'}).state.events.length,1);
});
test('new residences remain proposals until reviewed at the matching location',()=>{
 const body='店主允许你借住这间客房一晚。',u={action:'propose',name:'临时客房',kind:'guest',facilities:['rest'],evidence:body};
 const s=R.apply(null,[u],{body,world,time,source:'turn'}).state;assert.equal(s.places.length,0);assert.equal(s.proposals.length,1);
 const id=s.proposals[0].proposalId;assert.throws(()=>R.accept(s,id,{...world,specificSpot:'另一地点'},time),/另一处/);
 const next=R.accept(s,id,world,time);assert.equal(R.current(next,world).kind,'guest');assert.equal(next.proposals.length,0);assert.equal(s.places.length,0);
});
test('record retention is bounded and unknown fields cannot smuggle resources into a residence',()=>{
 const updates=Array.from({length:8},(_,i)=>({action:'record',kind:'rest',title:'休息'+i,evidence:'你在此休息了一会儿。',gold:99999}));let s;
 for(let i=0;i<30;i++)s=R.apply(s,updates,{body:'你在此休息了一会儿。',world,time,source:'turn'+i}).state;
 assert.equal(s.events.length,100);assert.equal(s.events[0].gold,undefined);assert.equal(s.gold,undefined);
});
