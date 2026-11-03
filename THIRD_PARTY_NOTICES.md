# 素材与第三方许可说明

项目 [MIT License](LICENSE) 适用于原创代码与文档。下列素材与依赖具有独立边界，不从主协议推导额外权利。

## 家庭照片与衍生图片

以下素材**不纳入项目 MIT 授权范围**，权利由各自权利人保留：

- `miniprogram/assets/photos/` 内豆米、豆糕与家庭场景照片。
- `public/` 等目录中相同照片的副本（如有）。
- README 与文档中含这些照片的截图、拼贴和工坊作品，包括 `docs/assets/studio-duo.png`。

公开展示不等于授予再使用许可。Fork、重新分发、正式发布或商用前，请替换为自有或已获许可的素材；保留原照片须另行取得权利人许可。代码和文档的 MIT 不授予内嵌照片、第三方商标等排除素材的权利。

## Phosphor Icons

- 使用位置：`miniprogram/assets/ai-icons/`。
- 来源：<https://github.com/phosphor-icons/core>。
- MIT 许可，原版权声明：`Copyright (c) 2023 Phosphor Icons`。
- 完整文本：[LICENSE.txt](miniprogram/assets/ai-icons/LICENSE.txt)。

## npm 依赖

React、Vite、Lucide、Radix UI、Markdown 工具和其他直接 / 间接依赖保留各自许可。版本以 `package-lock.json` 为准，许可文本以各包的 `LICENSE` / `NOTICE` 为准。发布与再分发时保留相应声明，主项目 MIT 不替换它们的许可。本说明不是完整的传递依赖许可清单。

## 字体、平台与服务

- 当前以设备字体回退为主，未授予第三方商业字体的嵌入与分发权。
- 微信、DeepSeek 等名称用于说明兼容平台与服务，不表示官方出品或背书。
- 第三方 API、云平台及其输出仍受相应条款约束。

## README 展示图片来源

| 文件 | 来源与性质 |
| --- | --- |
| `docs/assets/ai-overview.png` | `scripts/preview-native-ai.mjs` 生成的原生 WXML / WXSS 离线排版样张；隔离示例内容，不是真实 AI 会话或微信截图 |
| `docs/assets/studio-duo.png` | 原生 Canvas 的 900 × 1000 输出样张；使用家庭照片，适用上述素材保留条款 |
