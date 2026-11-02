const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const data=require('../assets/js/world-data.js'),nav=require('../assets/js/world-navigation.js'),core=require('../assets/js/world-core.js');
function fresh(id='wutan-market') {const state=core.initial(data,id,'free-world');return {state,player:{name:'自由行旅测试',gender:'female',realm:'斗之气·三段',inventory:[{name:'干粮',qty:10},{name:'水囊',qty:10}],exploration:state},economy:{gold:100},gameTime:{year:1,month:1,day:1,hour:8,minute:0,totalHours:0},worldState:{location:'乌坦城'},questSystem:{quests:[],completed:[],failed:[]}};}
const roam=(ctx,x,y,mode='walk')=>core.transition(data,ctx,{type:'roam',x,y,mode});
test('all public mainland landmarks appear in old saves without granting visits or restricted clues',()=>{const c=fresh(),old=core.clone(c.state);old.discovered=['wutan','wutan-market'];const n=core.normalize(data,old,c.player,c.worldState);assert.equal(data.nodes.filter(nav.publicLandmark).length,43);for(const p of data.nodes.filter(nav.publicLandmark))assert.ok(n.discovered.includes(p.id),p.id);for(const p of data.nodes.filter(p=>p.secret))assert.ok(!n.discovered.includes(p.id),p.id);assert.deepEqual(n.visited,old.visited);assert.deepEqual(n.pose,old.pose);assert.equal(n.vigor,old.vigor);});
test('mainland travel goes directly to arbitrary coordinates even without any route graph',()=>{const c=fresh(),before=JSON.stringify(c),trip=core.roamPlan({...data,edges:[]},c,{x:30,y:50});assert.ok(trip.ok);assert.equal(trip.points.length,2);assert.deepEqual(trip.points[0],{sceneId:'world',x:24,y:43,direction:0});assert.deepEqual(trip.target,{x:30,y:50});assert.equal(JSON.stringify(c),before);const n=roam(c,30,50);assert.deepEqual([n.state.pose.x,n.state.pose.y],[30,50]);assert.equal(n.state.scene,'world');assert.equal(nav.position(data,n.state).sceneId,'world');assert.deepEqual(core.normalize(data,JSON.parse(JSON.stringify(n.state)),n.player,n.worldState).pose,n.state.pose);assert.match(n.worldState.specificSpot,/大陆旷野/);assert.equal(core.nearbyNpcs(data,n).some(n=>n.available),false);});
test('mainland arrival records the reached landmark and entering streets requires physical proximity',()=>{const c=fresh();assert.throws(()=>core.transition(data,c,{type:'enter-region',targetId:'qingshan'}),/先走到/);const n=roam(c,17,59);assert.equal(n.state.locationId,'qingshan');assert.equal(n.state.scene,'world');assert.ok(n.state.visited.includes('qingshan'));const entered=core.transition(data,n,{type:'enter-region',targetId:'qingshan'});assert.equal(entered.state.scene,'qingshan');assert.equal(nav.position(data,entered.state).sceneId,'qingshan');assert.ok(core.walkPlan(data,entered,'qingshan',{x:55,y:75}).ok);assert.throws(()=>core.transition(data,n,{type:'enter-region',targetId:'zhongzhou'}),/先走到/);});
test('short segments accumulate supply consumption instead of bypassing long-distance costs',()=>{const c=fresh();c.state.roamMinutes=830;const once=roam(c,25,43),split=roam(roam(c,24.5,43),25,43);assert.equal(core.inventoryCount(once,'水囊'),9);assert.equal(core.inventoryCount(split,'水囊'),9);assert.equal(split.state.roamMinutes,once.state.roamMinutes);assert.equal(split.gameTime.totalHours,once.gameTime.totalHours);const dry=fresh();dry.player.inventory=[];dry.state.roamMinutes=830;assert.throws(()=>roam(dry,25,43),/水囊不足/);});
test('continuous keyboard movement limits its target to affordable distance and never overspends',()=>{const c=fresh();c.state.vigor=.2;c.player.inventory=[];const p=core.roamPlan(data,c,{x:100,y:43},'walk',true);assert.ok(p.ok&&p.limited);assert.ok(p.length<1&&p.length>=.15);const next=roam(c,p.target.x,p.target.y);assert.ok(next.state.vigor>=0);assert.equal(next.economy.gold,c.economy.gold);assert.equal(core.roamPlan(data,{...c,state:{...c.state,vigor:0}},{x:100,y:43},'walk',true).ok,false);});
test('free movement rejects invalid targets and preserves flight and special-space requirements',()=>{const c=fresh(),before=JSON.stringify(c);for(const target of [{x:NaN,y:20},{x:-1,y:50},{x:50,y:101}])assert.equal(core.roamPlan(data,c,target).ok,false);assert.equal(core.roamPlan(data,c,{x:25,y:43},'flight').ok,false);assert.equal(core.roamPlan(data,c,{x:25,y:43},'__proto__').ok,false);const far=roam(c,59,3);assert.ok(!far.state.discovered.includes('soul-realm'));assert.ok(!far.state.visited.includes('soul-realm'));assert.equal(JSON.stringify(c),before);});
test('stopping in the wilderness cannot interact with the city left behind or expose its secret entrances',()=>{const c=fresh('tianxing'),n=roam(c,30,50);assert.match(n.worldState.specificSpot,/大陆旷野/);assert.equal(core.nearbyNpcs(data,n).some(p=>p.available),false);const explored=core.transition(data,n,{type:'explore'});assert.ok(!explored.state.discovered.includes('star-realm'));assert.match(explored.message,/当前旷野/);const rested=core.transition(data,n,{type:'rest'});assert.match(rested.message,/大陆旷野/);assert.deepEqual(rested.state.pose,n.state.pose);});
test('a rejected or stale mainland movement cannot change coordinates, supplies or the newer save',()=>{let c=fresh(),fail=false;const sandbox={WorldCore:core,DoupoWorldData:data,console};vm.createContext(sandbox);vm.runInContext(fs.readFileSync('assets/js/world-bridge.js','utf8'),sandbox);const b=sandbox.WorldMapBridge;b.configure({read:()=>c,commit(next){if(fail)throw Error('quota');c=next;},isBusy:()=>false,toast(){}});const before=JSON.stringify(c),first=b.beginMovement();fail=true;assert.equal(b.finishMovement(first,{type:'roam',x:30,y:50}),null);assert.equal(JSON.stringify(c),before);fail=false;const second=b.beginMovement();c.player.name='已恢复的存档';assert.equal(b.finishMovement(second,{type:'roam',x:30,y:50}),null);assert.equal(c.player.name,'已恢复的存档');assert.equal(c.state.pose.sceneId,'wutan');assert.equal(c.state.vigor,100);});

function keyboard(){const listeners={},requests=[],host={addEventListener:(key,fn)=>listeners[key]=fn,removeEventListener(){}};const sandbox={DoupoWorldData:data,WorldNavigation:nav,matchMedia:()=>({matches:false}),document:{addEventListener(){},removeEventListener(){},hidden:false}};vm.createContext(sandbox);vm.runInContext(fs.readFileSync('assets/js/world-renderer.js','utf8')+';this.Renderer=WorldRenderer;',sandbox);const r=new sandbox.Renderer(host,()=>{},p=>requests.push(p));let stops=0;r.onStop=()=>stops++;r.model={scene:{id:'world'},pose:{x:50,y:50}};r.installInput();function event(type,key,extra={}){listeners[type]({key,target:host,preventDefault(){},...extra});}return {r,event,requests,get stops(){return stops;}};}
test('WASD and arrow keys drive the correct cardinal direction and release stops the movement',()=>{for(const [key,x,y] of [['a',0,50],['D',100,50],['w',50,0],['s',50,100],['ArrowLeft',0,50],['ArrowRight',100,50],['ArrowUp',50,0],['ArrowDown',50,100]]){const s=keyboard();s.event('keydown',key);assert.deepEqual(JSON.parse(JSON.stringify(s.requests[0])),{x,y,input:'keyboard'});s.event('keydown',key);assert.equal(s.requests.length,1);s.event('keyup',key);assert.equal(s.stops,1);assert.equal(s.r.heldKeys.size,0);}});
test('diagonal input and direction changes update the target; blur clears held controls',()=>{const s=keyboard();s.event('keydown','d');s.event('keydown','w');assert.deepEqual([s.requests.at(-1).x,s.requests.at(-1).y],[100,0]);s.event('keyup','d');assert.deepEqual([s.requests.at(-1).x,s.requests.at(-1).y],[50,0]);s.event('blur','');assert.equal(s.stops,1);assert.equal(s.r.heldKeys.size,0);s.event('keydown','a',{ctrlKey:true});assert.equal(s.requests.length,3);});

async function ui(c=fresh(),places){let commits=0,partial=false;const elements=new Map(),models=[];function element(){return {value:'',innerHTML:'',hidden:false,disabled:false,style:{},classList:{add(){},toggle(){}},addEventListener(){},setAttribute(name,value){this[name]=value;},focus(){},querySelector(s){if(!elements.has(s))elements.set(s,element());return elements.get(s);}};}
 const host=element();host.isConnected=true;const s={PlaceScenes:places,WorldCore:core,WorldNavigation:nav,DoupoWorldData:data,matchMedia:()=>({matches:false}),PIXI:{},WorldActor:class {},WorldRenderer:class {constructor() {this.actorReady=true;}async init(){return this;}setMotion(){}focus(){}render(m){models.push(m);return Promise.resolve(true);}animatePath(points){return Promise.resolve(partial?{completed:false,position:{x:(points[0].x+points[1].x)/2,y:(points[0].y+points[1].y)/2}}:{completed:true,position:points.at(-1)});}},document:{createElement:element,head:{append(){}}}};
 vm.createContext(s);vm.runInContext(fs.readFileSync('assets/js/world-bridge.js','utf8'),s);s.WorldMapBridge.configure({read:()=>c,commit(n){commits++;c=n;},isBusy:()=>false,toast(){}});vm.runInContext(fs.readFileSync('assets/js/world-ui.js','utf8'),s);const view=await s.WorldMapUI.mount(host);view.action('scene',{id:'world'});await view.renderPromise;return {view,models,host,get c(){return c;},get commits(){return commits;},set partial(v){partial=v;}};}
test('the actual map UI sends arbitrary mainland points through free movement, not route snapping',async()=>{const s=await ui();await s.view.move({point:{x:30,y:50},sceneId:'world'});assert.deepEqual([s.c.state.pose.x,s.c.state.pose.y],[30,50]);assert.equal(s.commits,1);assert.equal(s.models.at(-1).routes.length,0);assert.equal(s.models.at(-1).pose.sceneId,'world');});
test('clicking distant ground reaches the whole destination while resource costs are paused',async()=>{
 const c=fresh('beast-mountains');c.player.inventory=[{name:'干粮',qty:3},{name:'水囊',qty:1}];c.economy.gold=5;c.state.vigor=92;c.state.movementMode='convoy';
 const target={x:90,y:5},full=core.roamPlan(data,c,target,'convoy');assert.equal(full.ok,false);assert.match(full.reason,/水囊不足/);
 const s=await ui(c);await s.view.move({point:target,sceneId:'world'});
 assert.equal(s.commits,1);assert.deepEqual([s.c.state.pose.x,s.c.state.pose.y],[target.x,target.y]);
 assert.equal(s.c.economy.gold,5);assert.deepEqual(s.c.player.inventory,c.player.inventory);assert.equal(s.c.state.vigor,92);
 assert.doesNotMatch(s.host.querySelector('.world-status').textContent,/不足|补充/);
});
test('a mainland landmark remains reachable with nearly empty stamina and no supplies',async()=>{
 const c=fresh('beast-mountains');c.state.vigor=.2;c.player.inventory=[];const s=await ui(c);
 await s.view.move({nodeId:'holy-pill'});assert.equal(s.commits,1);assert.ok(s.c.state.visited.includes('holy-pill'));assert.equal(s.c.state.locationId,'holy-pill');assert.equal(s.c.state.vigor,.2);assert.deepEqual(s.c.player.inventory,[]);assert.match(s.host.querySelector('.world-detail').innerHTML,/进入圣丹城/);
});
test('zero stamina does not block movement and retired resource controls are absent',async()=>{
 const c=fresh();c.state.vigor=0;const s=await ui(c),before=JSON.stringify(s.c);await s.view.move({point:{x:60,y:50},sceneId:'world'});
 assert.equal(s.commits,1);assert.notEqual(JSON.stringify(s.c),before);assert.deepEqual([s.c.state.pose.x,s.c.state.pose.y],[60,50]);assert.equal(s.c.state.vigor,0);
 assert.doesNotMatch(s.host.innerHTML,/world-supplies|原地休整|行旅怎么消耗/);assert.doesNotMatch(s.host.querySelector('.world-detail').innerHTML,/data-map-action="(?:rest|explore)"|干粮 −|水囊 −|精力 −|体力 −/);
});
test('a stopped mainland animation saves only its actual position and region lookup never moves or focuses the player',async()=>{const s=await ui(),before=JSON.stringify(s.c);let focus=0;s.host.querySelector('.world-canvas').focus=()=>focus++;s.view.action('region',{id:'zhongzhou'});await s.view.renderPromise;assert.equal(s.commits,0);assert.equal(JSON.stringify(s.c),before);assert.equal(focus,0);assert.match(s.host.querySelector('.world-scenes').innerHTML,/黑角域/);assert.match(s.host.querySelector('.world-scenes').innerHTML,/中州/);s.partial=true;await s.view.move({point:{x:30,y:50},sceneId:'world'});assert.deepEqual([s.c.state.pose.x,s.c.state.pose.y],[27,46.5]);assert.equal(s.commits,1);});

test('previewing an unvisited region and selecting its branches never moves the actual player or spends resources',async()=>{const s=await ui(),before=JSON.stringify(s.c);s.view.action('scene',{id:'blackcorner'});await s.view.renderPromise;assert.equal(s.models.at(-1).pose,null);assert.equal(s.models.at(-1).scene.id,'blackcorner');s.view.selectPoint('blackcorner-local-3');await s.view.renderPromise;assert.equal(s.view.selected,'blackcorner-local-3');assert.equal(s.commits,0);assert.equal(JSON.stringify(s.c),before);assert.match(s.host.querySelector('.world-detail').innerHTML,/荒坡集营/);assert.ok((s.host.querySelector('.world-scenes').innerHTML.match(/data-map-action="scene"/g)||[]).length<=6);await s.view.move({point:{x:45,y:50},sceneId:'blackcorner'});assert.equal(s.commits,0);assert.equal(JSON.stringify(s.c),before);});

test('narrow-screen sheet controls move only the viewport, without advancing the game or spending resources',async()=>{const s=await ui(),before=JSON.stringify(s.c),scrolls=[];s.host.clientWidth=390;s.host.querySelector('.world-stage').scrollBy=value=>scrolls.push(value);s.view.action('sheet-right',{});s.view.action('sheet-left',{});assert.deepEqual(scrolls.map(x=>x.left),[312,-312]);assert.equal(s.commits,0);assert.equal(JSON.stringify(s.c),before);});

test('map navigation contains only the mainland button and the 43 actual destination options',async()=>{
 const s=await ui(),html=s.host.querySelector('.world-scenes').innerHTML;
 assert.equal((html.match(/<button /g)||[]).length,1);assert.match(html,/data-id="world"/);
 assert.equal((html.match(/<option /g)||[]).length,43);assert.doesNotMatch(html,/更多大陆地点|<option value=""/);
 assert.match(html,/<option value="wutan" selected>/);
});
test('all 43 destinations change from walk to enter after arrival and entering actually switches to their own map',async()=>{
 for(const n of data.nodes.filter(nav.publicLandmark)){
  const c=fresh(n.id);c.state.scene='world';c.state.pose={sceneId:'world',x:n.x-8,y:n.y,direction:1};const s=await ui(c);
  assert.match(s.host.querySelector('.world-detail').innerHTML,/data-map-action="travel"/);assert.doesNotMatch(s.host.querySelector('.world-detail').innerHTML,/data-map-action="enter-region"/);
  await s.view.move({nodeId:n.id});assert.equal(s.c.state.locationId,n.id);assert.equal(s.c.state.scene,'world');assert.match(s.host.querySelector('.world-detail').innerHTML,new RegExp('进入'+n.name));
  assert.doesNotMatch(s.host.querySelector('.world-detail').innerHTML,/data-map-action="travel"/);
  s.view.action('enter-region',{id:n.id});await s.view.renderPromise;
  assert.equal(s.c.state.scene,n.id);assert.equal(s.view.scene,n.id);assert.equal(s.models.at(-1).scene.id,n.id);assert.equal(s.models.at(-1).scene.art,data.scenes.find(p=>p.id===n.id).art);
 }
});
test('returning to the streets already occupied by the player only changes the viewed map',async()=>{
 const s=await ui(),before=JSON.stringify(s.c);s.view.action('enter-region',{id:'wutan'});await s.view.renderPromise;
 assert.equal(s.view.scene,'wutan');assert.equal(s.commits,0);assert.equal(JSON.stringify(s.c),before);
});
test('Wutan city retains its mainland identity while the local entrance is named and positioned as the city gate',async()=>{
 const s=await ui();s.view.action('scene',{id:'wutan'});await s.view.renderPromise;
 const entrance=s.models.at(-1).nodes.find(n=>n.id==='wutan');assert.equal(entrance.name,'乌坦城门');assert.deepEqual([entrance.x,entrance.y],[50,73]);assert.equal(core.node(data,'wutan').name,'乌坦城');
 s.view.action('scene',{id:'world'});await s.view.renderPromise;assert.equal(s.models.at(-1).nodes.find(n=>n.id==='wutan').name,'乌坦城');
});

test('clicking the Wutan city marker walks to the real place and displays its map and exit action',async()=>{
 const Places=require('../assets/js/place-scenes.js'),s=await ui(fresh(),{get:Places.get,url:Places.url,statusHTML:Places.statusHTML});s.view.action('scene',{id:'wutan'});await s.view.renderPromise;
 const nodes=s.models.at(-1).nodes,city=nodes.find(n=>n.id==='wutan-overview');assert.equal(city.name,'乌坦城');assert.deepEqual([city.x,city.y],[44,79]);assert.equal(city.artOf,'wutan');assert.ok(core.node(data,city.id));
 assert.ok(nodes.some(n=>n.id==='wutan'&&n.name==='乌坦城门'));assert.ok(nodes.some(n=>n.id==='wutan-gate'&&n.name==='城门驿道'));
 await s.view.selectPoint(city.id);await s.view.renderPromise;
 assert.equal(s.commits,1);assert.equal(s.c.state.locationId,city.id);assert.deepEqual([s.c.state.pose.x,s.c.state.pose.y],[44,79]);assert.ok(s.c.state.visited.includes(city.id));
 const html=s.host.querySelector('.world-detail').innerHTML;assert.match(html,/assets\/images\/world\/world-wutan\.webp/);assert.match(html,/离开乌坦城/);assert.doesNotMatch(html,/places\/wutan-v1\.webp/);
 assert.equal(Places.resolve(s.c.worldState,s.c.state).id,city.id);
});
test('all regional name locations offer an exit which returns both the actor and the view to the mainland',async()=>{
 for(const region of data.nodes.filter(nav.publicLandmark)){
  const s=await ui(fresh(region.id));s.view.action('scene',{id:region.id});await s.view.renderPromise;
  if(region.id==='wutan')await s.view.selectPoint('wutan-overview');
  assert.match(s.host.querySelector('.world-detail').innerHTML,new RegExp('离开'+region.name));
  const resources=JSON.stringify([s.c.player.inventory,s.c.economy,s.c.state.vigor,s.c.gameTime]);
  s.view.action('leave-region',{id:region.id});await s.view.renderPromise;
  assert.equal(s.c.state.scene,'world');assert.equal(s.c.state.locationId,region.id);assert.deepEqual([s.c.state.pose.x,s.c.state.pose.y],[region.x,region.y]);assert.equal(s.view.scene,'world');assert.equal(s.models.at(-1).scene.id,'world');
  assert.equal(JSON.stringify([s.c.player.inventory,s.c.economy,s.c.state.vigor,s.c.gameTime]),resources);assert.match(s.host.querySelector('.world-detail').innerHTML,new RegExp('进入'+region.name));
  s.view.action('enter-region',{id:region.id});await s.view.renderPromise;assert.equal(s.c.state.scene,region.id);assert.equal(s.view.scene,region.id);
 }
});
test('leaving a different region cannot teleport the player or change the save',()=>{
 const c=fresh('qingshan'),before=JSON.stringify(c);assert.throws(()=>core.transition(data,c,{type:'leave-region',targetId:'wutan'}),/当前所在/);assert.equal(JSON.stringify(c),before);
});
test('every map merchant retains conversation and quests but no longer offers buying or selling',async()=>{
 for(const npc of data.npcs.filter(n=>n.shop)){
  const s=await ui(fresh(npc.day));s.view.action('scene',{id:npc.scene});await s.view.renderPromise;
  assert.doesNotMatch(s.host.querySelector('.world-detail').innerHTML,/world-shop|购入|售出|行旅补给|data-map-action="(?:buy|sell)"/);
  assert.match(s.host.querySelector('.world-detail').innerHTML,/自由交谈/);const before=JSON.stringify(s.c);s.view.action('buy',{npc:npc.id,item:'food'});s.view.action('sell',{npc:npc.id,item:'herb'});assert.equal(s.commits,0);assert.equal(JSON.stringify(s.c),before);
 }
});
