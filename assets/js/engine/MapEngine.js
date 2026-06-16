/**
 * 地图渲染引擎 — 基于凡人地图编辑器模板架构
 *
 * 核心理念：简单、直接、有效。
 *   单个 Canvas → dirty-flag rAF → viewport 线性变换 → 顺序绘制各层
 */

class MapEngine {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    // 视口状态（与模板完全一致）
    this.scale = options.scale ?? 0.5;
    this.offsetX = options.offsetX ?? 0;
    this.offsetY = options.offsetY ?? 0;
    this.minScale = options.minScale ?? 0.05;
    this.maxScale = options.maxScale ?? 10;

    // 交互状态
    this.isDragging = false;
    this.lastMouse = { x: 0, y: 0 };
    this.mouseWorld = { x: 0, y: 0 };
    this.hoveredId = null;
    this.selectedId = null;

    // 世界尺寸
    this.worldW = options.worldW ?? 1200;
    this.worldH = options.worldH ?? 800;

    // 数据注册
    this._regions = [];
    this._subLocations = {};
    this._terrain = { deserts: [], forests: [], mountains: [], rivers: [], oceans: [] };
    this._particles = [];
    this._particleFn = null;
    this._particleBounds = { w: this.worldW, h: this.worldH };

    // 角色（小人）
    this.charX = options.charX ?? 100;
    this.charY = options.charY ?? 400;
    this.charTarget = null;       // { x, y, onArrive }
    this.charWalking = false;
    this.charSpeed = options.charSpeed ?? 0.25; // world units per ms
    this.charDirection = 1;       // 1=右, -1=左
    this.charBob = 0;             // 走路上下摆动

    // 外部回调
    this.onRegionClick = options.onRegionClick || (() => {});
    this.onSubClick = options.onSubClick || (() => {});
    this.onHoverChange = options.onHoverChange || (() => {});

    // 纹理缓存
    this._texCanvas = null;
    this._texReady = false;

    // 动画相关
    this._particles = [];
    this._initParticles();

    // 渲染调度（模板风格 dirty-flag）
    this._renderRequested = false;
    this._renderBound = this._render.bind(this);

    this._bindEvents();
    this._resize();
    this._buildTexture();
    this.requestRender();
  }

  // ═══════════════════════════════════════
  // 坐标变换（与模板完全一致）
  // ═══════════════════════════════════════

  /** 屏幕坐标 → 世界坐标 */
  toWorld(sx, sy) {
    return {
      x: (sx - this.offsetX) / this.scale,
      y: (sy - this.offsetY) / this.scale
    };
  }

  /** 世界坐标 → 屏幕坐标 */
  toScreen(wx, wy) {
    return {
      x: wx * this.scale + this.offsetX,
      y: wy * this.scale + this.offsetY
    };
  }

  // ═══════════════════════════════════════
  // 角色行走
  // ═══════════════════════════════════════

  /**
   * 让小人走到指定世界坐标
   * @param {number} wx
   * @param {number} wy
   * @param {Function} [onArrive] - 到达后回调
   */
  walkTo(wx, wy, onArrive) {
    this.charTarget = { x: wx, y: wy, onArrive: onArrive || null };
    this.charWalking = true;
    this.requestRender();
  }

  /** 获取角色当前世界坐标 */
  getCharPos() {
    return { x: this.charX, y: this.charY };
  }

  // ═══════════════════════════════════════
  // 视口操作
  // ═══════════════════════════════════════

  pan(dx, dy) {
    this.offsetX += dx;
    this.offsetY += dy;
    this.requestRender();
  }

  zoomAt(factor, sx, sy) {
    const old = this.scale;
    this.scale = Math.max(this.minScale, Math.min(this.maxScale, this.scale * factor));
    // 以鼠标位置为锚点缩放
    this.offsetX = sx - (sx - this.offsetX) * (this.scale / old);
    this.offsetY = sy - (sy - this.offsetY) * (this.scale / old);
    this.requestRender();
  }

  fitToScreen() {
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    const pad = 20;
    const sx = (cw - pad * 2) / this.worldW;
    const sy = (ch - pad * 2) / this.worldH;
    this.scale = Math.min(sx, sy);
    this.offsetX = (cw - this.worldW * this.scale) / 2;
    this.offsetY = (ch - this.worldH * this.scale) / 2;
    this.requestRender();
  }

  resetView() {
    this.fitToScreen();
  }

  flyTo(wx, wy, targetScale) {
    const start = { ox: this.offsetX, oy: this.offsetY, scale: this.scale };
    const end = {
      ox: this.canvas.width / 2 - wx * targetScale,
      oy: this.canvas.height / 2 - wy * targetScale,
      scale: targetScale
    };
    const duration = 400;
    const startTime = performance.now();

    const animate = (now) => {
      const t = Math.min(1, (now - startTime) / duration);
      const ease = 1 - Math.pow(1 - t, 3);
      this.scale = start.scale + (end.scale - start.scale) * ease;
      this.offsetX = start.ox + (end.ox - start.ox) * ease;
      this.offsetY = start.oy + (end.oy - start.oy) * ease;
      if (t < 1) {
        requestAnimationFrame(animate);
      }
      this.requestRender();
    };
    requestAnimationFrame(animate);
  }

  // ═══════════════════════════════════════
  // 数据加载
  // ═══════════════════════════════════════

  setRegions(regions) { this._regions = regions; this.requestRender(); }
  setSubLocations(subs) { this._subLocations = subs; this.requestRender(); }
  setTerrain(terrain) { this._terrain = terrain; this.requestRender(); }
  setParticles(particles, updateFn, bounds) {
    this._particles = particles;
    this._particleFn = updateFn;
    if (bounds) this._particleBounds = bounds;
    this.requestRender();
  }

  // ═══════════════════════════════════════
  // 命中检测
  // ═══════════════════════════════════════

  hitTestRegion(wx, wy) {
    for (let i = this._regions.length - 1; i >= 0; i--) {
      if (this._regions[i].polygon && this._pointInPolygon(wx, wy, this._regions[i].polygon)) {
        return this._regions[i];
      }
    }
    return null;
  }

  hitTestSub(wx, wy, regionId) {
    const subs = this._subLocations[regionId] || [];
    const thr = 10 / this.scale;
    for (const s of subs) {
      const dx = wx - s.pos[0], dy = wy - s.pos[1];
      if (Math.sqrt(dx * dx + dy * dy) < thr) return { sub: s };
    }
    return null;
  }

  _pointInPolygon(px, py, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
      if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  // ═══════════════════════════════════════
  // 粒子
  // ═══════════════════════════════════════

  _initParticles() {
    for (let i = 0; i < 40; i++) {
      this._particles.push({
        x: Math.random() * this.worldW, y: Math.random() * this.worldH,
        vx: (Math.random() - 0.5) * 0.15, vy: (Math.random() - 0.5) * 0.12,
        size: 0.8 + Math.random() * 1.5, alpha: 0.15 + Math.random() * 0.35,
        phase: Math.random() * Math.PI * 2
      });
    }
  }

  _updateParticles(dt) {
    if (this._particleFn) {
      this._particleFn(this._particles, dt, this._particleBounds);
    } else {
      for (const p of this._particles) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x += this._particleBounds.w;
        if (p.x > this._particleBounds.w) p.x -= this._particleBounds.w;
        if (p.y < 0) p.y += this._particleBounds.h;
        if (p.y > this._particleBounds.h) p.y -= this._particleBounds.h;
      }
    }
  }

  // ═══════════════════════════════════════
  // 羊皮纸纹理（程序化生成，与模板背景层概念一致）
  // ═══════════════════════════════════════

  _buildTexture() {
    const tw = 512, th = 512;
    this._texCanvas = document.createElement('canvas');
    this._texCanvas.width = tw;
    this._texCanvas.height = th;
    const tctx = this._texCanvas.getContext('2d');

    const bg = tctx.createLinearGradient(0, 0, tw, th);
    bg.addColorStop(0, '#f7eed8');
    bg.addColorStop(0.3, '#efe0c0');
    bg.addColorStop(0.6, '#ecdbb3');
    bg.addColorStop(1, '#e8d4a8');
    tctx.fillStyle = bg;
    tctx.fillRect(0, 0, tw, th);

    const imageData = tctx.getImageData(0, 0, tw, th);
    const d = imageData.data;
    for (let y = 0; y < th; y++) {
      for (let x = 0; x < tw; x++) {
        const idx = (y * tw + x) * 4;
        const n = (Math.sin(x * 0.02 + y * 0.02) * Math.cos(y * 0.03 - x * 0.01) * 0.04 +
                   Math.sin(x * 0.06) * Math.cos(y * 0.05) * 0.02);
        d[idx] = Math.min(255, d[idx] + n * 255);
        d[idx + 1] = Math.min(255, d[idx + 1] + n * 240);
        d[idx + 2] = Math.min(255, d[idx + 2] + n * 200);
      }
    }
    tctx.putImageData(imageData, 0, 0);

    // 茶渍
    for (let i = 0; i < 12; i++) {
      const sx = Math.random() * tw, sy = Math.random() * th, r = 30 + Math.random() * 80;
      const stain = tctx.createRadialGradient(sx, sy, r * 0.3, sx, sy, r);
      stain.addColorStop(0, 'rgba(139,90,43,0.06)');
      stain.addColorStop(0.5, 'rgba(139,90,43,0.03)');
      stain.addColorStop(1, 'rgba(139,90,43,0)');
      tctx.fillStyle = stain;
      tctx.fillRect(sx - r, sy - r, r * 2, r * 2);
    }
    this._texReady = true;
  }

  // ═══════════════════════════════════════
  // 渲染调度（模板风格 dirty-flag）
  // ═══════════════════════════════════════

  requestRender() {
    if (!this._renderRequested) {
      this._renderRequested = true;
      requestAnimationFrame(this._renderBound);
    }
  }

  // ═══════════════════════════════════════
  // 主渲染（模板风格：清除 → 背景 → ctx.save → translate+scale → 绘制世界 → ctx.restore → 叠加层）
  // ═══════════════════════════════════════

  _render(timestamp) {
    this._renderRequested = false;
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const now = timestamp || performance.now();

    // 计算 dt
    if (!this._lastTime) this._lastTime = now;
    const dt = Math.min(now - this._lastTime, 100);
    this._lastTime = now;

    // 更新粒子
    this._updateParticles(dt);

    // 更新角色行走
    if (this.charWalking && this.charTarget) {
      const dx = this.charTarget.x - this.charX;
      const dy = this.charTarget.y - this.charY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const step = this.charSpeed * dt;

      if (dist <= step) {
        // 到达
        this.charX = this.charTarget.x;
        this.charY = this.charTarget.y;
        this.charWalking = false;
        this.charBob = 0;
        if (this.charTarget.onArrive) {
          this.charTarget.onArrive();
        }
        this.charTarget = null;
      } else {
        // 行走中
        this.charX += (dx / dist) * step;
        this.charY += (dy / dist) * step;
        this.charDirection = dx >= 0 ? 1 : -1;
        this.charBob += dt * 0.008;
        // 相机跟随
        const scr = this.toScreen(this.charX, this.charY);
        const cw = this.canvas.width;
        const ch = this.canvas.height;
        const margin = 100;
        if (scr.x < margin || scr.x > cw - margin || scr.y < margin || scr.y > ch - margin) {
          this.offsetX += (cw / 2 - scr.x) * 0.1;
          this.offsetY += (ch / 2 - scr.y) * 0.1;
        }
      }
      this.requestRender();
    }

    // 1. 清除画布
    ctx.fillStyle = '#1a1510';
    ctx.fillRect(0, 0, W, H);

    // 2. 背景层 — 在 screen space 绘制（不受视口变换影响）
    this._drawParchment(ctx, W, H);

    // 3. 进入世界坐标空间（与模板完全一致）
    ctx.save();
    ctx.translate(this.offsetX, this.offsetY);
    ctx.scale(this.scale, this.scale);

    // 4. 绘制世界底层
    this._drawGrid(ctx);

    // 5. 绘制地形
    this._drawTerrain(ctx);

    // 6. 绘制区域
    this._drawRegions(ctx, now);

    // 7. 绘制子地点
    this._drawSubLocations(ctx, now);

    // 8. 绘制标签
    this._drawLabels(ctx, now);

    // 9. 绘制粒子
    this._drawParticles(ctx, now);

    // 9.5 绘制角色小人（世界空间）
    this._drawCharacter(ctx, now);

    // 10. 退出世界坐标空间
    ctx.restore();

    // 11. 屏幕空间叠加层
    this._drawHUD(ctx, W, H, now);

    // 12. 暗角后处理
    this._drawVignette(ctx, W, H);
  }

  // ═══════════════════════════════════════
  // 各层绘制（在世界坐标空间内）
  // ═══════════════════════════════════════

  _drawParchment(ctx, W, H) {
    if (!this._texReady) return;
    // 用视口变换反算纹理偏移，使纹理随地图滚动
    const tw = 512;
    const ts = tw * 0.35;
    const ox = (this.offsetX % (ts * this.scale) + ts * this.scale) % (ts * this.scale);
    const oy = (this.offsetY % (ts * this.scale) + ts * this.scale) % (ts * this.scale);
    const tileW = ts * this.scale;
    const tileH = ts * this.scale;

    ctx.save();
    ctx.globalAlpha = 0.45;
    for (let y = -oy; y < H + tileH; y += tileH) {
      for (let x = -ox; x < W + tileW; x += tileW) {
        ctx.drawImage(this._texCanvas, x, y, tileW, tileH);
      }
    }
    ctx.restore();
  }

  _drawGrid(ctx) {
    ctx.save();
    ctx.strokeStyle = '#8B7355';
    ctx.lineWidth = 0.3 / this.scale;
    ctx.globalAlpha = 0.06;
    const gs = 80;
    for (let x = 0; x <= this.worldW; x += gs) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, this.worldH); ctx.stroke();
    }
    for (let y = 0; y <= this.worldH; y += gs) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.worldW, y); ctx.stroke();
    }
    ctx.restore();
  }

  _drawTerrain(ctx) {
    // 沙漠
    for (const d of (this._terrain.deserts || [])) {
      if (!d.polygon || d.polygon.length < 3) continue;
      ctx.save();
      ctx.beginPath();
      d.polygon.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
      ctx.closePath();
      ctx.fillStyle = 'rgba(200,170,120,0.2)';
      ctx.fill();
      // 沙丘纹理
      ctx.save(); ctx.clip();
      ctx.strokeStyle = 'rgba(180,145,90,0.15)';
      ctx.lineWidth = 1 / this.scale;
      const sp = 22;
      for (let x = -sp; x < this.worldW + sp; x += sp) {
        for (let y = -sp; y < this.worldH + sp; y += sp) {
          ctx.beginPath();
          ctx.arc(x + Math.sin(y) * 6, y + Math.cos(x) * 6, 8, 0, Math.PI);
          ctx.stroke();
        }
      }
      ctx.restore();
      ctx.restore();
    }

    // 森林
    for (const f of (this._terrain.forests || [])) {
      if (!f.polygon || f.polygon.length < 3) continue;
      ctx.save();
      ctx.beginPath();
      f.polygon.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
      ctx.closePath();
      ctx.fillStyle = 'rgba(30,100,40,0.18)';
      ctx.fill();
      ctx.save(); ctx.clip();
      ctx.fillStyle = 'rgba(25,80,30,0.12)';
      const sp = 14;
      for (let x = -sp; x < this.worldW + sp; x += sp) {
        for (let y = -sp; y < this.worldH + sp; y += sp) {
          ctx.beginPath();
          ctx.arc(x + (Math.sin(x + y) * 4), y + (Math.cos(x - y) * 4), 5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
      ctx.restore();
    }

    // 山脉
    for (const m of (this._terrain.mountains || [])) {
      if (!m.polygon || m.polygon.length < 3) continue;
      ctx.save();
      ctx.beginPath();
      m.polygon.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
      ctx.closePath();
      ctx.fillStyle = 'rgba(140,130,120,0.15)';
      ctx.fill();
      ctx.restore();
    }

    // 河流
    for (const rv of (this._terrain.rivers || [])) {
      if (!rv.points || rv.points.length < 2) continue;
      ctx.save();
      ctx.strokeStyle = 'rgba(100,140,180,0.35)';
      ctx.lineWidth = (rv.width || 3) / this.scale;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      rv.points.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
      ctx.stroke();
      // 高光
      ctx.strokeStyle = 'rgba(180,210,235,0.1)';
      ctx.lineWidth = (rv.width || 3) / this.scale * 0.4;
      ctx.stroke();
      ctx.restore();
    }
  }

  _drawRegions(ctx, now) {
    // 先绘制所有非大陆区域（填充+边框）
    for (const r of this._regions) {
      if (!r.polygon || r.polygon.length < 3) continue;
      if (r.type === 'continent') continue; // 大陆级描边单独处理
      const isHovered = r.id === this.hoveredId;
      const isSelected = r.id === this.selectedId;

      ctx.beginPath();
      r.polygon.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
      ctx.closePath();

      // 填充
      let alpha = r.type === 'wild' ? 0.2 : r.type === 'desert' ? 0.25 : 0.3;
      if (isHovered || isSelected) alpha = 0.5;
      ctx.fillStyle = (r.color || '#888') + Math.round(alpha * 255).toString(16).padStart(2, '0');
      ctx.fill();

      // 边框
      const isDark = r.type === 'dark' || r.danger === '致命';
      const isRuins = r.type === 'ruins';
      ctx.strokeStyle = r.color || '#888';
      ctx.lineWidth = (isHovered ? 2.5 : (r.type === 'core' || r.type === 'dark' ? 1.8 : 1.0)) / this.scale;
      ctx.globalAlpha = isHovered ? 1 : 0.6;
      if (isDark || isRuins) ctx.setLineDash([6 / this.scale, 4 / this.scale]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      // 悬停光晕
      if (isHovered) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,245,210,0.6)';
        ctx.lineWidth = 4 / this.scale;
        ctx.shadowColor = 'rgba(212,168,75,0.5)';
        ctx.shadowBlur = 12 / this.scale;
        ctx.stroke();
        ctx.restore();
      }
    }

    // 再绘制大陆级区域（仅描边+淡底色，不遮挡子区域）
    for (const r of this._regions) {
      if (!r.polygon || r.polygon.length < 3) continue;
      if (r.type !== 'continent') continue;
      const isHovered = r.id === this.hoveredId;

      ctx.beginPath();
      r.polygon.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
      ctx.closePath();

      // 极淡底色
      ctx.fillStyle = (r.color || '#888') + '10';
      ctx.fill();

      // 粗虚线边框
      ctx.strokeStyle = r.color || '#888';
      ctx.lineWidth = (isHovered ? 3 : 2) / this.scale;
      ctx.globalAlpha = isHovered ? 1 : 0.5;
      ctx.setLineDash([10 / this.scale, 5 / this.scale]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }
  }

  _drawSubLocations(ctx, now) {
    if (this.scale < 0.4) return;
    for (const [regionId, subs] of Object.entries(this._subLocations)) {
      for (const s of subs) {
        const pulse = Math.sin(now / 800 + s.pos[0] * 0.01) * 0.25 + 0.75;

        // 外光晕
        ctx.beginPath();
        ctx.arc(s.pos[0], s.pos[1], 5 * pulse / this.scale, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,220,0.2)';
        ctx.fill();

        // 菱形标记
        ctx.save();
        ctx.translate(s.pos[0], s.pos[1]);
        ctx.rotate(Math.PI / 4);
        const sz = 3 * pulse / this.scale;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-sz, -sz, sz * 2, sz * 2);
        ctx.strokeStyle = '#d4a84b';
        ctx.lineWidth = 1 / this.scale;
        ctx.strokeRect(-sz, -sz, sz * 2, sz * 2);
        ctx.restore();

        // 名称（高缩放时）
        if (this.scale > 0.8 && s.name) {
          ctx.fillStyle = '#3D2B1F';
          ctx.font = `${Math.max(7, 8)}px "Noto Serif SC", serif`;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(s.name, s.pos[0] + 6 / this.scale, s.pos[1] + 1 / this.scale);
        }
      }
    }
  }

  _drawLabels(ctx, now) {
    if (this.scale < 0.3) return;
    const ls = Math.max(0.5, Math.min(1, this.scale * 2));
    for (const r of this._regions) {
      if (!r.polygon || r.polygon.length < 3) continue;
      let cx = 0, cy = 0;
      for (const [x, y] of r.polygon) { cx += x; cy += y; }
      cx /= r.polygon.length; cy /= r.polygon.length;

      const fs = (r.type === 'core' ? 18 : r.type === 'continent' ? 14 : r.type === 'empire' ? 11 : r.type === 'sanctuary' ? 8 : 9) * ls;
      ctx.font = `bold ${fs}px "Noto Serif SC", "SimSun", serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // 投影
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.fillText(r.name, cx + 1 / this.scale, cy + 1 / this.scale);
      // 正文
      ctx.fillStyle = r.type === 'dark' ? '#d0c0c0' : '#3D2B1F';
      ctx.fillText(r.name, cx, cy);

      // 势力副标题（高缩放）
      if (this.scale > 0.8 && r.factions) {
        ctx.globalAlpha = 0.45;
        ctx.font = `${fs * 0.55}px "Noto Serif SC", serif`;
        ctx.fillText(r.factions.length > 20 ? r.factions.slice(0, 20) + '…' : r.factions, cx, cy + fs + 3 / this.scale);
        ctx.globalAlpha = 1;
      }
    }

    // 海洋标签
    for (const o of (this._terrain.oceans || [])) {
      ctx.fillStyle = '#7B6345';
      ctx.globalAlpha = 0.35;
      ctx.font = 'italic 12px "Noto Serif SC", serif';
      ctx.textAlign = 'center';
      ctx.fillText(o.name, o.x, o.y);
    }
    ctx.globalAlpha = 1;
  }

  _drawParticles(ctx, now) {
    for (const p of this._particles) {
      const alpha = p.alpha * (0.6 + 0.4 * Math.sin(now / 1500 + p.phase));
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2);
      grad.addColorStop(0, `rgba(212,168,75,${alpha})`);
      grad.addColorStop(1, 'rgba(212,168,75,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _drawCharacter(ctx, now) {
    const cx = this.charX;
    const cy = this.charY;
    const bob = this.charWalking ? Math.sin(this.charBob) * 3 : 0;
    const dir = this.charDirection;
    const s = 14 / this.scale; // 角色大小（世界单位）
    const walk = this.charWalking;
    const t = now / 200; // 动画时间

    ctx.save();
    ctx.translate(cx, cy + bob);

    // ── 地面阴影（立体椭圆） ──
    const shadowGrad = ctx.createRadialGradient(0, s * 0.8, s * 0.1, 0, s * 0.8, s * 0.55);
    shadowGrad.addColorStop(0, 'rgba(0,0,0,0.35)');
    shadowGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = shadowGrad;
    ctx.beginPath();
    ctx.ellipse(0, s * 0.8, s * 0.5, s * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();

    // ── 走路腿部动画参数 ──
    const legSwing = walk ? Math.sin(this.charBob * 1.2) * 0.5 : 0;
    const armSwing = walk ? Math.sin(this.charBob * 1.2 + Math.PI) * 0.5 : 0;

    // ═══════════════════════════════════
    // 躯干（立体渐变圆柱）
    // ═══════════════════════════════════
    const bodyTop = -s * 0.85;
    const bodyBot = s * 0.05;
    const bodyW = s * 0.16;
    const bodyGrad = ctx.createLinearGradient(-bodyW, 0, bodyW, 0);
    bodyGrad.addColorStop(0, '#1a3a5a');   // 左侧暗面
    bodyGrad.addColorStop(0.3, '#3a6090'); // 中间调
    bodyGrad.addColorStop(0.6, '#5090c0'); // 高光
    bodyGrad.addColorStop(1, '#1a3050');   // 右侧暗面
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.roundRect(-bodyW, bodyTop, bodyW * 2, bodyBot - bodyTop + s * 0.25, s * 0.06);
    ctx.fill();

    // 躯干轮廓
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = s * 0.03;
    ctx.stroke();

    // ═══════════════════════════════════
    // 左腿（立体圆柱 + 脚）
    // ═══════════════════════════════════
    const hipY = bodyBot + s * 0.08;
    const kneeY = hipY + s * 0.35;
    const footY = hipY + s * 0.7;
    const lHipX = -s * 0.08;
    const rHipX = s * 0.08;
    const lKneeX = lHipX + legSwing * s * 0.3;
    const rKneeX = rHipX - legSwing * s * 0.3;
    const lFootX = lKneeX;
    const rFootX = rKneeX;

    // 左腿大腿
    this._drawLimb3D(ctx, lHipX, hipY, lKneeX, kneeY, s * 0.11, s * 0.08, '#2a4060', '#4a70a0');
    // 左腿小腿
    this._drawLimb3D(ctx, lKneeX, kneeY, lFootX, footY, s * 0.08, s * 0.06, '#2a4060', '#4a70a0');

    // 左脚
    ctx.fillStyle = '#3a3020';
    ctx.beginPath();
    ctx.roundRect(lFootX - s * 0.13, footY - s * 0.04, s * 0.26, s * 0.08, s * 0.04);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = s * 0.02;
    ctx.stroke();

    // ═══════════════════════════════════
    // 右腿
    // ═══════════════════════════════════
    this._drawLimb3D(ctx, rHipX, hipY, rKneeX, kneeY, s * 0.11, s * 0.08, '#2a4060', '#4a70a0');
    this._drawLimb3D(ctx, rKneeX, kneeY, rFootX, footY, s * 0.08, s * 0.06, '#2a4060', '#4a70a0');

    // 右脚
    ctx.fillStyle = '#3a3020';
    ctx.beginPath();
    ctx.roundRect(rFootX - s * 0.13, footY - s * 0.04, s * 0.26, s * 0.08, s * 0.04);
    ctx.fill();
    ctx.stroke();

    // ═══════════════════════════════════
    // 左臂
    // ═══════════════════════════════════
    const shoulderY = bodyTop + s * 0.18;
    const elbowY = shoulderY + s * 0.3;
    const handY = elbowY + s * 0.28;
    const lShX = -bodyW - s * 0.02;
    const rShX = bodyW + s * 0.02;
    const lElX = lShX + armSwing * s * 0.25;
    const rElX = rShX - armSwing * s * 0.25;

    this._drawLimb3D(ctx, lShX, shoulderY, lElX, elbowY, s * 0.07, s * 0.05, '#3a6090', '#60a0d0');
    this._drawLimb3D(ctx, lElX, elbowY, lElX, handY, s * 0.05, s * 0.04, '#3a6090', '#60a0d0');

    // 左手
    ctx.fillStyle = '#ffe0c0';
    ctx.beginPath();
    ctx.arc(lElX, handY, s * 0.09, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = s * 0.02;
    ctx.stroke();

    // ═══════════════════════════════════
    // 右臂
    // ═══════════════════════════════════
    this._drawLimb3D(ctx, rShX, shoulderY, rElX, elbowY, s * 0.07, s * 0.05, '#3a6090', '#60a0d0');
    this._drawLimb3D(ctx, rElX, elbowY, rElX, handY, s * 0.05, s * 0.04, '#3a6090', '#60a0d0');

    // 右手
    ctx.fillStyle = '#ffe0c0';
    ctx.beginPath();
    ctx.arc(rElX, handY, s * 0.09, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // ═══════════════════════════════════
    // 头部（立体球体渐变）
    // ═══════════════════════════════════
    const headCY = bodyTop - s * 0.08;
    const headR = s * 0.26;
    const headGrad = ctx.createRadialGradient(-headR * 0.25, -headR * 0.3, headR * 0.1, 0, 0, headR);
    headGrad.addColorStop(0, '#fff5e8');    // 高光
    headGrad.addColorStop(0.4, '#ffe0c0');  // 肤色
    headGrad.addColorStop(0.8, '#d4a080');  // 暗面
    headGrad.addColorStop(1, '#b08060');    // 边缘

    ctx.fillStyle = headGrad;
    ctx.beginPath();
    ctx.arc(0, headCY, headR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = s * 0.025;
    ctx.stroke();

    // ═══════════════════════════════════
    // 头发（立体深色）
    // ═══════════════════════════════════
    const hairGrad = ctx.createLinearGradient(0, headCY - headR, 0, headCY);
    hairGrad.addColorStop(0, '#1a0a00');
    hairGrad.addColorStop(0.5, '#2a1a08');
    hairGrad.addColorStop(1, '#3a2a10');
    ctx.fillStyle = hairGrad;
    ctx.beginPath();
    ctx.arc(0, headCY - headR * 0.15, headR * 1.05, Math.PI, Math.PI * 2);
    ctx.fill();

    // 刘海
    ctx.beginPath();
    ctx.ellipse(-headR * 0.15, headCY - headR * 0.1, headR * 0.4, headR * 0.3, 0.1, Math.PI * 1.5, Math.PI * 2.5);
    ctx.fill();

    // ═══════════════════════════════════
    // 眼睛（立体高光）
    // ═══════════════════════════════════
    const eyeY = headCY - headR * 0.15;
    [-0.3, 0.3].forEach(side => {
      const ex = dir * headR * 0.08 + side * headR;
      // 眼白
      const eyeGrad = ctx.createRadialGradient(ex, eyeY, headR * 0.02, ex, eyeY, headR * 0.13);
      eyeGrad.addColorStop(0, '#ffffff');
      eyeGrad.addColorStop(1, '#e8e0d8');
      ctx.fillStyle = eyeGrad;
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, headR * 0.13, headR * 0.16, 0, 0, Math.PI * 2);
      ctx.fill();
      // 瞳孔
      ctx.fillStyle = '#1a0800';
      ctx.beginPath();
      ctx.arc(ex + dir * headR * 0.04, eyeY, headR * 0.07, 0, Math.PI * 2);
      ctx.fill();
      // 高光点
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ex + dir * headR * 0.06, eyeY - headR * 0.04, headR * 0.03, 0, Math.PI * 2);
      ctx.fill();
    });

    // ═══════════════════════════════════
    // 嘴
    // ═══════════════════════════════════
    ctx.strokeStyle = 'rgba(180,100,80,0.6)';
    ctx.lineWidth = s * 0.02;
    ctx.beginPath();
    ctx.arc(0, headCY + headR * 0.25, headR * 0.08, 0.1, Math.PI - 0.1);
    ctx.stroke();

    // ═══════════════════════════════════
    // 行走尘土特效
    // ═══════════════════════════════════
    if (walk) {
      for (let i = 0; i < 4; i++) {
        const fx = -dir * (i * s * 0.35 + ((now / 100) % (s * 1.4)));
        const fy = footY + s * 0.15;
        const fa = (1 - i / 4) * 0.4;
        const dustGrad = ctx.createRadialGradient(fx, fy, 0, fx, fy, s * 0.12);
        dustGrad.addColorStop(0, `rgba(200,180,150,${fa})`);
        dustGrad.addColorStop(1, 'rgba(200,180,150,0)');
        ctx.fillStyle = dustGrad;
        ctx.beginPath();
        ctx.arc(fx, fy, s * 0.12, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  /**
   * 绘制立体肢体（带渐变圆柱体）
   */
  _drawLimb3D(ctx, x1, y1, x2, y2, w1, w2, colorDark, colorLight) {
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 0.01) return;
    const angle = Math.atan2(dy, dx);

    ctx.save();
    ctx.translate(x1, y1);
    ctx.rotate(angle);

    const grad = ctx.createLinearGradient(0, -w1, 0, w1);
    grad.addColorStop(0, colorLight);
    grad.addColorStop(0.5, colorDark);
    grad.addColorStop(1, colorLight);

    ctx.fillStyle = grad;
    ctx.beginPath();
    // 一头宽一头窄（大腿到膝盖）
    ctx.moveTo(0, -w1);
    ctx.lineTo(len, -w2);
    ctx.lineTo(len, w2);
    ctx.lineTo(0, w1);
    ctx.closePath();
    ctx.fill();

    // 轮廓
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = w1 * 0.15;
    ctx.stroke();

    ctx.restore();
  }

  _drawHUD(ctx, W, H, now) {
    // 罗盘 — 右上角
    const cx = W - 50, cy = 50;
    ctx.save();
    ctx.translate(cx, cy);

    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(60,40,20,0.25)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(100,70,40,0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(245,235,210,0.7)';
    ctx.fill();

    ctx.fillStyle = '#8B3A3A';
    ctx.font = 'bold 11px "Noto Serif SC", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('北', 0, -16);

    ctx.restore();

    // 比例尺 — 左下角
    const sbx = 30, sby = H - 24;
    ctx.save();
    ctx.strokeStyle = 'rgba(60,40,20,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sbx, sby);
    ctx.lineTo(sbx + 60, sby);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(60,40,20,0.35)';
    for (let i = 0; i <= 2; i++) {
      const tx = sbx + 30 * i;
      ctx.beginPath();
      ctx.moveTo(tx, sby - 4);
      ctx.lineTo(tx, sby + 4);
      ctx.stroke();
    }
    ctx.font = '8px "Noto Serif SC", serif';
    ctx.fillStyle = 'rgba(60,40,20,0.5)';
    ctx.textAlign = 'center';
    ctx.fillText('≈800里', sbx + 30, sby + 14);
    ctx.restore();

    // FPS
    if (!this._lastFpsTime) { this._lastFpsTime = now; this._fpsCount = 0; }
    this._fpsCount++;
    if (now - this._lastFpsTime >= 1000) {
      this._currentFps = Math.round(this._fpsCount / ((now - this._lastFpsTime) / 1000));
      this._fpsCount = 0;
      this._lastFpsTime = now;
    }
    if (this._currentFps !== undefined) {
      ctx.fillStyle = '#665533';
      ctx.font = '10px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(this._currentFps + ' FPS', W - 10, H - 10);
    }
  }

  _drawVignette(ctx, W, H) {
    const grad = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.55, W / 2, H / 2, Math.max(W, H) * 0.75);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(20,12,5,0.22)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  // ═══════════════════════════════════════
  // 事件（模板风格：直接监听 DOM）
  // ═══════════════════════════════════════

  _bindEvents() {
    // 鼠标按下
    this.canvas.addEventListener('mousedown', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      // 中键 / Shift+左键 → 拖拽平移
      if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
        this.isDragging = true;
        this.lastMouse = { x: mx, y: my };
        this.canvas.style.cursor = 'grabbing';
        return;
      }

      if (e.button === 0) {
        const wPos = this.toWorld(mx, my);

        // 先检查子地点
        if (this.hoveredId) {
          const subHit = this.hitTestSub(wPos.x, wPos.y, this.hoveredId);
          if (subHit) {
            this.onSubClick(subHit.sub);
            return;
          }
        }

        // 再检查区域
        const hit = this.hitTestRegion(wPos.x, wPos.y);
        if (hit) {
          this.selectedId = hit.id;
          this.onRegionClick(hit.id);
        } else {
          this.selectedId = null;
        }

        // 开始拖拽
        this.isDragging = true;
        this._dragMoved = false;
        this.lastMouse = { x: mx, y: my };
        this.requestRender();
      }
    });

    // 鼠标移动
    window.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      if (this.isDragging) {
        const dx = mx - this.lastMouse.x;
        const dy = my - this.lastMouse.y;
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) this._dragMoved = true;
        this.pan(dx, dy);
        this.lastMouse = { x: mx, y: my };
        return;
      }

      const wPos = this.toWorld(mx, my);
      this.mouseWorld = wPos;

      const prev = this.hoveredId;
      const hit = this.hitTestRegion(wPos.x, wPos.y);
      this.hoveredId = hit ? hit.id : null;

      if (this.hoveredId !== prev) {
        this.onHoverChange(this.hoveredId);
        this.canvas.style.cursor = this.hoveredId ? 'pointer' : 'default';
        this.requestRender();
      }
    });

    // 鼠标松开
    window.addEventListener('mouseup', (e) => {
      if (!this.isDragging) return;
      this.isDragging = false;
      this.canvas.style.cursor = this.hoveredId ? 'pointer' : 'default';
    });

    // 滚轮缩放
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      this.zoomAt(factor, mx, my);
    }, { passive: false });

    // 双击 — 放大到点击位置
    this.canvas.addEventListener('dblclick', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const wPos = this.toWorld(mx, my);
      this.flyTo(wPos.x, wPos.y, Math.min(this.scale * 2, this.maxScale));
    });

    // 触摸支持
    this.canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        this.isDragging = true;
        this.lastMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
      this._lastPinchDist = e.touches.length === 2
        ? Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY) : 0;
    }, { passive: false });

    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (e.touches.length === 1 && this.isDragging) {
        const dx = e.touches[0].clientX - this.lastMouse.x;
        const dy = e.touches[0].clientY - this.lastMouse.y;
        this.pan(dx, dy);
        this.lastMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if (e.touches.length === 2) {
        const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        if (this._lastPinchDist > 0) {
          const rect = this.canvas.getBoundingClientRect();
          const mx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
          const my = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
          this.zoomAt(d / this._lastPinchDist, mx, my);
        }
        this._lastPinchDist = d;
      }
    }, { passive: false });

    this.canvas.addEventListener('touchend', () => { this.isDragging = false; });

    // 窗口大小变化
    window.addEventListener('resize', () => this._resize());
  }

  _resize() {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    this.canvas.width = rect.width || 800;
    this.canvas.height = rect.height || 500;
    this.requestRender();
  }

  // ═══════════════════════════════════════
  // 销毁
  // ═══════════════════════════════════════

  destroy() {
    // 清理 reference 防止 rAF 回调
    this._renderRequested = false;
    this._texCanvas = null;
    this.canvas = null;
    this.ctx = null;
  }
}
