(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./lore-catalog-data.js'),require('./lore-legacy-signatures.js'),require('./tavern-core.js'),require('node:crypto').webcrypto);else root.LoreCatalog=factory(root.DoupoLoreData,root.DoupoLoreLegacy,root.TavernCore,root.crypto);})(typeof globalThis!=='undefined'?globalThis:this,function(data,legacy,core,cryptoAPI){
 'use strict';
 const version=3,reportByCategory={'叙事边界':'07','修行体系':'03','人物':'02','地点':'06','势力':'05','功法斗技':'04','资源器物':'04','阶段秘闻':'01','事件线索':'01','异火':'04'};
 const generic=new Set(['修炼','斗气','境界','功法','斗技','异火','丹药','炼药师','魔兽','女王','公主','戒指','沙漠','主角','护法','殿主']);
 function rows(){return data.rows.concat(data.flames.map(f=>({id:'canon3-flame-'+f.rank,name:f.name,category:'异火',keys:f.keys,content:f.content,sourceType:f.sourceType,hidden:f.rank===1,rank:f.rank})));}
 function entries(){return rows().map(r=>({id:r.id,catalogKey:r.id,keys:[...new Set(r.keys.filter(Boolean))],secondaryKeys:[],content:r.name+'：'+r.content+(r.sourceType==='user-supplement'?'【项目补充设定】效果受境界、消耗与对抗条件约束。':''),comment:r.name,enabled:!r.hidden,constant:!!r.constant,selective:false,position:r.constant?0:1,priority:r.constant?1000:r.category==='修行体系'?240:r.category==='人物'?180:140,noRecurse:true,excludeRecursion:true,category:r.category,visibility:r.hidden?'阶段秘闻':'公开参考',sourceType:r.sourceType||'analysis-report',sourceReport:reportByCategory[r.category],catalogVersion:version}));}
 function create(createBook,createEntry){return createBook({name:'斗破苍穹世界观',catalogVersion:version,catalogRevision:1,engineVersion:2,entries:entries().map(e=>createEntry(e)),catalogSummary:{curated:entries().length,preserved:0,retired:0,hidden:entries().filter(e=>!e.enabled).length}});}
 async function digest(e){const bytes=new TextEncoder().encode(JSON.stringify([e.keys,e.content]));return Array.from(new Uint8Array(await cryptoAPI.subtle.digest('SHA-256',bytes))).map(n=>n.toString(16).padStart(2,'0')).join('');}
 function shares(a,b){return a.some(k=>!generic.has(k)&&b.includes(k));}
 async function upgrade(input){
  if(!input||input.name!=='斗破苍穹世界观'||input.catalogVersion>version||input.catalogVersion===version&&input.catalogRevision>=1||!Array.isArray(input.entries))return null;
  const book=core.clone(input),known=new Map(legacy.map(r=>[r.digest,r])),bundled=[],custom=[];
  for(const e of book.entries){const baseline=known.get(await digest(e));if(baseline)bundled.push({entry:e,baseline});else custom.push(e);}
  if(!bundled.length)return null; // A similarly named imported/custom book is not a bundled book.
  const used=new Set(custom.map(e=>e.id)),next=[],conflicts=[];
  for(const spec of entries()){
   if(custom.some(e=>shares(e.keys||[],spec.keys))){conflicts.push(spec.comment);continue;}
   const candidates=bundled.filter(x=>shares(x.entry.keys||[],spec.keys));
   const item=candidates.find(x=>!used.has(x.entry.id));
   if(item){spec.id=item.entry.id;used.add(spec.id);
    // Preserve a user's per-entry controls only where they differ from the bundled defaults.
    for(const key of ['position','constant','selective','secondaryKeys','selectiveLogic','priority','order','noRecurse','excludeRecursion']){
     if(Object.hasOwn(item.entry,key)&&(item.baseline.options[key]===undefined||JSON.stringify(item.entry[key])!==JSON.stringify(item.baseline.options[key])))spec[key]=core.clone(item.entry[key]);
    }
    if(item.entry.comment&&item.entry.comment!==item.baseline.comment&&item.entry.comment!=='原文校勘 · 创角规则修订')spec.comment=item.entry.comment;
   }
   if(!item){const base=spec.id;let n=1;while(used.has(spec.id))spec.id=base+'-'+n++;used.add(spec.id);}
   // Explicitly disabled old entries remain disabled, even when duplicates are consolidated.
   if(candidates.some(x=>x.entry.enabled===false||x.entry.disable===true))spec.enabled=false;
   next.push(spec);
  }
  book.entries=next.concat(custom);book.catalogVersion=version;book.catalogRevision=1;book.engineVersion=2;
  book.catalogSummary={curated:next.length,preserved:custom.length,retired:bundled.length,hidden:next.filter(e=>!e.enabled).length,conflicts};
  const archive=core.clone(input);archive.id=input.id+(input.catalogVersion===3?'-before-canon3-r1':'-before-canon3');archive.name=input.name+' · 升级前备份';archive.catalogArchive=true;archive.archivedFrom=input.id;archive.archiveVersion=version;
  return {book,archive};
 }
 function summary(book){const categories={};for(const e of book.entries||[])categories[e.category||'自定义保留']=(categories[e.category||'自定义保留']||0)+1;return categories;}
 return {version,entries,create,upgrade,digest,summary};
});
