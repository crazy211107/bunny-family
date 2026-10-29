// 小程序页面装载检查：用最小桩件把 7 个页面与 4 个组件真正 require 一遍，
// 跑 onLoad / onShow / attached，捕捉「方法不存在、路径写错、字段拼错」这类运行时炸点。
// 它不替代微信开发者工具与真机验收，只保证代码至少能被加载和执行第一步。
import path from "node:path";
import { createRequire } from "node:module";
import fs from "node:fs";

const root = path.resolve(import.meta.dirname, "..", "miniprogram");
const require = createRequire(import.meta.url);
const pageNames = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8')).pages.map(route => route.split('/')[1]);

const bag = {};
const noop = () => {};
globalThis.wx = {
  getStorageSync: (key) => bag[key],
  setStorageSync: (key, value) => {
    bag[key] = value;
  },
  showToast: noop,
  showLoading: noop,
  hideLoading: noop,
  navigateTo: noop,
  redirectTo: noop,
  reLaunch: noop,
  navigateBack: noop,
  switchTab: noop,
  vibrateShort: noop,
  previewImage: noop,
  setClipboardData: noop,
  setNavigationBarTitle: noop,
  getWindowInfo: () => ({
    statusBarHeight: 24,
    windowWidth: 375,
    windowHeight: 667,
    safeArea: { top: 24, bottom: 667 },
  }),
  getSystemInfoSync: () => ({ statusBarHeight: 24, windowWidth: 375, windowHeight: 667 }),
  getMenuButtonBoundingClientRect: () => ({ left: 280, top: 24, width: 87, height: 32 }),
  createSelectorQuery: () => ({
    in() { return this; },
    select() { return this; },
    selectAll() { return this; },
    fields() { return this; },
    boundingClientRect() { return this; },
    exec(callback) { callback([null]); },
  }),
  createOffscreenCanvas: () => ({ getContext: () => null }),
  createCanvasContext: () => ({}),
  getFileSystemManager: () => ({ saveFile: noop, access: noop, unlink: noop }),
  getImageInfo: noop,
  saveFile: noop,
  saveImageToPhotosAlbum: noop,
  chooseMedia: noop,
  chooseMessageFile: noop,
  canvasToTempFilePath: noop,
};

let captured = {};
globalThis.Page = (options) => {
  captured.page = options;
};
globalThis.Component = (options) => {
  captured.component = options;
};
globalThis.App = (options) => {
  captured.app = options;
};
globalThis.getApp = () => ({ globalData: {}, openDirectory: noop, openStudio: noop });
globalThis.getCurrentPages = () => [{ route: 'pages/home/index' }];

function applyData(instance, patch) {
  for (const key of Object.keys(patch)) {
    const parts = key.split(".");
    let target = instance.data;
    for (let i = 0; i < parts.length - 1; i++) {
      target[parts[i]] = target[parts[i]] || {};
      target = target[parts[i]];
    }
    target[parts[parts.length - 1]] = patch[key];
  }
}

function mount(definition) {
  const instance = {};
  for (const key of Object.keys(definition)) instance[key] = definition[key];
  instance.data = JSON.parse(JSON.stringify(definition.data || {}));
  instance.setData = (patch) => applyData(instance, patch);
  return instance;
}

function checkHandlers(file, definition) {
  const source = fs.readFileSync(file, 'utf8');
  const names = [...source.matchAll(/\b(?:bind|catch):?[a-zA-Z][\w:-]*\s*=\s*"([A-Za-z_$][\w$]*)"/g)].map(match => match[1]);
  const methods = Object.assign({}, definition, definition.methods || {});
  const missing = [...new Set(names)].filter(name => typeof methods[name] !== 'function');
  if (missing.length) throw new Error('WXML 事件缺少实现: ' + missing.join(', '));
}

const failures = [];
const note = (ok, label, detail) => {
  if (ok) {
    console.log(`  ✓ ${label}`);
    return;
  }
  failures.push(`${label}：${detail}`);
  console.log(`  ✗ ${label}：${detail}`);
};

console.log("页面");
for (const name of pageNames) {
  captured = {};
  const file = path.join(root, "pages", name, "index.js");
  try {
    require(file);
    checkHandlers(file.replace(/\.js$/, '.wxml'), captured.page);
    const markup = fs.readFileSync(file.replace(/\.js$/, '.wxml'), 'utf8');
    if (markup.includes('<page-top') && !markup.includes('<bunny-menu')) throw new Error('目录缺少当前页处理组件');
    const instance = mount(captured.page);
    if (typeof instance.onLoad === "function") instance.onLoad({});
    if (typeof instance.onShow === "function") instance.onShow();
    note(true, name);
  } catch (error) {
    note(false, name, error.message);
  }
}

console.log("组件");
for (const name of ["page-top", "bunny-menu", "bunny-mark", "empty-state", "search-bar", "ai-assistant"]) {
  captured = {};
  const file = path.join(root, "components", name, "index.js");
  try {
    require(file);
    const definition = captured.component;
    checkHandlers(file.replace(/\.js$/, '.wxml'), definition);
    const instance = mount(definition);
    // 小程序里组件方法在 attached 之前就已经挂好，桩件必须照此顺序。
    if (definition.methods) {
      for (const key of Object.keys(definition.methods)) {
        instance[key] = definition.methods[key].bind(instance);
      }
    }
    if (definition.lifetimes && definition.lifetimes.attached) {
      definition.lifetimes.attached.call(instance);
    }
    if (definition.pageLifetimes && definition.pageLifetimes.show) {
      definition.pageLifetimes.show.call(instance);
    }
    note(true, name);
  } catch (error) {
    note(false, name, error.message);
  }
}

console.log("样式入口");
// WXSS 的 @import 不认 "./" 前缀，写错不会报错，只会让全局样式整段不生效。
{
  const { readFileSync, existsSync } = await import("node:fs");
  const appWxss = readFileSync(path.join(root, "app.wxss"), "utf8");
  const imports = [...appWxss.matchAll(/@import\s+"([^"]+)"/g)].map((m) => m[1]);
  const missing = imports.filter((item) => !existsSync(path.join(root, item)));
  const dotted = imports.filter((item) => item.startsWith("./"));
  note(imports.length > 0 && !missing.length && !dotted.length,
    `@import ${imports.length} 个`,
    [missing.length ? "找不到: " + missing.join(", ") : "", dotted.length ? "带 ./ 前缀: " + dotted.join(", ") : ""].filter(Boolean).join("; "));
}

console.log("WXML 指令");
// WXML 的 wx:if / wx:for 漏写 {{ }} 不会编译报错，但会把值当成非空字符串（恒真），
// 于是遮罩层永远盖住页面、列表永远渲染不出来。这类错误必须在装载前拦下。
{
  const { readdirSync, readFileSync } = await import("node:fs");
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".wxml")) files.push(full);
    }
  };
  walk(path.join(root, "pages"));
  walk(path.join(root, "components"));

  const offenders = [];
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    for (const match of text.matchAll(/(wx:(?:if|elif|for|for-items))\s*=\s*"([^"]*)"/g)) {
      if (!match[2].includes("{{")) {
        offenders.push(`${path.relative(root, file)} → ${match[1]}="${match[2]}"`);
      }
    }
    for (const match of text.matchAll(/\b(disabled|hidden|checked|loading)\s*=\s*"([^"]*)"/g)) {
      if (!match[2].includes("{{") && !["true", "false"].includes(match[2])) {
        offenders.push(`${path.relative(root, file)} → ${match[1]}="${match[2]}"`);
      }
    }
  }
  note(offenders.length === 0, `扫描 ${files.length} 个 WXML`, offenders.join("; "));
}

console.log("入口");
captured = {};
try {
  require(path.join(root, "app.js"));
  captured.app.onLaunch.call({ globalData: {} });
  note(true, "app.onLaunch");
} catch (error) {
  note(false, "app.onLaunch", error.message);
}

if (failures.length) {
  console.error(`\n✗ ${failures.length} 项装载失败`);
  process.exit(1);
}
console.log(`\n✓ ${pageNames.length} 个页面 / 6 个组件 / app 全部装载通过`);
