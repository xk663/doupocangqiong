# 斗破苍穹 · 修炼模拟

> 基于《斗破苍穹》世界观的 AI 修炼模拟游戏 — 纯前端 HTML/CSS/JS 单文件应用

[![GitHub Pages](https://img.shields.io/badge/在线体验-GitHub%20Pages-brightgreen)](https://xk663.github.io/doupocangqiong/)
![License](https://img.shields.io/badge/license-MIT-blue)
![Version](https://img.shields.io/badge/version-v2.0-gold)

---

## 特性

| 模块 | 说明 |
|------|------|
| **AI 对话** | 酒馆式 LLM 聊天框架，支持多 API/多模型/流式输出 |
| **角色创建** | 5 步创角流程，11 族选择，50 天赋词条，斗气属性抽取 |
| **修炼系统** | 闭关修炼、炼药、武技研习、境界突破、修为结算卡 |
| **大世界地图** | Canvas 古风羊皮纸地图，拼图式多边形，滚轮缩放拖拽 |
| **世界书** | 261 条目，关键词匹配，递归触发，蓝灯/绿灯机制 |
| **存档管理** | 多槽位存档、导入导出、云备份（Discord Webhook） |
| **时空回溯** | 回合快照，变量回滚，一键回溯到任意历史回合 |
| **异火榜** | 23 种天地奇火完整排名与描述 |
| **美人榜** | 10 位红颜含隐秘描述 |
| **酒馆预设** | 提示词编辑、prompt_order 排序、采样参数配置 |
| **协议系统** | 5 大协议：状态栏、语义渲染、结算卡、战斗触发、自动推演 |

## 快速开始

1. 打开 `index.html`（需要 HTTP 服务器 — 直接用 `python -m http.server 8080` 或部署到 GitHub Pages）
2. 配置 API：标题页 → 设置 → 核心 → API 配置（支持 OpenAI / DeepSeek / Anthropic 等兼容接口）
3. 开启新人生或继续存档

## 项目结构

```
doupocangqiong/
├── index.html          # 主游戏页面（~500KB 单文件应用）
├── map.html            # 大地图独立页面
├── game.html           # 旧版游戏页面（备份）
├── assets/
│   ├── js/
│   │   ├── map-data.js         # 地图区域数据
│   │   ├── map-engine.js       # Canvas 地图引擎
│   │   ├── map-controls.js     # 地图交互控件
│   │   └── engine/MapEngine.js # 模块化地图引擎
│   ├── cover-a.png             # 封面图 A
│   ├── cover-b.png             # 封面图 B
│   └── cover-video.mp4         # 封面视频
├── demo/pipeline-demo.html     # 渲染管线演示
└── docs/superpowers/           # 设计规格文档
```

## 技术栈

- **前端**: 纯 HTML/CSS/JS（无框架依赖）
- **数据库**: IndexedDB（Dexie.js）+ localStorage 双写持久化
- **AI**: OpenAI 兼容 API 接口，流式 SSE 解析，自定义标签输出
- **地图**: Canvas 2D，粒子效果，古风羊皮纸渲染管线
- **字体**: Google Fonts（Noto Sans SC / Noto Serif SC / ZCOOL KuaiLe）

## 部署

### GitHub Pages（推荐）

```bash
# 在仓库 Settings → Pages → Source 选择 main 分支 → Save
# 访问 https://你的用户名.github.io/doupocangqiong/
```

### 本地运行

```bash
cd doupocangqiong
python -m http.server 8080
# 打开 http://localhost:8080
```

---

🤖 Built with [Claude Code](https://claude.com/claude-code)
