/**
 * 斗气大陆地图 Canvas 引擎 v4.0 — 古风精美渲染管线
 *   Layer 1: 羊皮纸纹理底图
 *   Layer 2: 网格经纬线
 *   Layer 3: 地形特征（山脉/沙漠/森林/河流）
 *   Layer 4: 区域半透明填色
 *   Layer 5: 区域边框
 *   Layer 6: 区域标签 + 子地点标记
 *   Layer 7: 海洋/边界标签
 *   Layer 8: 指南针罗盘 + 比例尺
 *   Layer 9: 灵气粒子特效
 *   Layer10: 画面暗角
 */

class MapEngine {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.dpr = window.devicePixelRatio || 1;

    this.worldW = 1200;
    this.worldH = 800;

    this.cx = this.worldW / 2;
    this.cy = this.worldH / 2;
    this.scale = 1;

    this.dragging = false;
    this.dragStart = null;
    this.dragCx = 0;
    this.dragCy = 0;
    this.hoveredRegion = null;
    this.hoveredSub = null;
    this.selectedRegion = null;
    this.animTarget = null;
    this.pulseRegions = new Set();

    this.onRegionClick = options.onRegionClick || (() => {});
    this.onSubClick = options.onSubClick || (() => {});
    this.onHoverChange = options.onHoverChange || (() => {});

    // Pre-generated parchment texture
    this._texCanvas = null;
    this._texReady = false;
    this._particles = [];
    this._initParticles();

    this._bindEvents();
    this._resize();
    this._startRenderLoop();
  }

  // ===== Coordinate Transforms =====
  worldToScreen(wx, wy) {
    return [(wx - this.cx) * this.scale + this.canvas.width / 2, (wy - this.cy) * this.scale + this.canvas.height / 2];
  }
  screenToWorld(sx, sy) {
    return [(sx - this.canvas.width / 2) / this.scale + this.cx, (sy - this.canvas.height / 2) / this.scale + this.cy];
  }
  zoom(delta, mx, my) {
    const [wx, wy] = this.screenToWorld(mx, my);
    const factor = delta > 0 ? 1.15 : 1 / 1.15;
    const ns = Math.max(0.4, Math.min(4, this.scale * factor));
    this.cx = wx - (mx - this.canvas.width / 2) / ns;
    this.cy = wy - (my - this.canvas.height / 2) / ns;
    this.scale = ns;
  }
  pan(dx, dy) {
    this.cx -= dx / this.scale;
    this.cy -= dy / this.scale;
  }
  resetView() {
    this.animTarget = { cx: this.worldW / 2, cy: this.worldH / 2, scale: 1 };
  }
  flyTo(wx, wy, s) {
    this.animTarget = { cx: wx, cy: wy, scale: s || 2 };
  }

  // ===== Hit Testing =====
  _pointInPolygon(px, py, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
      if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  hitTestRegion(wx, wy) {
    for (let i = MAP_REGIONS.length - 1; i >= 0; i--) {
      if (MAP_REGIONS[i].polygon && this._pointInPolygon(wx, wy, MAP_REGIONS[i].polygon)) return MAP_REGIONS[i];
    }
    return null;
  }
  hitTestSub(wx, wy, regionId) {
    const subs = MAP_SUB_LOCATIONS[regionId] || [];
    const thr = 10 / this.scale;
    for (let i = 0; i < subs.length; i++) {
      const dx = wx - subs[i].pos[0], dy = wy - subs[i].pos[1];
      if (Math.sqrt(dx * dx + dy * dy) < thr) return { sub: subs[i], index: i };
    }
    return null;
  }

  // ===== Animation =====
  _animate() {
    if (!this.animTarget) return false;
    const t = this.animTarget, spd = 0.12;
    this.cx += (t.cx - this.cx) * spd;
    this.cy += (t.cy - this.cy) * spd;
    this.scale += (t.scale - this.scale) * spd;
    if (Math.abs(t.cx - this.cx) < 0.5 && Math.abs(t.cy - this.cy) < 0.5 && Math.abs(t.scale - this.scale) < 0.005) {
      this.cx = t.cx; this.cy = t.cy; this.scale = t.scale; this.animTarget = null; return false;
    }
    return true;
  }

  // ===== Parchment Texture =====
  _buildTexture() {
    const tw = 512, th = 512;
    this._texCanvas = document.createElement("canvas");
    this._texCanvas.width = tw;
    this._texCanvas.height = th;
    const tctx = this._texCanvas.getContext("2d");

    // Base gradient
    const bg = tctx.createLinearGradient(0, 0, tw, th);
    bg.addColorStop(0, "#f7eed8");
    bg.addColorStop(0.3, "#efe0c0");
    bg.addColorStop(0.6, "#ecdbb3");
    bg.addColorStop(1, "#e8d4a8");
    tctx.fillStyle = bg;
    tctx.fillRect(0, 0, tw, th);

    // Fibre noise (faux perlin)
    const imageData = tctx.getImageData(0, 0, tw, th);
    const d = imageData.data;
    const seed = 42;
    const prng = (x, y) => {
      let n = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453;
      return n - Math.floor(n);
    };
    const sm = (x, y) => {
      const ix = Math.floor(x), iy = Math.floor(y);
      const fx = x - ix, fy = y - iy;
      const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      const a = prng(ix, iy), b = prng(ix + 1, iy), c = prng(ix, iy + 1), dd = prng(ix + 1, iy + 1);
      return a + (b - a) * sx + ((c + (dd - c) * sx) - (a + (b - a) * sx)) * sy;
    };
    for (let y = 0; y < th; y++) {
      for (let x = 0; x < tw; x++) {
        const idx = (y * tw + x) * 4;
        const n = sm(x * 0.02, y * 0.02) * 0.06 + sm(x * 0.06, y * 0.05) * 0.03;
        d[idx] = Math.min(255, d[idx] + n * 255);
        d[idx + 1] = Math.min(255, d[idx + 1] + n * 240);
        d[idx + 2] = Math.min(255, d[idx + 2] + n * 200);
      }
    }
    tctx.putImageData(imageData, 0, 0);

    // Tea stains / age spots
    for (let i = 0; i < 12; i++) {
      const sx = Math.random() * tw, sy = Math.random() * th;
      const r = 30 + Math.random() * 80;
      const stain = tctx.createRadialGradient(sx, sy, r * 0.3, sx, sy, r);
      stain.addColorStop(0, "rgba(139,90,43,0.06)");
      stain.addColorStop(0.5, "rgba(139,90,43,0.03)");
      stain.addColorStop(1, "rgba(139,90,43,0)");
      tctx.fillStyle = stain;
      tctx.fillRect(sx - r, sy - r, r * 2, r * 2);
    }

    this._texReady = true;
  }

  // ===== Particles =====
  _initParticles() {
    this._particles = [];
    for (let i = 0; i < 40; i++) {
      this._particles.push({
        x: Math.random() * this.worldW,
        y: Math.random() * this.worldH,
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.12,
        size: 0.8 + Math.random() * 1.5,
        alpha: 0.15 + Math.random() * 0.35,
        phase: Math.random() * Math.PI * 2
      });
    }
  }
  _updateParticles() {
    for (const p of this._particles) {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0) p.x += this.worldW;
      if (p.x > this.worldW) p.x -= this.worldW;
      if (p.y < 0) p.y += this.worldH;
      if (p.y > this.worldH) p.y -= this.worldH;
    }
  }

  // ===== Render Pipeline =====
  render() {
    const ctx = this.ctx, W = this.canvas.width, H = this.canvas.height;
    ctx.clearRect(0, 0, W, H);
    const now = Date.now();

    // L1: Parchment texture
    this._renderParchment(ctx);

    // L2: Grid
    this._renderGrid(ctx);

    // L3: Terrain
    this._renderTerrain(ctx);

    // L4: Region fills
    this._renderRegions(ctx, now);

    // L5: Region borders
    this._renderBorders(ctx, now);

    // L6+L7: Labels + sub-markers
    this._renderLabels(ctx, now);

    // L8: Ocean labels
    this._renderEdgeLabels(ctx);

    // L9: Compass + scale
    this._renderCompass(ctx);

    // L10: Particles
    this._renderParticles(ctx, now);

    // L11: Vignette
    this._renderVignette(ctx);
  }

  _renderParchment(ctx) {
    if (!this._texReady) this._buildTexture();
    if (!this._texCanvas) return;
    // Tile the texture scaled to world
    ctx.save();
    const tw = this._texCanvas.width;
    const th = this._texCanvas.height;
    // Calculate visible world bounds
    const [wl, wt] = this.screenToWorld(0, 0);
    const [wr, wb] = this.screenToWorld(this.canvas.width, this.canvas.height);
    const stepX = tw, stepY = th;
    // Tile in screen space for simplicity (scaling with zoom)
    const ts = tw * 0.5; // tile size in world units mapped visually
    const offsetX = ((this.cx % ts) + ts) % ts;
    const offsetY = ((this.cy % ts) + ts) % ts;
    const tileW = ts * this.scale;
    const tileH = ts * this.scale;
    const ox = -offsetX / ts * tileW;
    const oy = -offsetY / ts * tileH;
    for (let y = oy; y < this.canvas.height; y += tileH) {
      for (let x = ox; x < this.canvas.width; x += tileW) {
        ctx.drawImage(this._texCanvas, x, y, tileW, tileH);
      }
    }
    ctx.restore();
  }

  _renderGrid(ctx) {
    ctx.save();
    ctx.strokeStyle = "#8B7355";
    ctx.lineWidth = 0.3;
    ctx.globalAlpha = 0.07;
    const gs = 80 * this.scale;
    const ox = ((this.cx * this.scale - this.canvas.width / 2) % gs + gs) % gs;
    const oy = ((this.cy * this.scale - this.canvas.height / 2) % gs + gs) % gs;
    for (let x = -ox; x < this.canvas.width; x += gs) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, this.canvas.height); ctx.stroke();
    }
    for (let y = -oy; y < this.canvas.height; y += gs) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.canvas.width, y); ctx.stroke();
    }
    ctx.restore();
  }

  _renderTerrain(ctx) {
    // === Deserts ===
    for (const d of (MAP_TERRAIN.deserts || [])) {
      const pts = this._tx(d.polygon);
      ctx.save();
      ctx.beginPath();
      pts.forEach(([sx, sy], i) => i === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy));
      ctx.closePath();
      ctx.save(); ctx.clip();
      // Sandy fill
      ctx.fillStyle = "rgba(200,170,120,0.25)";
      ctx.fillRect(-100, -100, this.canvas.width + 200, this.canvas.height + 200);
      // Sand dune arcs
      ctx.strokeStyle = "rgba(180,145,90,0.18)";
      ctx.lineWidth = 1;
      const sp = 22;
      for (let x = 0; x < this.canvas.width + sp; x += sp) {
        for (let y = 0; y < this.canvas.height + sp; y += sp) {
          ctx.beginPath();
          ctx.arc(x + Math.sin(y * 0.1) * 6, y + Math.cos(x * 0.08) * 6, 3 + Math.sin(x + y) * 2, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      ctx.restore();
      ctx.restore();
    }

    // === Mountains (shaded peaks) ===
    ctx.save();
    for (const m of (MAP_TERRAIN.mountains || [])) {
      for (let i = 0; i < m.count; i++) {
        const mx = m.cx + (i - m.count / 2) * 24;
        const my = m.cy - Math.abs(i - m.count / 2) * 4;
        const s = 9 + (i % 3) * 4;
        const [sx, sy] = this.worldToScreen(mx, my);
        // Shadow layer (darker, offset)
        ctx.fillStyle = "rgba(80,60,40,0.25)";
        ctx.beginPath();
        ctx.moveTo(sx + 2, sy + 2 - s);
        ctx.lineTo(sx + 2 - s * 0.7, sy + 2 + s * 0.3);
        ctx.lineTo(sx + 2 + s * 0.7, sy + 2 + s * 0.3);
        ctx.closePath(); ctx.fill();
        // Main peak
        const peakGrad = ctx.createLinearGradient(sx, sy - s, sx, sy + s * 0.3);
        peakGrad.addColorStop(0, "rgba(140,115,85,0.5)");
        peakGrad.addColorStop(0.4, "rgba(160,135,100,0.4)");
        peakGrad.addColorStop(1, "rgba(120,95,70,0.45)");
        ctx.fillStyle = peakGrad;
        ctx.strokeStyle = "rgba(100,80,60,0.35)";
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(sx, sy - s);
        ctx.lineTo(sx - s * 0.7, sy + s * 0.3);
        ctx.lineTo(sx + s * 0.7, sy + s * 0.3);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        // Snow cap on taller peaks
        if (i % 3 === 0) {
          ctx.fillStyle = "rgba(240,235,225,0.25)";
          ctx.beginPath();
          ctx.moveTo(sx, sy - s);
          ctx.lineTo(sx - s * 0.18, sy - s * 0.6);
          ctx.lineTo(sx + s * 0.18, sy - s * 0.6);
          ctx.closePath(); ctx.fill();
        }
      }
    }
    ctx.restore();

    // === Forests (layered tree clusters) ===
    ctx.save();
    for (const f of (MAP_TERRAIN.forests || [])) {
      for (let i = 0; i < f.count; i++) {
        const fx = f.cx + Math.sin(i * 2.4) * 40;
        const fy = f.cy + Math.cos(i * 3.1) * 30;
        const [sx, sy] = this.worldToScreen(fx, fy);
        // Tree trunk
        ctx.fillStyle = "rgba(80,55,30,0.2)";
        ctx.fillRect(sx - 1, sy - 2, 2, 6);
        // Canopy: 3 overlapping circles
        ctx.fillStyle = "rgba(45,80,35,0.28)";
        ctx.beginPath(); ctx.arc(sx, sy - 3, 5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(sx - 3, sy - 1, 4, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(sx + 3, sy - 1, 4, 0, Math.PI * 2); ctx.fill();
        // Highlight
        ctx.fillStyle = "rgba(70,110,55,0.2)";
        ctx.beginPath(); ctx.arc(sx, sy - 4, 3, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();

    // === Grasslands ===
    ctx.save();
    ctx.strokeStyle = "rgba(90,130,70,0.22)";
    ctx.lineWidth = 0.7 * this.scale;
    for (const g of (MAP_TERRAIN.grasslands || [])) {
      for (let i = 0; i < g.count; i++) {
        const gx = g.cx + Math.sin(i * 1.7) * 60;
        const gy = g.cy + Math.cos(i * 2.3) * 40;
        const [sx, sy] = this.worldToScreen(gx, gy);
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo(sx - 3, sy - 7, sx - 1, sy - 12);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo(sx + 3, sy - 8, sx + 2, sy - 13);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo(sx, sy - 9, sx - 0.5, sy - 14);
        ctx.stroke();
      }
    }
    ctx.restore();

    // === Rivers ===
    for (const rv of (MAP_TERRAIN.rivers || [])) {
      if (!rv.points || rv.points.length < 2) continue;
      ctx.save();
      ctx.strokeStyle = "rgba(100,140,180,0.4)";
      ctx.lineWidth = (rv.width || 3) * this.scale;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      rv.points.forEach(([px, py], i) => {
        const [sx, sy] = this.worldToScreen(px, py);
        i === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy);
      });
      ctx.stroke();
      // Highlight edge
      ctx.strokeStyle = "rgba(180,210,235,0.12)";
      ctx.lineWidth = (rv.width || 3) * this.scale * 0.4;
      ctx.stroke();
      ctx.restore();
    }
  }

  _tx(poly) {
    return poly.map(([x, y]) => this.worldToScreen(x, y));
  }

  _renderRegions(ctx, now) {
    for (const r of MAP_REGIONS) {
      if (!r.polygon) continue;
      const pts = this._tx(r.polygon);
      ctx.beginPath();
      pts.forEach(([sx, sy], i) => i === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy));
      ctx.closePath();

      let alpha = 0.28;
      if (r.id === this.hoveredRegion || r.id === this.selectedRegion) alpha = 0.5;
      if (this.pulseRegions.has(r.id)) alpha = 0.32 + Math.sin(now / 400) * 0.12;

      // Fill with edge softening
      ctx.save();
      ctx.fillStyle = r.color + Math.round(alpha * 255).toString(16).padStart(2, "0");
      ctx.fill();
      ctx.restore();
    }
  }

  _renderBorders(ctx, now) {
    for (const r of MAP_REGIONS) {
      if (!r.polygon) continue;
      const pts = this._tx(r.polygon);
      ctx.beginPath();
      pts.forEach(([sx, sy], i) => i === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy));
      ctx.closePath();

      const isDark = r.type === "dark" || r.danger === "致命";
      const isRuins = r.type === "ruins";
      const isHovered = r.id === this.hoveredRegion || r.id === this.selectedRegion;

      // Main border
      ctx.save();
      ctx.strokeStyle = r.color;
      ctx.lineWidth = isHovered ? 2.5 : (r.type === "core" || r.type === "dark" ? 2 : 1.2);
      ctx.globalAlpha = isHovered ? 1 : 0.65;
      if (isDark || isRuins) ctx.setLineDash([6, 4]);
      else ctx.setLineDash([]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // Hover glow
      if (isHovered) {
        ctx.save();
        ctx.strokeStyle = "rgba(255,245,210,0.6)";
        ctx.lineWidth = 4;
        ctx.shadowColor = "rgba(212,168,75,0.5)";
        ctx.shadowBlur = 12;
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  _renderLabels(ctx, now) {
    const ls = Math.max(0.5, Math.min(1, this.scale));
    const showSubs = this.scale > 0.7;

    for (const r of MAP_REGIONS) {
      if (!r.polygon) continue;
      let cx = 0, cy = 0;
      for (const [x, y] of r.polygon) { cx += x; cy += y; }
      cx /= r.polygon.length; cy /= r.polygon.length;
      const [sx, sy] = this.worldToScreen(cx, cy);

      // Drop shadow
      ctx.save();
      const fs = r.type === "core" ? 18 : r.type === "continent" ? 14 : r.type === "empire" ? 11 : r.type === "sanctuary" ? 8 : 9;
      ctx.font = "bold " + (fs * ls) + 'px "Noto Serif SC", "SimSun", serif';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "rgba(0,0,0,0.15)";
      ctx.fillText(r.name, sx + 1, sy + 1);

      // Main text
      ctx.fillStyle = r.type === "dark" ? "#d0c0c0" : "#3D2B1F";
      ctx.fillText(r.name, sx, sy);

      // Faction subtitle on high zoom
      if (this.scale > 1.2) {
        ctx.globalAlpha = 0.45;
        ctx.font = (fs * 0.55) + 'px "Noto Serif SC", "SimSun", serif';
        const sub = r.factions.length > 20 ? r.factions.slice(0, 20) + "…" : r.factions;
        ctx.fillText(sub, sx, sy + fs + 3);
      }
      ctx.restore();

      // Sub-location markers
      if (showSubs) {
        const subs = MAP_SUB_LOCATIONS[r.id] || [];
        for (const s of subs) {
          const [ssx, ssy] = this.worldToScreen(s.pos[0], s.pos[1]);
          const pulse = Math.sin(now / 800 + s.pos[0] * 0.01) * 0.25 + 0.75;

          // Outer glow ring
          ctx.beginPath();
          ctx.arc(ssx, ssy, 5 * pulse, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(255,255,220,0.2)";
          ctx.fill();

          // Diamond marker
          ctx.save();
          ctx.translate(ssx, ssy);
          ctx.rotate(Math.PI / 4);
          const sz = 3 * pulse;
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(-sz, -sz, sz * 2, sz * 2);
          ctx.strokeStyle = r.color;
          ctx.lineWidth = 1;
          ctx.strokeRect(-sz, -sz, sz * 2, sz * 2);
          // Inner dot
          ctx.fillStyle = r.color;
          ctx.fillRect(-1, -1, 2, 2);
          ctx.restore();

          // Name on high zoom
          if (this.scale > 1.5) {
            ctx.save();
            ctx.font = '8px "Noto Serif SC", serif';
            ctx.fillStyle = "#3D2B1F";
            ctx.textAlign = "left";
            ctx.textBaseline = "middle";
            ctx.fillText(s.name, ssx + 6, ssy + 1);
            ctx.restore();
          }
        }
      }
    }
  }

  _renderEdgeLabels(ctx) {
    ctx.save();
    ctx.font = 'italic 12px "Noto Serif SC", serif';
    ctx.fillStyle = "#7B6345";
    ctx.globalAlpha = 0.35;
    ctx.textAlign = "center";
    for (const o of (MAP_TERRAIN.oceans || [])) {
      const [sx, sy] = this.worldToScreen(o.x, o.y);
      ctx.fillText(o.name, sx, sy);
    }
    ctx.restore();
  }

  _renderCompass(ctx) {
    // Compass rose — top-right corner
    const cx = this.canvas.width - 50;
    const cy = 50;
    const s = 18;
    ctx.save();
    ctx.translate(cx, cy);

    // Outer ring
    ctx.beginPath();
    ctx.arc(0, 0, s + 4, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(60,40,20,0.25)";
    ctx.fill();
    ctx.strokeStyle = "rgba(100,70,40,0.5)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Inner circle
    ctx.beginPath();
    ctx.arc(0, 0, s, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(245,235,210,0.7)";
    ctx.fill();

    // N arrow
    ctx.fillStyle = "rgba(180,40,40,0.85)";
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.lineTo(-4, 2);
    ctx.lineTo(0, -2);
    ctx.lineTo(4, 2);
    ctx.closePath();
    ctx.fill();

    // S arrow
    ctx.fillStyle = "rgba(80,60,40,0.6)";
    ctx.beginPath();
    ctx.moveTo(0, s);
    ctx.lineTo(-4, -2);
    ctx.lineTo(0, 2);
    ctx.lineTo(4, -2);
    ctx.closePath();
    ctx.fill();

    // "N" label
    ctx.fillStyle = "#8B3A3A";
    ctx.font = 'bold 11px "Noto Serif SC", serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText("北", 0, -s - 4);

    ctx.restore();

    // Scale bar — bottom-left
    const sbx = 30;
    const sby = this.canvas.height - 24;
    const barW = 60;
    ctx.save();
    ctx.strokeStyle = "rgba(60,40,20,0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sbx, sby);
    ctx.lineTo(sbx + barW, sby);
    ctx.stroke();
    // Ticks
    for (let i = 0; i <= 2; i++) {
      const tx = sbx + (barW / 2) * i;
      ctx.beginPath();
      ctx.moveTo(tx, sby - 4);
      ctx.lineTo(tx, sby + 4);
      ctx.stroke();
    }
    ctx.font = '8px "Noto Serif SC", serif';
    ctx.fillStyle = "rgba(60,40,20,0.5)";
    ctx.textAlign = "center";
    ctx.fillText("≈800里", sbx + barW / 2, sby + 14);
    ctx.restore();
  }

  _renderParticles(ctx, now) {
    this._updateParticles();
    ctx.save();
    for (const p of this._particles) {
      const [sx, sy] = this.worldToScreen(p.x, p.y);
      if (sx < -10 || sx > this.canvas.width + 10 || sy < -10 || sy > this.canvas.height + 10) continue;
      const alpha = p.alpha * (0.6 + 0.4 * Math.sin(now / 1500 + p.phase));
      const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, p.size * 2);
      grad.addColorStop(0, "rgba(212,168,75," + alpha + ")");
      grad.addColorStop(1, "rgba(212,168,75,0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(sx, sy, p.size * 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  _renderVignette(ctx) {
    const W = this.canvas.width, H = this.canvas.height;
    const grad = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.55, W / 2, H / 2, Math.max(W, H) * 0.75);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(20,12,5,0.22)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  // ===== Events =====
  _bindEvents() {
    this.canvas.addEventListener("wheel", e => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      this.zoom(e.deltaY, e.clientX - rect.left, e.clientY - rect.top);
    }, { passive: false });

    this.canvas.addEventListener("mousedown", e => {
      this.dragging = true;
      this.dragStart = [e.clientX, e.clientY];
      this.dragCx = this.cx;
      this.dragCy = this.cy;
      this.canvas.style.cursor = "grabbing";
    });

    window.addEventListener("mouseup", e => {
      if (!this.dragging) return;
      const dx = e.clientX - this.dragStart[0], dy = e.clientY - this.dragStart[1];
      this.dragging = false;
      this.canvas.style.cursor = "default";
      if (Math.sqrt(dx * dx + dy * dy) < 5) {
        const rect = this.canvas.getBoundingClientRect();
        const [wx, wy] = this.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
        if (this.hoveredRegion) {
          const subHit = this.hitTestSub(wx, wy, this.hoveredRegion);
          if (subHit) { this.onSubClick(this.hoveredRegion, subHit.index, subHit.sub); return; }
        }
        const hit = this.hitTestRegion(wx, wy);
        if (hit) { this.selectedRegion = hit.id; this.onRegionClick(hit.id); }
      }
    });

    this.canvas.addEventListener("mousemove", e => {
      if (this.dragging) {
        const dx = e.clientX - this.dragStart[0], dy = e.clientY - this.dragStart[1];
        this.cx = this.dragCx; this.cy = this.dragCy;
        this.pan(-dx, -dy);
        return;
      }
      const rect = this.canvas.getBoundingClientRect();
      const [wx, wy] = this.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
      const prev = this.hoveredRegion;
      const hit = this.hitTestRegion(wx, wy);
      this.hoveredRegion = hit ? hit.id : null;
      if (this.hoveredRegion !== prev) {
        this.onHoverChange(this.hoveredRegion);
        this.canvas.style.cursor = this.hoveredRegion ? "pointer" : "default";
      }
    });

    // Touch
    this.canvas.addEventListener("touchstart", e => {
      if (e.touches.length === 1) {
        this.dragging = true;
        this.dragStart = [e.touches[0].clientX, e.touches[0].clientY];
        this.dragCx = this.cx; this.dragCy = this.cy;
      }
      this._lastPinchDist = e.touches.length === 2
        ? Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY) : 0;
    }, { passive: false });
    this.canvas.addEventListener("touchmove", e => {
      e.preventDefault();
      if (e.touches.length === 1 && this.dragging) {
        this.cx = this.dragCx; this.cy = this.dragCy;
        this.pan(-(e.touches[0].clientX - this.dragStart[0]), -(e.touches[0].clientY - this.dragStart[1]));
      } else if (e.touches.length === 2) {
        const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        if (this._lastPinchDist > 0) {
          const rect = this.canvas.getBoundingClientRect();
          const mx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
          const my = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
          this.zoom(d - this._lastPinchDist, mx, my);
        }
        this._lastPinchDist = d;
      }
    }, { passive: false });
    this.canvas.addEventListener("touchend", () => { this.dragging = false; });
    window.addEventListener("resize", () => this._resize());
  }

  _resize() {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    const w = rect.width || 800, h = rect.height || 500;
    this.canvas.width = w * this.dpr;
    this.canvas.height = h * this.dpr;
    this.canvas.style.width = w + "px";
    this.canvas.style.height = h + "px";
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  _startRenderLoop() {
    const loop = () => {
      if (this.canvas.width === 0 || this.canvas.height === 0) this._resize();
      this._animate();
      this.render();
      this._raf = requestAnimationFrame(loop);
    };
    loop();
  }

  setPulseRegions(ids) { this.pulseRegions = new Set(ids); }
  destroy() { cancelAnimationFrame(this._raf); }
}
