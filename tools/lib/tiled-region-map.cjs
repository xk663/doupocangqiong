/* Update authored anchors without discarding editor annotations, IDs or custom layers. */
module.exports=function mergeTiledMap(original,scene,data){
 const map=JSON.parse(JSON.stringify(original)),w=scene.width||data.worldWidth,h=scene.height||data.worldHeight;
 const image=map.layers.find(l=>l.type==='imagelayer');Object.assign(image,{image:'../../'+scene.art,imagewidth:w,imageheight:h});map.width=Math.ceil(w/map.tilewidth);map.height=Math.ceil(h/map.tileheight);
 const anchors=map.layers.find(l=>l.type==='objectgroup'&&l.objects?.some(o=>o.properties?.some(p=>p.name==='worldId')))||map.layers.find(l=>l.type==='objectgroup');
 const previous=anchors.objects||[],key=o=>o.properties?.find(p=>p.name==='worldId')?.value,byKey=new Map(previous.map(o=>[key(o),o]));
 let next=Math.max(map.nextobjectid||1,...map.layers.flatMap(l=>(l.objects||[]).map(o=>o.id+1)));
 const nodes=data.nodes.filter(n=>n.scene===scene.id||n.id===scene.id),active=new Set(nodes.map(n=>n.id));
 anchors.objects=nodes.map(n=>{const before=byKey.get(n.id),pos=n.id===scene.id?n.localPosition:[n.x,n.y],properties=JSON.parse(JSON.stringify(before?.properties||[]));
  for(const [name,value] of Object.entries({worldId:n.id,sceneId:scene.id,sourceType:n.sourceType||'game-design'})){const prop=properties.find(p=>p.name===name);if(prop)prop.value=value;else properties.push({name,type:'string',value});}
  return {...before,id:before?.id??next++,name:n.id===scene.id?n.localName||n.name:n.name,type:n.type,point:true,x:pos[0]*w/100,y:pos[1]*h/100,width:before?.width??0,height:before?.height??0,rotation:before?.rotation??0,visible:before?.visible??!n.secret,properties};
 }).concat(previous.filter(o=>!active.has(key(o))));
 map.nextobjectid=Math.max(next,...map.layers.flatMap(l=>(l.objects||[]).map(o=>o.id+1)));map.nextlayerid=Math.max(map.nextlayerid||1,...map.layers.map(l=>l.id+1));return map;
};
