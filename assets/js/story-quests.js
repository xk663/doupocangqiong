(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.StoryQuests=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const grades=['天','地','玄','黄'];
 function grade(q){const s=String(q.grade||q.difficulty||'');return grades.find(g=>s.includes(g))||({'简单':'黄','普通':'黄','低':'黄','中':'玄','中等':'玄','困难':'地','高':'地','极高':'天','极难':'天','致命':'天'}[s])||'黄';}
 function sort(rows){return rows.slice().sort((a,b)=>grades.indexOf(grade(a))-grades.indexOf(grade(b))||String(a.name).localeCompare(String(b.name),'zh-CN'));}
 const text=(v,n)=>typeof v==='string'?v.trim().slice(0,n):'';
 function hash(s){let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return(h>>>0).toString(36);}
 function ledger(value){const v=value||{};return {active:Array.isArray(v.active)?v.active.map(q=>({...q})):[],completed:Array.isArray(v.completed)?v.completed.map(q=>({...q})):[],failed:Array.isArray(v.failed)?v.failed.map(q=>({...q})):[]};}
 function extract(raw){let updates=[],errors=[];let cleaned=String(raw||'').replace(/<quest_updates>([\s\S]*?)<\/quest_updates>/gi,(_,body)=>{try{if(body.length>16000)throw Error('任务数据过长');const a=JSON.parse(body);if(!Array.isArray(a)||a.length>10)throw Error('每轮最多10条任务更新');updates.push(...a);}catch(e){errors.push(e.message);}return '';});if(/<quest_updates>/i.test(cleaned)){errors.push('任务块未结束');cleaned=cleaned.replace(/<quest_updates>[\s\S]*$/gi,'');}return {cleaned:cleaned.trim(),updates,errors};}
 function apply(value,updates,source){const next=ledger(value),changes=[];for(const u of (updates||[]).slice(0,10)){
  if(!u||typeof u!=='object'||Array.isArray(u))continue;
  if(u.action==='create'){
   const name=text(u.name,80),desc=text(u.desc,600),objective=text(u.objective,300);if(!name||!desc||!objective||!grades.includes(u.grade))continue;
   const id='story-'+hash(String(source)+'|'+name+'|'+objective);
   if([...next.active,...next.completed,...next.failed].some(q=>q.id===id||q.name===name&&q.objective===objective))continue;
   next.active.push({id,name,desc,objective,grade:u.grade,difficulty:u.grade+'阶',reward:text(u.reward,160)||'待实际结算',progress:text(u.progress,300)||'尚未开始',source:'story'});changes.push(name);
  }else if(['progress','complete','fail'].includes(u.action)){
   const i=next.active.findIndex(q=>q.id===u.id);if(i<0)continue;const q=next.active[i];
   if(u.action==='progress'){q.progress=text(u.progress,300)||q.progress;}
   else{if(!text(u.evidence,300))continue;next.active.splice(i,1);q.evidence=text(u.evidence,300);q.progress=q.evidence;next[u.action==='complete'?'completed':'failed'].push(q);}
   changes.push(q.name);
  }
 }
 if(next.active.length>100)throw Error('进行中的剧情任务已达100条，请先推进既有任务');
 return {ledger:next,changes};}
 function context(value){const rows=ledger(value).active;return rows.length?'【当前剧情任务】\n'+rows.map(q=>q.id+' | '+q.grade+'阶 | '+q.name+' | 目标：'+q.objective+' | 进展：'+q.progress).join('\n'):'';}
 const protocol='【情景任务记录】仅当正文实际出现委托、明确目标或已有任务的进展时，在正文末尾追加 <quest_updates>JSON数组</quest_updates>，不要每轮强制生成任务。新增格式：{"action":"create","name":"任务名","desc":"本轮情景依据","objective":"可判断完成的目标","grade":"黄","reward":"约定奖励描述","progress":"当前进展"}。难度由低到高黄、玄、地、天，结合玩家当前境界、危险、路程和稀缺条件评估。进展用 {"action":"progress","id":"已有story任务ID","progress":"本轮变化"}；完成或失败用 {"action":"complete或fail","id":"已有story任务ID","evidence":"正文中实际发生的证据"}。每轮最多10条。不操作map-任务，不捏造完成，不用任务块发金币、经验、物品或境界，奖励仍须在实际情景结算。';
 function visible(raw){return String(raw||'').replace(/<quest_updates>[\s\S]*?(?:<\/quest_updates>|$)/gi,'').trim();}
 return {grades,grade,sort,ledger,extract,apply,context,protocol,visible};
});
