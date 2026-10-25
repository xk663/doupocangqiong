(function(){
 'use strict';
 const practice=new URLSearchParams(location.search).get('practice')==='1',key=practice?'doupo-world-practice-v1':'doupo-world-demo-v1';let ctx;
 function fresh(){const state=WorldCore.initial(DoupoWorldData,practice?'wutan-market':'wutan',practice?'forms-practice':'standalone-journey');if(practice)state.avatarId='xiaoyixian';return {state,player:{name:'山河旅人',gender:'male',realm:practice?'斗王·一星':'斗之气·三段',inventory:[{name:'干粮',qty:5},{name:'水囊',qty:5},{name:'低阶药材',qty:3}],exploration:state},economy:{gold:practice?500:40},gameTime:{era:'斗气历',year:1,month:9,day:15,hour:8,minute:0,totalHours:0},worldState:{location:'乌坦城',specificSpot:'城门',weather:'晴 · 微风'},questSystem:{quests:[],completed:[],failed:[]}};}
 try{ctx=JSON.parse(localStorage.getItem(key))||fresh();ctx.state=WorldCore.normalize(DoupoWorldData,ctx.state,ctx.player,ctx.worldState);}catch{ctx=fresh();}
 let timer;function toast(text){let el=document.querySelector('.world-demo-toast');if(!el){el=document.createElement('div');el.className='world-demo-toast';el.setAttribute('role','status');document.body.append(el);}el.textContent=text;clearTimeout(timer);timer=setTimeout(()=>el.remove(),6000);}
 WorldMapBridge.configure({read:()=>ctx,isBusy:()=>false,commit(next){localStorage.setItem(key,JSON.stringify(next));ctx=next;},toast,onTalk(text){const panel=document.getElementById('demo-talk');panel.hidden=false;panel.querySelector('textarea').value=text;panel.querySelector('textarea').focus();}});
 const caption=document.getElementById('world-demo-caption');if(caption)caption.textContent=practice?'全形态练习 · 独立存档，不影响主游戏':'独立探索演示 · 自动保存，与主游戏存档独立';
 document.getElementById('demo-talk-close').onclick=()=>{document.getElementById('demo-talk').hidden=true;};
 WorldMapUI.mount(document.getElementById('world-demo-root'));
})();
