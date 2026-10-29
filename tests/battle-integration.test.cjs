const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{webcrypto}=require('node:crypto');
const B=require('../assets/js/battle-core.js'),E=require('../assets/js/battle-engine.js'),T=require('../assets/js/tavern-core.js');
const learned='你已掌握震山掌，命中可以打断敌人的蓄力。',encounter='斗者一星的蒙面劫掠者横刀拦住你，向你发起挑战。';
const data={skills:[{name:'震山掌',grade:'黄',effect:'interrupt',evidence:learned}],encounter:{enemyName:'蒙面劫掠者',realm:'斗者一星',evidence:encounter}};
const player=()=>({name:'测试旅人',realm:'斗者二星',baseStats:{strength:5,endurance:5,speed:5},skills:[]});
test('disabled mode is inert; narrative evidence acquires skills once and creates an unstarted offer',()=>{
 const p=player(),raw=learned+encounter,a=B.apply(p,data,raw,'m1',true),again=B.apply(a.player,data,raw,'m1',true);
 assert.equal(a.player.battleSkills.length,1);assert.equal(again.player.battleSkills.length,1);assert.equal(a.offer.status,'offered');assert.equal(a.offer.state,undefined);assert.equal(p.skills.length,0);assert.equal(B.apply(p,data,raw,'m1',false).offer,null);assert.equal(B.context(p,{enabled:false}),'');
});
test('NPC, hypothetical, missing evidence and invented effects do not grant skills',()=>{
 for(const line of ['对手已掌握震山掌。','你可能掌握震山掌。','你尚未学会震山掌。','你听说对方已掌握震山掌。'])assert.equal(B.apply(player(),{skills:[{name:'震山掌',evidence:line}]},line,'m',true).player.battleSkills.length,0);
 const line='你已掌握震山掌，可以劈开石块。';assert.equal(B.apply(player(),{skills:[{name:'震山掌',effect:'haste',power:99999,evidence:line}]},line,'m',true).player.battleSkills[0].effect,'none');
 assert.equal(B.apply(player(),data,'不存在对应正文','m',true).offer,null);
});
test('NPC-only conflicts and reasoning blocks cannot create player battle facts',()=>{
 const evidence='斗者一星的蒙面劫掠者向路人发起挑战。';assert.equal(B.apply(player(),{encounter:{...data.encounter,evidence}},evidence,'m',true).offer,null);
 assert.equal(B.apply(player(),data,'## thinking\n'+learned+encounter+'\n## maintext\n你继续赶路。','m',true).offer,null);
});
test('legacy battle protocols are mutually exclusive with the local battle mode',()=>{
 const s={GameState:{settings:{battle:{enabled:true}}},BattleCore:B,PROTOCOL_DEFAULTS:{battleTrigger:{},autoBattle:{},statusBar:{}},getProtocolState:key=>({enabled:true,content:key}),resolveProtocolVariables:x=>x};vm.createContext(s);vm.runInContext(html.match(/function buildProtocolSystemPrompt\([^]*?\n\}/)[0],s);assert.equal(s.buildProtocolSystemPrompt(),'statusBar');s.GameState.settings.battle.enabled=false;assert.equal(s.buildProtocolSystemPrompt(),'autoBattle\n\nstatusBar');
});
test('only actual learned skills enter battle, no prototype skills after reload or action',()=>{
 const a=B.apply(player(),data,learned+encounter,'m',true),b=B.begin(a.offer,a.player);assert.deepEqual(b.state.player.skills.map(s=>s.name),['震山掌']);const reload=JSON.parse(JSON.stringify(b));E.migrate(reload.state);assert.equal(reload.state.player.skills.length,1);B.validate(reload);const next=B.transition(reload,{type:'guard'},()=>.5);assert.equal(next.revision,1);assert.equal(reload.revision,0);assert.ok(next.state.meter.enemy>=0);
});
test('surrender settles once, preserves unrelated player data and report needs a finished fight',()=>{
 const a=B.apply(player(),data,learned+encounter,'m',true),b=B.begin(a.offer,a.player);assert.throws(()=>B.report(b));const ended=B.transition(b,{type:'surrender'});assert.equal(ended.status,'report-pending');const p=B.settle({...a.player,inventory:[{name:'水囊'}]},ended);assert.equal(p.inventory[0].name,'水囊');assert.equal(p.combatVitals.battleId,ended.id);assert.deepEqual(B.settle(p,ended),p);assert.match(B.report(ended),/玩家认输/);assert.throws(()=>B.transition(ended,{type:'attack'}));
});
test('resources persist between encounters; explicit recovery restores only corresponding resource',()=>{
 const p={...player(),combatVitals:{hpRatio:.4,qiRatio:.2}};assert.equal(B.fighter(p).hp,Math.round(B.fighter(player()).maxHp*.4));const evidence='你的气血已完全恢复，伤口已经愈合。';const next=B.apply(p,{recovery:{evidence}},evidence,'m',true).player;assert.equal(next.combatVitals.hpRatio,1);assert.equal(next.combatVitals.qiRatio,.2);
});
test('a lethal enemy opening ends and saves before the first player action',()=>{
 const offered={...B.apply(player(),data,learned+encounter,'m',true).offer,realm:'斗帝'};
 const b=B.begin(offered,{...player(),combatVitals:{hpRatio:.01,qiRatio:1}},()=>.5);assert.equal(b.status,'report-pending');assert.equal(b.state.result,'lose');B.validate(b);assert.equal(B.settle(player(),b).combatVitals.hpRatio,0);
});
test('rewind snapshot uses the pre-report battle reference matching its message list',()=>{
 const before={id:'b',status:'report-pending'},s={TavernCore:T,crypto:webcrypto,tavernState:{activeChatId:'c'},TimeRewind:{snapshots:[],maxSnapshots:20},GameState:{player:player()},GameTime:{},WorldState:{},getActiveChat:()=>({battle:{...before,reportUserId:'new-message'}})};vm.createContext(s);vm.runInContext(html.match(/function takeSnapshot\([^]*?\n\}/)[0],s);s.takeSnapshot([],{},before);assert.equal(s.TimeRewind.snapshots[0].battle.reportUserId,undefined);assert.equal(before.reportUserId,undefined);
});
test('metadata stays hidden and malformed saves cannot become live battles',()=>{
 assert.equal(B.extract('正文<battle_updates>{坏数据}</battle_updates>').cleaned,'正文');assert.equal(B.visible('正文<battle_updates>{"skills":'),'正文');
 const b=B.begin(B.apply(player(),data,learned+encounter,'m',true).offer,player());b.state.player.speed=0;assert.throws(()=>B.validate(b));
});
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
function harness(){
 const records=new Map(),notices=[],events={};let calls=0,reply=learned+encounter+'<battle_updates>'+JSON.stringify(data)+'</battle_updates>',failNetwork=false,failStore=false;
 const table=name=>({async put(x){if(failStore&&name==='settings')throw Error('quota');records.set(name+':'+x.id,T.clone(x));}});
 const initial={id:'chat',messages:[],variables:{},presetId:'p'},db={chats:table('chats'),tavernSettings:table('settings'),async transaction(mode,tables,fn){const previous=new Map(records);try{await fn({abort(){throw T.abortError();}});}catch(e){records.clear();previous.forEach((v,k)=>records.set(k,v));throw e;}}};
 const s={TavernCore:T,BattleCore:B,BattleEngine:E,AbortController,crypto:webcrypto,console,setTimeout,location:{origin:'http://fixture'},window:{addEventListener(name,fn){events[name]=fn;}},document:{getElementById(){return null;}},GameState:{player:player(),settings:{battle:{enabled:true,autoReport:false}}},tavernState:{isLoading:false,isSending:false,chats:[initial],activeChatId:'chat',tavernSettings:{}},db,
 getActiveChat(){return s.tavernState.chats.find(c=>c.id===s.tavernState.activeChatId);},showToast(x){notices.push(x);},saveToLocalStorage(){return true;},renderTavernMessages(){},updateTavernInfo(){},takeSnapshot(){},setTavernSendingUI(){},createChatMessage(role,content){return{id:webcrypto.randomUUID(),role,content};},prepareTavernRequest(){return{selection:{preset:{settings:{}}},result:{messages:[],estimatedTokens:0,removedMessages:0},requestOptions:{}};},StreamParser:T.streamParser,parseUpstore:T.parseUpstore,extractVariables(){return{cleanedText:s.lastReply,updates:{}};},mergeVariables:(a,b)=>({...a,...b}),async callLLMStream(){calls++;if(failNetwork)throw Error('network');s.lastReply=reply;return reply;}};
 vm.createContext(s);vm.runInContext(html.match(/function parseUpstore\([^]*?\n\}/)[0],s);vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../assets/js/battle-bridge.js'),'utf8'),s);
 s.ReplayGuard=require('../assets/js/replay-guard.js');vm.runInContext(html.match(/function getTavernReplayStamp\([^]*?\n\}/)[0],s);
 const src=html.match(/async function runTavernTurn\([^]*?\n\}/)[0];vm.runInContext(src,s);
 return{s,records,notices,events,get calls(){return calls;},set reply(v){reply=v;},set failNetwork(v){failNetwork=v;},set failStore(v){failStore=v;}};
}
test('actual narrative turn atomically stores encounter and learned skills; regeneration replaces instead of duplicating',async()=>{
 const h=harness(),s=h.s;await s.runTavernTurn('继续',false);assert.equal(s.getActiveChat().battle?.status,'offered',h.notices.join());assert.equal(s.GameState.player.battleSkills.length,1);assert.equal(h.records.get('settings:main').playerState.battleSkills.length,1);assert.ok(!s.getActiveChat().messages.at(-1).content.includes('battle_updates'));await s.runTavernTurn('',true);assert.equal(s.GameState.player.battleSkills.length,1);assert.equal(s.getActiveChat().messages.length,2);
});
test('failed narrative commit grants no encounter or skill',async()=>{const h=harness();h.failStore=true;await h.s.runTavernTurn('继续',false);assert.equal(h.s.GameState.player.battleSkills,undefined);assert.equal(h.s.getActiveChat().battle,undefined);assert.equal(h.s.getActiveChat().messages.length,1);});
test('battle blocks ordinary generation; failed report retry keeps one user report and no duplicate settlement',async()=>{
 const h=harness(),s=h.s;await s.runTavernTurn('继续',false);let b=B.begin(s.getActiveChat().battle,s.GameState.player);s.getActiveChat().battle=b;await s.runTavernTurn('错误的战中请求',false);assert.equal(h.calls,1);b=B.transition(b,{type:'surrender'});s.getActiveChat().battle=b;s.GameState.player=B.settle(s.GameState.player,b);const vitals=JSON.stringify(s.GameState.player.combatVitals);
 h.failNetwork=true;await s.BattleBridge.sendReport();assert.equal(h.calls,2);assert.equal(s.getActiveChat().messages.filter(m=>m.battleReportId).length,1);assert.equal(s.getActiveChat().battle.status,'report-pending');
 h.failNetwork=false;h.reply='对手收起兵器，接受了你的认输。';await s.BattleBridge.sendReport();assert.equal(h.calls,3);assert.equal(s.getActiveChat().battle.status,'reported',h.notices.join());assert.equal(s.getActiveChat().messages.filter(m=>m.battleReportId).length,1);assert.equal(JSON.stringify(s.GameState.player.combatVitals),vitals);
 await s.BattleBridge.sendReport();assert.equal(h.calls,3);
});
test('report response storage failure is retryable and cannot reopen an encounter',async()=>{
 const h=harness(),s=h.s;await s.runTavernTurn('继续',false);const ended=B.transition(B.begin(s.getActiveChat().battle,s.GameState.player),{type:'surrender'});s.getActiveChat().battle=ended;s.GameState.player=B.settle(s.GameState.player,ended);h.failStore=true;await s.BattleBridge.sendReport();assert.equal(s.getActiveChat().battle.status,'report-pending');h.failStore=false;await s.BattleBridge.sendReport();assert.equal(s.getActiveChat().battle.status,'reported');assert.equal(s.getActiveChat().battle.id,ended.id);
});
test('later state or another session blocks old regeneration before any request',async()=>{
 const h=harness(),s=h.s;await s.runTavernTurn('继续',false);const priorCalls=h.calls;
 s.GameState.player.realm='斗王一星';const old=JSON.stringify(s.getActiveChat());await s.runTavernTurn('',true);
 assert.equal(h.calls,priorCalls);assert.equal(s.GameState.player.realm,'斗王一星');assert.equal(JSON.stringify(s.getActiveChat()),old);assert.ok(h.notices.some(x=>x.includes('阻止重演')));
 const h2=harness(),s2=h2.s;await s2.runTavernTurn('继续',false);s2.tavernState.chats.push({id:'other',messages:[{id:'later',role:'user',content:'另一条剧情'}]});await s2.runTavernTurn('',true);assert.equal(h2.calls,1);
});
test('latest unchanged turn can regenerate after reload, failed initial request can retry',async()=>{
 const h=harness(),s=h.s;await s.runTavernTurn('继续',false);s.tavernState.chats=JSON.parse(JSON.stringify(s.tavernState.chats));await s.runTavernTurn('',true);assert.equal(h.calls,2);assert.equal(s.getActiveChat().messages.length,2);
 const h2=harness();h2.failNetwork=true;await h2.s.runTavernTurn('失败输入',false);assert.equal(h2.s.getActiveChat().messages.length,1);h2.failNetwork=false;await h2.s.runTavernTurn('',true);assert.equal(h2.calls,2);assert.equal(h2.s.getActiveChat().messages.length,2);
});
test('legacy turns without a replay marker are rejected without overwriting state',async()=>{const h=harness();await h.s.runTavernTurn('继续',false);delete h.s.getActiveChat().replayStamp;await h.s.runTavernTurn('',true);assert.equal(h.calls,1);assert.ok(h.notices.some(x=>x.includes('旧回合')));});
test('battle settlement appends to current shared world, never an old chat world snapshot',async()=>{
 const OW=require('../assets/js/open-world-runtime.js'),h=harness(),s=h.s;
 await s.runTavernTurn('继续',false);
 const ended=B.transition(B.begin(s.getActiveChat().battle,s.GameState.player),{type:'surrender'});
 s.GameState.openWorldState={facts:[{id:'latest',statement:'当前世界事实',visibility:'public'}]};
 s.getActiveChat().openWorldState={facts:[{id:'obsolete',statement:'旧世界副本',visibility:'public'}]};
 s.OpenWorldRuntime=OW;s.copy=T.clone;s.chat=s.getActiveChat;s.idle=()=>{};s.refresh=()=>{};s.saving=false;
 const source=fs.readFileSync('assets/js/battle-bridge.js','utf8');const start=source.indexOf('async function commit('),end=source.indexOf('\nfunction ',start);vm.runInContext(source.slice(start,end),s);
 await s.commit(ended,B.settle(s.GameState.player,ended));
 assert.ok(s.GameState.openWorldState.facts.some(x=>x.id==='latest'));assert.ok(!s.GameState.openWorldState.facts.some(x=>x.id==='obsolete'));assert.deepEqual(s.getActiveChat().playerState.combatVitals,s.GameState.player.combatVitals);
});


