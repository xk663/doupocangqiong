const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const OpenWorldRuntime=require('../assets/js/open-world-runtime.js');
const TavernCore=require('../assets/js/tavern-core.js');

test('open-world context allows modest scene invention while protecting Doupo canon and power scale',()=>{
  const prompt=OpenWorldRuntime.context({location:'乌坦城',facts:[],knowledge:[],events:[],changes:[],focus:[]},{subject:'旅人'});
  for(const phrase of ['补充合理、低风险的细节与机会','人流、店铺、门禁、费用','保留玩家是否接受','斗之气一至九段、斗者、斗师','不得移植其他作品的修炼阶序','斗气境界与灵魂境界分开','普通城镇、商铺或寻常关卡的守卫','先作为传闻、线索或待确认可能性呈现'])assert.ok(prompt.includes(phrase),phrase);
  assert.match(prompt,/玩家可以自由行动，不强制进入下一事件/);
});

test('actual assembled model prompt receives the open-world guardrails',()=>{
  const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  const match=html.match(/function assembleTavernPrompt\(opts\) \{[^]*?\n\}/);
  assert.ok(match,'assembler exists');
  const state={TavernCore,OpenWorldRuntime,GameState:{player:{name:'旅人'},settings:{apis:[]}},tavernState:{characterCard:{name:'旅人'},tavernSettings:{},},WorldState:{location:'乌坦城',specificSpot:'城门'},
    getStyleGuide(){return '开放世界测试';},NPC_DYNAMIC_RULES:['NPC测试规则'],buildProtocolSystemPrompt(){return ''},StoryQuests:{protocol:'',context(){return ''}},console,Set,Date,JSON,Math,Object,Array,String,Number,RegExp};
  vm.createContext(state);
  vm.runInContext(match[0],state);
  const result=state.assembleTavernPrompt({userInput:'观察城门',preview:true,openWorldState:{mode:'character',facts:[],knowledge:[],events:[],changes:[],focus:[]}});
  const outbound=result.messages.map(m=>m.content).join('\n');
  for(const phrase of ['门禁、费用','不得移植其他作品的修炼阶序','普通城镇、商铺或寻常关卡的守卫','NPC测试规则'])assert.ok(outbound.includes(phrase),phrase);
});

test('NPC and style defaults do not use unrelated realm or magic systems',()=>{
  const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  const npc=html.match(/var NPC_DYNAMIC_RULES = \[([\s\S]*?)\n\];/);
  const style=html.match(/var DEFAULT_STYLE_GUIDE =([\s\S]*?)\n\nfunction getStyleGuide/);
  assert.ok(npc&&style);
  const rules=npc[0]+'\n'+style[0];
  assert.match(rules,/斗之气九段/);
  assert.match(rules,/普通守卫不得无背景地高出玩家多个大境界/);
  assert.doesNotMatch(rules,/筑基以上每层人数锐减|修仙界冷酷/);
});
