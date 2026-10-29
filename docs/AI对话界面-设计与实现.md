# 豆伴 AI 对话界面：设计与实现

> 视觉方向已校正：下文中性暖白/鼠尾草绿与 Web 工作区只作历史记录。原生 AI 当前沿用奶油白、粉绿、可可文字和原兔耳组件，详见 `原生可爱风格校正.md`。功能与数据边界以实际代码和 `AI助手-提示词与接入说明.md` 为准。

更新：2026-10-29。代码在当前项目直接运行，没有单独创建一个脱离家庭数据的演示。

## 设计方案

AI 区域是安静的阅读与写作工作区：暖白纸面、鼠尾草绿、低对比面板、细边框、克制阴影。保留豆米与豆糕的家庭品牌，以原创兔耳线稿表达亲切感。消息区取消拟物信纸和重复装饰；用户消息用浅色背景，AI 回答以排版区分。悬浮入口改为带兔耳图标、豆伴名称与短说明的标签；小程序收起后显示同一兔耳标识，避免重新退化为无辨识度的 AI 圆点。

Web 使用已有 React + Vite 工程，新增 TypeScript、Tailwind 与 shadcn 风格自有源码组件（CVA + Radix Slot/Dialog/Select）、lucide-react。没有为了对话页重建 Next.js 项目。原生小程序继续使用 WXML/WXSS/JS；Web 的 DOM、Tailwind 和 Radix 不能直接在微信原生运行。

| 参考来源 | 落到当前项目中的处理 |
| --- | --- |
| [Vercel Chatbot](https://github.com/vercel/chatbot)、[AI SDK 对话状态](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot) | 会话与消息分层，生成/停止/错误可见，输入区固定，长对话按需展开；沿用现有 OpenAI 兼容 SSE 客户端，不额外混入另一套协议 |
| [shadcn Button](https://ui.shadcn.com/docs/components/radix/button)、[Sheet](https://ui.shadcn.com/docs/components/radix/sheet)、[Select](https://ui.shadcn.com/docs/components/radix/select) | 自有源码组件，统一 variant/size、细边框、语义颜色、桌面侧栏与移动抽屉、模型选择 |
| [Radix Dialog](https://www.radix-ui.com/primitives/docs/components/dialog) | 有标题与说明的弹层，焦点限制、Esc 关闭；受控弹层显式恢复原触发器焦点 |
| Aceternity / Magic UI / 21st.dev 的克制动效方向 | 只使用 120–180ms 按压、背景反馈、层级淡入及生成呼吸点；没有引入粒子、光圈或大面积 AI 渐变，也没有复制其组件代码 |

## 组件结构与完整代码

```text
src/chat/
  ChatApp.tsx          ChatApp / Sidebar / ChatHeader / BackButton /
                      ModelSelector / EmptyState / ChatInput
  MessageList.tsx      MessageList / memo(MessageItem) / CodeBlock / CopyButton
  SettingsPanel.tsx    连接设置、资料范围、历史和附图开关
  ui.tsx              Button / Modal / SelectControl / BunnyLogo
  use-chat.ts         会话状态、流式请求、停止、重试、草稿和持久化
  types.ts            Session / Message / Settings / ContextPack 等类型
  browser-adapter.ts  fetch 与原生请求契约的适配、主动附图压缩
  chat.css            token、布局、响应式、暗色模式和消息排版
  generated/core.js   构建时从原生 AI 模块生成，不手工维护
```

`src/App.jsx` 接入独立 AI 页面与全局入口。AI 核心的唯一实现位于 `miniprogram/utils/ai-{context,state,client}.js`；`scripts/build-ai-core.mjs` 在开发与构建前生成浏览器模块，避免两份提示词、资料白名单和流式解析逐渐不一致。

## 统一 token

| 层级 | 浅色 | 深色 |
| --- | --- | --- |
| 主背景 | `#FCFCFA` | `#191E1B` |
| 侧面板 | `#F4F5F0` | `#141916` |
| 浮层/输入 | `#FFFFFF` | `#212823` |
| 正文 | `#263C32` | `#E4EDE4` |
| 次要文字 | `#68756B` | `#A3B2A5` |
| 细边框 | `#E0E5DD` | `#354039` |
| 主操作 | `#386449` | `#A5CFAC` |

圆角：控件 8–10px，消息/卡片 13–18px。正文 14px，辅助 10–12px，消息行高 1.85–1.95。所有颜色都通过 `.chat-app` 的语义变量切换，不污染小窝其他页面。暗色偏好首次跟随系统，用户切换后保存在当前浏览器。

桌面保留 258px 可折叠侧栏，折叠为 78px；700px 以下使用具名抽屉。移动头部第二行安置模型选择，防止返回、标题和操作争抢横向空间。输入区考虑 safe-area；采用 `100dvh` 避免移动地址栏导致的固定高度问题。

## 返回与导航契约

| 当前位置 | 点击顶部左侧 `ArrowLeft` / `aria-label="返回"` |
| --- | --- |
| 具体会话（含空的新会话） | 返回会话列表；停止正在生成的回答并保留已收内容；高亮当前会话 |
| 会话列表 | 回到进入前的小窝页面，恢复该页面滚动位置；直接通过 `#/ai` 打开时回到首页 |
| 设置/资料弹层 | 有独立关闭按钮，Esc 关闭；不会把返回误用作关闭抽屉 |

新建、侧栏折叠、移动抽屉、会话切换均为独立操作。新建支持 Ctrl/⌘ K。输入草稿按会话保留；返回列表后可重新打开当前会话继续写。小程序也有独立箭头返回，对话 → 列表 → 收起至来源页；资料预览返回上一层，设置返回对话。

## 状态与可用性

| 状态 | 反馈与操作 |
| --- | --- |
| empty | 兔耳品牌、三项真实用途示例；点击只填入输入框，配置前不伪造回答 |
| loading | 请求已发但未收到正文时显示“正在整理回答”；发送键变停止 |
| streaming | 80ms 合并一次更新；只更新末条消息，已完成消息 memo；停止保留片段 |
| error | 内联错误 + 对应回答的重试；不显示上游错误正文或密钥 |
| disabled | 空输入不能发；读取附件期间禁发；生成期间不切模型、不添加图片 |
| aborted | 标记“已停止”，迟到的数据不会覆盖已保留内容 |

Markdown 支持标题、引用、列表、GFM 表格、语法高亮与独立代码复制。ReactMarkdown 不执行模型 HTML；模型给出的远程图片转为文字，避免自动外链请求；仅 http/https 链接可由用户主动打开。图片附件先选择、压缩、预览再发送；不保存二进制到历史。

消息区接近底部时持续跟随；上滑、滚轮或触摸阅读时暂停，显示“最新消息”。不对每个 token 使用平滑滚动。长对话初始挂载最近 40 条，展开较早记录时补偿滚动位置；持久历史另有容量约束。这是渐进挂载 + memo，不是固定行高虚拟列表。

按钮、输入、链接、代码滚动区都有清晰 focus-visible；返回始终可操作；移动抽屉有名称、标题、说明及焦点管理。生成状态使用独立 polite live region，避免读屏逐 token 重复整篇回答。尊重 prefers-reduced-motion。

## 配置与运行

```powershell
npm ci
npm run dev
# http://127.0.0.1:5188/#/ai
npm run build
npm run verify:chat
npm run verify:miniprogram
npm run verify:native-compile
```

DeepSeek 默认地址 `https://api.deepseek.com`，模型 `deepseek-flash`，也支持自填兼容 API；模型名称以[官方文档](https://api-docs.deepseek.com/quick_start/agent_integrations/)为准。密钥由使用者在设置中自行填写，不需要发给开发者。浏览器直连需要上游允许 CORS；微信真机需要配置合法 request 域名。生产部署可使用 `server/ai-relay.mjs`，详见 `server/README.md`，需要 HTTPS 反向代理与业务鉴权。本轮没有部署或发布。

家庭数据是各运行端的本机数据。Web 不读取微信沙盒，也不假装两端已经同步。全部 11 类资料可选择，默认不发送草稿与联系方式；预览列出实际纳入条数与裁剪状态。详细提示词与数据边界见 `AI助手-提示词与接入说明.md`。

## 验收标准与证据边界

- 返回按钮存在、顶栏最左、有 `aria-label="返回"`，目的地和当前会话上下文明确。
- 移动端抽屉与桌面侧栏各司其职，模型不会挤掉返回；700px/380px 规则与暗色 token 已实现，实际设备仍须目视复核。
- Enter 发送、Shift+Enter 换行、输入法组合态不误发；空输入禁发；复制代码/消息反馈明确。
- SSE 中文/emoji 分片正确，停止/重试可用，上滑暂停跟随，展开旧记录保留视口。
- 原生官方本地编译和 wx 假数据验证、React 隔离 DOM 验证分别记录；它们不等同浏览器或微信真机验收。
- 内置浏览器无法访问当前 localhost 预览，未取得本轮视觉截图；没有绕过浏览器策略。没有真实 API Key，因此尚未实测真实 DeepSeek 连接。

## 微信热重载错误修复

用户报告 `./redesign.wxss not found` 后，已取消该拆分文件，将最终样式直接并入 `miniprogram/components/ai-assistant/index.wxss`。不存在额外 WXSS 依赖。修复后 `wcc` 15 文件、`wcsc` 19 文件均通过。本地路径检查不能证明开发者工具热重载缓存状态，因此最终采用单文件消除该路径故障。
