/* Local static preview plus a fixed Gemini same-origin relay. No credentials are stored. */
'use strict';
const http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path'),zlib=require('node:zlib'),{Readable}=require('node:stream');
const compressible=new Set(['.html','.js','.css','.json','.svg']);
const defaultRoot=path.resolve(__dirname,'..');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml'};
function createServer({root=defaultRoot,fetcher=fetch}={}){return http.createServer(async(req,res)=>{
 const deny=(status,message)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify({error:message}));};
 const host=req.headers.host||'';if(!/^(localhost|127\.0\.0\.1):\d+$/.test(host))return deny(403,'Local access only');
 if(req.headers.origin&&!['http://'+host,'http://localhost:'+host.split(':')[1],'http://127.0.0.1:'+host.split(':')[1]].includes(req.headers.origin))return deny(403,'Origin denied');
 let url;try{url=new URL(req.url,'http://'+host);}catch{return deny(400,'Invalid URL');}
 if(url.pathname.startsWith('/__gemini_proxy')){
  const route=url.pathname.slice('/__gemini_proxy'.length),listing=/^\/v1beta\/models(?:\/[A-Za-z0-9._-]+)?$/.test(route),generation=/^\/v1beta\/models\/[A-Za-z0-9._-]+:(?:generateContent|streamGenerateContent)$/.test(route);
  if(!((req.method==='GET'&&listing)||(req.method==='POST'&&generation))||[...url.searchParams.keys()].some(k=>k!=='alt')||(url.search&&url.searchParams.get('alt')!=='sse'))return deny(400,'Unsupported relay route');
  const ctl=new AbortController();res.on('close',()=>{if(!res.writableEnded)ctl.abort();});const timer=setTimeout(()=>ctl.abort(),120000);
  try{
   let body,bytes=0;if(req.method==='POST'){const chunks=[];for await(const chunk of req){bytes+=chunk.length;if(bytes>2*1024*1024)return deny(413,'Request too large');chunks.push(chunk);}body=Buffer.concat(chunks);}
   const headers={Accept:req.headers.accept||'*/*'};if(req.headers['content-type'])headers['Content-Type']=req.headers['content-type'];if(req.headers['x-goog-api-key'])headers['x-goog-api-key']=req.headers['x-goog-api-key'];
   const upstream=await fetcher('http://localhost:8080'+route+url.search,{method:req.method,headers,body,signal:ctl.signal,redirect:'error'});
   res.writeHead(upstream.status,{'Content-Type':upstream.headers.get('content-type')||'application/json','Cache-Control':'no-store'});res.flushHeaders();
   if(!upstream.body){res.end();return;}const stream=Readable.fromWeb(upstream.body);stream.on('error',()=>res.destroy());stream.pipe(res);await new Promise(resolve=>{res.once('finish',resolve);res.once('close',resolve);});
  }catch(e){if(!res.headersSent)deny(ctl.signal.aborted?504:502,'Local Gemini relay unavailable');else res.destroy();}finally{clearTimeout(timer);}return;
 }
 if(!['GET','HEAD'].includes(req.method))return deny(405,'Method not allowed');
 let name;try{name=decodeURIComponent(url.pathname);}catch{return deny(400,'Invalid path');}
 const target=path.resolve(root,'.'+(name==='/'?'/index.html':name));if(!target.startsWith(path.resolve(root)+path.sep)||name.split(/[\\/]/).some(p=>p.startsWith('.')))return deny(403,'Path denied');
 try{let body=await fs.readFile(target);const ext=path.extname(target),headers={'Content-Type':mime[ext]||'application/octet-stream','Cache-Control':'no-store'};
  if(compressible.has(ext)&&body.length>=1024){headers.Vary='Accept-Encoding';const accept=String(req.headers['accept-encoding']||'');
   if(/\bbr\b/.test(accept)){body=zlib.brotliCompressSync(body,{params:{[zlib.constants.BROTLI_PARAM_QUALITY]:5}});headers['Content-Encoding']='br';}
   else if(/\bgzip\b/.test(accept)){body=zlib.gzipSync(body,{level:6});headers['Content-Encoding']='gzip';}}
  headers['Content-Length']=body.length;res.writeHead(200,headers);res.end(req.method==='HEAD'?undefined:body);}catch{deny(404,'Not found');}
 });}
if(require.main===module){const port=Number(process.env.PORT)||8090;createServer().listen(port,'127.0.0.1',()=>console.log('Doupo: http://127.0.0.1:'+port));}
module.exports={createServer};
