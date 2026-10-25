const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const rules=require('../assets/js/creation-rules.js');
const core=require('../assets/js/tavern-core.js');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
function harness(){
 const elements=new Map(),storage=new Map(),notices=[];
 function element(id){if(!elements.has(id))elements.set(id,{id,innerHTML:'',textContent:'',style:{},value:'',classList:{add(){},remove(){},toggle(){}},focus(){},setAttribute(){},removeAttribute(){}});return elements.get(id);}
 const sandbox={CreationRules:rules,TavernCore:core,LoreCatalog:require('../assets/js/lore-catalog.js'),DoupoUserFlames:require('../assets/js/user-flames.js'),LoreCanon:require('../assets/js/lore-canon.js'),crypto:webcrypto,console:{warn(){},log(){},error(){}},AbortController,URL,URLSearchParams,Blob,FormData,structuredClone,
  document:{addEventListener(){},querySelectorAll(){return [];},querySelector(){return null;},getElementById:element},
  localStorage:{getItem(k){return storage.get(k)||null;},setItem(k,v){storage.set(k,v);}},
  setInterval(){return 1;},clearInterval(){},setTimeout(){return 1;},clearTimeout(){},requestAnimationFrame(){},cancelAnimationFrame(){}};
 sandbox.window=sandbox;vm.createContext(sandbox);
 for(const script of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))if(script[1].trim())vm.runInContext(script[1],sandbox);
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../assets/js/creation-ui.js'),'utf8'),sandbox);
 vm.runInContext('globalThis.objects={GameState,RACES,IDENTITIES,TALENTS,TALENT_TIERS,DOUQI_ATTRS,DIFFICULTY,STAT_CONFIG};',sandbox);
 sandbox.showToast=(message,type)=>notices.push({message,type});
 sandbox.startNewGame();
 return {s:sandbox,o:sandbox.objects,el:element,storage,notices,p:sandbox.objects.GameState.player,catalog:sandbox.CreationUI.catalog()};
}
test('new creation computes a valid budget and nonzero performance from defaults',()=>{
 const {p,el}=harness();assert.equal(p.pointsSpent,30);assert.equal(el('creation-points-value').textContent,'70');assert.equal(p.performanceStats.hp,100);assert.equal(p.performanceStats.da,40);
});
test('steps guard incomplete information and cannot advance by repeated next clicks',()=>{
 const {s,p,notices}=harness();s.creationNext();assert.equal(s.creationCurrentStep,0);assert.match(notices.at(-1).message,/姓名/);
 s.CreationUI.field('name','云知微');s.CreationUI.go(5);assert.equal(s.creationCurrentStep,0);assert.match(notices.at(-1).message,/斗气属性/);
 s.CreationUI.attribute('fire');s.CreationUI.go(5);assert.equal(s.creationCurrentStep,5);assert.equal(p.creationStep,5);
});
test('revisiting difficulty recalculates costs instead of refunding spent points',()=>{
 const {s,p}=harness();s.CreationUI.pick('race','taixu');s.CreationUI.pick('identity','alchemist');assert.equal(p.pointsSpent,75);
 s.CreationUI.difficulty('easy');assert.equal(p.pointsSpent,75);assert.equal(p.points,150);
 s.CreationUI.difficulty('mortal');assert.ok(rules.validate(p,s.CreationUI.catalog()).some(e=>e.message.includes('点数不足')));
 s.CreationUI.pick('race','human');assert.equal(p.race,'human');assert.equal(p.pointsSpent,45);s.CreationUI.pick('identity','wanderer');assert.equal(p.pointsSpent,30);
});
test('stat changes clamp to range and available budget; displayed values stay live',()=>{
 const {s,p,el}=harness();s.CreationUI.difficulty('mortal');s.updateStat('strength',20);assert.equal(p.baseStats.strength,5);
 s.updateStat('endurance',0);s.updateStat('strength',20);assert.equal(p.baseStats.strength,10);assert.equal(p.pointsSpent,30);assert.equal(el('perf-stat-pa').textContent,80);
 s.updateStat('speed',-99);assert.equal(p.baseStats.speed,0);s.updateStat('__proto__',20);assert.equal(Object.getPrototypeOf(p.baseStats).polluted,undefined);
});
test('canon mode removes unsupported choices while free mode keeps legacy IDs available',()=>{
 const {s,p}=harness();s.CreationUI.difficulty('unlimited');s.CreationUI.mode('free');s.CreationUI.pick('race','longhuang');s.CreationUI.pick('identity','formationMaster');s.CreationUI.talent('l6');s.CreationUI.attribute('space');
 assert.equal(p.race,'longhuang');assert.ok(p.talents.includes('l6'));
 s.CreationUI.mode('canon');assert.equal(p.race,'human');assert.equal(p.identity,'wanderer');assert.equal(p.talents.length,0);assert.equal(p.douqiAttributes.length,0);
});
test('alchemy checks a fire attribute with a wood trace, not two full attributes',()=>{
 const {s,p,catalog}=harness();p.name='丹青';s.CreationUI.pick('identity','alchemist');s.CreationUI.attribute('wood');
 assert.ok(rules.validate(p,catalog,4).some(e=>e.message.includes('炼药')));
 s.CreationUI.alchemy();assert.deepEqual(Array.from(p.douqiAttributes),['fire']);assert.equal(p.woodAffinity,true);assert.equal(rules.validate(p,catalog,4).length,0);
 s.CreationUI.attribute('water');assert.equal(p.woodAffinity,false);
});
test('talents have real declared bonuses, enforce exclusions and charge the exact tier cost',()=>{
 const {s,p}=harness();s.CreationUI.talent('c1');assert.equal(p.performanceStats.hp,110);assert.equal(p.pointsSpent,30);
 s.CreationUI.talent('r1');assert.equal(p.pointsSpent,45);s.CreationUI.talent('r1');assert.equal(p.pointsSpent,30);
 s.CreationUI.talent('c8');s.CreationUI.talent('poison-body');assert.equal(p.talents.includes('poison-body'),false);
});
test('second free-mode attribute costs ten points without repeat-selection leakage',()=>{
 const {s,p}=harness();s.CreationUI.mode('free');s.CreationUI.attribute('fire');s.CreationUI.attribute('water');assert.equal(p.pointsSpent,40);
 s.CreationUI.attribute('fire');assert.equal(p.pointsSpent,30);s.CreationUI.attribute('earth');assert.equal(p.pointsSpent,40);
});
test('all starting places and kits produce independent, accurate opening state',()=>{
 for(const place of rules.places)for(const kit of rules.kits){const state=rules.initialState({startLocation:place.id,starterKit:kit.id});assert.equal(state.world.specificSpot,place.spot);assert.equal(state.inventory.length,kit.items.length);assert.equal(state.realm,'斗之气·三段');assert.equal(state.soulRealm,'凡境');assert.equal(state.relationships.length,0);assert.equal(state.inventory.some(i=>i.action==='openFireGift'),false);state.inventory[0].qty=99;assert.notEqual(kit.items[0].qty,99);}
});
test('creation names are escaped in all review views; invalid numeric inputs fail validation',()=>{
 const {s,p,el,catalog}=harness();p.name='<img src=x onerror=1>';s.CreationUI.render(0);assert.equal(el('creation-content').innerHTML.includes('value="<img'),false);
 s.CreationUI.render(5);assert.ok(el('creation-content').innerHTML.includes('&lt;img'));p.age=NaN;assert.ok(rules.validate(p,catalog).some(e=>e.message.includes('年龄')));
 p.age=18;p.baseStats.soul=Infinity;assert.ok(rules.validate(p,catalog).some(e=>e.message.includes('基础属性')));
});
test('starting a new life clears previous run state and honors chosen inventory and location',()=>{
 const {s,p}=harness();p.name='新行者';p.startLocation='qingshan';p.starterKit='herbalist';s.CreationUI.attribute('fire');
 s.initGameWorld=()=>{};s.generateOpeningScene=async()=>{};s.QuestSystem.quests=[{id:'old'}];s.QuestSystem.failed=[{}];s.TimeRewind.snapshots=[{}];s.startGame();
 assert.equal(s.WorldState.specificSpot,'青山镇药铺外');assert.equal(p.relationships.length,0);assert.equal(s.QuestSystem.quests.length,0);assert.equal(s.QuestSystem.failed.length,0);assert.equal(s.TimeRewind.snapshots.length,0);assert.equal(p.inventory.some(i=>i.name==='采药札记'),true);assert.equal(p.realm,'斗之气·三段');assert.equal(s.Economy.spiritStones,0);
});
test('offline opening persists the chosen place, kit and session narrator without network calls',async()=>{
 const {s,p}=harness();p.name='行者';p.startLocation='shimo';p.starterKit='training';s.WorldState=rules.initialState(p).world;p.realm='斗之气·三段';p.soulRealm='凡境';p.inventory=rules.initialState(p).inventory;
 const records=[];s.db={chats:{async put(chat){records.push(core.clone(chat));}},tavernSettings:{async put(){}}};s.tavernState.isLoading=false;s.getTavernApi=()=>null;s.renderTavernSessionList=()=>{};s.renderTavernMessages=()=>{};
 s.objects.GameState.phase='game';s.fetch=()=>{throw Error('Network calls must not occur');};await s.generateOpeningScene();const chat=records.at(-1);
 assert.equal(chat.characterCard.name,'斗气大陆');assert.ok(chat.messages.some(m=>m.content.includes('石漠城')));assert.ok(chat.messages[0].content.includes('训练护腕×1'));assert.ok(chat.messages.at(-1).content.includes('风沙沿城墙掠过'));assert.equal(chat.messages.at(-1).content.includes('萧家后院'),false);assert.equal(s.parseGameModeOutput(chat.messages.at(-1).content).option.length,3);
});
test('unfinished creation resumes at its saved step instead of starting an incomplete game',()=>{
 const {s,p,el}=harness();p.name='未完';p.creationStep=2;p.identity='alchemist';p.pointsSpent=0;el('creation-points-value').textContent='70';s.continueGame();assert.equal(s.creationCurrentStep,2);assert.equal(s.objects.GameState.phase,'creation');assert.equal(el('creation-points-value').textContent,'55');
});
test('a delayed opening cannot activate a chat after starting a different creation',async()=>{
 const {s,p}=harness();p.name='旧人生';p.realm='斗之气·三段';p.soulRealm='凡境';p.inventory=[];s.objects.GameState.phase='game';s.tavernState.isLoading=false;
 let release;s.db={chats:{put(){return new Promise(r=>release=r);}}};const pending=s.generateOpeningScene();s.startNewGame();release();await pending;
 assert.equal(s.tavernState.chats.length,0);assert.equal(s.tavernState.activeChatId,null);assert.equal(s.objects.GameState.phase,'creation');
});
test('continue keeps the current life and world together instead of loading an old named player',async()=>{
 const {s,p}=harness();s.objects.GameState.phase='game';p.name='新人生';s.tavernState.isLoading=false;s.db={};s.initGameWorld=()=>{};
 s.WorldState.location='青山镇';s.getSaves=()=>[{timestamp:1,player:{name:'旧人生',race:'human'}}];await s.continueGame();
 assert.equal(s.objects.GameState.player.name,'新人生');assert.equal(s.WorldState.location,'青山镇');
});

test('continue ignores trashed slots and handles a corrupt library without overwriting current data',async()=>{
 const {s,p}=harness();s.objects.GameState.phase='title';p.name='';s.tavernState.isLoading=false;s.db={};s.initGameWorld=()=>{};s.saveToLocalStorage=()=>true;
 let restored;s.restoreGameSnapshot=async save=>{restored=save.id;Object.assign(p,save.player);};s.getSaves=()=>[{id:'trashed',deletedAt:1,timestamp:999,player:{name:'已删除',race:'human'}},{id:'valid',timestamp:100,player:{name:'可继续',race:'human'}}];await s.continueGame();assert.equal(restored,'valid');assert.equal(p.name,'可继续');
 p.name='';restored=null;s.getSaves=()=>{throw Error('corrupt');};await s.continueGame();assert.equal(restored,null);assert.equal(p.name,'');
});
test('novel corrections preserve custom edits, IDs and disabled flags',()=>{
 const canon=require('../assets/js/lore-canon.js');const text=fs.readFileSync(path.join(__dirname,'../assets/js/lore-canon.js'),'utf8');const corrections=JSON.parse(text.match(/const corrections=(\[[\s\S]*?\]);/)[1]);
 const old=corrections.find(c=>c.keys[0]==='天墓');const e={id:'old',keys:old.keys,content:old.content,enabled:false,position:2};const book={name:'斗破苍穹世界观',entries:[e,{...e,id:'edited',content:'我的天墓'}]};
 assert.equal(canon.migrateBook(book),true);assert.match(e.content,/三层/);assert.equal(e.enabled,false);assert.equal(e.position,2);assert.equal(e.id,'old');assert.equal(book.entries[1].content,'我的天墓');assert.equal(canon.migrateBook(book),false);
});
