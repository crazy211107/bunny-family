import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "..", "miniprogram");
let bag = {},
  failWrite = false,
  captured,
  previews = 0;
const clone = (value) => JSON.parse(JSON.stringify(value));
const noop = () => {};
globalThis.wx = {
  getStorageSync: (key) => bag[key] && clone(bag[key]),
  setStorageSync: (key, value) => {
    if (failWrite) throw new Error("storage full");
    bag[key] = clone(value);
  },
  showToast: noop,
  showLoading: noop,
  hideLoading: noop,
  navigateTo: noop,
  reLaunch: noop,
  showModal: (options) => options.success({ confirm: true }),
  previewImage: () => {
    previews++;
  },
  getWindowInfo: () => ({ windowWidth: 375, windowHeight: 812 }),
};
globalThis.getApp = () => ({ globalData: { safeTop: 64 } });
globalThis.getCurrentPages = () => [{ route: "pages/home/index" }];
globalThis.Page = (options) => {
  captured = options;
};
const store = require(path.join(root, "utils/store.js"));
const planner = require(path.join(root, "utils/planner.js"));
const insights = require(path.join(root, "utils/insights.js"));
function mount(name, options = {}) {
  delete require.cache[
    require.resolve(path.join(root, "pages", name, "index.js"))
  ];
  require(path.join(root, "pages", name, "index.js"));
  const page = Object.assign({}, captured, { data: clone(captured.data) });
  page.setData = (patch) => {
    for (const [key, value] of Object.entries(patch)) {
      const keys = key.split(".");
      let target = page.data;
      while (keys.length > 1) {
        const next = keys.shift();
        target = target[next] || (target[next] = {});
      }
      target[keys[0]] = value;
    }
  };
  if (page.onLoad) page.onLoad(options);
  if (page.onShow) page.onShow();
  return page;
}
const event = (dataset = {}, value = "") => ({
  currentTarget: { dataset },
  detail: { value },
});
const fresh = () => {
  failWrite = false;
  store.save(
    Object.assign(store.initial(), {
      carePlans: [],
      planLogs: {},
      supplies: [],
      albums: [],
      diaryDraft: null,
      handover: {},
    }),
  );
};
let groups = 0;
function test(name, fn) {
  fn();
  groups++;
  console.log("✓", name);
}

test("旧版本迁移保留原照片与自填信息，新增集合为空", () => {
  const state = store.get();
  assert.equal(state.photos.length, 6);
  assert.equal(state.pets[0].name, "豆米");
  for (const key of ["carePlans", "supplies", "albums"])
    assert.deepEqual(state[key], []);
  assert.deepEqual(state.planLogs, {});
  assert.equal(state.diaryDraft, null);
});
test("严格日历校验、闰年/世纪年/跨月与周一锚点", () => {
  assert.equal(planner.addDays("2024-02-28", 1), "2024-02-29");
  assert.equal(planner.addDays("2100-02-28", 1), "2100-03-01");
  assert.equal(planner.addDays("2026-10-31", 1), "2026-11-01");
  assert.equal(planner.addDays("2026-02-30", 1), "");
  assert.equal(planner.daysBetween("2026-03-07", "2026-03-09"), 2);
  assert.equal(planner.weekStart("2026-11-01"), "2026-10-26");
  assert.equal(planner.addDays("2026-01-01", 0.5), "");
});
test("循环按原日期锚定，暂停与收起不再派生任务", () => {
  const plan = {
    startDate: "2026-10-26",
    rule: "interval",
    intervalDays: 3,
    enabled: true,
  };
  assert.ok(planner.isDue(plan, "2026-10-29"));
  assert.equal(planner.isDue(plan, "2026-10-30"), false);
  assert.equal(planner.isDue(plan, "2026-10-25"), false);
  assert.equal(planner.isDue({ ...plan, enabled: false }, "2026-10-29"), false);
  assert.equal(
    planner.isDue({ ...plan, archivedAt: "2026-10-28" }, "2026-10-29"),
    false,
  );
  assert.ok(
    planner.isDue({ ...plan, rule: "weekly", weekdays: [7] }, "2026-11-01"),
  );
  assert.equal(
    planner.isDue({ ...plan, intervalDays: 0 }, "2026-10-29"),
    false,
  );
});
test("计划新增、指派、今日完成撤销、历史只读及收起留历史", () => {
  fresh();
  const page = mount("care");
  page.openPlan(event());
  page.data.form.title = "认真梳一次毛";
  page.data.form.assigneeId = "m1";
  page.savePlan();
  const plan = store.get().carePlans[0];
  assert.ok(plan.id);
  assert.equal(plan.assigneeId, "m1");
  page.toggleDone(event({ id: plan.id }));
  assert.ok(store.get().planLogs[plan.id + ":" + store.date()]);
  page.toggleDone(event({ id: plan.id }));
  assert.equal(store.get().planLogs[plan.id + ":" + store.date()], undefined);
  page.setData({ selectedDay: planner.addDays(store.date(), -1) });
  page.toggleDone(event({ id: plan.id }));
  assert.deepEqual(store.get().planLogs, {});
  page.setData({ selectedDay: store.date() });
  page.toggleDone(event({ id: plan.id }));
  page.deletePlan(event({ id: plan.id }));
  assert.ok(store.get().carePlans[0].archivedAt);
  assert.equal(planner.occurrences(store.get(), store.date()).length, 0);
  assert.equal(Object.keys(store.get().planLogs).length, 1);
});
test("补给从零开始，小数进出、负库存/精度/单位混用被拒绝", () => {
  fresh();
  const page = mount("care");
  page.openSupply(event());
  Object.assign(page.data.form, { name: "牧草", unit: "kg", threshold: "0.2" });
  page.saveSupply();
  const id = store.get().supplies[0].id;
  assert.equal(store.get().supplies[0].quantity, 0);
  page.openMovement(event({ id, mode: "in" }));
  page.data.form.amount = "0.3";
  page.saveMovement();
  page.openMovement(event({ id, mode: "out" }));
  page.data.form.amount = "0.1";
  page.saveMovement();
  assert.equal(store.get().supplies[0].quantity, 0.2);
  assert.equal(store.get().supplies[0].movements.length, 2);
  page.openMovement(event({ id, mode: "out" }));
  page.data.form.amount = "0.201";
  page.saveMovement();
  assert.equal(store.get().supplies[0].quantity, 0.2);
  page.data.form.amount = "0.0001";
  page.saveMovement();
  assert.equal(store.get().supplies[0].quantity, 0.2);
  page.openSupply(event({ id }));
  page.data.form.unit = "袋";
  page.saveSupply();
  assert.equal(store.get().supplies[0].unit, "kg");
});
test("相册引用去重、回收封面回退、移册及删册均保留原图", () => {
  fresh();
  const page = mount("album");
  page.setData({ selectedIds: ["p1", "p2"] });
  page.newAlbumWithSelected();
  page.data.albumDraft.title = "我们的贴贴日";
  page.saveAlbum();
  const album = store.get().albums[0];
  assert.equal(album.photoIds.length, 2);
  page.setData({ selectedIds: ["p1", "p2"] });
  page.addToAlbum(event({ id: album.id }));
  assert.equal(store.get().albums[0].photoIds.length, 2);
  store.update((state) => {
    state.photos.find((photo) => photo.id === "p1").trashedAt = "test";
  });
  page.reload();
  assert.ok(page.data.currentAlbum.cover.includes("qiuqiu-close"));
  assert.equal(page.data.currentAlbum.count, 1);
  page.setData({ selectedIds: ["p2"] });
  page.removeFromAlbum();
  assert.equal(store.get().photos.length, 6);
  page.deleteAlbum();
  assert.equal(store.get().albums.length, 0);
  assert.equal(store.get().photos.length, 6);
});
test("日记自动草稿、恢复原id、置顶/标签、提交后隐藏不重写", () => {
  fresh();
  const page = mount("diary");
  page.openEditor(event());
  page.draftInput(event({ field: "title" }, "一起晒太阳"));
  page.draftInput(event({ field: "body" }, "今天豆米和豆糕一起发呆。"));
  page.draftInput(event({ field: "tagsText" }, "贴贴，午后"));
  page.closeEditor();
  assert.ok(store.get().diaryDraft);
  assert.equal(store.get().notes.length, 0);
  page.restoreDraft();
  page.save();
  assert.equal(store.get().notes.length, 1);
  assert.equal(store.get().diaryDraft, null);
  page.onHide();
  assert.equal(store.get().diaryDraft, null);
  const id = store.get().notes[0].id;
  page.openEditor(event({ id }));
  page.draftInput(event({ field: "body" }, "追加一点旁白"));
  page.persistDraft();
  page.closeEditor();
  page.restoreDraft();
  page.save();
  assert.equal(store.get().notes.length, 1);
  assert.equal(store.get().notes[0].id, id);
  assert.equal(store.get().notes[0].body, "追加一点旁白");
  page.togglePin(event({ id }));
  assert.ok(store.get().notes[0].pinned);
  page.filterTag(event({ tag: "贴贴" }));
  assert.equal(page.data.notes.length, 1);
  page.filterTag(event({ tag: "不存在的标签" }));
  assert.equal(page.data.notes.length, 0);
});
test("存储失败不会污染缓存、关闭草稿失败保留正在输入的内容", () => {
  fresh();
  const page = mount("diary");
  page.openEditor(event());
  page.data.draft.title = "不能丢掉的小故事";
  const before = store.get();
  failWrite = true;
  page.closeEditor();
  assert.equal(page.data.editing, true);
  assert.equal(page.data.draft.title, "不能丢掉的小故事");
  assert.deepEqual(store.get(), before);
  failWrite = false;
  page.closeEditor();
  assert.ok(store.get().diaryDraft);
});
test("持续错误反馈保留内容，拒绝无效日记日期", () => {
  fresh();
  const page = mount("diary");
  page.openEditor(event());
  page.save();
  assert.ok(page.data.formError);
  assert.equal(page.data.editing, true);
  page.data.draft.title = "日期边界";
  page.data.draft.date = "2026-02-30";
  page.save();
  assert.equal(store.get().notes.length, 0);
  assert.ok(page.data.formError.includes("有效日期"));
});
test("共享搜索框输入与清空采用一致事件，不写存储", () => {
  let definition;
  globalThis.Component = (value) => {
    definition = value;
  };
  require(path.join(root, "components/search-bar/index.js"));
  const events = [],
    component = {
      triggerEvent: (name, detail) => events.push([name, detail.value]),
    };
  definition.methods.input.call(component, { detail: { value: "豆米" } });
  definition.methods.clear.call(component);
  assert.deepEqual(events, [
    ["change", "豆米"],
    ["change", ""],
  ]);
});
test("周记排除未来与无日期照片，收起计划仍计真实完成，体重不编造", () => {
  fresh();
  const state = store.get(),
    today = "2026-10-28";
  state.checkins["qiu:2026-10-26"] = {
    hay: "a",
    water: "a",
    clean: "a",
    play: "a",
  };
  state.checkins["qiu:2026-10-29"] = { hay: "a" };
  state.planLogs["archived:2026-10-26"] = {
    completedAt: "2026-10-26T10:00:00Z",
  };
  state.photos[0].date = "2026-10-27";
  state.photos[1].date = "2026-10-29";
  state.pets[0].weights = [{ date: "2026-10-26", kg: 1.2 }];
  let report = insights.weekly(state, today, today);
  assert.equal(report.count, 4);
  assert.equal(report.total, 24);
  assert.equal(report.planDone, 1);
  assert.equal(report.photoCount, 1);
  assert.equal(report.pets[0].completeDays, 1);
  assert.ok(report.pets[0].weightText.includes("至少记录两次"));
  state.pets[0].weights.push({ date: "2026-10-28", kg: 1.3 });
  report = insights.weekly(state, today, today);
  assert.ok(report.pets[0].weightText.includes("+0.1 kg"));
});
test("交接只列三天待办、真实低库存和用户自填联系方式", () => {
  fresh();
  const state = store.get(),
    today = "2026-10-28";
  state.carePlans = [
    {
      id: "a",
      title: "清洗食碗",
      petIds: ["qiu"],
      startDate: today,
      rule: "daily",
      assigneeId: "m1",
    },
  ];
  state.planLogs["a:" + today] = { completedAt: "x" };
  state.supplies = [
    { id: "hay", name: "牧草", quantity: 0.2, threshold: 0.2, unit: "kg" },
  ];
  state.handover = {
    contactName: "家人",
    contactPhone: "123",
    note: "钥匙在玄关",
  };
  const card = insights.handover(state, today);
  assert.equal(card.plans.length, 2);
  assert.equal(card.low.length, 1);
  const text = insights.handoverText(card, today);
  assert.ok(text.includes("家人 123"));
  assert.ok(text.includes("钥匙在玄关"));
  assert.ok(!text.includes("常去医院"));
});

fresh();
const context = new Proxy(
  { measureText: (text) => ({ width: String(text).length * 15 }) },
  { get: (target, key) => (key in target ? target[key] : noop) },
);
const canvas = { getContext: () => context };
wx.createSelectorQuery = () => ({
  in() {
    return this;
  },
  select() {
    return this;
  },
  fields() {
    return this;
  },
  exec(callback) {
    callback([{ node: canvas }]);
  },
});
wx.canvasToTempFilePath = (options) =>
  options.success({ tempFilePath: "wxfile://handover.png" });
const page = mount("insights", { tab: "handover" });
await page.exportCard();
assert.equal(page.data.exporting, false);
assert.equal(page.data.exportPath, "wxfile://handover.png");
assert.equal(canvas.width, 750);
assert.equal(previews, 1);
console.log("✓ 交接卡 Canvas 导出契约与生成后预览");
groups++;
console.log(
  `\n✓ ${groups} 组行为与边界验收通过（隔离 Node wx 桩，不写模拟器用户数据）`,
);
