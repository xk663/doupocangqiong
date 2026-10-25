const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const roster=require('../assets/js/beauty-roster.js'),chronicle=require('../assets/js/beauty-chronicle.js'),core=require('../assets/js/tavern-core.js');
test('original roster is bounded, rejects duplicate aliases and hiding keeps records recoverable',()=>{
 const original={records:{'小医仙':{realm:'斗师'}}};const added=roster.edit(original,{type:'add',name:'柳知秋',bio:'药师'});assert.equal(roster.list(added).length,11);assert.equal(roster.list(added)[0].name,'柳知秋');assert.equal(original.roster,undefined);
 assert.throws(()=>roster.edit(added,{type:'add',name:'柳知秋'}));assert.throws(()=>roster.edit(added,{type:'add',name:'美杜莎'}));assert.throws(()=>roster.edit(added,{type:'add',name:'__proto__'}));
 const hidden=roster.edit(added,{type:'hide',name:'小医仙'});assert.equal(roster.list(hidden).length,10);assert.equal(hidden.records['小医仙'].realm,'斗师');const restored=roster.edit(hidden,{type:'restore',name:'小医仙'});assert.equal(roster.list(restored).length,11);const moved=roster.edit(restored,{type:'move',name:'柳知秋',direction:1});assert.notEqual(roster.list(moved)[0].name,'柳知秋');
 let s=added;for(let i=0;i<29;i++)s=roster.edit(s,{type:'add',name:'原创'+i});assert.throws(()=>roster.edit(s,{type:'add',name:'超量'}),/最多/);
});
test('corrections are audited, reset only supplied fields and preserve independent relationship locks',()=>{
 const original={clock:{year:1,month:9,day:15,label:'1年9月15日'},records:{'小医仙':{realm:'斗师',age:18,trust:'信任',closeness:'疏远',events:[]}}};
 const s=roster.edit(original,{type:'correct',name:'小医仙',values:{realm:'斗灵',trust:'谨慎',age:''},locks:{realm:true,trust:true},reason:'修正误记'});assert.equal(s.records['小医仙'].age,undefined);assert.equal(s.records['小医仙'].closeness,'疏远');assert.equal(s.audit[0].before.realm,'斗师');assert.equal(s.audit[0].after.realm,'斗灵');assert.equal(original.records['小医仙'].realm,'斗师');assert.throws(()=>roster.edit(s,{type:'correct',name:'小医仙',values:{age:-1}}));
 const body='小医仙今年19岁，已是斗皇，她仍对你保持警惕。';const next=chronicle.apply(s,JSON.stringify({characters:[{name:'小医仙',age:19,realm:'斗皇',trust:'警惕',closeness:'朋友',evidence:body,event:'表达警惕'}]}),body,s.clock,'turn');assert.equal(next.records['小医仙'].realm,'斗灵');assert.equal(next.records['小医仙'].trust,'谨慎');assert.equal(next.records['小医仙'].closeness,'朋友');assert.equal(next.records['小医仙'].age,19);
 const unlocked=roster.edit(next,{type:'correct',name:'小医仙',values:{realm:'斗灵'},locks:{realm:false}});assert.equal(chronicle.apply(unlocked,JSON.stringify({characters:[{name:'小医仙',realm:'斗皇',evidence:body}]}),body,s.clock,'turn2').records['小医仙'].realm,'斗皇');
});
test('custom profiles enter actual model whitelist and locked facts enter main prompt context',async()=>{
 let s=roster.edit(null,{type:'add',name:'柳知秋',bio:'山中药师'});s=roster.edit(s,{type:'correct',name:'柳知秋',values:{realm:'斗师'},locks:{realm:true}});let sent;
 const body='柳知秋答应帮你采药，表示愿意同行。';const next=await chronicle.update(s,body,{enabled:true,url:'https://example.com/v1',model:'x'},undefined,'t',async(a,m)=>{sent=m;return JSON.stringify({characters:[{name:'柳知秋',promises:'约定采药',stance:'合作',evidence:body,event:'答应帮忙采药'}]});});assert.equal(next.records['柳知秋'].promises,'约定采药');assert.ok(sent[1].content.includes('山中药师'));assert.ok(roster.context(next).includes('斗师'));assert.ok(roster.context(next).includes('locks'));
 const edited=roster.edit(next,{type:'correct',name:'柳知秋',values:{bio:'城中药师'}});assert.equal(roster.list(edited,true).find(c=>c.name==='柳知秋').bio,'城中药师');assert.equal(edited.audit.at(-1).before.bio,'山中药师');
});
function ui(){const nodes={},notices=[],store=new Map();const el=id=>nodes[id]??={value:'',focus(){}};
 const s={TavernCore:core,GameState:{phase:'game',player:{name:'玩家'}},tavernState:{activeChatId:'chat',isSending:false,isLoading:false,tavernSettings:{id:'main'}},WorldMapBridge:{isBusy:()=>false},showToast:(msg,type)=>notices.push({msg,type}),document:{getElementById:el},saveToLocalStorage:()=>true,switchGameView(){},DoupoPanels:{rankTab:'beauties',rankings(){}},console};
 s.db={tavernSettings:{async put(v){store.set(v.id,core.clone(v));}},async transaction(mode,tables,fn){const old=new Map(store);try{await fn();}catch(e){store.clear();for(const[k,v]of old)store.set(k,v);throw e;}}};vm.createContext(s);vm.runInContext(fs.readFileSync('assets/js/beauty-roster.js','utf8'),s);return{s,el,notices,store};
}
test('editing durably commits together with player, rollback cannot create phantom characters',async()=>{
 const{s,store}=ui();assert.equal(await s.BeautyRoster.commit({type:'add',name:'柳知秋'}),true);assert.equal(store.get('main').playerState.beautyChronicle.roster.custom.length,1);const previous=s.GameState.player;s.db.tavernSettings.put=async()=>{throw Error('quota');};assert.equal(await s.BeautyRoster.commit({type:'add',name:'药童'}),false);assert.equal(s.GameState.player,previous);
 s.tavernState.isSending=true;assert.equal(await s.BeautyRoster.commit({type:'hide',name:'小医仙'}),false);
});
test('an edit cannot cross a changed chat or overwrite newer player state',async()=>{const{s,store}=ui();s.db.tavernSettings.put=async v=>{store.set(v.id,v);s.tavernState.activeChatId='other';};assert.equal(await s.BeautyRoster.commit({type:'add',name:'柳知秋'}),false);assert.equal(store.size,0);assert.equal(s.GameState.player.beautyChronicle,undefined);});
test('interaction appends a draft, does not auto-send or mutate resources, and free action requires intent',()=>{
 const{s,el}=ui();el('tavern-input').value='已有草稿';el('beauty-action-0').value='invite';el('beauty-intent-0').value='去坊市';const before=JSON.stringify(s.GameState);s.BeautyRoster.draft('小医仙',0);assert.ok(el('tavern-input').value.startsWith('已有草稿'));assert.ok(el('tavern-input').value.includes('可以拒绝'));assert.equal(JSON.stringify(s.GameState),before);
 const draft=el('tavern-input').value;el('beauty-action-0').value='free';el('beauty-intent-0').value='';s.BeautyRoster.draft('小医仙',0);assert.equal(el('tavern-input').value,draft);
});
test('original names and backgrounds remain inert HTML in controls and management',()=>{const{s}=ui();s.GameState.player.beautyChronicle=roster.edit(null,{type:'add',name:'<img onerror=x>',bio:'</textarea><script>x</script>'});const html=s.BeautyRoster.management()+s.BeautyRoster.controls('<img onerror=x>',0);assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<img onerror=x>'));assert.ok(html.includes('&lt;'));
});
