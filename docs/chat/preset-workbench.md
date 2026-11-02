# 预设工作台

入口：设置 → 预设 → 编辑。工作台分为「采样与开关」「提示词编排」「请求与兼容报告」。修改保存在草稿内，只有 IndexedDB 完整保存成功后才替换运行中的预设；取消不修改已保存配置。

## 管理与编辑

- 列表支持搜索、选择、重命名、复制、删除和 JSON 导入导出。顶部同时显示默认预设与当前会话实际使用的预设；“用于当前会话并设为默认”明确更新这两个绑定。
- 提示词以紧凑条目呈现，每条有独立开关。关闭后变灰，正文和位置仍保留；保存后，该条目不再进入请求。重新启用即可恢复。没有复制参考截图中的条目名称或提示词正文。
- 条目支持拖拽和上下移动。相对位置遵循列表顺序；按聊天深度插入的条目仍遵循深度及注入顺序。标准标记可以关闭，不能从编排中移除；自定义条目可移回库中再插入。
- 点击条目名称在独立编辑区修改内容、角色、位置、深度和触发类型。触发类型不勾选表示全部；normal、regenerate、continue 可直接勾选，导入的其他触发类型仍保留并标注暂无入口。
- 显示未保存状态；关闭按钮、遮罩关闭、Escape 和编辑预设切换均提供“保存并继续／放弃并继续／继续编辑”。刷新或关闭网页使用浏览器的未保存提示。“另存为”创建新 ID，不覆盖来源预设。
- 删除前列出数据库中受影响的会话并要求选择替代预设。会话引用、默认绑定和删除在同一事务中完成；任一步写入失败全部回滚。保留至少一个预设。既有导出文件、历史存档快照不作批量改写。
- 预设绑定变化只更新数据库中的绑定字段，保留已持久化的玩家状态。生成中或恢复存档时不执行删除。

本轮验证：`node --test tests/*.test.cjs` 共 267 项通过。新增管理事务、草稿保护、另存为、排序、触发开关及真实请求组装测试。隔离浏览器页面已验证保存失败、关闭保护、逐条开关、拖拽、另存为和删除引用迁移；检查了桌面与 390px 手机视口，无控制台错误。测试使用内存数据及模拟响应，没有调用付费模型，也没有修改玩家浏览器存档。

## 酒馆对话补全格式

依据 SillyTavern 的 [Prompt Manager](https://docs.sillytavern.app/usage/prompts/prompt-manager/)、[Common Settings](https://docs.sillytavern.app/usage/common-settings/) 及 release 分支的 [openai.js](https://github.com/SillyTavern/SillyTavern/blob/release/public/scripts/openai.js)、[PromptManager.js](https://github.com/SillyTavern/SillyTavern/blob/release/public/scripts/PromptManager.js) 核对字段。

- 导入不再要求存在 temperature。prompts 与 prompt_order 的标识、顺序组、角色、启用状态、深度 0、注入顺序 0 均保留。
- 提示词库中未插入顺序组的块不自动发送；已关闭的块不进入请求。工作台可选择本游戏使用的顺序组，其他组随导出保留。
- 支持 system、user、assistant；相对位置 0、绝对位置 1。旧项目位置 6 仍按 D4 兼容，其他未知位置保留，不擅自解释为相对位置。
- 支持 normal、regenerate、continue 触发类型。其他生成类型保留，但当前游戏没有对应入口。
- 支持世界书、角色描述、性格、场景、Persona、示例、聊天历史等标准标记；main 与 jailbreak 可以按 forbid_overrides 控制角色卡覆盖。
- 世界书、场景与性格格式模板生效；连续 system 合并、空输入替代与续写引导已接入实际组装。
- 当前玩家输入始终保留一次；游戏状态协议、任务等运行规则仍由游戏层提供，不会因为导入预设丢失。Token 用量为估算，超限先裁去旧回合，并为输出预留额度。

## 参数发送

| 接口 | 映射范围 |
| --- | --- |
| OpenAI 兼容 | temperature、top_p、frequency_penalty、presence_penalty、max_tokens、seed、stop、logit_bias，以及非 auto 的 reasoning_effort、verbosity；具体模型仍可能限制参数 |
| Gemini 原生 | generationConfig 的 temperature、topP、topK、frequencyPenalty、presencePenalty、maxOutputTokens、seed、stopSequences；思考设置沿用 Gemini 模型校验；use_sysprompt 决定独立 systemInstruction |
| Ollama | options 中的 temperature、top_p、top_k、min_p、repeat_penalty、repeat_last_n、num_predict、num_ctx、seed、stop |
| Kobold | max_length、max_context_length、top_k、top_p、min_p、top_a、typical、tfs、rep_pen 及范围/斜率、Seed、停止序列、Mirostat 和已映射的扩展采样 |

常用采样项提供「发送」复选框。取消勾选后保留数值，但不把该字段送入请求。Seed -1、空停止词与 auto 推理设置使用服务端默认。Gemini 的 Top K 为 0 时不发送此字段。

Top A、Min P、重复惩罚、动态温度、DRY、XTC、Mirostat、采样器顺序等也可在工作台配置。「发送兼容扩展采样参数」用于明确支持相应扩展字段的 OpenAI 兼容服务，默认关闭。仅名称兼容不代表服务端接受全部字段，兼容报告与实际请求体会列出发送和未发送项。

## 当前边界

- 不是完整的 SillyTavern 运行时；第三方 STScript、宏扩展、正则插件、工具调用、联网、多媒体输入与模型生图没有随预设自动执行。
- 未实现的开关显示原因，导入值保留。当前每回合提交一个候选回复；n > 1、真正 Assistant 预填充、续写原回复拼接及连接符不生效。续写仍是独立且可回溯的叙事回合。
- 未识别的字段保留供导出，但不自动变为请求字段。接口地址、认证信息和本地 API 绑定不作为可分享预设配置执行；请在本机核心设置中配置连接。
- 导出为酒馆对话补全根结构，并在 extensions.doupo 中记录本项目的发送开关和顺序组选择。未知普通扩展字段保留，连接地址和凭据字段剔除。
- 预览不会调用模型，也不生成本轮骰池；当前已保存预设的最终 messages 和实际请求体可在请求检查器查看。模型服务仍可能拒绝其自身不支持的采样设置。

## 验证

`node --test tests/preset-core.test.cjs tests/tavern-core.test.cjs tests/gemini.test.cjs`；全部测试使用模拟响应。隔离页面 `tests/fixtures/presets.html` 使用内存数据，不读取主游戏存档、不调用真实 API。

导入默认采用酒馆对话补全的 100001 编排，只有不存在时才回退到 100000 或首组；手动选择和空编排保持有效。界面和请求共用顺序组解析。名称优先取文件内名称，否则取 JSON 文件名。字号调整为主要内容 16px、辅助说明至少 14px。双编排、关闭条目、命名及配置往返回归已覆盖，全套 270 项测试通过。
