(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.PresetManager=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function effective(presets,settings,chat){
    return presets.find(p=>p.id===chat?.presetId)||presets.find(p=>p.id===settings?.activePresetId)||presets[0]||null;
  }
  function deletionPlan(presets,settings,chats,id,replacementId){
    if(!presets.some(p=>p.id===id))throw Error('预设不存在');
    if(presets.length<=1)throw Error('至少保留一个预设');
    if(id===replacementId||!presets.some(p=>p.id===replacementId))throw Error('请选择有效的替代预设');
    return {
      chats:chats.filter(c=>c.presetId===id).map(c=>({...c,presetId:replacementId})),
      settings:settings?.activePresetId===id?{...settings,activePresetId:replacementId}:null,
      presets:presets.filter(p=>p.id!==id)
    };
  }
  async function remove(db,presets,settings,id,replacementId){
    let plan;
    await db.transaction('rw',[db.presets,db.chats,db.tavernSettings],async()=>{
      plan=deletionPlan(presets,settings,await db.chats.toArray(),id,replacementId);
      for(const chat of plan.chats)await db.chats.put(chat);
      if(plan.settings){
        const key=plan.settings.id||'main',stored=await db.tavernSettings.get(key);
        await db.tavernSettings.put({...(stored||plan.settings),id:key,activePresetId:replacementId});
      }
      await db.presets.delete(id);
    });
    return plan;
  }
  return {effective,deletionPlan,remove};
});
