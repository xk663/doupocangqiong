# 创角与原著规则修订

## 本轮范围

重做 `index.html` 的六步创角、导航和实时档案预览，衔接独立角色的聊天开局；没有重做大世界地图，也不宣称其他历史页面与全部世界书内容均已校勘。原有角色、种族、身份与天赋的存档ID保留。

## 六步流程

1. 落笔：姓名、成年角色年龄、性别、原著框架／自由演绎和难度点数。
2. 血脉：原著框架提供六类族群入口，具体血脉、化形、空间能力均标明限制；自由演绎保留原有扩展选项。
3. 出身：按行旅、传承、技艺筛选。将学院、丹塔等身份改为预备／求学起点，避免直接送出正式资源权限。
4. 根基：属性滑块、加减按钮、三组预设和实时表现属性。点数与倍率是游戏规则。
5. 天赋：按素质、修习、悟性、禀异、传说分类，用说明卡片替代密集标签。斗气属性直接选择，移除随机转盘；火中木气单独记录，作为炼药身份的必要属性条件。灵魂数值、配方与训练仍有要求。
6. 启程：乌坦城、青山镇、石漠城三个起点，以及三种免费行囊。最终校验并预览档案，移除数字规律题、答题奖励与贬低性的跳过文案。

创角草稿自动保存，刷新后「继续人生」会恢复创角步骤并重新计算预算。切换难度不能重置已花费点数；不能通过未完成步骤跳到游戏。选项变贵时检查预算，变便宜时允许逐项减配。

## 开局行为

- 独立角色以斗之气三段、凡境灵魂开始，这是本项目的开局设计，并非声称所有原著角色都如此。
- 根据所选地点设置位置、环境、离线开场和三个行动选项，根据行囊设置实际物品。
- 不默认赠送异火礼包、性转胶囊或用于直接升级的聚气散，不默认药老师承和薰儿关系。
- 使用明确标记的游戏纪年；原著没有「三一六纪元」这一已证历法。
- 原著框架开局盘缠使用金币，兼容存档仍保留旧银币、铜币、灵石字段。其他旧玩法中的相关经济系统本轮未整体迁移。
- 新人生清空该轮任务、回溯和修炼中的状态，保留已有命名存档和历史聊天。
- 新人生聊天拥有自己的叙事者角色卡，不覆盖用户保存／导入的全局角色卡。实际模型请求带入会话角色卡与当前地点。
- 未配置API时生成本地开场。该分支用于开局体验，不宣称已提供完整离线LLM。

## 原文资料的应用

依据本地1646章版本的分析，修正默认世界书中16条相关条目，涉及斗之气、九转与半圣、斗宗踏空、炼药条件、灵魂独立成长、焚决来源、聚气散用途、天墓层级、亡魂山脉、莽荒古域与部分异火。

每条附相应章号。旧默认世界书仅在关键词和正文与旧版完全一致时迁移，保留ID、禁用状态和插入设置；用户改过的条目、改名或导入的书不覆盖。其余条目仍需继续校勘，历史剧情与人物知识不能因为条目存在就视为开局全员知晓。

「太虚古龙」与本文件部分章节中的「太古虚龙」视作同一族群的字形／次序差异，不创建第二个种族。

## 美术

背景：`assets/images/creation-landscape.png`，使用内置 image_gen 工具新生成。图片用于侧栏山水，不包含文字；表单文字保持可选择、可访问的HTML。

最终生成提示词：

> Use case: stylized-concept. Asset type: background illustration for a premium Chinese fantasy RPG character creation webpage based on a cultivation and martial-arts world. Generate a tall portrait composition, approximate 2:3 aspect ratio. Refined hand-painted Chinese landscape concept art, sophisticated pale celadon and muted petrol teal mountains, luminous ivory mist, aged warm cream silk texture, tiny distant traditional Chinese mountain pavilion and winding stone stair, delicate dark pine silhouettes in foreground, soft morning sunlight and restrained antique gold accents. A quiet expansive landscape with subtle depth and intricate elegant brushwork, polished art direction, painterly not plastic 3D, no UI, no frame, no labels, no calligraphy, no text, no logo, no watermark. Bottom third layered jade mountains, centre drifting clouds, upper third atmospheric mountain silhouettes, unobtrusive overall so ivory interface cards can sit nearby. No humans or creatures. This is a real illustrated bitmap asset, not an interface screenshot.

## 验证

运行 `node --test tests/creation.test.cjs tests/tavern-core.test.cjs`。

自动验证预算、步骤校验、加减与预设、模式切换、炼药属性、禀赋效果与互斥、行囊和地点、姓名转义、开局隔离、离线开场、草稿恢复及世界书精确迁移。原有聊天回合、流式、存档、导入与用户异火测试继续运行。

浏览器使用独立8090端口验证，避免覆盖用户8086端口的实际存档与配置。检查桌面六步、刷新恢复和390×844窄屏，未调用真实付费模型。

最终47项测试全部通过；浏览器实际走通青山镇与石漠城开局，三个离线行动可点击，未观察到控制台错误。验证记录见 `creation-verification.json`。原有世界经济、驻地功能与全部角色条目仍是后续专项整理范围，不把本轮创角修订等同于整个项目已全面重制。
