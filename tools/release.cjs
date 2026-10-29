/* Static release allowlist. No upload, credential access or Git mutations. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const excluded=/^assets\/images\/xiaoyan-xuner\//;
const extensions=new Set(['.html','.css','.js','.json','.png','.jpg','.jpeg','.webp','.svg','.mp4','.woff','.woff2','.ttf','.txt']);
function files(dir='assets'){
 return fs.readdirSync(path.join(root,dir),{withFileTypes:true}).flatMap(e=>{
  const name=dir+'/'+e.name;
  if(excluded.test(name)||e.isSymbolicLink())return [];
  return e.isDirectory()?files(name):extensions.has(path.extname(name))?[name]:[];
 });
}
function plan(){return ['index.html','map.html',...files()].sort();}
function references(file,source){
 const found=[];
 // Definite HTML/CSS references; dynamic asset literals relative to the main page.
 const pattern=file.endsWith('.html')?/(?:src|href)\s*=\s*["']([^"']+)["']/g:file.endsWith('.css')?/url\(\s*["']?([^\s)'"<>]+)["']?\s*\)/g:null;
 if(pattern)for(const m of source.matchAll(pattern))if(!m[1].includes('${'))found.push(m[1]);
 for(const m of source.matchAll(/["'`](assets\/[\w./-]+\.(?:js|css|json|png|jpg|webp|svg|mp4)(?:\?[^"'`\s]*)?)["'`]/g))found.push('/'+m[1]);
 return [...new Set(found)].filter(x=>! /^(?:https?:|data:|blob:|#|mailto:|javascript:)/i.test(x)).map(x=>{
  x=x.split(/[?#]/)[0];return x.startsWith('/')?x.slice(1):path.posix.normalize(path.posix.join(path.posix.dirname(file),x));
 });
}
function audit(){
 const selected=plan(),set=new Set(selected),missing=[],external=new Set();
 for(const file of selected.filter(x=>/\.(html|css|js)$/.test(x)&&!x.startsWith('assets/vendor/'))){
  const source=fs.readFileSync(path.join(root,file),'utf8');
  for(const ref of references(file,source))if(!set.has(ref))missing.push({file,ref});
  if(file.endsWith('.html'))for(const m of source.matchAll(/(?:src|href)\s*=\s*["'](https?:\/\/[^"']+)["']/g))external.add(m[1]);
 }
 const tracked=new Set(execFileSync('git',['ls-files','-z'],{cwd:root,encoding:'utf8'}).split('\0'));
 const inventory=selected.map(file=>{const bytes=fs.readFileSync(path.join(root,file));return{file,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),tracked:tracked.has(file)};});
 return {inventory,missing,external:[...external],bytes:inventory.reduce((sum,x)=>sum+x.bytes,0),untracked:inventory.filter(x=>!x.tracked).map(x=>x.file)};
}
function build(report){
 if(report.missing.length)throw Error('引用检查未通过，未生成发布包');
 // Never delete/overwrite an existing output directory; each release is independently reviewable.
 const output=fs.mkdtempSync(path.join(root,'dist','release-'));
 for(const {file,sha256}of report.inventory){
  const target=path.join(output,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(root,file),target);
  if(crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex')!==sha256)throw Error('文件在检查后发生变化，请重新生成发布包：'+file);
 }
 fs.writeFileSync(path.join(output,'release-manifest.json'),JSON.stringify({createdAt:new Date().toISOString(),...report},null,2));
 fs.writeFileSync(path.join(output,'_headers'),'/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Cache-Control: no-cache\n/assets/images/*\n  Cache-Control: public, max-age=86400\n');
 return output;
}
if(require.main===module){
 const report=audit();
 console.log(JSON.stringify({files:report.inventory.length,totalMiB:Number((report.bytes/1024/1024).toFixed(2)),missing:report.missing,untracked:report.untracked,external:report.external,largest:report.inventory.slice().sort((a,b)=>b.bytes-a.bytes).slice(0,6)},null,2));
 if(report.missing.length)process.exitCode=1;
 else if(process.argv.includes('--build')){fs.mkdirSync(path.join(root,'dist'),{recursive:true});console.log('发布目录：'+build(report));}
 if(process.argv.includes('--require-tracked')&&report.untracked.length)process.exitCode=1;
}
module.exports={plan,references,audit};
