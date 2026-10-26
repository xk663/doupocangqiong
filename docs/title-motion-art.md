# 主界面书法字标与动态背景

字标由内置 image_gen 工具生成，素材为 `assets/images/title-calligraphy-logo.png`，2172 × 724，RGBA PNG。已检查角点 alpha 为 0。它作为独立图片叠加在页眉上；古族背景原图未修改。

主标题素材为 `assets/images/title-winged-wordmark.png`，2172 × 724，透明底。Q 版萧炎坐在“斗”字上、熏儿坐在“破”字上；左侧是萧炎的单扇青蓝斗气翼，右侧是熏儿的单扇柔金斗气翼。经用户确认后替换主标题，原背景保持独立。

鼠标拖尾已按用户要求移除。首页不再加载拖尾脚本和额外的 PixiJS 实例；地图仍使用自身的本地 PixiJS 依赖。背景动态保留衣发微动、花瓣、光照和薄雾，暂停、后台及离开标题页时停止更新。

主标题生图使用内置 image_gen 编辑上一版角色字标，约束为：保持“斗破苍穹”字形及两名角色身份、姿势和服饰，仅在字标两端各加一扇斗气翼；左青蓝、右淡金，以半透明气流、弯曲光丝和柔和雾气衔接文字，避免纸片、硬质羽毛和不透明面板，保留透明边缘。

## 生图提示原文

```text
Use case: logo-brand. Generate a standalone transparent-background PNG Chinese fantasy game masthead wordmark, NOT a whole interface or background scene. Exact main text, left to right: 「斗气大陆」. Smaller centered subtitle beneath: 「修行录」. All seven Chinese characters must be correctly written and legible. Premium authentic Chinese running-brush calligraphy, confident sweeping strokes, rich champagne gold metallic highlights and ivory gold edges, fine dark-teal ink shadow that stays attached to the lettering, subtle jade mist intertwined closely around the horizontal wordmark, a very sparse dusting of tiny gold sparks. Harmonious elegant xuanhuan literary game atmosphere, restrained luminous magical effects, sharp readable glyph silhouettes at 260px display width. Wide horizontal compact composition roughly 3:1 aspect ratio, tight but safe margins, all effects confined near letters. Actual transparent alpha everywhere except lettering and close decorative mist. No opaque rectangle, no paper, no black or white background, no scenery, no characters, no borders, no red square seal, no English, no extra words, no watermark. This will sit at top left over an existing sunset palace image; preserve ample transparent negative space around individual strokes.
```
