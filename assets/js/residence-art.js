/* A local, schematic isometric residence illustration; never grants facilities. */
var ResidenceArt=(function(){
 'use strict';
 const roofs='<path d="M202 196 490 56 807 201 518 343Z" fill="url(#res-roof)"/><path d="m202 196 316 147 289-142-5 18-284 147-313-149Z" fill="#1d4341"/><path d="m191 198 299-151 330 155-13 10L490 66 204 211Z" fill="#a5ae91"/><path d="m237 184 280 133 252-124M275 165l242 116 215-105M315 145l202 96 174-84M356 125l161 76 133-62M397 105l120 56 92-44" fill="none" stroke="#718b79" stroke-width="3" opacity=".6"/><path d="m490 51 27 289M490 51 807 201" fill="none" stroke="#bbbc92" stroke-width="5"/>';
 function render(kind,alchemy){
  const desert=kind==='camp',cave=kind==='cave',inn=kind==='inn';
  const sky=desert?'#e8d5aa':cave?'#c2d1c8':'#dfe7d5',earth=desert?'#c9ab71':'#afbea5';
  let building;
  if(desert)building='<path d="m260 298 220-178 280 161-215 142Z" fill="#b98b54"/><path d="m480 120 65 303-285-125Z" fill="url(#res-tent)"/><path d="m480 120 280 161-215 142Z" fill="#ddc198"/><path d="m480 148 38 247-93-39Z" fill="#635742"/><path d="m480 120 65 303M280 303l200-183 259 167" fill="none" stroke="#f3dfb5" stroke-width="4"/><path d="m260 298-49 39m549-56 51 46" stroke="#9f8257" stroke-width="3"/><path d="m206 329 8 22m592-32 10 22" stroke="#5b6350" stroke-width="5"/><path d="m803 235 11-105m-1 17c-39-31-70-14-81-2 33-4 57 4 81 2Zm0 0c39-34 60-16 71 0-24-5-48-1-71 0Zm0 0c-13-39-30-47-46-42 18 11 33 26 46 42Z" fill="#75896a" stroke="#6e795a" stroke-width="3"/>';
  else if(cave)building='<path d="m189 333 35-149 93-81 111-62 115 49 119-6 98 102 37 157-209 111Z" fill="#7e948b"/><path d="m224 184 122-20 82-123 49 153 185-110-75 177 132-24 18 106-219 77-298-94Z" fill="#92a69a"/><path d="M350 332c-18-115 47-192 132-198 103-7 155 87 138 226l-110 66Z" fill="url(#res-cave)"/><path d="m350 332 160 94 110-66-45-30-78 22-101-51Z" fill="#b5bc9e"/><path d="m260 284 55 15m334-91 26 12m-379-53 25 16" stroke="#bfd0af" stroke-width="6"/><path d="M748 189c20 67-24 131-10 185" fill="none" stroke="#c4e2d9" stroke-width="12" opacity=".7"/>';
  else building='<path d="m250 237 264 125 235-118v110L514 483 250 355Z" fill="#c3c2a1"/><path d="m514 362 235-118v110L514 483Z" fill="#9fae96"/><path d="m250 237 264 125v121L250 355Z" fill="#d3ccb0"/><path d="m291 273 56 27v77l-56-27Zm91 42 56 27v77l-56-27Z" fill="#526e60"/><path d="m304 288 30 14v48l-30-14Zm91 43 30 14v48l-30-14Z" fill="#e3ce8b" opacity=".8"/><path d="m566 351 65-33v100l-65 34Z" fill="#5a7160"/><path d="m658 305 45-23v65l-45 23Z" fill="#e2cd8d"/><path d="m292 276 52 26m-26-12v65m63-37 52 26m-26-12v65m253-91 41-20m-20 10v59" stroke="#77836b" stroke-width="4"/>'+ (inn?'<path d="m269 166 247 119 212-108v71L516 365 269 247Z" fill="#c9c4a1"/><path d="m299 195 42 20v38l-42-20Zm80 38 42 20v38l-42-20Zm225 3 40-20v39l-40 20Z" fill="#dcbb77"/><path d="m269 247 247 118 212-117" fill="none" stroke="#557264" stroke-width="8"/>':'')+roofs;
  return `<svg viewBox="0 0 1000 650" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><defs>
   <linearGradient id="res-sky" x2="0" y2="1"><stop stop-color="${sky}"/><stop offset="1" stop-color="#f3ecda"/></linearGradient>
   <linearGradient id="res-roof" x2=".6" y2="1"><stop stop-color="#617e71"/><stop offset="1" stop-color="#365b54"/></linearGradient>
   <linearGradient id="res-tent" x2="1" y2="1"><stop stop-color="#f0d9b1"/><stop offset="1" stop-color="#d6ac74"/></linearGradient>
   <radialGradient id="res-cave"><stop stop-color="#263d3c"/><stop offset="1" stop-color="#526e64"/></radialGradient>
   <pattern id="res-stone" width="68" height="35" patternUnits="userSpaceOnUse"><rect width="68" height="35" fill="#d6d4b7"/><path d="M0 0h68v35H0Z M34 0v35" fill="none" stroke="#bfc6ab" stroke-width="1"/></pattern>
  </defs><rect width="1000" height="650" fill="url(#res-sky)"/>
  <path d="M0 224 112 118l80 51 146-130 123 151 114-88 150 91 123-111 152 135v183H0Z" fill="${earth}" opacity=".25"/>
  <path d="M0 304 157 205l134 82 176-92 148 102 205-134 180 118v171H0Z" fill="${earth}" opacity=".3"/>
  <ellipse cx="515" cy="523" rx="400" ry="72" fill="#6f8b6923"/>
  <path d="m47 418 448-209 468 211-443 216Z" fill="${desert?'#d1b47b':'#91a78e'}"/>
  <path d="m93 422 403-187 418 188-394 189Z" fill="${desert?'#e0c697':'url(#res-stone)'}"/>
  <path d="m93 422 427 190 394-189v18L520 631 93 440Z" fill="${desert?'#b69d6d':'#8eaa92'}"/>
  <path d="m165 436 354 162 295-143-351-159Z" fill="#f1e5c352"/>
  ${building}
  <path d="m430 465 92 44 86-44-90-44Z" fill="#c6c8a8"/><path d="m430 465 92 44v17l-92-44Zm92 44 86-44v17l-86 44Z" fill="#a2b194"/>
  <path d="m169 423 85-40 78 37-86 42Z" fill="#7d927e"/><path d="m180 422 67 30 71-33-65-30Z" fill="#b9bb90"/>
  ${alchemy?'<ellipse cx="251" cy="398" rx="32" ry="14" fill="#355b51"/><path d="M220 397q3 51 31 49t31-49" fill="#547262"/><ellipse cx="251" cy="396" rx="22" ry="8" fill="#203d39"/><path d="m229 437-8 20m52-20 8 20" stroke="#3e5c4a" stroke-width="5"/><path class="res-flame" d="M245 453q-12-11 4-23-2 12 8 15 8 11-12 8Z" fill="#dcac5f"/>':'<path d="m221 398 33-16 38 18-33 15Z" fill="#e3d8b0"/><path d="m221 398 38 17v8l-38-17Z" fill="#b3b99a"/>'}
  <path d="m657 448 52-26 66 31-54 26Z" fill="#8c9e82"/><path d="m670 448 37-18 53 24-38 18Z" fill="#e1d9b4"/>
  <path d="m791 495 45-22 36 16-44 23Z" fill="#718d78"/><path d="m791 495v20l37 17v-20m8-39v20l36 16v-20" fill="#a3b59a"/>
  <path d="m119 366 6-144m-6 44-32-41m37 16 31-47m-34 103-38-33" stroke="#6d8c6c" stroke-width="5" fill="none"/>
  <path d="m88 225 35 11-10 29-29-13m50-39 30-16-10 32-23 12m-45 31 36 9-7 24-29-12" fill="${desert?'#9aa46d':'#7f9f7d'}" opacity=".9"/>
  <path d="m847 415 1-52m-9 2 22-10 18 9-22 12Z" fill="#486f5e"/><path d="m839 365 18 11v22l-18-11Zm18 11 22-12v22l-22 12Z" fill="#e9cd86"/>
  <ellipse class="res-lamp-glow" cx="857" cy="381" rx="24" ry="28" fill="#f6da921e"/>
  <path d="m365 531 26-12 25 11-25 12Z m47 23 24-11 25 11-24 12Z m47 24 24-11 25 11-24 12Z" fill="#a3b89b"/>
  <path d="m69 448 23-36 6 37m799 21 23-36 6 37m-61 43 17-30 7 34" fill="#91a77a"/>
  </svg>`;
 }
 return {render};
})();
