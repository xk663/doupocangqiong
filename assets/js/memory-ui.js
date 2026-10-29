var MemoryUI=(function(){
 'use strict';
 let saving=false;
 const clone=v=>TavernCore.clone(v);
 function blocked(){return saving||tavernState.isSending||tavernState.isLoading||
  (typeof BattleBridge!=='undefined'&&BattleBridge.isBusy())||
  (typeof WorldMapBridge!=='undefined'&&WorldMapBridge.isBusy())||
  (typeof SaveManager!=='undefined'&&SaveManager.isBusy())||
  (typeof SummaryUI!=='undefined'&&SummaryUI.isBusy())||
  (typeof ResidenceUI!=='undefined'&&ResidenceUI.isBusy())||
  (typeof BeautyRoster!=='undefined'&&BeautyRoster.isBusy());}
 async function update(transform){
  if(blocked()){showToast('请等待当前行动或保存结束','info');return false;}
  const source=getActiveChat();if(!source||!db){showToast('当前没有可保存的会话','info');return false;}
  const fingerprint=JSON.stringify(source),owner=GameState.player,playerStamp=JSON.stringify(owner);
  saving=true;tavernState.isEditingMemory=true;
  try{
   const result=transform(clone(source),clone(owner)),next=result.chat,nextPlayer=result.player;
   next.updatedAt=Date.now();
   const check=()=>{if(tavernState.isSending||getActiveChat()?.id!==source.id||JSON.stringify(getActiveChat())!==fingerprint||GameState.player!==owner||JSON.stringify(owner)!==playerStamp)throw Error('会话或人物已变化，本次修改已取消');};
   await db.transaction('rw',[db.chats,db.tavernSettings],async()=>{
    check();
    if(db.chats.get){const stored=await db.chats.get(source.id);if(!stored||JSON.stringify(stored)!==fingerprint)throw Error('其他页面已更新会话，请刷新后重试');}
    if(nextPlayer)next.playerState=clone(nextPlayer);
    await db.chats.put(next);
    if(nextPlayer)await db.tavernSettings.put({...tavernState.tavernSettings,id:'main',playerState:nextPlayer,playerStateAt:Date.now()});
    check();
   });
   tavernState.chats=tavernState.chats.map(c=>c.id===next.id?next:c);
   if(nextPlayer){GameState.player=nextPlayer;if(!saveToLocalStorage())showToast('已存入数据库，本地备份失败','info');}
   const body=document.getElementById('summary-body');if(body)renderMemoryTable(body);
   return true;
  }catch(e){showToast('未保存：'+e.message,'error');return false;}
  finally{saving=false;tavernState.isEditingMemory=false;}
 }
 async function rebuild(){if(await update(chat=>({chat:{...chat,memoryTable:MemoryCore.build(chat.messages,chat.memoryTable)}})))showToast('正文摘录与来源索引已保存','success');}
 async function add(kind){const value=prompt(kind==='fact'?'请输入要长期保留的确认事实：':'请输入未完事项：');if(!value)return;const fn=kind==='fact'?MemoryCore.addFact:MemoryCore.addThread;if(await update(chat=>({chat:{...chat,memoryTable:fn(chat.memoryTable,value)}})))showToast('记忆已保存','success');}
 return{update,rebuild,add,isBusy:()=>saving};
})();
