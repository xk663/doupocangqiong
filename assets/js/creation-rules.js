(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.CreationRules=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const races={
    human:{name:'人族',mark:'人',tag:'诸国百家',desc:'家族、学院与宗门构成修行之路。擅长学习与协作，起点平衡。',detail:'从斗之气开始积累。炼药需要属性与灵魂条件，家族出身不等于拥有斗帝血脉。',source:'原著族群',refs:'第1、6章'},
    yao:{name:'魔兽族',mark:'兽',tag:'山林来客',desc:'以血脉与肉身见长，在山林中寻找自己的修行道路。',detail:'魔兽阶位、灵智与化形各有条件。本创角使用拟人角色便于对话，属于游戏改编。',source:'原著族群 · 化形改编'},
    taixu:{name:'太虚古龙',mark:'龙',tag:'古龙血脉',desc:'强韧体魄与空间天赋并存，族群生活于特殊空间。',detail:'血脉潜力不等于开局掌握空间穿梭；龙岛身份与族群秘密需要在故事中建立。此版部分段落也写作「太古虚龙」。',source:'原著族群',refs:'第987、1299章'},
    huangphoenix:{name:'天妖凰族',mark:'凰',tag:'兽域大族',desc:'重视族群与血脉的魔兽大族，拥有出色的飞行潜力。',detail:'不自动获得涅槃重生或异火，低阶角色仍受自身实力与修行条件约束。',source:'原著族群'},
    jiuyou:{name:'九幽地冥蟒',mark:'蟒',tag:'冥蛇地脉',desc:'与地下地脉和九幽黄泉相联系的魔兽族群。',detail:'九幽黄泉是地下水域，不是冥界；不因族名相似而继承九幽金祖火。',source:'原著族群',refs:'第1456章'},
    snake:{name:'蛇人族',mark:'蛇',tag:'沙海部落',desc:'在沙漠部落与族群秩序中成长，重视生存、承诺与立场。',detail:'蛇人族与九幽地冥蟒是不同族群。你与女王、各部落的关系从具体经历建立。',source:'原著族群',refs:'第208章'}
  };
  const identities={
    wanderer:{group:'行旅',mark:'行',desc:'无门无派，从基础功法与少量盘缠起步，选择自己的道路。'},
    mercenary:{group:'行旅',mark:'佣',desc:'凭委托与护送谋生。初识野外生存，有基础实战训练。'},
    caravanGuard:{group:'行旅',mark:'商',desc:'随商队旅行，熟悉补给和交易，仍需护卫与路线情报。'},
    wanderingSwordsman:{group:'行旅',mark:'剑',desc:'以兵器修行为志，凭经验与功法成长，不凭出身越级压制对手。'},
    blackCornerFugitive:{group:'行旅',mark:'隐',desc:'黑角域的过往带来警惕与麻烦。声望和仇怨需要逐步揭示。'},
    sectDisciple:{group:'传承',mark:'宗',desc:'拥有入门传承，也要承担宗门职责。具体师承在开局中建立。'},
    academyStudent:{group:'传承',mark:'院',name:'迦南预备学员',desc:'准备参加学院选拔。内院、火能与高阶功法不会自动开放。'},
    noble:{group:'传承',mark:'家',desc:'地方家族为你提供基础资源；家族责任与人情同样随之而来。'},
    alchemist:{group:'技艺',mark:'丹',name:'炼药学徒',desc:'学习药材、控火与提炼。需要火属性中夹带木气及灵魂感知条件。',alchemy:true},
    pillTowerDisciple:{group:'技艺',mark:'塔',name:'丹塔求学者',desc:'希望在丹域求学，仍需考核与声望，不默认掌握高品丹方。',alchemy:true},
    auctioneer:{group:'技艺',mark:'鉴',desc:'辨识物品与打听行情，靠专业和信用建立交易关系。'},
    poisonMaster:{group:'技艺',mark:'毒',desc:'了解基础毒理与用毒风险。毒师身份不等于厄难毒体。'},
    beastTamer:{group:'技艺',mark:'驯',desc:'观察魔兽习性，逐渐建立合作；无法无条件收服高阶魔兽。'},
    mercenaryLeader:{group:'行旅',mark:'旗',desc:'小型佣兵队的组织者，承担队友、补给与报酬分配责任。'},
    swordsmith:{group:'技艺',mark:'铸',desc:'学习兵器维护与锻造，手艺不直接转化为超越境界的剑法。'}
  };
  const places=[
    {id:'wutan',name:'乌坦城',tag:'坊市与人情',spot:'乌坦城坊市',location:'加玛帝国 · 乌坦城',desc:'拍卖场、家族坊市与佣兵消息交汇，从一座城开始认识斗气大陆。',opening:'晨光落在坊市的青石路上，商贩正在支起药材摊。你在客栈整理好行囊，沿街的叫卖声与拍卖场的消息一起传来。',options:['去坊市辨认药材','向佣兵打听附近委托','了解拍卖场的交易规矩']},
    {id:'qingshan',name:'青山镇',tag:'山林与采药',spot:'青山镇药铺外',location:'加玛帝国 · 魔兽山脉外围',desc:'补给、护送与采药构成日常。山脉深处的危险需要情报与同伴。',opening:'山雾还停留在林梢，青山镇的药铺已经开门。采药队在街口清点绳索和干粮，招募护卫的告示被风轻轻吹动。',options:['询问采药队的出发计划','补充入山所需的物资','在镇上寻找落脚处']},
    {id:'shimo',name:'石漠城',tag:'沙海与商路',spot:'石漠城城门附近',location:'加玛帝国周边 · 塔戈尔沙漠区域',desc:'佣兵团、商队与沙漠补给相互依赖；异火和部落的消息仍只是线索。',opening:'风沙沿城墙掠过，石漠城门口的商队正在卸下水囊。远方的沙丘被阳光照亮，你知道下一段旅程需要先从补给和情报开始。',options:['购买水囊与行路补给','询问佣兵团的护送委托','听听商队带来的沙漠消息']}
  ];
  const kits=[
    {id:'traveller',name:'行旅行囊',mark:'行',desc:'干粮×3、水囊×1、回气丹×1',items:[{id:'starter-food',name:'干粮',qty:3,icon:'包',desc:'旅行补给'},{id:'starter-water',name:'水囊',qty:1,icon:'水',desc:'旅途储水'},{id:'starter-pill',name:'回气丹',qty:1,icon:'丹',desc:'用于恢复斗气的丹药，不用于无条件突破'}]},
    {id:'herbalist',name:'采药行囊',mark:'药',desc:'低阶药材×5、采药札记×1、水囊×1',items:[{id:'starter-herbs',name:'低阶药材',qty:5,icon:'药',desc:'基础药材，需辨识用途'},{id:'starter-notes',name:'采药札记',qty:1,icon:'册',desc:'采药与辨识的入门记录'},{id:'starter-water',name:'水囊',qty:1,icon:'水',desc:'旅途储水'}]},
    {id:'training',name:'修习行囊',mark:'习',desc:'训练护腕×1、回气丹×1、干粮×2',items:[{id:'starter-wraps',name:'训练护腕',qty:1,icon:'腕',desc:'普通训练用品，不是高阶法宝'},{id:'starter-pill',name:'回气丹',qty:1,icon:'丹',desc:'用于恢复斗气的丹药'},{id:'starter-food',name:'干粮',qty:2,icon:'包',desc:'旅行补给'}]}
  ];
  const isFree=p=>p.worldMode==='free';
  function allowedRace(p,id){return isFree(p)||!!races[id];}
  function allowedIdentity(p,id){return isFree(p)||!!identities[id];}
  function allowedAttr(p,id){return isFree(p)||['wind','water','fire','earth','wood','ice','thunder','poison'].includes(id);}
  function isAlchemy(p){return !!identities[p.identity]?.alchemy||p.identity==='medicineClanRemnant';}
  function hasAlchemy(p){return p.douqiAttributes?.includes('fire')&&p.woodAffinity===true;}
  const canonTalents=['c1','c2','c3','c4','c5','c6','c7','c8','c9','c10','n1','n2','n3','n4','n5','n6','n7','n8','n9','r1','r2','r3','r4','r8','r10','poison-body','serpent-eyes','bloodline-trace'];
  function allowedTalent(p,id){return isFree(p)||canonTalents.includes(id);}
  function spent(p,catalog){
    let total=0;
    total+=(catalog.races.find(x=>x.id===p.race)?.cost||0)+(catalog.identities.find(x=>x.id===p.identity)?.cost||0);
    for(const key of ['strength','agility','endurance','douqi','soul','speed'])total+=Number(p.baseStats?.[key])||0;
    for(const id of new Set(p.talents||[])){
      if((p.freeTalents||[]).includes(id))continue;
      for(const tier of catalog.tiers)if(catalog.talents[tier.key].some(t=>t.id===id)){total+=tier.cost;break;}
    }
    if((p.douqiAttributes||[]).length>1)total+=10;
    return total;
  }
  function performance(p,catalogRaces){
    const bs=p.baseStats,c=catalogRaces.find(r=>r.id===p.race)?.coeff||Object.fromEntries(['hp','dp','pa','da','pd','dd','ph','dh','cr'].map(k=>[k,1]));
    const result={hp:Math.round(bs.endurance*20*c.hp),dp:Math.round(bs.douqi*20*c.dp),pa:Math.round(bs.strength*8*c.pa),da:Math.round(bs.douqi*8*c.da),pd:Math.round((bs.endurance+bs.strength)*4*c.pd),dd:Math.round((bs.douqi+bs.soul)*4*c.dd),ph:Math.round(bs.agility*5*c.ph),dh:Math.round(bs.soul*5*c.dh),cr:Math.round(bs.agility*c.cr*10)/10};
    if(p.talents.includes('c1'))result.hp=Math.round(result.hp*1.1);
    if(p.talents.includes('c4'))result.dp=Math.round(result.dp*1.1);
    return result;
  }
  function validate(p,catalog,step){
    const errors=[];const fail=(at,message)=>{if(step===undefined||step===at)errors.push({step:at,message});};
    if(!p.name?.trim()||p.name.trim().length>20||/[\u0000-\u001f]/.test(p.name))fail(0,'请填写1—20字的单行姓名');
    if(!['canon','free'].includes(p.worldMode))fail(0,'请选择有效的故事模式');
    if(!['male','female','futa'].includes(p.gender))fail(0,'请选择性别');
    if(!Number.isInteger(p.age)||p.age<18||p.age>9999)fail(0,'请填写18—9999之间的整数年龄');
    const difficulty=catalog.difficulties.find(d=>d.id===p.difficulty);
    if(!difficulty||p.points!==difficulty.points)fail(0,'请选择有效的难度');
    if(!catalog.races.some(r=>r.id===p.race)||!allowedRace(p,p.race))fail(1,'请选择当前模式下的种族');
    if(!catalog.identities.some(i=>i.id===p.identity)||!allowedIdentity(p,p.identity))fail(2,'请选择当前模式下的身份');
    if(Object.keys(p.baseStats||{}).length!==6||Object.values(p.baseStats||{}).some(v=>!Number.isInteger(v)||v<0||v>20))fail(3,'基础属性必须是0—20的整数');
    if(!Array.isArray(p.talents)||new Set(p.talents).size!==p.talents.length||p.talents.some(id=>!allowedTalent(p,id)||!catalog.tiers.some(t=>catalog.talents[t.key].some(x=>x.id===id))))fail(4,'天赋选择无效');
    if(p.talents.includes('poison-body')&&p.talents.includes('c8'))fail(4,'厄难毒体与强健抗病不能同时选择');
    if(!Array.isArray(p.douqiAttributes)||p.douqiAttributes.length<1||p.douqiAttributes.length>(isFree(p)?2:1)||new Set(p.douqiAttributes).size!==p.douqiAttributes.length||p.douqiAttributes.some(id=>!allowedAttr(p,id)||!catalog.attrs.some(a=>a.id===id)))fail(4,'请选择有效的斗气属性');
    if(isAlchemy(p)&&!hasAlchemy(p))fail(4,'炼药身份需要火属性中夹带木气，请选择「炼药资质」');
    if(!places.some(x=>x.id===p.startLocation)||!kits.some(x=>x.id===p.starterKit))fail(5,'请选择出发地点与初始行囊');
    if(difficulty&&spent(p,catalog)>difficulty.points&&(step===undefined||step>=1))errors.push({step:step===undefined?3:step,message:'点数不足，请调整种族、身份、数值或天赋'});
    return errors;
  }
  function initialState(p){
    const place=places.find(x=>x.id===p.startLocation)||places[0],kit=kits.find(x=>x.id===p.starterKit)||kits[0];
    return {realm:'斗之气·三段',soulRealm:'凡境',inventory:kit.items.map(x=>({...x})),relationships:[],world:{location:place.location,specificSpot:place.spot,weather:'晴 · 微风',environment:place.desc},time:{era:'开局纪年（游戏）',year:1,month:3,day:1,hour:8,minute:0,totalHours:0}};
  }
  return {races,identities,places,kits,isFree,allowedRace,allowedIdentity,allowedAttr,allowedTalent,isAlchemy,hasAlchemy,spent,performance,validate,initialState};
});
