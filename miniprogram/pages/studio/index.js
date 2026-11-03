const store = require("../../utils/store");
const painter = require("../../utils/painter");
const model = require("../../utils/studio-model");
const overlays = require("../../utils/overlay");
const defaults = model.defaults;
const whenText = (value) => {
  const d = new Date(value);
  if (isNaN(d.getTime())) return "刚刚";
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
Page({
  data: { photos: [], photoTitles: [], slotTitles: [], chosenSrc: "", templateName: painter.templates[0].name, templates: painter.templates.map((t) => Object.assign({}, t, { frames: Array.from({ length: model.slotCount(t.id) || 1 }, (_, i) => i) })), fonts: painter.fontOptions.map((f) => f.name), tools: ["模板", "构图", "文字", "贴纸", "画笔", "调色"], tool: "模板", settings: defaults(), ready: false, error: "", canUndo: false, canRedo: false, steps: 0, selectedId: "", currentSticker: null, brush: "marker", brushWidth: 8, color: "#ce8ba7", brushes: [{ id: "marker", title: "马克笔" }, { id: "highlight", title: "荧光笔" }, { id: "dash", title: "虚线笔" }, { id: "mosaic", title: "马赛克" }], colorNames: ["樱花粉", "薄荷绿", "奶油黄", "可可紫", "奶油白"], colors: model.colors, slots: [], drafts: [], busy: false, canvasMounted: true, canvasHeight: 300, compositionIndex: -1, compositionValue:0, compositionTitles:[], currentTransform:defaults().transform, layersOpen: false, layers: [], exportOpen: false, exportSize: 0, exportFormat: 0, exportSizes: ["标准 · 900 × 1000", "清晰 · 1350 × 1500"], exportFormats: ["PNG · 无损", "JPG · 较小文件"], papers: model.papers, tones: model.tones, stickerTypes: model.stickerTypes, activeTone: "original", comparing: false },
  onLoad(options) {
    this.settings = defaults();
    this.past = [];
    this.future = [];
    this.images = {};
    this.currentId = options.id || "";
    this._visible = true;
    this.loadState();
    this._unsubscribe = overlays.subscribe((active, done) => this.overlayChanged(active, done));
  },
  onReady() {
    this._ready = true;
    if (!overlays.active()) this.mountCanvas();
  },
  onShow() {
    this._visible = true;
    if (this.settings) {
      this.loadState();
      if (this._ready && !overlays.active()) this.resumeCanvas();
    }
  },
  onHide() {
    this._visible = false;
    this.suspendCanvas();
  },
  onResize() {
    if (!this.canvas) return;
    if (!this.data.busy) this.finishGesture();
    const canvas = this.canvas;
    wx.createSelectorQuery().in(this).select("#artboard").fields({ size: true, rect: true }).exec((result) => {
      if(this._disposed || this.canvas !== canvas) return;
      if (result[0] && result[0].width) {
        this.canvasBox = result[0];
        this.setData({ canvasHeight: result[0].width * 500 / 450 });
      }
    });
  },
  onUnload() {
    this._disposed = true;
    if (this._unsubscribe) this._unsubscribe();
    this.loadToken = (this.loadToken || 0) + 1;
    this.canvas = null;
    this.images = {};
  },
  overlayChanged(active, done) {
    if (this._disposed) {
      done();
      return;
    }
    if (active) this.suspendCanvas(done);
    else if (this._visible && this._ready) this.resumeCanvas(done);
    else done();
  },
  suspendCanvas(done) {
    this.finishGesture();
    this.titleEnd();
    this.loadToken = (this.loadToken || 0) + 1;
    this._mountToken = (this._mountToken || 0) + 1;
    this.canvas = null;
    this.images = {};
    this.setData({ canvasMounted: false, ready: false, comparing: false }, done);
  },
  resumeCanvas(done) {
    if (this._disposed || !this._visible || overlays.active()) {
      if (done) done();
      return;
    }
    if (this.data.canvasMounted && this.canvas) {
      if (done) done();
      return;
    }
    this.setData({ canvasMounted: true }, () => {
      if (done) done();
      this.mountCanvas();
    });
  },
  mountCanvas() {
    if (this._disposed || !this._visible || overlays.active() || !this.data.canvasMounted) return;
    const token = (this._mountToken || 0) + 1;
    this._mountToken = token;
    wx.createSelectorQuery().in(this).select("#artboard").fields({ node: true, size: true, rect: true }).exec((result) => {
      if (this._disposed || token !== this._mountToken || overlays.active() || !this._visible) return;
      if (!result[0] || !result[0].node) {
        this.setData({ error: "画布暂未展开，请点重新展开。", ready: false });
        return;
      }
      this.canvas = result[0].node;
      this.canvasBox = result[0];
      this.images = {};
      this.setData({ canvasHeight: result[0].width * 500 / 450 }, () => this.loadImages());
    });
  },
  loadState() {
    const state = store.get(), photos = store.activePhotos(state);
    if (!photos.some((p) => p.id === this.currentId)) this.currentId = photos.length ? photos[0].id : "";
    this.photos = photos;
    const chosen = photos.find((p) => p.id === this.currentId);
    this.setData({ photos: photos.map((p) => Object.assign({}, p, { selected: p.id === this.currentId })), photoTitles: ["同图柔和叠影"].concat(photos.map((p) => p.title)), slotTitles: photos.map((p) => p.title), chosenSrc: chosen ? chosen.src : "", drafts: (state.editorDrafts || []).map((d) => Object.assign({}, d, { when: whenText(d.updatedAt) })) });
    this.sync();
  },
  sync() {
    const count = model.slotCount(this.settings.template);
    if (this.data.compositionIndex >= count) this.setData({compositionIndex:-1});
    const selected = this.settings.stickers.find((s) => s.id === this.data.selectedId) || null;
    const slots = Array.from({ length: model.slotCount(this.settings.template) }, (_, index) => {
      const id = this.settings.photoSlots[index] || this.currentId;
      const photo = (this.photos || []).find((p) => p.id === id);
      return { index, id, src: photo ? photo.src : "", photoIndex: Math.max(0, (this.photos || []).findIndex((p) => p.id === id)) };
    });
    const meta = painter.templates.find((t) => t.id === this.settings.template) || painter.templates[0];
    const tone = model.tones.find((t) => t.b === this.settings.brightness && t.c === this.settings.contrast && t.s === this.settings.saturation);
    const layers = this.settings.stickers.map((s, index) => Object.assign({}, s, { index, name: model.layerName(s), selected: s.id === this.data.selectedId })).reverse();
    this.setData({ settings: Object.assign({}, this.settings, { stickers: store.clone(this.settings.stickers), strokes: this.settings.strokes.map((s) => ({ id: s.id })) }), templateName: meta.name, canUndo: !!this.past.length, canRedo: !!this.future.length, steps: this.past.length, currentSticker: selected, layers, slots, currentTransform:store.clone(this.activeTransform()),compositionValue:this.data.compositionIndex+1,compositionTitles:["全部镜头（覆盖独立取景）"].concat(slots.map(s=>"单独调整第 "+(s.index+1)+" 镜头")), activeTone: tone ? tone.id : "custom", fontIndex: Math.max(0, painter.fontOptions.findIndex((f) => f.value === this.settings.font)), secondaryIndex: Math.max(0, (this.photos || []).findIndex((p) => p.id === this.settings.secondaryId) + 1) });
    if (this.canvas && this.data.ready) this.draw();
  },
  async sourceCandidates(src) {
    if (!src) throw new Error("照片地址为空");
    if (/^https?:/i.test(src) || src.indexOf("wxfile:") === 0 || src.indexOf("data:") === 0) return [src];
    const fix = (value) => {
      if (!value) return value;
      if (value.charAt(0) === "/" || /^[a-z]+:\/\//i.test(value) || value.indexOf("data:") === 0) return value;
      return "/" + value;
    };
    const list = [];
    try {
      const info = await new Promise((resolve, reject) => wx.getImageInfo({ src, success: resolve, fail: reject }));
      if (info && info.path) {
        list.push(fix(info.path));
      }
    } catch (error) {
    }
    list.push(fix(src));
    return list.filter((item, index) => item && list.indexOf(item) === index);
  },
  copyToLocal(src) {
    const fix = (value) => {
      if (!value) return value;
      if (value.charAt(0) === "/" || /^[a-z]+:\/\//i.test(value) || value.indexOf("data:") === 0) return value;
      return "/" + value;
    };
    try {
      const fs = wx.getFileSystemManager();
      const target = `${wx.env.USER_DATA_PATH}/studio-${src.replace(/[^a-zA-Z0-9.]+/g, "_")}`;
      try {
        fs.accessSync(target);
        return target;
      } catch (error) {
      }
      fs.writeFileSync(target, fs.readFileSync(fix(src), "binary"), "binary");
      return target;
    } catch (error) {
      return "";
    }
  },
  async loadCanvasImage(src, canvas) {
    const img = (canvas || this.canvas).createImage();
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("加载超时 " + src)), 5e3);
      img.onload = () => {
        clearTimeout(timer);
        resolve();
      };
      img.onerror = () => {
        clearTimeout(timer);
        reject(new Error("解码失败 " + src));
      };
      img.src = src;
    });
    return img;
  },
  async image(id) {
    const photo = (this.photos || []).find((p) => p.id === id);
    if (!photo) throw new Error("照片已收起或不存在");
    if (this.images[id]) return this.images[id];
    if (!this.canvas) throw new Error("画布还没准备好");
    const canvas = this.canvas;
    const candidates = await this.sourceCandidates(photo.src);
    let lastError = null;
    for (let i = 0; i < candidates.length; i++) {
      try {
        const img = await this.loadCanvasImage(candidates[i], canvas);
        if (!this._disposed && this.canvas === canvas) this.images[id] = img;
        return img;
      } catch (error) {
        lastError = error;
      }
    }
    const local = this.copyToLocal(photo.src);
    if (local) {
      try {
        const img = await this.loadCanvasImage(local, canvas);
        if (!this._disposed && this.canvas === canvas) this.images[id] = img;
        return img;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error("图片解码失败");
  },
  async loadImages() {
    if (!this.canvas) {
      if (!overlays.active()) this.mountCanvas();
      return;
    }
    if (!this.currentId) {
      this.setData({ ready: false, error: "先去相册带一帧回忆过来吧。" });
      return;
    }
    const token = (this.loadToken || 0) + 1;
    this.loadToken = token;
    this.setData({ ready: false, error: "" });
    try {
      const ids = [this.currentId];
      if (model.slotCount(this.settings.template)) ids.push.apply(ids, (this.settings.photoSlots || []).slice(0, model.slotCount(this.settings.template)).filter((id) => this.photos.some((p) => p.id === id)));
      if (this.settings.template === "exposure" && this.photos.some((p) => p.id === this.settings.secondaryId)) ids.push(this.settings.secondaryId);
      await Promise.all(Array.from(new Set(ids)).map((id) => this.image(id)));
      if (token !== this.loadToken || this._disposed) return;
      this.setData({ ready: true });
      this.draw();
    } catch (error) {
      if (token === this.loadToken && !this._disposed) this.setData({ error: "图片读取失败：" + (error.message || "未知原因"), ready: false });
    }
  },
  draw(selected, ratio) {
    if (!this.canvas || !this.data.ready || this.data.busy && !ratio) return false;
    try {
      const s = this.data.comparing ? Object.assign(defaults(), { template: this.settings.template, photoSlots: this.settings.photoSlots, secondaryId: this.settings.secondaryId, date: this.settings.date }) : this.settings;
      const signature = JSON.stringify([this.currentId, s.template, s.transform, s.slotTransforms, s.photoSlots, s.secondaryId, s.brightness, s.contrast, s.saturation, s.paper]);
      painter.renderArtwork(this.canvas, this.images[this.currentId], s, selected === false || this.data.comparing ? null : this.data.selectedId, this.images, signature, ratio);
      return true;
    } catch (error) {
      this.setData({ error: error.message || "作品绘制失败" });
      return false;
    }
  },
  remember(base) {
    this.past.push(store.clone(base || this.settings));
    if (this.past.length > 30) this.past.shift();
    this.future = [];
  },
  edit(key, value, load) {
    if (this.data.busy) return;
    this.compareEnd();
    this.titleEnd();
    this.finishGesture();
    if (JSON.stringify(this.settings[key]) === JSON.stringify(value)) return;
    this.remember();
    this.settings[key] = value;
    this.sync();
    if (load) this.loadImages();
  },
  undo() {
    if (this.data.busy) return;
    this.compareEnd();
    this.titleEnd();
    this.finishGesture();
    if (!this.past.length) return;
    this.future.unshift(store.clone(this.settings));
    this.settings = this.past.pop();
    this.setData({ selectedId: "" });
    this.sync();
    this.loadImages();
  },
  redo() {
    if (this.data.busy) return;
    this.compareEnd();
    this.titleEnd();
    this.finishGesture();
    if (!this.future.length) return;
    this.past.push(store.clone(this.settings));
    this.settings = this.future.shift();
    this.setData({ selectedId: "" });
    this.sync();
    this.loadImages();
  },
  choosePhoto(e) {
    if (this.data.busy) return;
    this.compareEnd();
    this.titleEnd();
    this.finishGesture();
    this.currentId = e.currentTarget.dataset.id;
    this.loadState();
    this.loadImages();
  },
  async upload() {
    if (this.data.busy) return;
    try {
      const photos = await store.choosePhotos(9);
      if (photos.length && !this._disposed) {
        this.currentId = photos[0].id;
        this.loadState();
        this.loadImages();
      }
    } catch (error) {
      if (!this._disposed) store.toast("图片未能带回家");
    }
  },
  chooseTemplate(e) {
    this.edit("template", e.currentTarget.dataset.id, true);
  },
  tool(e) {
    if (this.data.busy) return;
    this.compareEnd();
    this.titleEnd();
    this.finishGesture();
    this.setData({ tool: e.currentTarget.dataset.tool });
  },
  inputTitle(e) {
    if (this.data.busy) return;
    this.compareEnd();
    if (!this.titleBase) this.titleBase = store.clone(this.settings);
    this.settings.title = Array.from(e.detail.value).slice(0, 40).join("");
    this.draw();
  },
  titleEnd() {
    if (this.titleBase && JSON.stringify(this.titleBase) !== JSON.stringify(this.settings)) this.remember(this.titleBase);
    this.titleBase = null;
    this.sync();
  },
  font(e) {
    this.edit("font", painter.fontOptions[Number(e.detail.value)].value);
  },
  adjust(e) {
    this.edit(e.currentTarget.dataset.key, Number(e.detail.value));
  },
  cream() {
    this.tone({ currentTarget: { dataset: { id: "cream" } } });
  },
  sticker(e) {
    if (this.data.busy) return;
    this.compareEnd();
    this.titleEnd();
    this.finishGesture();
    if (this.settings.stickers.length >= 16) {
      store.toast("最多放 16 个文字或贴纸图层");
      return;
    }
    const type = e.currentTarget.dataset.type;
    if (type !== "caption" && !model.stickerTypes.some((s2) => s2.id === type)) return;
    this.remember();
    const s = painter.cleanStickers([{ id: store.uid(), type, x: 225, y: 170, scale: 1, rotation: 0, text: "豆米和豆糕的好时光 ♡", color: type === "caption" ? "#6b5b73" : this.data.color }])[0];
    this.settings.stickers.push(s);
    this.setData({ selectedId: s.id, tool: type === "caption" ? "文字" : "贴纸" });
    this.sync();
  },
  stickerAdjust(e) {
    const key = e.currentTarget.dataset.key;
    const bounds = { scale: [0.5, 2.5], rotation: [-180, 180], fontSize: [14, 36], x: [15, 435], y: [15, 485] };
    if (!bounds[key]) return;
    this.changeLayer((s) => {
      s[key] = model.finite(e.detail.value, s[key], bounds[key][0], bounds[key][1]);
    });
  },
  changeLayer(change, allowLocked) {
    if (this.data.busy) return;
    this.compareEnd();
    this.titleEnd();
    this.finishGesture();
    const layer = this.settings.stickers.find((s) => s.id === this.data.selectedId);
    if (!layer) return;
    if (layer.locked && !allowLocked) {
      store.toast("这个图层已锁定，请先解锁");
      return;
    }
    const before = store.clone(this.settings);
    change(layer);
    if (JSON.stringify(before) !== JSON.stringify(this.settings)) this.remember(before);
    this.sync();
  },
  removeSticker() {
    this.edit("stickers", this.settings.stickers.filter((s) => s.id !== this.data.selectedId));
    this.setData({ selectedId: "" });
    this.sync();
  },
  brush(e) {
    this.setData({ brush: e.currentTarget.dataset.id });
  },
  color(e) {
    this.setData({ color: e.currentTarget.dataset.color });
  },
  brushWidth(e) {
    this.setData({ brushWidth: Number(e.detail.value) });
  },
  point(e) {
    const touch = e.touches && e.touches[0] || e.changedTouches && e.changedTouches[0];
    if (!touch) return null;
    const scale = 450 / this.canvasBox.width;
    return { x: Math.max(0, Math.min(450, touch.x * scale)), y: Math.max(0, Math.min(500, touch.y * scale)) };
  },
  touchStart(e) {
    if (!this.data.ready || this.data.busy || this.data.comparing) return;
    this.titleEnd();
    const point = this.point(e);
    if (!point) return;
    this.gestureBase = store.clone(this.settings);
    if (this.data.tool === "画笔") {
      if (this.settings.strokes.length >= 200) {
        this.gestureBase = null;
        store.toast("最多画 200 笔，先保存这张作品吧");
        return;
      }
      this.paintId = store.uid();
      this.settings.strokes.push({ id: this.paintId, tool: this.data.brush, width: this.data.brushWidth, color: this.data.color, points: [point] });
      this.setData({ selectedId: "" });
    } else if (this.data.tool === "构图") {
      this.cropOrigin = point;
      this.cropTransform = store.clone(this.activeTransform());
    } else {
      const selected = this.settings.stickers.slice().reverse().find((s) => !s.locked && painter.hitLayer(s, point));
      this.setData({ selectedId: selected ? selected.id : "" });
      if (!selected) {
        this.gestureBase = null;
        this.sync();
        return;
      }
      this.dragId = selected.id;
      this.offset = { x: point.x - selected.x, y: point.y - selected.y };
    }
    this.draw();
  },
  touchMove(e) {
    if (!this.gestureBase) return;
    const point = this.point(e);
    if (!point) return;
    if (this.paintId) {
      const stroke = this.settings.strokes.find((s) => s.id === this.paintId);
      if (stroke && stroke.points.length < 1e3) stroke.points.push(point);
    } else if (this.cropOrigin) {
      const next = store.clone(this.cropTransform);
      next.x = model.finite(this.cropTransform.x + (point.x - this.cropOrigin.x) * 0.6, 0, -100, 100);
      next.y = model.finite(this.cropTransform.y + (point.y - this.cropOrigin.y) * 0.6, 0, -100, 100);
      if(this.data.compositionIndex >= 0) this.settings.slotTransforms[this.data.compositionIndex] = next;
      else { this.settings.transform = next; this.settings.slotTransforms = []; }
    } else if (this.dragId) {
      const s = this.settings.stickers.find((t) => t.id === this.dragId);
      if (s) {
        s.x = Math.max(15, Math.min(435, point.x - this.offset.x));
        s.y = Math.max(15, Math.min(485, point.y - this.offset.y));
      }
    }
    this.drawThrottled();
  },
  drawThrottled() {
    const now = Date.now();
    if (now - (this._lastDrawAt || 0) < 40) return;
    this._lastDrawAt = now;
    this.draw();
  },
  finishGesture() {
    this._lastDrawAt = 0;
    if (this.gestureBase && JSON.stringify(this.gestureBase) !== JSON.stringify(this.settings)) this.remember(this.gestureBase);
    this.gestureBase = null;
    this.paintId = null;
    this.dragId = null;
    this.cropOrigin = null;
    this.cropTransform = null;
    if (this.settings) this.sync();
  },
  clearInk() {
    this.edit("strokes", []);
  },
  slot(e) {
    const list = this.settings.photoSlots.slice();
    while (list.length < 4) list.push(this.currentId);
    list[Number(e.currentTarget.dataset.slot)] = this.photos[Number(e.detail.value)].id;
    this.edit("photoSlots", list, true);
  },
  secondary(e) {
    const i = Number(e.detail.value);
    this.edit("secondaryId", i > 0 ? this.photos[i - 1].id : "", true);
  },
  transform(e) {
    const key = e.currentTarget.dataset.key, t = store.clone(this.activeTransform());
    if (!["zoom", "x", "y"].includes(key)) return;
    t[key] = model.finite(e.detail.value, t[key], key === "zoom" ? 1 : -100, key === "zoom" ? 3 : 100);
    this.applyTransform(t);
  },
  rotatePhoto() {
    const t = store.clone(this.activeTransform());
    t.rotation = (t.rotation + 90) % 360;
    this.applyTransform(t);
  },
  flipPhoto(e) {
    const key = e.currentTarget.dataset.key;
    if (!["flipX", "flipY"].includes(key)) return;
    const t = store.clone(this.activeTransform());
    t[key] = !t[key];
    this.applyTransform(t);
  },
  resetTransform() {
    this.applyTransform(defaults().transform);
  },
  activeTransform() {
    const index=this.data.compositionIndex;
    return index >= 0 ? this.settings.slotTransforms[index] || this.settings.transform : this.settings.transform;
  },
  compositionTarget(e) {
    if(this.data.busy)return;
    this.finishGesture();
    const index=Number(e.detail.value)-1;
    if(!Number.isInteger(index) || index < -1 || index >= model.slotCount(this.settings.template))return;
    this.setData({compositionIndex:index});this.sync();
  },
  applyTransform(transform) {
    if(this.data.busy)return;
    if(this.data.compositionIndex >= 0) {
      const list=this.settings.slotTransforms.slice();list[this.data.compositionIndex]=transform;
      this.edit('slotTransforms',list);
    } else {
      this.compareEnd();this.titleEnd();this.finishGesture();this.remember();
      this.settings.transform=transform;this.settings.slotTransforms=[];this.sync();
    }
  },
  tone(e) {
    const tone = model.tones.find((t) => t.id === e.currentTarget.dataset.id);
    if (!tone || this.data.busy) return;
    this.compareEnd();
    this.titleEnd();
    this.finishGesture();
    this.remember();
    Object.assign(this.settings, { brightness: tone.b, contrast: tone.c, saturation: tone.s });
    this.sync();
  },
  paper(e) {
    const value = e.currentTarget.dataset.value;
    if (model.papers.some((p) => p.value === value)) this.edit("paper", value);
  },
  titleStyle(e) {
    const key = e.currentTarget.dataset.key;
    if (key === "titleSize") this.edit(key, model.finite(e.detail.value, 23, 16, 30));
    else if (key === "titleColor" && model.colors.includes(e.currentTarget.dataset.color)) this.edit(key, e.currentTarget.dataset.color);
  },
  footerInput(e) {
    if (this.data.busy) return;
    this.compareEnd();
    if (!this.titleBase) this.titleBase = store.clone(this.settings);
    this.settings.footerText = Array.from(e.detail.value).slice(0, 60).join("");
    this.draw();
  },
  date(e) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(e.detail.value)) this.edit("date", e.detail.value);
  },
  toggleDate() {
    this.edit("showDate", !this.settings.showDate);
  },
  captionInput(e) {
    const layer = this.settings.stickers.find((s) => s.id === this.data.selectedId);
    if (!layer || layer.type !== "caption" || layer.locked || this.data.busy) return;
    this.compareEnd();
    if (!this.titleBase) this.titleBase = store.clone(this.settings);
    layer.text = Array.from(e.detail.value).slice(0, 40).join("");
    this.draw();
  },
  layerColor(e) {
    const color = e.currentTarget.dataset.color;
    if (model.colors.includes(color)) this.changeLayer((s) => {
      s.color = color;
    });
  },
  captionBackground() {
    this.changeLayer((s) => {
      s.background = !s.background;
    });
  },
  toggleLayers() {
    this.titleEnd();
    this.finishGesture();
    this.setData({ layersOpen: !this.data.layersOpen });
  },
  selectLayer(e) {
    this.titleEnd();
    this.finishGesture();
    const id = e.currentTarget.dataset.id;
    const layer = this.settings.stickers.find((s) => s.id === id);
    if (!layer) return;
    this.setData({ selectedId: id, tool: layer.type === "caption" ? "文字" : "贴纸" });
    this.sync();
  },
  layerAction(e) {
    const action = e.currentTarget.dataset.action;
    if (action === "lock") {
      this.changeLayer((s) => {
        s.locked = !s.locked;
      }, true);
      return;
    }
    if (action === "hide") {
      this.changeLayer((s) => {
        s.hidden = !s.hidden;
      }, true);
      return;
    }
    if (this.data.busy) return;
    this.compareEnd();
    this.titleEnd();
    this.finishGesture();
    const list = this.settings.stickers, index = list.findIndex((s) => s.id === this.data.selectedId), layer = list[index];
    if (!layer) return;
    if (layer.locked) {
      store.toast("先解锁，再编辑这个图层");
      return;
    }
    if (action === "duplicate") {
      if (list.length >= 16) {
        store.toast("图层已满，最多 16 个");
        return;
      }
      this.remember();
      const duplicate = Object.assign(store.clone(layer), { id: store.uid(), x: Math.min(435, layer.x + 16), y: Math.min(485, layer.y + 16) });
      list.splice(index + 1, 0, duplicate);
      this.setData({ selectedId: duplicate.id });
    } else if (action === "up" || action === "down") {
      const to = index + (action === "up" ? 1 : -1);
      if (to < 0 || to >= list.length) return;
      this.remember();
      list.splice(index, 1);
      list.splice(to, 0, layer);
    } else if (action === "center") {
      this.remember();
      layer.x = 225;
      layer.y = 250;
    } else if (action === "delete") {
      this.remember();
      list.splice(index, 1);
      this.setData({ selectedId: "" });
    } else return;
    this.sync();
  },
  compareStart() {
    if (!this.data.ready || this.data.busy) return;
    this.titleEnd();
    this.finishGesture();
    this.setData({ comparing: true });
    this.draw(false);
  },
  compareEnd() {
    if (!this.data.comparing) return;
    this.setData({ comparing: false });
    this.draw();
  },
  toggleCompare() {
    if (this.data.comparing) this.compareEnd();
    else this.compareStart();
  },
  focusCanvas() {
    this.titleEnd();
    this.finishGesture();
    wx.pageScrollTo({ selector: ".editor-film", duration: 0 });
  },
  stop() {
  },
  toggleExport() {
    this.setData({ exportOpen: !this.data.exportOpen });
  },
  exportOption(e) {
    if (this.data.busy) return;
    const key = e.currentTarget.dataset.key, index = Number(e.detail.value);
    if (["exportSize", "exportFormat"].includes(key) && [0, 1].includes(index)) this.setData({ [key]: index });
  },
  saveDraft() {
    if (!this.currentId || this.data.busy) {
      store.toast("先选一张照片再存草稿");
      return;
    }
    this.titleEnd();
    this.finishGesture();
    try {
      const id = this.draftId || store.uid();
      const draft = { id, name: this.settings.title || "还没写完的可爱", photoId: this.currentId, settings: store.clone(this.settings), updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
      store.update((s) => {
        s.editorDrafts = [draft].concat(s.editorDrafts.filter((d) => d.id !== id));
      });
      this.draftId = id;
      this.loadState();
      store.toast("草稿留好啦，下次接着写 ♡");
    } catch (error) {
      store.toast("草稿未能保存，请检查本机空间");
    }
  },
  restore(e) {
    if (this.data.busy) return;
    const draft = (store.get().editorDrafts || []).find((d) => d.id === e.currentTarget.dataset.id);
    if (!draft) return;
    if (!this.photos.some((p) => p.id === draft.photoId)) {
      store.toast("请先从相册回收站恢复主照片");
      return;
    }
    this.titleEnd();
    this.finishGesture();
    this.currentId = draft.photoId;
    this.draftId = draft.id;
    this.settings = model.normalize(store.clone(draft.settings));
    this.past = [];
    this.future = [];
    this.setData({ selectedId: "" });
    this.loadState();
    this.loadImages();
  },
  removeDraft(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: "收起这份草稿？",
      content: "删除后这份编辑参数无法恢复。",
      confirmText: "删除草稿",
      confirmColor: "#9b6d85",
      success: (result) => {
        if (!result.confirm) return;
        try {
          store.update((s) => {
            s.editorDrafts = s.editorDrafts.filter((d) => d.id !== id);
          });
          this.loadState();
        } catch (error) {
          store.toast("草稿未能移除");
        }
      }
    });
  },
  exportFile(canvas, ratio, format) {
    return new Promise((resolve, reject) => wx.canvasToTempFilePath({ canvas, fileType: format, quality: 0.92, destWidth: 450 * ratio, destHeight: 500 * ratio, success: (r) => resolve(r.tempFilePath), fail: reject }, this));
  },
  async saveWork(e) {
    if (!this.data.ready || this.data.busy || overlays.active() || !this.canvas) return;
    this.compareEnd();
    this.titleEnd();
    this.finishGesture();
    const canvas = this.canvas, ratio = this.data.exportSize === 1 ? 3 : 2, format = this.data.exportFormat === 1 ? "jpg" : "png";
    const settings = store.clone(this.settings), original = this.photos.find((p) => p.id === this.currentId);
    this.setData({ busy: true, error: "" });
    try {
      if (!this.draw(false, ratio)) throw new Error("画布绘制失败，请重试");
      const temp = await this.exportFile(canvas, ratio, format);
      if (e.currentTarget.dataset.kind === "device") {
        await new Promise((resolve, reject) => wx.saveImageToPhotosAlbum({ filePath: temp, success: resolve, fail: reject }));
        store.toast("已存入手机相册 ♡");
      } else {
        const src = await store.saveFile(temp), id = store.uid();
        store.update((s) => {
          s.photos.unshift({ id, src, title: settings.title || "新的一帧小美好", tag: "作品", petIds: original && original.petIds || [], date: store.date(), liked: false, template: settings.template });
        });
        store.toast("作品已收进回忆相册 ♡");
        if (!this._disposed) this.loadState();
      }
    } catch (error) {
      if (!this._disposed) this.setData({ error: error.errMsg || error.message || "保存失败，请检查相册授权和本机空间。" });
    } finally {
      if (!this._disposed) {
        this.setData({ busy: false });
        this.draw();
      }
    }
  },
  reset() {
    if (this.data.busy) return;
    this.compareEnd();
    this.titleEnd();
    this.finishGesture();
    this.remember();
    this.settings = defaults();
    this.setData({ selectedId: "" });
    this.sync();
    this.loadImages();
  }
});
