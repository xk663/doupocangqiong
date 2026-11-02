/* Development-only isolated map/fixture preview; the game and OAuth entry points stay unavailable. */
const http=require('node:http'),{createServer}=require('./serve.cjs');
const staticServer=createServer({enableRelay:false});
http.createServer((req,res)=>{let pathname;try{pathname=new URL(req.url,'http://127.0.0.1').pathname;}catch{res.writeHead(400).end();return;}
 if(!['GET','HEAD'].includes(req.method)||!(/^\/map\.html$/.test(pathname)||/^\/(assets|tests\/fixtures)\//.test(pathname))){res.writeHead(404,{'Content-Type':'text/plain'}).end('Preview only');return;}
 staticServer.emit('request',req,res);
}).listen(8092,'127.0.0.1',()=>console.log('Isolated map preview: http://127.0.0.1:8092/map.html'));
