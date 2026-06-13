# 斗破苍穹 · 修炼模拟 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-file HTML/CSS/JS cultivation game SPA with title screen, character creation wizard, and 3-page game world.

**Architecture:** Single `index.html` containing all HTML views (as hidden div containers), embedded CSS with design tokens, and embedded JS for state management, view switching, and character creation logic. Zero external dependencies beyond Google Fonts.

**Tech Stack:** HTML5 + CSS3 (custom properties, flexbox, grid, animations) + Vanilla JS (ES6+)

**Output File:** `C:\Users\Administrator\index.html`

---

## File Structure

| File | Responsibility |
|------|---------------|
| `index.html` | Entire application: HTML views, CSS design system & animations, JS state machine & game logic |

**Internal organization of `index.html`:**
- `<style>` block: CSS custom properties → reset → typography → layout → components → animations → utilities
- `<body>` block: Title screen → Character creation views → Game views → Modals → Notifications container → LLM panel
- `<script>` block: GameState class → View controller → Character creator → Game data → Event handlers → Animations

---

### Task 1: HTML Skeleton + CSS Design System

**Files:**
- Create: `C:\Users\Administrator\index.html`

- [ ] **Step 1: Write the complete HTML skeleton with all view containers**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>斗破苍穹 · 修炼模拟</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;700&family=Noto+Serif+SC:wght@400;600;700;900&display=swap" rel="stylesheet">
<style>
/* === CSS Custom Properties === */
:root {
  --bg-deep: #050508;
  --bg-panel: #0a0a12;
  --bg-card: #0d0d18;
  --bg-hover: #111122;
  --border-subtle: #1a1a2e;
  --border-gold: #d4a84b44;
  --border-gold-bright: #d4a84b88;
  --text-primary: #d4a84b;
  --text-secondary: #887744;
  --text-body: #aaa;
  --text-muted: #665533;
  --text-dim: #444;
  --accent-fire: #ff6b35;
  --accent-purple: #c084fc;
  --accent-green: #88cc88;
  --accent-blue: #4488ff;
  --accent-ice: #88cccc;
  --accent-thunder: #cccc44;
  --accent-light: #ccaa44;
  --accent-dark: #886688;
  --accent-metal: #ccaa44;
  --accent-poison: #88aa44;
  --accent-space: #ccaadd;
  --font-serif: 'Noto Serif SC', serif;
  --font-sans: 'Noto Sans SC', sans-serif;
  --sidebar-width: 72px;
  --transition-fast: 150ms ease-out;
  --transition-normal: 250ms ease-out;
  --transition-slow: 400ms ease-out;
  --shadow-card: 0 2px 8px rgba(0,0,0,0.4);
  --shadow-gold: 0 0 20px rgba(212,168,75,0.15);
  --z-sidebar: 100;
  --z-modal: 200;
  --z-toast: 300;
  --z-llm: 250;
}
/* === Reset === */
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;overflow:hidden}
body{font-family:var(--font-sans);background:var(--bg-deep);color:var(--text-body);font-size:14px;line-height:1.6;-webkit-font-smoothing:antialiased}
button{border:none;outline:none;cursor:pointer;font-family:inherit}
input,textarea,select{font-family:inherit;outline:none}
::-webkit-scrollbar{width:4px}
::-webkit-scrollbar-track{background:var(--bg-deep)}
::-webkit-scrollbar-thumb{background:var(--text-muted);border-radius:2px}
/* === Typography === */
h1,h2,h3,h4{font-family:var(--font-serif);color:var(--text-primary);font-weight:600}
.serif{font-family:var(--font-serif)}
.text-gold{color:var(--text-primary)}
.text-muted{color:var(--text-muted)}
.text-body{color:var(--text-body)}
/* === View Container Base === */
.view{position:absolute;top:0;left:0;width:100%;height:100%;display:none;overflow:hidden}
.view.active{display:flex}
</style>
</head>
<body>

<!-- VIEW: Title Screen -->
<div id="view-title" class="view active" style="flex-direction:column;align-items:center;justify-content:center;background:radial-gradient(ellipse at center,#0f0f1a 0%,#050508 60%);">
</div>

<!-- VIEW: Character Creation -->
<div id="view-creation" class="view" style="flex-direction:column;">
</div>

<!-- VIEW: Game World -->
<div id="view-game" class="view">
  <!-- Sidebar -->
  <nav id="game-sidebar"></nav>
  <!-- Main content area -->
  <div id="game-main" style="flex:1;position:relative;">
    <!-- Sub-view: World Map -->
    <div id="game-view-worldmap" class="game-subview active"></div>
    <!-- Sub-view: Studio -->
    <div id="game-view-studio" class="game-subview"></div>
    <!-- Sub-view: Personnel -->
    <div id="game-view-personnel" class="game-subview"></div>
  </div>
</div>

<!-- MODALS container -->
<div id="modals-container"></div>

<!-- NOTIFICATIONS container -->
<div id="notifications-container" style="position:fixed;top:16px;right:16px;z-index:var(--z-toast);display:flex;flex-direction:column;gap:8px;pointer-events:none;"></div>

<!-- LLM Chat Panel -->
<div id="llm-panel"></div>

<script>
// === Game State ===
const GameState = {
  phase: 'title', // 'title' | 'creation' | 'game'
  player: {
    name: '', gender: '', age: 18,
    difficulty: '', points: 0, pointsSpent: 0,
    race: '', identity: '',
    baseStats: { strength: 0, agility: 0, endurance: 0, douqi: 0, soul: 0, speed: 0 },
    performanceStats: {},
    talents: [],
    douqiAttributes: []
  },
  settings: {
    apis: [],
    activeApi: null,
    systemRules: '',
    useCustomRules: false
  }
};

// === View Controller ===
function showView(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(viewId).classList.add('active');
}
</script>
</body>
</html>
```

- [ ] **Step 2: Verify file loads in browser**

Open `C:\Users\Administrator\index.html` in browser. Should see a dark blank page with no errors.

---

### Task 2: Title Screen — Full Visual + Menu

**Files:**
- Modify: `C:\Users\Administrator\index.html` (title screen view + title CSS + particle JS)

- [ ] **Step 1: Add title screen CSS and HTML**

Replace the empty `#view-title` div with the full title screen:

```html
<div id="view-title" class="view active" style="flex-direction:column;align-items:center;justify-content:center;background:radial-gradient(ellipse at center,#0f0f1a 0%,#050508 60%);position:relative;">
  <canvas id="title-particles" style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;"></canvas>
  <div style="position:relative;z-index:2;text-align:center;">
    <div style="margin-bottom:8px;">
      <svg width="64" height="64" viewBox="0 0 64 64" style="display:block;margin:0 auto 12px;">
        <path d="M32 4 C32 4 12 20 12 36 C12 47 21 56 32 56 C43 56 52 47 52 36 C52 20 32 4 32 4Z" fill="none" stroke="#d4a84b" stroke-width="1.5"/>
        <path d="M32 14 C32 14 18 26 18 36 C18 44 24 50 32 50 C40 50 46 44 46 36 C46 26 32 14 32 14Z" fill="none" stroke="#d4a84b" stroke-width="1" opacity="0.6"/>
        <circle cx="32" cy="32" r="4" fill="#d4a84b" opacity="0.8"/>
        <circle cx="32" cy="32" r="2" fill="#ff6b35"/>
      </svg>
    </div>
    <h1 style="font-family:var(--font-serif);font-size:52px;font-weight:900;color:var(--text-primary);letter-spacing:16px;text-shadow:0 0 40px rgba(212,168,75,0.3);margin-bottom:4px;">斗 破 苍 穹</h1>
    <p style="font-family:var(--font-serif);font-size:14px;color:var(--text-secondary);letter-spacing:6px;margin-bottom:48px;">修 炼 模 拟 · 大 世 界 · 自 由 探 索</p>
    <div id="title-menu" style="display:flex;flex-direction:column;gap:10px;align-items:center;">
      <button id="btn-new-game" class="title-btn primary" onclick="startNewGame()">开 启 新 人 生</button>
      <button id="btn-continue" class="title-btn" onclick="continueGame()">继 续 人 生</button>
      <button id="btn-changelog" class="title-btn" onclick="openChangelog()">更 新 日 志</button>
      <button id="btn-settings" class="title-btn" onclick="openSettings()">设 置</button>
      <button id="btn-about" class="title-btn" onclick="openAbout()">关 于</button>
    </div>
    <p style="font-family:var(--font-serif);font-size:10px;color:var(--text-dim);margin-top:40px;letter-spacing:2px;">v0.1.0 · 三一六纪元 · 斗气大陆</p>
  </div>
</div>
```

- [ ] **Step 2: Add title screen CSS (in `<style>` block)**

```css
/* === Title Screen === */
.title-btn {
  width: 240px;
  padding: 12px 0;
  background: transparent;
  border: 1px solid var(--border-subtle);
  color: var(--text-body);
  font-family: var(--font-serif);
  font-size: 15px;
  letter-spacing: 4px;
  transition: all var(--transition-normal);
  position: relative;
  overflow: hidden;
}
.title-btn::before {
  content: '';
  position: absolute;
  top: 0; left: -100%;
  width: 100%; height: 100%;
  background: linear-gradient(90deg, transparent, rgba(212,168,75,0.05), transparent);
  transition: left 0.5s ease;
}
.title-btn:hover::before { left: 100%; }
.title-btn:hover {
  border-color: var(--border-gold-bright);
  color: var(--text-primary);
  box-shadow: var(--shadow-gold);
}
.title-btn.primary {
  border-color: var(--border-gold);
  color: var(--text-primary);
}
.title-btn.primary:hover {
  border-color: var(--text-primary);
  box-shadow: 0 0 30px rgba(212,168,75,0.25);
}
```

- [ ] **Step 3: Add particle canvas JS**

```javascript
function initTitleParticles() {
  const canvas = document.getElementById('title-particles');
  const ctx = canvas.getContext('2d');
  let particles = [];
  function resize() {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
  }
  resize();
  window.addEventListener('resize', resize);
  for (let i = 0; i < 60; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.5 + 0.5,
      vx: (Math.random() - 0.5) * 0.3,
      vy: -Math.random() * 0.5 - 0.1,
      opacity: Math.random() * 0.6 + 0.2
    });
  }
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      if (p.y < -10) { p.y = canvas.height + 10; p.x = Math.random() * canvas.width; }
      if (p.x < -10 || p.x > canvas.width + 10) { p.x = Math.random() * canvas.width; }
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(212,168,75,${p.opacity})`;
      ctx.fill();
    });
    requestAnimationFrame(animate);
  }
  animate();
}
document.addEventListener('DOMContentLoaded', initTitleParticles);
```

- [ ] **Step 4: Verify title screen renders**

Open in browser. Should see the full title screen with 斗破苍穹 logo, 5 menu buttons, floating gold particles, and version text.

---

### Task 3: Character Creation — Step Indicator + Step 0 (Basic Info + Difficulty)

**Files:**
- Modify: `C:\Users\Administrator\index.html` (creation view + creation CSS + step 0 JS)

- [ ] **Step 1: Add creation view HTML skeleton**

Replace the empty `#view-creation` div:

```html
<div id="view-creation" class="view" style="flex-direction:column;background:var(--bg-deep);">
  <!-- Step indicator -->
  <div id="creation-steps" style="display:flex;justify-content:center;gap:0;padding:20px 0 0;position:relative;z-index:2;">
    <div class="step-indicator active" data-step="0"><span class="step-num">零</span><span class="step-label">基础</span></div>
    <div class="step-line"></div>
    <div class="step-indicator" data-step="1"><span class="step-num">壹</span><span class="step-label">种族</span></div>
    <div class="step-line"></div>
    <div class="step-indicator" data-step="2"><span class="step-num">贰</span><span class="step-label">身份</span></div>
    <div class="step-line"></div>
    <div class="step-indicator" data-step="3"><span class="step-num">叁</span><span class="step-label">数值</span></div>
    <div class="step-line"></div>
    <div class="step-indicator" data-step="4"><span class="step-num">肆</span><span class="step-label">天赋</span></div>
  </div>
  <!-- Points display -->
  <div id="creation-points-bar" style="text-align:center;padding:12px;position:relative;z-index:2;">
    <span style="font-family:var(--font-serif);color:var(--text-muted);">可用点数：</span>
    <span id="creation-points-value" style="font-family:var(--font-serif);font-size:28px;color:var(--accent-green);">100</span>
  </div>
  <!-- Step content container -->
  <div id="creation-content" style="flex:1;overflow-y:auto;padding:0 48px 20px;position:relative;z-index:2;"></div>
  <!-- Bottom navigation -->
  <div id="creation-nav" style="display:flex;justify-content:center;gap:20px;padding:16px;border-top:1px solid var(--border-subtle);position:relative;z-index:2;">
    <button id="creation-prev" class="creation-nav-btn" onclick="creationPrev()" style="display:none;">← 上一步</button>
    <button id="creation-next" class="creation-nav-btn primary" onclick="creationNext()">下一步 →</button>
  </div>
</div>
```

- [ ] **Step 2: Add creation CSS**

```css
/* === Creation Steps === */
.step-indicator {
  display:flex;flex-direction:column;align-items:center;gap:4px;
  padding:8px 16px;transition:all var(--transition-normal);
}
.step-indicator .step-num {
  font-family:var(--font-serif);font-size:20px;color:var(--text-dim);
}
.step-indicator .step-label {
  font-size:11px;color:var(--text-dim);
}
.step-indicator.active .step-num { color: var(--text-primary); }
.step-indicator.active .step-label { color: var(--text-secondary); }
.step-indicator.done .step-num { color: var(--text-secondary); }
.step-line {
  width:40px;height:1px;background:var(--border-subtle);align-self:center;
}
.step-line.done { background: var(--border-gold-bright); }
.creation-nav-btn {
  padding:10px 32px;background:transparent;border:1px solid var(--border-subtle);
  color:var(--text-body);font-family:var(--font-serif);font-size:14px;
  letter-spacing:4px;transition:all var(--transition-normal);
}
.creation-nav-btn:hover { border-color:var(--border-gold-bright);color:var(--text-primary); }
.creation-nav-btn.primary { border-color:var(--border-gold);color:var(--text-primary); }
```

- [ ] **Step 3: Write Step 0 HTML generation JS**

```javascript
const DIFFICULTY = [
  { id:'unlimited', name:'无限火力', points:99999, desc:'随心所欲，无所不能', color:'#ff6b35' },
  { id:'powerFantasy', name:'爽文男主', points:200, desc:'天命所归，气运加身', color:'#ffaa00' },
  { id:'easy', name:'简单', points:150, desc:'轻松修炼，自在逍遥', color:'#88cc88' },
  { id:'normal', name:'普通', points:100, desc:'中规中矩的修炼之路', color:'#ccc' },
  { id:'hard', name:'困难', points:50, desc:'资源匮乏，步步维艰', color:'#ff9944' },
  { id:'extreme', name:'极限模式', points:60, desc:'极限压制，以战养战', color:'#ff4444' },
  { id:'mortal', name:'凡人修仙', points:30, desc:'以凡人之躯，逆天改命', color:'#cc4444' }
];

function renderCreationStep0() {
  const container = document.getElementById('creation-content');
  container.innerHTML = `
    <div style="max-width:700px;margin:0 auto;">
      <h2 style="text-align:center;margin-bottom:24px;">创角 · 基础信息</h2>
      <!-- Name -->
      <div class="form-group">
        <label class="form-label">姓名</label>
        <div style="display:flex;gap:8px;">
          <input type="text" id="input-name" class="form-input" placeholder="输入姓名..." style="flex:1;">
          <button class="dice-btn" onclick="randomName()" title="随机生成">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5" fill="currentColor"/><circle cx="16" cy="8" r="1.5" fill="currentColor"/><circle cx="8" cy="16" r="1.5" fill="currentColor"/><circle cx="16" cy="16" r="1.5" fill="currentColor"/></svg>
          </button>
        </div>
      </div>
      <!-- Gender -->
      <div class="form-group">
        <label class="form-label">性别</label>
        <div class="option-group" id="gender-group">
          <button class="option-btn" data-value="male" onclick="selectGender('male',this)">男</button>
          <button class="option-btn" data-value="female" onclick="selectGender('female',this)">女</button>
          <button class="option-btn" data-value="futa" onclick="selectGender('futa',this)">扶她</button>
        </div>
      </div>
      <!-- Age -->
      <div class="form-group">
        <label class="form-label">年龄：<span id="age-display" style="color:var(--text-primary);">18</span> 岁</label>
        <input type="range" id="input-age" class="form-slider" min="12" max="80" value="18" oninput="updateAge(this.value)">
      </div>
      <!-- Difficulty -->
      <div class="form-group">
        <label class="form-label">难度选择</label>
        <div id="difficulty-group" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          ${DIFFICULTY.map((d,i) => `
            <div class="difficulty-card" data-diff="${d.id}" onclick="selectDifficulty('${d.id}',this)" style="border-color:${d.color}33;">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="color:${d.color};font-weight:500;">${d.name}</span>
                <span style="color:var(--text-primary);font-family:var(--font-serif);">${d.points.toLocaleString()} 点</span>
              </div>
              <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">${d.desc}</div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
  document.getElementById('creation-prev').style.display = 'none';
}

function randomName() {
  const surnames = ['萧','林','叶','苏','云','楚','秦','沈','韩','柳','白','墨','凌','慕容','纳兰','独孤'];
  const given = ['炎','动','尘','风','霆','逸','玄','渊','澈','皓','煜','朔','澜','墨','羽','辰','霄','焱','淼','垚'];
  const name = surnames[Math.floor(Math.random()*surnames.length)] + 
               given[Math.floor(Math.random()*given.length)] +
               (Math.random()>0.5 ? given[Math.floor(Math.random()*given.length)] : '');
  document.getElementById('input-name').value = name;
}

function selectGender(val, el) {
  document.querySelectorAll('#gender-group .option-btn').forEach(b => b.classList.remove('selected'));
  el.classList.add('selected');
  GameState.player.gender = val;
}

function updateAge(val) {
  document.getElementById('age-display').textContent = val;
  GameState.player.age = parseInt(val);
}

function selectDifficulty(id, el) {
  document.querySelectorAll('#difficulty-group .difficulty-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  const d = DIFFICULTY.find(d => d.id === id);
  GameState.player.difficulty = id;
  GameState.player.points = d.points;
  GameState.player.pointsSpent = 0;
  updatePointsDisplay();
}
```

- [ ] **Step 4: Add form CSS**

```css
.form-group { margin-bottom:20px; }
.form-label { display:block;font-family:var(--font-serif);color:var(--text-secondary);font-size:13px;margin-bottom:8px;letter-spacing:2px; }
.form-input {
  width:100%;padding:10px 14px;background:var(--bg-card);border:1px solid var(--border-subtle);
  color:var(--text-body);font-size:14px;border-radius:4px;transition:border-color var(--transition-fast);
}
.form-input:focus { border-color:var(--border-gold-bright); }
.form-slider {
  -webkit-appearance:none;width:100%;height:4px;background:var(--border-subtle);border-radius:2px;outline:none;
}
.form-slider::-webkit-slider-thumb {
  -webkit-appearance:none;width:18px;height:18px;border-radius:50%;background:var(--text-primary);cursor:pointer;
  box-shadow:0 0 8px rgba(212,168,75,0.4);
}
.option-group { display:flex;gap:8px; }
.option-btn {
  flex:1;padding:10px;background:var(--bg-card);border:1px solid var(--border-subtle);
  color:var(--text-body);text-align:center;transition:all var(--transition-fast);
}
.option-btn:hover { border-color:var(--border-gold);color:var(--text-primary); }
.option-btn.selected { border-color:var(--text-primary);color:var(--text-primary);background:rgba(212,168,75,0.08); }
.difficulty-card {
  background:var(--bg-card);border:1px solid var(--border-subtle);padding:12px;
  border-radius:6px;cursor:pointer;transition:all var(--transition-fast);
}
.difficulty-card:hover { border-color:var(--border-gold-bright); }
.difficulty-card.selected { border-color:var(--text-primary)!important;background:rgba(212,168,75,0.05); }
.dice-btn {
  background:var(--bg-card);border:1px solid var(--border-subtle);color:var(--text-secondary);
  padding:8px 12px;border-radius:4px;transition:all var(--transition-fast);
}
.dice-btn:hover { border-color:var(--border-gold);color:var(--text-primary); }
```

- [ ] **Step 5: Wire creation flow JS (navigation logic)**

```javascript
let creationCurrentStep = -1;

function startNewGame() {
  GameState.phase = 'creation';
  GameState.player = {
    name: '', gender: '', age: 18, difficulty: '', points: 0, pointsSpent: 0,
    race: '', identity: '',
    baseStats: { strength: 5, agility: 5, endurance: 5, douqi: 5, soul: 5, speed: 5 },
    performanceStats: {},
    talents: [],
    douqiAttributes: []
  };
  showView('view-creation');
  creationCurrentStep = -1;
  creationNext();
}

function updatePointsDisplay() {
  const el = document.getElementById('creation-points-value');
  const remaining = GameState.player.points - GameState.player.pointsSpent;
  el.textContent = remaining;
  el.style.color = remaining > 20 ? 'var(--accent-green)' : remaining > 5 ? '#ffaa00' : '#ff4444';
}

function creationNext() {
  creationCurrentStep++;
  if (creationCurrentStep > 4) { confirmCreation(); return; }
  document.getElementById('creation-prev').style.display = creationCurrentStep === 0 ? 'none' : 'inline-block';
  document.getElementById('creation-next').textContent = creationCurrentStep === 4 ? '确认创角' : '下一步 →';
  updateStepIndicator();
  switch(creationCurrentStep) {
    case 0: renderCreationStep0(); break;
    // Steps 1-4 added in later tasks
  }
}
function creationPrev() {
  creationCurrentStep = Math.max(0, creationCurrentStep - 1);
  document.getElementById('creation-prev').style.display = creationCurrentStep === 0 ? 'none' : 'inline-block';
  document.getElementById('creation-next').textContent = creationCurrentStep === 4 ? '确认创角' : '下一步 →';
  updateStepIndicator();
  // Re-render step
}

function updateStepIndicator() {
  document.querySelectorAll('.step-indicator').forEach((el,i) => {
    el.classList.remove('active','done');
    if (i < creationCurrentStep) el.classList.add('done');
    if (i === creationCurrentStep) el.classList.add('active');
  });
  document.querySelectorAll('.step-line').forEach((el,i) => {
    el.classList.toggle('done', i < creationCurrentStep);
  });
}
```

- [ ] **Step 6: Verify Step 0 flow**

Click "开启新人生" → should see creation screen with step indicator, points bar, and Step 0 form (name/gender/age/difficulty). Selecting a difficulty should update points. "上一步" should be hidden on step 0.

---

### Task 4: Character Creation — Step 1 (Race Selection, 11 Races)

**Files:**
- Modify: `C:\Users\Administrator\index.html` (step 1 HTML gen + race data)

- [ ] **Step 1: Define race data and step 1 renderer**

```javascript
const RACES = [
  { id:'human', name:'人族', cost:0, desc:'万灵之长，均衡全面，适应力极强', color:'#d4a84b',
    coeff:{ hp:1.0, dp:1.0, pa:1.0, da:1.0, pd:1.0, dd:1.0, ph:1.0, dh:1.0, cr:1.0 }},
  { id:'yao', name:'妖族', cost:10, desc:'体魄强韧，肉身成圣，生命力旺盛', color:'#cc8844',
    coeff:{ hp:1.3, dp:0.9, pa:1.2, da:0.8, pd:1.2, dd:0.8, ph:1.0, dh:0.9, cr:1.1 }},
  { id:'taixu', name:'太虚古龙族', cost:30, desc:'龙威盖世，肉身无双，空间之力', color:'#c084fc',
    coeff:{ hp:1.5, dp:1.2, pa:1.4, da:1.1, pd:1.3, dd:1.1, ph:1.2, dh:1.0, cr:1.3 }},
  { id:'huangphoenix', name:'天妖凰族', cost:28, desc:'涅槃重生，凤凰之炎焚尽万物', color:'#ff6b35',
    coeff:{ hp:1.2, dp:1.4, pa:1.1, da:1.5, pd:1.0, dd:1.4, ph:1.0, dh:1.3, cr:1.2 }},
  { id:'jiuyou', name:'九幽地冥蟒族', cost:22, desc:'幽冥剧毒，暗影潜行，一击致命', color:'#44aa44',
    coeff:{ hp:1.4, dp:1.1, pa:1.0, da:1.2, pd:1.1, dd:1.0, ph:1.3, dh:0.9, cr:1.4 }},
  { id:'snake', name:'蛇人族', cost:15, desc:'沙漠主宰，耐力惊人，毒术精湛', color:'#aaaa44',
    coeff:{ hp:1.2, dp:1.0, pa:1.1, da:1.1, pd:1.1, dd:1.0, ph:1.1, dh:1.0, cr:1.1 }},
  { id:'ancientPhoenix', name:'远古天凰', cost:32, desc:'远古神威，天凰之炎焚天煮海', color:'#ff8844',
    coeff:{ hp:1.3, dp:1.5, pa:1.2, da:1.6, pd:1.1, dd:1.5, ph:1.1, dh:1.4, cr:1.3 }},
  { id:'ancientSnake', name:'远古天蛇', cost:26, desc:'时空感知，远古血脉威压众生', color:'#44cccc',
    coeff:{ hp:1.3, dp:1.3, pa:1.1, da:1.3, pd:1.2, dd:1.2, ph:1.4, dh:1.1, cr:1.2 }},
  { id:'jiucai', name:'九彩吞天蟒', cost:35, desc:'吞噬苍穹，九彩神光湮灭万物', color:'#ff88cc',
    coeff:{ hp:1.6, dp:1.4, pa:1.5, da:1.3, pd:1.4, dd:1.3, ph:1.3, dh:1.2, cr:1.4 }},
  { id:'longhuang', name:'龙凰', cost:40, desc:'龙凤合一，古今无双，万兽至尊', color:'#dd8844',
    coeff:{ hp:1.7, dp:1.6, pa:1.6, da:1.7, pd:1.5, dd:1.5, ph:1.5, dh:1.5, cr:1.6 }},
  { id:'tunling', name:'吞灵族', cost:38, desc:'噬魂夺魄，灵力吞噬，万灵克星', color:'#884488',
    coeff:{ hp:1.4, dp:1.7, pa:1.3, da:1.8, pd:1.2, dd:1.6, ph:1.2, dh:1.6, cr:1.5 }}
];

function renderCreationStep1() {
  const container = document.getElementById('creation-content');
  container.innerHTML = `
    <h2 style="text-align:center;margin-bottom:24px;">壹 · 选择种族</h2>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;max-width:900px;margin:0 auto;">
      ${RACES.map(r => `
        <div class="race-card" data-race="${r.id}" onclick="selectRace('${r.id}',this)" style="border-color:${r.color}33;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <span style="color:${r.color};font-weight:600;font-size:15px;">${r.name}</span>
            <span style="color:var(--text-primary);font-size:12px;">${r.cost}点</span>
          </div>
          <p style="font-size:12px;color:var(--text-body);margin:0;">${r.desc}</p>
          <div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:4px;font-size:10px;">
            <span style="color:${r.coeff.hp>=1.4?'var(--accent-fire)':'var(--text-muted)'};">生命${r.coeff.hp>=1.4?'↑':'~'}</span>
            <span style="color:${r.coeff.da>=1.4?'var(--accent-purple)':'var(--text-muted)'};">斗攻${r.coeff.da>=1.4?'↑':'~'}</span>
            <span style="color:${r.coeff.pa>=1.4?'var(--accent-green)':'var(--text-muted)'};">物攻${r.coeff.pa>=1.4?'↑':'~'}</span>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function selectRace(id, el) {
  document.querySelectorAll('.race-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  const race = RACES.find(r => r.id === id);
  GameState.player.race = id;
  // Recalculate points: subtract race cost
  recalculatePoints();
}

function recalculatePoints() {
  let spent = 0;
  // Race cost
  const race = RACES.find(r => r.id === GameState.player.race);
  if (race) spent += race.cost;
  // Identity cost (added in task 5)
  // Stats cost (added in task 6)
  // Talent costs (added in task 7)
  // Attribute costs (added in task 7)
  GameState.player.pointsSpent = spent;
  updatePointsDisplay();
}
```

- [ ] **Step 2: Add race card CSS**

```css
.race-card {
  background:var(--bg-card);border:1px solid var(--border-subtle);
  padding:14px;border-radius:6px;cursor:pointer;
  transition:all var(--transition-normal);
}
.race-card:hover { transform:translateY(-2px);border-color:var(--border-gold);box-shadow:var(--shadow-gold); }
.race-card.selected { border-color:var(--text-primary)!important;background:rgba(212,168,75,0.05); }
```

- [ ] **Step 3: Add step 1 to creationNext()**

In `creationNext()`, add to the switch: `case 1: renderCreationStep1(); break;`

- [ ] **Step 4: Verify race selection**

Navigate through creation to step 1. Should see 11 race cards in a grid. Clicking a race should highlight it with gold border. Points should update based on race cost.

---

### Task 5: Character Creation — Step 2 (Identity, 4 Identities) + Step 3 (Stats Allocation)

**Files:**
- Modify: `C:\Users\Administrator\index.html` (steps 2-3 HTML gen + CSS + JS)

- [ ] **Step 1: Define identity data and step 2 renderer**

```javascript
const IDENTITIES = [
  { id:'wanderer', name:'散修', cost:0, desc:'无门无派，自由自在。初始资源贫乏，但不受约束' },
  { id:'mercenary', name:'佣兵', cost:5, desc:'刀口舔血，实战经验丰富。战斗本能加成' },
  { id:'noble', name:'世家子弟', cost:10, desc:'出身名门，资源充沛。初始丹药与功法丰厚' },
  { id:'alchemist', name:'炼药师', cost:15, desc:'炼丹奇才，灵魂力出众。初始拥有炼药传承' }
];

function renderCreationStep2() {
  const container = document.getElementById('creation-content');
  container.innerHTML = `
    <h2 style="text-align:center;margin-bottom:24px;">贰 · 选择身份</h2>
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;max-width:600px;margin:0 auto;">
      ${IDENTITIES.map(id => `
        <div class="identity-card" data-identity="${id.id}" onclick="selectIdentity('${id.id}',this)">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <span style="color:var(--text-primary);font-size:15px;font-weight:600;">${id.name}</span>
            <span style="color:var(--text-primary);font-size:12px;">${id.cost}点</span>
          </div>
          <p style="font-size:12px;color:var(--text-body);margin:0;">${id.desc}</p>
        </div>
      `).join('')}
    </div>
  `;
}

function selectIdentity(id, el) {
  document.querySelectorAll('.identity-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  GameState.player.identity = id;
  recalculatePoints();
}
```

- [ ] **Step 2: Add identity card CSS**

```css
.identity-card {
  background:var(--bg-card);border:1px solid var(--border-subtle);
  padding:20px;border-radius:6px;cursor:pointer;text-align:center;
  transition:all var(--transition-normal);
}
.identity-card:hover { transform:translateY(-2px);border-color:var(--border-gold); }
.identity-card.selected { border-color:var(--text-primary)!important; }
```

- [ ] **Step 3: Step 3 — Stats Allocation (6 base stats + 9 performance stats display)**

```javascript
const STAT_CONFIG = [
  { key:'strength', label:'力量', icon:'💪', desc:'影响物理攻击与防御' },
  { key:'agility', label:'身法', icon:'🦶', desc:'影响命中、暴击与闪避' },
  { key:'endurance', label:'耐力', icon:'🛡️', desc:'影响生命上限与防御' },
  { key:'douqi', label:'斗气', icon:'🔥', desc:'影响斗气上限与斗气攻击' },
  { key:'soul', label:'灵魂力', icon:'✨', desc:'影响炼药、感知与灵魂攻防' },
  { key:'speed', label:'速度', icon:'⚡', desc:'影响行动顺序与闪避' }
];

const PERF_STAT_LABELS = {
  hp: '生命上限', dp: '斗气上限', pa: '物理攻击', da: '斗气攻击',
  pd: '物理防御', dd: '斗气防御', ph: '物理命中', dh: '斗气命中', cr: '暴击率'
};

function renderCreationStep3() {
  const container = document.getElementById('creation-content');
  container.innerHTML = `
    <div style="max-width:800px;margin:0 auto;">
      <h2 style="text-align:center;margin-bottom:6px;">叁 · 调整数值</h2>
      <p style="text-align:center;color:var(--text-muted);font-size:12px;margin-bottom:20px;">每点属性消耗 1 可用点数 · 调整范围 0-20</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
        <!-- Base stats -->
        <div>
          <h4 style="color:var(--text-primary);margin-bottom:12px;">基础属性（可调整）</h4>
          ${STAT_CONFIG.map(s => `
            <div class="stat-row">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                <span style="color:var(--text-body);font-size:13px;"><span style="margin-right:4px;">${s.icon}</span>${s.label}</span>
                <span style="color:var(--text-primary);font-family:var(--font-serif);" id="stat-val-${s.key}">${GameState.player.baseStats[s.key]}</span>
              </div>
              <input type="range" class="form-slider stat-slider" min="0" max="20" value="${GameState.player.baseStats[s.key]}"
                data-stat="${s.key}" oninput="updateStat('${s.key}',parseInt(this.value))">
              <div style="font-size:10px;color:var(--text-muted);">${s.desc}</div>
            </div>
          `).join('')}
        </div>
        <!-- Performance stats -->
        <div>
          <h4 style="color:var(--text-secondary);margin-bottom:12px;">表现属性（种族加成自动计算）</h4>
          <div id="perf-stats-display" style="font-size:13px;">
            ${Object.entries(PERF_STAT_LABELS).map(([k,v]) => `
              <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border-subtle);">
                <span style="color:var(--text-body);">${v}</span>
                <span style="color:var(--text-primary);font-family:var(--font-serif);" id="perf-stat-${k}">0</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    </div>
  `;
  updatePerformanceStats();
}

function updateStat(key, val) {
  GameState.player.baseStats[key] = val;
  document.getElementById('stat-val-'+key).textContent = val;
  recalculatePoints();
  updatePerformanceStats();
}

function updatePerformanceStats() {
  const race = RACES.find(r => r.id === GameState.player.race);
  if (!race) return;
  const bs = GameState.player.baseStats;
  const c = race.coeff;
  const perf = {
    hp: Math.round(bs.endurance * 20 * c.hp),
    dp: Math.round(bs.douqi * 20 * c.dp),
    pa: Math.round(bs.strength * 8 * c.pa),
    da: Math.round(bs.douqi * 8 * c.da),
    pd: Math.round((bs.endurance + bs.strength) * 4 * c.pd),
    dd: Math.round((bs.douqi + bs.soul) * 4 * c.dd),
    ph: Math.round(bs.agility * 5 * c.ph),
    dh: Math.round(bs.soul * 5 * c.dh),
    cr: Math.round(bs.agility * c.cr * 10) / 10
  };
  GameState.player.performanceStats = perf;
  Object.entries(perf).forEach(([k,v]) => {
    const el = document.getElementById('perf-stat-'+k);
    if (el) el.textContent = k === 'cr' ? v + '%' : v;
  });
}
```

- [ ] **Step 4: Update recalculation for stats**

```javascript
function recalculatePoints() {
  let spent = 0;
  const race = RACES.find(r => r.id === GameState.player.race);
  if (race) spent += race.cost;
  const identity = IDENTITIES.find(i => i.id === GameState.player.identity);
  if (identity) spent += identity.cost;
  // Base stats: each point above 0 costs 1
  Object.values(GameState.player.baseStats).forEach(v => spent += v);
  // Talents and attributes added in task 7
  GameState.player.pointsSpent = spent;
  updatePointsDisplay();
}
```

- [ ] **Step 5: Add cases to creationNext/Prev**

In `creationNext()`: `case 2: renderCreationStep2(); break; case 3: renderCreationStep3(); break;`

- [ ] **Step 6: Verify steps 2-3**

Navigate through to step 2: 4 identity cards, clicking selects. Step 3: 6 stat sliders (0-20), right side shows 9 performance stats computed from race coefficients + base stats. Moving sliders updates performance stats in real-time.

---

### Task 6: Character Creation — Step 4 (50 Talents + 12 Douqi Attributes)

**Files:**
- Modify: `C:\Users\Administrator\index.html` (step 4 HTML gen + talent/attribute data)

- [ ] **Step 1: Define all 50 talent data**

```javascript
const TALENTS = {
  common: [
    { id:'c1', name:'身强体健', desc:'体质略微增强' },
    { id:'c2', name:'过目不忘', desc:'记忆力超群' },
    { id:'c3', name:'五感敏锐', desc:'感知能力提升' },
    { id:'c4', name:'精力充沛', desc:'不易疲劳' },
    { id:'c5', name:'寒暑不侵', desc:'极端温度影响减小' },
    { id:'c6', name:'夜能视物', desc:'黑暗中视物如昼' },
    { id:'c7', name:'身手敏捷', desc:'反应速度提升' },
    { id:'c8', name:'百病不侵', desc:'疾病免疫' },
    { id:'c9', name:'水性极佳', desc:'水下活动自如' },
    { id:'c10', name:'食量惊人', desc:'可从食物中吸收更多能量' }
  ],
  normal: [
    { id:'n1', name:'斗气感知', desc:'能感知方圆百丈的斗气波动' },
    { id:'n2', name:'草药辨识', desc:'辨识基础灵药的能力' },
    { id:'n3', name:'基础格斗', desc:'天生具备战斗本能' },
    { id:'n4', name:'快速恢复', desc:'伤势恢复速度提升' },
    { id:'n5', name:'危机直觉', desc:'危险来临时心生警兆' },
    { id:'n6', name:'能言善辩', desc:'交涉能力大幅提升' },
    { id:'n7', name:'经商有道', desc:'交易价格更优惠' },
    { id:'n8', name:'驯兽亲和', desc:'魔兽对你天然亲近' },
    { id:'n9', name:'锻造入门', desc:'基础武器锻造能力' },
    { id:'n10', name:'阵法初窥', desc:'理解基础阵法构造' }
  ],
  rare: [
    { id:'r1', name:'炼药天才', desc:'炼药成功率+15%' },
    { id:'r2', name:'灵魂感知', desc:'可感知他人灵魂强弱' },
    { id:'r3', name:'斗气化翼', desc:'斗王之前即可短暂飞行' },
    { id:'r4', name:'元素亲和', desc:'与天地能量沟通效率提升' },
    { id:'r5', name:'远古记忆', desc:'偶尔浮现远古知识片段' },
    { id:'r6', name:'剑心通明', desc:'剑法修炼速度翻倍' },
    { id:'r7', name:'阵法精通', desc:'可布置中型阵法' },
    { id:'r8', name:'丹道奇才', desc:'丹方改良能力' },
    { id:'r9', name:'万兽通语', desc:'可与魔兽进行精神沟通' },
    { id:'r10', name:'暗影潜行', desc:'隐匿气息，难以被察觉' }
  ],
  epic: [
    { id:'e1', name:'天火灵体', desc:'天生与火焰极度亲和' },
    { id:'e2', name:'先天道体', desc:'修炼速度+30%' },
    { id:'e3', name:'九窍玲珑心', desc:'可同时运转多种功法' },
    { id:'e4', name:'古凤精血', desc:'体内流淌古凤血脉' },
    { id:'e5', name:'真龙之魂', desc:'灵魂中寄宿真龙之力' },
    { id:'e6', name:'空间亲和', desc:'天生亲近空间法则' },
    { id:'e7', name:'时间残影', desc:'可模糊感知时间流逝' },
    { id:'e8', name:'万毒不侵', desc:'免疫绝大多数毒素' },
    { id:'e9', name:'魂印不灭', desc:'灵魂难以被彻底摧毁' },
    { id:'e10', name:'天机推演', desc:'模糊推演未来片段' }
  ],
  legendary: [
    { id:'l1', name:'位面穿越者', desc:'来自异世界的灵魂，不受此界法则束缚' },
    { id:'l2', name:'焚决传承', desc:'身怀焚决，可吞噬异火进化' },
    { id:'l3', name:'帝炎亲和', desc:'天生亲近帝炎，万火来朝' },
    { id:'l4', name:'轮回之眼', desc:'可洞察灵魂前世今生' },
    { id:'l5', name:'九星苍穹体', desc:'容纳九星之力，肉身成圣' },
    { id:'l6', name:'万火归宗', desc:'可掌控多种异火而不冲突' },
    { id:'l7', name:'混沌圣体', desc:'混沌属性，万法不侵' },
    { id:'l8', name:'命运虚无者', desc:'命运长河中不存在的变数' },
    { id:'l9', name:'虚空行走', desc:'可短暂遁入虚空' },
    { id:'l10', name:'不死涅槃', desc:'濒死时可涅槃重生一次' }
  ]
};
const TALENT_TIERS = [
  { key:'common', label:'平庸', cost:0, color:'#888' },
  { key:'normal', label:'普通', cost:5, color:'#88cc88' },
  { key:'rare', label:'稀有', cost:15, color:'#4488ff' },
  { key:'epic', label:'史诗', cost:30, color:'#c084fc' },
  { key:'legendary', label:'传说', cost:50, color:'#ff6b35' }
];

const DOUQI_ATTRS = [
  { id:'wind', name:'风', color:'#88cc88' },
  { id:'water', name:'水', color:'#8888cc' },
  { id:'fire', name:'火', color:'#cc6666' },
  { id:'earth', name:'土', color:'#aaaa66' },
  { id:'wood', name:'木', color:'#66aa66' },
  { id:'ice', name:'冰', color:'#88cccc' },
  { id:'thunder', name:'雷', color:'#cccc44' },
  { id:'light', name:'光', color:'#ccaa44' },
  { id:'dark', name:'暗', color:'#886688' },
  { id:'metal', name:'金', color:'#ccaa44' },
  { id:'poison', name:'毒', color:'#88aa44' },
  { id:'space', name:'空间', color:'#ccaadd' }
];
```

- [ ] **Step 2: Step 4 renderer (talents + douqi attributes)**

```javascript
function renderCreationStep4() {
  const container = document.getElementById('creation-content');
  container.innerHTML = `
    <h2 style="text-align:center;margin-bottom:24px;">肆 · 天赋词条 & 斗气属性</h2>
    <!-- Talent section -->
    <div style="margin-bottom:24px;">
      <h4 style="color:var(--text-primary);margin-bottom:12px;">天赋词条（${GameState.player.talents.length} 已选）</h4>
      ${TALENT_TIERS.map(tier => `
        <div style="margin-bottom:12px;">
          <div style="color:${tier.color};font-size:12px;margin-bottom:6px;font-weight:500;">${tier.label} · ${tier.cost}点/个</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;">
            ${TALENTS[tier.key].map(t => `
              <button class="talent-chip ${GameState.player.talents.includes(t.id)?'selected':''}" 
                data-talent="${t.id}" data-tier="${tier.key}" onclick="toggleTalent('${t.id}','${tier.key}',this)"
                style="border-color:${tier.color}33;" title="${t.desc}">
                ${t.name}
              </button>
            `).join('')}
          </div>
        </div>
      `).join('')}
    </div>
    <!-- Douqi attributes -->
    <div>
      <h4 style="color:var(--text-primary);margin-bottom:12px;">斗气属性（最多选择2种）</h4>
      <div style="display:flex;flex-wrap:wrap;gap:8px;">
        ${DOUQI_ATTRS.map(a => `
          <button class="attr-chip ${GameState.player.douqiAttributes.includes(a.id)?'selected':''}"
            data-attr="${a.id}" onclick="toggleAttribute('${a.id}',this)"
            style="border-color:${a.color}33;color:${a.color};">
            ${a.name}
          </button>
        `).join('')}
      </div>
      <p style="font-size:10px;color:var(--text-muted);margin-top:8px;">第一属性 0点 · 第二属性 10点 · 风克木 木克土 土克水 水克火 火克金 金克风 雷克冰 冰克木 光暗互克 空间克毒 毒克光</p>
    </div>
  `;
}

function toggleTalent(id, tier, el) {
  const idx = GameState.player.talents.indexOf(id);
  if (idx >= 0) {
    GameState.player.talents.splice(idx, 1);
    el.classList.remove('selected');
  } else {
    GameState.player.talents.push(id);
    el.classList.add('selected');
  }
  recalculatePoints();
}

function toggleAttribute(id, el) {
  const idx = GameState.player.douqiAttributes.indexOf(id);
  if (idx >= 0) {
    GameState.player.douqiAttributes.splice(idx, 1);
    el.classList.remove('selected');
  } else {
    if (GameState.player.douqiAttributes.length >= 2) {
      showToast('最多选择2种斗气属性');
      return;
    }
    GameState.player.douqiAttributes.push(id);
    el.classList.add('selected');
  }
  recalculatePoints();
}
```

- [ ] **Step 3: Update recalculatePoints for talents and attributes**

```javascript
function recalculatePoints() {
  let spent = 0;
  const race = RACES.find(r => r.id === GameState.player.race);
  if (race) spent += race.cost;
  const identity = IDENTITIES.find(i => i.id === GameState.player.identity);
  if (identity) spent += identity.cost;
  Object.values(GameState.player.baseStats).forEach(v => spent += v);
  // Talent costs
  GameState.player.talents.forEach(tid => {
    for (const tier of TALENT_TIERS) {
      if (TALENTS[tier.key].some(t => t.id === tid)) {
        spent += tier.cost;
        break;
      }
    }
  });
  // Attribute costs: first free, second costs 10
  if (GameState.player.douqiAttributes.length >= 2) spent += 10;
  GameState.player.pointsSpent = spent;
  updatePointsDisplay();
}
```

- [ ] **Step 4: Add talent/attribute CSS**

```css
.talent-chip {
  padding:5px 12px;background:var(--bg-card);border:1px solid var(--border-subtle);
  color:var(--text-body);font-size:12px;border-radius:16px;cursor:pointer;
  transition:all var(--transition-fast);
}
.talent-chip:hover { border-color:var(--border-gold); }
.talent-chip.selected { background:rgba(212,168,75,0.1);border-color:var(--text-primary);color:var(--text-primary); }
.attr-chip {
  padding:8px 20px;background:var(--bg-card);border:1px solid var(--border-subtle);
  font-family:var(--font-serif);font-size:14px;border-radius:6px;cursor:pointer;
  transition:all var(--transition-fast);
}
.attr-chip:hover { border-color:var(--border-gold-bright); }
.attr-chip.selected { border-color:var(--text-primary)!important;box-shadow:0 0 12px rgba(212,168,75,0.2); }
```

- [ ] **Step 5: Add case 4 to creationNext and confirmCreation**

```javascript
// In creationNext switch:
case 4: renderCreationStep4(); break;

function confirmCreation() {
  const p = GameState.player;
  if (!p.name) { showToast('请输入姓名'); creationCurrentStep = 0; renderCreationStep0(); return; }
  if (!p.gender) { showToast('请选择性别'); creationCurrentStep = 0; renderCreationStep0(); return; }
  if (!p.difficulty) { showToast('请选择难度'); creationCurrentStep = 0; renderCreationStep0(); return; }
  if (!p.race) { showToast('请选择种族'); creationCurrentStep = 1; renderCreationStep1(); return; }
  if (!p.identity) { showToast('请选择身份'); creationCurrentStep = 2; renderCreationStep2(); return; }
  if (p.pointsSpent > p.points) { showToast('点数不足！请调整分配'); return; }
  // Transition to game
  startGame();
}

function startGame() {
  GameState.phase = 'game';
  showView('view-game');
  showToast('创角完成！踏入斗气大陆...');
  initGameWorld();
}
```

- [ ] **Step 6: Verify step 4**

Navigate to step 4. Should see 50 talent chips across 5 tier sections, and 12 douqi attribute buttons. Clicking talents toggles selection and updates points. Attribute selection capped at 2. "下一步" now reads "确认创角". Clicking it validates and enters the game.

---

### Task 7: Game World — Sidebar Navigation + World Map Page

**Files:**
- Modify: `C:\Users\Administrator\index.html` (sidebar + world map HTML/CSS/JS)

- [ ] **Step 1: Build the sidebar**

```html
<nav id="game-sidebar" style="width:var(--sidebar-width);background:var(--bg-panel);border-right:1px solid var(--border-subtle);display:flex;flex-direction:column;align-items:center;padding:16px 0;gap:24px;z-index:var(--z-sidebar);">
  <div style="width:36px;height:36px;border:1px solid var(--border-gold);display:flex;align-items:center;justify-content:center;border-radius:4px;">
    <span style="font-family:var(--font-serif);font-size:12px;color:var(--text-primary);">斗</span>
  </div>
  <div style="flex:1;display:flex;flex-direction:column;gap:20px;align-items:center;">
    <button class="sidebar-btn active" data-view="worldmap" onclick="switchGameView('worldmap',this)" title="大世界">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.5 2.5 4 5.5 4 9s-1.5 6.5-4 9"/><path d="M12 3c-2.5 2.5-4 5.5-4 9s1.5 6.5 4 9"/>
      </svg>
      <span class="sidebar-label">大世界</span>
    </button>
    <button class="sidebar-btn" data-view="studio" onclick="switchGameView('studio',this)" title="修炼驻地">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 21v-6h6v6"/>
      </svg>
      <span class="sidebar-label">驻地</span>
    </button>
    <button class="sidebar-btn" data-view="personnel" onclick="switchGameView('personnel',this)" title="人员">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="9" cy="7" r="4"/><path d="M1 21v-2a4 4 0 014-4h8a4 4 0 014 4v2"/><circle cx="17" cy="8" r="3"/><path d="M20 21v-2a3 3 0 00-2-2.8"/>
      </svg>
      <span class="sidebar-label">人员</span>
    </button>
  </div>
  <button class="sidebar-btn" onclick="openSettings()" title="设置">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <circle cx="12" cy="12" r="3"/><path d="M12 1v4m0 14v4M4.2 4.2l2.8 2.8m10 10l2.8 2.8M1 12h4m14 0h4M4.2 19.8l2.8-2.8m10-10l2.8-2.8"/>
    </svg>
  </button>
</nav>
```

- [ ] **Step 2: Add sidebar CSS**

```css
.sidebar-btn {
  width:44px;height:44px;display:flex;flex-direction:column;align-items:center;
  justify-content:center;background:transparent;color:var(--text-dim);
  border-radius:8px;transition:all var(--transition-normal);gap:3px;
}
.sidebar-btn:hover { color:var(--text-secondary);background:rgba(212,168,75,0.05); }
.sidebar-btn.active { color:var(--text-primary);position:relative; }
.sidebar-btn.active::after {
  content:'';position:absolute;left:-16px;top:50%;transform:translateY(-50%);
  width:2px;height:20px;background:var(--text-primary);border-radius:1px;
  transition:top var(--transition-normal);
}
.sidebar-label { font-size:9px; }
.game-subview { display:none;position:absolute;top:0;left:0;width:100%;height:100%;overflow-y:auto; }
.game-subview.active { display:flex;flex-direction:column; }
```

- [ ] **Step 3: World map page HTML**

```javascript
function initGameWorld() {
  buildWorldMap();
  buildStudio();
  buildPersonnel();
  initLLMPanel();
  switchGameView('worldmap', document.querySelector('[data-view="worldmap"]'));
}

function buildWorldMap() {
  const container = document.getElementById('game-view-worldmap');
  container.innerHTML = `
    <!-- Top info bar -->
    <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 20px;background:var(--bg-panel);border-bottom:1px solid var(--border-subtle);">
      <div style="display:flex;gap:24px;align-items:center;">
        <span style="color:var(--text-primary);font-family:var(--font-serif);font-size:15px;">大世界 · 斗气大陆</span>
        <span style="color:var(--text-muted);font-size:11px;">坐标：西北大陆 · 加玛帝国 · 乌坦城</span>
      </div>
      <div style="display:flex;gap:16px;align-items:center;">
        <span style="color:var(--text-secondary);font-size:11px;">三一六纪元 · 秋</span>
        <span style="color:var(--text-primary);font-size:11px;">斗气浓度 <span style="font-weight:600;">38%</span></span>
        <span style="background:rgba(212,168,75,0.1);color:var(--text-primary);padding:2px 10px;border-radius:10px;font-size:11px;border:1px solid var(--border-gold);">斗者 · 三星</span>
      </div>
    </div>
    <!-- Map area -->
    <div style="flex:1;position:relative;background:radial-gradient(ellipse at 50% 40%,#0f0d18 0%,#080810 70%);overflow:hidden;">
      <!-- CSS-drawn map regions -->
      <div id="worldmap-canvas" style="width:100%;height:100%;position:relative;">
        <!-- Central Plains (中州) -->
        <div class="map-region" style="top:35%;left:40%;width:20%;height:25%;" data-region="zhongzhou" onclick="openRegionDetail('zhongzhou')">
          <div class="region-pulse"></div>
          <span class="region-label">中州</span>
        </div>
        <!-- Jia Ma Empire -->
        <div class="map-region player-location" style="top:55%;left:25%;width:14%;height:16%;" data-region="jiama" onclick="openRegionDetail('jiama')">
          <div class="player-marker"></div>
          <span class="region-label">加玛帝国</span>
        </div>
        <!-- Chu Yun Empire -->
        <div class="map-region" style="top:52%;left:42%;width:12%;height:14%;" data-region="chuyun" onclick="openRegionDetail('chuyun')">
          <span class="region-label">出云帝国</span>
        </div>
        <!-- Black-Corner Region -->
        <div class="map-region" style="top:42%;left:55%;width:10%;height:15%;" data-region="heijiao" onclick="openRegionDetail('heijiao')">
          <span class="region-label">黑角域</span>
        </div>
        <!-- Northwest Continent -->
        <div class="map-region" style="top:48%;left:15%;width:16%;height:20%;" data-region="northwest" onclick="openRegionDetail('northwest')">
          <span class="region-label">西北大陆</span>
        </div>
        <!-- Soul Hall area -->
        <div class="map-region danger" style="top:30%;left:55%;width:10%;height:12%;" data-region="dian" onclick="openRegionDetail('dian')">
          <span class="region-label" style="color:#cc4444;">魂殿</span>
        </div>
      </div>
      <!-- Floating explore button -->
      <button id="btn-explore" style="position:absolute;bottom:24px;right:24px;padding:12px 24px;background:rgba(212,168,75,0.1);border:1px solid var(--border-gold);color:var(--text-primary);font-family:var(--font-serif);font-size:14px;letter-spacing:4px;border-radius:24px;transition:all var(--transition-normal);cursor:pointer;" onclick="exploreWorld()">
        探 索
      </button>
    </div>
  `;
}
```

- [ ] **Step 4: Add map CSS**

```css
.map-region {
  position:absolute;border:1px solid var(--border-gold);border-radius:50%;
  display:flex;align-items:center;justify-content:center;cursor:pointer;
  transition:all var(--transition-normal);
  background:rgba(212,168,75,0.03);
}
.map-region:hover { background:rgba(212,168,75,0.08);border-color:var(--text-primary);transform:scale(1.05); }
.map-region.player-location { border-color:var(--text-primary);border-style:dashed; }
.map-region.danger { border-color:#cc444433; }
.player-marker {
  width:6px;height:6px;background:var(--text-primary);border-radius:50%;
  position:absolute;top:-3px;left:50%;box-shadow:0 0 10px var(--text-primary);
  animation:marker-pulse 2s infinite;
}
@keyframes marker-pulse {
  0%,100% { box-shadow:0 0 6px var(--text-primary); }
  50% { box-shadow:0 0 16px var(--text-primary),0 0 24px rgba(212,168,75,0.5); }
}
.region-label {
  font-family:var(--font-serif);font-size:11px;color:var(--text-secondary);
  pointer-events:none;
}
.region-pulse {
  position:absolute;width:100%;height:100%;border-radius:50%;
  border:1px solid rgba(212,168,75,0.2);animation:region-pulse 3s infinite;
}
@keyframes region-pulse {
  0%,100% { transform:scale(1);opacity:0.3; }
  50% { transform:scale(1.1);opacity:0.6; }
}
```

- [ ] **Step 5: View switching + region detail modal**

```javascript
function switchGameView(viewId, btn) {
  document.querySelectorAll('.game-subview').forEach(v => v.classList.remove('active'));
  document.getElementById('game-view-'+viewId).classList.add('active');
  document.querySelectorAll('.sidebar-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

const REGION_DATA = {
  zhongzhou: { name:'中州', danger:'极高', energy:'浓郁', factions:'丹塔、焚炎谷、冰河谷、风雷阁', desc:'大陆中心，强者如云，一塔一殿二宗三谷四方阁' },
  jiama: { name:'加玛帝国', danger:'低', energy:'中等', factions:'萧家、云岚宗、炼药师公会', desc:'西北大陆上的帝国，当前所在地' },
  chuyun: { name:'出云帝国', danger:'中', energy:'中等', factions:'毒宗、万蝎门', desc:'以毒术闻名的帝国' },
  heijiao: { name:'黑角域', danger:'高', energy:'浓郁', factions:'黑皇宗、魔炎谷', desc:'混乱之地，无法无天' },
  northwest: { name:'西北大陆', danger:'中', energy:'稀薄', factions:'各帝国势力', desc:'大陆西北边陲，修炼资源匮乏' },
  dian: { name:'魂殿', danger:'致命', energy:'诡异', factions:'魂殿·魂族', desc:'大陆最神秘的势力，收集强大灵魂' }
};

function openRegionDetail(regionId) {
  const r = REGION_DATA[regionId];
  if (!r) return;
  showModal(`
    <h3 style="margin-bottom:12px;">${r.name}</h3>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:13px;">
      <div><span style="color:var(--text-muted);">危险等级：</span><span style="color:var(--accent-fire);">${r.danger}</span></div>
      <div><span style="color:var(--text-muted);">能量浓度：</span><span>${r.energy}</span></div>
      <div style="grid-column:1/-1;"><span style="color:var(--text-muted);">势力分布：</span><span>${r.factions}</span></div>
      <div style="grid-column:1/-1;margin-top:8px;color:var(--text-body);">${r.desc}</div>
    </div>
  `);
}
```

- [ ] **Step 6: Verify world map**

Enter game. Should see: top info bar (coordinates/time/energy/realm), map with 6+ regions styled as ellipses, player gold dot pulsing at Jia Ma Empire, and "探索" button. Clicking regions opens detail modal.

---

### Task 8: Game World — Studio (Cultivation Base) + Personnel Pages

**Files:**
- Modify: `C:\Users\Administrator\index.html` (studio + personnel HTML gen)

- [ ] **Step 1: Build studio page**

```javascript
function buildStudio() {
  const container = document.getElementById('game-view-studio');
  container.innerHTML = `
    <div style="padding:12px 20px;background:var(--bg-panel);border-bottom:1px solid var(--border-subtle);display:flex;justify-content:space-between;align-items:center;">
      <span style="font-family:var(--font-serif);color:var(--text-primary);font-size:15px;">修炼驻地 · 乌坦城萧家后院</span>
      <span style="color:var(--text-muted);font-size:11px;">驻地等级 Lv.1 · 3/8 房间</span>
    </div>
    <div style="flex:1;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;">
      <!-- Main layout: central courtyard + 3 rooms -->
      <div style="position:relative;width:700px;height:400px;">
        <!-- Courtyard -->
        <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:180px;height:120px;background:rgba(212,168,75,0.03);border:1px solid var(--border-subtle);border-radius:8px;display:flex;align-items:center;justify-content:center;">
          <span style="font-family:var(--font-serif);color:var(--text-muted);font-size:12px;">萧家后院</span>
        </div>
        <!-- Room 1: Meditation -->
        <div class="studio-room" style="top:30%;left:15%;" onclick="openRoomDetail('meditation')">
          <span class="room-name">闭关室</span>
          <span class="room-status">聚灵阵 · 一阶</span>
        </div>
        <!-- Room 2: Alchemy -->
        <div class="studio-room" style="top:20%;left:55%;" onclick="openRoomDetail('alchemy')">
          <span class="room-name">炼药房</span>
          <span class="room-status">药鼎 · 凡品</span>
        </div>
        <!-- Room 3: Martial Arts -->
        <div class="studio-room" style="top:65%;left:50%;" onclick="openRoomDetail('martial')">
          <span class="room-name">武技阁</span>
          <span class="room-status">功法 · 黄阶</span>
        </div>
        <!-- Expansion arrows -->
        <button class="expand-btn" style="top:10%;left:50%;" onclick="expandRoom('up')" title="拓建 · 洞天福地">⬆ 洞天福地</button>
        <button class="expand-btn" style="bottom:0;left:50%;" onclick="expandRoom('down')" title="拓建 · 地下密室">⬇ 地下密室</button>
        <button class="expand-btn" style="top:50%;left:0;" onclick="expandRoom('left')" title="拓建 · 西厢院落">⬅ 西厢</button>
        <button class="expand-btn" style="top:50%;right:0;" onclick="expandRoom('right')" title="拓建 · 东厢院落">➡ 东厢</button>
      </div>
    </div>
  `;
}
```

- [ ] **Step 2: Studio room CSS + interaction**

```css
.studio-room {
  position:absolute;width:120px;height:80px;
  background:var(--bg-card);border:1px solid var(--border-gold);
  border-radius:6px;display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:4px;
  cursor:pointer;transition:all var(--transition-normal);
  transform:translate(-50%,-50%);
}
.studio-room:hover { box-shadow:var(--shadow-gold);transform:translate(-50%,-50%) translateY(-2px); }
.room-name { color:var(--text-primary);font-family:var(--font-serif);font-size:13px; }
.room-status { color:var(--text-muted);font-size:10px; }
.expand-btn {
  position:absolute;padding:4px 10px;background:transparent;
  border:1px dashed var(--border-subtle);color:var(--text-dim);
  font-size:10px;font-family:var(--font-serif);cursor:pointer;
  transform:translate(-50%,-50%);transition:all var(--transition-normal);
}
.expand-btn:hover { border-color:var(--border-gold);color:var(--text-primary); }
```

- [ ] **Step 3: Room detail modal + expansion modal**

```javascript
const ROOM_DATA = {
  meditation: { name:'闭关室', user:'萧炎', device:'聚灵阵·一阶', effect:'修炼速度+10%', desc:'基础修炼场所，以灵石驱动聚灵阵，汇聚天地斗气' },
  alchemy: { name:'炼药房', user:'药老', device:'药鼎·凡品', effect:'炼药成功率+5%', desc:'炼制丹药之所，配备基础药鼎与药材柜' },
  martial: { name:'武技阁', user:'萧炎', device:'功法·黄阶低級', effect:'武技修炼速度+10%', desc:'存放功法武技的阁楼，目前仅收錄黄阶功法' }
};

function openRoomDetail(type) {
  const r = ROOM_DATA[type];
  showModal(`
    <h3 style="margin-bottom:12px;">${r.name}</h3>
    <div style="font-size:13px;display:flex;flex-direction:column;gap:6px;">
      <div><span style="color:var(--text-muted);">使用人员：</span><span>${r.user}</span></div>
      <div><span style="color:var(--text-muted);">设备信息：</span><span>${r.device}</span></div>
      <div><span style="color:var(--text-muted);">当前效果：</span><span style="color:var(--accent-green);">${r.effect}</span></div>
      <div style="color:var(--text-body);margin-top:8px;">${r.desc}</div>
    </div>
  `);
}

function expandRoom(dir) {
  const names = { up:'洞天福地', down:'地下密室', left:'西厢院落', right:'东厢院落' };
  showToast('拓建「'+names[dir]+'」需要：灵石×500，木材×200，解锁条件 Lv.5');
}
```

- [ ] **Step 4: Build personnel page**

```javascript
function buildPersonnel() {
  const container = document.getElementById('game-view-personnel');
  const chars = [
    { name:'萧炎', realm:'斗者·三星', skill:'焚决', soul:'凡境中期', fire:'—', loyalty:100, avatar:'萧' },
    { name:'药老', realm:'斗尊（残魂）', skill:'炼药术·宗师', soul:'天境', fire:'骨灵冷火', loyalty:95, avatar:'药' },
    { name:'萧薰儿', realm:'斗者·五星', skill:'金帝焚天炎', soul:'凡境后期', fire:'金帝焚天炎', loyalty:100, avatar:'薰' }
  ];
  container.innerHTML = `
    <div style="padding:12px 20px;background:var(--bg-panel);border-bottom:1px solid var(--border-subtle);display:flex;justify-content:space-between;">
      <span style="font-family:var(--font-serif);color:var(--text-primary);font-size:15px;">人员管理</span>
      <span style="color:var(--text-muted);font-size:11px;">共 ${chars.length} 人</span>
    </div>
    <div style="flex:1;overflow-y:auto;padding:20px;">
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px;">
        ${chars.map(c => `
          <div class="personnel-card" onclick="openCharacterDetail('${c.name}')">
            <!-- Avatar -->
            <div style="display:flex;align-items:center;gap:14px;">
              <div class="char-avatar">
                <span>${c.avatar}</span>
              </div>
              <div>
                <div style="color:var(--text-primary);font-family:var(--font-serif);font-size:15px;">${c.name}</div>
                <div style="color:var(--text-secondary);font-size:11px;">${c.realm}</div>
              </div>
            </div>
            <!-- Stats -->
            <div style="margin-top:12px;display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:11px;">
              <div><span style="color:var(--text-muted);">功法：</span><span>${c.skill}</span></div>
              <div><span style="color:var(--text-muted);">灵魂力：</span><span>${c.soul}</span></div>
              <div style="grid-column:1/-1;"><span style="color:var(--text-muted);">异火：</span><span style="color:${c.fire==='—'?'var(--text-dim)':'var(--accent-fire)'};">${c.fire}</span></div>
              <div style="grid-column:1/-1;">
                <span style="color:var(--text-muted);">忠诚度：</span>
                <span style="color:${c.loyalty>=90?'var(--accent-green)':'var(--accent-fire)'};">${'█'.repeat(Math.floor(c.loyalty/10))}${'░'.repeat(10-Math.floor(c.loyalty/10))} ${c.loyalty}</span>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}
```

- [ ] **Step 5: Character card CSS**

```css
.char-avatar {
  width:48px;height:48px;clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%);
  background:linear-gradient(135deg,var(--bg-hover),var(--bg-card));
  border:1px solid var(--border-gold);display:flex;align-items:center;justify-content:center;
}
.char-avatar span {
  font-family:var(--font-serif);font-size:18px;color:var(--text-primary);
}
.personnel-card {
  background:var(--bg-card);border:1px solid var(--border-subtle);
  padding:16px;border-radius:8px;cursor:pointer;
  transition:all var(--transition-normal);
}
.personnel-card:hover { border-color:var(--border-gold);transform:translateY(-2px);box-shadow:var(--shadow-gold); }
```

- [ ] **Step 6: Verify studio + personnel**

Switch to "驻地": see courtyard + 3 rooms with names/status, 4 expansion arrows. Clicking rooms shows detail modal. Switch to "人员": see character cards with hexagonal avatars, stats, loyalty bars.

---

### Task 9: Modal System + Settings + LLM Chat Panel

**Files:**
- Modify: `C:\Users\Administrator\index.html` (modal system, settings, LLM panel HTML/CSS/JS)

- [ ] **Step 1: Build universal modal system**

```javascript
function showModal(content) {
  const container = document.getElementById('modals-container');
  const id = 'modal-'+Date.now();
  container.innerHTML += `
    <div class="modal-overlay" id="${id}" onclick="if(event.target===this)closeModal('${id}')">
      <div class="modal-content">
        <button class="modal-close" onclick="closeModal('${id}')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
        ${content}
      </div>
    </div>
  `;
  requestAnimationFrame(() => {
    document.getElementById(id).classList.add('show');
  });
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 250);
  }
}
```

- [ ] **Step 2: Add modal CSS**

```css
.modal-overlay {
  position:fixed;top:0;left:0;width:100%;height:100%;
  background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);
  display:flex;align-items:center;justify-content:center;
  z-index:var(--z-modal);opacity:0;transition:opacity var(--transition-normal);
  pointer-events:none;
}
.modal-overlay.show { opacity:1;pointer-events:all; }
.modal-content {
  background:var(--bg-panel);border:1px solid var(--border-gold);
  border-radius:8px;padding:24px;min-width:360px;max-width:560px;
  max-height:80vh;overflow-y:auto;position:relative;
  transform:scale(0.95);transition:transform var(--transition-normal);
}
.modal-overlay.show .modal-content { transform:scale(1); }
.modal-close {
  position:absolute;top:12px;right:12px;background:transparent;
  color:var(--text-dim);padding:4px;border-radius:4px;transition:all var(--transition-fast);
}
.modal-close:hover { color:var(--text-primary);background:rgba(212,168,75,0.1); }
```

- [ ] **Step 3: Settings modal (API config + system rules)**

```javascript
function openSettings() {
  showModal(`
    <h3 style="margin-bottom:16px;">设置</h3>
    <div style="display:flex;flex-direction:column;gap:20px;">
      <!-- API Configuration -->
      <div>
        <h4 style="color:var(--text-primary);margin-bottom:12px;">API 配置</h4>
        <div id="api-list" style="margin-bottom:12px;">
          ${(GameState.settings.apis||[]).map((api,i) => `
            <div class="api-entry" style="display:flex;gap:8px;align-items:center;padding:8px;background:var(--bg-card);border-radius:4px;margin-bottom:6px;border:1px solid ${api.id===GameState.settings.activeApi?'var(--border-gold)':'var(--border-subtle)'};">
              <span style="flex:1;font-size:12px;color:var(--text-body);">${api.name} — ${api.url}</span>
              <button class="text-btn" onclick="setActiveApi('${api.id}')">${api.id===GameState.settings.activeApi?'● 活跃':'设为默认'}</button>
              <button class="text-btn danger" onclick="removeApi('${api.id}')">删除</button>
            </div>
          `).join('')}
        </div>
        <button class="add-api-btn" onclick="addApiForm()">+ 添加 API 接口</button>
      </div>
      <!-- System Rules -->
      <div>
        <h4 style="color:var(--text-primary);margin-bottom:12px;">正文规则</h4>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
          <span style="font-size:12px;color:var(--text-body);">启用自定义规则</span>
          <label class="toggle-switch">
            <input type="checkbox" id="toggle-custom-rules" ${GameState.settings.useCustomRules?'checked':''} onchange="toggleCustomRules(this.checked)">
            <span class="toggle-slider"></span>
          </label>
          <span style="font-size:10px;color:var(--text-muted);">关闭时使用当前版本内置默认</span>
        </div>
        <textarea id="system-rules-input" class="form-input" rows="6" placeholder="输入正文规则..." 
          style="resize:vertical;font-size:12px;${GameState.settings.useCustomRules?'':'opacity:0.5;'}"
          ${GameState.settings.useCustomRules?'':'disabled'}>${GameState.settings.systemRules||''}</textarea>
        <p style="font-size:10px;color:var(--text-muted);margin-top:4px;">规则不写回主聊天预设 · 发送时作为独立 system 消息注入</p>
      </div>
    </div>
  `);
}

function toggleCustomRules(enabled) {
  GameState.settings.useCustomRules = enabled;
  const ta = document.getElementById('system-rules-input');
  if (ta) { ta.disabled = !enabled; ta.style.opacity = enabled ? '1' : '0.5'; }
  if (!enabled) {
    GameState.settings.systemRules = '';
    if (ta) ta.value = '';
  }
}
```

- [ ] **Step 4: Add toggle CSS + API management JS**

```css
.toggle-switch { position:relative;display:inline-block;width:40px;height:22px; }
.toggle-switch input { opacity:0;width:0;height:0; }
.toggle-slider {
  position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;
  background:var(--bg-card);border:1px solid var(--border-subtle);
  border-radius:22px;transition:all var(--transition-fast);
}
.toggle-slider::before {
  content:'';position:absolute;height:16px;width:16px;left:2px;bottom:2px;
  background:var(--text-dim);border-radius:50%;transition:all var(--transition-fast);
}
input:checked + .toggle-slider { border-color:var(--border-gold);background:rgba(212,168,75,0.1); }
input:checked + .toggle-slider::before { background:var(--text-primary);transform:translateX(18px); }
.add-api-btn {
  width:100%;padding:8px;background:transparent;border:1px dashed var(--border-subtle);
  color:var(--text-muted);font-family:var(--font-serif);font-size:12px;
  border-radius:4px;cursor:pointer;transition:all var(--transition-fast);
}
.add-api-btn:hover { border-color:var(--border-gold);color:var(--text-primary); }
.text-btn { background:transparent;border:none;color:var(--text-secondary);font-size:11px;cursor:pointer; }
.text-btn:hover { color:var(--text-primary); }
.text-btn.danger { color:#883333; }
.text-btn.danger:hover { color:#cc4444; }
```

- [ ] **Step 5: LLM chat panel**

```javascript
function initLLMPanel() {
  const panel = document.getElementById('llm-panel');
  panel.innerHTML = `
    <!-- Trigger button -->
    <button id="llm-trigger" style="position:fixed;bottom:24px;right:24px;width:48px;height:48px;background:var(--bg-card);border:1px solid var(--border-gold);border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:var(--z-llm);transition:all var(--transition-normal);" onclick="toggleLLM()">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#d4a84b" stroke-width="1.5">
        <path d="M12 2C6.5 2 2 6.5 2 12s4.5 7 10 5c0 0 3 3 6 2 0 0-1-3 1-7s1-10-7-10z"/>
      </svg>
      <div class="llm-pulse"></div>
    </button>
    <!-- Chat panel (hidden by default) -->
    <div id="llm-chat-panel" style="position:fixed;bottom:0;right:16px;width:420px;height:520px;background:var(--bg-panel);border:1px solid var(--border-gold);border-bottom:none;border-radius:12px 12px 0 0;display:none;flex-direction:column;z-index:calc(var(--z-llm)-1);box-shadow:0 -4px 30px rgba(0,0,0,0.5);">
      <!-- Header -->
      <div style="padding:12px 16px;border-bottom:1px solid var(--border-subtle);display:flex;justify-content:space-between;align-items:center;">
        <span style="font-family:var(--font-serif);color:var(--text-primary);font-size:13px;">修炼助手</span>
        <span style="font-size:10px;color:var(--text-muted);">当前：乌坦城 · 萧家后院</span>
        <button onclick="toggleLLM()" style="background:transparent;color:var(--text-dim);cursor:pointer;font-size:14px;">✕</button>
      </div>
      <!-- Messages -->
      <div id="llm-messages" style="flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:10px;">
        <div class="msg ai">欢迎来到斗气大陆。我是你的修炼助手，有什么可以帮你的？</div>
      </div>
      <!-- Quick commands -->
      <div style="padding:8px 12px;display:flex;gap:6px;flex-wrap:wrap;border-top:1px solid var(--border-subtle);">
        <button class="quick-cmd" onclick="sendQuickCmd('开始修炼')">开始修炼</button>
        <button class="quick-cmd" onclick="sendQuickCmd('查看地图')">查看地图</button>
        <button class="quick-cmd" onclick="sendQuickCmd('炼药')">炼药</button>
        <button class="quick-cmd" onclick="sendQuickCmd('探索周边')">探索周边</button>
        <button class="quick-cmd" onclick="sendQuickCmd('角色状态')">角色状态</button>
      </div>
      <!-- Input -->
      <div style="padding:10px 12px;border-top:1px solid var(--border-subtle);display:flex;gap:8px;">
        <input id="llm-input" class="form-input" placeholder="输入指令..." style="flex:1;font-size:12px;" onkeydown="if(event.key==='Enter')sendLLMMessage()">
        <button onclick="sendLLMMessage()" style="padding:6px 14px;background:rgba(212,168,75,0.1);border:1px solid var(--border-gold);color:var(--text-primary);border-radius:4px;font-size:12px;">发送</button>
      </div>
    </div>
  `;
}
```

- [ ] **Step 6: LLM chat JS**

```javascript
function toggleLLM() {
  const panel = document.getElementById('llm-chat-panel');
  panel.style.display = panel.style.display === 'flex' ? 'none' : 'flex';
}

function sendQuickCmd(cmd) {
  document.getElementById('llm-input').value = cmd;
  sendLLMMessage();
}

const LLM_MOCK_RESPONSES = {
  '开始修炼': '好的，已为你开启闭关修炼模式。当前修炼室聚灵阵运转正常，预计修炼效率为基础值的110%。是否立即开始？',
  '查看地图': '当前位于加玛帝国乌坦城。周边可探索区域：魔兽山脉（危险★★）、塔戈尔大沙漠（危险★★★）、黑角域（危险★★★★）。建议斗者五星以上再探索魔兽山脉。',
  '炼药': '当前炼药房配备凡品药鼎。可炼制丹药：聚气散（基础）、凝血散（基础）、回气丹（一阶）。需要消耗对应药材。是否开始炼制？',
  '探索周边': '正在扫描周边区域...发现乌坦城集市有药材摊位，拍卖行正在筹备本月拍卖会。建议前往集市补充修炼资源。',
  '角色状态': `当前角色：${GameState.player.name||'未知'}，境界：斗者·三星，斗气属性：${GameState.player.douqiAttributes.join('、')||'无'}，下一境界所需经验：500/1000`
};

function sendLLMMessage() {
  const input = document.getElementById('llm-input');
  const msg = input.value.trim();
  if (!msg) return;
  const container = document.getElementById('llm-messages');
  container.innerHTML += `<div class="msg user">${msg}</div>`;
  input.value = '';
  container.scrollTop = container.scrollHeight;
  // Mock AI response with typing effect
  const response = LLM_MOCK_RESPONSES[msg] || '收到。「'+msg+'」——此功能正在完善中，请尝试快捷指令或重新描述你的需求。';
  const msgDiv = document.createElement('div');
  msgDiv.className = 'msg ai typing';
  container.appendChild(msgDiv);
  let i = 0;
  const interval = setInterval(() => {
    msgDiv.textContent += response[i];
    container.scrollTop = container.scrollHeight;
    i++;
    if (i >= response.length) { clearInterval(interval); msgDiv.classList.remove('typing'); }
  }, 30);
}
```

- [ ] **Step 7: Chat CSS**

```css
.llm-pulse {
  position:absolute;width:100%;height:100%;border-radius:50%;
  border:1px solid var(--border-gold);animation:llm-pulse 2s infinite;
}
@keyframes llm-pulse {
  0%,100% { transform:scale(1);opacity:0.3; }
  50% { transform:scale(1.3);opacity:1; }
}
.msg { padding:8px 12px;border-radius:8px;font-size:12px;max-width:85%;line-height:1.5; }
.msg.ai { background:var(--bg-card);border:1px solid var(--border-subtle);color:var(--text-body);align-self:flex-start;border-left:2px solid #888; }
.msg.user { background:rgba(212,168,75,0.08);border:1px solid var(--border-gold);color:var(--text-primary);align-self:flex-end;border-right:2px solid var(--text-primary); }
.msg.typing::after { content:'▍';animation:blink 0.6s infinite;color:var(--text-primary); }
@keyframes blink { 0%,100%{opacity:1;} 50%{opacity:0;} }
.quick-cmd {
  padding:4px 10px;background:var(--bg-card);border:1px solid var(--border-subtle);
  color:var(--text-secondary);font-size:10px;border-radius:12px;cursor:pointer;transition:all var(--transition-fast);
}
.quick-cmd:hover { border-color:var(--border-gold);color:var(--text-primary); }
```

- [ ] **Step 8: Verify modals + settings + LLM**

Open settings from title/game: API management list, system rules toggle+textarea. LLM panel: click bottom-right glowing fire button, chat panel slides up, send messages see typing animation, quick commands work.

---

### Task 10: Toast Notifications + Animations Polish + Edge Cases

**Files:**
- Modify: `C:\Users\Administrator\index.html` (toast system, missing functions, final polish)

- [ ] **Step 1: Toast notification system**

```javascript
function showToast(msg, type='info') {
  const container = document.getElementById('notifications-container');
  const id = 'toast-'+Date.now();
  const colors = { info:'var(--border-gold)', success:'var(--accent-green)', warning:'#ffaa00', error:'#cc4444' };
  const icons = { info:'ℹ', success:'✓', warning:'⚠', error:'✕' };
  const toast = document.createElement('div');
  toast.id = id;
  toast.style.cssText = `
    pointer-events:all;display:flex;align-items:center;gap:8px;
    padding:10px 16px;background:var(--bg-panel);border:1px solid ${colors[type]};
    border-radius:6px;font-size:12px;color:var(--text-body);
    animation:toast-in 0.3s ease-out;max-width:320px;
    box-shadow:0 4px 16px rgba(0,0,0,0.4);
  `;
  toast.innerHTML = `<span style="color:${colors[type]};">${icons[type]}</span> ${msg}`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'toast-out 0.3s ease-in forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
```

- [ ] **Step 2: Toast CSS animations**

```css
@keyframes toast-in { from{transform:translateX(100%);opacity:0;} to{transform:translateX(0);opacity:1;} }
@keyframes toast-out { from{transform:translateX(0);opacity:1;} to{transform:translateX(100%);opacity:0;} }
```

- [ ] **Step 3: Wire missing title screen functions**

```javascript
function continueGame() {
  if (!GameState.player.name) { showToast('暂无存档', 'warning'); return; }
  showView('view-game');
  GameState.phase = 'game';
}

function openChangelog() {
  showModal(`
    <h3 style="margin-bottom:12px;">更新日志</h3>
    <div style="font-size:12px;color:var(--text-body);line-height:1.8;">
      <div style="color:var(--text-primary);">v0.1.0 · 三一六纪元</div>
      <div>· 斗气大陆初现，大世界地图开放</div>
      <div>· 乌坦城萧家后院修炼驻地落成</div>
      <div>· 开放11族选择、50天赋词条</div>
      <div>· 修炼助手（AI）上线</div>
    </div>
  `);
}

function openAbout() {
  showModal(`
    <h3 style="margin-bottom:12px;">关于</h3>
    <div style="font-size:12px;color:var(--text-body);line-height:1.8;">
      <div style="color:var(--text-primary);font-size:15px;">斗破苍穹 · 修炼模拟</div>
      <div>基于《斗破苍穹》世界观的修炼模拟游戏</div>
      <div style="margin-top:8px;color:var(--text-muted);">前端原型 · 纯 HTML/CSS/JS</div>
    </div>
  `);
}

function exploreWorld() {
  const regions = ['jiama','chuyun','heijiao','northwest'];
  const r = REGION_DATA[regions[Math.floor(Math.random()*regions.length)]];
  showToast(`探索触发：发现${r.name}附近有灵力波动...`, 'info');
}

function openCharacterDetail(name) {
  showModal(`<h3>${name}</h3><p style="color:var(--text-muted);">详细角色面板将在后续版本中开放</p>`);
}

function addApiForm() {
  const name = prompt('API 名称（如：OpenAI / Claude）：');
  if (!name) return;
  const url = prompt('API 地址：');
  if (!url) return;
  GameState.settings.apis = GameState.settings.apis || [];
  const api = { id:'api-'+Date.now(), name, url };
  GameState.settings.apis.push(api);
  if (!GameState.settings.activeApi) GameState.settings.activeApi = api.id;
  showToast('API 接口已添加', 'success');
  // Refresh settings modal if open
  const overlay = document.querySelector('.modal-overlay.show');
  if (overlay) overlay.remove();
  openSettings();
}

function setActiveApi(id) { GameState.settings.activeApi = id; showToast('已切换活跃 API', 'success'); }
function removeApi(id) {
  GameState.settings.apis = GameState.settings.apis.filter(a => a.id !== id);
  if (GameState.settings.activeApi === id) GameState.settings.activeApi = GameState.settings.apis[0]?.id || null;
  showToast('API 接口已删除', 'info');
}
```

- [ ] **Step 4: Add global animation refinements**

```css
/* Smooth page transitions */
.view {
  transition: opacity var(--transition-normal);
  opacity: 0;
}
.view.active {
  opacity: 1;
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}

/* Selection styling */
::selection { background: rgba(212,168,75,0.3);color: var(--text-primary); }
```

- [ ] **Step 5: Verify complete flow end-to-end**

Test full flow: Open index.html → Title screen with particles → Open settings/change log/about → Start new game → Step 0 (name/gender/age/difficulty) → Step 1 (11 races) → Step 2 (4 identities) → Step 3 (6 stats + 9 performance) → Step 4 (50 talents + 12 attributes) → Confirm → Game world → Switch between map/studio/personnel → Open LLM panel → Send commands → Region detail modals → Toast notifications.

- [ ] **Step 6: Fix all remaining edge cases**

Add defensive checks throughout:
- `showToast` available globally  
- `showModal` available globally
- All event handlers defined before DOM elements reference them
- Update `creationNext` function with all steps wired
- Ensure `initGameWorld()` is called after view-game becomes active
- Add `continueGame` function for "继续人生" button
- Wire settings toggle correctly

---

### Completion Checklist

- [ ] Title screen renders with particles, 5 menu buttons
- [ ] Settings modal (API config + system rules toggle + textarea)
- [ ] Change log and About modals
- [ ] Character creation: Step 0 (name, gender, age, difficulty)
- [ ] Character creation: Step 1 (11 races with coefficients)
- [ ] Character creation: Step 2 (4 identities)
- [ ] Character creation: Step 3 (6 base stats 0-20 + 9 performance stats auto-calc)
- [ ] Character creation: Step 4 (50 talents across 5 tiers + 12 douqi attributes)
- [ ] Points system: difficulty → available points, recalculate on every selection
- [ ] Validation before confirm (all required fields)
- [ ] Game world: sidebar navigation with 3 tabs + settings gear
- [ ] Game world: world map with 6+ regions, player marker, explore button
- [ ] Game world: studio with 3 rooms, expansion arrows
- [ ] Game world: personnel with character cards, hexagonal avatars
- [ ] Region detail modal
- [ ] Room detail modal
- [ ] LLM chat panel (trigger button, slide-up panel, quick commands, typing animation)
- [ ] Toast notifications (info/success/warning/error)
- [ ] All modals close with X or overlay click
- [ ] prefers-reduced-motion respected
- [ ] All text in Chinese, no emoji icons (SVG used)
- [ ] Google Fonts loaded (Noto Serif SC + Noto Sans SC)
