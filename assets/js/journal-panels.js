/* Reading panels: canon reference is distinct from the player's actual save. */
var DoupoPanels = (() => {
 'use strict';
 const esc=v=>escapeHtml(String(v??''));
 const people=[
 ['萧炎','萧家 · 炼药师','自证与成长','从乌坦城少年走向炎帝。焚决、救师与守护家族贯穿其成长。','青莲地心火 → 陨落心炎 → 星域与妖火；境界随剧情变化。'],
 ['药尘','药老 · 星陨阁','师徒与传承','炼药宗师，遭韩枫背叛后以残魂寄身纳戒，与萧炎相互救助。','残魂、魂伤、沉睡与复体是不同阶段，不能视为无限力量来源。'],
 ['萧薰儿','古族 · 金帝焚天炎','情谊与族责','寄居萧家的古族族长之女，温柔坚定，情感与家族使命相互牵系。','古族身世与血脉秘密按故事阶段揭示。'],
 ['彩鳞','美杜莎女王 · 蛇人族','族群与守护','蛇人族统领，以异火寻求血脉进化，与萧炎从对峙、合作走向家庭。','女王、彩鳞与吞天蟒形态关联同一人物；萧潇是其女儿。'],
 ['小医仙','医者 · 厄难毒体','善意与自我掌控','与萧炎相识于青山镇，医者初心与厄难毒体失控的恐惧形成持续冲突。','天毒女与医者是不同经历；毒体控制需要条件，不能自动免除风险。'],
 ['云韵','云岚宗 → 花宗','情感与宗门','以云芝之名与萧炎相遇，个人情感始终与宗门职责、旧日冲突交织。','云芝与云韵为同一人；私人关怀不等于宗门立场。'],
 ['雅妃','米特尔 · 商业网络','眼光与经营','以拍卖、情报和商业渠道建立影响力，长期支持萧炎与家族发展。','不能只用战斗境界衡量其价值；后期网络与早期拍卖师身份不同。'],
 ['纳兰嫣然','纳兰家族 · 云岚宗','选择与承担','退婚与三年之约开启冲突，后来仍有自己的修行与责任。','保留自主婚姻诉求与伤害性做法两面，不永久定格为敌人。'],
 ['紫妍','太古虚龙 · 龙皇','血脉与族群','从寻药少女逐渐承担龙族统一，龙凰本源果是其血脉成长的重要节点。','别名紫研；不同外形与成长阶段不拆成新人物。'],
 ['青鳞','天蛇府 · 碧蛇三花瞳','成长与归属','从受歧视的少女成长为强者，其瞳术与蛇类控制、培养经历相关。','碧蛇三花瞳不应解释为无条件控制所有生灵。'],
 ['海波东','冰皇 · 米特尔','交易与信任','因地图与破厄丹同萧炎结盟，逐步建立长期信任。','封印中与恢复后的实力不同，不能随时召来充当护卫。'],
 ['古元','古族族长 · 薰儿之父','族群与制衡','在守护族群、制衡魂族与看待萧炎之间作出选择。','高境界不代表全知，政治行动同样承担族群代价。'],
 ['曹颖','丹塔 · 炼药天才','竞争与专业','丹会舞台上的杰出炼药师，与萧炎在炼药竞争中相互认识。','炼药品阶、灵魂境界与斗气境界分开记录。'],
 ['夭夜','加玛皇室','统筹与责任','参与帝国事务与军事统筹，体现皇室对局势和资源的组织能力。','不把未证实的恋爱关系当作既定人物事实。'],
 ['韩月','迦南内院 · 韩家','学院与家族','与萧炎相识于迦南内院，后来连接中州韩家线索。','相识地点不是中州；实力和家族处境随情节变化。']
 ];
 const flames=[
 '异火榜首，万火汇聚的至尊之炎，关联陀舍古帝与异火吞噬进化的终极秘密。',
 '生于虚无，擅长吞噬，具有灵智。本体、子火与借用力量需加区分。',
 '乳白妖异，具净化与幻境之能；妖火空间、妖圣遗留与火婴关联不同阶段。',
 '古族传承异火，薰儿持有。金色火焰威能强大，传承与掌控皆有门槛。',
 '翠绿之火，神农老人持有。擅长催生药材，施展需要种子并消耗力量。',
 '黑色火焰，蕴含强大破坏力量，炎族火炫曾以此火迎战妖火空间中的强敌。',
 '炎族传承相关的强大异火，炎烬曾将其与火山石焰融合，威能更进一步。',
 '火焰呈妖艳红莲之象，炎族火稚曾使用，是炎族掌握的强大异火之一。',
 '成形于星空，吸纳星辰之力，关联丹塔星域与强大恢复力。',
 '药族人物曾使用的异火，关联药星极与万火长老等不同情节。',
 '森白火焰，极寒与炽热并存。药老的标志异火，后有师徒传承。',
 '焚炎谷传承异火，关联唐震与血魂印记；掌控需面对传承条件。',
 '异火榜第十三，药族药天曾使用，曾出现在争夺净莲妖火的风波之中。',
 '心火锻气，关联天焚炼气塔。成熟火与幼生火种是两条不同线索。',
 '海蓝异火，曾由韩枫持有，后经魂殿体系流转；所有权随剧情变化。',
 '异火榜第十六，炎族火耀长老曾使用；原文对其生态与能力着墨较少。',
 '异火榜第十七，炎烬曾将它与九幽金祖火融合使用。',
 '',
 '地底岩浆中青莲孕育的异火，伴莲台而生，是萧炎收服的第一种异火。',
 '', '',
 '古帝洞府异火广场及终战中出现；具体野外分布与生态资料有限。',
 '深黄色异火，古帝洞府异火广场中的火种已流失力量。'
 ];
 const header=(n,title,desc,extra='')=>`<header class="journal-heading"><div><span class="journal-eyebrow">卷 ${n} · 斗气大陆</span><h1>${title}</h1><p>${desc}</p></div>${extra}</header>`;
 const badge=(a,b)=>`<div class="journal-metric"><strong>${esc(a)}</strong><span>${esc(b)}</span></div>`;
 const empty=(title,text)=>`<div class="journal-empty"><span aria-hidden="true">◇</span><h3>${title}</h3><p>${text}</p></div>`;
 const card=(title,text)=>`<article class="journal-card"><h3>${title}</h3><p>${text}</p></article>`;
 function mount(id,html){let tabs='';if(id==='flames'||id==='beauties'){const beauty=id==='beauties';id='flames';tabs='<nav class="ranking-tabs" aria-label="排行榜分支"><button aria-pressed="'+!beauty+'" onclick="DoupoPanels.rankings(\'flames\')">异火榜</button><button aria-pressed="'+beauty+'" onclick="DoupoPanels.rankings(\'beauties\')">美人榜</button></nav>';}document.getElementById('game-view-'+id).innerHTML='<div class="journal-page">'+tabs+html+'</div>';}
 function flameView(){
  if(typeof FlameUI!=='undefined')return FlameUI.render();
  mount('flames',header('伍','异火榜','二十三种奇火，逐一辨识本源、传承与力量。',badge('23','异火名录'))+`<div class="journal-note">图鉴不代表已获得异火。持有者与形态随剧情变化。</div><div class="journal-grid flame-grid">`+HEAVENLY_FLAMES.map(f=>`<article class="journal-card flame-card" data-supplement="${f.sourceType==='user-supplement'}" style="--fire:${f.color}"><span class="flame-ornament" aria-hidden="true">♨</span><div class="flame-top"><span class="flame-number">${String(f.rank).padStart(2,'0')}</span><span class="journal-tag">异火榜</span></div><h3>${esc(f.name)}</h3><p>${esc(f.summary||flames[f.rank-1]||f.desc)}</p></article>`).join('')+'</div>');
 }
 function filterFlames(button){const root=button.closest('.journal-page'),n=button.dataset.flameFilter;root.querySelectorAll('[data-flame-filter]').forEach(b=>b.classList.toggle('selected',b===button));root.querySelectorAll('[data-supplement]').forEach(c=>c.hidden=n==='1'?c.dataset.supplement==='true':n==='2'?c.dataset.supplement!=='true':false);}
 function beauties(){
  const dynamic=typeof BeautyChronicle!=='undefined';
  const roster=typeof BeautyRoster!=='undefined',rows=roster?BeautyRoster.list(GameState.player.beautyChronicle):people.filter((_,i)=>[2,3,4,5,6,7,8,12,13,14].includes(i)).map(p=>({name:p[0]}));
  mount('beauties',header('陆','美人榜','相遇、选择与各自的人生。',badge(rows.length,'展示人物'))+(dynamic?BeautyChronicle.settings()+'<div class="journal-note">正文时间 · '+esc(GameState.player.beautyChronicle?.clock?.label||'尚未明确')+(GameState.player.beautyChronicle?.error?' · '+esc(GameState.player.beautyChronicle.error):'')+'</div>':'')+(roster?BeautyRoster.management():'')+'<div class="journal-note">互动先写入草稿，人物有自己的立场与意愿。当前档案随本次人生保存，原著参考不代表实际关系。</div><div class="journal-grid people-grid">'+rows.map((c,i)=>{const p=people.find(p=>p[0]===c.name);return `<article class="journal-card portrait-card">${typeof BeautyArt!=='undefined'?BeautyArt.card(c.name):''}<h3>${esc(c.name)}</h3><span class="journal-tag">${c.custom?'玩家原创':esc(p?.[1]||'人物档案')}</span>${c.custom?'<p>'+esc(c.bio||'尚未填写背景')+'</p>':''}${dynamic?BeautyChronicle.card(c.name):''}${roster?BeautyRoster.controls(c.name,i):''}${!c.custom&&p?'<details><summary>原著参考</summary><h4>'+esc(p[2])+'</h4><p>'+esc(p[3])+'</p><p>'+esc(p[4])+'</p></details>':''}</article>`;}).join('')+'</div>'+(!rows.length?empty('此页暂未展示人物','可在管理人物中恢复人物，或添加原创人物。'):'') );
 }
 function personnel(){const p=GameState.player,rels=p.relationships||[];mount('personnel',header('贰','此间相识','只记录当前人生中真正建立的关系。',badge(rels.length,'已记录关系'))+`<div class="journal-grid"><article class="journal-card self-card"><span class="journal-tag">你的人生</span><h2>${esc(p.name||'修炼者')}</h2><p>${esc(p.realm||'境界未记录')} · 灵魂 ${esc(p.soulRealm||'未记录')}</p><p>${esc((p.skills||[]).map(s=>s.name).join('、')||'尚未记录功法斗技')}</p></article>`+rels.map((r,i)=>`<article class="journal-card"><span class="journal-tag">${esc(r.relation||r.type||'相识')}</span><h3>${esc(r.name)}</h3><p>${esc(r.realm||'境界未知')}</p><p>${esc(r.desc||r.description||'尚无更多经历记录')}</p><dl><dt>关系值</dt><dd>${esc(r.affinity??'未记录')}</dd></dl><button class="journal-button" onclick="DoupoPanels.person(${i})">查看档案 ↗</button></article>`).join('')+'</div>'+(!rels.length?empty('缘分尚未落笔','在大世界靠近人物交谈，或在故事中结识他人后，此处会留下记录。'):'')+'<details class="journal-guide"><summary>原著人物索引 · 全书线索</summary><div class="journal-grid">'+people.map(p=>card(p[0]+' · '+p[1],p[3]+' '+p[4])).join('')+'</div></details>');}
 function person(i){const r=(GameState.player.relationships||[])[i];if(!r)return;showModal(`<h2>${esc(r.name)}</h2><p>${esc(r.desc||r.description||'当前关系档案')}</p><div class="journal-card"><dl>${[['境界',r.realm],['灵魂',r.soul],['功法',r.skill],['异火',r.fire],['关系值',r.affinity]].map(([k,v])=>`<dt>${k}</dt><dd>${esc(v??'尚未记录')}</dd>`).join('')}</dl></div>`);}
 function draft(kind){
  if(typeof ResidenceUI!=='undefined'&&['rest','meditation','alchemy','martial','expand'].includes(kind))return ResidenceUI.prepare(kind);
  if(typeof WorldMapBridge!=='undefined'&&WorldMapBridge.isBusy()){showToast('请先结束当前移动或推演','info');return;}
  const texts={meditation:'我想在当前所在地寻找适合静修的环境，依据我的实际境界、功法与身体状态安排一次修炼。先说明时间、条件和风险，不直接突破。',alchemy:'我想准备炼药。请先核对我的火属性夹带木气、灵魂感知、药方、药鼎与实际药材，再说明能尝试的丹药和耗材；条件不足时先给准备方案。',martial:'我想研习当前档案中已掌握的功法斗技，先根据传承、境界、熟练度与环境制定计划，不赠送未获得的秘法。',expand:'我想在当前驻足地点筹备长期修炼驻地，请先核实产权、当地势力、金币与材料来源，给出可行方案，不自动获得房产。'};
  if(!Object.hasOwn(texts,kind))return;switchGameView('tavern',document.getElementById('sidebar-tavern'));const el=document.getElementById('tavern-input');if(el){el.value=texts[kind];el.focus();}showToast('准备方案已写入草稿，发送后才进行推演','info');
 }
 function studio(){if(typeof ResidenceUI!=='undefined')return ResidenceUI.render();const p=GameState.player;mount('studio',header('壹','一隅静修','行旅有归处，修行有章法。',badge(p.realm||'未记录','当前境界'))+`<div class="studio-banner"><span class="journal-eyebrow">此刻驻足</span><h2>${esc(WorldState.specificSpot||'所在之处')}</h2><p>${esc(WorldState.location)} · ${esc(WorldState.weather)}</p><p>这是当前驻足位置；不默认拥有萧家院落、导师或专属设施。</p></div><div class="journal-grid studio-grid">`+[
 ['meditation','静修','调息 · 运气 · 内省','依已学功法与身体状态修炼，突破需要积累与契机。','核对功法、伤势与安全环境'],
 ['alchemy','炼药','药方 · 控火 · 成丹','火属性中夹带一丝木气，加上灵魂感知，构成基础条件。','核对药方、药鼎与实际药材'],
 ['martial','研习','传承 · 熟练 · 运用','功法与斗技分天地玄黄，每阶低中高三级；学习需要来源。','研习实际已获得的法门']
 ].map(([id,title,sub,text,req],i)=>`<article class="journal-card studio-card"><span class="studio-glyph" aria-hidden="true">${['修','丹','技'][i]}</span><span class="journal-eyebrow">${sub}</span><h2>${title}</h2><p>${text}</p><div class="journal-note">${req}</div><button class="journal-button" onclick="DoupoPanels.draft('${id}')">拟定${title}计划 ↗</button></article>`).join('')+`</div><div class="journal-note">计划写入聊天草稿，由你发送；不会直接扣资源、增加修为或获得丹药。</div><details class="journal-guide"><summary>驻地筹备与修行记录</summary><button class="journal-button" onclick="DoupoPanels.draft('expand')">筹备长期驻地 ↗</button>${(StudioState.logs||[]).slice(-12).reverse().map(l=>`<p>${esc(l.time)} · ${esc(l.text)}</p>`).join('')||'<p>暂无驻地记录。</p>'}</details>`);}
 function quests(){
  const story=typeof StoryQuests==='undefined'?{active:[],completed:[],failed:[]}:StoryQuests.ledger(GameState.player.storyQuests);
  const groups=[['进行中',[...(QuestSystem.quests||[]),...story.active]],['已完成',[...(QuestSystem.completed||[]),...story.completed]],['已失败',[...(QuestSystem.failed||[]),...story.failed]]];
  mount('quests',header('柒','任务','情景随故事展开，按天、地、玄、黄排列难度。',badge(groups[0][1].length,'进行中'))+'<div class="journal-note">黄阶：日常与基础历练 · 玄阶：有风险的进阶目标 · 地阶：高难度行动 · 天阶：重大险境与长期挑战。难度相对当前角色评定。</div><div class="quest-ledger">'+groups.map(([name,rows],i)=>'<section><h2>'+name+'<span>'+rows.length+'</span></h2>'+(rows.length?(typeof StoryQuests==='undefined'?rows:StoryQuests.sort(rows)).map(q=>{const grade=typeof StoryQuests==='undefined'?'黄':StoryQuests.grade(q),map=String(q.id).startsWith('map-');return '<article class="journal-card quest-card" data-grade="'+grade+'"><span class="quest-grade">'+grade+'阶</span><span class="journal-tag">'+(map?'大世界委托':'情景任务')+'</span><h3>'+esc(q.name)+'</h3><p>'+esc(q.desc)+'</p>'+(q.objective?'<p>目标 · '+esc(q.objective)+'</p>':'')+(q.progress?'<p>进展 · '+esc(q.progress)+'</p>':'')+'<p class="quest-reward">约定奖励 · '+esc(q.reward||'未记录')+'</p>'+(i===0?(map?'<p>地图委托需完成条件后向委托人交付。</p><button class="journal-button" onclick="switchGameView(\'worldmap\',document.getElementById(\'sidebar-worldmap\'))">前往大世界 ↗</button>':'<p>随正文记录进展与完成证据；奖励按实际事件结算。</p><button class="journal-button" onclick="switchGameView(\'tavern\',document.getElementById(\'sidebar-tavern\'))">继续故事 ↗</button>'):'<small>'+esc(q.completedAt||q.failedAt||q.evidence||'')+'</small>')+'</article>';}).join(''):empty(i===0?'尚无待办任务':'此卷暂无记录',i===0?'与人物交谈、探索地点，故事中出现明确目标时将自动记入任务。':'你的选择与经历将在这里留痕。'))+'</section>').join('')+'</div>');
 }
 function rankings(tab){if(tab)DoupoPanels.rankTab=tab;return DoupoPanels.rankTab==='beauties'?beauties():flameView();}
 function summaryBasic(body){if(typeof SummaryUI!=='undefined')return SummaryUI.render(body);const p=GameState.player,r=RACES.find(x=>x.id===p.race),id=IDENTITIES.find(x=>x.id===p.identity);body.innerHTML=header('叁','此身修行录','斗气、灵魂与所经历的一切，各有自己的刻度。')+'<div class="journal-grid">'+card(esc(p.name||'修炼者'),`${esc(r?.name||'种族未记录')} · ${esc(id?.name||'身份未记录')}<br>${esc(p.age)}岁 · ${esc({male:'男',female:'女',futa:'自定义'}[p.gender]||'未记录')}`)+card('斗气境界',esc(p.realm||'未记录'))+card('灵魂境界',esc(p.soulRealm||'未记录'))+card('此刻所在',esc(WorldState.location)+' · '+esc(WorldState.specificSpot))+card('行囊与盘缠',`${esc(Economy.gold)} 金币 · ${(p.inventory||[]).length} 类物品`)+card('当前记录',`${(p.skills||[]).length} 门功法斗技 · ${(p.relationships||[]).length} 段关系` )+'</div><details class="journal-guide"><summary>境界与修行体系 · 阅读参考</summary><p>斗之气 → 斗者 → 斗师 → 大斗师 → 斗灵 → 斗王 → 斗皇 → 斗宗 → 斗尊 → 巅峰九转 → 半圣 → 斗圣 → 斗帝。</p><p>斗王化翼、斗宗踏空、斗尊空间掌控各有层次；特殊斗技可形成例外，能力仍需条件与消耗。斗帝突破涉及源气，不是经验满即成帝。</p><p>灵魂主轴：凡境 → 灵境 → 天境 → 帝境。帝境灵魂不等于斗帝。炼药品阶独立，功法斗技分天地玄黄四阶。</p></details>';}
 function init(){document.querySelectorAll('#game-sidebar [data-view]').forEach(b=>{b.setAttribute('aria-label',b.title);});const nav=document.getElementById('game-sidebar');nav.setAttribute('aria-label','修行导航');}
 return {rankings,rankTab:"flames",flameView,filterFlames,beauties,personnel,person,studio,draft,quests,summaryBasic,init,people,flames};
})();
document.addEventListener('DOMContentLoaded',DoupoPanels.init);
