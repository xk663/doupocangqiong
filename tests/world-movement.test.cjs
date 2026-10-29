const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const data=require('../assets/js/world-data.js'),nav=require('../assets/js/world-navigation.js'),core=require('../assets/js/world-core.js');
function fresh(){const state=core.initial(data,'wutan','movement-test');return {state,player:{name:'自定义玩家',gender:'male',realm:'斗之气·三段',inventory:[],exploration:state},economy:{gold:40},gameTime:{year:1,month:1,day:1,hour:8,minute:0,totalHours:0},worldState:{location:'乌坦城'},questSystem:{quests:[],completed:[],failed:[]}};}
test('gender chooses Xiao Yan or Xun Er without renaming the player',()=>{
 assert.equal(nav.avatar('male').id,'xiaoyan');assert.equal(nav.avatar('female').id,'xuner');assert.equal(nav.avatar('女').id,'xuner');assert.equal(nav.avatar('futa').id,'xiaoyan');const c=fresh();nav.avatar(c.player.gender);assert.equal(c.player.name,'自定义玩家');
 for(const gender of ['male','female']){const info=require('./webp-info.cjs')(fs.readFileSync(require('path').join(__dirname,'..',nav.avatar(gender).image)));assert.equal(info.width,1536);assert.equal(info.height,1024);assert.equal(info.alpha,true);}
});
test('local roads connect every authored anchor and reject remote scene and terrain clicks',()=>{
 for(const sceneId of Object.keys(nav.roads)){const start=nav.position(data,core.initial(data,sceneId));for(const n of data.nodes.filter(n=>n.scene===sceneId)){const route=nav.route(data,sceneId,start,n);assert.ok(route.ok,sceneId+': '+n.id);assert.ok(route.points.every(p=>p.x>=0&&p.y>=0&&p.x<=100&&p.y<=100));}}
 const c=fresh();assert.equal(core.walkPlan(data,c,'shimo',{x:43,y:69}).ok,false);assert.equal(core.walkPlan(data,c,'wutan',{x:99,y:1}).ok,false);assert.equal(core.walkPlan(data,c,'wutan',{x:Infinity,y:50}).ok,false);
});
test('walking follows the road and atomically saves a fractional position and computed costs',()=>{
 const c=fresh(),before=JSON.stringify(c),trip=core.walkPlan(data,c,'wutan',{x:48,y:50});assert.ok(trip.ok);assert.ok(trip.points.length>2);assert.equal(JSON.stringify(c),before);
 const next=core.transition(data,c,{type:'walk',sceneId:'wutan',x:48,y:50,hours:0,energy:0});assert.equal(next.state.locationId,'wutan-market');assert.deepEqual([next.state.pose.x,next.state.pose.y],[48,50]);assert.ok(next.state.vigor<100);assert.ok(next.gameTime.totalHours>0);assert.equal(next.player.name,c.player.name);assert.equal(next.economy.gold,40);assert.equal(c.state.locationId,'wutan');
 assert.deepEqual(core.normalize(data,next.state,next.player,next.worldState).pose,next.state.pose);
});
test('NPCs become available only when the walking character is physically near them',()=>{
 const c=fresh();assert.equal(core.nearbyNpcs(data,c).find(n=>n.id==='su-merchant').available,false);assert.throws(()=>core.transition(data,c,{type:'buy',npcId:'su-merchant',itemId:'food',qty:1}),/先到达/);
 const next=core.transition(data,c,{type:'walk',sceneId:'wutan',x:48,y:50});assert.equal(core.nearbyNpcs(data,next).find(n=>n.id==='su-merchant').available,true);assert.equal(core.nearbyNpcs(data,next).find(n=>n.id==='lin-guard').available,false);
});
test('sampled movement stays on path, faces the walking direction and can stop between landmarks',()=>{
 const c=fresh(),trip=core.walkPlan(data,c,'wutan',{x:48,y:50}),partial=nav.sample(trip.points,.4);assert.ok(partial.y<90&&partial.y>50);assert.equal(partial.direction,2);assert.deepEqual(nav.sample([{x:0,y:0},{x:10,y:0}],.5),{x:5,y:0,direction:1});
 const next=core.transition(data,c,{type:'walk',sceneId:'wutan',x:partial.x,y:partial.y});assert.ok(Math.abs(next.state.pose.y-partial.y)<.01);assert.ok(next.state.vigor>100-trip.energy);assert.ok(next.gameTime.totalHours<trip.hours);
});
test('old saves obtain a valid pose and corrupt positions cannot teleport the character',()=>{
 const c=fresh(),old=core.clone(c.state);delete old.pose;assert.deepEqual(core.normalize(data,old,c.player,c.worldState).pose,{sceneId:'wutan',x:50,y:90,direction:0});old.pose={sceneId:'shimo',x:90,y:90};assert.equal(core.normalize(data,old,c.player,c.worldState).pose.sceneId,'wutan');old.pose={sceneId:'wutan',x:99,y:1};assert.equal(core.normalize(data,old,c.player,c.worldState).pose.x,50);
});
function bridge(){let current=fresh(),failed=false;const s={WorldCore:core,DoupoWorldData:data,Set,console};vm.createContext(s);vm.runInContext(fs.readFileSync(require('path').join(__dirname,'../assets/js/world-bridge.js'),'utf8'),s);s.WorldMapBridge.configure({read:()=>current,isBusy:()=>false,commit(next){if(failed)throw Error('quota');current=next;},toast(){}});return {b:s.WorldMapBridge,get current(){return current;},set failed(v){failed=v;}};}
test('movement lease prevents overlapping actions and commits once on arrival',()=>{
 const {b}=bridge();const token=b.beginMovement();assert.ok(token);assert.equal(b.isMoving(),true);assert.equal(b.beginMovement(),null);assert.equal(b.execute({type:'rest'}),null);assert.ok(b.finishMovement(token,{type:'walk',sceneId:'wutan',x:48,y:50}));assert.equal(b.isMoving(),false);assert.equal(b.finishMovement(token,{type:'rest'}),null);
});
test('a stale animation cannot overwrite a restored or edited save',()=>{
 const t=bridge(),token=t.b.beginMovement();t.current.player.name='恢复后的角色';assert.equal(t.b.finishMovement(token,{type:'walk',sceneId:'wutan',x:48,y:50}),null);assert.equal(t.current.state.locationId,'wutan');assert.equal(t.current.player.name,'恢复后的角色');assert.equal(t.b.isMoving(),false);
});
test('cancel and quota failure leave no phantom arrival or duplicate movement charge',()=>{
 const t=bridge(),before=JSON.stringify(t.current),token=t.b.beginMovement();assert.equal(t.b.finishMovement(token,null),null);assert.equal(JSON.stringify(t.current),before);const second=t.b.beginMovement();t.failed=true;assert.equal(t.b.finishMovement(second,{type:'walk',sceneId:'wutan',x:48,y:50}),null);assert.equal(JSON.stringify(t.current),before);assert.equal(t.b.isMoving(),false);
});

test('a tired character between landmarks can camp without paying for an unreachable inn',()=>{
 const c=fresh();c.state.pose={sceneId:'wutan',x:50,y:79,direction:2};c.state.vigor=0;c.economy.gold=0;const next=core.transition(data,c,{type:'rest'});assert.equal(next.economy.gold,0);assert.equal(next.state.vigor,40);assert.equal(next.gameTime.totalHours,8);
});

test('explicitly cancelling movement invalidates its late arrival callback',()=>{
 const t=bridge(),token=t.b.beginMovement();t.b.cancelMovement();assert.equal(t.b.finishMovement(token,{type:'walk',sceneId:'wutan',x:48,y:50}),null);assert.equal(t.current.state.locationId,'wutan');assert.equal(t.current.state.vigor,100);
});
