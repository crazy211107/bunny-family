import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
const require = createRequire(import.meta.url),
  root = path.resolve(import.meta.dirname, ".."),
  native = path.join(root, "miniprogram");
const copy = (value) => JSON.parse(JSON.stringify(value));
let bag = {},
  fail = false,
  definition,
  navigation = "",
  clipboard = "",
  count = 0;
globalThis.wx = {
  getStorageSync: (key) => bag[key] && copy(bag[key]),
  setStorageSync: (key, value) => {
    if (fail) throw Error("storage full");
    bag[key] = copy(value);
  },
  showToast() {},
  navigateTo: (options) => {
    navigation = options.url;
  },
  setClipboardData: (options) => {
    clipboard = options.data;
  },
  getWindowInfo: () => ({ windowWidth: 375, windowHeight: 812 }),
};
globalThis.getApp = () => ({ globalData: { safeTop: 64 } });
globalThis.Page = (value) => {
  definition = value;
};
const store = require(path.join(native, "utils/store.js")),
  planner = require(path.join(native, "utils/planner.js")),
  daily = require(path.join(native, "utils/daily-care.js"));
const seed = () => {
  fail = false;
  store.save(
    Object.assign(store.initial(), {
      carePlans: [],
      planLogs: {},
      supplies: [],
      albums: [],
      checkins: {},
    }),
  );
};
function mount(name, options = {}) {
  delete require.cache[
    require.resolve(path.join(native, `pages/${name}/index.js`))
  ];
  require(path.join(native, `pages/${name}/index.js`));
  const page = Object.assign({}, definition, { data: copy(definition.data) });
  page.setData = (values) => {
    for (const [key, value] of Object.entries(values)) {
      const parts = key.split(".");
      let ref = page.data;
      while (parts.length > 1) {
        const part = parts.shift();
        ref = ref[part] || (ref[part] = {});
      }
      ref[parts[0]] = value;
    }
  };
  if (page.onLoad) page.onLoad(options);
  if (page.onShow) page.onShow();
  return page;
}
const event = (data) => ({ currentTarget: { dataset: data } });
const check = (name, run) => {
  seed();
  run();
  count++;
  console.log("✓ " + name);
};
check("原生首页保留拍立得与胶片，入口直达原生打卡页，统计不填假数", () => {
  const home = mount("home");
  assert.equal(home.data.basicDone, 0);
  assert.equal(home.data.basicTotal, 8);
  home.goDailyCare();
  assert.equal(navigation, "/pages/care/index?tab=daily");
  const wxml = fs.readFileSync(
    path.join(native, "pages/home/index.wxml"),
    "utf8",
  );
  assert.ok(
    wxml.includes("hero-stack") &&
      wxml.includes("film-holes") &&
      wxml.includes("bunny-menu"),
  );
});
check("原生打卡页可进入，原有日程/补给入口保留", () => {
  const page = mount("care", { tab: "daily" });
  assert.equal(page.data.tab, "daily");
  assert.equal(page.data.dailyRows.length, 8);
  page.changeTab(event({ tab: "schedule" }));
  assert.equal(page.data.tab, "schedule");
  page.changeTab(event({ tab: "supplies" }));
  assert.equal(page.data.tab, "supplies");
});
check("单项盖章与撤销复用兔兔档案 checkins，不影响另一只兔兔", () => {
  const page = mount("care", { tab: "daily" });
  page.saveDaily(event({ id: "qiu|hay" }));
  assert.equal(store.careCount(store.get(), "qiu"), 1);
  assert.equal(store.careCount(store.get(), "dou"), 0);
  const petPage = mount("pets");
  assert.equal(petPage.data.pet.id, "qiu");
  page.saveDaily(event({ id: "qiu|hay" }));
  assert.equal(store.careCount(store.get(), "qiu"), 0);
});
check("批量仅处理已选事项；重复盖章不改原时间", () => {
  const page = mount("care", { tab: "daily" });
  page.selectDaily(event({ id: "qiu|water" }));
  page.selectDaily(event({ id: "dou|play" }));
  assert.equal(page.data.dailySelectedCount, 2);
  page.saveDailyBatch();
  const state = store.get(),
    original = state.checkins[store.careKey("qiu")].water;
  assert.equal(store.careCount(state, "qiu"), 1);
  assert.equal(store.careCount(state, "dou"), 1);
  assert.equal(page.data.dailySelectedCount, 0);
  store.update((value) =>
    daily.apply(value, store.date(), ["qiu|water"], false),
  );
  assert.equal(store.get().checkins[store.careKey("qiu")].water, original);
});
check("兔兔/完成状态筛选会清空隐藏选择，支持空状态", () => {
  const page = mount("care", { tab: "daily" });
  page.selectDaily(event({ id: "dou|hay" }));
  page.dailyFilter(event({ field: "dailyPet", value: "qiu" }));
  assert.equal(page.data.dailySelectedCount, 0);
  assert.equal(page.data.dailyRows.length, 4);
  page.dailyFilter(event({ field: "dailyStatus", value: "done" }));
  assert.equal(page.data.dailyRows.length, 0);
});
check("历史与未来只读，非法日期/事项拒绝且保持数据", () => {
  const state = store.get(),
    before = copy(state);
  for (const day of [
    planner.addDays(store.date(), -1),
    planner.addDays(store.date(), 1),
    "2026-02-30",
  ])
    assert.throws(() => daily.apply(state, day, ["qiu|hay"], false));
  assert.deepEqual(state, before);
  assert.throws(() =>
    daily.apply(state, store.date(), ["qiu|hay", "missing|bad"], false),
  );
  assert.deepEqual(state, before);
  const page = mount("care", {
    tab: "daily",
    day: planner.addDays(store.date(), -1),
  });
  page.saveDaily(event({ id: "qiu|hay" }));
  assert.ok(page.data.feedback);
  assert.equal(store.careCount(store.get(), "qiu"), 0);
});
check("存储失败保留旧状态和选择，并留下可读错误", () => {
  const page = mount("care", { tab: "daily" });
  page.selectDaily(event({ id: "qiu|hay" }));
  fail = true;
  page.saveDailyBatch();
  fail = false;
  assert.equal(store.careCount(store.get(), "qiu"), 0);
  assert.equal(page.data.dailySelectedCount, 1);
  assert.ok(page.data.feedback);
});
check("复制小票按筛选输出实际记录，不假装全部完成", () => {
  const page = mount("care", { tab: "daily" });
  page.saveDaily(event({ id: "qiu|hay" }));
  page.dailyFilter(event({ field: "dailyPet", value: "qiu" }));
  page.copyDaily();
  assert.ok(clipboard.includes("豆米 · 喂草：已记录"));
  assert.ok(clipboard.includes("豆米 · 换水：未记录"));
  assert.ok(!clipboard.includes("豆糕"));
  assert.ok(clipboard.includes("未记录不代表没有照顾"));
});
check("奶油粉绿与原兔耳标识保留，Web SaaS 页面不再接入主入口", () => {
  const base = fs.readFileSync(path.join(native, "styles/base.wxss"), "utf8"),
    ai = fs.readFileSync(
      path.join(native, "components/ai-assistant/index.wxss"),
      "utf8",
    );
  assert.ok(base.includes("#fff9f0") && base.includes("#6b5b73"));
  assert.ok(ai.includes("#ffd9e8") && ai.includes("#c9e7d3"));
  assert.ok(!/#263c32|#386449|#fcfcfa/.test(ai));
  const webEntry = path.join(root, "src/App.jsx");
  if (fs.existsSync(webEntry)) {
    const app = fs.readFileSync(webEntry, "utf8");
    assert.ok(
      !app.includes("LandingHome") &&
        !app.includes("CareWorkspace") &&
        app.includes("<Home"),
    );
  }
  const json = JSON.parse(
    fs.readFileSync(
      path.join(native, "components/ai-assistant/index.json"),
      "utf8",
    ),
  );
  assert.equal(
    json.usingComponents["bunny-mark"],
    "/components/bunny-mark/index",
  );
});
console.log(
  `\n✓ ${count} 组原生风格/打卡验证通过；仅 wx 假数据，不等同真机视觉验收。`,
);
