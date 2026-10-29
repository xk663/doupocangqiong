(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.MemoryCore=factory();})(globalThis,function(){
 'use strict';
 const clone=v=>JSON.parse(JSON.stringify(v==null?null:v));
 const list=v=>Array.isArray(v)?v:[];
 const text=(v,n=1000)=>String(v??'').trim().slice(0,n);
 function normalize(raw){const m=clone(raw||{});return {version:2,
  small:list(m.small).filter(x=>x&&x.id&&x.text).slice(-60),large:list(m.large).filter(x=>x&&x.id&&x.text).slice(-20),
  facts:list(m.facts).filter(x=>x&&x.id&&x.text).slice(-80),threads:list(m.threads).filter(x=>x&&x.id&&x.text).slice(-30),
  stats:{messages:Number(m.stats?.messages)||0,compressed:Number(m.stats?.compressed)||0,updatedAt:Number(m.stats?.updatedAt)||0}};}
 function visible(raw){
  const s=String(raw||'').replace(/<(think|thinking)>[\s\S]*?<\/\1>/gi,'');
  const body=s.match(/<(?:maintext|content)>([\s\S]*?)<\/(?:maintext|content)>/i)||s.match(/(?:^|\n)##\s*maintext\s*\n([\s\S]*?)(?=\n##\s|$)/i);
  return (body?body[1]:s.replace(/<([\w]+_updates|vars|sum|option|upstore|world_action)>[\s\S]*?<\/\1>/gi,'').replace(/(?:^|\n)##\s*(thinking|think|vars|sum|option)\s*\n[\s\S]*?(?=\n##\s|$)/gi,'')).replace(/<[^>]*>/g,'').trim();
 }
 // Extractive excerpts, not semantic summaries; keep the beginning and the result.
 function excerpt(value,limit=420){const s=visible(value);if(s.length<=limit)return s;const half=Math.floor((limit-12)/2);return s.slice(0,half)+'\n…〔中段省略〕…\n'+s.slice(-half);}
 function build(messages,old){
  const m=normalize(old),rows=list(messages),small=[];
  for(let start=0;start<rows.length;start+=8){
   const group=rows.slice(start,start+8).map((x,i)=>({...x,position:start+i})).filter(x=>['user','assistant'].includes(x.role)&&visible(x.content));
   if(!group.length)continue;
   small.push({id:'excerpt-'+start,kind:'extractive',text:group.map(x=>'['+(x.position+1)+'楼] '+(x.role==='user'?'用户：':'正文：')+excerpt(x.content)).join('\n'),range:{start,end:start+Math.min(8,rows.length-start)},sourceMessageIds:group.map(x=>x.id).filter(Boolean),weight:group.length});
  }
  m.small=small.slice(-60);m.large=[];
  const older=m.small.slice(0,-6);
  for(let i=0;i<older.length;i+=4){const group=older.slice(i,i+4);m.large.push({id:'index-'+group[0].range.start,kind:'extractive',text:group.map(x=>'['+(x.range.start+1)+'–'+x.range.end+'楼] '+excerpt(x.text,800)).join('\n'),range:{start:group[0].range.start,end:group.at(-1).range.end},sourceMessageIds:group.flatMap(x=>x.sourceMessageIds)});}
  m.stats={messages:rows.length,compressed:m.small.length,updatedAt:Date.now()};return m;
 }
 function context(raw,options={}){
  const m=normalize(raw),parts=[],used=new Set(),recent=m.small.slice(-(options.smallLimit||6));
  const recentIds=new Set(recent.flatMap(x=>x.sourceMessageIds||[]));
  const old=m.large.filter(x=>x.kind==='extractive'&&!(x.sourceMessageIds||[]).some(id=>recentIds.has(id))).slice(-(options.largeLimit||4));
  function add(label,rows){const unique=rows.map(x=>x.text).filter(s=>{if(used.has(s))return false;used.add(s);return true;});if(unique.length)parts.push(label+'：\n'+unique.map(s=>'- '+s).join('\n'));}
  add('历史摘录索引',old);add('近期正文摘录',recent);add('已确认事实',m.facts.slice(-(options.factLimit||12)));add('未完事项',m.threads.slice(-8));
  return parts.length?'【内置记忆表】\n'+parts.join('\n')+'\n摘录包含省略，不是完整事实库；可按楼层核对原文。与当前状态冲突时，以最近明确消息和当前世界状态为准。':'';
 }
 function add(raw,key,value,source={}){const m=normalize(raw),t=text(value,600);if(!t||m[key].some(x=>x.text===t))return m;m[key].push({id:key+'-'+Date.now()+'-'+m[key].length,text:t,source:source.kind||'player',sourceMessageId:text(source.messageId,100),sourceId:text(source.id,100),createdAt:Date.now()});return normalize(m);}
 return {version:2,normalize,visible,excerpt,build,context,addFact:(m,v,s)=>add(m,'facts',v,s),addThread:(m,v,s)=>add(m,'threads',v,s)};
});
