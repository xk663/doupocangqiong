const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const data=require('../assets/js/world-data.js'),core=require('../assets/js/world-core.js');
function fixture(id='wutan-market',vigor=0){
 const state=core.initial(data,id,'paused-costs');state.vigor=vigor;state.caravanCredit=12.34;state.roamMinutes=830;
 let current={state,player:{name:'原角色',realm:'斗王·一星',inventory:[{name:'干粮',qty:0},{name:'水囊',qty:0},{name:'旧纪念物',qty:0,note:'保留原数据'}],exploration:state},economy:{gold:0},gameTime:{year:1,month:1,day:1,hour:8,minute:0,totalHours:0},worldState:{location:'乌坦城'},questSystem:{quests:[],completed:[],failed:[]}};
 const sandbox={WorldCore:core,DoupoWorldData:data};vm.createContext(sandbox);vm.runInContext(fs.readFileSync('assets/js/world-bridge.js','utf8'),sandbox);const bridge=sandbox.WorldMapBridge;
 bridge.configure({read:()=>current,commit:next=>{current=next;},isBusy:()=>false,toast(){}});
 const resources=c=>JSON.stringify({vigor:c.state.vigor,credit:c.state.caravanCredit,gold:c.economy.gold,inventory:c.player.inventory});
 return {bridge,resources,get current(){return current;}};
}
test('runtime policy pauses costs without adding a preference to the stored player or exploration data',()=>{
 const s=fixture(),ctx=s.bridge.getContext();assert.equal(ctx.travelResourcesEnabled,false);assert.equal(Object.hasOwn(s.current,'travelResourcesEnabled'),false);assert.equal(Object.hasOwn(ctx.player,'travelResourcesEnabled'),false);assert.equal(Object.hasOwn(ctx.state,'travelResourcesEnabled'),false);
});
test('all three local movement forms work at zero resources and preserve the original inventory entries and stamina precision',()=>{
 for(const mode of ['walk','convoy','flight'])for(const vigor of [0,47.35]){
  const s=fixture('wutan-market',vigor),before=s.resources(s.current);
  const next=s.bridge.execute({type:'walk',sceneId:'wutan',x:32,y:65,mode});assert.ok(next,mode);assert.equal(next.state.locationId,'wutan-inn');assert.equal(s.resources(next),before);assert.ok(next.gameTime.totalHours>0);
 }
});
test('long mainland trips reach the entire destination without supply limits or consuming prepaid riding credit',()=>{
 for(const mode of ['walk','convoy','flight']){
  const s=fixture('beast-mountains'),before=s.resources(s.current),ctx=s.bridge.getContext(),trip=core.roamPlan(data,ctx,{x:95,y:90},mode,true);
  assert.equal(trip.ok,true);assert.ok(!trip.limited);assert.deepEqual([trip.gold,trip.food,trip.water,trip.energy],[0,0,0,0]);
  const next=s.bridge.execute({type:'roam',x:95,y:90,mode});assert.ok(next);assert.deepEqual([next.state.pose.x,next.state.pose.y],[95,90]);assert.equal(s.resources(next),before);
 }
});
test('route travel cannot apply a hidden toll, random energy penalty or gathering reward while costs are paused',()=>{
 const s=fixture(),before=s.resources(s.current),next=s.bridge.execute({type:'travel',targetId:'shimo',mode:'convoy'});assert.ok(next);assert.equal(next.state.locationId,'shimo');assert.equal(s.resources(next),before);
});
test('retired exploration and rest actions are absent from model proposals and map prompts explain the paused costs',()=>{
 const s=fixture(),ctx=s.bridge.getContext();for(const type of ['rest','explore'])assert.equal(core.proposal(data,ctx,'<world_action>'+JSON.stringify({type})+'</world_action>'),null);
 const text=core.promptContext(data,ctx);assert.match(text,/地图行旅资源消耗暂已停用/);assert.doesNotMatch(text,/行旅精力：|金币：|干粮：|水囊：/);
 assert.equal(core.proposal(data,ctx,'<world_action>{"type":"travel","targetId":"qingshan"}</world_action>').type,'travel');
});
