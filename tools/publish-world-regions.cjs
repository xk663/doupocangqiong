const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),catalogue=require('./data/world-regions.json');
const missing=catalogue.jobs.filter(j=>!fs.existsSync(path.join(root,j.target)));if(missing.length)throw Error(missing.length+' artwork assets remain');
const crypto=require('node:crypto');for(const job of catalogue.jobs){const result=JSON.parse(fs.readFileSync(path.join(root,'output/region-expansion/results',job.id+'.json'),'utf8')),hash=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,job.target))).digest('hex');if(!result.reviewed||result.reviewedHash!==hash)throw Error('Unreviewed or changed artwork: '+job.id);}
execFileSync(process.execPath,[path.join(__dirname,'compile-world-regions.cjs'),'--publish'],{cwd:root,stdio:'inherit'});
for(const filename of ['index.html','map.html',...fs.readdirSync(path.join(root,'tests/fixtures')).filter(f=>f.endsWith('.html')).map(f=>'tests/fixtures/'+f)]){
 const file=path.join(root,filename);let text=fs.readFileSync(file,'utf8');
 text=text.replace(/(<script[^>]*src=")([^"<>]*)(world-navigation\.js")/g,(all,start,prefix,end)=>text.includes(prefix+'world-flight-frames.js')?all:start+prefix+'world-flight-frames.js"></script>'+start+prefix+end);
 text=text.replace(/(<script[^>]*src=")([^"<>]*)(place-scenes\.js")/g,(all,start,prefix,end)=>text.includes(prefix+'world-regions.js')?all:start+prefix+'world-regions.js"></script>'+start+prefix+end);
 text=text.replace(/(<link[^>]*href=")([^"<>]*)(world-map\.css"[^>]*>)/g,(all,start,prefix,end)=>text.includes(prefix+'world-regions.css')?all:all+start+prefix+'world-regions.css">');
 fs.writeFileSync(file,text);
}
console.log('Published region maps, artwork registry, flight frame bounds and entry dependencies.');
