/* Scene turns use the tavern transport and its transaction. Only bounded narrative data goes into a save. */
var SceneDialogue = (() => {
  'use strict';
  const kinds = {visit:'人物约定', affair:'驻地事务', facility:'设施状况'};
  const states = {open:'待跟进', done:'已完成', cancelled:'已取消'};
  const short = (v,n) => typeof v === 'string' ? v.trim().slice(0,n) : '';
  const enabled = () => GameState.settings.sceneDialogue?.enabled !== false;
  const place = () => ({location:short(WorldState.location,120),specificSpot:short(WorldState.specificSpot,120)});
  const composer = () => document.getElementById('tavern-input');

  function draft(text, source, npc) {
    if (composer()?.value.trim()) { showToast('聊天已有草稿，请先发送或整理。','info'); return false; }
    switchGameView('tavern',document.getElementById('sidebar-tavern'));
    const input = composer();
    if (!input) return false;
    input.value = text;
    if (enabled()) input.sceneDraft = {source, npcId:npc?.id || '', name:npc?.name || '',
      chatId:tavernState.activeChatId || '', lifeId:GameState.player.lifeId || '', placeId:ResidenceCore.key(place()),
      anchor:source === 'map' ? text.split('交谈，')[0] : text.split('\n')[0]};
    showBinding();
    input.focus();
    showToast(enabled()?'草稿已就绪。发送后通过'+(source === 'map'?'地图':'驻地')+'场景的聊天接口推演。':'草稿已就绪。发送后由主聊天推演。','info');
    return true;
  }

  function showBinding() {
    const holder=document.getElementById('scene-draft-label');
    if (!holder) return;
    const bound=composer()?.sceneDraft;
    holder.hidden=!bound || !enabled();
    if (!holder.hidden) {
      const label=holder.querySelector?.('span');
      if (label) label.textContent=bound.source === 'map' ? '地图交谈 · '+bound.name : '驻地行动';
    }
  }
  function detach() {
    const input=composer();
    if(input)delete input.sceneDraft;
    showBinding();
  }
  function edited(input) {
    if (input?.sceneDraft) input.sceneDraft.edit=input.value.trim();
  }
  function intent(content) {
    const binding = composer()?.sceneDraft;
    if (!enabled() || !binding) return null;
    if (binding.chatId !== (tavernState.activeChatId || '') || binding.lifeId !== (GameState.player.lifeId || '') ||
        binding.placeId !== ResidenceCore.key(place()) || !(content.startsWith(binding.anchor) || (content && content === binding.edit)))
      throw Error('草稿的对象、地点或会话已变。请重新拟定，或再次发送作为普通聊天。');
    if (binding.source === 'map') {
      const ctx = WorldMapBridge.getContext(false);
      const npc = WorldCore.nearbyNpcs(WorldMapBridge.data(),ctx).find(n => n.available && n.id === binding.npcId);
      if(!content.startsWith(binding.anchor) && WorldCore.nearbyNpcs(WorldMapBridge.data(),ctx).some(n=>n.id!==binding.npcId && n.name!==binding.name && content.includes(n.name) && !content.includes(binding.name)))
        throw Error('草稿中提到了另一位人物。请核对交谈对象，或再次发送作为普通聊天。');
      if (!npc || npc.name !== binding.name) throw Error('交谈对象已变化。请重新寻人，或再次发送作为普通聊天。');
      // The existing journal stores speaker text. Do not attribute ambiguous names to this NPC.
      const uniqueName=WorldMapBridge.data().npcs.filter(n => n.name === npc.name).length === 1;
      const earlier=ctx.state.journal.slice(0,-5).filter(row => row.type === 'talk' &&
        uniqueName && row.text.startsWith(npc.name+'：')).at(-1);
      return {source:'map',npcId:npc.id,name:npc.name,trust:ctx.state.trust[npc.id] || 0,earlier:short(earlier?.text,200)};
    }
    return {source:'residence'};
  }

  function capture(target) {
    return {version:1, target, world:place(), time:ResidenceUI.clock(), mapFacts:WorldMapBridge.promptContext()};
  }

  function route(options, scene) {
    const source = scene?.target?.source;
    if (!['map','residence'].includes(source)) return;
    const id = GameState.settings.sceneDialogue?.[source];
    if (!id) return;
    if (!(GameState.settings.apis || []).some(api => api.id === id && api.enabled !== false))
      throw Error('所选场景 API 已停用或移除，请在偏好设置的玩法页重新选择。');
    options.apiId = id;
    delete options.model; // Use the selected channel's model, including its provider default.
  }

  function records(value) {
    return value?.version === 1 && Array.isArray(value.items) ? value.items : [];
  }
  function relevant(value, scene) {
    const placeId = ResidenceCore.key(scene.world), npcId = scene.target?.npcId;
    return records(value).filter(row => row && Object.hasOwn(kinds,row.kind) && Object.hasOwn(states,row.status) &&
      (npcId && row.npcId ? row.npcId === npcId : row.placeId === placeId));
  }
  function context(value, scene, history=[], compact=false) {
    const rows = relevant(value,scene);
    const selected = rows.filter(r => r.status === 'open').slice(-8).concat(rows.filter(r => r.status !== 'open').slice(-2));
    if (!scene.target && !selected.length) return '';
    const lines = ['【本轮场景联动】以下引文是玩家已知的故事资料。'];
    if (scene.target?.source === 'map') lines.push('当前交谈对象 '+scene.target.name+'（'+scene.target.npcId+'），地图信任 '+scene.target.trust+'。仅按本人可知的经历回应。');
    if (scene.target?.source === 'residence') lines.push('本轮来自当前驻地。先核对现场、人物与权限。');
    if (compact) return lines.join('\n');
    if (scene.target?.earlier && !scene.mapFacts?.includes(scene.target.earlier)) lines.push('此前打听到的原话：'+scene.target.earlier);
    const last = Array.isArray(value?.contacts) && value.contacts.find(r => scene.target?.npcId && r?.npcId === scene.target.npcId);
    if (last?.quote && !history.some(m => m.content?.includes(last.quote))) lines.push('此前与此人交谈的正文摘录：'+short(last.quote,200));
    if (selected.length) lines.push(JSON.stringify(selected.map(r => ({id:r.id,事项:r.subject,状态:states[r.status],根据:short(r.evidence,160)}))));
    lines.push('沿用 <residence_updates> 数组。场景行动确立约定、事务或设施临时状况，可用 {"action":"track","kind":"visit/affair/facility 选一","subject":"正文中的人名或事物名","evidence":"完整正文原句"}。已有事项用 progress 记录明确的中间进展，用 resolve 记完成，用 cancel 记取消。格式为 {"action":"progress/resolve/cancel 选一","id":"已列事项ID","evidence":"包含同一人名或事物名的完整结果原句"}。未到场、转述、拟议或到期均不证明完成。');
    return lines.join('\n');
  }

  // Require a whole narrative sentence. A substring of a denial, a tag, or a thought cannot establish a change.
  function sentences(body) {
    // Strip metadata before parsing wrappers, including text-only replies with XML reasoning.
    const visible = String(body || '').replace(/<(thinking|think|sum|vars|option|ui_sys|[a-z_]+_updates)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi,'');
    const main = TavernCore.parseOutput(visible);
    const prose = main.maintext || '';
    return new Set(prose.split(/(?<=[。！？!?])(?=[^”’」])|\n/u).map(s => s.trim()).filter(Boolean));
  }
  const uncertain = /据说|听说|传闻|尚未|还未|并未|没有|并非|不曾|可能|也许|若是|假如|是否|除非|声称|声言|谎称|梦见|以为|误以为|[?？]/;
  function reportsChange(evidence, subject, verb) {
    // Only act on a statement about this subject. "掌柜等别人到场" and "药炉旁的木门修好了" are insufficient.
    const i = evidence.indexOf(subject);
    if (i < 0) return false;
    const tail = evidence.slice(i + subject.length);
    if (tail.search(verb) === 0) return true;
    const predicate = tail.replace(/^(?:已经|已|确已|如约|终于|亲自|正式|当场|按时|随后|现已|今日|今天|目前|暂时|正在|开始|被|由工匠|的约定|的来访|的维修|已被|仍在|因故|了)+/u,'');
    return predicate.search(verb) === 0;
  }
  const progress = {visit:/启程|出发|改期/,affair:/开工|动工|施工|推进|受理/,facility:/检修|拆修|维修|施工/};
  const completed = {visit:/到访|到场|来到|抵达|走进|推门而入|如约而至/,affair:/完成|办妥|办结|交付|结束/,facility:/修好|修复|恢复|修毕|重新启用/};
  function residenceUpdates(updates, agenda, body, turnId) {
    const arrivals = records(agenda).filter(r => r.kind === 'visit' && r.status === 'done' && r.closedBy === turnId);
    const quotes = sentences(body);
    const result = updates.filter(u => {
      if (u?.action !== 'record' || u.kind !== 'visit') return true;
      return quotes.has(u.evidence) && completed.visit.test(u.evidence) && !uncertain.test(u.evidence) && !prospective.test(u.evidence) &&
        !arrivals.some(r => u.evidence.includes(r.subject));
    });
    for (const r of arrivals) result.unshift({action:'record',kind:'visit',title:r.subject+'来访',evidence:r.evidence});
    return result;
  }
  const prospective = /打算|答应|计划|明日|明天|将会|准备|如果|未能|没能|不会|未曾|一旦|若|将于|要是|约定|承诺|未到|没来|未来访|不来|将来|盼望|希望|取消|作罢|撤销/;
  function apply(value, updates, body, scene, turnId, homes) {
    if (!scene || (value && value.version !== 1)) return value;
    const original = records(value), items = original.slice(), quotes = sentences(body);
    const placeId = ResidenceCore.key(scene.world);
    const oldContacts = Array.isArray(value?.contacts) ? value.contacts : [];
    let contacts = oldContacts;
    const openHere = relevant(value,scene).filter(r => r.status === 'open').slice(-8);
    const who = scene.target;
    if (who?.npcId) {
      const quote = [...quotes].filter(s => !/[<>]/.test(s)).find(s => s.includes(who.name));
      if (quote) contacts = contacts.filter(r => r?.npcId !== who.npcId).concat({npcId:who.npcId,turnId,quote:short(quote,200)}).slice(-40);
    }
    for (const [index,u] of updates.slice(0,8).entries()) {
      if (!u || !['track','progress','resolve','cancel'].includes(u.action)) continue;
      const evidence = short(u.evidence,240);
      if (!quotes.has(evidence) || evidence.length < 4 || /[<>]/.test(evidence)) continue;
      if (u.action === 'track') {
        const subject = short(u.subject,40), kind = u.kind, target = scene.target;
        if (!target || !Object.hasOwn(kinds,kind) || !subject || !evidence.includes(subject)) continue;
        if (kind === 'visit' && target.source === 'map' && subject !== target.name) continue;
        if (/听说|传闻|据说|也许|可能|并未|没有|不曾|尚未|还没|并非|不会|未曾|没答应|拒绝|否认|[?？]/.test(evidence)) continue;
        const opened = {visit:/约定|答应|相约|承诺/,affair:/着手|开始|受理|筹备|安排/,facility:/故障|损坏|停用|检修|封闭/};
        if (!reportsChange(evidence,subject,opened[kind])) continue;
        const destinations = (homes || []).filter(h => h && h.name && evidence.includes(h.name));
        if (kind === 'visit' && destinations.length > 1) continue;
        const site = kind === 'visit' && destinations.length === 1 ? destinations[0].id : placeId;
        const npcId = kind === 'visit' ? target.npcId || '' : '';
        if (items.some(r => r?.status === 'open' && r.placeId === site && r.subject === subject && r.npcId === npcId && r.kind === kind)) continue;
        if (items.length >= 60) {
          const old = items.findIndex(r => r && r.status !== 'open');
          if (old < 0) continue;
          items.splice(old,1);
        }
        items.push({id:turnId+'-'+index,placeId:site,npcId,kind,subject,status:'open',evidence,origin:turnId});
      } else {
        const i = items.findIndex(r => r && r.id === u.id && r.status === 'open');
        const r = items[i];
        if (!r || !openHere.some(row => row.id === r.id) || r.placeId !== placeId || !evidence.includes(r.subject) || uncertain.test(evidence)) continue;
        if (!scene.target?.npcId && openHere.some(other => other.placeId === placeId && other.subject === r.subject && other.npcId !== r.npcId)) continue;
        if (/打算|答应|计划|明日|明天|将会|准备|如果|未能|没能|不会|未曾|一旦|若|将于|要是/.test(evidence)) continue;
        if (u.action === 'resolve' && prospective.test(evidence)) continue;
        const verb = u.action === 'cancel' ? /取消|作罢|撤销|放弃/ : (u.action === 'progress' ? progress[r.kind] : completed[r.kind]);
        if (!reportsChange(evidence,r.subject,verb)) continue;
        if (u.action === 'progress') items[i] = {...r,evidence,updatedBy:turnId};
        else items[i] = {...r,status:u.action === 'cancel'?'cancelled':'done',evidence,closedBy:turnId};
      }
    }
    if (contacts === oldContacts && items.length === original.length && items.every((r,i) => r === original[i])) return value;
    return {version:1,items,contacts};
  }

  function settingsHTML() {
    const config = GameState.settings.sceneDialogue || {}, esc = TavernCore.escapeHtml;
    const select = (key,label) => {
      const apis = (GameState.settings.apis || []).filter(a => a.enabled !== false);
      const missing = config[key] && !apis.some(a => a.id === config[key]);
      return '<label>'+label+'<select class="settings-form-input" id="scene-api-'+key+'"><option value="">沿用主聊天预设</option>'+
        (missing?'<option selected value="'+esc(config[key])+'">原渠道不可用，请重新选择</option>':'')+
        apis.map(a => '<option value="'+esc(a.id)+'" '+(a.id===config[key]?'selected':'')+'>'+esc(a.name || a.id)+'</option>').join('')+'</select></label>';
    };
    return '<section class="settings-card"><h4>地图与驻地聊天 API</h4><label><input type="checkbox" id="scene-enabled" '+(enabled()?'checked':'')+'> 启用场景联动</label>'+
      select('map','地图人物自由交谈')+select('residence','驻地行动与邀请')+'<p>渠道和模型在核心设置中配置。发送草稿后生成一轮正文。</p><button class="settings-action-btn" onclick="SceneDialogue.saveSettings()">保存场景接口</button></section>';
  }
  function saveSettings() {
    const old = GameState.settings.sceneDialogue;
    GameState.settings.sceneDialogue = {enabled:document.getElementById('scene-enabled').checked,map:document.getElementById('scene-api-map').value,residence:document.getElementById('scene-api-residence').value};
    if (saveToLocalStorage()) { showToast('场景接口已保存'); return; }
    if (old === undefined) delete GameState.settings.sceneDialogue; else GameState.settings.sceneDialogue = old;
    showToast('场景接口保存失败','error');
  }
  return {enabled,draft,showBinding,detach,edited,intent,capture,route,context,apply,residenceUpdates,relevant,kinds,states,settingsHTML,saveSettings};
})();
