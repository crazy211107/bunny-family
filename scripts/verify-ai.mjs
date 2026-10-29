import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(import.meta.url), root = path.resolve(import.meta.dirname, '..', 'miniprogram');
const copy = value => JSON.parse(JSON.stringify(value));
const bag = {}, noop = () => {}; let storageFails = false;
globalThis.wx = {
  getStorageSync: key => bag[key] && copy(bag[key]), setStorageSync: (key, value) => { if (storageFails) throw new Error('storage full'); bag[key] = copy(value); },
  showToast: noop, showLoading: noop, hideLoading: noop, vibrateShort: noop,
  getWindowInfo: () => ({ windowWidth: 375, windowHeight: 812, statusBarHeight: 24 }),
};
globalThis.getApp = () => ({ globalData: { safeTop: 64 } });
globalThis.getCurrentPages = () => [{ route: 'pages/home/index' }];
const state = require(path.join(root, 'utils/ai-state.js'));
const context = require(path.join(root, 'utils/ai-context.js'));
const client = require(path.join(root, 'utils/ai-client.js'));
const store = require(path.join(root, 'utils/store.js'));
const markdown = require(path.join(root, 'utils/ai-markdown.js'));
let count = 0;
async function check(label, fn) { await fn(); count++; console.log('✓', label); }
const secret = 'sk-fake-only-for-local-tests-123456';
const config = () => state.defaults();
const bytes = text => { const buffer = Buffer.from(text); return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength); };
function mockRequest(chunks, result = { statusCode: 200, data: '' }, error) {
  let options, task, callback;
  wx.request = value => {
    options = value; task = { aborted: false, onChunkReceived(fn) { callback = fn; }, abort() { this.aborted = true; options.fail({ errMsg: 'request:fail abort' }); } };
    queueMicrotask(() => {
      if (task.aborted) return;
      for (const chunk of chunks || []) if (callback) callback({ data: typeof chunk === 'string' ? bytes(chunk) : chunk });
      if (!task.aborted) error ? options.fail(error) : options.success(result);
    });
    return task;
  };
  return { options: () => options, task: () => task };
}
const sse = (text, finish) => 'data: ' + JSON.stringify({ model: 'local-test-model', choices: [{ delta: { content: text }, finish_reason: finish || null }] }) + '\n\n';
function fixture() {
  const data = store.initial(), today = store.date();
  data.carePlans = [{ id: 'plan-a', title: '梳毛独特事项', startDate: today, rule: 'daily', petIds: ['qiu'], assigneeId: 'm1' }]; data.planLogs = {};
  data.supplies = [{ id: 'hay-a', name: '真实牧草', quantity: 0.2, unit: 'kg', threshold: 0.3, movements: [{ id: 'movement-a', delta: 0.2, at: today, note: '补货独特备注' }] }];
  data.notes = [{ id: 'note-a', date: today, title: '独特午后', body: '联系 13912345678。测试凭据 sk-never-send-this-key-123456。', tags: ['贴贴'] }, { id: 'trash-a', title: '回收站秘密内容', trashedAt: today }];
  data.albums = [{ id: 'album-a', title: '我们的独特主题册', photoIds: ['p1', 'p2'] }]; data.videos = [{ id: 'video-a', title: '独特视频片名', caption: '独特旁白', date: today, src: 'wxfile://not-sent.mp4' }];
  data.editorDrafts = [{ id: 'art-a', name: '工坊未完成片段', photoId: 'p1', settings: { template: 'film', title: '工坊草稿字迹', strokes: [{ points: [1, 2, 3] }], stickers: [] } }];
  data.diaryDraft = { form: { title: '未提交日记秘密', body: '只有主动勾选草稿才发送' } };
  data.handover = { note: '独特交接留言', contactName: '测试联系人', contactPhone: '13912345678', clinic: '已填写的测试医院', clinicPhone: '010-12345678', petNotes: { qiu: '豆米的独特习惯' } };
  data.apiKey = 'configuration-secret-must-never-be-sent'; data.pets[0].weights = [{ date: today, kg: 1.3 }];
  return data;
}

await check('密钥默认仅内存、设置白名单、显式记住与清除', () => {
  const saved = state.saveSettings({ ...config(), apiKey: 'not-allowed' }, { secret, remember: false });
  assert.equal(saved.apiKey, undefined); assert.equal(state.getSecret(), secret); assert.ok(!JSON.stringify(bag['bunny-ai-settings-v1']).includes(secret));
  state.saveSettings(config(), { secret, remember: true }); assert.equal(bag['bunny-ai-settings-v1'].secret, secret);
  state.clearSecret(); assert.equal(state.getSecret(), ''); assert.ok(!JSON.stringify(bag).includes(secret));
});
await check('设置写入失败保留原密钥，不提前污染内存', () => {
  state.saveSettings(config(), { secret, remember: false }); storageFails = true;
  assert.throws(() => state.saveSettings(config(), { secret: 'replacement-key-123', remember: true })); storageFails = false;
  assert.equal(state.getSecret(), secret);
});
await check('11 范围与应用目录、实际字段、图片元信息，不附路径或凭据', () => {
  const scopes = { ...config().scopes, drafts: true };
  const pack = context.buildContext({ state: fixture(), scopes, query: '', page: 'pages/album/index', maxChars: 28000 });
  for (const scope of context.SCOPES) assert.ok(pack.sources.some(source => source.id === scope.id && source.included > 0), scope.id);
  for (const phrase of ['独特视频片名', '工坊草稿字迹', '独特主题册', '独特交接留言', '梳毛独特事项', 'movement-a']) assert.ok(pack.text.includes(phrase), phrase);
  for (const phrase of ['wxfile://', '/assets/', 'configuration-secret', 'sk-never-send', '13912345678', '回收站秘密内容', '010-12345678']) assert.ok(!pack.text.includes(phrase), phrase);
  assert.ok(pack.text.includes('不合成MP4')); assert.ok(pack.text.includes('未记录不代表未照顾'));
});
await check('默认不附草稿/联系方式，显式勾选后纳入，关闭范围不发送对应正文', () => {
  const data = fixture(), defaults = context.buildContext({ state: data, scopes: config().scopes });
  assert.ok(!defaults.text.includes('未提交日记秘密')); assert.ok(!defaults.text.includes('测试联系人'));
  const contacts = context.buildContext({ state: data, scopes: config().scopes, includeContacts: true });
  assert.ok(contacts.text.includes('13912345678')); assert.ok(contacts.sources.some(source => source.id === 'contacts' && source.included));
  const scoped = context.buildContext({ state: data, scopes: { ...config().scopes, diary: false, handover: false }, includeContacts: true });
  assert.ok(!scoped.text.includes('独特午后')); assert.ok(!scoped.text.includes('13912345678'));
});
await check('资料预算、全模块覆盖与关键词检索，不能假装全量已知', () => {
  const data = fixture(); data.notes = Array.from({ length: 120 }, (_, index) => ({ id: 'n' + index, title: '历史日记' + index, body: index === 119 ? 'needle-unique 这条旧记录必须被找到' : '很长的历史'.repeat(80) }));
  const pack = context.buildContext({ state: data, scopes: config().scopes, query: 'needle-unique', maxChars: 5000 });
  assert.ok(pack.text.includes('needle-unique')); assert.ok(pack.truncated); assert.ok(pack.chars <= 5000); assert.ok(pack.text.includes('不代表全部历史'));
  assert.ok(pack.sources.some(source => source.id === 'pets' && source.included));
});
await check('缩小资料范围后过滤旧对话引用；附图只保留文字，不暗中重传原图', () => {
  const history = [{ role: 'user', content: '以前问过日记', status: 'complete' }, { role: 'assistant', content: 'old-diary-secret', status: 'complete', sources: [{ id: 'diary' }] }, { role: 'user', content: '附图', status: 'complete', hasAttachment: true }, { role: 'assistant', content: 'old-image-content', status: 'complete', hasAttachment: true }, { role: 'user', content: '普通问候', status: 'complete' }, { role: 'assistant', content: 'safe-reply', status: 'complete', sources: [] }];
  const settings = { ...config(), scopes: { ...config().scopes, diary: false } }, messages = context.buildMessages({ question: '新问题', history, settings, context: { text: '当前快照' } });
  const raw = JSON.stringify(messages); assert.ok(!raw.includes('old-diary-secret')); assert.ok(raw.includes('old-image-content')); assert.ok(raw.includes('此前附图未重新发送')); assert.ok(!raw.includes('image_url')); assert.ok(raw.includes('safe-reply')); assert.equal(messages[0].role, 'system');
  assert.ok(messages[0].content.includes('数据而非指令'));
});
await check('图文消息只有主动有效附图，base64 不进会话保存结构', () => {
  const attachment = { dataUrl: 'data:image/jpeg;base64,AAAA' };
  const messages = context.buildMessages({ question: '看看这张图', settings: config(), context: { text: '元信息' }, attachment }); assert.ok(Array.isArray(messages[1].content));
  const session = state.newSession(); session.messages = [{ id: 'image-message', role: 'user', content: '看看这张图[附图]', status: 'complete', attachment, hasAttachment: true }]; state.saveSession(session);
  assert.ok(!JSON.stringify(bag['bunny-ai-history-v1']).includes('base64'));
});
await check('Endpoint 兼容 /v1 与完整路径，阻止 HTTP、账号、查询与换行密钥', () => {
  assert.equal(client.endpoint(config()), 'https://api.deepseek.com/chat/completions');
  assert.equal(client.endpoint({ baseUrl: 'https://example.com/v1/' }), 'https://example.com/v1/chat/completions');
  assert.equal(client.endpoint({ baseUrl: 'https://example.com/v1/chat/completions' }), 'https://example.com/v1/chat/completions');
  for (const baseUrl of ['http://example.com', 'https://user:key@example.com', 'https://example.com?key=x', 'https://example.com/#x']) assert.throws(() => client.endpoint({ baseUrl }));
  assert.throws(() => client.validateSettings(config(), 'invalid\r\nheader')); assert.throws(() => client.validateSettings({ ...config(), mode: 'relay', maxTokens: 128 }, secret));
});
await check('UTF-8 每字节切分，跨中文/emoji/CRLF 的 SSE 不乱码不丢字', async () => {
  const response = sse('豆米🐰', null).replaceAll('\n', '\r\n') + sse('和豆糕', 'stop') + 'data: [DONE]\n\n';
  const stream = [...Buffer.from(response)].map(byte => Uint8Array.of(byte).buffer), deltas = [];
  const mock = mockRequest(stream); const result = await client.requestChat({ settings: config(), secret, messages: [{ role: 'user', content: '仅用于隔离测试' }], onDelta: value => deltas.push(value) }).promise;
  assert.equal(result.text, '豆米🐰和豆糕'); assert.equal(deltas.at(-1), result.text); assert.equal(mock.options().data.reasoning_effort, 'none');
});
await check('无分片回调时兼容普通 JSON，relay 不发送 model 与供应商密钥字段', async () => {
  const mock = mockRequest([], { statusCode: 200, data: JSON.stringify({ choices: [{ message: { content: '本机测试回答' }, finish_reason: 'stop' }] }) });
  const result = await client.requestChat({ settings: { ...config(), mode: 'relay', baseUrl: 'https://relay.example/v1' }, secret, messages: [{ role: 'user', content: '测试' }] }).promise;
  assert.equal(result.text, '本机测试回答'); assert.equal(mock.options().data.model, undefined); assert.equal(mock.options().data.apiKey, undefined);
});
await check('HTTP 错误不泄漏正文或密钥，SSE 结束前断线不标成功', async () => {
  mockRequest([sse('暂时内容') + 'data: [DONE]\n\n'], { statusCode: 401, data: 'secret-provider-error' });
  await assert.rejects(client.requestChat({ settings: config(), secret, messages: [{ role: 'user', content: '测试' }] }).promise, error => error.code === 'HTTP_401' && !error.message.includes('secret-provider-error'));
  mockRequest([sse('收到一半')]);
  await assert.rejects(client.requestChat({ settings: config(), secret, messages: [{ role: 'user', content: '测试' }] }).promise, error => error.code === 'INCOMPLETE');
});
await check('主动停止立即取消，迟到回调不能写成完整回答', async () => {
  const mock = mockRequest([sse('不应再更新', 'stop')]);
  const request = client.requestChat({ settings: config(), secret, messages: [{ role: 'user', content: '测试' }] });
  const assertion = assert.rejects(request.promise, error => error.code === 'ABORTED'); request.abort(); await assertion; assert.ok(mock.task().aborted);
});
await check('安全 Markdown 仅文本，不执行模型 HTML 与链接', () => {
  const blocks = markdown.blocks('# 标题\n- 一件小事\n<script>never execute</script>\n```js\nalert(1)\n```');
  assert.ok(blocks.some(block => block.type === 'heading')); assert.ok(blocks.some(block => block.type === 'code')); assert.ok(blocks.every(block => typeof block.text === 'string' && !block.html));
});
await check('更换兔兔档案照：取消不修改；选相册照片后保存，同步数据源', async () => {
  store.save({ ...store.initial(), carePlans: [], planLogs: {}, supplies: [], albums: [], handover: {} });
  let definition; globalThis.Page = value => { definition = value; }; require(path.join(root, 'pages/pets/index.js'));
  const page = { ...definition, data: copy(definition.data) };
  page.setData = patch => { for (const [key, value] of Object.entries(patch)) { const parts = key.split('.'); let target = page.data; while (parts.length > 1) { const part = parts.shift(); target = target[part] || (target[part] = {}); } target[parts[0]] = value; } };
  page.onLoad({}); page.onShow(); const original = store.get().pets[0].photo; page.openPetEditor();
  page.selectPetPhoto({ currentTarget: { dataset: { id: 'p4' } } }); page.closeDrawer(); assert.equal(store.get().pets[0].photo, original);
  page.openPetEditor(); page.selectPetPhoto({ currentTarget: { dataset: { id: 'p4' } } }); await page.saveCurrent();
  assert.equal(store.get().pets[0].photo, '/assets/photos/qiuqiu-front.jpg'); assert.equal(store.get().pets[1].photo, '/assets/photos/doudou-close.jpg');
});

await check('手机照片先预览后持久保存，文件失败时保留原档案', async () => {
  let definition; globalThis.Page = value => { definition = value; };
  delete require.cache[require.resolve(path.join(root, 'pages/pets/index.js'))]; require(path.join(root, 'pages/pets/index.js'));
  const page = { ...definition, data: copy(definition.data) };
  page.setData = patch => { for (const [key, value] of Object.entries(patch)) { const parts = key.split('.'); let target = page.data; while (parts.length > 1) { const part = parts.shift(); target = target[part] || (target[part] = {}); } target[parts[0]] = value; } };
  wx.showActionSheet = options => options.success({ tapIndex: 0 });
  wx.chooseMedia = options => { options.success({ tempFiles: [{ tempFilePath: 'wxfile://temporary.jpg' }] }); options.complete(); };
  wx.env = { USER_DATA_PATH: '/user-data' };
  wx.getFileSystemManager = () => ({ saveFile: options => options.success({ savedFilePath: '/user-data/new-photo.jpg' }) });
  page.onLoad({}); page.onShow(); page.openPetEditor(); const original = store.get().pets[0].photo;
  page.choosePetPhoto(); assert.ok(page.data.petForm.temporaryPhoto); assert.equal(store.get().pets[0].photo, original);
  await page.saveCurrent(); assert.equal(store.get().pets[0].photo, '/user-data/new-photo.jpg');
  page.openPetEditor(); page.choosePetPhoto();
  wx.getFileSystemManager = () => ({ saveFile: options => options.fail(new Error('full')) }); wx.saveFile = options => options.fail(new Error('full'));
  await page.saveCurrent(); assert.equal(store.get().pets[0].photo, '/user-data/new-photo.jpg'); assert.ok(page.data.formError); assert.equal(page.data.photoSaving, false);
});

await check('悬浮组件真实模块联动：发送、停止、资料预览、跨主机凭据保护与拖动边界', async () => {
  let definition; globalThis.Component = value => { definition = value; }; require(path.join(root, 'components/ai-assistant/index.js'));
  const component = { data: copy(definition.data) };
  component.setData = patch => { for (const [key, value] of Object.entries(patch)) { const parts = key.split('.'); let target = component.data; while (parts.length > 1) { const part = parts.shift(); target = target[part] || (target[part] = {}); } target[parts[0]] = value; } };
  Object.keys(definition.methods).forEach(name => { component[name] = definition.methods[name].bind(component); });
  state.saveSettings(config(), { secret, remember: false }); store.save(fixture()); definition.lifetimes.attached.call(component);
  component.openChat(); component.newChat(); component.inputQuestion({ detail: { value: '今天还有哪些照顾？' } });
  const mock = mockRequest([sse('已读取本机测试记录', 'stop') + 'data: [DONE]\n\n']);
  component.submit(); await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(component.data.running, false); assert.equal(component.data.messages.at(-1).status, 'complete');
  assert.ok(JSON.stringify(mock.options().data).includes('梳毛独特事项')); assert.ok(!JSON.stringify(mock.options().data).includes(secret));
  component.previewContext(); assert.ok(component.data.previewChars > 0); component.backChat();
  component.openSettings(); component.data.form.baseUrl = 'https://different.example/v1'; assert.throws(() => component.connectionSecret(component.settingsValue()), /重新输入/);
  component.backChat(); component.newChat(); let pendingOptions, chunk;
  wx.request = options => { pendingOptions = options; return { onChunkReceived(fn) { chunk = fn; }, abort() { pendingOptions.fail({ errMsg: 'request:fail abort' }); } }; };
  component.inputQuestion({ detail: { value: '停止测试' } }); component.submit(); chunk({ data: bytes(sse('这是一段部分回答')) }); component.stop(); await Promise.resolve();
  assert.equal(component.data.messages.at(-1).status, 'aborted'); assert.ok(component._session.messages.at(-1).content.includes('部分回答'));
  component.dragStart({ touches: [{ clientX: 300, clientY: 300 }] }); component.dragMove({ touches: [{ clientX: -900, clientY: -900 }] }); component.dragEnd(); assert.ok(component.data.floatX >= 8); assert.ok(component.data.floatY >= component.data.safeTop + 58);
  component.inputQuestion({ detail: { value: '返回时保留这份草稿' } });
  component.navigateBack(); assert.equal(component.data.screen, 'history');
  assert.ok(component.data.sessions.some(item => item.current));
  component.openSession({ currentTarget: { dataset: { id: component._session.id } } });
  assert.equal(component.data.question, '返回时保留这份草稿');
  component.navigateBack(); component.navigateBack(); assert.equal(component.data.opened, false);
  const previousClipboard = wx.setClipboardData; let copiedCode = '';
  wx.setClipboardData = options => { copiedCode = options.data; };
  component._session.messages.push({ id: 'code-copy', role: 'assistant', content: '```js\nconst bunny = 1;\n```' });
  component.copyCode({ currentTarget: { dataset: { message: 'code-copy', index: 0 } } });
  assert.equal(copiedCode, 'const bunny = 1;'); wx.setClipboardData = previousClipboard;
  definition.lifetimes.detached.call(component);
});

const pair = (index, answer = '回答-' + index, sources = []) => [
  { role: 'user', content: '问题-' + index, status: 'complete' },
  { role: 'assistant', content: answer, status: 'complete', sources, historyScopes: [] },
];
await check('连续问答保留最近15轮与顺序，符合中转32条消息限制；构建不修改原历史', () => {
  const history = Array.from({ length: 20 }, (_, i) => pair(i)).flat(), before = JSON.stringify(history);
  const request = context.prepareMessages({ question: '把刚才那段缩短', history, settings: config() });
  assert.equal(request.messages.length, 32);
  assert.equal(request.messages[1].content, '问题-5');
  assert.equal(request.messages[30].content, '回答-19');
  assert.ok(request.messages[31].content.endsWith('把刚才那段缩短'));
  assert.equal(request.history.includedTurns, 15); assert.equal(request.history.omittedTurns, 5);
  assert.equal(JSON.stringify(history), before);
});
await check('长回答按预算保留首尾和更早约定，不因一轮过长丢掉全部上文', () => {
  const long = '起始约定：署名阿森。' + '正文🐰'.repeat(5000) + '结尾：明天交接。';
  const history = [...pair(0, '最初约定：不写假数据'), ...pair(1, long), ...pair(2, long)];
  const request = context.prepareMessages({ question: '沿用最初约定，修改结尾', history, settings: config() });
  const raw = JSON.stringify(request.messages);
  assert.equal(request.history.includedTurns, 3); assert.ok(request.history.shortenedTurns > 0);
  assert.ok(request.history.chars <= 20000); assert.ok(raw.includes('最初约定：不写假数据'));
  assert.ok(raw.includes('起始约定：署名阿森')); assert.ok(raw.includes('结尾：明天交接'));
  assert.ok(raw.includes('此条中段已省略'));
  for (const item of request.messages) assert.ok(!/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(item.content));
  const image = context.conversationHistory({ history, settings: config(), attachment: { dataUrl: 'data:image/jpeg;base64,AAAA' } });
  assert.equal(image.stats.includedTurns, 3); assert.ok(image.stats.chars <= 8000);
});
await check('只过滤实际发送过的关闭范围，空范围不误删普通聊天；草稿和电话仍受保护', () => {
  const history = [
    ...pair(0, '可以继续修改这份草稿', [{ id: 'diary', included: 0 }, { id: 'pets', included: 2 }]),
    ...pair(1, '不能重发的日记正文', [{ id: 'diary', included: 1 }]),
    ...pair(2, '不能重发的旧草稿', [{ id: 'drafts' }]),
    ...pair(3, '不能重发的旧电话', [{ id: 'contacts', included: 1 }]),
  ];
  const request = context.prepareMessages({ question: '继续', history, settings: { ...config(), scopes: { ...config().scopes, diary: false } } });
  const raw = JSON.stringify(request.messages);
  assert.ok(raw.includes('可以继续修改这份草稿')); assert.ok(!raw.includes('不能重发'));
  assert.equal(request.history.blockedTurns, 3); assert.equal(request.history.includedTurns, 1);
});
await check('停止后的实际文字可以接着写，并明确标记未完成；空错误及生成中不冒充历史回答', () => {
  const history = [...pair(0, '交接留言写到这里'), ...pair(1, ''), ...pair(2, '尚未结束')];
  history[1].status = 'aborted'; history[3].status = 'error'; history[5].status = 'streaming';
  const request = context.prepareMessages({ question: '从停下的地方继续', history, settings: config() });
  assert.equal(request.history.partialTurns, 1); assert.equal(request.history.includedTurns, 1);
  assert.ok(request.messages[2].content.includes('未完成')); assert.ok(request.messages[2].content.includes('交接留言写到这里'));
  assert.ok(!JSON.stringify(request.messages).includes('尚未结束'));
});
await check('后续回答继承上文资料范围，关闭范围后不能经改写回答带回；旧记录保守兼容', () => {
  const first = pair(0, '日记里的真实称呼', [{ id: 'diary', included: 1 }]);
  const prepared = context.prepareMessages({ question: '改成更短的称呼', history: first, settings: config() });
  const second = pair(1, '从日记改写出的称呼', [{ id: 'diary', included: 0 }]);
  second[1].historyScopes = prepared.historyScopes;
  const session = state.newSession(); session.messages = [...first, ...second];
  const saved = state.saveSession(session);
  assert.ok(saved.messages[3].historyScopes.includes('diary'));
  const filtered = context.prepareMessages({ question: '继续', history: saved.messages,
    settings: { ...config(), scopes: { ...config().scopes, diary: false } } });
  assert.equal(filtered.history.blockedTurns, 2);
  assert.ok(!JSON.stringify(filtered.messages).includes('称呼'));
  const legacy = pair(2, '旧版依赖无法确认', [{ id: 'diary', included: 0 }]);
  delete legacy[1].historyScopes;
  assert.equal(context.prepareMessages({ question: '继续', history: legacy,
    settings: { ...config(), scopes: { ...config().scopes, diary: false } } }).history.blockedTurns, 1);
});
await check('原生组件连续追问的实际请求含上一问答；预览一致，重开会话仍保留，新会话不串线', async () => {
  let definition; globalThis.Component = value => { definition = value; };
  delete require.cache[require.resolve(path.join(root, 'components/ai-assistant/index.js'))];
  require(path.join(root, 'components/ai-assistant/index.js'));
  const mount = () => {
    const component = { data: copy(definition.data) };
    component.setData = patch => { for (const [key, value] of Object.entries(patch)) {
      const parts = key.split('.'); let target = component.data;
      while (parts.length > 1) { const part = parts.shift(); target = target[part] || (target[part] = {}); }
      target[parts[0]] = value;
    }};
    Object.keys(definition.methods).forEach(name => { component[name] = definition.methods[name].bind(component); });
    definition.lifetimes.attached.call(component); component.openChat(); return component;
  };
  state.saveSettings(config(), { secret, remember: false });
  const component = mount(); component.newChat();
  mockRequest([sse('第一版交接：署名阿森，明天添草。', 'stop') + 'data: [DONE]\n\n']);
  component.inputQuestion({ detail: { value: '帮写交接，署名阿森' } }); component.submit();
  await new Promise(resolve => setTimeout(resolve, 5));
  const second = mockRequest([sse('阿森：明天记得添草。', 'stop') + 'data: [DONE]\n\n']);
  component.inputQuestion({ detail: { value: '把刚才那段改短' } }); component.submit();
  await new Promise(resolve => setTimeout(resolve, 5));
  const sent = second.options().data.messages;
  assert.equal(sent[1].content, '帮写交接，署名阿森');
  assert.equal(sent[2].content, '第一版交接：署名阿森，明天添草。');
  assert.ok(sent[3].content.endsWith('把刚才那段改短'));
  assert.ok(component.data.historyHint.includes('2 轮')); assert.equal(component.data.notice, '');
  component.previewContext(); assert.equal(component.data.previewHistory.length, 4);
  assert.equal(component.data.previewHistory[2].content, '把刚才那段改短');
  component.backPreview(); definition.lifetimes.detached.call(component);
  const reopened = mount();
  const third = mockRequest([sse('沿用阿森署名。', 'stop') + 'data: [DONE]\n\n']);
  reopened.inputQuestion({ detail: { value: '保留刚才的署名' } }); reopened.submit();
  await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(third.options().data.messages.length, 6);
  assert.ok(JSON.stringify(third.options().data.messages).includes('阿森：明天记得添草'));
  reopened.newChat();
  const fresh = mockRequest([sse('新的一页。', 'stop') + 'data: [DONE]\n\n']);
  reopened.inputQuestion({ detail: { value: '这是另一段对话' } }); reopened.submit();
  await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(fresh.options().data.messages.length, 2);
  assert.ok(!JSON.stringify(fresh.options().data.messages).includes('署名阿森'));
  definition.lifetimes.detached.call(reopened);
});

console.log(`\n✓ ${count} 组 AI/照片验证通过；全部为假数据与 wx 桩，未调用真实 AI 服务`);
