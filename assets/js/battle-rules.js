(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.BattleRules=factory();})(globalThis,function(){
 'use strict';
 const REALMS=['斗之气','斗者','斗师','大斗师','斗灵','斗王','斗皇','斗宗','斗尊','半圣','斗圣','斗帝'];
 const PROFILES={cautious:{label:'谨慎型',guardChance:.5,chargeChance:.12,skillChance:.38},aggressive:{label:'猛攻型',guardChance:.12,chargeChance:.55,skillChance:.35},agile:{label:'灵巧型',guardChance:.2,chargeChance:.18,skillChance:.62}};
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 function realmInfo(value){const s=String(value||'');let tier=0;for(let i=REALMS.length-1;i>=0;i--)if(s.includes(REALMS[i])){tier=i;break;}const starMatch=s.match(/([一二三四五六七八九十0-9]+)星/);const stars=starMatch?parseInt(String(starMatch[1]).replace('一','1').replace('二','2').replace('三','3').replace('四','4').replace('五','5').replace('六','6').replace('七','7').replace('八','8').replace('九','9').replace('十','10'),10):0;const suffix=/巅峰|后期|中期|初期|高阶|中阶|低阶/.exec(s)?.[0]||'';return{label:s||'斗之气',tier,stars:clamp(Number.isFinite(stars)?stars:0,0,10),suffix};}
 function rank(value){return realmInfo(value).tier;}
 function seedHash(value){let h=2166136261;for(const c of String(value||'')){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
 function createRng(seed,start=0){
  let index=Number.isSafeInteger(start)&&start>=0?start:0;
  let state=(seedHash(seed)+Math.imul(index,0x6D2B79F5))>>>0;
  const rng=()=>{state=(state+0x6D2B79F5)|0;let t=Math.imul(state^state>>>15,1|state);t^=t+Math.imul(t^t>>>7,61|t);index++;rng.index=index;return((t^t>>>14)>>>0)/4294967296;};
  rng.index=index;return rng;
 }
 // Only explicit numeric fields on equipped items count. Names/descriptions never imply bonuses.
 function equipmentBonuses(equipment={}){
  const result={hp:0,qi:0,attack:0,defense:0,speed:0};
  const slots=['weapon','armor','accessory','ring'];
  const items=slots.some(k=>Object.hasOwn(equipment,k))?slots.map(k=>equipment[k]):[equipment];
  for(const item of items){
   if(!item||typeof item!=='object'||Array.isArray(item))continue;
   const values=item.combatBonuses||item.stats||item;
   for(const key of Object.keys(result)){
    const n=values[key];
    if(typeof n==='number'&&Number.isFinite(n))result[key]+=clamp(n,0,key==='speed'?200:100000);
   }
  }
  return result;
 }
 function styleAdjust(style){return style==='aggressive'?{attack:1.12,defense:.94,speed:1}:style==='agile'?{attack:1,defense:.96,speed:1.12}:{attack:1,defense:1.1,speed:1};}
 function deriveStats(input={}){const realm=realmInfo(input.realm),b=input.baseStats||{},eq=equipmentBonuses(input.equipment||{}),style=input.behavior||'cautious',adj=styleAdjust(style),scale=Math.pow(1.58,realm.tier)*(1+Math.max(0,realm.stars-1)*.045),end=clamp(Number(b.endurance)||0,0,100),douqi=clamp(Number(b.douqi)||0,0,100),strength=clamp(Number(b.strength)||0,0,100),agility=clamp(Number(b.agility)||0,0,100),speedStat=clamp(Number(b.speed)||0,0,100);const bonus={hp:Number(eq.hp)||0,qi:Number(eq.qi)||0,attack:Number(eq.attack)||0,defense:Number(eq.defense)||0,speed:Number(eq.speed)||0};const maxHp=Math.round(((300+end*12)*scale+bonus.hp)*adj.defense),maxQi=Math.round((150+douqi*10)*scale+bonus.qi),attack=Math.round(((45+strength*3)*scale+bonus.attack)*adj.attack),defense=Math.round(((15+end)*scale+bonus.defense)*adj.defense),speed=Math.max(1,Math.round((85+realm.tier*9+speedStat*2+agility+bonus.speed)*adj.speed));return{maxHp,maxQi,attack,defense,speed,breakdown:{hp:['基础300','耐力 '+end*12,'境界倍率 ×'+scale.toFixed(2),'装备 '+bonus.hp].join(' + '),qi:['基础150','斗气 '+douqi*10,'境界倍率 ×'+scale.toFixed(2),'装备 '+bonus.qi].join(' + '),attack:['基础45','力量 '+strength*3,'境界倍率 ×'+scale.toFixed(2),'装备 '+bonus.attack,'行为修正 ×'+adj.attack].join(' + '),defense:['基础15','耐力 '+end,'境界倍率 ×'+scale.toFixed(2),'装备 '+bonus.defense,'行为修正 ×'+adj.defense].join(' + '),speed:['基础85','境界 '+realm.tier*9,'身法 '+agility,'速度属性 '+speedStat*2,'装备 '+bonus.speed].join(' + ')},realm};}
 function profile(value){return PROFILES[value]||PROFILES.cautious;}
 return{REALMS,PROFILES,clamp,realmInfo,rank,createRng,equipmentBonuses,deriveStats,profile};
});
