(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else{root.TitleMenu=api;if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',api.init,{once:true});else api.init();}
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const text=(value,limit=100)=>typeof value==='string'?value.trim().slice(0,limit):'';
  function describe(state,world,readSaves){
    const p=state?.player||{};
    if(state?.phase==='creation'&&p.worldMode)return {available:true,label:'继续创角',name:text(p.name,40)||'未完成的命书',details:'创角进度 · 第 '+Math.max(1,Math.min(6,(Number(p.creationStep)||0)+1))+' 步',source:'creation'};
    if(text(p.name)&&text(p.race))return {available:true,label:'继续人生',name:text(p.name,40),details:[text(p.realm)||'实力未记录',text(world?.location)||'所在地未记录'].join(' · '),source:'current'};
    try{
      const list=typeof readSaves==='function'?readSaves():[];
      const slots=(Array.isArray(list)?list:[]).filter(s=>s&&!s.deletedAt&&s.player&&typeof s.id==='string');
      slots.sort((a,b)=>(Number(b.updatedAt||b.timestamp)||0)-(Number(a.updatedAt||a.timestamp)||0));
      if(slots.length){const s=slots[0];return {available:true,label:'继续人生',name:text(s.player.name,40)||'未命名角色',details:[text(s.player.realm)||'实力未记录',text(s.worldState?.location)||text(s.player.location)||'所在地未记录'].join(' · '),source:'save'};}
    }catch{return {available:false,label:'继续人生',name:'存档库暂无法读取',details:'请打开存档管理检查，原数据已保留。',source:'error'};}
    return {available:false,label:'继续人生',name:'待启新卷',details:'山河尚未落笔，故事由此开始。',source:'empty'};
  }
  function render(){
    const host=document.getElementById('view-title');if(!host)return;
    const state=typeof GameState!=='undefined'?GameState:null,world=typeof WorldState!=='undefined'?WorldState:null;
    const info=describe(state,world,typeof getSaves==='function'?getSaves:null);
    const summary=host.querySelector('.title-resume');
    const sourceLabel={current:'当前自动进度 · 独立于手动存档',save:'可读取的手动存档',creation:'尚未完成的创角',empty:'尚无可继续进度',error:'存档读取状态'}[info.source];
    if(summary){summary.setAttribute('aria-label',sourceLabel);let source=document.getElementById('title-resume-source');if(!source){source=document.createElement('small');source.id='title-resume-source';summary.querySelector('div')?.prepend(source);}source.textContent=sourceLabel;}
    const resume=document.getElementById('btn-continue'),fresh=document.getElementById('btn-new-game');
    if(resume){resume.disabled=!info.available;resume.setAttribute('aria-disabled',String(!info.available));resume.classList.toggle('primary',info.available);resume.style.opacity='';resume.style.pointerEvents='';}
    if(fresh)fresh.classList.toggle('primary',!info.available);
    for(const [id,value]of [['title-continue-label',info.label],['title-resume-name',info.name],['title-resume-details',info.details]]){const e=document.getElementById(id);if(e){e.textContent=value;e.title=value;}}
  }
  function init(){
    const host=document.getElementById('view-title');if(!host)return;
    render();new MutationObserver(()=>{if(host.classList.contains('active'))render();}).observe(host,{attributes:true,attributeFilter:['class']});
    window.addEventListener('storage',e=>{if(['doupo_runtime','doupo_player','doupo_saves'].includes(e.key)||e.key===null)render();});
  }
  return {describe,render,init};
});
