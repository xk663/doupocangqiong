/* Uncommitted response recovery, separate from story history and game state. */
(function(root,factory){
 const create=factory(typeof module==='object'&&module.exports?require('./tavern-core.js'):root.TavernCore);
 if(typeof module==='object'&&module.exports)module.exports={create};
 else root.TavernFailureUI=create({getStorage:()=>root.sessionStorage,getDocument:()=>root.document,getSecrets:()=>{
  const s=root.GameState?.settings||{};return (s.apis||[]).flatMap(a=>[a.apiKey,a.key]).concat(s.discordWebhook,s.beautyApi?.apiKey,s.beautyApi?.key);
 }});
})(typeof globalThis!=='undefined'?globalThis:this,function(core){
 'use strict';
 const key='doupo_failed_turns_v1',limit=200000,maxRows=5;
 const phases={prepare:'组装请求',response:'接收模型响应',process:'处理回复',save:'保存回复'};
 return function create({getStorage=()=>null,getDocument=()=>null,getSecrets=()=>[]}={}){
  let rows=null,durable=true;
  function sanitize(value){let text=String(value??''),secrets=[];try{const values=getSecrets();if(Array.isArray(values))secrets=values.filter(v=>typeof v==='string'&&v.length);}catch{}for(const secret of secrets.sort((a,b)=>b.length-a.length))text=text.split(secret).join('[密钥已隐藏]');return text;}
  function load(){
   if(rows)return;rows=[];
   try{const raw=getStorage()?.getItem(key);if(!raw||raw.length>2200000)return;const data=core.parseJSON(raw);
    if(data.version!==1||!Array.isArray(data.rows))return;
    rows=data.rows.slice(-maxRows).filter(r=>r&&typeof r.chatId==='string'&&r.chatId.length<=200&&typeof r.requestId==='string'&&r.requestId.length<=200&&typeof r.message==='string'&&typeof r.body==='string'&&r.body.length<=limit&&Object.hasOwn(phases,r.phase));
   }catch{durable=false;}
  }
  function persist(){try{const storage=getStorage();if(!storage){durable=false;return;}storage.setItem(key,JSON.stringify({version:1,rows}));durable=true;}catch{durable=false;}}
  function capture(request,chunk){
   if(typeof chunk!=='string')return;request.receivedCharacters=(request.receivedCharacters||0)+chunk.length;
   const current=request.receivedText||'';if(current.length<limit)request.receivedText=current+chunk.slice(0,limit-current.length);
  }
  function complete(request,text){request.receivedCharacters=typeof text==='string'?text.length:0;request.receivedText=typeof text==='string'?text.slice(0,limit):'';}
  function record(request,error){
   load();if(!request?.chatId||!request.id||request.committed||request.controller?.signal.aborted||error?.name==='AbortError')return;
   const body=sanitize(request.receivedText||'').slice(0,limit),entry={chatId:String(request.chatId).slice(0,200),requestId:String(request.id).slice(0,200),phase:Object.hasOwn(phases,request.phase)?request.phase:'response',message:sanitize(error?.message||'请求未正常完成').slice(0,1200),body,receivedCharacters:Math.max(body.length,Number(request.receivedCharacters)||0),time:Date.now()};
   rows=rows.filter(r=>r.chatId!==entry.chatId).concat(entry).slice(-maxRows);persist();return core.clone(entry);
  }
  function get(chatId){load();const row=rows.find(r=>r.chatId===chatId);return row?core.clone(row):null;}
  function clear(chatId){load();rows=rows.filter(r=>r.chatId!==chatId);persist();}
  function render(chatId){
   const row=get(chatId),doc=getDocument();if(!row||!doc)return null;
   const box=doc.createElement('aside');box.className='msg-request-error';box.setAttribute('role','alert');
   const title=doc.createElement('strong');title.textContent='本轮推演未完成 · '+phases[row.phase];box.appendChild(title);
   const message=doc.createElement('p');message.textContent=sanitize(row.message);box.appendChild(message);
   const note=doc.createElement('p');note.textContent='错误原因会保留在这里。重演会重新请求模型，请先查看已接收的内容。';box.appendChild(note);
   if(row.body){
    const details=doc.createElement('details'),summary=doc.createElement('summary'),pre=doc.createElement('pre');
    summary.textContent='查看已接收内容（未完成，'+row.receivedCharacters+' 字符）';
    pre.textContent=sanitize(row.body);details.appendChild(summary);details.appendChild(pre);box.appendChild(details);
    const warning=doc.createElement('p');warning.textContent='此处是未完成请求的响应，可能包含格式标签或不完整片段，不代表剧情已生效。'+(row.receivedCharacters>row.body.length?' 已接收内容较长，此处保留前 '+limit+' 字符。':'');box.appendChild(warning);
   }
   if(!durable){const warning=doc.createElement('p');warning.textContent='浏览器未能保存这条错误记录，刷新前请先复制需要保留的内容。';box.appendChild(warning);}
   return box;
  }
  return {capture,complete,record,get,clear,render};
 };
});
