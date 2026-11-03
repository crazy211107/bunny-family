// Isolated native page/Canvas contracts. No simulator storage, desktop control or API.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '..');
let definition, component, writes = 0, failWrite = false, exports = [], albumWrites = 0;
let callbackQueue = null;
const copy = x => JSON.parse(JSON.stringify(x));
const tick = () => new Promise(resolve => setImmediate(resolve));
const noop = () => {};
globalThis.wx = {
  getStorageSync: () => undefined,
  setStorageSync: () => { if (failWrite) throw Error('space full'); writes++; },
  showToast: noop, getWindowInfo: () => ({ windowWidth: 390, windowHeight: 844 }),
  getImageInfo: o => o.success({ path: o.src }),
  showModal: o => o.success({ confirm: true }),
  canvasToTempFilePath: o => {
    const last = o.canvas.ctx.calls.findLastIndex(call => call.name === 'setTransform');
    o.selectionInExport = o.canvas.ctx.calls.slice(last).some(call => call.name === 'strokeRect');
    exports.push(o); o.success({ tempFilePath: '/sample/output.' + o.fileType });
  },
  saveImageToPhotosAlbum: o => { albumWrites++; o.success({}); },
  createOffscreenCanvas: () => canvas(),
  createSelectorQuery: () => {
    const q = { in: () => q, select: () => q, fields: () => q,
      exec: cb => cb([{ node: canvas(), width: 270, height: 300 }]) };
    return q;
  }
};
const app = { globalData: { safeTop: 64 } };
globalThis.getApp = () => app;
globalThis.getCurrentPages = () => [{ route: 'pages/studio/index' }];
globalThis.Page = o => { definition = o; };
globalThis.Component = o => { component = o; };
const store = require('../miniprogram/utils/store.js');
const painter = require('../miniprogram/utils/painter.js');
const model = require('../miniprogram/utils/studio-model.js');
const overlays = require('../miniprogram/utils/overlay.js');
require('../miniprogram/pages/studio/index.js');
require('../miniprogram/components/bunny-menu/index.js');
const menuDefinition = component;
function context() {
  const calls = [];
  const c = { calls };
  ['save','restore','beginPath','closePath','moveTo','lineTo','arcTo','arc','rect','clip','fill','stroke',
    'fillRect','strokeRect','drawImage','translate','rotate','scale','setTransform','setLineDash',
    'quadraticCurveTo','bezierCurveTo','clearRect','putImageData','fillText'].forEach(name => {
      c[name] = (...args) => { calls.push({ name, args }); };
    });
  c.measureText = text => ({ width: Array.from(String(text)).length * 13 });
  c.createLinearGradient = () => ({ addColorStop: noop });
  c.getImageData = (x,y,w,h) => ({ data: new Uint8ClampedArray(w*h*4) });
  return c;
}
function canvas() {
  const ctx = context();
  return { width: 0, height: 0, ctx, getContext: () => ctx, createImage() {
    const image = { width: 120, height: 90 };
    Object.defineProperty(image, 'src', { set() { queueMicrotask(() => image.onload()); } });
    return image;
  } };
}
function mount() {
  const page = { ...definition, data: copy(definition.data) };
  page.setData = (patch, done) => { Object.assign(page.data, copy(patch));
    if (done) { if (callbackQueue) callbackQueue.push(done); else done(); }
  };
  page.onLoad({});
  page.canvas = canvas(); page.canvasBox = { width: 270, height: 300 };
  page.images[page.currentId] = { width: 120, height: 90 };
  page.setData({ ready: true });
  return page;
}
const event = (dataset = {}, value) => ({ currentTarget: { dataset }, detail: { value } });
let groups = 0;
async function test(name, run) {
  await run(); groups++; console.log('✓ ' + name);
}

await test('目录等画布卸载完成后才出现；关闭后重建，参数与撤销栈不丢', async () => {
  const p = mount(); p._ready = true;
  p.sticker(event({ type: 'flower' })); const before = copy(p.settings), history = p.past.length;
  const menu = { ...menuDefinition.methods, data: copy(menuDefinition.data) };
  menu.setData = (patch, done) => { Object.assign(menu.data, patch); if (done) done(); };
  menu.register(); callbackQueue = [];
  menu.openHandler();
  assert.equal(p.data.canvasMounted, false); assert.equal(p.canvas, null);
  assert.equal(menu.data.directory, false, 'must wait for native unmount acknowledgement');
  const pending = callbackQueue; callbackQueue = null; pending.forEach(done => done());
  assert.equal(menu.data.directory, true);
  menu.close(); await tick();
  assert.equal(p.data.canvasMounted, true); assert.ok(p.canvas); assert.equal(p.data.ready, true);
  assert.deepEqual(p.settings, before); assert.equal(p.past.length, history);
  p.onUnload(); overlays.close(menu);
});
await test('多浮层拥有者、快速开关与页面离开不会提前恢复或留下画布', async () => {
  const p = mount(); p._ready = true;
  const dir = {}, ai = {}; let reopened = 0;
  overlays.open(dir); overlays.open(ai); overlays.close(dir);
  assert.equal(p.data.canvasMounted, false);
  overlays.close(ai); await tick(); assert.equal(p.data.canvasMounted, true);
  callbackQueue = []; overlays.open(dir, () => reopened++); overlays.close(dir);
  const pending = callbackQueue; callbackQueue = null; pending.forEach(done => done());
  await tick(); assert.equal(reopened, 0, 'cancelled open must not reopen mask');
  p.onHide(); assert.equal(p.canvas, null); overlays.open(dir); overlays.close(dir);
  assert.equal(p.data.canvasMounted, false); p.onShow(); await tick(); assert.ok(p.canvas);
  p.onUnload(); assert.equal(overlays.active(), false);
});
await test('十套模板真实落笔，多图镜头分别取对应照片', () => {
  assert.equal(painter.templates.length, 10);
  for (const item of painter.templates) {
    const c = canvas(), primary = { width: 120, height: 90, id: 'primary' };
    const second = { width: 90, height: 120, id: 'second' };
    painter.renderArtwork(c, primary, { ...model.defaults(), template: item.id, photoSlots: ['a','b','a','b'] }, null, { a: primary, b: second });
    assert.ok(c.ctx.calls.some(x => x.name === 'drawImage'));
    if (['comic','duo','strip'].includes(item.id)) assert.ok(c.ctx.calls.some(x => x.name === 'drawImage' && x.args[0] === second));
  }
});
await test('缩放/移动/旋转/翻转都进入绘图与撤销，重做保留构图', () => {
  const p = mount();
  p.transform(event({ key: 'zoom' }, 2)); p.transform(event({ key: 'x' }, -60));
  p.rotatePhoto(); p.flipPhoto(event({ key: 'flipX' }));
  assert.equal(p.settings.transform.rotation, 90); assert.equal(p.settings.transform.flipX, true);
  assert.ok(p.canvas.ctx.calls.some(x => x.name === 'rotate' && Math.abs(x.args[0] - Math.PI/2) < 0.001));
  assert.ok(p.canvas.ctx.calls.some(x => x.name === 'scale' && x.args[0] === -1));
  p.undo(); assert.equal(p.settings.transform.flipX, false); p.redo(); assert.equal(p.settings.transform.flipX, true);
  assert.equal(p.settings.transform.zoom, 2); p.resetTransform(); assert.equal(p.settings.transform.zoom, 1);
  p.onUnload();
});
await test('文本便签按完整字符换行，独立色彩与字号参与导出', () => {
  const p = mount(); p.sticker(event({ type: 'caption' }));
  p.captionInput(event({}, '豆米🐰\n豆糕的一封信')); p.titleEnd();
  p.stickerAdjust(event({ key: 'fontSize' }, 30)); p.layerColor(event({ color: '#87a98d' }));
  const layer = p.settings.stickers[0]; assert.equal(layer.fontSize, 30); assert.equal(layer.color, '#87a98d');
  assert.ok(p.canvas.ctx.calls.some(x => x.name === 'fillText' && x.args[0] === '豆米🐰'));
  p.undo(); assert.equal(p.settings.stickers[0].color, '#6b5b73'); p.onUnload();
});
await test('多图镜头独立取景互不影响；整组调整覆盖独立参数且可撤销', () => {
  const p=mount();p.chooseTemplate(event({id:'duo'}));
  p.compositionTarget(event({},2));p.transform(event({key:'zoom'},1.8));p.rotatePhoto();
  assert.equal(p.settings.slotTransforms[1].zoom,1.8);assert.equal(p.settings.slotTransforms[1].rotation,90);
  assert.equal(p.settings.transform.zoom,1);assert.equal(p.settings.slotTransforms[0],undefined);
  p.compositionTarget(event({},0));p.transform(event({key:'y'},40));
  assert.equal(p.settings.slotTransforms.length,0);assert.equal(p.settings.transform.y,40);
  p.undo();assert.equal(p.settings.slotTransforms[1].rotation,90);assert.equal(p.settings.transform.y,0);
  p.onUnload();
});
await test('旋转图层的点击按逆变换判断，隐藏图层不会命中', () => {
  const layer = { id: 'a', type: 'washi', x: 225, y: 250, scale: 1, rotation: 90 };
  assert.equal(painter.hitLayer(layer, { x:225, y:298 }), true);
  assert.equal(painter.hitLayer(layer, { x:273, y:250 }), false);
  assert.equal(painter.hitLayer({ ...layer, hidden: true }, { x:225, y:250 }), false);
});
await test('复制/前后排序/锁定/隐藏/居中/删除可用，锁定禁止拖动与删除', () => {
  const p = mount(); p.sticker(event({ type:'heart' })); const first=p.data.selectedId;
  p.layerAction(event({ action:'duplicate' })); const duplicate=p.data.selectedId;
  assert.notEqual(duplicate,first); assert.equal(p.settings.stickers.length,2);
  p.layerAction(event({ action:'down' })); assert.equal(p.settings.stickers[0].id,duplicate);
  p.layerAction(event({ action:'lock' })); p.layerAction(event({ action:'delete' })); assert.equal(p.settings.stickers.length,2);
  p.stickerAdjust(event({ key:'x' },99)); assert.notEqual(p.settings.stickers[0].x,99);
  p.layerAction(event({ action:'hide' })); assert.equal(p.settings.stickers[0].hidden,true);
  p.layerAction(event({ action:'lock' })); p.layerAction(event({ action:'center' })); assert.equal(p.settings.stickers[0].x,225);
  p.layerAction(event({ action:'delete' })); assert.equal(p.settings.stickers.length,1); p.undo(); assert.equal(p.settings.stickers.length,2); p.onUnload();
});
await test('配色预设、纸张、落款、日期、字号在草稿重开后完整恢复', () => {
  const p=mount(); p.tone(event({ id:'mono' })); p.paper(event({ value:'#dcebdc' }));
  p.footerInput(event({},'给豆米和豆糕')); p.titleEnd(); p.toggleDate(); p.date(event({},'2026-10-30'));
  p.sticker(event({ type:'washi' })); p.transform(event({ key:'zoom' },1.5)); p.saveDraft();
  const draft=store.get().editorDrafts[0], before=copy(p.settings); p.reset(); p.restore(event({ id:draft.id }));
  assert.deepEqual(p.settings,before); assert.equal(p.settings.saturation,0); assert.equal(p.settings.showDate,true); p.onUnload();
});
await test('旧草稿缺新增字段仍可开；脏字段和超长图层受到限制', () => {
  const s=model.normalize({ title: '🐰'.repeat(90), transform:{zoom:Infinity,rotation:37,x:999},
    stickers:[null,{id:'a',type:'caption',scale:999,text:'🐰'.repeat(100),fontSize:999,rotation:'bad'}], strokes:null });
  assert.equal(s.transform.zoom,1); assert.equal(s.transform.rotation,0); assert.equal(s.transform.x,100);
  assert.equal(Array.from(s.title).length,40); assert.equal(Array.from(s.stickers[0].text).length,40);
  assert.equal(s.stickers[0].fontSize,36); assert.deepEqual(s.strokes,[]);
  const old=model.normalize({template:'comic',stickers:[]}); assert.equal(old.transform.zoom,1); assert.equal(model.slotCount(old.template),4);
});
await test('原片对照不改作品；返回编辑后参数和撤销栈一致', () => {
  const p=mount(); p.sticker(event({type:'caption'})); p.tone(event({id:'film'}));
  const before=copy(p.settings), count=p.past.length;
  p.toggleCompare(); assert.equal(p.data.comparing,true); assert.deepEqual(p.settings,before);
  p.toggleCompare(); assert.equal(p.data.comparing,false); assert.equal(p.past.length,count); p.onUnload();
});
await test('两档尺寸均按实际像素绘制；PNG/JPG 导出不含编辑选框', async () => {
  const p=mount(); p.sticker(event({type:'caption'}));
  for (const size of [0,1]) for (const format of [0,1]) {
    p.exportOption(event({key:'exportSize'},size)); p.exportOption(event({key:'exportFormat'},format));
    p.canvas.ctx.calls.length=0; const before=exports.length;
    await p.saveWork(event({kind:'device'}));
    assert.equal(exports.length,before+1); const output=exports.at(-1);
    assert.equal(output.fileType,format?'jpg':'png'); assert.equal(output.destWidth,size?1350:900);
    assert.equal(output.destHeight,size?1500:1000);
    assert.equal(output.selectionInExport,false,'editor selection must not enter the exported bitmap');
    assert.ok(p.canvas.ctx.calls.some(x=>x.name==='scale'&&x.args[0]===(size?3:2)));
    assert.equal(p.data.busy,false); assert.equal(p.canvas.width,900,'preview returns to normal resolution');
  }
  assert.equal(albumWrites,4); p.onUnload();
});
await test('保存失败有反馈，原设置与草稿保持；清晰导出中不接受编辑或重复保存', async () => {
  const p=mount(); p.saveDraft(); const draft=copy(store.get().editorDrafts);
  p.inputTitle(event({},'继续写')); p.titleEnd(); failWrite=true; p.saveDraft(); failWrite=false;
  assert.deepEqual(store.get().editorDrafts,draft); assert.equal(p.settings.title,'继续写');
  const old=wx.canvasToTempFilePath; let resolve;
  wx.canvasToTempFilePath=o=>{resolve=()=>o.success({tempFilePath:'/sample/p.png'});};
  const pending=p.saveWork(event({kind:'device'})); assert.equal(p.data.busy,true);
  const before=copy(p.settings); p.reset(); p.undo(); p.sticker(event({type:'heart'}));
  await p.saveWork(event({kind:'device'})); assert.deepEqual(p.settings,before);
  resolve(); await pending; wx.canvasToTempFilePath=old; p.onUnload();
});
await test('新画布不复用上个画布的马赛克快照；选框仅在编辑预览出现', () => {
  const image={width:120,height:90}, settings={...model.defaults(),stickers:[{id:'a',type:'caption',text:'测试',x:225,y:200}],strokes:[{tool:'mosaic',width:10,points:[{x:30,y:30}]}]};
  const a=canvas(), b=canvas();
  painter.renderArtwork(a,image,settings,'a',{},'same'); assert.ok(a.ctx.calls.some(x=>x.name==='strokeRect'));
  painter.renderArtwork(b,image,settings,null,{},'same'); assert.equal(b.ctx.calls.some(x=>x.name==='strokeRect'),false);
});
await test('浮层使用真实条件卸载，工具/图层/导出控件有原生事件与说明', () => {
  const wxml=fs.readFileSync(path.join(root,'miniprogram/pages/studio/index.wxml'),'utf8');
  assert.match(wxml,/<canvas\s+wx:if="\{\{canvasMounted\}\}"/);
  for(const method of ['transform','rotatePhoto','sticker','layerAction','saveWork','toggleCompare']) assert.match(wxml,new RegExp('bind(?:change|tap)="'+method+'"'));
  assert.match(wxml,/aria-label="图层左右位置"/); assert.match(wxml,/导出分辨率/);
  assert.equal(overlays.active(),false); assert.ok(writes>0);
});
console.log(`\n✓ ${groups} 组工坊/浮层回归通过；隔离 wx 桩，不等同模拟器与真机视觉验收。`);
