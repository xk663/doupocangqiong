# 大陆地区扩展验收清单

本次范围以用户确认的「全部 43 处，每处至少 6 个分支」为准。

- [x] 编制 43 个地区、261 处分支；乌坦城 8 处，青山镇 7 处（含原有隐秘岩隙），其他地区至少 6 处。
- [x] 40 个新增地区使用各自的地图与道路布局；原有 3 个地区沿用其布局并补足分支。
- [x] 编制每处地点的独立画景地址和地点行动；私人乌坦清居保留居所权限体系。
- [x] 所有 43 个大陆地名在最小缩放显示完整文字；碰撞避让和引线适配 Pixi 与轻量模式。
- [x] 将预览与实际进入分开；预览不移动角色、不消耗资源、不增加访问记录。
- [x] 原存档的大陆百分比坐标、既有地点 ID、隐秘入口与境界门槛保留。
- [x] 四套飞行图集重新生成，并为 48 帧编制完整人物边界；移除额外飞行拖尾。
- [x] 全部 293 张新增地区／地点画景完成生成和压缩。
- [x] 逐地区检查画景、地点对应、热点、移动与驻地草稿；重做 3 处画景并校准热点。
- [x] 发布到两个前端入口并运行完整测试。
- [x] 在浏览器检查 Pixi、轻量模式、390 像素窄屏和连续切换，保存验收截图。

## 单一目录与加载方式

`tools/author-world-regions.cjs` 是地区、分支和画景提示词的可编辑来源，生成 `tools/data/world-regions.json`。`tools/compile-world-regions.cjs` 编译游戏数据、Tiled 锚点与地点画景／交互登记。不要在编译产物中分别维护同一地点。

画景使用内置 imagegen 生成；每个最终地点单独生成一张画景，原图保留在生成目录。WebP 文件保存在 `assets/images/regions/` 和 `assets/images/places/`。提示词、源图路径与压缩结果逐项记录在 `output/region-expansion/results/`。复核后替换的图使用新的版本文件名，保留旧文件。

43 个地区不会同时加载图像。地图只载入当前底图与当前人物图集，保留原有有界纹理缓存；侧栏和驻地页按当前地点载入画景。新地区不新增模型探测或聊天请求。

新增画景合计约 107.4 MiB，为完整资源目录的磁盘体积；不会一次下载到浏览器。实际图像哈希、字节数见 `docs/world-regions-art-manifest.json`，最终使用的生成提示词见 `docs/world-regions-art-prompts.json`。飞行图集的原图与提示词另见 `assets/data/flight-atlas-frames.json`。

隔离浏览器实测覆盖四人物 × 三形态连续切换、飞行左右移动和松键停步、轻量模式 43 个完整地名、地点画景与行动草稿对应，以及 390 像素窄屏的左右画卷控制。窄屏控制只移动视口，不移动角色。

最终全量测试：462 项通过，0 项失败。日志：`output/region-expansion/full-suite.txt`。浏览器检查记录与截图：`output/region-expansion/qa/`。Tiled 编译采用合并更新，保留对象 ID、自定义属性、编辑批注和额外图层，并补有专门的保留测试。

所有公共景物操作只拟定聊天草稿。点击不会自动购买、取得物品、进入宗门、获知秘密、推进旅行或获得居所产权。实际结算继续使用原有程序与正文规则。

## 生成与复核工具

- `node tools/author-world-regions.cjs`
- `node tools/compile-world-regions.cjs`：仅生成暂存数据，不发布。
- `node tools/region-art-gallery.cjs`：更新画景验收页。
- `node tools/publish-world-regions.cjs`：检查全部画景存在后发布数据、依赖与 Tiled 地点。
- `node --test tests/*.test.cjs`

隔离验收页为 `tests/fixtures/region-map-preview.html`，不读取真实存档、不写数据库、不调用聊天 API。画景总览为 `tests/fixtures/region-art-gallery.html`。
