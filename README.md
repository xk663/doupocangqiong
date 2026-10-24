# 斗破苍穹 · 修炼模拟

> 基于《斗破苍穹》世界观的 AI 修炼模拟游戏 — 原生 HTML/CSS/JS 静态前端

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
├── index.html          # 主游戏页面
├── map.html            # 大地图独立页面
├── game.html           # 旧版游戏页面（备份）
├── assets/
│   ├── js/
│   │   ├── tavern-core.js      # 独立聊天内核：提示词、世界书、流式、导入与安全工具
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

## 聊天内核优化（2026-10-24）

本轮参考 [tavernlike-codex](https://github.com/xk663/tavernlike-codex) 的分层与验证流程，在现有原生前端上实现修订，没有引入 React 或构建依赖。

- 统一角色、世界书、预设排序与消息角色的组装；支持上下文容量设置，超限时裁剪旧对话并为回复预留空间。Token 用量为估算。
- 统一 OpenAI 兼容、Ollama 与 Kobold 请求；停止生成不再触发额外请求，过期回复不能覆盖已重置或切换的会话。
- 重演复用当前输入与生成前状态，不重复添加玩家消息或结算变量；旧回合没有快照时明确提示。
- 世界书递归匹配遵守禁用、次关键词、递归限制及预算；启动不再覆盖用户编辑的默认世界书。
- v2 存档包含聊天、变量、角色卡、预设、世界书、时空、经济、驻地与任务进度；导出和云备份剔除密钥及 Webhook。旧版存档仍可恢复其原有数据，但无法补回原本未保存的聊天。
- 设置 → 核心中填写自己的 Discord Webhook，点击时才上传聊天进度；不需要 Discord OAuth。历史版本公开的共享 Webhook 应由其持有人在 Discord 撤销，删除源码不会撤销凭据。
- 支持 JSON 角色卡和 PNG `chara`/`ccv3` tEXt 元数据；管理界面对角色、存档及相关预设字段做转义。

详情、兼容范围与验证记录见 [本轮优化说明](docs/chat-core-optimization.md)。`game.html` 和 `sillytavern.html` 为历史入口，本轮功能改动集中于 `index.html`；旧 `game.html` 仅移除了公开 Webhook。

### 界面与异火设定更新

- 首页、角色档案、聊天阅读区与推演工具栏采用新的山水、纸色与青玉视觉样式，兼顾窄屏布局。
- 按作者补充文档接入第18名风怒龙炎、第20名幽冥毒火、第21名阴阳双炎，同步异火榜和默认世界书，并修正第16–23名的错位。
- 旧默认世界书只迁移与旧版内容完全匹配的条目，保留启用状态；已编辑或导入的世界书不覆盖。详情见[异火修改说明](docs/user-flame-supplement.md)。

### 回归验证方法

安装 Node.js 20 或更高版本后，在项目目录执行，无需安装测试依赖：

```bash
node --test tests/creation.test.cjs tests/tavern-core.test.cjs
```

### 创角与开局更新

六步创角改为「落笔、血脉、出身、根基、天赋、启程」，采用山水插画、绢纸与青玉配色，支持实时档案预览和手机布局。移除数列答题、随机属性转盘及其奖励门槛，最后一步直接选择出发地点与行囊。

根据小说分析校正族群、炼药条件、斗气与灵魂体系及16条世界书内容。原著框架与自由演绎分开；独立角色不默认绑定药老、薰儿或萧家后院。地点、物品、属性与身份会传入实际聊天开局，创角草稿可刷新恢复。

制作方法、美术提示词、兼容范围与验证说明见[创角修订说明](docs/character-creation-redesign.md)。

### 山河行旅 · 交互大地图

主游戏侧栏「大世界」已接入新的探索地图。也可打开 `map.html` 使用独立演示存档。固定斜俯视插画支持平移、缩放、地点目录与路线预览，大陆总览和乌坦城、青山镇、石漠城四张底图按需加载。

地图角色使用四向三帧Q版动作图集：男性为萧炎形象，女性为薰儿形象。区域内点击地面、人物或地点直接寻路行走，支持WASD/方向键、镜头跟随、途中停步及靠近人物后的交谈浮窗；大陆旅行也有路线行走动画。步行坐标和实际消耗随角色保存。独立演示页可切换两种形象查看，主游戏按角色性别自动选择，保留自定义姓名和人物档案。

地图规则独立处理旅行、时间、精力、补给、日夜人物位置、交易、委托、探索线索和行旅记录，并与主游戏角色、聊天、存档及回溯衔接。LLM只接收已知地图事实，行动建议须玩家确认。当前包含79个地点节点、79条连接、6名原创地方人物；深度街区互动先覆盖三个出发地，其余区域为可扩展的地点与入口网络。

运行全部回归检查：`node --test tests/*.test.cjs`。地图架构、美术来源、Tiled编辑流程及现有限制见[大地图制作说明](docs/world-map.md)。
