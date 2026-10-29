const store = require("../../utils/store");
const planner = require("../../utils/planner");
const MOODS = ["开心", "治愈", "平静", "想念", "有点累"];
const MARKS = { 开心: "☀", 治愈: "♡", 平静: "☁", 想念: "✉", 有点累: "☾" };
const list = (value) => (Array.isArray(value) ? value : []);
const copy = (value) => JSON.parse(JSON.stringify(value));
const hasContent = (form) =>
  !!String(form.title || "").trim() ||
  !!String(form.body || "").trim() ||
  !!String(form.tagsText || "").trim() ||
  list(form.photoIds).length > 0;
Page({
  data: {
    pageError: "",
    today: "",
    query: "",
    dateFilter: "",
    moodIndex: 0,
    moodOptions: ["全部心情"].concat(MOODS),
    editorMoods: MOODS,
    petFilter: "all",
    petFilters: [],
    recycle: false,
    trashCount: 0,
    notes: [],
    editing: false,
    draft: {},
    editorPets: [],
    photoChoices: [],
    missingPhotoCount: 0,
    detail: null,
    uploading: false,
    tagFilter: "",
    tagCloud: [],
    pendingDraft: null,
    draftStatus: "",
  },
  onLoad(options) {
    this._initial = options || {};
  },
  onShow() {
    this.setData({ safeTop: getApp().globalData.safeTop || 64 });
    this.reload();
    if (this._initial) {
      const options = this._initial;
      this._initial = null;
      if (options.new || options.id || options.edit) {
        const id =
          options.id ||
          (options.edit !== "1" && options.edit !== "true" ? options.edit : "");
        this.openEditor({ currentTarget: { dataset: { id: id || "" } } });
      }
    }
  },
  onHide() {
    this.persistDraft();
  },
  onUnload() {
    this.persistDraft();
  },
  noop() {},
  error(error) {
    const message = (error && error.message) || "暂时没有保存成功，请稍后再试";
    this.setData({ formError: message, pageError: message });
    store.toast(message);
  },
  invalid(message) {
    this.setData({ formError: message });
    store.toast(message);
  },
  reload() {
    try {
      this._state = store.get();
      if (this.data.pageError) this.setData({ pageError: '' });
      this.setData({ today: store.date() });
      this.refresh();
    } catch (error) {
      this.error(error);
    }
  },
  refresh() {
    const state = this._state || { notes: [], pets: [], photos: [] };
    const photos = store.activePhotos(state);
    const byId = {};
    photos.forEach((photo) => {
      byId[photo.id] = photo;
    });
    const pets = list(state.pets),
      notes = list(state.notes);
    const tagCounts = {};
    notes
      .filter((note) => !!note.trashedAt === this.data.recycle)
      .forEach((note) => {
        list(note.tags).forEach((tag) => {
          if (tag) tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
      });
    const tagCloud = Object.keys(tagCounts)
      .sort(
        (a, b) => tagCounts[b] - tagCounts[a] || a.localeCompare(b, "zh-CN"),
      )
      .map((tag) => ({
        text: tag,
        count: tagCounts[tag],
        active: tag === this.data.tagFilter,
      }));
    const q = this.data.query.trim().toLowerCase();
    const mood = this.data.moodIndex ? MOODS[this.data.moodIndex - 1] : "";
    const decorate = (note) => {
      const linked = list(note.photoIds)
        .map((id) => byId[id])
        .filter(Boolean);
      return Object.assign({}, note, {
        mood: note.mood || "平静",
        mark: MARKS[note.mood] || "♡",
        date: note.date || store.date(note.createdAt || new Date()),
        bodyPreview: (note.body || "").slice(0, 90),
        petText: pets
          .filter((pet) => list(note.petIds).indexOf(pet.id) !== -1)
          .map((pet) => pet.name)
          .join(" · "),
        tags: list(note.tags),
        photos: linked.map((photo) => ({
          id: photo.id,
          title: photo.title,
          src: store.getPhotoSource(photo),
        })),
        missingPhotoCount: list(note.photoIds).length - linked.length,
      });
    };
    const visible = notes
      .filter((note) => {
        if (!!note.trashedAt !== this.data.recycle) return false;
        const date = note.date || store.date(note.createdAt || new Date());
        return (
          (!q ||
            [note.title, note.body]
              .concat(list(note.tags))
              .join(" ")
              .toLowerCase()
              .indexOf(q) !== -1) &&
          (!mood || (note.mood || "平静") === mood) &&
          (!this.data.dateFilter || date === this.data.dateFilter) &&
          (!this.data.tagFilter ||
            list(note.tags).indexOf(this.data.tagFilter) !== -1) &&
          (this.data.petFilter === "all" ||
            list(note.petIds).indexOf(this.data.petFilter) !== -1)
        );
      })
      .sort((a, b) => {
        if (!this.data.recycle && !!a.pinned !== !!b.pinned)
          return a.pinned ? -1 : 1;
        const da = a.date || store.date(a.createdAt || new Date()),
          db = b.date || store.date(b.createdAt || new Date());
        return (
          db.localeCompare(da) ||
          String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
        );
      })
      .map(decorate);
    const detailSource =
      this.data.detail && notes.find((note) => note.id === this.data.detail.id);
    const moodCount = {};
    visible.forEach((note) => {
      const key = note.mood || "平静";
      moodCount[key] = (moodCount[key] || 0) + 1;
    });
    const moodKeys = Object.keys(moodCount);
    const moodMax = moodKeys.length
      ? Math.max.apply(
          null,
          moodKeys.map((key) => moodCount[key]),
        )
      : 1;
    const moodStats = moodKeys
      .sort((a, b) => moodCount[b] - moodCount[a])
      .map((key) => ({
        name: key,
        mark: MARKS[key] || "♡",
        count: moodCount[key],
        percent: Math.max(8, Math.round((moodCount[key] / moodMax) * 100)),
      }));
    this.setData({
      moodStats,
      tagCloud,
      pendingDraft:
        state.diaryDraft &&
        state.diaryDraft.form &&
        hasContent(state.diaryDraft.form)
          ? {
              title: state.diaryDraft.form.title || "还没起名字的小故事",
              date: state.diaryDraft.form.date || "",
              originalId: state.diaryDraft.originalId || "",
            }
          : null,
      notes: visible,
      trashCount: notes.filter((note) => note.trashedAt).length,
      petFilters: [
        { id: "all", name: "所有主角", active: this.data.petFilter === "all" },
      ].concat(
        pets.map((pet) => ({
          id: pet.id,
          name: pet.name,
          active: this.data.petFilter === pet.id,
        })),
      ),
      detail: detailSource ? decorate(detailSource) : null,
    });
    if (this.data.editing) this.editorChoices();
  },
  write(change, message) {
    try {
      store.update(change);
      this.reload();
      if (message) store.toast(message);
      return true;
    } catch (error) {
      this.error(error);
      return false;
    }
  },
  search(event) {
    this.setData({ query: event.detail.value });
    this.refresh();
  },
  resetFilters() {
    this.setData({
      query: "",
      dateFilter: "",
      moodIndex: 0,
      petFilter: "all",
      tagFilter: "",
      recycle: false,
    });
    this.refresh();
  },
  changeDate(event) {
    this.setData({ dateFilter: event.detail.value });
    this.refresh();
  },
  clearDate() {
    this.setData({ dateFilter: "" });
    this.refresh();
  },
  changeMood(event) {
    this.setData({ moodIndex: Number(event.detail.value) });
    this.refresh();
  },
  filterPet(event) {
    this.setData({ petFilter: event.currentTarget.dataset.id });
    this.refresh();
  },
  filterTag(event) {
    const tag = event.currentTarget.dataset.tag || "";
    this.setData({
      tagFilter: this.data.tagFilter === tag ? "" : tag,
      detail: null,
    });
    this.refresh();
  },
  clearTag() {
    this.setData({ tagFilter: "" });
    this.refresh();
  },
  switchRoom(event) {
    this.setData({
      recycle: event.currentTarget.dataset.room === "trash",
      detail: null,
      tagFilter: "",
    });
    this.refresh();
  },
  togglePin(event) {
    const id = event.currentTarget.dataset.id;
    this.write((state) => {
      const note = list(state.notes).find((item) => item.id === id);
      if (note && !note.trashedAt) note.pinned = !note.pinned;
    }, "手账书签更新啦 ♡");
  },
  showDetail(event) {
    const note = list(this._state.notes).find(
      (item) => item.id === event.currentTarget.dataset.id,
    );
    if (note) {
      this.setData({ detail: note });
      this.refresh();
    }
  },
  closeDetail() {
    this.setData({ detail: null });
  },
  openEditor(event) {
    const id = event && event.currentTarget && event.currentTarget.dataset.id;
    const pending = this._state && this._state.diaryDraft;
    if (pending && pending.form && hasContent(pending.form)) {
      if (!id || (pending.originalId || "") === id) {
        this.restoreDraft();
        return;
      }
      wx.showModal({
        title: "还有一页没写完的故事",
        content:
          "本机草稿里留着另一页旁白。先续写或丢弃草稿，再编辑这一页，避免覆盖。",
        confirmText: "继续草稿",
        cancelText: "暂不编辑",
        confirmColor: "#a56885",
        success: (result) => {
          if (result.confirm) this.restoreDraft();
        },
      });
      return;
    }
    const note =
      id &&
      list(this._state && this._state.notes).find((item) => item.id === id);
    if (id && !note) {
      store.toast("这一页暂时找不到了");
      return;
    }
    this.setData({
      editing: true,
      detail: null,
      formError: "",
      draft: {
        id: (note && note.id) || "",
        title: (note && note.title) || "",
        body: (note && note.body) || "",
        date: (note && note.date) || store.date(),
        mood: (note && note.mood) || "治愈",
        moodIndex: Math.max(0, MOODS.indexOf((note && note.mood) || "治愈")),
        petIds: list(note && note.petIds).slice(),
        photoIds: list(note && note.photoIds).slice(0, 4),
        tagsText: list(note && note.tags).join("，"),
      },
    });
    this._baselineDraft = JSON.stringify(this.data.draft);
    this.setData({ draftStatus: "离开这一页时，会替你留好草稿" });
    this.editorChoices();
  },
  closeEditor() {
    if (!this.persistDraft()) return;
    this.setData({ editing: false, draft: {} });
    this.reload();
  },
  queueDraft() {
    if (this._draftTimer) clearTimeout(this._draftTimer);
    this.setData({ draftStatus: "正在把旁白夹进草稿…" });
    this._draftTimer = setTimeout(() => {
      this._draftTimer = null;
      this.persistDraft();
    }, 550);
  },
  persistDraft() {
    if (this._draftTimer) {
      clearTimeout(this._draftTimer);
      this._draftTimer = null;
    }
    if (!this.data.editing) return true;
    const form = copy(this.data.draft),
      originalId = form.id || "";
    try {
      const state = store.get(),
        pending = state.diaryDraft;
      if (!hasContent(form)) {
        if (pending && (pending.originalId || "") === originalId)
          store.update((next) => {
            next.diaryDraft = null;
          });
        this.setData({
          pendingDraft: null,
          draftStatus: "写下一点内容，就会自动保存草稿",
        });
        return true;
      }
      if (JSON.stringify(form) === this._baselineDraft && !pending) return true;
      if (
        !pending ||
        (pending.originalId || "") !== originalId ||
        JSON.stringify(pending.form) !== JSON.stringify(form)
      ) {
        store.update((next) => {
          next.diaryDraft = {
            originalId,
            form,
            savedAt: new Date().toISOString(),
          };
        });
      }
      this._state = store.get();
      this.setData({
        pendingDraft: {
          title: form.title || "还没起名字的小故事",
          date: form.date || "",
          originalId,
        },
        draftStatus: "✓ 草稿已留在本机",
      });
      return true;
    } catch (error) {
      this.setData({ draftStatus: "暂未保存成功，请保留这一页再试一次" });
      return false;
    }
  },
  restoreDraft() {
    const pending = store.get().diaryDraft;
    if (!pending || !pending.form) return;
    const form = Object.assign(
      {
        id: "",
        title: "",
        body: "",
        date: store.date(),
        mood: "治愈",
        moodIndex: 1,
        petIds: [],
        photoIds: [],
        tagsText: "",
      },
      copy(pending.form),
    );
    form.id = pending.originalId || "";
    if (
      form.id &&
      !list(store.get().notes).some((note) => note.id === form.id)
    ) {
      form.id = "";
      store.toast("原故事已经移除，草稿会作为新故事继续");
    }
    form.petIds = list(form.petIds);
    form.photoIds = list(form.photoIds).slice(0, 4);
    form.moodIndex = Math.max(0, MOODS.indexOf(form.mood));
    this._baselineDraft = null;
    this.setData({
      editing: true,
      detail: null,
      formError: "",
      draft: form,
      draftStatus: "✓ 已接着上次的草稿继续写",
    });
    this.editorChoices();
  },
  discardDraft() {
    wx.showModal({
      title: "丢弃没写完的草稿？",
      content: "只清除这份草稿，已经保存的手账不会改变。",
      confirmText: "丢弃草稿",
      confirmColor: "#a56885",
      success: (result) => {
        if (!result.confirm) return;
        if (this._draftTimer) {
          clearTimeout(this._draftTimer);
          this._draftTimer = null;
        }
        if (
          this.write((state) => {
            state.diaryDraft = null;
          }, "草稿已清空")
        )
          this.setData({ editing: false, draft: {}, pendingDraft: null });
      },
    });
  },
  draftInput(event) {
    const key = "draft." + event.currentTarget.dataset.field;
    this.setData({ [key]: event.detail.value });
    this.queueDraft();
  },
  draftDate(event) {
    if (event.detail.value > store.date()) {
      store.toast("故事的日子不能晚于今天");
      return;
    }
    this.setData({ "draft.date": event.detail.value });
    this.queueDraft();
  },
  draftMood(event) {
    const index = Number(event.detail.value);
    this.setData({ "draft.mood": MOODS[index], "draft.moodIndex": index });
    this.queueDraft();
  },
  togglePet(event) {
    const id = event.currentTarget.dataset.id,
      selected = this.data.draft.petIds.slice(),
      index = selected.indexOf(id);
    if (index < 0) selected.push(id);
    else selected.splice(index, 1);
    this.setData({ "draft.petIds": selected });
    this.editorChoices();
    this.queueDraft();
  },
  togglePhoto(event) {
    const id = event.currentTarget.dataset.id,
      selected = this.data.draft.photoIds.slice(),
      index = selected.indexOf(id);
    if (index < 0 && selected.length >= 4) {
      store.toast("一页手账最多放 4 张照片");
      return;
    }
    if (index < 0) selected.push(id);
    else selected.splice(index, 1);
    this.setData({ "draft.photoIds": selected });
    this.editorChoices();
    this.queueDraft();
  },
  editorChoices() {
    const draft = this.data.draft,
      state = this._state || { photos: [], pets: [] },
      photos = store.activePhotos(state);
    const activeIds = photos.map((photo) => photo.id);
    this.setData({
      editorPets: list(state.pets).map((pet) => ({
        id: pet.id,
        name: pet.name,
        selected: draft.petIds.indexOf(pet.id) !== -1,
      })),
      photoChoices: photos.map((photo) => ({
        id: photo.id,
        title: photo.title,
        src: store.getPhotoSource(photo),
        selected: draft.photoIds.indexOf(photo.id) !== -1,
      })),
      missingPhotoCount: draft.photoIds.filter(
        (id) => activeIds.indexOf(id) === -1,
      ).length,
    });
  },
  clearMissingPhotos() {
    const ids = store.activePhotos(this._state).map((photo) => photo.id);
    this.setData({
      "draft.photoIds": this.data.draft.photoIds.filter(
        (id) => ids.indexOf(id) !== -1,
      ),
    });
    this.editorChoices();
    this.queueDraft();
  },
  save() {
    const draft = this.data.draft,
      title = draft.title.trim();
    if (!title) {
      this.invalid("给这页故事起个名字吧");
      return;
    }
    if (
      !Number.isFinite(planner.daysBetween(draft.date, store.date())) ||
      draft.date > store.date()
    ) {
      this.invalid("请选择今天或之前的有效日期");
      return;
    }
    const now = new Date().toISOString(),
      existing = list(store.get().notes).find((note) => note.id === draft.id);
    if (draft.id && !existing) {
      store.toast("原故事已变化，请先保存草稿并重新打开");
      return;
    }
    const tags = [];
    draft.tagsText.split(/[,，、\n]/).forEach((tag) => {
      const text = tag.trim().slice(0, 16);
      if (text && tags.indexOf(text) === -1 && tags.length < 6) tags.push(text);
    });
    const note = Object.assign({}, existing || {}, {
      id: draft.id || store.uid(),
      title,
      body: draft.body.trim(),
      date: draft.date,
      mood: draft.mood,
      petIds: draft.petIds.slice(),
      photoIds: draft.photoIds.slice(0, 4),
      tags,
      createdAt: (existing && existing.createdAt) || now,
      updatedAt: existing ? now : null,
      trashedAt: null,
    });
    if (
      this.write(
        (state) => {
          const index = list(state.notes).findIndex(
            (item) => item.id === note.id,
          );
          if (!Array.isArray(state.notes)) state.notes = [];
          if (index < 0) state.notes.unshift(note);
          else state.notes[index] = note;
          state.diaryDraft = null;
        },
        existing ? "这一页旁白更新啦 ♡" : "新的故事已经收好啦 ♡",
      )
    ) {
      if (this._draftTimer) {
        clearTimeout(this._draftTimer);
        this._draftTimer = null;
      }
      this.setData({
        editing: false,
        draft: {},
        pendingDraft: null,
        draftStatus: "",
      });
    }
  },
  moveNote(event) {
    const id = event.currentTarget.dataset.id,
      restore = !!event.currentTarget.dataset.restore;
    if (
      this.write(
        (state) => {
          const note = list(state.notes).find((item) => item.id === id);
          if (note) note.trashedAt = restore ? null : new Date().toISOString();
        },
        restore ? "这一页已经找回来啦 ♡" : "已放进回收站，随时可以找回",
      )
    )
      this.setData({ detail: null });
  },
  previewPhoto(event) {
    const photos = (this.data.detail && this.data.detail.photos) || [],
      urls = photos.map((photo) => photo.src);
    if (urls.length)
      wx.previewImage({
        current: event.currentTarget.dataset.src,
        urls,
        fail: () => store.toast("照片暂时无法预览"),
      });
  },
});
