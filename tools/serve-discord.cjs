/* Publication entry point: missing Discord configuration stops startup, never falls back to anonymous access. */
'use strict';
const {createServer}=require('./serve.cjs');
const {configuration,createGate}=require('./discord-gate.cjs');
if(require.main===module){
 try{
  const config=configuration(),url=new URL(config.origin);
  const port=Number(process.env.PORT||url.port||(url.protocol==='https:'?8090:80));
  if(!Number.isInteger(port)||port<1||port>65535)throw Error('PORT must be between 1 and 65535');
  const loopback=['localhost','127.0.0.1'].includes(url.hostname);
  // Keep the Gemini relay local. A public authorization server must not expose its own localhost:8080.
  const server=createServer({gate:createGate(config),publicOrigin:config.origin,enableRelay:loopback});
  server.on('error',()=>{console.error('Discord server could not start; check PORT and binding.');process.exitCode=1;});
  server.listen(port,'127.0.0.1',()=>console.log('Discord community gate: '+config.origin));
 }catch(error){console.error('Discord gate configuration: '+error.message);process.exitCode=1;}
}
