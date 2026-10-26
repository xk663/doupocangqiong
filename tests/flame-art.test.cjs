const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
test('all 23 ranked flames have distinct valid local raster assets and archived prompts',()=>{
 const root=path.join(__dirname,'..'),prompts=JSON.parse(fs.readFileSync(path.join(root,'docs/flame-art-prompts.json'),'utf8'));
 assert.equal(prompts.assets.length,23);const hashes=new Set();
 for(let rank=1;rank<=23;rank++){const row=prompts.assets.find(a=>a.rank===rank);assert.ok(row?.prompt&&row?.name);const bytes=fs.readFileSync(path.join(root,row.file));assert.equal(bytes.subarray(1,4).toString(),'PNG');assert.ok(bytes.readUInt32BE(16)>=1024);assert.ok(bytes.readUInt32BE(20)>=768);hashes.add(crypto.createHash('sha256').update(bytes).digest('hex'));}
 assert.equal(hashes.size,23);
 const ui=fs.readFileSync(path.join(root,'assets/js/flame-ui.js'),'utf8');assert.match(ui,/String\(f\.rank\)\.padStart\(2,'0'\)/);assert.match(ui,/class="fire-art"/);assert.match(ui,/class="fire-showcase-copy"/);
});
