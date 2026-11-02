const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),crypto=require('crypto');
const places=require('../assets/js/place-scenes.js'),data=require('../assets/js/world-data.js');
test('Wutan places keep distinct artwork except the explicit regional-map reference',()=>{
 const wutan=places.entries.filter(p=>!p.regionId||p.regionId==='wutan');assert.equal(wutan.length,10);const hashes=new Set();
 for(const p of wutan){assert.ok(data.nodes.some(n=>n.id===p.id));const bytes=fs.readFileSync(p.art);assert.ok(bytes.length<((p.overview||p.artOf)?950000:300000));const info=require('./webp-info.cjs')(bytes);assert.equal(info.width,(p.overview||p.artOf)?1536:1200);assert.equal(info.height,(p.overview||p.artOf)?1024:800);hashes.add(crypto.createHash('sha256').update(bytes).digest('hex'));}
 assert.equal(hashes.size,9);
});
test('residence follows the actual story place, never a merely selected destination or unrelated generic courtyard',()=>{
 assert.equal(places.resolve({location:'乌坦城',specificSpot:'坊市长街'},{locationId:'xiao-home'}).id,'wutan-market');
 assert.equal(places.resolve({location:'加玛帝国 · 乌坦城',specificSpot:'乌坦城坊市'}).id,'wutan-market');
 assert.equal(places.resolve({location:'乌坦城',specificSpot:'城门驿道'}).id,'wutan-gate');
 assert.equal(places.resolve({location:'乌坦城',specificSpot:'我的私人小院'},{locationId:'wutan-market'}),null);
 assert.equal(places.resolve({location:'青山镇',specificSpot:'客栈'}),null);
 assert.equal(places.resolve({location:'乌坦城',specificSpot:'乌坦清居'},{locationId:'wutan-market'}).id,'wutan-home');
});

test('failed scene requests distinguish authorization, missing files and non-image responses',async()=>{
 for(const status of [401,403,404,503])await assert.rejects(places.load('wutan-guild',async()=>({ok:false,status})),e=>e.status===status);
 await assert.rejects(places.load('wutan-guild',async()=>({ok:true,headers:new Headers({'content-type':'text/html'})})),/网页/);
 let options;const blob=await places.load('wutan-guild',async(url,opts)=>{options=opts;assert.match(url,/wutan-guild-v1.webp\?v=/);return {ok:true,headers:new Headers({'content-type':'image/webp'}),blob:async()=>new Blob(['image'])};});
 assert.equal(blob.size,5);assert.equal(options.credentials,'same-origin');assert.equal(options.cache,'reload');assert.equal(options.redirect,'error');
});

test('the two city gate points are separated, reachable and legacy actors keep their saved position',()=>{
 const core=require('../assets/js/world-core.js'),nav=require('../assets/js/world-navigation.js');
 const state=core.initial(data,'wutan-gate','old');state.pose={sceneId:'wutan',x:50,y:88,direction:0};state.discovered=state.discovered.filter(id=>id!=='wutan-home');
 const saved=JSON.stringify(state),player={name:'旧角色',realm:'斗之气三段',inventory:[]},world={location:'乌坦城',specificSpot:'城门驿道'};
 const normalized=core.normalize(data,state,player,world);assert.deepEqual(normalized.pose,state.pose);assert.equal(normalized.locationId,state.locationId);assert.equal(JSON.stringify(state),saved);assert.ok(normalized.discovered.includes('wutan-home'));assert.ok(!normalized.visited.includes('wutan-home'));
 const city=core.node(data,'wutan'),gate=core.node(data,'wutan-gate');assert.deepEqual(city.localPosition,[50,73]);assert.equal(city.localName,'乌坦城门');assert.ok(nav.distance({x:city.localPosition[0],y:city.localPosition[1]},gate)>=7);
 for(const id of ['wutan','wutan-gate','wutan-home']){const n=core.node(data,id),target=id==='wutan'?{x:n.localPosition[0],y:n.localPosition[1]}:n;assert.ok(nav.route(data,'wutan',state.pose,target).ok,id);}
});

test('image errors expose retry, a successful retry uses an image blob, and detached figures never receive a late image',async()=>{
 const vm=require('node:vm');let finish,revoked=[];const sandbox={module:{exports:{}},AbortController,setTimeout,clearTimeout,URL:{createObjectURL:()=> 'blob:scene-test',revokeObjectURL:u=>revoked.push(u)},fetch:()=>new Promise(resolve=>{finish=resolve;})};vm.createContext(sandbox);vm.runInContext(fs.readFileSync('assets/js/place-scenes.js','utf8'),sandbox);const api=sandbox.module.exports;
 function figure(){const image={complete:true,naturalWidth:0},message={},button={},status={querySelector:s=>s==='p'?message:button},box={dataset:{placeArt:'wutan-guild'},querySelector:s=>s==='img'?image:status};const dispose=api.bindImages({querySelectorAll:()=>[box]});return {image,message,button,box,dispose};}
 const a=figure();assert.equal(a.box.dataset.artState,'error');assert.match(a.message.textContent,/重试/);const retry=a.button.onclick({stopPropagation(){}});finish({ok:true,headers:{get:()=> 'image/webp'},blob:async()=>({size:100})});await retry;assert.equal(a.image.src,'blob:scene-test');a.image.onload();assert.equal(a.box.dataset.artState,'ready');a.dispose();assert.deepEqual(revoked,['blob:scene-test']);
 const b=figure(),pending=b.button.onclick({stopPropagation(){}});b.dispose();finish({ok:true,headers:{get:()=> 'image/webp'},blob:async()=>({size:100})});await pending;assert.equal(b.image.src,undefined);
});
