(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.FlameCore=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const stages={unknown:'未获线索',heard:'听闻',traced:'发现踪迹',contact:'接触',attempt:'尝试收服',owned:'已收服',lost:'已失去',failed:'尝试失败'};
 const sources={rumor:'传闻',told:'人物告知',seen:'亲眼所见',confirmed:'正文证实',refuted:'已被推翻'};
 const text=(v,n=300)=>typeof v==='string'?v.trim().slice(0,n):'';
 const hash=s=>{let n=2166136261;for(const c of s){n^=c.charCodeAt(0);n=Math.imul(n,16777619);}return (n>>>0).toString(36);};
 function state(value){const records={};for(const [rank,r]of Object.entries(value?.records||{})){if(!/^([1-9]|1[0-9]|2[0-3])$/.test(rank)||!r||typeof r!=='object')continue;records[rank]={stage:Object.hasOwn(stages,r.stage)?r.stage:'unknown',holder:text(r.holder,60),events:(Array.isArray(r.events)?r.events:[]).slice(-20).map(e=>({id:text(e.id,100),kind:text(e.kind,30),source:Object.hasOwn(sources,e.source)?e.source:'rumor',evidence:text(e.evidence,500),time:text(e.time,100),place:text(e.place,100),nodeId:text(e.nodeId,80)}))};}return {version:1,records};}
 function visible(raw){return String(raw||'').replace(/<flame_updates>[\s\S]*?(?:<\/flame_updates>|$)/gi,'').trim();}
 function extract(raw){const updates=[],errors=[];let cleaned=String(raw||'').replace(/<flame_updates>([\s\S]*?)<\/flame_updates>/gi,(_,s)=>{try{if(s.length>16000)throw Error('异火记录过长');const a=JSON.parse(s);if(!Array.isArray(a)||a.length>8)throw Error('每轮最多8项异火记录');updates.push(...a);}catch(e){errors.push(e.message);}return '';});if(/<flame_updates>/i.test(cleaned)){errors.push('异火记录未结束');cleaned=visible(cleaned);}return {cleaned:cleaned.trim(),updates,errors};}
 function bodyText(raw){const s=String(raw||''),m=s.match(/<maintext>([\s\S]*?)<\/maintext>/i)||s.match(/(?:^|\n)##\s*maintext\s*\n([\s\S]*?)(?=\n##\s|$)/i);return m?m[1]:s.replace(/<(thinking|think)>[\s\S]*?<\/\1>/gi,'').replace(/(?:^|\n)##\s*(?:thinking|think|sum|vars|option)\s*\n[\s\S]*?(?=\n##\s|$)/gi,'');}
 function apply(value,updates,{body='',catalog=[],nodes=[],known=[],time='',turn='',playerName=''}={}){const next=state(value),errors=[],changes=[],story=bodyText(body);
  for(const u of (Array.isArray(updates)?updates:[]).slice(0,8)){const f=catalog.find(f=>f.rank===Number(u?.rank)),evidence=text(u?.evidence,500);if(!f||evidence.length<5||!story.includes(evidence)||!evidence.includes(f.name)){errors.push('异火记录缺少同名正文证据');continue;}
   const old=next.records[f.rank]||{stage:'unknown',holder:'',events:[]},source=Object.hasOwn(sources,u.source)?u.source:'rumor',uncertain=/据说|传闻|听说|或许|可能|假如|如果|尚未|未曾|并未|没有|未能|未成功|未收服|未炼化|不曾/.test(evidence)||['rumor','told','refuted'].includes(source);
   let stage=Object.hasOwn(stages,u.stage)?u.stage:old.stage;
   if(['owned','lost','attempt','contact','traced'].includes(stage)&&(uncertain||/曾经|当年|昔日|过去/.test(evidence)))stage=old.stage==='unknown'?'heard':old.stage;
   if(stage==='failed'&&['rumor','told','refuted'].includes(source))stage=old.stage;
   if(stage==='owned'&&!/(成功|彻底|已经|已将|已被).*(收服|炼化)|(收服|炼化).*(成功|完成)/.test(evidence))stage=old.stage;
   if(stage==='lost'&&!/失去|夺走|剥离|转交/.test(evidence))stage=old.stage;
   if(stage==='failed'&&!/失败|未能|失控/.test(evidence))stage=old.stage;
   if(stage==='attempt'&&!/尝试|开始|试图|着手/.test(evidence))stage=old.stage;
   if(stage==='contact'&&!/见到|眼前|接触|触及|靠近|面对|发现/.test(evidence))stage=old.stage;
   if(stage==='traced'&&!/位置|踪迹|发现|找到|气息|痕迹/.test(evidence))stage=old.stage;
   if(stage==='owned'&&(!playerName||text(u.holder,60)!==playerName||!evidence.includes(playerName)))stage=old.stage;
   let holder=stage==='lost'?'':old.holder;const name=text(u.holder,60);if(name&&evidence.includes(name)&&!uncertain&&!/曾经|当年|昔日|过去/.test(evidence)&&/(持有|掌控|收服|炼化|夺得)/.test(evidence))holder=name;
   const node=nodes.find(n=>n.id===u.nodeId&&known.includes(n.id)&&evidence.includes(n.name));
   const kind=['discovery','contest','refine','failure','loss','fusion','relation','clue'].includes(u.kind)?u.kind:'clue';
   const id=hash(turn+'|'+f.rank+'|'+kind+'|'+evidence);if(old.events.some(e=>e.id===id))continue;
   const date=text(u.time,100);const event={id,kind,source,evidence,time:date&&story.includes(date)?date:text(time,100)||'正文时间未明确',place:text(u.place,100),nodeId:node?.id||''};if(event.place&&!evidence.includes(event.place))event.place='';
   next.records[f.rank]={stage,holder,events:old.events.concat(event).slice(-20)};changes.push(f.rank);
  }return {state:next,changes,errors};
 }
 function context(value,catalog=[]){const s=state(value);for(const r of Object.values(s.records))r.events=r.events.slice(-3);return '【本次人生异火档案】仅为已记录事实，不自动授予火种或战力；未知持有者不得按原著补齐。\n名录：'+JSON.stringify(catalog.map(f=>({rank:f.rank,name:f.name})))+'\n'+JSON.stringify(s);}
 const protocol='【异火事件记录】正文实际提及异火发现、争夺、接触、炼化、失败、失去、融合或情报时，可末尾追加 <flame_updates>JSON数组</flame_updates>，最多8项。格式 {"rank":19,"stage":"heard","kind":"clue","source":"rumor","evidence":"含异火全名的逐字正文原句","holder":"仅正文明确的持有者，可省略","place":"原句中的地点，可省略","nodeId":"仅地图已知节点ID，可省略","time":"正文日期，可省略"}。stage可为heard/traced/contact/attempt/owned/lost/failed；kind可为clue/discovery/contest/refine/failure/loss/fusion/relation；source可为rumor/told/seen/confirmed/refuted。传闻、人物告知不得证明收服；owned仅在正文明确成功收服或炼化时记录。不同本体、子火和火种应在证据说明，不把曾经持有写成现在持有。不改地图、资源、能力、实力；失败也记经过。没有发生则不输出。';
 return {stages,sources,state,visible,extract,apply,context,protocol};
});
