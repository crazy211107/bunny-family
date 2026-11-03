// Developer-only layout specimen. Renders the actual WXML/WXSS with isolated sample data.
// It never loads the user's WeChat storage, starts an API request, or controls their desktop.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { parseFragment } from "parse5";

const root = path.resolve(import.meta.dirname, ".."), native = path.join(root, "miniprogram");
const out = path.join(root, "output/playwright/ai-20261030");
fs.mkdirSync(out, { recursive: true });
const require = createRequire(import.meta.url);
let definition;
globalThis.Component = (value) => { definition = value; };
require(path.join(native, "components/ai-assistant/index.js"));
const markdown = require(path.join(native, "utils/ai-markdown.js"));
const settings = require(path.join(native, "utils/ai-state.js")).defaults();
const clone = (value) => JSON.parse(JSON.stringify(value));
const sample = (extra = {}) => Object.assign(clone(definition.data), {
  opened: true, safeTop: 64, panelHeight: 844, hasSecret: true, settings,
  title: "新的小窝对话", form: clone(settings), formScopeCount: 10,
  scopeRows: [{ id: "pets", label: "兔兔档案", selected: true }, { id: "notes", label: "心情手账", selected: true }, { id: "drafts", label: "未发出草稿", selected: false }],
}, extra);
const message = (id, role, content, status = "complete") => ({
  id, role, content: role === "user" ? content : "", blocks: role === "assistant" ? markdown.blocks(content) : [],
  hasContent: !!content, status, time: "10/30 09:41", regeneratable: role === "assistant" && status === "complete",
});
const messages = [message("u1", "user", "帮我整理今天的照顾安排，顺便写一句交接留言。"), message("a1", "assistant",
  "## 可以这样理清\n先核对**今天的真实记录**，再把尚未完成的事留给家人。\n\n- 查看豆米、豆糕的照顾打卡\n- 核对今天的分工与补给\n\n> 未记录，不代表没有照顾。交接前请当面确认。\n\n这段话可以写进手账：今天的小事，我们慢慢接力。\n\n```js\nconst note = {\n  title: '今天的小小照顾',\n  confirmed: false\n};\n```"
)];
const fixtures = {
  empty: sample(),
  connect: sample({ hasSecret: false }),
  conversation: sample({ messages, title: "今天的照顾与交接" }),
  latest: sample({ messages, title: "今天的照顾与交接", showLatest: true }),
  menu: sample({ messages, title: "今天的照顾与交接", menuOpen: true }),
  streaming: sample({ messages: [messages[0], message("a2", "assistant", "我会先根据你选择的资料，核对**今天已记录的照顾**。", "streaming")], running: true }),
  error: sample({ messages: [messages[0], message("a2", "assistant", "", "error")], error: "连接暂时没有成功，请检查服务地址后重试。" }),
  history: sample({ screen: "history", visibleSessions: [
    { id: "s1", title: "今天的照顾与交接", snippet: "核对真实记录，把还没做的小事接上。", current: true, messageCount: 6, when: "10/30 09:41" },
    { id: "s2", title: "豆米和豆糕的小手账", snippet: "帮我给今天的照片写一句旁白。", messageCount: 4, when: "10/29 20:16" },
    { id: "s3", title: "未发送 · 给家人的一句话", snippet: "有空帮小主添一把新鲜牧草。", messageCount: 0, when: "10/29 18:08" },
  ] }),
  settings: sample({ screen: "settings", hasSecret: false }),
  context: sample({ screen: "context", previewDestination: "api.deepseek.com", previewChars: 1840,
    previewHistory: [{ id: 0, role: "user", content: "今天还有哪些照顾待办？" }, { id: 1, role: "assistant", content: "请先核对真实记录。" }],
    previewHistoryNote: "携带 1 轮文字问答，最多最近 15 轮。原图不会自动再次发送。",
  }),
};
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const evaluate = (expr, scope) => {
  try { return Function("scope", "with(scope){return (" + expr + ")}")(new Proxy(scope, { has: () => true, get: (o, k) => k === Symbol.unscopables ? undefined : o[k] })); }
  catch (error) { throw new Error("Specimen expression failed: " + expr, { cause: error }); }
};
const bind = (value, scope) => String(value || "").replace(/{{([\s\S]*?)}}/g, (_, expr) => String(evaluate(expr, scope) ?? ""));
let source = fs.readFileSync(path.join(native, "components/ai-assistant/index.wxml"), "utf8");
source = source.replace(/<textarea\b([^>]*?)\/>/g, "<textarea$1></textarea>")
  .replace(/<image\b/g, "<img").replace(/<\/image>/g, "")
  .replace(/<switch\b([^>]*?)\/>/g, '<input type="checkbox" role="switch" $1>');
const tree = parseFragment(source);
function asset(src) {
  if (!src.startsWith("/assets/")) return src;
  const data = fs.readFileSync(path.join(native, src.slice(1)));
  return "data:" + (src.endsWith(".svg") ? "image/svg+xml" : "image/jpeg") + ";base64," + data.toString("base64");
}
function children(nodes, scope) {
  let matched = false, chain = false;
  return (nodes || []).map((node) => {
    if (node.nodeName === "#text") return esc(bind(node.value, scope));
    if (node.nodeName === "#comment") return "";
    const attrs = Object.fromEntries((node.attrs || []).map((a) => [a.name, a.value]));
    if (Object.hasOwn(attrs, "wx:if")) { chain = true; matched = !!evaluate(attrs["wx:if"].slice(2, -2), scope); if (!matched) return ""; }
    else if (Object.hasOwn(attrs, "wx:elif")) { if (!chain || matched) return ""; matched = !!evaluate(attrs["wx:elif"].slice(2, -2), scope); if (!matched) return ""; }
    else if (Object.hasOwn(attrs, "wx:else")) { if (!chain || matched) return ""; matched = true; }
    else { chain = false; matched = false; }
    if (attrs["wx:for"]) {
      const items = evaluate(attrs["wx:for"].slice(2, -2), scope) || [];
      return items.map((item, index) => nodeHtml(node, attrs, { ...scope, [attrs["wx:for-item"] || "item"]: item, [attrs["wx:for-index"] || "index"]: index })).join("");
    }
    return nodeHtml(node, attrs, scope);
  }).join("");
}
function nodeHtml(node, attrs, scope) {
  if (node.tagName === "block") return children(node.childNodes, scope);
  const tag = ({ view: "div", "scroll-view": "div", text: "span" })[node.tagName] || node.tagName;
  const output = [];
  for (const [name, raw] of Object.entries(attrs)) {
    if (name.startsWith("wx:") || /^(bind|catch)/.test(name) || ["auto-height", "adjust-position", "focus", "scroll-into-view", "show-scrollbar", "scroll-with-animation"].includes(name)) continue;
    const value = bind(raw, scope);
    if (["disabled", "checked"].includes(name)) { if (raw === "" || value === "true") output.push(name); continue; }
    if (name === "src") output.push('src="' + esc(asset(value)) + '"');
    else if (["class", "id", "style", "placeholder", "value", "type", "role"].includes(name) || name.startsWith("aria-") || name.startsWith("data-")) output.push(name + '="' + esc(value) + '"');
  }
  if (Object.hasOwn(attrs, "scroll-y")) output.push('data-scroll="y"');
  if (Object.hasOwn(attrs, "scroll-x")) output.push('data-scroll="x"');
  return "<" + tag + " " + output.join(" ") + ">" + (tag === "textarea" ? esc(bind(attrs.value, scope)) : children(node.childNodes, scope)) + (["input", "img"].includes(tag) ? "" : "</" + tag + ">");
}
const nativeCss = fs.readFileSync(path.join(native, "components/ai-assistant/index.wxss"), "utf8")
  .replace(/:host/g, ".ai-native-root")
  .replace(/(?<![\w-])(image|view|text|scroll-view)(?=[\s{,.:>+~#\[])/g, (tag) => ({image:"img",view:"div",text:"span","scroll-view":"div"})[tag]);
const reset = `html,body{margin:0;width:100%;height:100%;overflow:hidden}body{background:#fff9f0}*{box-sizing:border-box}button,input,textarea{font:inherit}input,textarea{border:0;outline:0;resize:none}input{background:transparent}[data-scroll=y]{overflow-y:auto}[data-scroll=x]{overflow-x:auto}span{box-sizing:border-box}button:focus{outline:2px solid #875873}input[role=switch]{width:44px;height:25px;appearance:none;background:#e3d6df;border:1px solid #d0b7c6;border-radius:20px;position:relative;flex-shrink:0}input[role=switch]:checked{background:#c9e7d3}input[role=switch]:after{content:'';position:absolute;top:2px;left:2px;width:19px;height:19px;border-radius:50%;background:#fffdf8}input[role=switch]:checked:after{left:21px}.specimen-label{position:fixed;top:16px;left:16px;z-index:1400;color:#806c7b;font:10px 'Microsoft YaHei';pointer-events:none}.ai-native-root{width:100%;height:100%}`;
const cases = [["empty",320,700],["empty",390,844],["connect",390,844],["conversation",390,844],["conversation",320,700],["latest",390,844],["menu",390,844],["streaming",390,844],["history",390,844],["settings",320,700],["settings",390,844],["context",390,844],["empty",900,900],["error",390,844]];
const rendered = [];
for (const [state,w,h] of cases) {
  const data = { ...fixtures[state], panelHeight: h };
  const file = path.join(out, `${state}-${w}.html`);
  fs.writeFileSync(file, '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>豆伴 · 排版样张</title><style>' + reset + nativeCss + '</style><body><div class="specimen-label">排版样张 · 示例内容，不是实际会话</div><div class="ai-native-root">' + children(tree.childNodes, data) + '</div></body></html>');
  rendered.push({ state, w, h, file });
}
if (process.argv.includes("--screenshots")) {
  const modulePath = process.env.PLAYWRIGHT_MODULE || "D:/java/yuanbao/stark-workbench/node_modules/playwright/index.mjs";
  const { chromium } = await import(pathToFileURL(modulePath).href);
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || "C:/Users/HUAWEI/AppData/Local/ms-playwright/chromium-1148/chrome-win/chrome.exe" });
  const reports = [];
  try {
    for (const c of rendered) {
      const page = await browser.newPage({ viewport: { width:c.w, height:c.h }, reducedMotion:"reduce" });
      await page.goto(pathToFileURL(c.file).href);
      const expected = c.state === "settings" ? ".ai-setting-card" : c.state === "history" ? ".ai-history-row" : c.state === "context" ? ".ai-domain" : ".ai-send";
      if(!await page.locator(expected).count()) throw Error("Missing specimen surface: " + c.state);
      await page.screenshot({ path:c.file.replace(/html$/, "png") });
      const report = await page.evaluate(() => {
        const rect = (selector) => { const e = document.querySelector(selector); if(!e) return null; const r=e.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom}; };
        const buttons = [...document.querySelectorAll("button")].filter(e => e.getBoundingClientRect().width > 0);
        return { bodyOverflow:document.documentElement.scrollWidth>innerWidth, outside:buttons.filter(e=>{const r=e.getBoundingClientRect();return r.left < -1 || r.right > innerWidth+1}).map(e=>e.textContent.trim()), header:rect(".ai-header"), newChat:rect("#ai-new-chat"), composer:rect(".ai-composer"), conversation:rect(".ai-conversation"), save:rect(".ai-save"), menu:rect(".ai-menu"), streamAnimation:document.querySelector(".ai-stream-dot") ? getComputedStyle(document.querySelector(".ai-stream-dot")).animationName : null };
      });
      if(report.bodyOverflow || report.outside.length) throw Error(`${c.state}-${c.w} overflow: ${JSON.stringify(report)}`);
      if(report.newChat && (report.newChat.w<44 || report.newChat.h<44)) throw Error("New conversation hit area below 44px");
      if(report.save && report.save.bottom>c.h+1) throw Error("Settings save action outside viewport");
      if(report.menu && report.menu.y<report.header.bottom-1) throw Error("Menu overlaps fixed header");
      if(report.streamAnimation && report.streamAnimation!=="none") throw Error("Reduced motion not respected");
      if(report.newChat){await page.locator("#ai-new-chat").focus();if(await page.locator("#ai-new-chat").evaluate(e=>getComputedStyle(e).outlineStyle)==="none")throw Error("Missing keyboard focus style");}
      reports.push({ state:c.state,width:c.w,...report }); await page.close();
    }
    const initial=reports.find(r=>r.state==='conversation'&&r.width===390), latest=reports.find(r=>r.state==='latest');
    if(initial.conversation.h!==latest.conversation.h || initial.composer.y!==latest.composer.y) throw Error('Latest button changes layout geometry');
    const board = path.join(out, "index.html");
    const panels = [["empty","从一句小事开始"],["conversation","清晰的信笺对话"],["history","找回聊过的话"],["settings","连接与资料有层次"]];
    fs.writeFileSync(board, `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>豆伴 · 小窝信笺</title><style>body{margin:0;padding:34px;background:#f7f0e9;color:#6b5b73;font-family:'Microsoft YaHei',sans-serif}h1{font-family:YouYuan,KaiTi,serif;font-size:30px;margin:0 0 8px}header p{margin:0;color:#756272;font-size:13px;line-height:1.8}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:22px;margin-top:26px}article{min-width:0}h2{font-size:13px;font-weight:500;margin:0 0 12px}h2 span{font-family:Georgia,serif;color:#a57891;margin-right:8px}img{display:block;width:100%;border:1px solid #ddc9d5;border-radius:17px;background:#fff9f0;box-shadow:0 5px 0 #6b5b7305}footer{margin-top:24px;font-size:11px;color:#756272;line-height:1.8}</style><header><h1>豆伴 · 小窝信笺</h1><p>微信原生 AI 界面升级 · 奶油粉绿 / 轻纸面 / 清晰正文</p></header><div class="grid">${panels.map(([state,title],i)=>`<article><h2><span>0${i+1}</span>${title}</h2><a href="${state}-390.html"><img src="${state}-390.png" alt="${title}的离线排版样张"></a></article>`).join("")}</div><footer>离线排版样张，使用示例内容，不是微信运行截图。实际交付代码：miniprogram/components/ai-assistant/。</footer></html>`);
    const boardPage = await browser.newPage({ viewport:{width:1200,height:940} });
    await boardPage.goto(pathToFileURL(board).href);
    await boardPage.screenshot({path:path.join(out,"AI视觉升级-四屏概览.png"),fullPage:true});
    await boardPage.close();
  } finally { await browser.close(); }
  fs.writeFileSync(path.join(out,"layout-report.json"), JSON.stringify({scope:"offline WXML/CSS specimen only; not native WeChat runtime",reports},null,2));
  console.log(`✓ ${reports.length} offline specimen layouts, 320 / 390 / 900px; no horizontal overflow`);
}
console.log(out);
