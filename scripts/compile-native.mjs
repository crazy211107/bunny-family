import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
const root = path.resolve(import.meta.dirname, "..");
const native = path.join(root, "miniprogram");
const bin =
  process.env.WECHAT_COMPILER_DIR ||
  "D:/software/微信web开发者工具/code/package.nw/node_modules/wcc-exec";
const out = path.join(root, "output", "native-compile");
fs.mkdirSync(out, { recursive: true });
const all = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(target);
    else all.push(path.relative(native, target).replaceAll("\\", "/"));
  }
}
walk(native);
const templates = all.filter((file) => file.endsWith(".wxml"));
const sheets = all.filter((file) => file.endsWith(".wxss"));
for (const [tool, files, args] of [
  ["wcc", templates, []],
  ["wcsc", sheets, ["-pc", String(sheets.length)]],
]) {
  const result = spawnSync(
    path.join(bin, tool + ".exe"),
    [...args, "-o", path.join(out, tool + ".js"), ...files],
    { cwd: native, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
  );
  if (result.error || result.status !== 0) {
    console.error(tool, result.error || result.stderr || result.stdout);
    process.exit(1);
  }
  console.log(`✓ ${tool} 编译 ${files.length} 个文件`);
}
let bytes = 0;
for (const file of all) bytes += fs.statSync(path.join(native, file)).size;
console.log(`✓ 原生源码及素材 ${(bytes / 1024).toFixed(1)} KiB（非上传包体）`);
