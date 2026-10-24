/* Character creation presentation. Existing player/save IDs remain stable. */
var CreationUI=(function(){
  'use strict';
  const steps=[['落笔','姓名与旅程'],['血脉','种族与来处'],['出身','身份与志向'],['根基','六维与潜力'],['天赋','禀赋与属性'],['启程','行囊与初见']];
  let identityFilter='全部',talentFilter='common';
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const p=()=>GameState.player;
  const catalog=()=>({races:RACES,identities:IDENTITIES,tiers:TALENT_TIERS,talents:TALENTS,attrs:DOUQI_ATTRS,difficulties:DIFFICULTY});
  const name=(list,id,fallback='待选择')=>list.find(x=>x.id===id)?.name||fallback;
  function heading(kicker,title,desc){return '<header class="creation-page-heading"><span class="creation-eyebrow">'+kicker+'</span><h2 id="creation-page-title" tabindex="-1">'+title+'</h2><p>'+desc+'</p></header>';}
  function card(id,title,desc,cost,selected,mark,action,badge=''){
    return '<button type="button" class="creation-choice'+(selected?' selected':'')+'" data-choice="'+id+'" onclick="'+action+'" aria-pressed="'+selected+'"><span class="choice-top"><span class="choice-mark" aria-hidden="true">'+mark+'</span><span class="choice-cost">'+(cost===null?'':cost+' 点')+'</span></span><span class="choice-name">'+esc(title)+'<span class="choice-check" aria-hidden="true">✓</span></span><span class="choice-desc">'+esc(desc)+'</span>'+(badge?'<span class="choice-badge">'+esc(badge)+'</span>':'')+'</button>';
  }
  function panel(title,body,extra=''){return '<section class="creation-panel '+extra+'"><h3>'+title+'</h3>'+body+'</section>';}
  function save(){recalculatePoints();updatePerformanceStats();summary();saveToLocalStorage();}
  function summary(){
    if(!$('creation-person-name'))return;
    $('creation-person-name').textContent=p().name||'无名修行者';
    $('creation-person-meta').textContent=name(RACES,p().race)+' · '+name(IDENTITIES,p().identity);
    $('creation-mode-label').textContent=CreationRules.isFree(p())?'自由演绎':'原著框架';
    $('creation-summary-origin').textContent=name(CreationRules.places,p().startLocation);
    $('creation-summary-attrs').textContent=(p().douqiAttributes||[]).map(id=>name(DOUQI_ATTRS,id,'')).join('、')+(p().woodAffinity?' · 木气':'')||'尚未感应';
    $('creation-summary-talents').textContent=(p().talents||[]).length+' 项';
    $('creation-budget-detail').textContent='已用 '+p().pointsSpent+' / '+p().points+' 点';
    $('creation-progress-label').textContent=String(creationCurrentStep+1).padStart(2,'0')+' / 06';
    $('creation-step-hint').textContent=steps[Math.max(0,creationCurrentStep)][1];
    const progress=$('creation-budget-progress');if(progress)progress.style.width=Math.min(100,p().pointsSpent/Math.max(1,p().points)*100)+'%';
  }
  function go(step,restore=false){
    step=Math.max(0,Math.min(5,step));
    if(!restore&&step>creationCurrentStep){
      for(let at=0;at<step;at++){
        const error=CreationRules.validate(p(),catalog(),at)[0];
        if(error){showToast(error.message,'error');return;}
      }
    }
    creationCurrentStep=step;p().creationStep=step;recalculatePoints();updatePerformanceStats();render(step);updateStepIndicator();summary();
    $('creation-prev').hidden=step===0;$('creation-prev').style.display=step===0?'none':'';
    $('creation-next').textContent=step===5?'落笔成书 · 踏入大陆':'继续 · '+steps[Math.min(5,step+1)][0]+' →';
    $('creation-next').disabled=false;
    $('creation-content').scrollTop=0;
    $('creation-page-title')?.focus({preventScroll:true});
    saveToLocalStorage();
  }
  function render(step){
    if(step===0)basic();if(step===1)race();if(step===2)identity();if(step===3)stats();if(step===4)talents();if(step===5)departure();
    summary();
  }
  function basic(){
    const genders=[['male','男'],['female','女'],['futa','自定义']];
    $('creation-content').innerHTML=heading('CHAPTER 01 / 初入此世','写下你的名字','从一个名字开始。山河辽阔，你的故事还未落笔。')+
      '<div class="creation-basic-layout">'+panel('你的身份',
        '<label class="creation-label" for="input-name">姓名</label><div class="creation-name-row"><input id="input-name" class="creation-input" maxlength="20" placeholder="为这段人生取一个名字" value="'+esc(p().name)+'" oninput="CreationUI.field(\'name\',this.value)"><button type="button" class="creation-icon-button" onclick="randomName();CreationUI.summary()" aria-label="随机起名">换个名字 ↻</button></div>'+
        '<span class="creation-label">性别</span><div class="creation-segments" id="gender-group">'+genders.map(([id,label])=>'<button type="button" class="'+(p().gender===id?'active':'')+'" aria-pressed="'+(p().gender===id)+'" onclick="CreationUI.pick(\'gender\',\''+id+'\')">'+label+'</button>').join('')+'</div>'+
        '<label class="creation-label" for="input-age">年龄</label><div class="creation-age-row"><input id="input-age" class="creation-input" type="number" min="18" max="9999" step="1" value="'+p().age+'" oninput="CreationUI.field(\'age\',this.value)"><span>岁 · 成年角色</span></div>')+
      panel('故事的边界','<div class="creation-mode-options">'+[['canon','原著框架','沿用斗气、炼药与族群规则，独立角色从基础修行起步。'],['free','自由演绎','开放稀有血脉和幻想禀赋，超常设定明确标记为改编。']].map(([id,title,desc])=>'<button type="button" class="creation-mode'+(p().worldMode===id?' selected':'')+'" aria-pressed="'+(p().worldMode===id)+'" onclick="CreationUI.mode(\''+id+'\')"><strong>'+title+'</strong><span>'+desc+'</span></button>').join('')+'</div><p class="creation-note">你与原著人物的关系从经历建立，不默认师承药老或与薰儿相识。</p>')+'</div>'+
      '<section class="creation-difficulty"><div class="creation-section-heading"><h3>选择旅程难度</h3><span>点数决定初始配置，不直接授予境界</span></div><div class="creation-grid three">'+DIFFICULTY.map(d=>card(d.id,d.name,d.desc,d.points,p().difficulty===d.id,{unlimited:'∞',powerFantasy:'命',easy:'逸',normal:'衡',hard:'砺',extreme:'险',mortal:'凡'}[d.id],"CreationUI.difficulty('"+d.id+"')",d.id==='normal'?'推荐初次游玩':'')).join('')+'</div></section>';
  }
  function race(){
    $('creation-content').innerHTML=heading('CHAPTER 02 / 血脉有源','你从何处而来','不同族群拥有不同起点。强大的血脉，也有需要承担的来处。')+
      '<div class="creation-callout">'+(CreationRules.isFree(p())?'自由演绎已开启，稀有与衍生血脉可选。':'原著框架 · 族群天赋不等于开局拥有异火、化翼或空间穿梭。')+'</div>'+
      '<div class="creation-grid three">'+RACES.filter(r=>CreationRules.allowedRace(p(),r.id)).map(r=>{const m=CreationRules.races[r.id];return card(r.id,r.name,r.desc,r.cost,p().race===r.id,m?.mark||'古',"CreationUI.pick('race','"+r.id+"')",m?.tag||'自由改编');}).join('')+'</div>'+
      panel('血脉札记',(()=>{const r=RACES.find(r=>r.id===p().race),m=CreationRules.races[p().race];return '<div class="creation-race-detail"><div><strong>'+esc(r?.name||'选择一个族群')+'</strong><p>'+esc(m?.detail||'这是自由演绎的特殊起点，其能力仍受角色实力与具体故事条件限制。')+'</p><small>'+esc(m?.source||'自由改编')+(m?.refs?' · '+m.refs:'')+'</small></div><div class="creation-coefficients">'+[['hp','体魄'],['pa','武力'],['da','斗气']].map(([key,label])=>'<span>'+label+'<b>×'+(r?.coeff[key]||1).toFixed(1)+'</b></span>').join('')+'</div></div>';})(),'creation-detail-panel')+'<p class="creation-note">倍率与点数为游戏规则。选择只改变起点，不代替境界成长。</p>';
  }
  function identity(){
    $('creation-content').innerHTML=heading('CHAPTER 03 / 人间百业','选择你的出身','一门手艺、一段过往，或一条尚未走过的路。')+
      '<div class="creation-tabs" aria-label="身份分类">'+['全部','行旅','传承','技艺'].map(g=>'<button type="button" aria-pressed="'+(identityFilter===g)+'" class="'+(identityFilter===g?'active':'')+'" onclick="CreationUI.identityFilter(\''+g+'\')">'+g+'</button>').join('')+'</div>'+
      '<div class="creation-grid three">'+IDENTITIES.filter(i=>CreationRules.allowedIdentity(p(),i.id)).filter(i=>identityFilter==='全部'||(CreationRules.identities[i.id]?.group||'传承')===identityFilter).map(i=>{const m=CreationRules.identities[i.id];return card(i.id,i.name,i.desc,i.cost,p().identity===i.id,m?.mark||'传',"CreationUI.pick('identity','"+i.id+"')",m?.alchemy?'需火属性夹带木气':m?.group||'自由改编');}).join('')+'</div>'+
      '<div class="creation-callout">'+(CreationRules.isAlchemy(p())?'炼药身份已选：下一步的「炼药资质」会配置火属性与一丝木气。你仍需学习配方与控火。':'出身提供基础盘缠与入门技能。学院、丹塔、宗门的正式资源需要后续资格与经历。')+'</div>';
  }
  function stats(){
    updatePerformanceStats();
    $('creation-content').innerHTML=heading('CHAPTER 04 / 筑下根基','让你的长处有所不同','六项基础素质，每点消耗1点。这里分配的是游戏能力，不是修炼境界。')+
      '<div class="creation-stat-layout">'+panel('基础素质','<div class="creation-stat-presets">'+[['balanced','均衡'],['martial','近战'],['alchemy','炼药']].map(([id,label])=>'<button type="button" onclick="CreationUI.preset(\''+id+'\')">'+label+'</button>').join('')+'</div>'+STAT_CONFIG.map(s=>'<div class="creation-stat"><div class="creation-stat-top"><label for="slider-'+s.key+'">'+s.label+'</label><div class="creation-stepper"><button type="button" aria-label="减少'+s.label+'" onclick="CreationUI.nudge(\''+s.key+'\',-1)">−</button><output id="stat-val-'+s.key+'">'+p().baseStats[s.key]+'</output><button type="button" aria-label="增加'+s.label+'" onclick="CreationUI.nudge(\''+s.key+'\',1)">＋</button></div></div><input id="slider-'+s.key+'" type="range" min="0" max="20" value="'+p().baseStats[s.key]+'" oninput="updateStat(\''+s.key+'\',Number(this.value))"><p>'+s.desc+'</p></div>').join(''))+
      panel('实力预览','<div class="creation-realm"><span>初始境界</span><strong>斗之气 · 三段</strong><small>灵魂：凡境 · 独立成长体系</small></div><div class="creation-perf-grid">'+Object.keys(PERF_STAT_LABELS).map(k=>'<div><span>'+PERF_STAT_LABELS[k]+'</span><strong id="perf-stat-'+k+'">'+p().performanceStats[k]+(k==='cr'?'%':'')+'</strong></div>').join('')+'</div><p class="creation-note">展示值按种族倍率计算；「身强体健」增加10%生命，「精力充沛」增加10%斗气。</p>')+'</div>';
  }
  function talents(){
    const tier=TALENT_TIERS.find(t=>t.key===talentFilter)||TALENT_TIERS[0];
    $('creation-content').innerHTML=heading('CHAPTER 05 / 天赋初醒','听见体内的第一缕斗气','把禀赋化作方向。天赋有条件，属性也不是胜负的唯一答案。')+
      '<div class="creation-talent-layout"><section class="creation-panel"><div class="creation-section-heading"><h3>禀赋书卷</h3><span>'+p().talents.length+' 项已选</span></div><div class="creation-tabs">'+TALENT_TIERS.map(t=>'<button type="button" class="'+(tier.key===t.key?'active':'')+'" aria-pressed="'+(tier.key===t.key)+'" onclick="CreationUI.talentFilter(\''+t.key+'\')">'+t.label+'</button>').join('')+'</div><p class="creation-note">'+tier.label+' · 每项 '+tier.cost+' 点。未注明数值增益的条目用于角色叙事与经历。</p><div class="creation-grid two">'+TALENTS[tier.key].filter(t=>CreationRules.allowedTalent(p(),t.id)).map(t=>card(t.id,t.name,t.desc,tier.cost,p().talents.includes(t.id),'赋',"CreationUI.talent('"+t.id+"')",t.source||'游戏禀赋')).join('')+'</div>'+(TALENTS[tier.key].filter(t=>CreationRules.allowedTalent(p(),t.id)).length?'':'<div class="creation-empty">这组超常禀赋属于自由演绎。<button type="button" onclick="CreationUI.go(0)">返回选择模式 →</button></div>')+'</section>'+
      '<aside class="creation-panel creation-attribute-panel"><span class="creation-eyebrow">斗气 · 灵性</span><div class="creation-spirit-orb" aria-hidden="true"><span>'+(p().douqiAttributes.length?name(DOUQI_ATTRS,p().douqiAttributes[0]):'气')+'</span></div><h3>感应斗气属性</h3><p class="creation-note">'+(CreationRules.isFree(p())?'可选两种；第二种消耗10点。再次点击可取消。':'选择一种主属性。木气资质单独记录，不算第二种完整属性。')+'</p><div class="creation-attr-grid">'+DOUQI_ATTRS.filter(a=>CreationRules.allowedAttr(p(),a.id)).map(a=>'<button type="button" class="'+(p().douqiAttributes.includes(a.id)?'selected':'')+'" aria-pressed="'+p().douqiAttributes.includes(a.id)+'" onclick="CreationUI.attribute(\''+a.id+'\')">'+a.name+'</button>').join('')+'</div><button type="button" class="creation-alchemy-button" onclick="CreationUI.alchemy()">炼药资质 · 火中含木气</button><label class="creation-wood-check"><input type="checkbox" '+(p().woodAffinity?'checked':'')+' onchange="CreationUI.wood(this.checked)">火属性中夹带一丝木气</label><p class="creation-note">'+(CreationRules.isAlchemy(p())?(CreationRules.hasAlchemy(p())?'✓ 已满足炼药身份的属性条件。':'炼药身份尚缺属性条件。'):'炼药仍需要灵魂感知、药方、材料与练习。')+'</p></aside></div>'+
      '<section class="creation-selected-bar"><span>已选禀赋</span>'+p().talents.map(id=>{const t=Object.values(TALENTS).flat().find(t=>t.id===id);return '<button type="button" onclick="CreationUI.talent(\''+id+'\')">'+esc(t?.name||id)+' ×</button>';}).join('')+(p().talents.length?'':'<small>可以不选天赋，依靠修习成长。</small>')+'</section>';
  }
  function departure(){
    const place=CreationRules.places.find(x=>x.id===p().startLocation),kit=CreationRules.kits.find(x=>x.id===p().starterKit);
    const issues=CreationRules.validate(p(),catalog());
    $('creation-content').innerHTML=heading('CHAPTER 06 / 山河待你','选一处地方，开始你的故事','没有答题，也无需抽取奖励。你携带的行囊与选择的起点，会真实写入开局。')+
      '<div class="creation-section-heading"><h3>第一站</h3><span>三个起点 · 三种相遇</span></div><div class="creation-grid three">'+CreationRules.places.map(x=>card(x.id,x.name,x.desc,null,p().startLocation===x.id,{wutan:'城',qingshan:'山',shimo:'沙'}[x.id],"CreationUI.pick('startLocation','"+x.id+"')",x.tag)).join('')+'</div>'+
      '<div class="creation-section-heading"><h3>初始行囊</h3><span>每种免费 · 选择其一</span></div><div class="creation-grid three">'+CreationRules.kits.map(x=>card(x.id,x.name,x.desc,null,p().starterKit===x.id,x.mark,"CreationUI.pick('starterKit','"+x.id+"')")).join('')+'</div>'+
      panel('你的新人生','<div class="creation-review"><div><span class="creation-eyebrow">'+(CreationRules.isFree(p())?'自由演绎':'原著框架')+'</span><h3>'+esc(p().name||'未填写姓名')+'</h3><p>'+esc(name(RACES,p().race)+' · '+name(IDENTITIES,p().identity))+'</p><span>'+p().age+'岁 · 斗之气三段 · 凡境灵魂</span></div><div><p>启程于 <strong>'+esc(place?.name)+'</strong></p><p>携带 <strong>'+esc(kit?.name)+'</strong></p><p>斗气属性 <strong>'+p().douqiAttributes.map(id=>name(DOUQI_ATTRS,id)).join('、')+(p().woodAffinity?'（夹带木气）':'')+'</strong></p><p>剩余点数 <strong>'+(p().points-p().pointsSpent)+'</strong></p></div></div>'+(issues.length?'<div class="creation-validation" role="status">'+issues.map(i=>'<button type="button" onclick="CreationUI.go('+i.step+')">'+esc(i.message)+' →</button>').join('')+'</div>':'<p class="creation-ready">✓ 档案已就绪。原著人物的关系与珍稀资源，将在旅途中逐步建立。</p>'));
  }
  function pick(key,id){
    const lists={race:RACES,identity:IDENTITIES,startLocation:CreationRules.places,starterKit:CreationRules.kits,gender:[{id:'male'},{id:'female'},{id:'futa'}]};
    if(!lists[key]?.some(x=>x.id===id))return;
    if(key==='race'&&!CreationRules.allowedRace(p(),id)||key==='identity'&&!CreationRules.allowedIdentity(p(),id))return;
    const old=p()[key],before=CreationRules.spent(p(),catalog());p()[key]=id;
    const after=CreationRules.spent(p(),catalog());
    if(after>p().points&&after>before){p()[key]=old;showToast('点数不足，可以先返回调整根基或难度','error');return;}
    save();render(creationCurrentStep);
  }
  function mode(id){
    if(!['canon','free'].includes(id))return;
    p().worldMode=id;
    if(!CreationRules.allowedRace(p(),p().race))p().race='human';
    if(!CreationRules.allowedIdentity(p(),p().identity))p().identity='wanderer';
    p().talents=p().talents.filter(id=>CreationRules.allowedTalent(p(),id));
    p().douqiAttributes=p().douqiAttributes.filter(id=>CreationRules.allowedAttr(p(),id)).slice(0,id==='canon'?1:2);
    save();render(0);
  }
  function difficulty(id){const d=DIFFICULTY.find(d=>d.id===id);if(!d)return;p().difficulty=id;p().points=d.points;save();render(0);}
  function field(key,value){if(key==='name')p().name=String(value).slice(0,20);if(key==='age')p().age=value===''?NaN:Number(value);summary();saveToLocalStorage();}
  function setStat(key,value){
    if(!STAT_CONFIG.some(s=>s.key===key))return;
    const old=p().baseStats[key];let val=Math.max(0,Math.min(20,Math.trunc(Number(value)||0)));
    val=Math.min(val,old+Math.max(0,p().points-CreationRules.spent(p(),catalog())));p().baseStats[key]=val;
    if($('stat-val-'+key))$('stat-val-'+key).textContent=val;
    if($('slider-'+key))$('slider-'+key).value=val;save();
  }
  function preset(id){const map={balanced:[5,5,5,5,5,5],martial:[9,6,6,3,3,3],alchemy:[3,3,4,8,9,3]};if(!map[id])return;const old={...p().baseStats};STAT_CONFIG.forEach((s,i)=>p().baseStats[s.key]=map[id][i]);if(CreationRules.spent(p(),catalog())>p().points){p().baseStats=old;showToast('剩余点数不足以采用该方案','error');return;}save();stats();}
  function talent(id){
    if(!CreationRules.allowedTalent(p(),id)||!Object.values(TALENTS).flat().some(t=>t.id===id))return;
    if(p().talents.includes(id))p().talents=p().talents.filter(x=>x!==id);
    else{
      if(id==='poison-body'&&p().talents.includes('c8')||id==='c8'&&p().talents.includes('poison-body')){showToast('这两项禀赋不能同时选择','error');return;}
      p().talents.push(id);
      if(CreationRules.spent(p(),catalog())>p().points){p().talents.pop();showToast('剩余点数不足','error');return;}
    }
    save();talents();
  }
  function attribute(id){
    if(!DOUQI_ATTRS.some(a=>a.id===id)||!CreationRules.allowedAttr(p(),id))return;
    const old=[...p().douqiAttributes];
    if(!CreationRules.isFree(p()))p().douqiAttributes=[id];
    else if(old.includes(id))p().douqiAttributes=old.filter(x=>x!==id);
    else if(old.length<2)p().douqiAttributes.push(id);
    else{showToast('最多两种完整属性，请先取消一种','info');return;}
    if(!p().douqiAttributes.includes('fire'))p().woodAffinity=false;
    if(CreationRules.spent(p(),catalog())>p().points){p().douqiAttributes=old;showToast('第二种属性需要10点','error');return;}
    save();talents();
  }
  function alchemy(){p().douqiAttributes=['fire'];p().woodAffinity=true;save();talents();}
  function wood(value){if(value&&!p().douqiAttributes.includes('fire')){showToast('请选择火属性，或直接使用炼药资质方案','info');talents();return;}p().woodAffinity=value;save();talents();}
  function configure(){
    RACES.forEach(r=>{const m=CreationRules.races[r.id];if(m){r.name=m.name;r.desc=m.desc;}});
    IDENTITIES.forEach(i=>{const m=CreationRules.identities[i.id];if(m){if(m.name)i.name=m.name;i.desc=m.desc;}});
    const descriptions={c1:['身强体健','游戏效果：生命上限增加10%。'],c4:['精力充沛','游戏效果：斗气上限增加10%。'],c5:['耐候体质','对冷热较耐受，仍需应对极端环境。'],c6:['夜间适应','更适应昏暗环境，无法看穿完全黑暗。'],c8:['强健抗病','体质较好，不代表免疫毒药或厄难毒体。'],n1:['斗气感知','修习感知的方法，范围随境界与训练成长。'],n8:['魔兽亲和','较擅长观察魔兽；合作取决于实力、习性与关系。'],r1:['控火悟性','较容易理解控火训练，不能跳过炼药资格与配方。'],r3:['飞行斗技研习','拥有相关求学线索；获得并修成斗技前不能低阶飞行。'],r8:['丹方研习','对药材配伍有兴趣，改良仍需知识与反复试验。']};
    Object.values(TALENTS).flat().forEach(t=>{if(descriptions[t.id]){t.name=descriptions[t.id][0];t.desc=descriptions[t.id][1];}});
    TALENTS.epic.push({id:'poison-body',name:'厄难毒体',desc:'毒力与失控风险并存。需要毒丹等条件处理，不默认免毒或已掌控。',source:'原著体质 · 开局改编'},{id:'serpent-eyes',name:'碧蛇三花瞳',desc:'与蛇类相关的罕见瞳术。控制受目标与修行条件约束。',source:'原著瞳术 · 开局改编'},{id:'bloodline-trace',name:'稀薄斗帝血脉',desc:'留下族裔线索与潜力，不自动提升到高阶境界。',source:'原著血脉 · 开局改编'});
    TALENT_TIERS[0].label='素质';TALENT_TIERS[1].label='修习';TALENT_TIERS[2].label='悟性';TALENT_TIERS[3].label='禀异';TALENT_TIERS[4].label='传说';
  }
  configure();
  return {catalog,render,go,summary,pick,mode,difficulty,field,setStat,preset,talent,attribute,alchemy,wood,nudge:(key,delta)=>setStat(key,p().baseStats[key]+delta),identityFilter:value=>{identityFilter=value;identity();},talentFilter:value=>{talentFilter=value;talents();}};
})();
