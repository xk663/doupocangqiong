(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.OpenWorldRuntime=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const clone=v=>JSON.parse(JSON.stringify(v==null?null:v));
 const text=(v,n=1200)=>String(v==null?'':v).trim().slice(0,n);
 const arr=v=>Array.isArray(v)?v:[];
 function normalize(input){
  const s=clone(input||{});
  s.version=Number(s.version)||1;
  s.mode=['character','canon-character','omniscient'].includes(s.mode)?s.mode:'character';
  s.facts=arr(s.facts).filter(x=>x&&typeof x.id==='string').slice(-200);
  s.events=arr(s.events).filter(x=>x&&typeof x.id==='string').slice(-80);
  s.knowledge=arr(s.knowledge).filter(x=>x&&typeof x.subject==='string'&&typeof x.factId==='string').slice(-300);
  s.changes=arr(s.changes).filter(x=>x&&typeof x.id==='string').slice(-120);
  s.focus=arr(s.focus).filter(x=>typeof x==='string').slice(0,12);
  return s;
 }
 function normalizeCharacterCard(card){
  const c=clone(card||{}),p=c.openWorldProfile||{};
  c.openWorldProfile={identity:text(p.identity||c.name,120),motives:arr(p.motives).filter(x=>typeof x==='string').slice(0,8),boundaries:arr(p.boundaries).filter(x=>typeof x==='string').slice(0,8),capabilities:arr(p.capabilities).filter(x=>typeof x==='string').slice(0,12),knowledge:arr(p.knowledge).filter(x=>typeof x==='string').slice(0,24),currentIntent:text(p.currentIntent,240),mutable:arr(p.mutable).filter(x=>typeof x==='string').slice(0,12)};
  return c;
 }
 function visibleFacts(state,subject,omniscient){
  const s=normalize(state);
  if(omniscient)return s.facts;
  const known=new Set(s.knowledge.filter(k=>k.subject===subject||k.subject==='public').map(k=>k.factId));
  return s.facts.filter(f=>f.visibility==='public'||known.has(f.id));
 }
 function context(state,opts){
  const s=normalize(state),o=opts||{},mode=o.mode||s.mode,subject=o.subject||s.subject||'player',facts=visibleFacts(s,subject,mode==='omniscient');
  const lines=['【开放世界运行时】','视角模式：'+mode,'当前主体：'+text(subject,80)];
  if(s.location)lines.push('当前地点：'+text(s.location,120));
  if(s.scene)lines.push('当前场景：'+text(s.scene,240));
  if(s.objective)lines.push('当前目标：'+text(s.objective,240));
  if(facts.length)lines.push('已确认事实：\n'+facts.slice(-24).map(f=>'- '+text(f.statement||f.text,300)).join('\n'));
  if(s.focus.length)lines.push('当前关注：'+s.focus.map(x=>text(x,80)).join('、'));
  lines.push('【斗破世界观与开放演绎边界】');
  lines.push('允许为当前场景补充合理、低风险的细节与机会，例如人流、店铺、门禁、费用、天气、普通路人、临时传闻和局部路线；它们可以推动开放探索，但应保留玩家是否接受、绕行、交涉或离开的选择。');
  lines.push('新细节须符合当前已知地点、地区风俗、势力层级、故事阶段和斗破苍穹世界设定；临场补写只确立为当前场景事实，不冒充原著定论、既有档案或所有人都知道的消息。若细节会决定重大剧情、角色身份、势力格局、唯一通路或玩家资源，先作为传闻、线索或待确认可能性呈现。');
  lines.push('斗气境界名称与顺序严格采用本项目及已确认设定：斗之气一至九段、斗者、斗师、大斗师、斗灵、斗王、斗皇、斗宗、斗尊、半圣、斗圣、斗帝；段数、星级和阶段按对应境界规则表达。不得移植其他作品的修炼阶序、魔法体系或自创层级。斗气境界与灵魂境界分开记录，不互相替代。');
  lines.push('人物实力须符合身份、职责、所属势力、所在地区、故事阶段和已知档案。普通城镇、商铺或寻常关卡的守卫按当地职责与势力底蕴设定，不得仅为拦住玩家而临时拔高多个大境界；高阶护卫只在已知的强势势力或重要人物背景足以支撑时出现。无可靠依据时不报具体境界或星级，以可观察举止、装备、气息或不确定性描写；日常通行阻碍优先采用查验、排队、费用、礼节或交涉等合乎情境的方式，并保留其他行动路线。');
  lines.push('保持斗破苍穹的人物底色和世界规则；玩家可以自由行动，不强制进入下一事件；人物只使用有依据的知识，状态变化须有事件或正文依据。');
  return lines.join('\n');
 }
 function record(state,change){
  const s=normalize(state),c=clone(change||{});
  if(!c.id)c.id='change-'+Date.now();
  c.at=Number(c.at)||Date.now();
  s.changes.push(c);s.changes=s.changes.slice(-120);
  if(c.fact&&c.fact.id){s.facts=s.facts.filter(f=>f.id!==c.fact.id);s.facts.push(c.fact);}
  return s;
 }
 function openEvents(state,opts){
  const s=normalize(state),o=opts||{},focus=new Set(arr(o.focus||s.focus));
  return s.events.filter(e=>e.status!=='closed'&&(!focus.size||!e.tags||e.tags.some(t=>focus.has(t)))).map(e=>({id:e.id,title:text(e.title,100),pressure:text(e.pressure,240),opportunities:arr(e.opportunities).slice(0,5),status:e.status||'possible'}));
 }
 function applyPatch(state,patch){
  const s=normalize(state),p=patch||{};
  if(p.mode&&['character','canon-character','omniscient'].includes(p.mode))s.mode=p.mode;
  if(typeof p.location==='string')s.location=text(p.location,120);
  if(typeof p.scene==='string')s.scene=text(p.scene,240);
  if(typeof p.objective==='string')s.objective=text(p.objective,240);
  if(Array.isArray(p.focus))s.focus=p.focus.filter(x=>typeof x==='string').slice(0,12);
  if(Array.isArray(p.facts))s.facts=p.facts.filter(x=>x&&typeof x.id==='string').slice(-200);
  if(Array.isArray(p.events))s.events=p.events.filter(x=>x&&typeof x.id==='string').slice(-80);
  if(Array.isArray(p.knowledge))s.knowledge=p.knowledge.filter(x=>x&&typeof x.subject==='string'&&typeof x.factId==='string').slice(-300);
  for(const c of arr(p.changes))record(s,c);
  return s;
 }
 return {version:1,normalize,normalizeCharacterCard,visibleFacts,context,record,openEvents,applyPatch};
});
