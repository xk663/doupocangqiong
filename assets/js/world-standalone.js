(function(){
 'use strict';
 const key='doupo-world-demo-v1';let ctx;
 function fresh(){const state=WorldCore.initial(DoupoWorldData,'wutan','standalone-journey');return {state,player:{name:'山河旅人',gender:'male',realm:'斗之气·三段',inventory:[{name:'干粮',qty:5},{name:'水囊',qty:5},{name:'低阶药材',qty:3}],exploration:state},economy:{gold:40},gameTime:{era:'斗气历',year:1,month:9,day:15,hour:8,minute:0,totalHours:0},worldState:{location:'乌坦城',specificSpot:'城门',weather:'晴 · 微风'},questSystem:{quests:[],completed:[],failed:[]}};}
 try{ctx=JSON.parse(localStorage.getItem(key))||fresh();ctx.state=WorldCore.normalize(DoupoWorldData,ctx.state,ctx.player,ctx.worldState);}catch{ctx=fresh();}
 let timer;function toast(text){let el=document.querySelector('.world-demo-toast');if(!el){el=document.createElement('div');el.className='world-demo-toast';el.setAttribute('role','status');document.body.append(el);}el.textContent=text;clearTimeout(timer);timer=setTimeout(()=>el.remove(),6000);}
 WorldMapBridge.configure({read:()=>ctx,isBusy:()=>false,commit(next){localStorage.setItem(key,JSON.stringify(next));ctx=next;},toast,onTalk(text){const panel=document.getElementById('demo-talk');panel.hidden=false;panel.querySelector('textarea').value=text;panel.querySelector('textarea').focus();}});
 function genderButtons(){for(const b of document.querySelectorAll('[data-demo-gender]'))b.setAttribute('aria-pressed',String((ctx.player.gender||'male')===b.dataset.demoGender));}
 for(const b of document.querySelectorAll('[data-demo-gender]'))b.onclick=()=>{if(WorldMapBridge.isMoving()){toast('先停步再切换形象');return;}const before=ctx.player.gender;try{ctx.player.gender=b.dataset.demoGender;localStorage.setItem(key,JSON.stringify(ctx));genderButtons();WorldMapBridge.refresh();}catch{ctx.player.gender=before;toast('形象未能保存，请检查浏览器空间');}};genderButtons();
 document.getElementById('demo-talk-close').onclick=()=>{document.getElementById('demo-talk').hidden=true;};
 WorldMapUI.mount(document.getElementById('world-demo-root'));
})();
