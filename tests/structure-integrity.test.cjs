const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{webcrypto}=require('node:crypto');
const T=require('../assets/js/tavern-core.js'),B=require('../assets/js/battle-core.js'),R=require('../assets/js/battle-rules.js'),M=require('../assets/js/memory-core.js');
const html=fs.readFileSync('index.html','utf8'),copy=x=>JSON.parse(JSON.stringify(x));
function loadFunction(s,name){vm.runInContext(html.match(new RegExp('(?:async )?function '+name+'\\([^]*?\\n\\}'))[0],s);}
test('browser and Node execute identical battle rules, including stars and equipment',()=>{
 const browser=vm.createContext({});for(const f of ['battle-rules','battle-engine','battle-core'])vm.runInContext(fs.readFileSync('assets/js/'+f+'.js','utf8'),browser);
 for(const realm of ['斗师一星','斗师九星']){const p={name:'旅人',realm,baseStats:{strength:5},equipment:{weapon:{name:'铁剑',combatBonuses:{attack:12}},armor:{stats:{defense:5}}}};assert.deepEqual(copy(browser.BattleCore.fighter(p)),B.fighter(p));}
});
test('RNG resumes the exact continuous sequence at every saved index',()=>{
 const r=R.createRng('continued');for(let i=0;i<200;i++){const resumed=R.createRng('continued',i);assert.equal(resumed(),r());assert.equal(resumed.index,r.index);}
});
test('battle opening consumes and saves RNG position, reload matches continuous play',()=>{
 const offer={id:'rng-fight',status:'offered',enemyName:'敌人',realm:'斗者一星',enemyStats:{speed:30},seed:'saved-seed'},p={name:'旅人',realm:'斗者一星',baseStats:{endurance:100}};
 const rng=R.createRng(offer.seed),continuous=B.begin(offer,p,rng),saved=B.begin(offer,p);
 assert.ok(saved.state.rngIndex>0);assert.equal(saved.state.rngIndex,rng.index);
 let a=continuous,b=copy(saved);for(let i=0;i<8&&a.status==='active';i++){a=B.transition(a,{type:'guard'},rng);b=B.transition(copy(b),{type:'guard'});assert.deepEqual(b,a);}
});
test('only equipped explicit numeric bonuses apply, strings/descriptions and inventory do not',()=>{
 const p={realm:'斗者',equipment:{weapon:{name:'神剑',desc:'攻击一万',stats:{attack:12}},armor:{combatBonuses:{defense:8,hp:30}},ring:{stats:{speed:'1000',qi:Infinity}}},inventory:[{stats:{attack:999}}]};
 assert.deepEqual(R.equipmentBonuses(p.equipment),{hp:30,qi:0,attack:12,defense:8,speed:0});
 assert.equal(R.deriveStats(p).attack,R.deriveStats({...p,equipment:{}}).attack+12);
});
test('skill backfill uses actual learned evidence, persists ambiguous records without inventing stats',()=>{
 const p={name:'旅人',skills:[{name:'震山掌'}]},chat={messages:[
  {id:'one',role:'assistant',content:'你已掌握黄阶斗技《震山掌》，命中可以打断对手蓄力。'},
  {id:'two',role:'assistant',content:'你已学会《游云步》，脚下灵动。'},
  {id:'npc',role:'assistant',content:'对手已掌握天阶《灭世掌》，可以击碎巨石。'},
  {id:'wish',role:'assistant',content:'你可能学会天阶《风掌》，能够击碎巨石。'}]};
 const r=B.backfillSkills(p,chat);assert.equal(r.added,1);assert.equal(r.player.battleSkills[0].messageId,'one');assert.equal(r.player.battleSkills[0].effect,'interrupt');assert.equal(r.pending[0].name,'游云步');assert.equal(B.backfillSkills(r.player,chat).added,0);assert.equal(p.battleSkills,undefined);
});
test('memory excludes hidden metadata, retains long-message endings and non-overlapping source ranges',()=>{
 const rows=Array.from({length:80},(_,i)=>({id:'m'+i,role:i%2?'assistant':'user',content:i===79?'<think>secret</think><maintext>开始'+('中'.repeat(1200))+'最终得到药草</maintext><battle_updates>hidden</battle_updates>':'消息'+i}));
 const m=M.build(rows,{}),context=M.context(m);assert.match(context,/最终得到药草/);assert.ok(!context.includes('secret'));assert.ok(!context.includes('hidden'));
 const recent=new Set(m.small.slice(-6).flatMap(x=>x.sourceMessageIds));assert.ok(m.large.every(x=>x.sourceMessageIds.every(id=>!recent.has(id))));assert.deepEqual(m.small.at(-1).range,{start:72,end:80});assert.equal(M.context({}),'');
 assert.equal(M.addFact(M.addFact({},'确定事实'),'确定事实').facts.length,1);
});
function stateHarness(){
 const stored=new Map(),notices=[];let fail=false;
 const s=vm.createContext({TavernCore:T,MemoryCore:M,crypto:webcrypto,console,GameState:{player:{name:'旅人',lifeId:'life',realm:'斗师二星'},settings:{},openWorldState:{facts:[{id:'old'}]}},GameTime:{day:1},WorldState:{location:'旧地点'},Economy:{gold:10},StudioState:{},QuestSystem:{},TimeRewind:{snapshots:[],maxSnapshots:20},tavernState:{activeChatId:'a',chats:[{id:'a',lifeId:'life',messages:[],variables:{},memoryTable:{facts:[{id:'old',text:'旧事实'}]},pendingBattleSkills:[]},{id:'b',lifeId:'life',messages:[],playerState:{realm:'斗师一星'}},{id:'other',lifeId:'other-life',messages:[]}],tavernSettings:{}},showToast:m=>notices.push(m),stopTavernStream(){},renderTavernMessages(){},renderTavernSessionList(){},updateTavernInfo(){},saveToLocalStorage(){return true;},document:{getElementById:()=>null},renderMemoryTable(){}});
 s.getActiveChat=()=>s.tavernState.chats.find(c=>c.id===s.tavernState.activeChatId);
 const table=name=>({async put(x){if(fail)throw Error('quota');stored.set(name+':'+x.id,copy(x));},async get(id){return copy(stored.get(name+':'+id));}});
 s.db={chats:table('chats'),tavernSettings:table('settings'),async transaction(mode,tables,fn){const before=new Map(stored);try{await fn();}catch(e){stored.clear();for(const[k,v]of before)stored.set(k,v);throw e;}}};
 for(const c of s.tavernState.chats)stored.set('chats:'+c.id,copy(c));
 for(const name of ['switchTavernChat','takeSnapshot','rewindToSnapshot'])loadFunction(s,name);
 vm.runInContext(fs.readFileSync('assets/js/memory-ui.js','utf8'),s);
 return{s,stored,notices,set fail(value){fail=value;}};
}
test('switching narrative sessions preserves current life state and blocks a different life',()=>{
 const {s}=stateHarness();s.switchTavernChat('b');assert.equal(s.GameState.player.realm,'斗师二星');assert.equal(s.GameState.openWorldState.facts[0].id,'old');s.switchTavernChat('other');assert.equal(s.tavernState.activeChatId,'b');
});
test('rewind atomically restores memory, pending skills, world facts, player and battle',async()=>{
 const h=stateHarness(),s=h.s;s.takeSnapshot([],{});const snap=s.TimeRewind.snapshots[0];
 s.getActiveChat().memoryTable={facts:[{id:'future',text:'未来战果'}]};s.getActiveChat().pendingBattleSkills=[{name:'未来技能'}];s.GameState.openWorldState={facts:[{id:'future'}]};s.GameState.player.realm='斗皇';s.getActiveChat().battle={status:'reported'};
 await s.rewindToSnapshot(snap.id);assert.equal(s.GameState.player.realm,'斗师二星');assert.equal(s.GameState.openWorldState.facts[0].id,'old');assert.equal(s.getActiveChat().memoryTable.facts[0].id,'old');assert.equal(s.getActiveChat().pendingBattleSkills.length,0);assert.equal(s.getActiveChat().battle,null);assert.equal(h.stored.get('settings:main').runtimeState.openWorldState.facts[0].id,'old');
});
test('failed rewind leaves current memory and world intact',async()=>{
 const h=stateHarness(),s=h.s;s.takeSnapshot([],{});s.GameState.openWorldState={facts:[{id:'future'}]};h.fail=true;await s.rewindToSnapshot(s.TimeRewind.snapshots[0].id);assert.equal(s.GameState.openWorldState.facts[0].id,'future');assert.equal(h.stored.has('settings:main'),false);
});
test('memory transaction failure does not publish edits, and durable success restores correctly',async()=>{
 const h=stateHarness(),s=h.s;h.fail=true;const transform=chat=>({chat:{...chat,memoryTable:M.addFact(chat.memoryTable,'新事实')}});
 assert.equal(await s.MemoryUI.update(transform),false);assert.equal(s.getActiveChat().memoryTable.facts.length,1);assert.equal(s.MemoryUI.isBusy(),false);
 h.fail=false;assert.equal(await s.MemoryUI.update(transform),true);assert.equal(h.stored.get('chats:a').memoryTable.facts.length,2);assert.equal(s.getActiveChat().memoryTable.facts.length,2);
});
test('concurrent or changed-session memory edits cannot overwrite a newer chat',async()=>{
 const h=stateHarness(),s=h.s;let release;s.db.transaction=async(mode,tables,fn)=>{await new Promise(r=>release=r);await fn();};
 const pending=s.MemoryUI.update(chat=>({chat:{...chat,memoryTable:M.addFact(chat.memoryTable,'旧编辑')}}));
 assert.equal(await s.MemoryUI.update(chat=>({chat})),false);s.switchTavernChat('b');assert.equal(s.tavernState.activeChatId,'a');s.tavernState.activeChatId='b';release();assert.equal(await pending,false);assert.equal(h.stored.get('chats:a').memoryTable.facts.length,1);
});
test('failed canonical local write leaves persistence timestamps and DB recovery source unchanged',()=>{
 const {s}=stateHarness();s.GameState.settings.playerSavedAt=12;s.tavernState.tavernSettings.playerStateAt=10;
 s.localStorage={setItem(){throw Error('quota');}};loadFunction(s,'saveToLocalStorage');
 assert.equal(s.saveToLocalStorage(),false);assert.equal(s.GameState.settings.playerSavedAt,12);assert.equal(s.tavernState.tavernSettings.playerStateAt,10);
});
test('canonical local envelope includes current world facts and reload restores them',()=>{
 const {s}=stateHarness(),store=new Map();s.localStorage={setItem:(k,v)=>store.set(k,v),getItem:k=>store.get(k)||null};loadFunction(s,'saveToLocalStorage');loadFunction(s,'loadFromLocalStorage');
 assert.equal(s.saveToLocalStorage(),true);s.GameState.openWorldState={facts:[{id:'wrong'}]};assert.equal(s.loadFromLocalStorage(),true);assert.equal(s.GameState.openWorldState.facts[0].id,'old');
});
test('release allowlist excludes personal images, prompts, test data and old entry points',()=>{
 const release=require('../tools/release.cjs'),plan=release.plan();assert.ok(plan.includes('assets/js/memory-ui.js'));assert.ok(plan.includes('assets/vendor/dexie-3.2.4.min.js'));assert.ok(!plan.some(x=>/xiaoyan-xuner|^tests\/|^docs\/|^game.html$|^sillytavern.html$/.test(x)));assert.equal(release.audit().missing.length,0);
});
