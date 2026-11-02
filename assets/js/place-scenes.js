/* One location identity shared by the atlas and residence view. Artwork grants no property. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports&&typeof require==='function'?require('./world-regions.js'):root.WorldRegions);if(typeof module==='object'&&module.exports)module.exports=api;else root.PlaceScenes=api;})(typeof globalThis!=='undefined'?globalThis:this,function(Regions){
 'use strict';
 const entries=[['wutan','乌坦城',['城门','乌坦城入口']],['xiao-home','萧家宅邸',['萧家']],['wutan-market','坊市长街',['乌坦城坊市','坊市']],['wutan-inn','临街客栈',['客栈']],['wutan-auction','拍卖场外',['米特尔拍卖场','拍卖场']],['wutan-herbs','药材铺',['药铺']],['wutan-guild','佣兵告示处',['佣兵告示']],['wutan-gate','城门驿道',['驿道']],['wutan-home','乌坦清居',['西北亭院']]].map(([id,name,aliases])=>Object.freeze({id,name,aliases,art:'assets/images/places/'+id+'-v1.webp'}));
 const wutan=entries[0];entries[0]=Object.freeze({...wutan,art:'assets/images/world/world-wutan.webp',localName:'乌坦城门',localArt:wutan.art});
 if(Regions)for(const p of Regions.entries){const index=entries.findIndex(e=>e.id===p.id);if(index<0)entries.push(Object.freeze(p));else if(p.overview)entries[index]=Object.freeze({...entries[index],...p,aliases:entries[index].aliases});}
 const get=(id,sceneId)=>{const p=entries.find(p=>p.id===id);return !p?null:sceneId===p.id&&p.localName?{...p,name:p.localName,art:p.localArt||p.art}:p;};
 function resolve(world,state){
  const location=String(world?.location||''),groups=Regions?.entries.filter(p=>p.overview)||[{id:'wutan',name:'乌坦城'}];
  const region=groups.filter(p=>location.includes(p.name)||p.name.split('／').some(name=>name.length>=2&&location.includes(name))).sort((a,b)=>b.name.length-a.name.length)[0];if(!region)return null;
  const local=entries.filter(p=>(p.regionId===region.id||region.id==='wutan'&&!p.regionId)&&(!p.secret||state?.discovered?.includes(p.id)));
  const spot=String(world?.specificSpot||'').trim();
  // A specific narrative location takes precedence over an older map position.
  const exact=local.filter(p=>p.name===spot||p.aliases.includes(spot));if(exact.length)return exact.find(p=>p.id===state?.locationId)||exact[0];
  const partial=local.filter(p=>p.id!==region.id).sort((a,b)=>b.name.length-a.name.length).find(p=>spot.includes(p.name));if(partial)return partial;
  if(!spot||spot===region.name){const saved=local.find(p=>p.id===state?.locationId);return saved||get(region.id);}
  return null;
 }
 const url=(id,sceneId)=>{const place=get(id,sceneId);return place?place.art+'?v=region-scenes-4':null;};
 function statusHTML(){return '<div class="place-art-status" role="status"><p>画景正在载入…</p><button type="button">重试画景</button></div>';}
 async function load(id,fetcher,signal,sceneId){
  if(!get(id,sceneId))throw Error('未找到此地点的画景');
  const response=await (fetcher||fetch)(url(id,sceneId)+'&retry='+Date.now(),{credentials:'same-origin',cache:'reload',redirect:'error',signal});
  if(!response.ok){const error=Error(response.status===401||response.status===403?'画景请求未通过社区验证，请重新登录后重试。':response.status===404?'此地点的画景文件未找到，请检查部署资源。':'画景请求失败（HTTP '+response.status+'），请重试。');error.status=response.status;throw error;}
  if(!/^image\//i.test(response.headers.get('content-type')||''))throw Error('图片地址返回了网页或其他内容，请检查登录状态后重试。');
  const blob=await response.blob();if(!blob.size)throw Error('收到的画景文件为空，请重试。');return blob;
 }
 function bindImages(host){
  const disposers=[];
  for(const box of host.querySelectorAll('[data-place-art]')){
   const id=box.dataset.placeArt,sceneId=box.dataset.placeScene,img=box.querySelector('img'),status=box.querySelector('.place-art-status');if(!get(id,sceneId)||!img||!status)continue;
   const message=status.querySelector('p'),button=status.querySelector('button');let active=true,objectURL=null,controller=null;
   function failed(text){if(!active)return;box.dataset.artState='error';message.textContent=text;button.disabled=false;button.textContent='重试画景';}
   img.onload=()=>{if(active)box.dataset.artState='ready';};img.onerror=()=>failed('画景未能载入，点击重试可重新获取。');
   button.onclick=async event=>{event.stopPropagation();if(controller)return;box.dataset.artState='loading';message.textContent='正在重新获取画景…';button.disabled=true;controller=new AbortController();const timer=setTimeout(()=>controller?.abort(),10000);
    try{const blob=await load(id,null,controller.signal,sceneId);if(!active)return;if(objectURL)URL.revokeObjectURL(objectURL);objectURL=URL.createObjectURL(blob);img.src=objectURL;}
    catch(e){failed(e.name==='AbortError'?'获取画景超时，请稍后重试。':e.message||'获取画景失败，请重试。');}
    finally{clearTimeout(timer);controller=null;if(active)button.disabled=false;}
   };
   if(img.complete){if(img.naturalWidth)box.dataset.artState='ready';else failed('画景未能载入，点击重试可重新获取。');}
   disposers.push(()=>{active=false;controller?.abort();img.onload=null;img.onerror=null;button.onclick=null;if(objectURL)URL.revokeObjectURL(objectURL);});
  }
  return ()=>disposers.forEach(dispose=>dispose());
 }
 return {entries,get,resolve,url,statusHTML,load,bindImages};
});
