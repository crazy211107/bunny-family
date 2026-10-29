const store = require("../../utils/store");
const planner = require("../../utils/planner");
Page({
  data: {
    photos: [],
    memory: [],
    memoryYears: 0,
    pets: [],
    todos: [],
    todayList: [],
    hero: null,
    slide: 0,
    playing: false,
    todoText: "",
    journal: false,
    notes: [],
    year: "",
    month: "",
    day: "",
    weekday: "",
  },
  onShow() {
    this.setData({ safeTop: getApp().globalData.safeTop || 64 });
    this.refresh();
  },
  onHide() {
    this.stopTimer();
    this.setData({ playing: false });
  },
  onUnload() {
    this.stopTimer();
  },
  refresh() {
    try {
      const state = store.get(),
        now = new Date(),
        photos = store.activePhotos(state),
        slide = photos.length
          ? Math.min(this.data.slide, photos.length - 1)
          : 0;
      const today = store.date(),
        md = today.slice(5),
        thisYear = today.slice(0, 4);
      const memory = photos
        .filter((p) => {
          const d = p.date || "";
          return (
            d.length >= 10 && d.slice(5) === md && d.slice(0, 4) !== thisYear
          );
        })
        .sort((a, b) => String(b.date).localeCompare(String(a.date)))
        .map((p) => Object.assign({}, p, { year: p.date.slice(0, 4) }));
      const memoryYears = memory.length
        ? thisYear - Number(memory[0].date.slice(0, 4))
        : 0;
      const petsWithCare = state.pets.map((p) =>
        Object.assign({}, p, { count: store.careCount(state, p.id) }),
      );
      const careGaps = petsWithCare
        .filter((p) => p.count < 4)
        .map((p) => ({
          kind: "care",
          key: "care:" + p.id,
          id: p.id,
          title: p.name + " 今天还差 " + (4 - p.count) + " 项照顾",
          note: "去打卡",
        }));
      const reminders = [];
      state.pets.forEach((pet) =>
        (pet.reminders || []).forEach((item) => {
          const due = Math.round(
            (new Date(item.date + "T00:00:00") -
              new Date(today + "T00:00:00")) /
              86400000,
          );
          if (!isFinite(due) || due > 3) return;
          reminders.push({
            kind: "reminder",
            key: "rm:" + pet.id + ":" + item.id,
            id: pet.id,
            title: item.title,
            note: pet.name,
            due,
            order: due,
          });
        }),
      );
      reminders.sort((a, b) => a.order - b.order);
      const todoRows = state.todos.map((t) => ({
        kind: "todo",
        key: "todo:" + t.id,
        id: t.id,
        title: t.text,
        done: !!t.done,
        note: "",
        order: t.done ? 9 : 0,
      }));
      const planned = planner.occurrences(state, today),
        planRows = planned
          .filter((p) => !p.done)
          .map((p) => ({
            kind: "plan",
            key: "plan:" + p.id,
            id: p.id,
            title: p.title,
            note: (p.time || "时间灵活") + " · " + p.assigneeName,
          }));
      const allToday = reminders
        .map((r) =>
          Object.assign({}, r, {
            dueText:
              r.due < 0
                ? "逾期 " + -r.due + " 天"
                : r.due === 0
                  ? "就是今天"
                  : r.due + " 天后",
          }),
        )
        .concat(planRows)
        .concat(careGaps)
        .concat(todoRows);
      const todayList = allToday.slice(0, 6),
        lowCount = (state.supplies || []).filter(
          (s) => Number(s.quantity) <= Number(s.threshold),
        ).length;
      this.setData({
        photos,
        pets: petsWithCare,
        basicDone: petsWithCare.reduce((sum, pet) => sum + pet.count, 0),
        basicTotal: petsWithCare.length * store.careTypes.length,
        todayList,
        todayListCount: allToday.length,
        planLeft: planRows.length,
        planCount: planned.length,
        lowCount,
        todos: state.todos,
        hero: photos[slide] || null,
        slide,
        notes: state.notes.filter(
          (n) => !n.trashedAt && (n.date || store.date(n.createdAt)) === today,
        ),
        memory: memory.slice(0, 3),
        memoryYears,
        year: now.getFullYear(),
        month: String(now.getMonth() + 1).padStart(2, "0"),
        day: String(now.getDate()).padStart(2, "0"),
        weekday: "日一二三四五六"[now.getDay()],
      });
    } catch (error) {
      store.toast("资料读取失败，请保留当前页面");
    }
  },
  stopTimer() {
    clearInterval(this.timer);
    this.timer = null;
  },
  goDailyCare() {
    wx.navigateTo({ url: "/pages/care/index?tab=daily" });
  },
  togglePlay() {
    if (!this.data.photos.length) return;
    const playing = !this.data.playing;
    this.setData({ playing });
    this.stopTimer();
    if (playing) this.timer = setInterval(() => this.next(), 4200);
  },
  next() {
    if (!this.data.photos.length) return;
    const slide = (this.data.slide + 1) % this.data.photos.length;
    this.setData({ slide, hero: this.data.photos[slide] });
  },
  preview(e) {
    const id =
        e.currentTarget.dataset.id || (this.data.hero && this.data.hero.id),
      photo = this.data.photos.find((p) => p.id === id);
    if (photo)
      wx.previewImage({
        current: photo.src,
        urls: this.data.photos.map((p) => p.src),
      });
    else this.goAlbum();
  },
  pet(e) {
    wx.navigateTo({
      url: `/pages/pets/index?id=${e.currentTarget.dataset.id}`,
    });
  },
  goAlbum() {
    wx.navigateTo({ url: "/pages/album/index" });
  },
  goCare() {
    wx.navigateTo({ url: "/pages/care/index" });
  },
  goInsights() {
    wx.navigateTo({ url: "/pages/insights/index" });
  },
  goSupplies() {
    wx.navigateTo({ url: "/pages/care/index?tab=supplies" });
  },
  goDiary() {
    this.setData({ journal: false });
    wx.navigateTo({ url: "/pages/diary/index" });
  },
  note() {
    this.setData({ journal: false });
    wx.navigateTo({ url: "/pages/diary/index?new=1" });
  },
  lineTap(e) {
    const kind = e.currentTarget.dataset.kind;
    if (kind === "todo") {
      this.toggleTodo(e);
      return;
    }
    if (kind === "plan") {
      this.goCare();
      return;
    }
    const id = e.currentTarget.dataset.id;
    if (id) wx.navigateTo({ url: "/pages/pets/index?id=" + id });
  },
  toggleTodo(e) {
    try {
      store.update((s) => {
        const item = s.todos.find((t) => t.id === e.currentTarget.dataset.id);
        if (item) item.done = !item.done;
      });
      this.refresh();
    } catch (error) {
      store.toast("保存失败，请检查本机空间");
    }
  },
  todoInput(e) {
    this.setData({ todoText: e.detail.value });
  },
  addTodo() {
    const text = this.data.todoText.trim();
    if (!text) return;
    try {
      store.update((s) => {
        s.todos.push({ id: store.uid(), text, done: false });
      });
      this.setData({ todoText: "" });
      this.refresh();
      store.toast("小便签贴好了 ♡");
    } catch (error) {
      store.toast("待办未能保存");
    }
  },
  removeTodo(e) {
    try {
      store.update((s) => {
        s.todos = s.todos.filter((t) => t.id !== e.currentTarget.dataset.id);
      });
      this.refresh();
    } catch (error) {
      store.toast("未能移除便签");
    }
  },
  openJournal() {
    this.setData({ journal: true });
  },
  closeJournal() {
    this.setData({ journal: false });
  },
  stop() {},
});
