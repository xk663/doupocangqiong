/**
 * 斗气大陆地图 Canvas 引擎
 * Viewport transforms + 9-layer render pipeline + interaction
 */

class MapEngine {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = window.devicePixelRatio || 1;

    // World dimensions
    this.worldW = 1200;
    this.worldH = 800;

    // Viewport state
    this.cx = this.worldW / 2;  // viewport center X (world coords)
    this.cy = this.worldH / 2;  // viewport center Y (world coords)
    this.scale = 1;             // zoom level

    // Interaction state
    this.dragging = false;
    this.dragStart = null;
    this.dragCx = 0;
    this.dragCy = 0;
    this.hoveredRegion = null;
    this.hoveredSub = null;
    this.selectedRegion = null;
    this.animTarget = null;     // fly-to animation target
    this.pulseRegions = new Set(); // regions with energy pulse

    // Callbacks
    this.onRegionClick = options.onRegionClick || (() => {});
    this.onSubClick = options.onSubClick || (() => {});
    this.onHoverChange = options.onHoverChange || (() => {});

    this._bindEvents();
    this._resize();
    this._startRenderLoop();
  }

  // ========== Coordinate Transforms ==========
  worldToScreen(wx, wy) {
    const sx = (wx - this.cx) * this.scale + this.canvas.width / 2;
    const sy = (wy - this.cy) * this.scale + this.canvas.height / 2;
    return [sx, sy];
  }
  screenToWorld(sx, sy) {
    const wx = (sx - this.canvas.width / 2) / this.scale + this.cx;
    const wy = (sy - this.canvas.height / 2) / this.scale + this.cy;
    return [wx, wy];
  }

  // ========== Zoom / Pan ==========
  zoom(delta, mx, my) {
    const [wx, wy] = this.screenToWorld(mx, my);
    const factor = delta > 0 ? 1.15 : 1 / 1.15;
    const newScale = Math.max(0.4, Math.min(4, this.scale * factor));
    this.cx = wx - (mx - this.canvas.width / 2) / newScale;
    this.cy = wy - (my - this.canvas.height / 2) / newScale;
    this.scale = newScale;
  }
  pan(dx, dy) {
    this.cx -= dx / this.scale;
    this.cy -= dy / this.scale;
  }
  resetView() {
    this.animTarget = { cx: this.worldW / 2, cy: this.worldH / 2, scale: 1 };
  }
  flyTo(wx, wy, targetScale = 2) {
    this.animTarget = { cx: wx, cy: wy, scale: targetScale };
  }

  // ========== Hit Testing ==========
  _pointInPolygon(px, py, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i][0], yi = polygon[i][1];
      const xj = polygon[j][0], yj = polygon[j][1];
      if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) {
        inside = !inside;
      }
    }
    return inside;
  }
  hitTestRegion(wx, wy) {
    // Reverse order so smaller regions (drawn later) are hit first
    for (let i = MAP_REGIONS.length - 1; i >= 0; i--) {
      const r = MAP_REGIONS[i];
      if (r.polygon && this._pointInPolygon(wx, wy, r.polygon)) {
        return r;
      }
    }
    return null;
  }
  hitTestSub(wx, wy, regionId) {
    const subs = MAP_SUB_LOCATIONS[regionId] || [];
    const threshold = 8 / this.scale;
    for (let i = 0; i < subs.length; i++) {
      const s = subs[i];
      const dx = wx - s.pos[0];
      const dy = wy - s.pos[1];
      if (Math.sqrt(dx * dx + dy * dy) < threshold) {
        return { sub: s, index: i };
      }
    }
    return null;
  }

  // ========== Animation ==========
  _animate() {
    if (!this.animTarget) return false;
    const t = this.animTarget;
    const speed = 0.12;
    this.cx += (t.cx - this.cx) * speed;
    this.cy += (t.cy - this.cy) * speed;
    this.scale += (t.scale - this.scale) * speed;
    if (Math.abs(t.cx - this.cx) < 0.5 &&
        Math.abs(t.cy - this.cy) < 0.5 &&
        Math.abs(t.scale - this.scale) < 0.005) {
      this.cx = t.cx;
      this.cy = t.cy;
      this.scale = t.scale;
      this.animTarget = null;
      return false;
    }
    return true;
  }

  // ========== Render Pipeline ==========
  render() {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Layer 1: Background (parchment)
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#f5ead0');
    grad.addColorStop(0.5, '#efe0c0');
    grad.addColorStop(1, '#ead8b0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Layer 2: Grid
    ctx.save();
    ctx.strokeStyle = '#8B7355';
    ctx.lineWidth = 0.25;
    ctx.globalAlpha = 0.08;
    const gridSize = 80 * this.scale;
    const offsetX = ((this.cx * this.scale - W / 2) % gridSize + gridSize) % gridSize;
    const offsetY = ((this.cy * this.scale - H / 2) % gridSize + gridSize) % gridSize;
    for (let x = -offsetX; x < W; x += gridSize) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = -offsetY; y < H; y += gridSize) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    ctx.restore();

    // Layer 3: Terrain features
    this._renderTerrain(ctx);

    // Layer 4: Region fills
    this._renderRegions(ctx);

    // Layer 5: Region borders
    this._renderBorders(ctx);

    // Layer 6 & 7: Labels & sub-location markers
    this._renderLabels(ctx);

    // Layer 8: Ocean/edge labels
    this._renderEdgeLabels(ctx);
  }

  _tx(polygon) {
    return polygon.map(([x, y]) => this.worldToScreen(x, y));
  }

  _renderTerrain(ctx) {
    // Desert dots
    for (const d of (MAP_TERRAIN.deserts || [])) {
      const pts = this._tx(d.polygon);
      ctx.save();
      ctx.fillStyle = '#b8954a';
      ctx.globalAlpha = 0.15;
      // Draw textured dots via clipping
      ctx.beginPath();
      pts.forEach(([sx, sy], i) => i === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy));
      ctx.closePath();
      ctx.save(); ctx.clip();
      const spacing = 16;
      for (let x = -this.cx % spacing * this.scale; x < this.canvas.width + spacing; x += spacing) {
        for (let y = -this.cy % spacing * this.scale; y < this.canvas.height + spacing; y += spacing) {
          ctx.beginPath();
          ctx.arc(x + (y % 32 === 0 ? 4 : -2), y + (x % 32 === 0 ? 3 : -3), 0.8, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
      ctx.restore();
    }
    // Mountain triangles
    ctx.save();
    ctx.strokeStyle = '#6b5040';
    ctx.fillStyle = '#8b6a50';
    ctx.globalAlpha = 0.35;
    for (const m of (MAP_TERRAIN.mountains || [])) {
      for (let i = 0; i < m.count; i++) {
        const mx = m.cx + (i - m.count / 2) * 24;
        const my = m.cy - Math.abs(i - m.count / 2) * 4;
        const s = 8 + (i % 3) * 3;
        const [sx, sy] = this.worldToScreen(mx, my);
        ctx.beginPath();
        ctx.moveTo(sx, sy - s);
        ctx.lineTo(sx - s * 0.7, sy + s * 0.3);
        ctx.lineTo(sx + s * 0.7, sy + s * 0.3);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }
    ctx.restore();
    // Forest clusters
    ctx.save();
    ctx.fillStyle = '#3d6030';
    ctx.globalAlpha = 0.2;
    for (const f of (MAP_TERRAIN.forests || [])) {
      for (let i = 0; i < f.count; i++) {
        const fx = f.cx + (Math.sin(i * 2.4) * 40);
        const fy = f.cy + (Math.cos(i * 3.1) * 30);
        const [sx, sy] = this.worldToScreen(fx, fy);
        ctx.beginPath(); ctx.arc(sx, sy, 3.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(sx - 3, sy - 2, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(sx + 3, sy - 1, 2.5, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
    // Grassland
    ctx.save();
    ctx.strokeStyle = '#5a8a4a';
    ctx.globalAlpha = 0.2;
    ctx.lineWidth = 0.8 * this.scale;
    for (const g of (MAP_TERRAIN.grasslands || [])) {
      for (let i = 0; i < g.count; i++) {
        const gx = g.cx + (Math.sin(i * 1.7) * 60);
        const gy = g.cy + (Math.cos(i * 2.3) * 40);
        const [sx, sy] = this.worldToScreen(gx, gy);
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo(sx - 3, sy - 6, sx - 1, sy - 10);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo(sx + 3, sy - 7, sx + 2, sy - 11);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  _renderRegions(ctx) {
    const now = Date.now();
    for (const r of MAP_REGIONS) {
      if (!r.polygon) continue;
      const pts = this._tx(r.polygon);
      ctx.beginPath();
      pts.forEach(([sx, sy], i) => i === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy));
      ctx.closePath();

      // Fill
      let alpha = 0.22;
      if (r.id === this.hoveredRegion || r.id === this.selectedRegion) alpha = 0.4;
      if (this.pulseRegions.has(r.id)) {
        alpha = 0.28 + Math.sin(now / 400) * 0.12;
      }
      ctx.fillStyle = r.color + Math.round(alpha * 255).toString(16).padStart(2, '0');
      ctx.fill();
    }
  }

  _renderBorders(ctx) {
    for (const r of MAP_REGIONS) {
      if (!r.polygon) continue;
      const pts = this._tx(r.polygon);
      ctx.beginPath();
      pts.forEach(([sx, sy], i) => i === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy));
      ctx.closePath();

      const isDark = r.type === 'dark' || r.danger === '致命';
      const isRuins = r.type === 'ruins';
      const isHovered = r.id === this.hoveredRegion || r.id === this.selectedRegion;

      ctx.strokeStyle = r.color;
      ctx.lineWidth = isHovered ? 3 : (r.type === 'core' || r.type === 'dark' ? 2.2 : 1.4);
      ctx.globalAlpha = isHovered ? 1 : 0.7;
      if (isDark || isRuins) ctx.setLineDash([6, 4]);
      else ctx.setLineDash([]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      // Hover glow
      if (isHovered) {
        ctx.strokeStyle = 'rgba(255,255,200,0.5)';
        ctx.lineWidth = 5;
        ctx.stroke();
      }
    }
  }

  _renderLabels(ctx) {
    const labelScale = Math.max(0.5, Math.min(1, this.scale));
    const showSubs = this.scale > 0.7;

    for (const r of MAP_REGIONS) {
      if (!r.polygon) continue;
      // Region centroid
      let cx = 0, cy = 0;
      for (const [x, y] of r.polygon) { cx += x; cy += y; }
      cx /= r.polygon.length;
      cy /= r.polygon.length;
      const [sx, sy] = this.worldToScreen(cx, cy);

      // Region name
      const fontSize = r.type === 'core' ? 18 : r.type === 'continent' ? 14 : r.type === 'empire' ? 11 : r.type === 'sanctuary' ? 8 : 9;
      ctx.save();
      ctx.font = `bold ${fontSize * labelScale}px "Noto Serif SC", serif`;
      ctx.fillStyle = r.type === 'dark' ? '#d0c0c0' : '#3D2B1F';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(r.name, sx, sy);
      if (this.scale > 1.2) {
        ctx.globalAlpha = 0.5;
        ctx.font = `${fontSize * 0.6}px "Noto Serif SC", serif`;
        ctx.fillText(r.factions.slice(0, 20) + (r.factions.length > 20 ? '…' : ''), sx, sy + fontSize + 4);
      }
      ctx.restore();

      // Sub-location markers
      if (showSubs) {
        const subs = MAP_SUB_LOCATIONS[r.id] || [];
        for (const s of subs) {
          const [ssx, ssy] = this.worldToScreen(s.pos[0], s.pos[1]);
          // Pulsing dot
          const pulse = Math.sin(Date.now() / 1000 + s.pos[0] * 0.01) * 0.3 + 0.7;
          ctx.beginPath();
          ctx.arc(ssx, ssy, 3.5 * pulse, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
          ctx.beginPath();
          ctx.arc(ssx, ssy, 2, 0, Math.PI * 2);
          ctx.fillStyle = r.color;
          ctx.fill();
          // Name
          if (this.scale > 1.5) {
            ctx.font = `8px "Noto Serif SC", serif`;
            ctx.fillStyle = '#3D2B1F';
            ctx.textAlign = 'left';
            ctx.fillText(s.name, ssx + 5, ssy + 3);
          }
        }
      }
    }
  }

  _renderEdgeLabels(ctx) {
    ctx.save();
    ctx.font = 'italic 12px "Noto Serif SC", serif';
    ctx.fillStyle = '#8B7355';
    ctx.globalAlpha = 0.3;
    ctx.textAlign = 'center';
    for (const o of (MAP_TERRAIN.oceans || [])) {
      const [sx, sy] = this.worldToScreen(o.x, o.y);
      ctx.fillText(o.name, sx, sy);
    }
    ctx.restore();
  }

  // ========== Event Handling ==========
  _bindEvents() {
    this.canvas.addEventListener('wheel', e => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      this.zoom(e.deltaY, e.clientX - rect.left, e.clientY - rect.top);
    }, { passive: false });

    this.canvas.addEventListener('mousedown', e => {
      this.dragging = true;
      this.dragStart = [e.clientX, e.clientY];
      this.dragCx = this.cx;
      this.dragCy = this.cy;
      this.canvas.style.cursor = 'grabbing';
    });

    window.addEventListener('mouseup', e => {
      if (!this.dragging) return;
      const dx = e.clientX - this.dragStart[0];
      const dy = e.clientY - this.dragStart[1];
      const dist = Math.sqrt(dx * dx + dy * dy);
      this.dragging = false;
      this.canvas.style.cursor = 'default';
      if (dist < 5) {
        // It's a click
        const rect = this.canvas.getBoundingClientRect();
        const [wx, wy] = this.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
        // Check sub-locations first
        if (this.hoveredRegion) {
          const subHit = this.hitTestSub(wx, wy, this.hoveredRegion);
          if (subHit) {
            this.onSubClick(this.hoveredRegion, subHit.index, subHit.sub);
            return;
          }
        }
        const hit = this.hitTestRegion(wx, wy);
        if (hit) {
          this.selectedRegion = hit.id;
          this.onRegionClick(hit.id);
        }
      }
    });

    this.canvas.addEventListener('mousemove', e => {
      if (this.dragging) {
        const dx = e.clientX - this.dragStart[0];
        const dy = e.clientY - this.dragStart[1];
        this.cx = this.dragCx;
        this.cy = this.dragCy;
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
        this.canvas.style.cursor = this.hoveredRegion ? 'pointer' : 'default';
      }
    });

    // Touch support
    this.canvas.addEventListener('touchstart', e => {
      if (e.touches.length === 1) {
        this.dragging = true;
        this.dragStart = [e.touches[0].clientX, e.touches[0].clientY];
        this.dragCx = this.cx;
        this.dragCy = this.cy;
      }
      this._lastPinchDist = e.touches.length === 2
        ? Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY)
        : 0;
    }, { passive: false });
    this.canvas.addEventListener('touchmove', e => {
      e.preventDefault();
      if (e.touches.length === 1 && this.dragging) {
        this.cx = this.dragCx;
        this.cy = this.dragCy;
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
    this.canvas.addEventListener('touchend', () => { this.dragging = false; });

    window.addEventListener('resize', () => this._resize());
  }

  _resize() {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    const w = rect.width || 800;
    const h = rect.height || 500;
    this.canvas.width = w * this.dpr;
    this.canvas.height = h * this.dpr;
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  _startRenderLoop() {
    const loop = () => {
      if (this.canvas.width === 0 || this.canvas.height === 0) {
        this._resize();
      }
      this._animate();
      this.render();
      this._raf = requestAnimationFrame(loop);
    };
    loop();
  }

  // ========== Public API ==========
  setPulseRegions(ids) { this.pulseRegions = new Set(ids); }
  destroy() { cancelAnimationFrame(this._raf); }
}
