(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.ReplayGuard=factory();})(globalThis,function(){
 'use strict';
 function canonical(value){if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().filter(k=>value[k]!==undefined).map(k=>[k,canonical(value[k])]));return value;}
 // A consistency marker, not an authentication hash. Settings and UI selection are deliberately excluded.
 function stamp(state){const text=JSON.stringify(canonical(state));let a=2166136261,b=5381;for(let i=0;i<text.length;i++){a=Math.imul(a^text.charCodeAt(i),16777619);b=Math.imul(b,33)^text.charCodeAt(i);}return 'v1:'+text.length+':'+(a>>>0).toString(36)+':'+(b>>>0).toString(36);}
 function assertCurrent(saved,current){if(!saved)throw Error('此旧回合没有重演校验记录，请先回溯到对应时间点，或发送新消息继续');if(saved!==current)throw Error('此回合之后的人生进度或会话记录已变化，已阻止重演覆盖。请先使用时空回溯，或发送新消息继续');}
 return{stamp,assertCurrent};
});
