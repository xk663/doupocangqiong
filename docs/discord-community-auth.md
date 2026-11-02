# Discord 社区授权接入

## 已确认的规则与当前进度

整个独立前端需要 Discord 登录，并确认已加入类脑社区。目标服务器 ID 为用户提供的 `1134557553011998840`，不要求任何身份组；尚未完成社区成员筛选时需先完成筛选。这个 ID 已作为服务端默认配置，不从社区名称或邀请链接推测。

第一步已完成代码和本机真实联调：独立的授权发布入口、官方 OAuth2 回调、服务端成员查询和页面／资源拦截。用户创建的 Application ID 为 `1515373618694066176`，Secret 仅保存在忽略提交的本机 `.env.discord` 中。2026-10-31 已将 8090 开发预览切换为授权入口，真实授权完成后通过类脑成员核验并自动返回首页，原有浏览器进度可正常读取。当前没有发布到公网。

后续第二步是用户授权自己的服务器／频道作为备份目的地；现有 Webhook 备份暂时沿用。登录成功不会自动创建备份频道、上传存档或替换已保存的 Webhook。频道授权需要单独取得 `webhook.incoming`；当前登录入口仅申请 `identify guilds.members.read`。

## 启动入口

- `node tools/serve.cjs`：本机开发预览，无社区门禁。不要将这个入口或原始静态文件目录公开用于受保护站点。
- `node --env-file=.env.discord tools/serve-discord.cjs`：社区授权入口。应用配置缺失时拒绝启动，不退回匿名访问。

`tools/discord-gate.cjs` 在可信服务端处理 code、随机 state、浏览器绑定、HttpOnly 会话 Cookie；`tools/discord-access.cjs` 查询 Discord 官方 `GET /users/@me/guilds/{guild.id}/member`。确认当前用户身份后才建立会话，不信任前端 `discordConnected` 或本地存储标记。

未授权时游戏入口、脚本、图片及 Gemini 同源通道均不放行；登录后只允许站点页面及 assets/maps 资源，不公开 tools、tests、文档、根目录备份或隐藏文件。登录失败和取消会跳转到不含授权 code 的固定路径。登录页不引入第三方图片、脚本或字体。

登录文档采用 `Referrer-Policy: same-origin`，避免 Chromium 原生表单因 `no-referrer` 将 POST Origin 变成 `null`。仍严格拒绝缺失、null 或异站 Origin；CSP 的 form-action 仅允许本站及 Discord 官方域名，以支持官方授权重定向。回调等重定向响应仍用 `no-referrer`。

回调失败会显示固定分类：会话校验、网络不可达／运行环境禁止联网、应用凭据、授权码或回调配置、Discord 服务异常等。终端诊断仅记录固定的事件名和原因枚举，不记录上游错误原文、响应体、Secret、code、Cookie 或访问令牌。如果浏览器可以打开 Discord 而 Node 返回 EACCES，需要检查启动 Node 的沙箱联网限制；浏览器与服务端的联网能力并不相同。

本机联调曾确认沙箱内 Node 请求 Discord 返回 EACCES；随后在允许联网的运行环境启动授权服务器并完成真实回调。诊断可包含固定的请求阶段（token/identity）及白名单网络错误码，不输出任意异常原文。临时网络失败时重新发起登录，旧授权码不能回放。

会话及访问令牌仅在服务器内存保存，最长一小时，服务重启需重新登录。每五分钟重新核验成员资格，多资源并发请求共享同一次核验。Discord 失败、资格丢失或令牌过期时阻止后续受保护请求；已下载到浏览器的源码无法收回。`POST /auth/discord/logout` 要求同源 Origin；`GET /auth/discord/status` 仅返回登录状态和社区名称。

## 第一次配置（应用创建后进行）

1. 在 https://discord.com/developers/applications 创建自己的应用，记录 General Information → Application ID。
2. 在 OAuth2 页面登记准确的回调地址。本机沿用现有存档域名时为 `http://127.0.0.1:8090/auth/discord/callback`；使用 localhost 时配置和访问都应统一为 localhost。
3. 参考 `docs/discord-server.env.example` 在仓库根目录创建 `.env.discord`，填写应用 ID 和 Client Secret。这个文件已被 `.gitignore` 忽略，Secret 只保存在服务器，不写入 HTML、浏览器存储或聊天。
4. 完成真实联调时先停止占用相同端口的开发预览，再用授权入口启动。保持原来的协议、主机和端口，浏览器现有存档与预设仍保存在原位置；切换域名或端口前应先导出本地存档。

环境变量：

| 变量 | 含义 |
| --- | --- |
| DISCORD_CLIENT_ID | 自有应用的公开 Application ID，必填 |
| DISCORD_CLIENT_SECRET | 仅服务端保存的应用密钥，必填 |
| DISCORD_GUILD_ID | 默认 `1134557553011998840`，部署者可明确覆盖 |
| DISCORD_PUBLIC_ORIGIN | 默认 `http://127.0.0.1:8090`；正式部署为站点 HTTPS origin，不含路径 |
| PORT | Node 监听端口；HTTPS 站点默认 8090，由反向代理终止 TLS |

## 发布边界

对其他用户执行强制门禁，需要发布方控制的 Node 服务端。GitHub Pages 等纯静态托管，或发给用户自行修改的本地源码，不能提供可靠的强制授权。现有纯静态发布地址并不会因增加本地授权入口而自动受保护；真实发布时所有页面、脚本、图片请求都必须经过授权服务器，反向代理不能另设绕过授权的静态目录。

### Vercel 当前状态

当前仓库尚无 Vercel Functions 授权入口和全站拦截配置。把 HTML/assets 作为静态项目直接部署到 Vercel，不会执行本机的 `tools/serve-discord.cjs`，因此不会自动保留 Discord 成员验证。仅添加 Discord 环境变量或前端登录按钮也不足以保护静态页面。

Vercel 适配需要把登录、回调、状态与退出转换为服务端函数；将当前进程内 Map 会话改成适合多实例的共享存储或其他经过验证的会话方案；通过 Routing Middleware／受保护路由覆盖所有页面与静态资源。还需在 Vercel 配置服务端环境变量，在 Discord 应用中添加准确的线上 `https://站点域名/auth/discord/callback`，并将 `DISCORD_PUBLIC_ORIGIN` 改为该 HTTPS origin。预览域名同样需明确处理，不能信任请求提供的任意 Host。此适配尚未实施或部署。

官方能力参考：
- https://vercel.com/docs/functions/runtimes/node-js
- https://vercel.com/docs/routing-middleware

正式站点使用 HTTPS，反向代理到本机 Node 端口，并保留与 `DISCORD_PUBLIC_ORIGIN` 一致的 Host。授权服务器只监听 127.0.0.1；不信任请求提供的 X-Forwarded-Host/Proto，也不把它们用于 OAuth 重定向。多实例部署需要额外的共享会话实现，目前适用于单实例。

公网授权站点禁用原来的 `localhost:8080` Gemini 通道，避免将发布服务器的本机模型服务暴露给用户；玩家仍可使用自己配置的 API。回调或登录不发送游戏存档、预设、API Key；Secret 和 Discord 用户访问令牌不会返回给前端。

## 验证

`node --test tests/discord-access.test.cjs tests/discord-gate.test.cjs tests/gemini-relay.test.cjs`

上述 21 项自动化测试使用模拟身份、令牌与 Discord 响应，覆盖回调伪造、重复使用、跨浏览器绑定、取消、权限不足、非成员拒绝、会话过期、退出、资格复查、静态文件与代理拦截，以及错误分类与凭据脱敏。另已完成一次真实浏览器授权、身份及社区成员查询；未上传游戏存档或改动 Webhook 备份目的地。

来源：
- https://github.com/discord/discord-api-docs/blob/main/developers/topics/oauth2.mdx
- https://github.com/discord/discord-api-docs/blob/main/developers/resources/user.mdx#get-current-user-guild-member
