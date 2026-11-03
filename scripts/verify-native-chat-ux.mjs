import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "..", "miniprogram");
const copy = (value) => JSON.parse(JSON.stringify(value));
let bag = {}, failStorage = false, toast = "", definition, changes = [];
globalThis.wx = {
  getStorageSync: (key) => copy(bag[key] || ""),
  setStorageSync: (key, value) => { if (failStorage) throw new Error("storage full"); bag[key] = copy(value); },
  getWindowInfo: () => ({ windowWidth: 375, windowHeight: 812, statusBarHeight: 24 }),
  showToast: (value) => { toast = value.title; }, hideKeyboard() {},
};
globalThis.getApp = () => ({ globalData: { safeTop: 64 } });
globalThis.getCurrentPages = () => [{ route: "pages/home/index" }];
globalThis.Component = (value) => { definition = value; };
const ai = require(path.join(root, "utils/ai-state.js"));
const media = require(path.join(root, "utils/ai-media.js"));
require(path.join(root, "components/ai-assistant/index.js"));
const secret = "sk-isolated-ux-test-not-a-real-key";
const tick = () => new Promise((resolve) => setTimeout(resolve, 5));
const event = (value) => ({ detail: { value } });
function mount() {
  const component = { data: copy(definition.data) };
  component.setData = (patch) => {
    changes.push(copy(patch));
    for (const [key, value] of Object.entries(patch)) {
      const parts = key.replace(/\[(\d+)\]/g, ".$1").split(".");
      let target = component.data;
      while (parts.length > 1) { const part = parts.shift(); target = target[part] || (target[part] = {}); }
      target[parts[0]] = value;
    }
  };
  for (const [name, method] of Object.entries(definition.methods)) component[name] = method.bind(component);
  definition.lifetimes.attached.call(component);
  component.openChat();
  component.newChat();
  return component;
}
function seed(component, count = 2, length = 20) {
  const session = ai.newSession();
  session.title = "原会话";
  session.messages = Array.from({ length: count }, (_, i) => ({
    id: "m" + i, role: i % 2 ? "assistant" : "user", status: "complete",
    content: (i % 2 ? "回答" : "问题") + "兔".repeat(length), createdAt: new Date().toISOString(), sources: [], historyScopes: [],
  }));
  component._session = session;
  component.resetMessageWindow();
  component.renderSession();
  return session.id;
}
function unmount(component) { definition.lifetimes.detached.call(component); }
let count = 0;
async function check(name, run) { await run(); count++; console.log("✓", name); }
ai.saveSettings(ai.defaults(), { secret, remember: false });

await check("新对话只保留一个顶部入口，返回/更多独立，重复常驻入口已移除", () => {
  const source = fs.readFileSync(path.join(root, "components/ai-assistant/index.wxml"), "utf8");
  assert.equal((source.match(/id="ai-new-chat"/g) || []).length, 1);
  assert.match(source, /id="ai-new-chat"[^>]*catchtap="newChat"/);
  assert.match(source, /class="ai-back(?:\s[^\"]*)?"[^>]*aria-label="返回"/);
  assert.match(source, /id="ai-more"[^>]*aria-label="更多对话选项"/);
  assert.ok(!source.includes('class="ai-toolbar"') && !source.includes('class="ai-privacy"'));
  assert.ok(!source.includes('class="ai-context-strip"') && !source.includes('class="ai-first-use"'));
  assert.match(source, /wx:if="{{hasSecret}}"/);
  const css = fs.readFileSync(path.join(root, "components/ai-assistant/index.wxss"), "utf8");
  assert.match(css, /\.ai-new-chat\s*\{[^}]*min-height:\s*44px/);
  assert.match(css, /\.ai-send\s*\{[^}]*min-width:\s*44px[^}]*min-height:\s*44px/);
  assert.ok(css.includes(".ai-btn:focus-visible"));
  assert.ok(!css.includes("[disabled]"), "原生组件禁用样式使用显式状态class");
});
await check("已有会话新建时保存草稿；切回原会话恢复，未发送草稿也可找回", () => {
  const c = mount(), oldId = seed(c);
  c.inputQuestion(event("原会话未发送草稿")); c.toggleMenu(); c.newChat();
  assert.notEqual(c._session.id, oldId); assert.equal(c.data.messages.length, 0);
  assert.equal(c.data.question, ""); assert.equal(c.data.menuOpen, false);
  c.openHistory(); assert.ok(c.data.sessions.some((item) => item.id === oldId));
  c.openSession({ currentTarget: { dataset: { id: oldId } } });
  assert.equal(c.data.question, "原会话未发送草稿");
  c.newChat(); const draftId = c._session.id;
  c.inputQuestion(event("只有输入，没有发送")); c.newChat(); c.openHistory();
  assert.ok(c.data.sessions.some((item) => item.id === draftId && item.title.includes("未发送")));
  c.openSession({ currentTarget: { dataset: { id: draftId } } });
  assert.equal(c.data.question, "只有输入，没有发送"); unmount(c);
});
await check("已经空白时复用会话并明确反馈、聚焦；纯空格不能发送", async () => {
  const c = mount(), id = c._session.id;
  c.newChat(); await tick();
  assert.equal(c._session.id, id); assert.equal(toast, "已在新对话"); assert.equal(c.data.inputFocused, true);
  c.inputQuestion(event("  \n  ")); assert.equal(c.data.canSend, false);
  c.inputQuestion(event("有内容")); assert.equal(c.data.canSend, true);
  c.inputBlur(); assert.equal(c.data.inputFocused, false); unmount(c);
});
await check("存储失败时保留原会话、输入和消息，给出可恢复反馈", () => {
  const c = mount(), id = seed(c); c.inputQuestion(event("不能丢的文字"));
  failStorage = true; c.newChat(); failStorage = false;
  assert.equal(c._session.id, id); assert.equal(c.data.question, "不能丢的文字");
  assert.equal(c.data.messages.length, 2); assert.match(c.data.error, /保存失败/); unmount(c);
});
await check("流式生成中新建会话会停止旧请求，迟到回复不能写入新会话", async () => {
  const c = mount(); let options, receive, aborted = false;
  wx.request = (value) => { options = value; return { onChunkReceived(fn) { receive = fn; }, abort() { aborted = true; options.fail({ errMsg: "request:fail abort" }); } }; };
  c.inputQuestion(event("只用于隔离测试，不发送到真实服务")); c.submit();
  const oldId = c._session.id;
  const chunk = (text) => { const b = Buffer.from('data: ' + JSON.stringify({ choices: [{ delta: { content: text } }] }) + '\n\n'); return { data: b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) }; };
  receive(chunk("已收到的部分")); c.newChat(); await tick();
  assert.equal(aborted, true); assert.notEqual(c._session.id, oldId);
  assert.equal(ai.getSession(oldId).messages.at(-1).status, "aborted");
  receive(chunk("迟到消息")); await tick(); assert.equal(c.data.messages.length, 0); unmount(c);
});
await check("轻点/复制不暂停跟随，上滑与鼠标滚动暂停，键盘弹出不覆盖阅读意图", () => {
  const c = mount(); seed(c); c.data.running = true;
  c.messageTouch({ touches: [{ clientY: 200 }] }); assert.equal(c._pauseScroll, false);
  c.messageMove({ touches: [{ clientY: 225 }] }); assert.equal(c._pauseScroll, true);
  c._keyboardHandler({ height: 300 }); assert.equal(c._pauseScroll, true);
  c._layoutScrollUntil = 0; c._forceScrollUntil = 0;
  c._messageViewportHeight = 300; c._lastScrollTop = 300;
  c.messageScroll({ detail: { scrollTop: 200, scrollHeight: 1200 } }); assert.equal(c._pauseScroll, true);
  c.messageScroll({ detail: { scrollTop: 900, scrollHeight: 1200 } }); assert.equal(c._pauseScroll, false);
  c.data.running = false; unmount(c);
});
await check("回到最新后程序滚动不被当成上滑，连续回调不反复显隐按钮", async () => {
  const c = mount(); seed(c, 12); c._messageViewportHeight = 300;
  c._pauseScroll = true; c._userScrollActive = true; c.data.showLatest = true;
  changes = []; c.latest();
  for (let i = 0; i < 150; i++) {
    c.messageScroll({ detail: { scrollTop: i % 2 ? 550 : 700, scrollHeight: 1000 } });
    c.resumeScroll();
  }
  await tick();
  assert.equal(c._pauseScroll, false); assert.equal(c.data.showLatest, false);
  assert.ok(changes.filter((patch) => Object.hasOwn(patch, "showLatest")).length <= 1);
  assert.ok(changes.filter((patch) => Object.hasOwn(patch, "scrollTarget")).length <= 1);
  c._forceScrollUntil = 0; c._layoutScrollUntil = 0;
  changes = [];
  for (let i = 0; i < 100; i++) c.messageScroll({ detail: { scrollTop: 700, scrollHeight: 1000 } });
  assert.equal(changes.length, 0);
  unmount(c);
});
await check("最新按钮脱离布局流，消息区有独立边界，切换提示不改变头尾布局", () => {
  const wxml = fs.readFileSync(path.join(root, "components/ai-assistant/index.wxml"), "utf8");
  assert.match(wxml, /class="ai-conversation(?:\s[^\"]*)?"/);
  const css = fs.readFileSync(path.join(root, "components/ai-assistant/index.wxss"), "utf8");
  assert.match(css, /\.ai-conversation\s*\{[^}]*flex:\s*1[^}]*min-height:\s*0/);
  assert.match(css, /\.ai-conversation \.ai-latest\s*\{[^}]*position:\s*absolute/);
});
await check("加载更早消息保留可见锚点；超长会话分段并可返回最新", () => {
  const c = mount(); seed(c, 48); const anchor = c.data.messages[0].id;
  assert.equal(c.data.hiddenMessages, 18); c.loadEarlier();
  assert.equal(c.data.hiddenMessages, 0); assert.equal(c.data.messages.length, 48);
  assert.equal(c.data.scrollTarget, "ai-message-" + anchor); assert.equal(c._pauseScroll, true);
  seed(c, 60, 3000); c.loadEarlier();
  assert.ok(c.data.newerMessages > 0); assert.ok(c.data.hiddenMessages < 30);
  c.loadEarlier(); assert.equal(c.data.hiddenMessages, 0);
  c.latest(); assert.equal(c.data.newerMessages, 0); assert.equal(c.data.messages.at(-1).id, "m59");
  assert.equal(c._pauseScroll, false); unmount(c);
});
await check("流式刷新只更新当前回答，不重新下发整批历史；暂停后不滚底", () => {
  const c = mount(); seed(c, 12);
  const answer = c._session.messages.at(-1); answer.status = "streaming";
  c.data.running = true; c._pauseScroll = true; changes = [];
  c.flush({ id: answer.id, answer, pending: "新的流式文字" });
  assert.ok(changes.some((patch) => Object.hasOwn(patch, "messages[11]")));
  assert.ok(!changes.some((patch) => Object.hasOwn(patch, "messages")));
  assert.ok(!changes.some((patch) => Object.hasOwn(patch, "scrollTarget")));
  assert.equal(c.data.messages[11].blocks[0].text, "新的流式文字");
  c.data.running = false; unmount(c);
});
await check("切换会话后，旧图片选择结果不会附到新会话", async () => {
  const c = mount(); c.data.settings.visionEnabled = true;
  const previous = media.chooseImage; let resolve;
  media.chooseImage = () => new Promise((done) => { resolve = done; });
  const choosing = c.chooseImage(); c.newChat();
  resolve({ name: "old.jpg", preview: "wxfile://fake", dataUrl: "data:image/jpeg;base64,AAAA" });
  await choosing; media.chooseImage = previous;
  assert.equal(c.data.attachment, null); assert.equal(c.data.choosingImage, false); unmount(c);
});
await check("更多菜单、返回目的地与上下文折叠各司其职，不覆盖新对话操作", () => {
  const c = mount(); seed(c); c.toggleMenu(); c.navigateBack();
  assert.equal(c.data.menuOpen, false); assert.equal(c.data.screen, "chat");
  c.toggleMenu(); c.previewContext(); assert.equal(c.data.menuOpen, false);
  assert.equal(c.data.previewHistoryOpen, false); assert.equal(c.data.previewDataOpen, false);
  c.togglePreview({ currentTarget: { dataset: { field: "previewHistoryOpen" } } }); assert.equal(c.data.previewHistoryOpen, true);
  c.backPreview(); c.navigateBack(); assert.equal(c.data.screen, "history");
  c.navigateBack(); assert.equal(c.data.opened, false); unmount(c);
});
await check("会话搜索覆盖标题与最近消息，清空后可找回原会话和未发送草稿", () => {
  const c = mount(), originalId = seed(c);
  c._session.title = "豆米的照顾安排";
  c._session.messages.at(-1).content = "核对牧草与饮水";
  c.inputQuestion(event("这段草稿要保留")); c.newChat(); c.openHistory();
  const all = c.data.sessions.length;
  c.searchHistory(event("  牧草  "));
  assert.equal(c.data.visibleSessions.length, 1);
  assert.equal(c.data.visibleSessions[0].id, originalId);
  assert.equal(c.data.sessions.length, all);
  assert.ok(c.data.sessions.every((item) => !Object.hasOwn(item, "messages")));
  c.searchHistory(event("完全不存在的词")); assert.equal(c.data.visibleSessions.length, 0);
  c.clearHistorySearch(); assert.equal(c.data.visibleSessions.length, all);
  c.openSession({ currentTarget: { dataset: { id: originalId } } });
  assert.equal(c.data.question, "这段草稿要保留");
  assert.equal(c._session.messages.at(-1).content, "核对牧草与饮水"); unmount(c);
});
await check("完成回答可重新生成，仅替换最后一问答；附图会话不会误重传", () => {
  const c = mount(); seed(c, 6);
  assert.equal(c.data.messages.at(-1).regeneratable, true);
  assert.equal(c.data.messages[1].regeneratable, false);
  let sent; c.startQuestion = (question, history) => { sent = { question, history }; };
  c.retry(); assert.equal(sent.history.length, 4);
  assert.equal(sent.question, c._session.messages[4].content);
  c._session.messages[4].content += "\n[附图：old.jpg]";
  c.renderSession(true); assert.equal(c.data.messages.at(-1).regeneratable, false);
  sent = null; c.retry(); assert.equal(sent, null); assert.match(c.data.error, /重新选择图片/);
  unmount(c);
});
await check("资料授权默认折叠，范围计数随选择变化，展开收起不改授权", () => {
  const c = mount(); seed(c); c.openSettings();
  assert.equal(c.data.scopesOpen, false);
  const original = copy(c.data.form.scopes), n = c.data.formScopeCount;
  c.toggleScopes(); c.toggleScopes(); assert.deepEqual(c.data.form.scopes, original);
  const first = c.data.scopeRows.find((item) => item.selected);
  c.toggleScope({ currentTarget: { dataset: { id: first.id } } });
  assert.equal(c.data.formScopeCount, n - 1);
  c.toggleScope({ currentTarget: { dataset: { id: first.id } } });
  assert.equal(c.data.formScopeCount, n); unmount(c);
});
console.log(`\n✓ ${count} 组原生对话可用性回归通过；内存桩与静态约束，不替代模拟器命中/读屏/帧率验收。`);
