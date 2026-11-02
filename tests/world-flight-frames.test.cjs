const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const frames=require('../assets/js/world-flight-frames.js'),nav=require('../assets/js/world-navigation.js');
test('all four flying forms use twelve isolated full-figure bounds instead of slicing through neighbouring poses',()=>{
 for(const avatar of nav.avatars){const meta=frames[avatar.id];assert.equal(meta.frames.length,12);assert.equal(meta.width,1536);assert.equal(meta.height,1024);assert.equal(avatar.sheets.flight,meta.image);assert.equal(avatar.flightFrames,meta);assert.ok(fs.statSync(meta.image).size<1000000);
  for(let i=0;i<12;i++){const r=meta.frames[i];assert.ok([r.x,r.y,r.width,r.height,r.trimX,r.trimY].every(Number.isFinite));assert.ok(r.x>=0&&r.y>=0&&r.x+r.width<=meta.width&&r.y+r.height<=meta.height);assert.ok(r.width>180&&r.width<384&&r.height>200&&r.height<1024/3);for(let j=0;j<i;j++){const q=meta.frames[j];assert.ok(!(r.x<q.x+q.width&&r.x+r.width>q.x&&r.y<q.y+q.height&&r.y+r.height>q.y),'overlapping frame crops: '+avatar.id+'/'+i+'/'+j);}}
 }
});
