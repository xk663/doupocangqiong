/* Message-scoped inspector and opt-in Sub2API channel check. */
var ModelProbeUI = (function() {
  'use strict';
  let panel = null;
  function el(tag, cls, text) {
    const node = document.createElement(tag);
    node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function current(view) {
    if (!view.message) return panel === view && !tavernState.isSending;
    const chat = getActiveChat();
    return panel === view && !tavernState.isSending && chat?.id === view.chatId &&
      chat.messages.some(m => m.id === view.message.id && m.content === view.message.content);
  }
  function cancel() {
    if (!panel) return;
    const view = panel;
    panel = null;
    view.controller?.abort();
    view.dialog.close();
    view.dialog.remove();
  }
  function sync() { if (panel && !current(panel)) cancel(); }
  function button(message) {
    const label = {match:'标识一致', mismatch:'标识不一致', conflict:'响应标识冲突', unverified:'未披露'};
    const node = el('button','model-probe-launch','路由检测 · ' + (label[message.modelAudit?.status] || '未记录'));
    node.type = 'button';
    node.onclick = () => open(message);
    return node;
  }
  function openApi(id) {
    const api = (GameState.settings.apis || []).find(item => item.id === id);
    if (!api || !api.url?.trim() || (!api.model?.trim() && api.backend !== 'kobold')) { showToast('请先填写接口地址和模型','error'); return; }
    try { open(null, ModelProbeCore.target(api, api.model || 'kobold')); }
    catch (error) { showToast(error.message,'error'); }
  }
  function open(message, target = message?.modelProbeTarget) {
    const chat = message && getActiveChat();
    if ((message && !chat) || tavernState.isSending) return;
    cancel();
    const dialog = el('dialog','model-probe-dialog');
    const view = {dialog, message, chatId:chat?.id};
    panel = view;
    if (!current(view)) { panel = null; return; }
    dialog.setAttribute('aria-label','模型路由检测');
    const heading = el('div','model-probe-heading');
    heading.appendChild(el('h3','','模型路由检测'));
    const close = el('button','model-probe-action','关闭');
    close.type = 'button';
    close.onclick = cancel;
    heading.appendChild(close);
    dialog.appendChild(heading);
    const record = ModelRouteUI.record(message?.modelAudit);
    if (record) { record.open = true; dialog.appendChild(record); }
    dialog.appendChild(el('h4','',message ? '测试原渠道当前状态' : '测试渠道当前状态'));
    const resolve = () => ModelProbeCore.resolveTarget(target, GameState.settings.apis || []);
    const api = resolve();
    dialog.appendChild(el('p','',api ? (api.name || api.id) + ' · ' + target.model : '原渠道未记录、已停用或地址已变更，无法重测。'));
    dialog.appendChild(el('p','model-route-note','每次测试向原渠道发送一道随机算术题，可能产生一次模型调用费用。结果反映测试时的可用性，无法证明历史回复由哪个模型生成。'));
    const start = el('button','model-probe-action','开始测试');
    start.type = 'button';
    start.disabled = !api;
    const result = el('div','model-probe-result');
    result.setAttribute('role','status');
    result.textContent = '尚未测试';
    start.onclick = async () => {
      if (!current(view) || view.controller) return;
      const api = resolve();
      if (!api) { result.textContent = '原渠道配置已变更，无法测试。'; start.disabled = true; return; }
      const controller = new AbortController();
      view.controller = controller;
      start.disabled = true;
      result.textContent = '正在等待渠道回答…';
      const timer = setTimeout(() => controller.abort(), 45000);
      try {
        const check = await ModelProbeCore.run(api, target.model, controller.signal);
        if (!current(view)) return;
        const labels = {operational:'通过', degraded:'通过，响应较慢', failed:'答案未通过', error:'接口错误'};
        result.textContent = labels[check.status] + ' · HTTP ' + check.http + ' · ' + check.elapsed + ' ms';
        if (check.expected) result.appendChild(el('p','','题目 ' + check.question + '　预期 ' + check.expected + '　回答 ' + (check.answer || '（空）')));
        if (check.audit) result.appendChild(el('p','','本次测试报告模型：' + (check.audit.observedModel || '未披露')));
      } catch {
        if (current(view)) result.textContent = controller.signal.aborted ? '测试超时（45 秒）。' : '测试失败，请检查接口地址、网络、跨域设置及响应格式。';
      } finally {
        clearTimeout(timer);
        view.controller = null;
        if (current(view)) start.disabled = !resolve();
      }
    };
    dialog.appendChild(start);
    dialog.appendChild(result);
    dialog.addEventListener('cancel', event => { event.preventDefault(); cancel(); });
    document.body.appendChild(dialog);
    dialog.showModal();
  }
  return {button, open, openApi, cancel, sync};
})();
