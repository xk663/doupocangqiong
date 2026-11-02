/* Inspection thumbnails only. Production illustrations and their pixels are never modified. */
const fs=require('node:fs'),path=require('node:path'),sharp=require('D:/doupo/image-tools/node_modules/sharp');
const root=path.resolve(__dirname,'..'),catalogue=require('./data/world-regions.json'),profiles=require('../assets/js/place-interactions.js');
const out=path.join(root,'output/region-expansion/review');fs.mkdirSync(out,{recursive:true});
function esc(t){return String(t).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));}
(async()=>{let complete=0;for(const r of catalogue.regions.filter(r=>!process.argv[2]||r.id===process.argv[2])){
 const tiles=[{id:r.id,name:r.name+' · 地区地图',file:r.mapArt,points:r.branches.filter(p=>!p.secret).map(p=>({x:p.x,y:p.y}))},...r.branches.map(p=>({id:p.id,name:p.name,file:p.art,points:r.id==='wutan'?profiles.get(p.id)?.points||[]:p.interactions}))];if(tiles.some(t=>!fs.existsSync(path.join(root,t.file))))continue;
 const layers=[];for(let i=0;i<tiles.length;i++){const t=tiles[i],left=i%4*400,top=Math.floor(i/4)*320,image=await sharp(path.join(root,t.file)).resize(396,264,{fit:'inside',background:'#f5f3e7'}).png().toBuffer();layers.push({input:image,left:left+2,top:top+2});
  const svg='<svg width="400" height="320" xmlns="http://www.w3.org/2000/svg">'+t.points.map((q,j)=>'<g transform="translate('+(q.x*3.96+2)+','+(q.y*2.64+2)+')"><circle r="10" fill="#285941" fill-opacity=".85" stroke="#fff8db"/><text text-anchor="middle" y="4" font-size="13" font-family="sans-serif" fill="#fff">'+(j+1)+'</text></g>').join('')+'<text x="10" y="288" fill="#254b3a" font-family="Microsoft YaHei,SimSun,sans-serif" font-size="18">'+esc(t.name)+'</text><text x="10" y="310" fill="#526953" font-family="sans-serif" font-size="14">'+esc(t.id)+'</text></svg>';
  layers.push({input:Buffer.from(svg),left,top});
 }
 await sharp({create:{width:1600,height:Math.ceil(tiles.length/4)*320,channels:3,background:'#f5f3e7'}}).composite(layers).jpeg({quality:95}).toFile(path.join(out,r.id+'.jpg'));complete++;
 }console.log(JSON.stringify({complete,total:catalogue.regions.length}));})().catch(e=>{console.error(e.message);process.exitCode=1;});
