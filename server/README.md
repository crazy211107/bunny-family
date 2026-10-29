# 兔兔小窝 · AI 服务端中转

这是一个无需第三方依赖的 Node.js 20+ 中转服务。它把服务商 API Key 留在服务端，并把固定服务商的 OpenAI 兼容 JSON / SSE 响应交给小程序。它不保存对话、图片、密钥，也不连接数据库。

## 本机启动

将 `.env.example` 复制为本机的 `.env` 并填入你自己的值。不要提交真实 `.env`；使用前确认仓库忽略规则已经包含它。Node 20.6+ 可从项目根目录执行：

```powershell
node --env-file=server/.env server/ai-relay.mjs
```

也可以通过进程环境变量配置，再运行 `node server/ai-relay.mjs`。必填项是 `AI_API_KEY` 与 `BUNNY_RELAY_TOKEN`；访问令牌需要 24–256 个无空格可打印字符，建议使用密码管理器生成的随机值。不要把真实密钥写入终端共享日志或截图。

| 环境变量 | 默认值 / 用途 |
| --- | --- |
| `AI_API_KEY` | 必填，仅用于服务端访问上游 |
| `AI_BASE_URL` | `https://api.deepseek.com`；必须 HTTPS，无 URL 用户名、密码、查询或片段 |
| `AI_MODEL` | `deepseek-flash`；请按服务商账户实际可用的模型 ID 配置 |
| `BUNNY_RELAY_TOKEN` | 必填，小程序调用这个中转的访问令牌，和服务商 API Key 不同 |
| `HOST` | `127.0.0.1`；仅允许回环地址 |
| `PORT` | `8788` |

程序不会自动读取 `.env.example`。默认模型 ID 只是可配置默认值；服务不会猜测模型能力、费用或替你购买服务。当且仅当上游主机是 `api.deepseek.com` 时，服务端固定添加 `reasoning_effort: "none"`，将输出留给正文；其他兼容服务商不会收到这个附加字段。

## 小程序配置与协议

小程序的中转 Base URL 填 `https://你的域名/v1`，访问令牌填你的 `BUNNY_RELAY_TOKEN`。请求完整地址为 `POST /v1/chat/completions`，请求头使用 `Authorization: Bearer <中转访问令牌>` 与 `Content-Type: application/json`。

```json
{
  "messages": [{ "role": "user", "content": "把今天豆米与豆糕的记录整理成日记草稿" }],
  "stream": true,
  "max_tokens": 1024,
  "temperature": 0.7
}
```

只接受 `messages`、`stream`、`max_tokens`、`temperature` 四个顶层字段。客户端提供的 `model`、`baseUrl`、`apiKey`、工具调用等其他字段会被拒绝。上游地址、模型和 Key 始终由服务端环境配置决定。默认 `stream` 为 `false`，输出上限默认为 1024 tokens；可以设置为 512–4096 的整数，temperature 可以为 0–2。

最多 32 条消息，角色仅 `system` / `user` / `assistant`；全部文本累计最多 60000 字符，整个请求最多 256 KB。每条 content 可为字符串，或含**一个 text 与最多一个 image_url** 的数组：

```json
[
  { "type": "text", "text": "为这张兔兔照片写一句手账文案" },
  { "type": "image_url", "image_url": { "url": "data:image/jpeg;base64,..." } }
]
```

图片只接受 JPEG / PNG / WebP 的 base64 data URL，每张图片 URL 最多 180000 字符。拒绝任意 HTTP 图片地址，避免让服务替客户端抓取外部 URL。是否能够理解图片由实际配置的上游模型决定；中转不会伪装成视觉识别成功。

流式请求收到上游 SSE 后立即逐块转发，处理写入背压；客户端关闭连接会取消上游请求。单次请求最长 90 秒，默认同时处理 3 个请求、每个配置令牌每分钟最多 20 次；请求体、图片与回复均有大小上限。HTTP 上游错误、非 JSON 回复和超时使用固定错误消息，不向客户端回显上游错误正文。SSE 正常数据由上游提供；本服务不会把正文写入日志。

`GET /health` 仅返回 `{ "ok": true, "model": "配置的模型" }`，用于查看进程是否启动，不代表服务商 Key 或模型已验证可用。

## 发布边界

服务只监听回环地址并校验来源为回环连接，不能直接作为公网开放代理。真机小程序不能访问开发电脑的 `127.0.0.1`；正式使用需要在服务器通过 **HTTPS 反向代理** 接入，并在微信小程序后台配置 **request 合法域名**。反向代理应关闭 SSE 缓冲，保留长连接并设置至少 90 秒上游超时。此交付没有部署、注册域名或调用真实服务商。

个人共享令牌是便于本机/个人试用的入口保护，**不是生产用户鉴权**：令牌可以从客户端读取，不适合给所有用户共用。多人发布应由业务登录、会话校验、按用户配额及权限控制的网关保护中转；不要把服务商 API Key 嵌入小程序代码。开发者工具中关闭域名校验只适用于本机调试，不等于已经具备发布条件。

## 隔离验证

```powershell
node scripts/verify-ai-relay.mjs
```

测试只启动本机假上游，覆盖鉴权、字段与容量限制、图片协议、真实 SSE 分块、非流式响应、错误正文隐藏、断开取消、超时、速率与并发边界。`createRelay({ allowInsecureLocalForTests: true })` 仅允许假上游为 HTTP 回环地址；命令行启动不会打开这个测试选项，也不连接真实 DeepSeek。
