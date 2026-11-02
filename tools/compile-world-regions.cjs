/* Compile the authored catalogue; publish only after every required artwork is present. */
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),catalogue=require('./data/world-regions.json');
const data=JSON.parse(fs.readFileSync(path.join(root,'assets/data/world.json'),'utf8'));
const regionIds=new Set(catalogue.regions.map(r=>r.id));
Object.assign(data.scenes.find(s=>s.id==='world'),{art:'assets/images/world-atlas-expanded-v4.webp',width:1536,height:1024});
for(const r of catalogue.regions){
 const parent=data.nodes.find(n=>n.id===r.id);parent.localPosition=r.entry;if(r.localName)parent.localName=r.localName;if(r.localArt)parent.localArt=r.localArt;
 const scene={id:r.id,name:r.name,subtitle:'地区探索 · 六处分支与专属画景',root:r.id,art:r.mapArt,width:r.width,height:r.height,roads:r.roads},existingScene=data.scenes.find(s=>s.id===r.id);if(!existingScene)data.scenes.push(scene);else if(!r.legacy)Object.assign(existingScene,scene);
 for(const p of r.branches){
  const existing=data.nodes.find(n=>n.id===p.id);if(existing){if(existing.introduced===3)Object.assign(existing,{name:p.name,type:p.type,x:p.x,y:p.y,desc:p.desc,artOf:p.artOf});continue;}
  data.nodes.push({id:p.id,name:p.name,scene:r.id,x:p.x,y:p.y,type:p.type,root:r.id,parent:r.id,layer:'surface',sourceType:'game-design',sources:[],minRank:parent.minRank||0,secret:false,lateOnly:false,introduced:3,desc:p.desc,artOf:p.artOf});
  data.edges.push({id:r.id+'--'+p.id,a:r.id,b:p.id,hours:.25,gold:0,kind:'road',sourceType:'game-design',note:'地区分支为游戏场景设计，进入条件与归属以正文为准。'});
 }
}
const entries=catalogue.regions.flatMap(r=>[{id:r.id,name:r.name,regionId:r.id,regionName:r.name,aliases:[],art:r.mapArt,localName:r.localName,localArt:r.localArt,overview:true,points:r.branches.filter(p=>!p.secret).map(p=>({id:r.id+'-towards-'+p.id,x:p.x,y:p.y,label:'了解'+p.name,title:p.name+' · 核对访问条件',description:'在'+r.name+'入口了解'+p.name+'的公开路线与访问条件。',prompt:'我在'+r.name+'，想先询问'+p.name+'的公开方位、路况、通行资格和时间费用；先核对真实条件，不因此到达或获得任何许可。',condition:'路线、进入资格与行旅代价需要实际满足',minutes:15}))},...r.branches.map(p=>({id:p.id,name:p.name,regionId:r.id,regionName:r.name,aliases:[],art:p.art,artOf:p.artOf,secret:p.secret,points:p.interactions}))]);
const out=path.join(root,'output/region-expansion/staged');fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,'world.json'),JSON.stringify(data,null,2)+'\n');
fs.writeFileSync(path.join(root,'tests/fixtures/region-map-preview-data.js'),"var DoupoWorldData="+JSON.stringify(data)+";\n");
fs.writeFileSync(path.join(root,'assets/js/world-regions.js'),"/* Generated from tools/author-world-regions.cjs; public maps are game design, not canonical surveys. */\n(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.WorldRegions=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){return "+JSON.stringify({version:3,entries})+";});\n");
if(process.argv.includes('--publish')){
 const missing=catalogue.jobs.filter(j=>!fs.existsSync(path.join(root,j.target)));if(missing.length)throw Error('Artwork not ready: '+missing.length+' ('+missing.slice(0,5).map(j=>j.id).join(', ')+')');
 fs.writeFileSync(path.join(root,'assets/data/world.json'),JSON.stringify(data,null,2)+'\n');
 fs.writeFileSync(path.join(root,'assets/js/world-data.js'),"(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.DoupoWorldData=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){return "+JSON.stringify(data)+";});\n");
 for(const scene of data.scenes){
  const file=path.join(root,'maps/authoring',scene.id+'.tmj'),w=scene.width||data.worldWidth,h=scene.height||data.worldHeight;
  const map=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{type:'map',version:'1.10',tiledversion:'1.12.2',orientation:'orthogonal',renderorder:'right-down',tilewidth:32,tileheight:32,infinite:false,layers:[{id:1,name:'无字地形底图',type:'imagelayer',opacity:1,visible:true,x:0,y:0},{id:2,name:'地点锚点',type:'objectgroup',objects:[]}]};
  const merged=require('./lib/tiled-region-map.cjs')(map,scene,data);
  fs.writeFileSync(file,JSON.stringify(merged,null,2)+'\n');
 }
}
console.log(JSON.stringify({regions:regionIds.size,scenes:data.scenes.length,nodes:data.nodes.length,entries:entries.length,published:process.argv.includes('--publish')}));
