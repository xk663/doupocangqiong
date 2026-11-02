/* Bounded response statistics. Public thought summaries are separate from visible prose. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.ModelResponseProfile=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const vectorSize=16;
  function canonical(value){return typeof value==='string'?value.trim().replace(/^models\//,'').replace(/^google\//,'').slice(0,200):'';}
  function family(value){
    const name=canonical(value).toLowerCase();
    for(const [prefix,id]of [[/(?:^|\/)gemini(?:-|$)/,'gemini'],[/(?:^|\/)claude(?:-|$)/,'claude'],[/(?:^|\/)(?:gpt-|chatgpt-|o[134](?:-|$))/,'gpt'],[/(?:^|\/)qwen/,'qwen'],[/(?:^|\/)deepseek/,'deepseek'],[/(?:^|\/)llama/,'llama'],[/(?:^|\/)gemma/,'gemma'],[/(?:^|\/)mistral/,'mistral']])if(prefix.test(name))return id;
    return '';
  }
  function stable(value){
    if(Array.isArray(value))return value.map(stable);
    if(value&&typeof value==='object'){const next={};for(const key of Object.keys(value).sort())if(!['__proto__','constructor','prototype'].includes(key)&&typeof value[key]!=='function')next[key]=stable(value[key]);return next;}
    return value;
  }
  // Portable SHA-256 also works on mobile LAN HTTP pages without crypto.subtle.
  function endpointDigest(text){
    const constants=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
    const bytes=new TextEncoder().encode(text),length=Math.ceil((bytes.length+9)/64)*64,padded=new Uint8Array(length),words=new Uint32Array(64),state=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
    padded.set(bytes);padded[bytes.length]=128;const data=new DataView(padded.buffer);data.setUint32(length-8,Math.floor(bytes.length/0x20000000));data.setUint32(length-4,bytes.length*8);
    const rotr=(x,n)=>(x>>>n)|(x<<(32-n));
    for(let offset=0;offset<length;offset+=64){
      for(let i=0;i<16;i++)words[i]=data.getUint32(offset+i*4);
      for(let i=16;i<64;i++){const a=words[i-15],b=words[i-2];words[i]=(words[i-16]+(rotr(a,7)^rotr(a,18)^(a>>>3))+words[i-7]+(rotr(b,17)^rotr(b,19)^(b>>>10)))>>>0;}
      let [a,b,c,d,e,f,g,h]=state;
      for(let i=0;i<64;i++){const t1=(h+(rotr(e,6)^rotr(e,11)^rotr(e,25))+((e&f)^((~e)&g))+constants[i]+words[i])>>>0,t2=((rotr(a,2)^rotr(a,13)^rotr(a,22))+((a&b)^(a&c)^(b&c)))>>>0;h=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;}
      [a,b,c,d,e,f,g,h].forEach((value,i)=>state[i]=(state[i]+value)>>>0);
    }
    return state.map(value=>value.toString(16).padStart(8,'0')).join('');
  }
  function stats(raw){
    const text=raw.replace(/<(quest_updates|residence_updates|flame_updates|summary_updates|battle_updates|upstore|branches)\b[^>]*>[\s\S]*?(?:<\/\1>|$)/gi,'').replace(/<\/(?:p|div|blockquote|section)>/gi,'\n').replace(/<[^>]*>/g,'').trim();
    const length=text.length;if(!length)return {chars:0,vector:Array(vectorSize).fill(0)};
    const count=pattern=>(text.match(pattern)||[]).length;
    const sentences=text.split(/[。！？!?\n]+|\.(?:\s|$)/).map(t=>t.trim()).filter(Boolean).map(t=>t.length);
    const mean=sentences.reduce((a,b)=>a+b,0)/Math.max(1,sentences.length),sd=Math.sqrt(sentences.reduce((a,b)=>a+(b-mean)**2,0)/Math.max(1,sentences.length));
    const lines=text.split(/\r?\n/).filter(t=>t.trim()),paragraphs=text.split(/\n\s*\n/).filter(t=>t.trim());
    const cap=(number,scale)=>Math.min(1,number/scale);
    const vector=[cap(mean,160),cap(sd,160),cap(length/Math.max(1,paragraphs.length),1200),cap(count(/[\n]/g)/length,.08),cap(count(/[，,]/g)/length,.12),cap(count(/[：:]/g)/length,.08),cap(count(/[；;]/g)/length,.06),cap(count(/[“”「」『』"]/g)/length,.12),cap(count(/[（）()]/g)/length,.1),cap(count(/[—–]/g)/length,.06),cap(count(/[!?！？]/g)/length,.06),count(/[\u3400-\u9fff]/g)/length,count(/[A-Za-z]/g)/length,count(/[0-9]/g)/length,lines.filter(t=>/^\s*(?:[-*•]|\d+[.、)])\s*/.test(t)).length/Math.max(1,lines.length),lines.filter(t=>/^\s*#{1,6}\s/.test(t)).length/Math.max(1,lines.length)];
    return {chars:length,vector:vector.map(v=>Math.round(v*10000)/10000)};
  }
  function create(backend,contextKey,body){
    let prose='',summary='',proseChars=0,summaryChars=0,thoughtTokens=null;const sources=new Set();
    const config=backend==='gemini'?body.generationConfig:Object.fromEntries(Object.entries(body).filter(([key])=>!['messages','contents','systemInstruction','prompt','model','stream'].includes(key)));
    const samplingKey=endpointDigest(JSON.stringify(stable(config||{})));
    function add(text,thought,source){if(typeof text!=='string')return;if(thought){summaryChars+=text.length;if(summary.length<12000)summary+=text.slice(0,12000-summary.length);if(text)sources.add(source);}else{proseChars+=text.length;if(prose.length<24000)prose+=text.slice(0,24000-prose.length);}}
    function observe(data){
      if(!data||typeof data!=='object')return;
      if(backend==='gemini'){
        const parts=data.candidates?.[0]?.content?.parts;
        if(Array.isArray(parts))for(const part of parts)add(part.text,part.thought===true,'parts.thought');
      }else{
        const part=data.choices?.[0]?.delta||data.choices?.[0]?.message||data.message;
        if(part){add(part.content,false);const field=typeof part.reasoning_content==='string'?'reasoning_content':typeof part.reasoning==='string'?'reasoning':typeof part.thinking==='string'?'thinking':null;if(field)add(part[field],true,field);}
      }
      const tokens=data.usageMetadata?.thoughtsTokenCount??data.usage?.completion_tokens_details?.reasoning_tokens;
      if(Number.isFinite(tokens)&&tokens>=0)thoughtTokens=Math.max(thoughtTokens||0,tokens);
    }
    function result(){return {version:1,contextKey:typeof contextKey==='string'?contextKey.slice(0,64):'',samplingKey,body:stats(prose),summary:stats(summary),bodyTruncated:proseChars>24000,summaryTruncated:summaryChars>12000,summarySources:[...sources].slice(0,4),reportedThoughtTokens:thoughtTokens};}
    return {observe,result};
  }
  return {create,stats,family,canonical,stable,endpointDigest,vectorSize};
});
