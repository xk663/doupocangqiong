const fs=require('node:fs'),path=require('node:path'),sharp=require('D:/doupo/image-tools/node_modules/sharp');
const root=path.resolve(__dirname,'..');
(async()=>{for(const id of ['xiaoyan','xuner','xiaoyixian','medusa']){
 const job=JSON.parse(fs.readFileSync(path.join(root,'output/region-expansion/flight-'+id+'-v3.json'),'utf8'));
 const {data,info}=await sharp(job.source).raw().toBuffer({resolveWithObject:true});const W=info.width,H=info.height,seen=new Uint8Array(W*H),stack=new Int32Array(W*H),components=[];
 for(let start=0;start<W*H;start++){if(seen[start]||data[start*4+3]<70)continue;let count=0,left=W,right=0,top=H,bottom=0,head=0,tail=0;stack[tail++]=start;seen[start]=1;
  while(head<tail){const at=stack[head++],x=at%W,y=Math.floor(at/W);count++;left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);for(const next of [x>0?at-1:-1,x<W-1?at+1:-1,y>0?at-W:-1,y<H-1?at+W:-1])if(next>=0&&!seen[next]&&data[next*4+3]>=70){seen[next]=1;stack[tail++]=next;}}
  if(count>500)components.push({count,left,top,right,bottom,width:right-left+1,height:bottom-top+1});
 }
 components.sort((a,b)=>b.count-a.count);console.log(JSON.stringify({id,components:components.slice(0,16)}));
}})().catch(e=>{console.error(e);process.exitCode=1;});
