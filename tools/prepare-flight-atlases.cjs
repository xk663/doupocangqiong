/* Read alpha components to author sprite-frame metadata; never alter illustration pixels. */
const fs=require('node:fs'),path=require('node:path'),sharp=require('D:/doupo/image-tools/node_modules/sharp');
const root=path.resolve(__dirname,'..');
(async()=>{const metadata={};for(const id of ['xiaoyan','xuner','xiaoyixian','medusa']){
 const job=JSON.parse(fs.readFileSync(path.join(root,'output/region-expansion/flight-'+id+'-v3.json'),'utf8'));
 const {data,info}=await sharp(job.source).raw().toBuffer({resolveWithObject:true}),W=info.width,H=info.height;
 const seen=new Uint8Array(W*H),queue=new Int32Array(W*H),slots=Array(12).fill(null);
 for(let start=0;start<W*H;start++){if(seen[start]||data[start*4+3]<70)continue;let size=0,left=W,right=0,top=H,bottom=0,head=0,tail=0;queue[tail++]=start;seen[start]=1;
  while(head<tail){const at=queue[head++],x=at%W,y=Math.floor(at/W);size++;left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);for(const next of [x>0?at-1:-1,x<W-1?at+1:-1,y>0?at-W:-1,y<H-1?at+W:-1])if(next>=0&&!seen[next]&&data[next*4+3]>=70){seen[next]=1;queue[tail++]=next;}}
  if(size<10000)continue;const column=Math.floor((left+right)/2/(W/4)),row=Math.floor((top+bottom)/2/(H/3)),slot=row*4+column;if(!slots[slot]||size>slots[slot].size)slots[slot]={size,left,right,top,bottom};
 }
 if(slots.some(s=>!s)||slots.length!==12)throw Error(id+': incomplete atlas');
 const frames=slots.map(s=>{const x=Math.max(0,s.left-4),y=Math.max(0,s.top-4),right=Math.min(W,s.right+5),bottom=Math.min(H,s.bottom+5);let sum=0,count=0;for(let py=s.bottom-11;py<=s.bottom;py++)for(let px=s.left;px<=s.right;px++)if(data[(py*W+px)*4+3]>=100){sum+=px;count++;}const footX=count?sum/count:(s.left+s.right)/2;return {x,y,width:right-x,height:bottom-y,trimX:x-footX+W/8,trimY:y-s.bottom+H/3*.94};});
 const target='assets/images/avatars/avatar-'+id+'-flight-sheet-v3.webp';await sharp(job.source).webp({quality:94,alphaQuality:100,effort:5}).toFile(path.join(root,target));
 metadata[id]={image:target,width:W,height:H,frames,visibleHeight:Math.max(...slots.map(s=>s.bottom-s.top+1))/(H/3),source:job.source,prompt:job.prompt};
 }fs.writeFileSync(path.join(root,'assets/data/flight-atlas-frames.json'),JSON.stringify(metadata,null,2)+'\n');
 const runtime=Object.fromEntries(Object.entries(metadata).map(([id,m])=>[id,{image:m.image,width:m.width,height:m.height,frames:m.frames,visibleHeight:m.visibleHeight}]));
 fs.writeFileSync(path.join(root,'assets/js/world-flight-frames.js'),"/* Full figure bounds prevent a neighbouring pose from leaking into a direction frame. */\n(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.WorldFlightFrames=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){return "+JSON.stringify(runtime)+";});\n");console.log(JSON.stringify(Object.fromEntries(Object.entries(runtime).map(([id,m])=>[id,{frames:m.frames.length,visibleHeight:m.visibleHeight}]))));
})().catch(e=>{console.error(e);process.exitCode=1;});
