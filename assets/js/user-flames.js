/* Project lore supplied by the user; not a claim of novel-text provenance. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.DoupoUserFlames=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  var flames=[
  {
    "rank": 18,
    "name": "风怒龙炎",
    "desc": "生于古老沙漠中的火焰龙卷风的风眼之中。不同于其他异火，没有固定的地点，而是在每年的最热的几天内，随机出现在沙漠中的任何一处，极其罕见。施展出时会形成龙卷风形态，风与火相结合，火焰高达数百米，像一条巨大的火龙咆哮着旋转前进，具有极强的破坏能力，所到之处化成一片火海",
    "color": "#d88838",
    "sourceType": "user-supplement",
    "sourceLabel": "作者补充设定",
    "sourceFile": "新建 文本文档 (2).txt"
  },
  {
    "rank": 20,
    "name": "幽冥毒火",
    "desc": "存在于上古幽冥毒泽之中的火焰。经过毒泽中遮天毒瘴千万年的熏染，火焰燃食了无尽的毒瘴之气，百年成灵，千年成形，大成之时，其色偏绿，犹如鬼火一般在毒泽瘴气中穿行。由于火焰本身是毒瘴喂养成灵，含有剧毒，只要沾染片刻星火，便会身中剧毒，更别说是吞噬融合！也正是因为如此，很少有人去寻找这种异火，也就没有多少人知晓它的存在。",
    "color": "#719d4b",
    "sourceType": "user-supplement",
    "sourceLabel": "作者补充设定",
    "sourceFile": "新建 文本文档 (2).txt"
  },
  {
    "rank": 21,
    "name": "阴阳双炎",
    "desc": "诞生于宇宙虚空之中，一黑一白两种颜色的火焰缠绕在一起，就犹如阴阳双鱼一般游动。阴阳便是自然法则，是孕育世间万物的本源。而诞生于本源之中的阴阳双炎便是本源所幻化出的其中一种火焰形态，充满生命和死亡的双重力量，阳火救人，生生不息，阴火杀人，尸骨无存。",
    "color": "#a4adb8",
    "sourceType": "user-supplement",
    "sourceLabel": "作者补充设定",
    "sourceFile": "新建 文本文档 (2).txt"
  }
];
  var legacy=[
  {
    "keys": [
      "风雷怒炎"
    ],
    "content": "风雷怒炎，异火榜第十八。青紫交织的火焰，诞生于雷暴频发的高空风雷层。火焰中蕴含风雷之力，速度极快。",
    "rank": 18
  },
  {
    "keys": [
      "龙凤焱"
    ],
    "content": "龙凤焱，异火榜第二十。呈金红双色交织，火焰中隐约有龙凤虚影盘旋。由远古真龙与天凰精血交融而生，同时具备龙炎与凤火的特性。",
    "rank": 20
  },
  {
    "keys": [
      "六道轮回炎"
    ],
    "content": "六道轮回炎，异火榜第二十一。呈灰白之色，蕴含六道轮回法则，可灼烧灵魂本源。传说此火曾是一位修轮回道的斗圣陨落后所化。",
    "rank": 21
  }
];
  function entry(rank){
    var f=flames.find(function(x){return x.rank===rank;});
    if(!f)throw new Error('Unknown supplemental flame rank');
    return {keys:[f.name],content:f.name+'，异火榜第'+f.rank+'。'+f.desc+'【项目补充设定】能力描述不表示无视境界、防护、消耗而必然生效；具体对抗按情境判断。',comment:'用户补充设定：'+f.sourceFile,sourceType:f.sourceType,sourceLabel:f.sourceLabel};
  }
  // Exact-match only: preserve edited/imported books, entry IDs, disabled state and insertion settings.
  function migrateBook(book){
    if(!book||book.name!=='斗破苍穹世界观'||!Array.isArray(book.entries))return false;
    var changed=false;
    book.entries.forEach(function(e){
      var old=legacy.find(function(x){return e.content===x.content&&JSON.stringify(e.keys)===JSON.stringify(x.keys);});
      if(!old)return;
      Object.assign(e,entry(old.rank));changed=true;
    });
    return changed;
  }
  return {flames:flames,entry:entry,migrateBook:migrateBook};
});
