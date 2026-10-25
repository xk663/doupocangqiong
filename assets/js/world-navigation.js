(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.WorldNavigation=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 // Hand-authored road centre lines. Width is a gameplay corridor, not image segmentation.
 const roads={
  wutan:[[[50,90],[50,79],[49,65],[48,50],[50,34],[50,12]],[[18,50],[32,48],[48,50],[64,48],[79,51]],[[32,65],[42,65],[49,65],[65,60],[75,75]],[[32,48],[30,30],[50,34]],[[64,48],[69,35]]],
  qingshan:[[[50,90],[55,75],[48,66],[40,58],[48,48],[55,38],[66,36],[77,35]],[[30,73],[40,68],[48,66]],[[48,48],[38,37],[25,26]]],
  shimo:[[[50,90],[43,69],[49,59],[65,60],[72,50],[78,40],[65,25]],[[43,69],[36,60],[31,49],[35,32],[50,23]]]
 };
 const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
 const point=p=>Array.isArray(p)?{x:p[0],y:p[1]}:{x:p.x,y:p.y};
 const networks=new WeakMap();
 function project(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return {x:a.x+t*dx,y:a.y+t*dy,t};}
 function geometry(data,sceneId){
  if(networks.get(data)?.[sceneId])return networks.get(data)[sceneId];
  const lines=(Object.hasOwn(roads,sceneId)?roads[sceneId]:[]).map(line=>line.map(point));if(!lines.length)return null;
  const segments=[];for(const line of lines)for(let i=1;i<line.length;i++)segments.push({a:line[i-1],b:line[i]});
  // Landmarks connect to the nearest authored road, allowing future anchors to be edited in Tiled.
  for(const n of data.nodes.filter(n=>n.scene===sceneId||n.id===sceneId)){const p=point(n.id===sceneId?n.localPosition:[n.x,n.y]);const closest=nearest(segments,p);if(closest&&closest.distance>.01)segments.push({a:p,b:closest.point});}
  let cache=networks.get(data);if(!cache){cache=Object.create(null);networks.set(data,cache);}cache[sceneId]=segments;return segments;
 }
 function nearest(segments,p){let result;for(let i=0;i<segments.length;i++){const s=segments[i],q=project(p,s.a,s.b),d=distance(p,q);if(!result||d<result.distance)result={point:q,distance:d,index:i};}return result;}
 function route(data,sceneId,start,target){
  if(![start?.x,start?.y,target?.x,target?.y].every(Number.isFinite)||[start.x,start.y,target.x,target.y].some(v=>v<0||v>100))return {ok:false,reason:'位置超出地图范围'};
  const segments=geometry(data,sceneId);if(!segments)return {ok:false,reason:'请在当前城镇或区域中步行'};
  const from=nearest(segments,start),to=nearest(segments,target);if(to.distance>7)return {ok:false,reason:'这里不在可通行道路上，请点选街巷或小径'};
  if(from.distance>7)return {ok:false,reason:'当前位置不在可通行区域，请重新进入本地区'};
  const vertices=[],edges=new Map();const key=p=>p.x.toFixed(3)+','+p.y.toFixed(3);
  function add(p){const k=key(p);let i=vertices.findIndex(v=>v.key===k);if(i<0){i=vertices.length;vertices.push({...p,key:k});edges.set(i,[]);}return i;}
  for(const seg of segments){const list=[seg.a,seg.b,from.point,to.point,...segments.flatMap(s=>[s.a,s.b])].filter(p=>distance(p,project(p,seg.a,seg.b))<.01).sort((a,b)=>distance(a,seg.a)-distance(b,seg.a));for(let i=1;i<list.length;i++){const a=add(list[i-1]),b=add(list[i]);if(a!==b){edges.get(a).push(b);edges.get(b).push(a);}}}
  const a=add(from.point),b=add(to.point),open=new Set([a]),cost=new Map([[a,0]]),prev=new Map();while(open.size){const current=[...open].sort((x,y)=>cost.get(x)-cost.get(y))[0];open.delete(current);if(current===b)break;for(const next of edges.get(current)){const value=cost.get(current)+distance(vertices[current],vertices[next]);if(value<(cost.get(next)??Infinity)){cost.set(next,value);prev.set(next,current);open.add(next);}}}
  if(!cost.has(b))return {ok:false,reason:'道路暂不相通，请改走已标记的小径'};
  let current=b,points=[point(vertices[b])];while(current!==a){current=prev.get(current);points.unshift(point(vertices[current]));}if(distance(start,points[0])>.01)points.unshift(point(start));
  const length=points.slice(1).reduce((sum,p,i)=>sum+distance(p,points[i]),0);return {ok:true,points,length,target:point(to.point),sceneId};
 }
 function position(data,state){const root=data.nodes.find(n=>n.id===state.locationId)?.root||state.locationId;const sceneId=roads[root]?root:'world';if(state.pose?.sceneId===sceneId)return {...state.pose};const n=data.nodes.find(n=>n.id===(sceneId==='world'?root:state.locationId));const p=sceneId===root&&n?.id===root?n.localPosition:[n?.x||50,n?.y||50];return {sceneId,x:p[0],y:p[1],direction:0};}
 function arrival(data,state,sceneId,p){return data.nodes.filter(n=>(n.scene===sceneId||n.id===sceneId)&&state.discovered.includes(n.id)&&!n.lateOnly).map(n=>({n,d:distance(p,point(n.id===sceneId?n.localPosition:[n.x,n.y]))})).filter(x=>x.d<=4).sort((a,b)=>a.d-b.d)[0]?.n;}
 const avatars=[{id:'xiaoyan',name:'萧炎',subtitle:'黑衣 · 玄重尺',image:'assets/images/avatar-xiaoyan-sheet.png',tint:0x8de1cb},{id:'xuner',name:'薰儿',subtitle:'青玉 · 长发',image:'assets/images/avatar-xuner-sheet.png',tint:0xffdc94},{id:'xiaoyixian',name:'小医仙',subtitle:'银发 · 紫花',image:'assets/images/avatar-xiaoyixian-sheet.png',tint:0xcbb2ff}];
 for(const a of avatars)a.sheets={walk:a.image,convoy:'assets/images/avatar-'+a.id+'-convoy-sheet.png',flight:'assets/images/avatar-'+a.id+'-flight-sheet.png'};
 const forms={walk:{id:'walk',name:'徒步',speed:11,label:'沿路步行',description:'四向步行 · 街巷寻路'},convoy:{id:'convoy',name:'随商队',speed:16,label:'随队骑乘',description:'骑乘赶路 · 另付乘行费用'},flight:{id:'flight',name:'化翼飞行',speed:26,label:'化翼御空',description:'斗王解锁 · 区域内直线飞行'}};
 function avatar(gender,id){return avatars.find(a=>a.id===id)||avatars[gender==='female'||gender==='女'?1:0];}
 function direction(a,b){const dx=b.x-a.x,dy=b.y-a.y;return Math.abs(dx)>Math.abs(dy)?dx>=0?1:3:dy>=0?0:2;}
 function sample(points,progress){const lengths=points.slice(1).map((p,i)=>distance(p,points[i])),total=lengths.reduce((a,b)=>a+b,0);let rest=total*Math.max(0,Math.min(1,progress)),index=0;while(index<lengths.length-1&&rest>lengths[index])rest-=lengths[index++];const a=points[index],b=points[index+1]||a,t=Math.min(1,rest/(lengths[index]||1));return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,direction:direction(a,b)};}
 return {roads,avatars,forms,distance,geometry,nearest,route,position,arrival,avatar,direction,sample};
});
