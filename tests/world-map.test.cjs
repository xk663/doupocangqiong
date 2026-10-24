const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const data=require('../assets/js/world-data.js'),core=require('../assets/js/world-core.js');
function fresh(id='wutan'){const state=core.initial(data,id,'regression');if(id==='wutan')state.pose={sceneId:'wutan',x:48,y:50,direction:0};return {state,player:{name:'旅人',realm:'斗之气·三段',inventory:[{name:'干粮',qty:10},{name:'水囊',qty:10},{name:'低阶药材',qty:3}],exploration:state},economy:{gold:100},gameTime:{era:'斗气历',year:1,month:1,day:1,hour:8,minute:0,totalHours:0},worldState:{location:'乌坦城'},questSystem:{quests:[{id:'custom'}],completed:[],failed:[]}};}
const step=(c,type,extra={})=>core.transition(data,c,{type,...extra});
function approach(c,npcId){const npc=core.nearbyNpcs(data,c).find(n=>n.id===npcId),n=core.node(data,npc.locationId);return step(c,'walk',{sceneId:npc.scene,x:n.x,y:n.y});}
test('catalogue: unique IDs, valid routes, connected playable nodes and real local assets',()=>{
 assert.equal(data.nodes.length,79);assert.equal(new Set(data.nodes.map(n=>n.id)).size,79);assert.equal(data.scenes.length,4);
 let reachable=new Set(['wutan']);for(let i=0;i<data.nodes.length;i++)for(const e of data.edges){assert.ok(core.node(data,e.a));assert.ok(core.node(data,e.b));assert.ok(e.hours>0&&e.gold>=0);if(reachable.has(e.a)||reachable.has(e.b)){reachable.add(e.a);reachable.add(e.b);}}
 for(const n of data.nodes){assert.ok(n.x>=0&&n.x<=100&&n.y>=0&&n.y<=100);assert.ok(n.lateOnly||reachable.has(n.id),n.id);if(n.sourceType==='novel-evidence')assert.ok(n.sources.length);}
 for(const scene of data.scenes)assert.ok(fs.statSync(require('path').join(__dirname,'..',scene.art)).size>10000);
 assert.equal(JSON.stringify(data),JSON.stringify(require('../assets/data/world.json')));
});
test('travel preview is pure and walking updates time, resources and saved location together',()=>{
 const c=fresh(),before=JSON.stringify(c),p=core.plan(data,c,'qingshan');assert.ok(p.ok);assert.equal(JSON.stringify(c),before);
 const next=step(c,'travel',{targetId:'qingshan'});assert.equal(c.state.locationId,'wutan');assert.equal(next.state.locationId,'qingshan');assert.equal(next.gameTime.hour,14);assert.equal(next.state.scene,'qingshan');assert.ok(next.state.vigor<100);assert.equal(next.player.exploration.locationId,'qingshan');assert.match(next.player.location,/青山镇/);
});
test('unaffordable, unknown and gated travel is rejected without changing input',()=>{
 const c=fresh(),before=JSON.stringify(c);assert.equal(core.plan(data,c,'lotus-cave').ok,false);assert.throws(()=>step(c,'travel',{targetId:'lotus-cave'}),/线索/);assert.equal(core.plan(data,c,'qingshan','flight').ok,false);c.economy.gold=0;assert.equal(core.plan(data,c,'blackrock').ok,false);assert.throws(()=>step(c,'travel',{targetId:'blackrock'}),/金币/);c.economy.gold=100;assert.equal(JSON.stringify(c),before);
});
test('flight unlocks at Dou Wang while portal costs are retained',()=>{
 const c=fresh();c.player.realm='斗王·一星';const walk=core.plan(data,c,'qingshan'),flight=core.plan(data,c,'qingshan','flight');assert.ok(flight.ok);assert.ok(flight.hours<walk.hours);assert.equal(core.rank('大斗师·一星'),3);assert.equal(core.rank('斗帝'),11);
});
test('long trips require actual food and water; failed consumption is atomic',()=>{
 const c=fresh();c.player.inventory=[];const p=core.plan(data,c,'shimo');assert.equal(p.ok,false);assert.ok(p.food>0&&p.water>0);assert.match(p.reason,/干粮|水囊/);assert.throws(()=>step(c,'travel',{targetId:'shimo'}));assert.equal(c.state.locationId,'wutan');
});
test('24-hour time crosses midnight, month and year without a 12-hour day',()=>{
 const c=fresh();Object.assign(c.gameTime,{year:1,month:12,day:30,hour:23,minute:30});core.advance(c,2);assert.deepEqual([c.gameTime.year,c.gameTime.month,c.gameTime.day,c.gameTime.hour,c.gameTime.minute],[2,1,1,1,30]);assert.equal(c.state.minutes,120);
});
test('exploration reveals clues, has cooldown and cannot repeatedly mint gathering rewards',()=>{
 let c=fresh('qingshan');assert.equal(c.state.discovered.includes('forest-grotto'),false);c=step(c,'travel',{targetId:'forest-trail'});c=step(c,'explore');assert.ok(c.state.discovered.includes('forest-grotto'));const count=core.inventoryCount(c,'低阶药材');assert.equal(count,5);assert.throws(()=>step(c,'explore'),/间隔/);c=step(c,'rest');c=step(c,'explore');assert.equal(core.inventoryCount(c,'低阶药材'),count);
});
test('original NPC schedules change between day and night and require proximity',()=>{
 let c=fresh();let npc=core.nearbyNpcs(data,c).find(n=>n.id==='su-merchant');assert.equal(npc.locationId,'wutan-market');c=step(c,'travel',{targetId:'wutan-market'});c.gameTime.hour=22;npc=core.nearbyNpcs(data,c).find(n=>n.id==='su-merchant');assert.equal(npc.locationId,'wutan-inn');assert.equal(npc.available,false);assert.throws(()=>step(c,'talk',{npcId:npc.id}),/到达/);
});
test('trade uses whitelisted items, bounded quantities and exact real currency changes',()=>{
 const c=fresh(),next=step(c,'buy',{npcId:'su-merchant',itemId:'food',qty:2});assert.equal(next.economy.gold,96);assert.equal(core.inventoryCount(next,'干粮'),12);assert.equal(core.inventoryCount(c,'干粮'),10);assert.throws(()=>step(c,'buy',{npcId:'su-merchant',itemId:'food',qty:-1}),/数量/);assert.throws(()=>step(c,'buy',{npcId:'su-merchant',itemId:'emperor',qty:1}),/数量/);const sold=step(c,'sell',{npcId:'su-merchant',itemId:'herbs',qty:2});assert.equal(sold.economy.gold,104);assert.equal(core.inventoryCount(sold,'低阶药材'),1);
});
test('a quest is accepted and completed once; map quests preserve unrelated tasks',()=>{
 let c=step(fresh(),'accept',{npcId:'su-merchant'});assert.ok(c.questSystem.quests.some(q=>q.id==='custom'));assert.throws(()=>step(c,'accept',{npcId:'su-merchant'}),/重复/);c=step(c,'complete',{npcId:'su-merchant'});assert.equal(c.economy.gold,112);assert.equal(core.inventoryCount(c,'低阶药材'),0);assert.equal(c.state.quests[0].status,'completed');assert.equal(c.questSystem.completed.length,1);assert.throws(()=>step(c,'complete',{npcId:'su-merchant'}),/没有/);
});
test('road quests require visiting the destination and returning to the giver',()=>{
 let c=step(approach(fresh(),'lin-guard'),'accept',{npcId:'lin-guard'});assert.throws(()=>step(c,'complete',{npcId:'lin-guard'}),/尚未到访/);c=step(c,'travel',{targetId:'qingshan'});assert.throws(()=>step(c,'complete',{npcId:'lin-guard'}),/到达/);c=step(c,'travel',{targetId:'wutan'});c=approach(c,'lin-guard');c=step(c,'complete',{npcId:'lin-guard'});assert.equal(c.economy.gold,108);
});
test('deterministic road event and save round-trip preserve progress',()=>{
 const c=fresh(),a=step(c,'travel',{targetId:'qingshan'}),b=step(c,'travel',{targetId:'qingshan'});assert.deepEqual(a,b);const saved=JSON.parse(JSON.stringify(a));assert.deepEqual(core.normalize(data,saved.state,saved.player,saved.worldState),a.state);assert.throws(()=>core.normalize(data,{...a.state,version:99},a.player,a.worldState),/版本/);
});
test('prompt context contains known facts and omits undiscovered secrets',()=>{
 const text=core.promptContext(data,fresh());assert.match(text,/地图已确认事实/);assert.match(text,/乌坦城/);assert.match(text,/苏掌柜/);assert.ok(!text.includes(core.node(data,'soul-realm').name));assert.match(text,/不可自动更改地图状态/);
});
test('LLM proposals are inert and cannot grant goods or visit unknown locations',()=>{
 const c=fresh(),before=JSON.stringify(c);assert.deepEqual(core.proposal(data,c,'<world_action>{"type":"travel","targetId":"qingshan","gold":99999}</world_action>'),{type:'travel',targetId:'qingshan',mode:'walk'});assert.equal(core.proposal(data,c,'<world_action>{"type":"buy","itemId":"food"}</world_action>'),null);assert.equal(core.proposal(data,c,'<world_action>{"type":"travel","targetId":"soul-realm"}</world_action>'),null);assert.equal(JSON.stringify(c),before);
});
function bridge(custom=true){let current=fresh(),busy=false,fail=false;const notices=[];const s={WorldCore:core,DoupoWorldData:data,Set,console};if(custom){vm.createContext(s);vm.runInContext(fs.readFileSync(require('path').join(__dirname,'../assets/js/world-bridge.js'),'utf8'),s);s.WorldMapBridge.configure({read:()=>current,isBusy:()=>busy,commit(next){if(fail)throw Error('quota');current=next;},toast:m=>notices.push(m)});}return {s,get current(){return current;},set busy(v){busy=v;},set fail(v){fail=v;},notices};}
test('bridge blocks map mutation during an LLM turn and retains state after save failure',()=>{
 const b=bridge();b.busy=true;assert.equal(b.s.WorldMapBridge.execute({type:'travel',targetId:'qingshan'}),null);assert.equal(b.current.state.locationId,'wutan');b.busy=false;b.fail=true;assert.equal(b.s.WorldMapBridge.execute({type:'travel',targetId:'qingshan'}),null);assert.equal(b.current.state.locationId,'wutan');b.fail=false;assert.ok(b.s.WorldMapBridge.execute({type:'travel',targetId:'qingshan'}));assert.equal(b.current.state.locationId,'qingshan');
});
test('all map scripts parse and Tiled anchors match the runtime positions',()=>{
 for(const file of ['world-core','world-bridge','world-ui','world-renderer','world-standalone'])new vm.Script(fs.readFileSync(require('path').join(__dirname,'../assets/js/'+file+'.js'),'utf8'));
 for(const scene of data.scenes){const map=JSON.parse(fs.readFileSync(require('path').join(__dirname,'../maps/authoring/'+scene.id+'.tmj'),'utf8'));for(const obj of map.layers[1].objects){const props=Object.fromEntries(obj.properties.map(p=>[p.name,p.value]));const n=core.node(data,props.worldId),pos=n.id===scene.id?n.localPosition:[n.x,n.y];assert.ok(Math.abs(obj.x-pos[0]*data.worldWidth/100)<.001);assert.ok(Math.abs(obj.y-pos[1]*data.worldHeight/100)<.001);}}
});
