(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./tavern-core.js'));else root.TavernWiring=factory(root.TavernCore);})(typeof globalThis!=='undefined'?globalThis:this,function(core){
 'use strict';
 function regex(text,scripts,layer,role,depth){
  return (scripts||[]).reduce(function(out,s){
   if(s.disabled||!s.findRegex||!['0','1','2',0,1,2].includes(s.placement??0))return out;
   var p=Number(s.placement)||0;if(p!==2&&p!==layer)return out;if(s.promptOnly&&layer===0)return out;
   if(s.targetRole&&s.targetRole!=='all'&&s.targetRole!==role)return out;
   if(s.minDepth!=null&&s.minDepth!==''&&depth<Number(s.minDepth)||s.maxDepth!=null&&s.maxDepth!==''&&depth>Number(s.maxDepth))return out;
   try{return out.replace(pattern(s.findRegex),String(s.replaceString||'').replace(/\{\{match\}\}/g,()=>'$&'));}catch{return out;}
  },String(text||''));
 }
 function pattern(value){var text=String(value),m=text.match(/^\/([\s\S]*)\/([dgimsuvy]*)$/);return new RegExp(m?m[1]:text,m?m[2]:'g');}
 function options(settings){return {scanDepth:Math.max(0,Math.min(100,Math.floor(Number(settings.loreScanDepth??6)||0))),budget:Math.max(0,Math.min(32768,Math.floor(Number(settings.loreBudget??8192)||0))),maxDepth:Math.max(0,Math.min(8,Math.floor(Number(settings.loreRecursionDepth??3)||0)))};}
 function resolve(v){
  var s=v.settings||{},chat=v.chat||{},ids=new Set([...(v.globalIds||[]),...(chat.lorebookIds||[])]),cfg=options(s),trace=[];
  var books=(v.books||[]).filter(b=>ids.has(b.id)&&b.enabled!==false&&!b.catalogArchive);
  var preset=(v.presets||[]).find(p=>p.id===chat.presetId)||(v.presets||[]).find(p=>p.id===s.activePresetId)||(v.presets||[])[0]||{};
  var input=regex(v.input,v.regexes,1,'user',0),history=(v.history||[]).map((m,i,a)=>({role:m.role,content:regex(m.content,v.regexes,1,m.role,a.length-i)}));
  // Character sheets and system instructions may mention names only to forbid assumptions.
  // They remain in the request, but do not act as conversational keyword evidence.
  var conversation=history.filter(m=>m.role==='user'||m.role==='assistant');
  var scan=(cfg.scanDepth?conversation.slice(-cfg.scanDepth).map(m=>m.content).join('\n'):'')+'\n'+input;
  var matches=core.matchLorebooks(scan,books,{budget:cfg.budget,maxDepth:cfg.maxDepth,trace:trace});
  var userName=String(v.player?.name||'').trim()||'玩家';
  return {userName,preset,input,history,matches,trace,options:cfg,books:books.map(b=>({id:b.id,name:b.name})),inactiveBooks:(v.books||[]).filter(b=>!books.includes(b)).map(b=>({id:b.id,name:b.name})),missingIds:[...ids].filter(id=>!(v.books||[]).some(b=>b.id===id))};
 }
 return {regex,pattern,resolve,options};
});
