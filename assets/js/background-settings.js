/* Device-local appearance, deliberately independent of characters and story saves. */
(function () {
  'use strict';
  const TEMPLATE = 'assets/images/backgrounds/flame-duet.webp';
  const DEFAULT = { mode: 'default', dim: 25, position: 50, custom: null, name: '' };
  let state = { ...DEFAULT }, database, ready, activeURL = '', busy = false, loadError = '';

  function normalize(value) {
    const v = value || {};
    const number = (n, fallback) => Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : fallback;
    return {
      mode: ['default', 'template', 'custom'].includes(v.mode) ? v.mode : 'default',
      dim: number(v.dim, 25), position: number(v.position, 50),
      custom: v.custom instanceof Blob && ['image/png', 'image/jpeg', 'image/webp'].includes(v.custom.type) ? v.custom : null,
      name: typeof v.name === 'string' ? v.name.slice(0, 180) : ''
    };
  }
  function imageLoaded(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('图片无法读取，请换一张 PNG、JPG 或 WebP 图片。'));
      img.src = src;
    });
  }
  async function prepare(value) {
    const url = value.mode === 'template' ? TEMPLATE : value.mode === 'custom' && value.custom ? URL.createObjectURL(value.custom) : '';
    if (value.mode === 'custom' && !url) throw new Error('请先上传自定义背景。');
    try { if (url) await imageLoaded(url); return url; }
    catch (error) { if (url.startsWith('blob:')) URL.revokeObjectURL(url); throw error; }
  }
  function paint(value, url) {
    const root = document.documentElement;
    root.classList.toggle('has-user-background', !!url);
    root.style.setProperty('--user-background-image', url ? 'url("' + url + '")' : 'none');
    root.style.setProperty('--user-background-dim', String(value.dim / 100));
    root.style.setProperty('--user-background-position', value.position + '%');
  }
  function adopt(value, url) {
    const previous = activeURL;
    state = value; activeURL = url; paint(state, activeURL);
    if (previous.startsWith('blob:') && previous !== url) URL.revokeObjectURL(previous);
  }
  function init() {
    if (!ready) ready = (async () => {
      try {
        database = new Dexie('DoupoAppearance');
        database.version(1).stores({ preferences: 'id' });
        const value = normalize(await database.preferences.get('background'));
        adopt(value, await prepare(value));
      } catch (error) {
        loadError = '背景读取失败，暂时使用默认背景。可重新选择：' + error.message;
      }
    })();
    return ready;
  }
  function notify(text, type) { if (typeof showToast === 'function') showToast(text, type); }
  function currentPanel() { return document.querySelector('#settings-body > .background-settings'); }
  function lock(locked) {
    const panel = currentPanel();
    if (panel) { panel.setAttribute('aria-busy', String(locked)); panel.querySelectorAll('button,input').forEach(el => { el.disabled = locked; }); }
  }
  async function change(build, successMessage = '背景已保存') {
    if (busy) return;
    busy = true; lock(true);
    let url = '';
    try {
      await init();
      const next = normalize(await build({ ...state }));
      url = await prepare(next);
      if (!database) throw new Error('浏览器存储不可用。');
      // Commit the image and its selection together. Keep the old image on failure.
      await database.transaction('rw', database.preferences, () => database.preferences.put({ id: 'background', ...next }));
      adopt(next, url); url = ''; loadError = '';
      notify(successMessage, 'success');
    } catch (error) {
      if (url.startsWith('blob:')) URL.revokeObjectURL(url);
      paint(state, activeURL);
      loadError = '背景未保存：' + error.message;
      notify(loadError, 'error');
    } finally {
      busy = false;
      const panel = currentPanel();
      if (panel) render(panel.parentElement);
    }
  }
  async function upload(file) {
    if (!file) return;
    return change(async next => {
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('支持 PNG、JPG、WebP 格式。');
      if (file.size > 12 * 1024 * 1024) throw new Error('图片不能超过 12 MB。');
      const url = URL.createObjectURL(file);
      try {
        const img = await imageLoaded(url);
        if (!img.naturalWidth || !img.naturalHeight || img.naturalWidth * img.naturalHeight > 40000000) throw new Error('图片尺寸过大，请缩小到 4000 万像素以内。');
        const scale = Math.min(1, 2560 / Math.max(img.naturalWidth, img.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('浏览器无法处理这张图片。');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', 0.9));
        if (!blob) throw new Error('图片处理失败，请重试。');
        return { ...next, custom: blob, name: file.name };
      } finally { URL.revokeObjectURL(url); }
    }, '图片已保存，可点击“使用已上传图片”启用');
  }
  function element(tag, className, text) {
    const el = document.createElement(tag); if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  }
  async function render(body) {
    const panel = element('div', 'background-settings');
    body.replaceChildren(panel); panel.textContent = '正在读取背景…';
    await init();
    if (!panel.isConnected) return;
    panel.replaceChildren();
    panel.append(element('p', 'background-help', '默认保留原有背景，模板仅供选择，点击“使用”后才会更换首页和聊天页背景。图片铺满显示，正文保留阅读底色。'));
    if (loadError) { const warning = element('p', 'background-error', loadError); warning.setAttribute('role', 'alert'); panel.append(warning); }
    const status = element('p', 'background-status', '当前：' + ({ default: '默认背景', template: '模板 · 异火相映', custom: '自定义 · ' + state.name }[state.mode]));
    status.setAttribute('role', 'status'); panel.append(status);
    const grid = element('div', 'background-options'); panel.append(grid);
    function card(title, src, mode, action, label) {
      const box = element('section', 'background-card');
      if (src) { const img = element('img'); img.src = src; img.alt = title; img.loading = 'lazy'; box.append(img); }
      else box.append(element('div', 'background-placeholder', '选择你的风景'));
      box.append(element('h4', '', title));
      const button = element('button', 'settings-action-btn', label);
      button.type = 'button'; button.setAttribute('aria-pressed', String(state.mode === mode)); button.addEventListener('click', action);
      box.append(button); grid.append(box); return box;
    }
    card('异火相映 · 萧炎与薰儿', TEMPLATE, 'template', () => change(s => ({ ...s, mode: 'template' })), '使用此模板');
    const custom = card('自定义背景', '', 'custom', () => input.click(), state.custom ? '上传替换图片' : '上传图片');
    // Thumbnail URLs belong to this panel and are revoked after decoding.
    if (state.custom) {
      const thumbURL = URL.createObjectURL(state.custom), img = element('img');
      img.alt = '已保存的自定义背景'; img.onload = img.onerror = () => URL.revokeObjectURL(thumbURL); img.src = thumbURL;
      custom.firstChild.replaceWith(img);
      const name = element('p', 'background-help', state.name); custom.append(name);
      const use = element('button', 'settings-action-btn', '使用已上传图片'); use.type = 'button';
      use.onclick = () => change(s => ({ ...s, mode: 'custom' })); custom.append(use);
      const remove = element('button', 'background-text-button', '删除自定义图片'); remove.type = 'button';
      remove.onclick = () => change(s => ({ ...s, mode: s.mode === 'custom' ? 'default' : s.mode, custom: null, name: '' })); custom.append(remove);
    }
    const input = element('input'); input.type = 'file'; input.accept = 'image/png,image/jpeg,image/webp'; input.hidden = true;
    input.addEventListener('change', () => upload(input.files[0])); custom.append(input);
    panel.append(element('p', 'background-help', '支持 PNG / JPG / WebP，最大 12 MB。上传图片仅保存在当前浏览器，不上传服务器，也不随角色存档导出。'));
    if (activeURL) {
      const preview = element('div', 'background-preview');
      preview.style.backgroundImage = 'linear-gradient(rgb(0 0 0 / var(--preview-dim)),rgb(0 0 0 / var(--preview-dim))),url("' + activeURL + '")';
      preview.style.setProperty('--preview-dim', state.dim / 100); preview.style.backgroundPosition = state.position + '% center';
      preview.setAttribute('role', 'img'); preview.setAttribute('aria-label', '当前背景裁切与遮罩预览'); panel.append(preview);
      [['dim', '背景遮罩', '越高越暗'], ['position', '横向裁切位置', '左侧 → 右侧']].forEach(([key, title, hint]) => {
        const label = element('label', 'background-slider'), text = element('span', '', title + ' · ' + hint), output = element('output', '', state[key] + '%');
        const slider = element('input'); slider.type = 'range'; slider.min = '0'; slider.max = '100'; slider.value = state[key]; slider.setAttribute('aria-label', title);
        slider.oninput = () => {
          output.value = slider.value + '%';
          if (key === 'dim') preview.style.setProperty('--preview-dim', slider.value / 100);
          else preview.style.backgroundPosition = slider.value + '% center';
        };
        slider.onchange = () => change(s => ({ ...s, [key]: Number(slider.value) }));
        label.append(text, output, slider); panel.append(label);
      });
    }
    const reset = element('button', 'settings-action-btn', '恢复默认背景'); reset.type = 'button';
    reset.onclick = () => change(s => ({ ...s, mode: 'default', dim: 25, position: 50 })); panel.append(reset);
    lock(busy);
  }
  window.BackgroundSettings = { render };
  document.addEventListener('DOMContentLoaded', init);
})();
