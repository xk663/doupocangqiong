/* Reads width, height and alpha from a WebP header (VP8, VP8L, VP8X). Test helper only. */
'use strict';
module.exports=function webpInfo(b){
 if(b.subarray(0,4).toString()!=='RIFF'||b.subarray(8,12).toString()!=='WEBP')throw new Error('not a WebP file');
 const chunk=b.subarray(12,16).toString();
 if(chunk==='VP8X')return {width:1+b.readUIntLE(24,3),height:1+b.readUIntLE(27,3),alpha:!!(b[20]&0x10)};
 if(chunk==='VP8 ')return {width:b.readUInt16LE(26)&0x3fff,height:b.readUInt16LE(28)&0x3fff,alpha:false};
 if(chunk==='VP8L'){const v=b.readUInt32LE(21);return {width:1+(v&0x3fff),height:1+((v>>14)&0x3fff),alpha:!!((v>>28)&1)};}
 throw new Error('unknown WebP chunk '+chunk);
};
