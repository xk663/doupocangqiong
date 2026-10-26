const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function harness(mode){
 const notices=[],fields={'res-home-name':{value:'借住客房'},'res-home-kind':{value:'guest'},'res-home-note':{value:'借住一晚'},'res-facility-rest':{checked:true}};
 const context={ResidenceCore:require('../assets/js/residence-core.js'),TavernCore:require('../assets/js/tavern-core.js'),GameState:{phase:'game',player:{name:'测试角色',gold:10}},WorldState:{location:'乌坦城',specificSpot:'客栈'},GameTime:{year:1,month:1,day:1},tavernState:{activeChatId:'a',tavernSettings:{}},document:{getElementById:id=>fields[id]||(id.startsWith('res-facility-')?{checked:false}:null)},showToast:t=>notices.push(t),saveToLocalStorage:()=>true,closeAllModals:()=>{},db:{tavernSettings:{async put(){if(mode==='failure')throw Error('磁盘写入失败');if(mode==='stale')context.tavernState.activeChatId='b';}},async transaction(_,__,fn){await fn();}}};
 vm.createContext(context);vm.runInContext(fs.readFileSync(require.resolve('../assets/js/residence-ui.js'),'utf8'),context);return {context,notices};
}
test('residence edits commit player state only after successful persistence',async()=>{
 const {context:c,notices}=harness();await c.ResidenceUI.save(null);assert.equal(c.GameState.player.residence.places[0].kind,'guest');assert.equal(c.GameState.player.gold,10);assert.match(notices.at(-1),/已保存/);assert.equal(c.ResidenceUI.isBusy(),false);
});
for(const mode of ['failure','stale'])test(`residence ${mode} writes do not replace the live player or report success`,async()=>{
 const {context:c,notices}=harness(mode),before=c.GameState.player;await c.ResidenceUI.save(null);assert.equal(c.GameState.player,before);assert.equal(before.residence,undefined);assert.match(notices.at(-1),/未保存/);assert.equal(c.ResidenceUI.isBusy(),false);
});
