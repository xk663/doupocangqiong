const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const data=require('../assets/js/world-data.js'),nav=require('../assets/js/world-navigation.js'),core=require('../assets/js/world-core.js');
function fresh(realm='斗王·一星'){const state=core.initial(data,'wutan-market','forms');return {state,player:{name:'独立角色',gender:'male',realm,inventory:[],exploration:state},economy:{gold:40},gameTime:{year:1,month:1,day:1,hour:8,minute:0,totalHours:0},worldState:{location:'乌坦城'},questSystem:{quests:[],completed:[],failed:[]}};}
const move=(c,x,y,mode)=>core.transition(data,c,{type:'walk',sceneId:'wutan',x,y,mode});
test('four mutually exclusive avatar choices are saved independently of gender or character identity',()=>{
 let c=fresh();assert.equal(nav.avatars.length,4);for(const a of nav.avatars){c=core.transition(data,c,{type:'appearance',avatarId:a.id});assert.equal(c.state.avatarId,a.id);assert.equal(c.player.name,'独立角色');assert.equal(c.player.gender,'male');assert.equal(c.player.realm,'斗王·一星');assert.equal(c.gameTime.totalHours,0);assert.equal(c.state.turn,0);assert.equal(c.cosmetic,true);assert.equal(core.normalize(data,JSON.parse(JSON.stringify(c.state)),c.player,c.worldState).avatarId,a.id);}
 assert.throws(()=>core.transition(data,c,{type:'appearance',avatarId:'../../secret'}),/未知/);
});
test('old avatar-less saves use gender defaults while an explicit choice survives gender changes',()=>{
 const c=fresh(),old=core.clone(c.state);delete old.avatarId;c.player.gender='female';assert.equal(core.normalize(data,old,c.player,c.worldState).avatarId,'xuner');old.avatarId='xiaoyixian';assert.equal(core.normalize(data,old,c.player,c.worldState).avatarId,'xiaoyixian');assert.equal(core.normalize(data,{...old,avatarId:'invalid'},c.player,c.worldState).avatarId,'xuner');
});
test('flight mode and movement require actual realm, never merely a winged avatar',()=>{
 let c=fresh('斗之气·三段');c=core.transition(data,c,{type:'appearance',avatarId:'xiaoyixian'});assert.throws(()=>core.transition(data,c,{type:'movement-mode',mode:'flight'}),/斗王/);assert.equal(core.walkPlan(data,c,'wutan',{x:69,y:35},'flight').ok,false);assert.throws(()=>move(c,69,35,'flight'),/斗王/);assert.throws(()=>core.transition(data,c,{type:'movement-mode',mode:'toString'}),/未知/);assert.equal(core.walkPlan(data,c,'wutan',{x:69,y:35},'__proto__').ok,false);
});
test('three movement styles use distinct route and cost rules',()=>{
 const c=fresh(),walk=core.walkPlan(data,c,'wutan',{x:32,y:65},'walk'),ride=core.walkPlan(data,c,'wutan',{x:32,y:65},'convoy'),flight=core.walkPlan(data,c,'wutan',{x:32,y:65},'flight');assert.ok(walk.ok&&ride.ok&&flight.ok);assert.ok(flight.length<walk.length);assert.ok(flight.hours<walk.hours);assert.ok(ride.energy<walk.energy);assert.ok(ride.gold>0);assert.equal(flight.gold,0);assert.equal(ride.points.length,walk.points.length);assert.equal(flight.points.length,2);
});
test('prepaid caravan distance carries across interrupted and retargeted local journeys',()=>{
 const c=fresh();const one=move(c,49,65,'convoy');assert.equal(one.economy.gold,39);assert.ok(one.state.caravanCredit>0);const two=move(one,50,70,'convoy');assert.equal(two.economy.gold,39);assert.ok(two.state.caravanCredit<one.state.caravanCredit);const direct=move(c,50,70,'convoy');assert.equal(two.economy.gold,direct.economy.gold);
 const poor=fresh();poor.economy.gold=0;assert.throws(()=>move(poor,49,65,'convoy'),/金币/);assert.equal(poor.state.vigor,100);
});
test('flight can stop away from roads and persist airborne coordinates, but cannot land on blocked ground',()=>{
 let c=fresh();assert.equal(core.walkPlan(data,c,'wutan',{x:90,y:10},'walk').ok,false);c=move(c,90,10,'flight');assert.equal(c.state.pose.airborne,true);assert.deepEqual([c.state.pose.x,c.state.pose.y],[90,10]);assert.deepEqual(core.normalize(data,c.state,c.player,c.worldState).pose,c.state.pose);assert.throws(()=>core.transition(data,c,{type:'movement-mode',mode:'walk'}),/道路/);c=move(c,48,50,'flight');c=core.transition(data,c,{type:'movement-mode',mode:'walk'});assert.equal(c.state.movementMode,'walk');assert.equal(c.state.pose.airborne,undefined);
});

test('flight keeps enough stamina to return to a road and cannot camp in midair',()=>{
 const c=fresh();c.state.vigor=3;assert.equal(core.walkPlan(data,c,'wutan',{x:90,y:10},'flight').ok,false);c.state.vigor=10;const airborne=move(c,90,10,'flight');assert.match(airborne.worldState.specificSpot,/空域/);assert.throws(()=>core.transition(data,airborne,{type:'rest'}),/落地/);const landed=move(airborne,69,35,'flight');const rested=core.transition(data,landed,{type:'rest'});assert.equal(rested.state.pose.airborne,undefined);assert.equal(rested.state.movementMode,'walk');
});
test('cosmetic metadata never leaks into the next gameplay commit',()=>{
 let c=core.transition(data,fresh(),{type:'appearance',avatarId:'xiaoyixian'});assert.equal(c.cosmetic,true);c=move(c,49,65,'walk');assert.equal(c.cosmetic,undefined);assert.ok(c.state.turn>0);assert.equal(c.state.avatarId,'xiaoyixian');
});
test('map prompt distinguishes appearance from original character powers',()=>{
 const c=core.transition(data,fresh(),{type:'appearance',avatarId:'xiaoyixian'});const text=core.promptContext(data,c);assert.match(text,/小医仙/);assert.match(text,/仅外观/);assert.match(text,/不获得原著身份/);
});
test('each avatar has a complete dedicated atlas for all three forms and every new script parses',()=>{
 for(const a of nav.avatars)for(const form of ['walk','convoy','flight']){const bytes=fs.readFileSync(require('path').join(__dirname,'..',a.sheets[form]));assert.equal(bytes[25],6);assert.equal(bytes.readUInt32BE(16),1536);assert.equal(bytes.readUInt32BE(20),1024);}
 for(const p of ['world-navigation','world-core','world-actor','world-renderer','world-ui','world-standalone'])new vm.Script(fs.readFileSync(require('path').join(__dirname,'../assets/js/'+p+'.js'),'utf8'));
});

test('riding and flying use one full-frame character sprite with no rider crop or separate attachments',async()=>{
 class Container{constructor(){this.children=[];this.position={set(){}};}addChild(x){this.children.push(x);}destroy(){}}
 class Graphics{constructor(){this.scale={set(){}};}ellipse(){return this;}fill(){return this;}clear(){return this;}moveTo(){return this;}lineTo(){return this;}stroke(){return this;}}
 class Sprite{constructor(texture){this.texture=texture;this.anchor={set(){}};this.scale={x:1};}}
 class Texture{constructor({source,frame}){this.source=source;this.frame=frame;this.width=frame.width;this.height=frame.height;}destroy(){}}
 class Rectangle{constructor(x,y,width,height){Object.assign(this,{x,y,width,height});}}
 const loaded=[],sandbox={WorldNavigation:nav,DoupoWorldData:data,module:{exports:{}},PIXI:{Container,Graphics,Sprite,Texture,Rectangle,Assets:{async load(url){loaded.push(url);return {width:1536,height:1024,source:{}};}}}};vm.createContext(sandbox);vm.runInContext(fs.readFileSync(require('path').join(__dirname,'../assets/js/world-actor.js'),'utf8'),sandbox);const Actor=sandbox.module.exports;
 for(const a of nav.avatars)for(const form of ['walk','convoy','flight']){const rig=new Actor({world:new Container(),avatar:a,form});await rig.init();assert.equal(loaded.at(-1),a.sheets[form]);assert.equal(rig.root.children.filter(c=>c instanceof Sprite).length,1);assert.equal(rig.textures.length,12);for(let d=0;d<4;d++)for(let f=0;f<3;f++){rig.pose({x:50,y:50},d,f,100,true,true);assert.equal(rig.hero.texture.frame.width,384);assert.ok(Math.abs(rig.hero.texture.frame.height-1024/3)<.001);}assert.equal(rig.riderFrames,undefined);assert.equal(rig.mountFrames,undefined);assert.equal(rig.wingFrames,undefined);rig.destroy();}
});

test('the actual UI passes the selected avatar and form into the renderer',async()=>{
 let c=fresh();const elements=new Map(),models=[];function element(){return {value:'',innerHTML:'',hidden:false,disabled:false,style:{},classList:{add(){},toggle(){}},addEventListener(){},setAttribute(){},querySelector(selector){if(!elements.has(selector))elements.set(selector,element());return elements.get(selector);}};}
 const host=element();host.isConnected=true;const sandbox={WorldCore:core,WorldNavigation:nav,DoupoWorldData:data,console,Set,WeakMap,matchMedia:()=>({matches:false}),PIXI:{},WorldActor:class {},WorldRenderer:class {async init(){return this;}setMotion(){}resize(){}render(model){models.push(model);return Promise.resolve();}},document:{createElement:element,head:{append(){}}}};vm.createContext(sandbox);
 vm.runInContext(fs.readFileSync(require('path').join(__dirname,'../assets/js/world-bridge.js'),'utf8'),sandbox);sandbox.WorldMapBridge.configure({read:()=>c,commit(next){c=next;},isBusy:()=>false,toast(){}});vm.runInContext(fs.readFileSync(require('path').join(__dirname,'../assets/js/world-ui.js'),'utf8'),sandbox);
 const view=await sandbox.WorldMapUI.mount(host);view.action('appearance',{id:'xiaoyixian'});assert.equal(models.at(-1).avatar.id,'xiaoyixian');view.action('mode',{id:'convoy'});assert.equal(models.at(-1).form,'convoy');view.action('appearance',{id:'xuner'});assert.equal(models.at(-1).avatar.id,'xuner');assert.equal(models.at(-1).form,'convoy');assert.equal(c.player.name,'独立角色');
});
