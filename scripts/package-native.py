"""Package the native mini-program only, without Web artifacts or local secrets."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import json

root = Path(__file__).resolve().parent.parent
output = root / "output" / "兔兔小窝-微信原生可爱手账-20261029.zip"
output.parent.mkdir(exist_ok=True)
scripts = [
    "verify-miniprogram-pages.mjs", "verify-miniprogram.mjs",
    "verify-family-features.mjs", "verify-ai.mjs", "verify-native-style.mjs", "verify-native-chat-ux.mjs",
    "compile-native.mjs", "verify-ai-relay.mjs", "package-native.py",
]
documents = ["原生可爱风格校正.md", "兔兔小窝-主提示词.md", "AI助手-提示词与接入说明.md", "豆伴对话栏与连续会话修正.md", "豆伴可用性审计与修复.md"]
files = [path for path in (root / "miniprogram").rglob("*") if path.is_file()]
files += [root / "scripts" / name for name in scripts]
files += [root / "docs" / name for name in documents]
files += [root / "server" / name for name in ("ai-relay.mjs", "README.md", ".env.example")]
files += [root / "project.config.json", root / ".gitignore"]

package = {
    "name": "bunny-family-native", "version": "1.0.0", "private": True, "type": "module",
    "scripts": {
        "verify:miniprogram": " && ".join("node scripts/" + name for name in scripts[:6]),
        "verify:chat-ux": "node scripts/verify-native-chat-ux.mjs",
        "verify:product": "node scripts/verify-native-style.mjs",
        "verify:native-compile": "node scripts/compile-native.mjs",
        "verify:ai-relay": "node scripts/verify-ai-relay.mjs",
        "ai:relay": "node --env-file=server/.env server/ai-relay.mjs",
    },
}
readme = """# 兔兔小窝 · 微信原生可爱手账

这是微信小程序交付包。微信开发者工具导入本目录，保留原项目配置，点击编译即可。
入口已设为 miniprogram/，无需 React、Vite、Tailwind 或 npm 安装。
风格沿用奶油白、樱花粉、薄荷绿、手写标题、拍立得、胶带与原兔耳标识。
白兔豆米，黄兔豆糕。没有传统底部导航；右上“翻开目录”可进入各功能。

首页 → “今天的小小照顾” → 原生照顾打卡；支持筛选、单项/批量记录、撤销、历史只读与复制小票。
原日程、补给、档案换照和豆伴 AI 等功能保留。数据存在本机，不自动跨端同步。
AI 需配置自己的兼容服务；可选中转说明见 server/README.md，未包含任何真实密钥。
豆伴顶部固定新对话，历史/资料/连接集中到更多；同一会话最多携带十五轮文字，在更多中统一预览。
回到最新按钮浮在独立消息区内，显隐不挤压布局；新建保留草稿，加载更早消息可保持阅读位置。
长对话会节选；附图仅保留文字，不自动重传原图。详见 docs/豆伴对话栏与连续会话修正.md。

详见 docs/原生可爱风格校正.md 与 docs/兔兔小窝-主提示词.md。
安装 Node.js 22+ 后可运行 npm run verify:miniprogram；本机编译运行 npm run verify:native-compile。
编译器路径不同时，通过 WECHAT_COMPILER_DIR 指向微信开发者工具的 wcc-exec 目录。
行为桩与 WXML/WXSS 编译已通过；未取得本轮真机截图或完成视觉验收，没有上传或发布。
"""

with ZipFile(output, "w", ZIP_DEFLATED, compresslevel=6) as archive:
    for path in sorted(set(files)):
        relative = path.relative_to(root)
        assert path.is_file() and not path.is_symlink(), relative
        assert path.resolve().is_relative_to(root.resolve()), relative
        assert not any(part in ("node_modules", ".git", "output", "__pycache__") for part in relative.parts)
        assert not path.name.startswith(".env") or path.name == ".env.example"
        assert path.name != "project.private.config.json"
        assert path.suffix not in (".log", ".pyc")
        archive.write(path, "bunny-family/" + relative.as_posix())
    archive.writestr("bunny-family/package.json", json.dumps(package, ensure_ascii=False, indent=2) + "\n")
    archive.writestr("bunny-family/README.md", readme)

with ZipFile(output) as archive:
    assert archive.testzip() is None
    names = archive.namelist()
    assert "bunny-family/miniprogram/app.json" in names
    assert "bunny-family/miniprogram/components/ai-assistant/index.wxss" in names
    assert not any(name.startswith(("bunny-family/src/", "bunny-family/dist/")) for name in names)
    assert not any("/.env" in name and not name.endswith("/.env.example") for name in names)
    assert not any(name.endswith("/project.private.config.json") for name in names)
print(json.dumps({"archive": str(output), "files": len(names), "bytes": output.stat().st_size,
                  "surface": "native-only", "credentials": "excluded"}, ensure_ascii=False))
