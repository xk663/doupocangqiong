var WorldMapBridge=(function(){
 'use strict';
 let custom=null,proposal=null,movement=null,movementId=0;const listeners=new Set();
 const data=()=>DoupoWorldData;
 function getContext(){
  const ctx=custom?custom.read():{player:GameState.player,economy:Economy,gameTime:GameTime,worldState:WorldState,questSystem:QuestSystem};
  const old=ctx.player.exploration;
  ctx.state=WorldCore.normalize(data(),old,ctx.player,ctx.worldState);
  ctx.state.minutes=Math.max(ctx.state.minutes,Math.round((Number(ctx.gameTime.totalHours)||0)*60));
  ctx.player.exploration=ctx.state;
  return ctx;
 }
 function generating(){return custom?!!custom.isBusy?.():typeof tavernState!=='undefined'&&tavernState.isSending;}
 function isBusy(){return !!movement||generating();}
 function revision(ctx){return JSON.stringify([ctx.player,ctx.economy,ctx.gameTime,ctx.worldState,ctx.questSystem]);}
 function beginMovement(){if(isBusy())return null;movement={id:++movementId,revision:revision(getContext())};changed();return movement.id;}
 function finishMovement(id,action){if(movement?.id!==id)return null;const valid=movement.revision===revision(getContext());movement=null;if(!valid){notify('行走期间存档发生变化，已保留新进度并取消此次移动','info');changed();return null;}if(!action){changed();return null;}return execute(action);}
 function cancelMovement(){movement=null;changed();}
 function notify(message,type='info'){if(custom?.toast)custom.toast(message,type);else if(typeof showToast==='function')showToast(message,type);}
 function changed(){for(const cb of listeners){try{cb();}catch(e){console.warn('地图视图未刷新：'+e.message);}}}
 function commit(next,before){
  if(custom){custom.commit(next,before);return;}
  const previous={player:GameState.player,economy:Economy,time:GameTime,world:WorldState,quests:QuestSystem,settings:WorldCore.clone(GameState.settings),tavernSettings:WorldCore.clone(tavernState.tavernSettings),snapshots:TimeRewind.snapshots.slice()};
  const active=typeof getActiveChat==='function'?getActiveChat():null;
  if(active&&!next.cosmetic)takeSnapshot(active.messages,active.variables);
  try{
   GameState.player=next.player;Economy=next.economy;GameTime=next.gameTime;WorldState=next.worldState;QuestSystem=next.questSystem;
   if(!next.cosmetic){GameState.player.history=GameState.player.history||[];
   GameState.player.history.unshift({time:getTimeString(),text:next.message});GameState.player.history=GameState.player.history.slice(0,100);}
   if(!saveToLocalStorage())throw Error('浏览器未能保存地图进度，行动已撤回');
  }catch(e){
   GameState.player=previous.player;Economy=previous.economy;GameTime=previous.time;WorldState=previous.world;QuestSystem=previous.quests;GameState.settings=previous.settings;tavernState.tavernSettings=previous.tavernSettings;TimeRewind.snapshots=previous.snapshots;throw e;
  }
  if(typeof renderTimeDisplay==='function')renderTimeDisplay();
  if(typeof updateTavernInfo==='function')updateTavernInfo();
 }
 function execute(action){
  try{if(isBusy())throw Error(movement?'角色正在行走，请先停步再执行其他行动':'正在推演，请先停止或等待本轮完成，再执行地图行动');
   const before=getContext(),next=WorldCore.transition(data(),before,action);commit(next,before);proposal=null;changed();notify(next.message,'success');return next;
  }catch(e){notify(e.message,'error');return null;}
 }
 function talkIntent(npcId){
  const ctx=getContext(),npc=WorldCore.nearbyNpcs(data(),ctx).find(n=>n.id===npcId&&n.available);if(!npc){notify('请先到达人物附近','info');return;}
  const text='我在'+WorldCore.node(data(),ctx.state.locationId).name+'向'+npc.name+'（'+npc.role+'）交谈，询问眼下的生活、委托或路况。请按现有关系与已知事实回应，不自动结算旅行或交易。';
  if(custom?.onTalk){custom.onTalk(text,npc);return;}
  const btn=document.getElementById('sidebar-tavern');switchGameView('tavern',btn);
  const input=document.getElementById('tavern-input');if(input){input.value=text;input.focus();}
  notify('对话已写入输入框；发送后才调用你配置的模型','info');
 }
 function promptContext(){
  try{return WorldCore.promptContext(data(),getContext());}catch{return '';}
 }
 function offerProposal(text,chatId){
  if(!custom&&chatId!==tavernState.activeChatId)return false;
  const ctx=getContext(),action=WorldCore.proposal(data(),ctx,text);if(!action)return false;
  proposal={action,seed:ctx.state.seed,turn:ctx.state.turn,chatId};changed();notify('收到地图行动建议，可在地图中查看成本并确认','info');return true;
 }
 function getProposal(){if(!proposal)return null;const ctx=getContext();if(ctx.state.seed!==proposal.seed||ctx.state.turn!==proposal.turn||!custom&&tavernState.activeChatId!==proposal.chatId){proposal=null;return null;}return proposal.action;}
 return {data,getContext,ensure:getContext,isBusy,isMoving:()=>!!movement,beginMovement,finishMovement,cancelMovement,execute,talkIntent,promptContext,offerProposal,getProposal,clearProposal(){proposal=null;changed();},configure(adapter){custom=adapter;proposal=null;movement=null;},subscribe(cb){listeners.add(cb);return()=>listeners.delete(cb);},refresh:changed};
})();
