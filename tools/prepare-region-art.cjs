const fs=require('node:fs'),path=require('node:path'),sharp=require('D:/doupo/image-tools/node_modules/sharp');
const root=path.resolve(__dirname,'..'),catalogue=JSON.parse(fs.readFileSync(path.join(root,'tools/data/world-regions.json'),'utf8'));
const id=process.argv[2];if(!/^[a-z0-9-]+$/.test(id||''))throw Error('Invalid asset ID');
const job=catalogue.jobs.find(j=>j.id===id);if(!job)throw Error('Unknown asset');
const resultPath=path.join(root,'output/region-expansion/results',id+'.json'),result=JSON.parse(fs.readFileSync(resultPath,'utf8'));
const source=path.resolve(result.source),allowed=path.resolve('C:/Users/忆昔/.codex/generated_images')+path.sep;
if(!source.toLowerCase().startsWith(allowed.toLowerCase())||path.extname(source).toLowerCase()!=='.png')throw Error('Unexpected generated image source');
const target=path.resolve(root,job.target);if(!target.startsWith(root+path.sep))throw Error('Asset outside project');
(async()=>{fs.mkdirSync(path.dirname(target),{recursive:true});const metadata=await sharp(source).metadata();if(metadata.width<700||metadata.height<450)throw Error('Generated image too small');const output=await sharp(source).resize(job.width,job.height,{fit:'cover',withoutEnlargement:false}).webp({quality:88,effort:5}).toFile(target);const report={...result,target:job.target,width:output.width,height:output.height,bytes:output.size,encoded:true,reviewed:false};fs.writeFileSync(resultPath,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({id,target:job.target,width:output.width,height:output.height,bytes:output.size}));})().catch(e=>{console.error(e.message);process.exitCode=1;});
