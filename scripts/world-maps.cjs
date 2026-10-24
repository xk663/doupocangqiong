// The runtime JSON is the canonical catalogue; Tiled edits only visual anchors.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),file=path.join(root,'assets/data/world.json');
const data=JSON.parse(fs.readFileSync(file,'utf8'));
function writeRuntime(){fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n');fs.writeFileSync(path.join(root,'assets/js/world-data.js'),'(function(root){const data='+JSON.stringify(data)+';if(typeof module===\'object\'&&module.exports)module.exports=data;else root.DoupoWorldData=data;})(typeof globalThis!==\'undefined\'?globalThis:this);\n');}
const command=process.argv[2];
if(command==='export'){
 fs.mkdirSync(path.join(root,'maps/authoring'),{recursive:true});
 for(const scene of data.scenes){const nodes=data.nodes.filter(n=>n.scene===scene.id||n.id===scene.id),width=data.worldWidth,height=data.worldHeight;
 const map={type:'map',version:'1.10',tiledversion:'1.12.2',orientation:'orthogonal',renderorder:'right-down',width:Math.ceil(width/32),height:Math.ceil(height/32),tilewidth:32,tileheight:32,infinite:false,nextlayerid:3,nextobjectid:nodes.length+1,layers:[{id:1,name:'无字地形底图',type:'imagelayer',image:'../../'+scene.art,opacity:1,visible:true,x:0,y:0},{id:2,name:'地点与交互锚点',type:'objectgroup',opacity:1,visible:true,x:0,y:0,objects:nodes.map((n,i)=>{const pos=n.id===scene.id?n.localPosition:[n.x,n.y];return {id:i+1,name:n.name,type:n.type,x:pos[0]*width/100,y:pos[1]*height/100,width:0,height:0,point:true,rotation:0,visible:true,properties:[{name:'worldId',type:'string',value:n.id},{name:'sceneId',type:'string',value:scene.id},{name:'sourceType',type:'string',value:n.sourceType}]};})}]};fs.writeFileSync(path.join(root,'maps/authoring/'+scene.id+'.tmj'),JSON.stringify(map,null,2));}
 console.log('Exported four editable Tiled maps.');
}else if(command==='import'||command==='check'){
 const target=process.argv[3];if(!target)throw Error('Provide a Tiled .tmj or JSON export path');
 const map=JSON.parse(fs.readFileSync(path.resolve(target),'utf8'));let count=0;const seen=new Set();
 for(const layer of map.layers||[])for(const obj of layer.objects||[]){const props=Object.fromEntries((obj.properties||[]).map(p=>[p.name,p.value]));if(!props.worldId)continue;
  const n=data.nodes.find(n=>n.id===props.worldId),scene=data.scenes.find(s=>s.id===props.sceneId);if(!n||!scene||seen.has(n.id))throw Error('Unknown or duplicate worldId');seen.add(n.id);
  if(n.scene!==scene.id&&n.id!==scene.id)throw Error('Scene mismatch for '+n.id);
  if(!Number.isFinite(obj.x)||!Number.isFinite(obj.y)||obj.x<0||obj.x>data.worldWidth||obj.y<0||obj.y>data.worldHeight)throw Error('Invalid coordinates for '+n.id);
  const pos=[Math.round(obj.x/data.worldWidth*10000)/100,Math.round(obj.y/data.worldHeight*10000)/100];if(n.id===scene.id)n.localPosition=pos;else [n.x,n.y]=pos;count++;
 }
 if(!count)throw Error('No map anchors found');if(command==='import')writeRuntime();console.log(command+': '+count+' validated anchors');
}else if(command==='sync'){writeRuntime();console.log('Runtime catalogue synchronized.');}else throw Error('Usage: node scripts/world-maps.cjs export | check <map> | import <map> | sync');
