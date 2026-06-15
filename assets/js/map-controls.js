/**
 * 地图控件 — 搜索、缩放、指南针、比例尺、灵气感知
 */

function renderMapControls(container, engine) {
  var canvas = container.querySelector('canvas');
  container.innerHTML = `
    <!-- 搜索栏 -->
    <div id="map-search-wrap" style="position:absolute;top:10px;left:10px;z-index:10;display:flex;gap:6px;align-items:center;">
      <input id="map-search-input" type="text" placeholder="搜索地点…"
        style="width:180px;padding:6px 10px;border:1px solid #b8956a;border-radius:6px;background:#fdfbf5;font-size:12px;font-family:'Noto Serif SC',serif;color:#3D2B1F;outline:none;"
        autocomplete="off">
      <div id="map-search-results" style="display:none;position:absolute;top:34px;left:0;width:100%;max-height:200px;overflow-y:auto;background:#fdfbf5;border:1px solid #b8956a;border-radius:6px;box-shadow:0 4px 12px rgba(0,0,0,0.2);z-index:20;"></div>
    </div>

    <!-- 缩放按钮 -->
    <div style="position:absolute;bottom:20px;right:20px;z-index:10;display:flex;flex-direction:column;gap:4px;">
      <button id="map-zoom-in" title="放大"
        style="width:32px;height:32px;border:1px solid #b8956a;border-radius:6px;background:#fdfbf5;color:#4a2a10;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1;">+</button>
      <button id="map-zoom-out" title="缩小"
        style="width:32px;height:32px;border:1px solid #b8956a;border-radius:6px;background:#fdfbf5;color:#4a2a10;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1;">−</button>
      <button id="map-reset" title="重置视图"
        style="width:32px;height:32px;border:1px solid #b8956a;border-radius:6px;background:#fdfbf5;color:#4a2a10;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;">⌂</button>
    </div>

    <!-- 指南针 -->
    <div style="position:absolute;top:20px;right:20px;z-index:10;">
      <svg width="40" height="40" viewBox="-20 -20 40 40">
        <circle cx="0" cy="0" r="18" fill="none" stroke="#8B7355" stroke-width="0.8" opacity="0.5"/>
        <polygon points="0,-14 -3,-4 3,-4" fill="#6B2A2A"/>
        <polygon points="0,14 -3,4 3,4" fill="#8B7355"/>
        <text x="0" y="-16" font-size="7" fill="#6B2A2A" text-anchor="middle" font-family="serif">北</text>
      </svg>
    </div>

    <!-- 比例尺 -->
    <div id="map-scale-bar" style="position:absolute;bottom:20px;left:20px;z-index:10;font-size:10px;color:#6b4a2a;font-family:serif;">
      1坐标 ≈ 10 km
    </div>

    <!-- 灵气感知按钮 -->
    <button id="map-energy-btn" title="灵气感知"
      style="position:absolute;top:50px;right:20px;z-index:10;padding:6px 10px;border:1px solid #b8956a;border-radius:6px;background:#fdfbf5;color:#4a2a10;font-size:11px;cursor:pointer;font-family:'Noto Serif SC',serif;">
      ☁️ 灵气感知
    </button>
  `;

  if (canvas) container.appendChild(canvas);

  // ---- Event bindings ----
  document.getElementById('map-zoom-in').addEventListener('click', () => {
    engine.zoom(-1, engine.canvas.width / 2, engine.canvas.height / 2);
  });
  document.getElementById('map-zoom-out').addEventListener('click', () => {
    engine.zoom(1, engine.canvas.width / 2, engine.canvas.height / 2);
  });
  document.getElementById('map-reset').addEventListener('click', () => engine.resetView());

  // Search
  const searchInput = document.getElementById('map-search-input');
  const searchResults = document.getElementById('map-search-results');
  let searchIndex = [];

  function buildSearchIndex() {
    searchIndex = [];
    for (const r of MAP_REGIONS) {
      searchIndex.push({ name: r.name, regionId: r.id, type: 'region', pos: r.polygon
        ? [r.polygon.reduce((a,[x])=>a+x,0)/r.polygon.length, r.polygon.reduce((a,[,y])=>a+y,0)/r.polygon.length]
        : [0,0] });
    }
    for (const [regionId, subs] of Object.entries(MAP_SUB_LOCATIONS)) {
      for (const s of subs) {
        searchIndex.push({ name: s.name, regionId, type: 'sub', pos: s.pos, desc: s.desc });
      }
    }
  }
  buildSearchIndex();

  searchInput.addEventListener('input', () => {
    const q = searchInput.value.trim().toLowerCase();
    if (!q) { searchResults.style.display = 'none'; return; }
    const matches = searchIndex.filter(item =>
      item.name.toLowerCase().includes(q)
    ).slice(0, 8);
    if (matches.length === 0) {
      searchResults.innerHTML = '<div style="padding:8px;color:#888;font-size:11px;">未找到</div>';
    } else {
      searchResults.innerHTML = matches.map(m => `
        <div class="map-search-item" data-region="${m.regionId}" data-x="${m.pos[0]}" data-y="${m.pos[1]}"
          style="padding:6px 10px;cursor:pointer;font-size:11px;border-bottom:1px solid #e8d4a8;font-family:'Noto Serif SC',serif;color:#3D2B1F;"
          onmouseenter="this.style.background='#efe0c0'" onmouseleave="this.style.background='transparent'">
          <b>${m.name}</b> <span style="color:#888;font-size:9px;">${m.type === 'region' ? '区域' : '地点'}</span>
        </div>
      `).join('');
    }
    searchResults.style.display = 'block';
  });
  searchResults.addEventListener('click', e => {
    const item = e.target.closest('.map-search-item');
    if (!item) return;
    const x = parseFloat(item.dataset.x);
    const y = parseFloat(item.dataset.y);
    engine.flyTo(x, y, 2);
    searchInput.value = item.querySelector('b').textContent;
    searchResults.style.display = 'none';
  });
  searchInput.addEventListener('blur', () => {
    setTimeout(() => { searchResults.style.display = 'none'; }, 200);
  });

  // Energy pulse toggle
  let energyOn = false;
  document.getElementById('map-energy-btn').addEventListener('click', () => {
    energyOn = !energyOn;
    const btn = document.getElementById('map-energy-btn');
    if (energyOn) {
      const highEnergy = MAP_REGIONS.filter(r => r.energy === '浓郁' || r.energy === '诡异').map(r => r.id);
      engine.setPulseRegions(highEnergy);
      btn.style.background = '#e8d4a8';
      btn.textContent = '☁️ 灵气感知 ON';
    } else {
      engine.setPulseRegions([]);
      btn.style.background = '#fdfbf5';
      btn.textContent = '☁️ 灵气感知';
    }
  });

  // Scale bar update
  function updateScale() {
    const kmPerUnit = 10;
    const pxPerUnit = engine.scale;
    let targetKm = 50;
    let targetPx = targetKm / kmPerUnit * pxPerUnit;
    while (targetPx > 120 && targetKm > 5) { targetKm /= 2; targetPx = targetKm / kmPerUnit * pxPerUnit; }
    while (targetPx < 40 && targetKm < 200) { targetKm *= 2; targetPx = targetKm / kmPerUnit * pxPerUnit; }
    document.getElementById('map-scale-bar').textContent = `${targetKm} km`;
  }
  engine._origRender = engine.render;
  engine.render = function() {
    engine._origRender();
    updateScale();
  };
}
