'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const core=require('../assets/js/tavern-core.js');
const body='<p>'+('晨风拂过长街，你沿着石阶走向药铺，仔细辨认竹筐里的草药。'.repeat(60))+'</p>\n<blockquote class="mortal-prose-dialogue-block"><p>“先看看叶脉，再闻药香。”</p></blockquote>\n<p>你记下了掌柜的提醒。</p>';
const short='你在坊市分拣草药，向掌柜请教辨认的方法。';
const raw='<ui_sys>开场时空</ui_sys>\n<content>\n<game>'+body+'</game>\n</content>\n<branches>[继续辨药]</branches>\n<details><summary>补充说明</summary>旁注</details>\n\n## maintext\n'+short+'\n\n## sum\n向掌柜学习辨药。';
test('a wrapped preset body before maintext remains complete instead of being replaced by a short duplicate',()=>{
 const parsed=core.parseOutput(raw),visible=core.proseText(parsed.maintext);
 assert.ok(visible.length>1500);assert.equal(visible,core.proseText(body));assert.equal(parsed.sum,'向掌柜学习辨药。');
 assert.ok(!visible.includes(short));assert.doesNotMatch(visible,/开场时空|继续辨药|旁注|<\/?(?:p|game|content)/);
 assert.equal(raw.includes(short),true);
});
test('legacy Markdown, plain preambles, repeated body sections and custom metadata do not lose prose',()=>{
 const parsed=core.parseOutput('正文开篇。\n## maintext\n正文中段。\n## maintext\n正文后段。\n## sum\n一句总结。');
 assert.equal(parsed.maintext,'正文开篇。\n\n正文中段。\n\n正文后段。');assert.equal(parsed.sum,'一句总结。');
 const custom=core.parseOutput('## maintext\n正文。\n## custom\n自定字段。',['maintext','custom']);assert.equal(custom.maintext,'正文。');assert.equal(custom.custom,'自定字段。');
 assert.equal(core.parseOutput('## maintext\n正文。\n## 风景\n山河。').maintext,'正文。\n## 风景\n山河。');
 assert.equal(core.parseOutput('普通叙事。\n\n第二段。').maintext,'普通叙事。\n\n第二段。');
});
test('nested and repeated body wrappers preserve order and unfinished streaming wrappers retain their text',()=>{
 assert.equal(core.proseText(core.parseOutput('<content><game><p>第一段。</p></game><p>第二段。</p></content>').maintext),'第一段。\n\n第二段。');
 assert.equal(core.proseText(core.parseOutput('<game>第一段。</game><game>第二段。</game>').maintext),'第一段。\n\n第二段。');
 assert.equal(core.proseText(core.parseOutput('<content><game>尚未结束的正文').maintext,true),'尚未结束的正文');
 assert.equal(core.parseOutput('<content/>正文。').maintext,'<content/>正文。');
});
test('streaming and final parsing agree at every split while the original reply stays intact',()=>{
 // Shorter synthetic paragraphs keep this exhaustive split check inexpensive.
 const reply=raw.replace(body,'<p>第一段正文。</p><p>第二段正文。</p>'),expected='第一段正文。\n\n第二段正文。';
 for(let split=0;split<=reply.length;split++){
  const parser=core.streamParser();let shown='';parser.onTag((tag,text)=>{if(tag==='maintext')shown=core.proseText(core.visibleBranches(core.visibleUpstore(text,true),true),true);});
  parser.feed(reply.slice(0,split));parser.feed(reply.slice(split));assert.equal(shown,expected,'split '+split);
  assert.equal(parser.flushBuffer(),reply);assert.equal(shown,expected);
 }
});
test('paragraph conversion is text-only, preserves ordinary comparison signs and decodes valid HTML entities',()=>{
 assert.equal(core.proseText('<p>1 < 2 &amp; 3 &gt; 2，&#x4e91;&#28170;。</p><p>下一段<br>换行。</p>'),'1 < 2 & 3 > 2，云渊。\n\n下一段\n换行。');
 assert.equal(core.proseText('<p>正文。</p><scr',true),'正文。');
 assert.equal(core.proseText('&#x110000; &#xD800;'),'&#x110000; &#xD800;');
 assert.equal(core.proseText('<img src=x onerror="alert(1)"><p>普通文字</p>'),'普通文字');
});
test('the real message renderer displays the recovered prose and leaves saved content unchanged',()=>{
 const html=fs.readFileSync('index.html','utf8'),state={TavernCore:core,tavernState:{tavernSettings:{}},applyRegexScripts:text=>text,parseBranchOptions:()=>[],
  document:{createDocumentFragment:()=>({children:[],appendChild(node){this.children.push(node);}}),createElement:tag=>({tagName:tag,textContent:'',className:'',appendChild(){}})}};
 vm.createContext(state);
 for(const name of ['getOutputTags','parseGameModeOutput','buildAssistantMessageDOM'])vm.runInContext(html.match(new RegExp('function '+name+'\\([^]*?\\n\\}'))[0],state);
 const message={role:'assistant',content:raw},before=JSON.stringify(message),fragment=state.buildAssistantMessageDOM(message);
 assert.equal(fragment.children.find(node=>node.className==='msg-maintext').textContent,core.proseText(body));assert.equal(JSON.stringify(message),before);
});

test('literal Unicode escapes in narrative become readable Chinese without changing stored reply text',()=>{
 const encoded=String.raw`<game><p>\u4E4C\u5766\u57CE的清晨\uFF0C云渊走进坊市\u3002</p></game>`;
 assert.equal(core.proseText(core.parseOutput(encoded).maintext),'乌坦城的清晨，云渊走进坊市。');
 assert.ok(encoded.includes(String.raw`\u4E4C`));
 assert.equal(core.proseText(String.raw`\uD83D\uDE00 \u4e91\u6e0a`),'😀 云渊');
 assert.equal(core.proseText(String.raw`\u4E91\u000A\u6E0A`),'云\n渊');
});
test('Unicode display decoding preserves code examples, paths, malformed escapes and unpaired surrogates',()=>{
 for(const literal of [String.raw`C:\Users\name\save.json`,String.raw`\\u4E91`,String.raw`\uZZZZ`,String.raw`\u4E`,String.raw`\uD83D`,String.raw`\uDE00`,String.raw`\u0000`,'`'+String.raw`\u4E91`+'`','```js\n'+String.raw`\u4E91`+'\n```'])assert.equal(core.proseText(literal),literal);
 assert.equal(core.proseText(String.raw`\u005Cu4E91`),String.raw`\u4E91`);
 assert.equal(core.proseText(String.raw`\u003Cscript\u003Ealert(1)\u003C/script\u003E`),'<script>alert(1)</script>');
});
test('split Unicode sequences resolve during streaming and never require a new generation',()=>{
 const raw=String.raw`<game>\u4E4C\u5766\u57CE，\uD83D\uDE00</game>`;
 for(let split=0;split<=raw.length;split++){
  const parser=core.streamParser();let shown='';parser.onTag((tag,text)=>{if(tag==='maintext')shown=core.proseText(text,true);});
  parser.feed(raw.slice(0,split));parser.feed(raw.slice(split));assert.equal(shown,'乌坦城，😀');assert.equal(parser.flushBuffer(),raw);
 }
 assert.equal(core.proseText(String.raw`正文\u4E`,true),'正文');
});

test('display removes exact Chinese editorial duplication while preserving meaningful parentheses and source text',()=>{
 const raw='她的目光（目光）落在活气果（活气果）上，放入收藏（收藏）。药材（三年生）与译语（语气）保留。';
 assert.equal(core.proseText(raw),'她的目光落在活气果上，放入收藏。药材（三年生）与译语（语气）保留。');
 assert.ok(raw.includes('目光（目光）'));
 assert.equal(core.proseText('`目光（目光）`\n```text\n收藏（收藏）\n```'),'`目光（目光）`\n```text\n收藏（收藏）\n```');
 const unicode=String.raw`\u76ee\u5149（\u76ee\u5149）`;
 assert.equal(core.proseText(unicode),'目光');
});
test('explicit laugh annotations on repeated sound effects render as laughter without altering ordinary noises',()=>{
 const raw='苏掌柜哐哐哐（笑）了一声。门外哐哐哐地敲门。';
 assert.equal(core.proseText(raw),'苏掌柜笑了一声。门外哐哐哐地敲门。');
 assert.equal(core.proseText('`哐哐哐（笑）了一声`'),'`哐哐哐（笑）了一声`');
 assert.equal(raw,'苏掌柜哐哐哐（笑）了一声。门外哐哐哐地敲门。');
});
