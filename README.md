# 兔兔小窝 · 微信原生可爱手账

**主项目在 `miniprogram/`：WXML / WXSS / 原生 JavaScript。** 微信开发者工具直接打开项目根目录，项目配置已指向该目录。原 AppID、基础库、已有数据和适配保持。

白兔叫豆米，黄兔叫豆糕。严格保留奶油白 #FFF9F0、樱花粉 #FFD9E8、薄荷绿 #C9E7D3、奶油黄 #FFE9A8、可可紫 #6B5B73，手写标题、拍立得、胶带、胶片与故事目录；不改成 SaaS 网站或商务后台。

- [唯一主提示词](docs/兔兔小窝-主提示词.md)
- [本次原生与风格校正](docs/原生可爱风格校正.md)
- [AI 提示词与接入](docs/AI助手-提示词与接入说明.md)
- [对话栏与连续会话修正](docs/豆伴对话栏与连续会话修正.md)
- [分层验收记录](docs/本轮验收记录.md)

2026-10-29 校正：错误方向的 Web 新首页/工作台已撤下入口，浏览器恢复原手账首页。原生首页新增“今天的小小照顾”入口，原生照顾页新增同风格打卡小票、筛选、单项/批量记录、撤销、历史只读与复制。记录与兔兔档案共用 checkins。AI 面板复用原 bunny-mark，颜色回到奶油粉绿；档案换照片功能保留。

同日修正豆伴对话栏：顶部固定新对话与更多，主界面去除重复资料说明和配置卡；只有未配置密钥时出现连接引导。新建保留草稿，按钮热区至少44px，回到最新浮于独立消息区内，程序滚动不会反复切换跟随状态。连续会话最多十五轮；在更多→本次资料与上下文统一预览历史及范围。详见 `docs/豆伴可用性审计与修复.md`。

```powershell
npm run verify:miniprogram
npm run verify:native-compile
npm run verify:product
```

`verify:product` 当前验证原生校正。`docs/首页与功能页-重构方案.md` 和未接入入口的 Web 实验文件只作历史，不能作为继续开发的规范。当前没有云同步，不伪造 API 回答，没有上传或发布。

## 浏览器旧原型（辅助预览）

旧原型预览：`http://127.0.0.1:5188/`。原生小程序请按下一节在微信开发者工具内编译；该网址不能代替小程序验收。

双击 `start-preview.cmd`，或在本目录运行：

```powershell
npm run dev
```

更换机器或尚无依赖时，先执行 `npm install`。本次在本机复用了已安装的 React、Vite 与 Lucide 依赖，没有修改其他项目。

```powershell
npm run build
npm run preview
```

`dist/` 是构建好的静态版本，须通过 HTTP 服务打开，不能直接双击 `dist/index.html`。当前仅监听本机回环地址。

## 微信小程序

用微信开发者工具「导入项目」选择仓库根目录（`project.config.json` 内 `miniprogramRoot` 已设为 `miniprogram/`），AppID 已填写，基础库 3.17.3 起。

```
miniprogram/
├─ app.js / app.json / app.wxss      全局入口、页面注册、样式入口（三条 @import）
├─ styles/    base 基础排版 · components 纸卡/按钮/列表行 · responsive 窄宽屏
├─ pages/     home 手账墙 · pets 兔兔档案 · family 家庭成员
│             diary 小日子信笺 · album 回忆相册 · studio 创意工坊 · video 视频草稿
│             care 照顾日程与补给 · insights 照顾周记与交接
├─ components/ page-top 顶部品牌与目录 · bunny-menu 兔耳菜单与故事目录 · bunny-mark 兔脸图标
│              empty-state 统一空态 · search-bar 搜索条 · ai-assistant 豆伴对话面板
├─ utils/     store.js 本地资料与媒体 · painter.js 绘图管线（Canvas 2D）
│             ai-client.js 请求与流式解析 · ai-state.js 设置与会话 · ai-context.js 资料范围
├─ assets/photos/  豆米、豆糕与合照
└─ server/    见根目录 server/ai-relay.mjs（AI 中转，非小程序包内）
```

**样式遵一条规则**：`base` 只放所有页面都成立的规则，`components` 只放出现两次以上的形态，`responsive` 只调边距与字号、不缩放控件。

> 注意：WXSS 的 `@import` **不接受 `./` 前缀**，写错不会报错，只会让全局样式整段不生效。`verify:miniprogram` 里有专门一条检查。

没有底部 tabBar：页面跳转靠底部兔耳果冻按钮展开的扇形菜单，以及右上角「翻开目录」的故事书索引。

与网页版的实现差异（都是小程序平台限制，不是偷工减料）：

- **绘图改为原生 Canvas 2D**，逻辑画布 450×500、导出 900×1000，预览与导出共用同一函数。小程序没有 `roundRect` 和可靠的 `ellipse`，改用 `arcTo` 与参数化椭圆自绘。
- **调色不依赖 `ctx.filter`**：先用一次写入探测机型是否支持；不支持则走离屏画布逐像素计算（brightness→contrast→saturate，含 256 级查表与结果缓存），保证真机导出的颜色与预览一致。
- **马赛克取样原照片**：落笔前把照片层冻结到离屏画布，后续笔迹不会污染取样源。
- **媒体存本机**：照片写入 `USER_DATA_PATH`（约 200MB），不走 `wx.saveFile` 的 10MB 配额；资料存 `wx.setStorageSync`。没有云端同步、没有微信登录。
- **字迹**：Canvas 字体只接受单一字族，所以 `fontOptions` 额外提供 `canvas` 字段；正式上线需配置授权字体。
- **视频页**保存原片段与编辑参数，滤镜和字幕只是预览，不合成 MP4。

## 可以实际操作的内容

| 页面 | 交互 |
| --- | --- |
| 手账墙 | 真实照片幻灯片、暂停 / 下一张、照片放大、今日场记抽屉、待办新增 / 完成 / 删除 |
| 兔兔档案 | 双兔独立打卡与撤销、真实时间、月历历史与近七天统计、档案、体重曲线、健康日期 |
| 家庭成员 | 新增 / 编辑 / 删除、上传头像、生日倒数、角色文字、关系批注、拖拽与按钮排序 |
| 回忆相册 | 多图上传、搜索排序、动态双兔筛选、多选批量喜欢/分类、照片资料编辑、回收站恢复、筛选内放映 |
| 小日子信笺 | 日期/心情/兔兔/照片/标签关联日记，原ID编辑、详情、搜索筛选、回收信箱 |
| 照片工坊 | 八模板、独立四图拼贴、真实双图叠影、贴纸变换、涂鸦/荧光/虚线/马赛克、文字调色、30步撤销重做、草稿、2× PNG |
| 视频草稿 | 本地视频选择、60 秒长度校验、原生播放、四种预览滤镜、手写字幕批注、保存 / 再开草稿 |
| 照顾日程 | 照顾项筛选、单项 / 批量盖章、撤销、历史只读、复制打卡小票、补给清单与轮流分工 |
| 照顾周记 | 按周汇总照顾记录、家人接力与交接摘要 |
| 豆伴 AI | 直连或中转对话、引用家庭资料范围、连续会话、Markdown 渲染与代码复制 |
| 兔耳菜单 | 拍照片（本地选择）、录视频（草稿）、日记保存、召唤兔兔动效，长按 0.8 秒也可召唤 |

用户确认白色兔兔叫「豆米」，黄色兔兔叫「豆糕」。旧版资料自动改名并保留原记录；此后仍可自定义昵称。初始年龄、品种、体重、生日和健康日期未编造。

## AI 助手（豆伴）

两种模式，代价完全不同：

| 模式 | 怎么用 | 代价 |
| --- | --- | --- |
| `direct` 直连（默认） | 在小程序内填自己的服务商 Key，直连 `api.deepseek.com` | token 费用自付；**必须**在小程序后台把该域名加进 request 合法域名，否则真机请求被拦（开发者工具里可能看着正常） |
| `relay` 中转 | 走 `server/ai-relay.mjs`，Key 只留服务端 | 需要公网 HTTPS 域名 + 备案 + 白名单 |

**密钥纪律**：仓库里只有 `server/.env.example` 占位值；真实 `.env` 已被 `.gitignore` 挡住。不要把 Key 写进代码、文档或截图。

```powershell
copy server/.env.example server/.env   # 填入 AI_API_KEY 与 BUNNY_RELAY_TOKEN
npm run ai:relay                        # 中转默认监听 127.0.0.1:8788
npm run verify:ai-relay                 # 47 项回环假上游检查，不接触真实模型
```

中转不保存对话、图片与密钥，也不连数据库；`HOST` 只允许回环地址。小程序侧拒绝客户端传入的 `model` / `baseUrl` / `apiKey`，上游配置全部由服务端环境决定。

## 数据与备份（重要）

所有资料都在本机：数据存 `wx.setStorageSync`，照片与视频存 `USER_DATA_PATH`，**没有云端同步**。

换手机、清理微信缓存、卸载重装 → 资料消失且无法恢复。当前**还没有导出备份功能**，这是发布前该补的第一件事。

## 发布与费用

- **个人主体**：注册、备案、审核、代码上传全部 0 元；企业/个体户微信认证 300 元/年。
- 除 AI 外本项目零网络请求，不需要服务器和域名；但**小程序备案仍是公开发布的前置条件**。
- 只给家人用可以走**体验版**：上传代码 → 后台设为体验版 → 添加体验成员，免备案、免审核。
- 审核通过后**必须手动点「发布」**，否则不会对外可见。

## 数据与能力边界

- 小型资料存在 localStorage；照片 / 视频存在本机 IndexedDB。刷新后保留，同浏览器和同源可再打开。
- 照片不上传服务器。浏览器清理网站数据、更换浏览器或更改域名端口不会自动迁移资料。
- 本原型没有微信登录、家庭云同步、订阅消息、人脸识别、语音识别、多指组合手势、MP4 裁切 / 转场 / 合成或授权音乐。
- 视频滤镜与字幕是预览效果，保存的是原视频与草稿参数，不冒充合成成片。
- 三种字迹使用设备字体回退；微信实现时应配置具有授权的字体。
- 双重叠影支持选择第二张真实照片；不选时为同图叠影。四格镜头支持四个独立照片槽。
- 守护者徽章由真实打卡历史计算：连续七天均完成四项才解锁，不植入虚构的连续记录。

## 验证情况

- Vite 生产构建通过，本机 HTTP 预览返回 200。
- 14项核心状态测试、18项源码服务端渲染检查、15项绘图调用契约检查通过。这些检查不替代浏览器实际像素、触控或微信真机验收。
- 小程序侧本机检查可复现：`verify-miniprogram-pages.mjs`（**9 页面 + 6 组件**用桩件真实装载并跑 `onLoad`/`onShow`，同时校验 WXML 事件是否有实现、样式入口 `@import` 是否可解析）、`verify-miniprogram.mjs`（8 套模板、调色双路径、四格、叠影、四种笔刷、选框不入导出、脏数据、缺图）。
- `npm run verify:native-compile` 用微信官方 `wcc` / `wcsc` 在本地编译：15 个 WXML、19 个 WXSS 通过。
- `npm run verify:ai-relay`：47 项回环假上游检查通过，全程不接触真实模型服务。
- 仍未验收：真机、开发者工具截图、真实 API Key 下的 DeepSeek 调用、CORS 与合法域名、读屏与帧率。**编译通过不等于视觉正确**，这一点在踩过 WXSS 导入失效的坑之后尤其要记住。
- 用户已确认网页预览能正常打开。
- 内置浏览器安全策略阻止自动页面访问，因此未声称完成自动视觉对照、各尺寸截图或全流程点击验收。小程序同样未做真机与开发者工具截图验收。

复现检查：`node scripts/verify-core.mjs`、`node scripts/verify-render.mjs`、`node scripts/verify-painter.mjs`、`node scripts/verify-miniprogram-pages.mjs`、`node scripts/verify-miniprogram.mjs`。

## 源码结构

网页版：`src/App.jsx` 管理页面与故事目录；`Home.jsx`、`Pets.jsx`、`Family.jsx`、`Album.jsx`、`Studio.jsx` 分别管理五个主要页面；`CareHistory.jsx` 管理月历；`Diary.jsx` 管理日记；`PhotoWorkshop.jsx` 和 `painter.js` 管理增强工作台与统一绘图；`editorHistory.js` 管理撤销分支；`data.js` 管理本地资料、兼容迁移、日历日期与连续打卡；`media.jsx` 管理 IndexedDB 媒体；`ui.jsx` 为复用控件；`styles.css` 为完整视觉 token 与响应式样式。

小程序版：`miniprogram/utils/store.js` 承担网页版 `data.js` + `media.jsx` 的职责（资料在 Storage、媒体在 `USER_DATA_PATH`）；`miniprogram/utils/painter.js` 对应网页 `painter.js`；`pages/studio` 对应 `PhotoWorkshop.jsx` + `editorHistory.js`；`pages/pets` 内含照顾月历；`components/bunny-menu` 对应 `App.jsx` 的兔耳菜单与故事目录。

最终交付包排除 node_modules，以便移交。素材为用户上传照片，请仅用于授权的家庭项目。
