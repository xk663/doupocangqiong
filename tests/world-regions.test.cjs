const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const data=require('../assets/js/world-data.js'),Nav=require('../assets/js/world-navigation.js'),Core=require('../assets/js/world-core.js'),Places=require('../assets/js/place-scenes.js'),Interactions=require('../assets/js/place-interactions.js'),catalogue=require('../tools/data/world-regions.json');
function context(id){const state=Core.initial(data,id,'region-coverage');return {state,player:{name:'地区覆盖',realm:'斗帝',inventory:[{name:'干粮',qty:100},{name:'水囊',qty:100}],exploration:state},economy:{gold:10000},gameTime:{year:1,month:1,day:1,hour:9,minute:0,totalHours:0},worldState:{location:Core.node(data,Core.rootOf(data,id)).name,specificSpot:Core.node(data,id).name},questSystem:{quests:[],completed:[],failed:[]}};}
test('all 43 public mainland regions have their own scene and at least six public branch places',()=>{
 const roots=data.nodes.filter(Nav.publicLandmark);assert.equal(roots.length,43);assert.equal(data.scenes.length,44);assert.equal(catalogue.regions.length,43);
 const layouts=new Set();for(const n of roots){const scene=data.scenes.find(s=>s.id===n.id);assert.ok(scene,n.id);const children=data.nodes.filter(p=>p.root===n.id&&!p.secret);assert.ok(children.length>=6,n.name);assert.ok(new Set(children.map(p=>p.name)).size===children.length);assert.ok(n.localPosition?.every(Number.isFinite));const authored=catalogue.regions.find(r=>r.id===n.id);layouts.add(JSON.stringify(authored.branches.map(p=>[p.x,p.y])));}
 assert.equal(layouts.size,43);assert.equal(data.nodes.filter(n=>n.root&&catalogue.regions.some(r=>r.id===n.root)).length,262);
});

test('Wutan mainland overview uses its regional map; the city gate uses the original entrance art, including retries',async()=>{
 const city=Places.get('wutan'),gate=Places.get('wutan','wutan');assert.equal(city.name,'乌坦城');assert.equal(city.art,data.scenes.find(s=>s.id==='wutan').art);
 assert.equal(gate.name,'乌坦城门');assert.equal(gate.art,'assets/images/places/wutan-v1.webp');assert.notEqual(gate.art,city.art);
 let requested;await Places.load('wutan',async url=>{requested=url;return {ok:true,headers:{get:()=> 'image/webp'},blob:async()=>({size:1})};},undefined,'wutan');assert.match(requested,/places\/wutan-v1\.webp/);
 assert.equal(Places.get('wutan','world').art,city.art);
});
test('every local branch has distinct artwork and its own interactions; private home keeps facility permissions',()=>{
 const hashes=new Set(),paths=new Set(),pointIds=new Set(),profiles=new Set();assert.equal(Places.entries.length,305);
 for(const p of Places.entries){assert.ok(Core.node(data,p.id),p.id);assert.ok(!paths.has(p.art)||p.artOf,'unreferenced shared artwork: '+p.art);if(p.artOf)assert.equal(p.art,Places.get(p.artOf).art);paths.add(p.art);const bytes=fs.readFileSync(p.art),hash=crypto.createHash('sha256').update(bytes).digest('hex');assert.ok(!hashes.has(hash)||p.artOf,'unreferenced duplicate image: '+p.id);hashes.add(hash);assert.ok(bytes.length<950000,p.id+' asset budget');const scene=Interactions.get(p.id);if(p.id==='wutan-home'){assert.equal(scene,null);continue;}assert.ok(scene&&scene.points.length>=4,p.id);profiles.add(JSON.stringify(scene.points.map(q=>[q.title,q.prompt])));for(const q of scene.points){assert.ok(!pointIds.has(q.id),q.id);pointIds.add(q.id);assert.ok([q.x,q.y].every(v=>Number.isFinite(v)&&v>=0&&v<=100));}}
 assert.equal(hashes.size,304);assert.equal(profiles.size,304);
});
test('new scenes are physically enterable and every public branch is reachable along its own authored paths',()=>{
 for(const region of catalogue.regions){const c=context(region.id),root=Core.node(data,region.id);c.state.scene='world';c.state.pose={sceneId:'world',x:root.x,y:root.y,direction:1};const entered=Core.transition(data,c,{type:'enter-region',targetId:root.id});assert.equal(entered.state.scene,root.id);assert.equal(entered.worldState.location,root.name);assert.equal(Places.resolve(entered.worldState,entered.state).id,root.id);
  for(const p of region.branches.filter(p=>!p.secret)){const before=JSON.stringify(entered),trip=Core.walkPlan(data,entered,root.id,{x:p.x,y:p.y});assert.ok(trip.ok,root.id+'/'+p.id+': '+trip.reason);assert.equal(JSON.stringify(entered),before);const arrived=Core.transition(data,entered,{type:'walk',sceneId:root.id,x:p.x,y:p.y});assert.equal(arrived.state.locationId,p.id);assert.equal(arrived.worldState.location,root.name);assert.equal(Places.resolve(arrived.worldState,arrived.state).id,p.id);}
 }
});
test('existing mainland and town coordinates, resources, quests and visits survive the expanded catalogue',()=>{
 for(const scene of ['world','wutan','qingshan','shimo']){const c=context(scene==='world'?'blackcorner':scene),pose=scene==='world'?{sceneId:'world',x:46.25,y:60.5,direction:3}:Nav.position(data,c.state);c.state.scene=scene;c.state.pose=pose;c.state.vigor=54.3;c.state.discovered=[c.state.locationId];c.state.journal=[{id:'old-record',type:'travel',text:'原有记录',at:120}];const before=JSON.stringify(c),oldVisited=[...c.state.visited],normalized=Core.normalize(data,c.state,c.player,c.worldState);assert.equal(JSON.stringify(c),before);assert.deepEqual(normalized.pose,pose);assert.equal(normalized.vigor,54.3);assert.deepEqual(normalized.visited,oldVisited);assert.deepEqual(normalized.journal,c.state.journal);for(const n of data.nodes.filter(n=>n.secret))assert.ok(!normalized.discovered.includes(n.id),n.id);}
});
test('residence matching rejects a different region, an unknown personal dwelling and undiscovered secret locations',()=>{
 assert.equal(Places.resolve({location:'乌坦城',specificSpot:'圣丹外关'}),null);assert.equal(Places.resolve({location:'圣丹城',specificSpot:'我的私人丹塔'},{locationId:'holy-pill-local-1'}),null);assert.equal(Places.resolve({location:'斗气大陆',specificSpot:'大陆旷野'},{locationId:'holy-pill'}),null);
 const grotto=Places.get('forest-grotto');assert.ok(grotto?.secret);assert.equal(Places.resolve({location:'青山镇',specificSpot:grotto.name},{discovered:[]}),null);assert.equal(Places.resolve({location:'青山镇',specificSpot:grotto.name},{discovered:[grotto.id]}).id,grotto.id);
});
test('public branch intentions remain drafts and never mutate the actual save or claim automatic rewards',()=>{
 for(const region of catalogue.regions)for(const p of region.branches.filter(p=>p.id!=='wutan-home')){const c=context(p.id);c.state.discovered.push(p.id);const before=JSON.stringify(c),profile=Interactions.get(p.id);assert.ok(profile,p.id);for(const q of profile.points){const intent=Interactions.plan({placeId:p.id,id:q.id,world:c.worldState,state:c.state,minutes:q.minutes});assert.ok(intent.includes(q.prompt));assert.match(intent,/不自动交易/);assert.match(intent,/仅为计划，不代表已经过去/);}assert.equal(JSON.stringify(c),before);}
});
