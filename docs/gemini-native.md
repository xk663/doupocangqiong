# Gemini 原生接入

主聊天及美人榜独立 API 均支持 Gemini 原生协议。现有 OpenAI、Ollama、KoboldCPP 配置不变，不自动改写已有接口类型或迁移密钥。

## 本机 AI Studio 反代

1. 保持反代运行在 `http://localhost:8080`。
2. 在项目目录运行 `node tools/serve.cjs`，打开 `http://127.0.0.1:8090/`。默认仅监听127.0.0.1；可用环境变量PORT指定其他本机端口。
3. 设置 → 核心添加接口，选择“Gemini 原生 / AI Studio 反代”；美人榜独立接口则在“人物动态”中配置。
4. 地址填写反代根地址或 `/v1beta`，模型填写服务支持的模型标识，Key填写在密码栏。
5. 如果反代未允许跨域，开启“本机反代同源通道”；否则可以直接请求。思考级别可选默认、低、中、高。Gemini 2.5使用默认，4 Argon及3.8不支持minimal。
6. 保存配置。主聊天接口需选择“用于主聊天”，美人榜独立接口需开启自动更新。

同源通道固定转发到本机 `http://localhost:8080` 的 Gemini 模型查询与生成端点，不接受远程目的地址，不读取skill凭据，也不保存Key、请求正文或生成结果。密钥由页面每次请求传入，页面原有的配置持久化规则不变。

静态部署或普通HTTP文件服务器不会自动提供这个同源通道。GitHub Pages不能直接使用本机通道；需在本机运行上述服务，或使用允许浏览器跨域的接口。不要通过关闭浏览器安全检查解决跨域。

## 协议与兼容边界

- 查询使用 `/v1beta/models`；生成使用 `:generateContent`；流式使用 `:streamGenerateContent?alt=sse`，认证头为 `x-goog-api-key`，不是OpenAI的Bearer与chat/completions路径。
- 根地址、`/v1beta`、旧`/v1`及完整原生生成地址会归一化。Key查询参数不被接受，密钥应单独填入Key栏。
- 开头system/developer消息进入systemInstruction；assistant映射为model，相邻同角色保留顺序合并parts。历史中后置system/developer消息作为带“系统补充”标记的user文本保留原位置；Gemini没有完全等价的中途system角色，因此不声称其权限与OpenAI完全相同。
- max_tokens映射到maxOutputTokens，temperature与top_p分别映射原生字段，未支持的OpenAI惩罚参数不发送。思考级别映射thinkingConfig.thinkingLevel，人物提取启用JSON响应格式。
- 思考文本及签名不进入可见正文；流式以STOP和传输结束共同判断完整性，不依赖OpenAI的DONE标记。MAX_TOKENS、拦截、缺正文及中断均报错，不将半截回复提交为游戏回合；美人榜保留旧档案。
- 当前只支持文本消息，不支持Gemini工具调用、图片输入或思考签名跨轮恢复。

回归测试：`node --test tests/*.test.cjs`。原生适配与固定同源通道均有模拟测试，测试夹具使用假密钥；真实凭据及诊断结果不存入仓库。
