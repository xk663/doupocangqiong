(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./battle-engine.js'),require('./battle-rules.js'));else root.BattleCore=factory(root.BattleEngine,root.BattleRules);})(globalThis,function(engine,BattleRules){
'use strict';
const clone=x=>JSON.parse(JSON.stringify(x)),text=(x,n=200)=>typeof x==='string'?x.trim().slice(0,n):'',clamp=(x,a,b)=>Math.min(b,Math.max(a,x)),num=(x,d,a,b)=>Number.isFinite(Number(x))?clamp(Number(x),a,b):d;
function settings(x={}){return{enabled:x?.enabled===true,animation:x?.animation!==false,playback:[.5,1,2].includes(Number(x?.playback))?Number(x.playback):1,showIntent:x?.showIntent!==false,autoReport:x?.autoReport!==false};}
function visible(s){return String(s||'').replace(/<battle_updates\b[^>]*>[\s\S]*?(?:<\/battle_updates>|$)/gi,'').replace(/<battle_[a-z_]*$/i,'').trim();}
function extract(raw){const errors=[];let data=null;const cleaned=String(raw||'').replace(/<battle_updates>([\s\S]*?)<\/battle_updates>/gi,(_,s)=>{try{if(data||s.length>16000)throw Error('战斗块重复或过长');const v=JSON.parse(s);if(!v||Array.isArray(v)||typeof v!=='object')throw Error('战斗块格式无效');data=v;}catch(e){errors.push(e.message);}return '';});if(/<battle_updates>/i.test(cleaned))errors.push('战斗块未完整结束');return{data,cleaned:visible(cleaned),errors};}
function story(raw){const s=visible(raw).replace(/<(thinking|think)>[\s\S]*?<\/\1>/gi,'');const m=s.match(/<(?:maintext|content)>([\s\S]*?)<\/(?:maintext|content)>/i)||s.match(/(?:^|\n)##\s*maintext\s*\n([\s\S]*?)(?=\n##\s|$)/i);return (m?m[1]:s.replace(/(?:^|\n)##\s*(thinking|think|sum|vars|option)\s*\n[\s\S]*?(?=\n##\s|$)/gi,'')).replace(/<[^>]+>/g,'');}
const forbidden=/据说|传闻|或许|可能|假如|如果|曾经|当年|昔日|尚未|并未|没有|未能|未曾|不曾/;
const effects={burn:/灼烧|持续燃烧/,slow:/减速|迟缓|行动变慢/,haste:/加速|提升速度|速度提升/,interrupt:/打断.*蓄力/};
const regexEscape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function learnedByPlayer(e,p){return new RegExp('^(?:你'+(p.name?'|'+regexEscape(p.name):'')+')(?:已|已经|终于|成功|刚刚|如今|现在|新近|彻底|真正|完全|熟练|首次|也|还|又|自行|独自|现已|正式|并){0,4}(?:学会|掌握|领悟|创出)').test(e);}
function involvesPlayer(e,p){const who='(?:你'+(p.name?'|'+regexEscape(p.name):'')+')';return new RegExp('(?:向|对|朝|拦住|扑向|袭向|攻击|挑战|迎战|与)'+who+'|'+who+'(?:向|对|朝|迎战|攻击|挑战)').test(e);}
const hash=s=>{let n=2166136261;for(const c of s)n=Math.imul(n^c.charCodeAt(0),16777619);return(n>>>0).toString(36);};
function skill(x){const name=text(x?.name,40);if(!name)return null;const grade=['黄','玄','地','天'].includes(x.grade)?x.grade:'黄',tier=['黄','玄','地','天'].indexOf(grade),effect=['burn','slow','haste','interrupt'].includes(x.effect)?x.effect:'none';return{id:'story-'+hash(name),name,source:text(x.source,20)||'正文习得',grade,effect,power:effect==='haste'?0:1.1+tier*.25,cost:35+tier*20+(effect==='none'?0:20),cooldown:effect==='none'?1:2,chance:effect==='burn'?.7:1,evidence:text(x.evidence,500),messageId:text(x.messageId,100)};}
function auditSkills(player,chat){
 const p=player||{},known=new Set((p.battleSkills||[]).map(x=>x.name)),rows=[],seen=new Set();
 for(const m of Array.isArray(chat?.messages)?chat.messages:[]){
  if(m?.role!=='assistant'||typeof m.content!=='string')continue;
  for(const sentence of story(m.content).split(/[。！？\n]/)){
   const evidence=sentence.trim();if(!learnedByPlayer(evidence,p)||forbidden.test(evidence))continue;
   const bracket=evidence.match(/[《「【]([^》」】]{1,40})[》」】]/);
   const recorded=(p.skills||[]).find(x=>x?.name&&evidence.includes(x.name));
   // Ambiguous unquoted names are not guessed from whole sentences.
   const name=bracket?.[1]||recorded?.name;if(!name||known.has(name)||seen.has(name))continue;
   seen.add(name);
   const grade=evidence.match(/([黄玄地天])阶/)?.[1];
   const effect=Object.keys(effects).find(k=>effects[k].test(evidence))||'none';
   const actionable=effect!=='none'||/攻击|伤害|击打|击碎|劈开/.test(evidence);
   rows.push({name,evidence,messageId:m.id,grade:grade||null,effect,ready:!!grade&&actionable,reason:!grade?'正文未明确技能品阶':!actionable?'正文未明确战斗效果':''});
  }
 }
 return rows.slice(0,40);
}
function backfillSkills(player,chat){
 const rows=auditSkills(player,chat);let next=clone(player);const pending=[];
 for(const row of rows){
  if(!row.ready){pending.push(row);continue;}
  const source=chat.messages.find(m=>m.id===row.messageId);
  next=apply(next,{skills:[row]},source.content,row.messageId,true).player;
 }
 return{player:next,pending,added:(next.battleSkills||[]).length-(player.battleSkills||[]).length};
}
function apply(player,data,raw,messageId,enabled){const p=clone(player),errors=[],body=story(raw),list=Array.isArray(p.battleSkills)?p.battleSkills.map(skill).filter(Boolean).slice(0,60):[];let offer=null;if(!enabled||!data)return{player:p,offer,errors};
 for(const x of (Array.isArray(data.skills)?data.skills:[]).slice(0,8)){const name=text(x?.name,40),evidence=text(x?.evidence,500);if(!name||evidence.length<8||!body.includes(evidence)||!evidence.includes(name)||forbidden.test(evidence)||!learnedByPlayer(evidence,p)){errors.push('技能缺少本轮正文的明确习得证据');continue;}const effect=Object.hasOwn(effects,x.effect)&&effects[x.effect].test(evidence)?x.effect:'none';const s=skill({...x,effect,messageId});const old=list.findIndex(a=>a.id===s.id);if(old<0&&list.length<60)list.push(s);else if(old>=0)list[old]=s;p.skills=Array.isArray(p.skills)?p.skills:[];if(!p.skills.some(a=>a?.name===name))p.skills.push({name,grade:s.grade,type:text(x.source,20)||'斗技',desc:evidence});}
 p.battleSkills=list;
 const recovery=text(data.recovery?.evidence,500);if(recovery&&body.includes(recovery)&&!forbidden.test(recovery)&&(recovery.startsWith('你')||p.name&&recovery.startsWith(p.name))){const v={...(p.combatVitals||{hpRatio:1,qiRatio:1})};if(/气血(?:已)?完全恢复/.test(recovery))v.hpRatio=1;if(/斗气(?:已)?完全恢复/.test(recovery))v.qiRatio=1;p.combatVitals=v;}
const e=data.encounter;if(e){const name=text(e.enemyName,40),realm=text(e.realm,40),evidence=text(e.evidence,500);if(name&&realm&&body.includes(evidence)&&evidence.includes(name)&&evidence.includes(realm)&&evidence.length>=8&&!forbidden.test(evidence)&&involvesPlayer(evidence,p)&&/袭|攻击|挑战|迎战|拦|扑|挥刀|交战|战斗/.test(evidence))offer={version:1,id:'battle-'+hash(messageId+'|'+name),sourceMessageId:messageId,status:'offered',enemyName:name,realm,evidence,kind:e.kind==='beast'?'beast':'human',behavior:['cautious','aggressive','agile'].includes(e.behavior)?e.behavior:'cautious',skills:Array.isArray(e.skills)?e.skills.slice(0,20):[],enemyStats:e.enemyStats||{},locationId:e.locationId||'',seed:'battle-'+hash(messageId+'|'+name)};else errors.push('遭遇缺少明确对手、境界或本轮正文证据');}
 return{player:p,offer,errors};
}
const ranks=['斗之气','斗者','斗师','大斗师','斗灵','斗王','斗皇','斗宗','斗尊','半圣','斗圣','斗帝'];
function rank(realm){const s=text(realm,60);let i=-1;for(let k=ranks.length-1;k>=0;k--)if(s.includes(ranks[k])){i=k;break;}return i<0?0:i;}
function fighter(p){
 const rules=BattleRules.deriveStats(p),v=p.combatVitals;
 return {...rules,name:text(p.name,40)||'修炼者',realm:text(p.realm,40)||'斗之气',
  hp:v?Math.round(rules.maxHp*num(v.hpRatio,1,0,1)):rules.maxHp,
  qi:v?Math.round(rules.maxQi*num(v.qiRatio,1,0,1)):rules.maxQi,
  hit:.9,dodge:.08,behavior:p.behavior||'cautious',
  skills:(p.battleSkills||[]).map(skill).filter(Boolean).slice(0,60)};
}
function begin(offer,player,rng){if(offer?.status!=='offered')throw Error('遭遇已处理');const p=fighter(player),seed=offer.seed||('battle-seed-'+offer.id);if(p.hp<=0)throw Error('当前气血不足，请先在正文中恢复');const enemy=fighter({name:offer.enemyName,realm:offer.realm,behavior:offer.behavior||'cautious',baseStats:offer.enemyStats||{}});enemy.skills=(offer.skills||[]).map(skill).filter(Boolean);const s=engine.fresh();s.integrated=true;s.player=p;s.enemy=enemy;s.enemyIntent={type:'attack'};s.kind=offer.kind;s.locationId=offer.locationId||'';s.heroGender=player.gender;s.round=0;s.seed=seed;s.rngIndex=0;const random=rng||BattleRules.createRng(seed);engine.start(s,random);if(Number.isFinite(random.index))s.rngIndex=random.index;return{...clone(offer),status:s.phase==='ended'?'report-pending':'active',state:s,owner:player.name,revision:0,seed};}
function transition(b,action,rng){if(b?.status!=='active'||b.state?.phase!=='battle')throw Error('战斗已结束或尚未开始');if(!['attack','guard','pass','skill','surrender'].includes(action?.type))throw Error('行动无效');const next=clone(b),random=rng||(typeof BattleRules!=='undefined'&&next.seed?BattleRules.createRng(next.seed,next.state.rngIndex||0):undefined);engine.act(next.state,{type:action.type,id:text(action.id,100)},random);if(random&&Number.isFinite(random.index))next.state.rngIndex=random.index;next.revision=(next.revision||0)+1;if(next.state.phase==='ended')next.status='report-pending';return next;}
function settle(player,b){if(b?.status!=='report-pending'||b.state?.phase!=='ended')throw Error('战斗未结束');const p=clone(player);p.combatVitals={hpRatio:b.state.player.hp/b.state.player.maxHp,qiRatio:b.state.player.qi/b.state.player.maxQi,battleId:b.id};p.stateChanges=Array.isArray(p.stateChanges)?p.stateChanges:[];if(!p.stateChanges.some(x=>x&&x.sourceId===b.id))p.stateChanges.push({id:'combat-'+b.id,source:'battle',sourceId:b.id,changeType:'combatVitals',reason:'战斗结算：'+b.state.result,before:{hpRatio:Number.isFinite(Number(player?.combatVitals?.hpRatio))?Number(player.combatVitals.hpRatio):1,qiRatio:Number.isFinite(Number(player?.combatVitals?.qiRatio))?Number(player.combatVitals.qiRatio):1},after:{hpRatio:p.combatVitals.hpRatio,qiRatio:p.combatVitals.qiRatio},changes:{hpRatio:p.combatVitals.hpRatio,qiRatio:p.combatVitals.qiRatio},cause:'battle',evidence:'本地战斗引擎结算记录',sourceMessageId:b.sourceMessageId||'',reversible:false,writeBackTarget:'player.combatVitals',at:Date.now()});p.stateChanges=p.stateChanges.slice(-100);return p;}
function resultRecord(b){const s=b.state;return{battleId:b.id,result:s.result,locationId:b.locationId||'',participants:[s.player.name,s.enemy.name],playerState:{hpRatio:s.player.hp/s.player.maxHp,qiRatio:s.player.qi/s.player.maxQi},enemyState:{status:s.result==='win'?'defeated':s.result==='lose'?'victorious':'survived'},keyActions:s.log.slice(-12),consumedResources:[],gainedResources:[],worldChanges:[],memoryFacts:['战斗结果：'+s.player.name+(s.result==='win'?'击败':'与')+s.enemy.name],openEvents:[]};}
function report(b){return engine.report(b.state)+'\n结算编号：'+b.id+'\n'+JSON.stringify(resultRecord(b))+'\n气血与斗气已在本地结算，禁止重复扣除。仅续写结果、人物反应和后续情节；不自动发放金币、物品或经验，不立即重复触发本场遭遇。';}
function validate(b){if(!b)return true;if(!b.id||!['offered','declined','active','report-pending','reported'].includes(b.status))throw Error('战斗存档无效');if(b.state){const s=b.state;if(!s.integrated||!['battle','ended'].includes(s.phase)||!Array.isArray(s.log)||!s.queue||!s.status||!s.cooldowns||!s.guard||!s.meter)throw Error('战斗状态无效');for(const side of ['player','enemy']){const p=s[side];for(const key of ['hp','maxHp','qi','maxQi','attack','defense','speed','hit','dodge'])if(!Number.isFinite(p?.[key])||p[key]<0)throw Error('战斗数值无效');if(p.maxHp<=0||p.maxQi<=0||p.speed<=0||p.hp>p.maxHp||p.qi>p.maxQi||!Array.isArray(p.skills)||!Number.isFinite(s.meter[side]))throw Error('战斗存档范围无效');}if(b.status==='active'&&(s.phase!=='battle'||s.queue[0]!=='player'))throw Error('战斗行动队列无效');}else if(['active','report-pending'].includes(b.status))throw Error('缺少战斗进度');return true;}
function context(p,cfg){if(!settings(cfg).enabled)return'';return '【本地战斗模式】仅一对一。本地战斗机制替代旧的空 <battle></battle> 触发标签及自动战斗推演规则；不要再输出旧标签，时空状态栏中的战斗输出也使用 battle_updates。战斗由前端计算；正文只提出遭遇，不提前决定胜负，不代替玩家行动。仅在本轮可见正文有明确证据时，于正文外追加一个 <battle_updates>JSON对象</battle_updates>。纯文本模式也允许此后台元数据。格式：{"skills":[{"name":"技能名","grade":"黄","source":"斗技","effect":"none","evidence":"你已掌握……"}],"encounter":{"enemyName":"对手姓名","realm":"斗者一星","kind":"human","evidence":"含对手姓名、当前境界、向你发起挑战等实际交战行为的完整原句"}}。skills只记录玩家本轮明确学会/掌握/领悟/创出的技能，不记录NPC、想学、传闻或仅拥有秘籍。evidence须逐字摘录可见正文，技能证据以“你”或玩家姓名开头。grade仅天地玄黄；effect仅none/burn/slow/haste/interrupt，特殊效果也必须在证据中明确说明。敌人kind为human或beast。只有正文明确写出玩家“气血已完全恢复”或“斗气已完全恢复”时，可加recovery:{evidence:逐字原句}，证据以“你”或玩家姓名开头，前端据此恢复对应资源；休息不等于恢复。没有已知境界或明确交战就不输出encounter；不得为了规则格式编造事实。后端未知字段不生效。已收录战斗技能：'+JSON.stringify((p.battleSkills||[]).map(s=>({name:s.name,effect:s.effect})))+'。当前本地剩余比例：'+JSON.stringify(p.combatVitals||{hpRatio:1,qiRatio:1})+'。收到【战斗记录】后只能根据既定结果继续正文。';}
return{settings,visible,extract,story,apply,skill,auditSkills,backfillSkills,fighter,begin,transition,settle,resultRecord,report,validate,context,rank};
});





