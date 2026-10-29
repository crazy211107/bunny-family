const store = require("../../utils/store");
const dailyCare = require("../../utils/daily-care");
const planner = require("../../utils/planner");
const rules = [
  { id: "once", name: "只在这一天" },
  { id: "daily", name: "每天都来" },
  { id: "weekly", name: "每周的这几天" },
  { id: "interval", name: "每隔几天" },
];
const weekNames = ["一", "二", "三", "四", "五", "六", "日"];
const quantity = (value) => Math.round(Number(value) * 1000) / 1000;
const numberText = (value) => String(quantity(value));
const localTime = (value) => {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return (
    date.getMonth() +
    1 +
    "/" +
    date.getDate() +
    " " +
    String(date.getHours()).padStart(2, "0") +
    ":" +
    String(date.getMinutes()).padStart(2, "0")
  );
};
function ruleLabel(plan) {
  if (plan.rule === "weekly")
    return (
      "每周" + (plan.weekdays || []).map((day) => weekNames[day - 1]).join("、")
    );
  if (plan.rule === "interval") return "每隔 " + plan.intervalDays + " 天";
  return plan.rule === "daily" ? "每天" : "仅 " + plan.startDate;
}

Page({
  data: {
    tab: "schedule",
    today: "",
    selectedDay: "",
    week: [],
    weekLabel: "",
    selectedLabel: "",
    rows: [],
    completed: 0,
    plans: [],
    showPlans: false,
    shelves: [],
    lowCount: 0,
    drawerKind: "",
    drawerTitle: "",
    form: {},
    petOptions: [],
    memberOptions: [],
    memberIndex: 0,
    ruleOptions: rules,
    ruleIndex: 0,
    weekdays: [],
    selectedSupply: null,
    movementMode: "in",
    expandedSupply: "",
    dailyPet: "all",
    dailyStatus: "all",
    dailySelected: [],
    dailyRows: [],
    dailyTotal: 0,
    dailyDone: 0,
    dailySelectedCount: 0,
  },
  onLoad(options) {
    options = options || {};
    const today = store.date();
    const selectedDay =
      options.day && Number.isFinite(planner.daysBetween(today, options.day))
        ? options.day
        : today;
    this.setData({
      today,
      selectedDay,
      tab: ["daily", "supplies"].includes(options.tab)
        ? options.tab
        : "schedule",
    });
  },
  onShow() {
    this.setData({ safeTop: getApp().globalData.safeTop || 64 });
    this.refresh();
  },
  refresh() {
    const state = store.get();
    const today = store.date();
    const selectedDay = this.data.selectedDay || today;
    const start = planner.weekStart(selectedDay);
    const rows = planner.occurrences(state, selectedDay).map((plan) =>
      Object.assign({}, plan, {
        ruleLabel: ruleLabel(plan),
        timeLabel: plan.time || "找个舒服的时间",
        completedLabel: localTime(plan.completedAt),
      }),
    );
    const week = weekNames.map((label, index) => {
      const day = planner.addDays(start, index);
      const events = planner.occurrences(state, day);
      return {
        day,
        label,
        number: Number(day.slice(8)),
        today: day === today,
        active: day === selectedDay,
        count: events.length,
        complete: events.length > 0 && events.every((plan) => plan.done),
      };
    });
    const plans = (state.carePlans || [])
      .filter((plan) => !plan.archivedAt)
      .map((plan) => ({
        id: plan.id,
        title: plan.title,
        enabled: plan.enabled !== false,
        ruleLabel: ruleLabel(plan),
        pets:
          (state.pets || [])
            .filter((pet) => (plan.petIds || []).indexOf(pet.id) >= 0)
            .map((pet) => pet.name)
            .join("、") || "我们家",
      }));
    const shelves = (state.supplies || []).map((item) =>
      Object.assign({}, item, {
        quantityLabel: numberText(item.quantity),
        thresholdLabel: numberText(item.threshold),
        low: Number(item.quantity) <= Number(item.threshold),
        petLabel:
          (state.pets || [])
            .filter((pet) => (item.petIds || []).indexOf(pet.id) >= 0)
            .map((pet) => pet.name)
            .join("、") || "家里共用",
        history: (item.movements || [])
          .slice()
          .reverse()
          .slice(0, 4)
          .map((movement) => ({
            id: movement.id,
            label:
              (movement.delta > 0 ? "＋" : "−") +
              numberText(Math.abs(movement.delta)) +
              " " +
              item.unit,
            time: localTime(movement.at),
            note:
              movement.note || (movement.delta > 0 ? "补货入库" : "领用出库"),
          })),
      }),
    );
    this.setData({
      today,
      selectedDay,
      rows,
      week,
      plans,
      shelves,
      lowCount: shelves.filter((item) => item.low).length,
      completed: rows.filter((plan) => plan.done).length,
      editableToday: selectedDay === today,
      weekLabel:
        Number(start.slice(5, 7)) +
        "月" +
        Number(start.slice(8)) +
        "日 — " +
        Number(week[6].day.slice(5, 7)) +
        "月" +
        Number(week[6].day.slice(8)) +
        "日",
      selectedLabel:
        Number(selectedDay.slice(5, 7)) +
        " 月 " +
        Number(selectedDay.slice(8)) +
        " 日",
      petPortraits: (state.pets || [])
        .slice(0, 2)
        .map((pet) => ({ id: pet.id, name: pet.name, photo: pet.photo })),
    });
    this.refreshDaily(state);
  },
  refreshDaily(state) {
    const data = state || store.get();
    const pack = dailyCare.snapshot(
      data,
      this.data.selectedDay || store.date(),
      { petId: this.data.dailyPet, status: this.data.dailyStatus },
    );
    const ids = (this.data.dailySelected || []).filter((id) =>
      pack.rows.some((row) => row.id === id && !row.done),
    );
    this.setData({
      dailyRows: pack.rows.map((row) =>
        Object.assign({}, row, { selected: ids.includes(row.id) }),
      ),
      dailySelected: ids,
      dailySelectedCount: ids.length,
      dailyTotal: pack.total,
      dailyDone: pack.done,
      dailyPets: [{ id: "all", name: "两位小主" }].concat(
        data.pets.map((pet) => ({ id: pet.id, name: pet.name })),
      ),
    });
  },
  dailyFilter(event) {
    const field = event.currentTarget.dataset.field,
      value = event.currentTarget.dataset.value;
    if (field !== "dailyPet" && field !== "dailyStatus") return;
    if (field === "dailyStatus" && !["all", "pending", "done"].includes(value))
      return;
    if (
      field === "dailyPet" &&
      value !== "all" &&
      !store.get().pets.some((pet) => pet.id === value)
    )
      return;
    const patch = { dailySelected: [], feedback: "" };
    patch[field] = value;
    this.setData(patch);
    this.refreshDaily();
  },
  selectDaily(event) {
    if (!this.data.editableToday) return;
    const id = event.currentTarget.dataset.id,
      row = this.data.dailyRows.find((item) => item.id === id);
    if (!row || row.done) return;
    const ids = this.data.dailySelected.includes(id)
      ? this.data.dailySelected.filter((key) => key !== id)
      : this.data.dailySelected.concat(id);
    this.setData({ dailySelected: ids });
    this.refreshDaily();
  },
  saveDaily(event) {
    const id = event.currentTarget.dataset.id,
      row = this.data.dailyRows.find((item) => item.id === id);
    if (!row) return;
    this.mutate(
      (state) => dailyCare.apply(state, this.data.selectedDay, [id], row.done),
      row.done ? "这枚小印章已撤销" : "照顾记好啦 ♡",
    );
  },
  saveDailyBatch() {
    if (!this.data.dailySelected.length || !this.data.editableToday) return;
    const ids = this.data.dailySelected.slice();
    if (
      this.mutate(
        (state) => dailyCare.apply(state, this.data.selectedDay, ids, false),
        "选中的照顾都记好啦 ♡",
      )
    ) {
      this.setData({ dailySelected: [] });
      this.refreshDaily();
    }
  },
  copyDaily() {
    try {
      const text = dailyCare.report(store.get(), this.data.selectedDay, {
        petId: this.data.dailyPet,
        status: this.data.dailyStatus,
      });
      wx.setClipboardData({
        data: text,
        fail: () => this.invalid("小票还没复制成功，请再试一次。"),
      });
    } catch (error) {
      this.invalid(error.message || "小票暂未读取成功。");
    }
  },
  mutate(fn, message) {
    try {
      store.update(fn);
      this.setData({ feedback: "" });
      this.refresh();
      if (message) store.toast(message);
      return true;
    } catch (error) {
      this.invalid(error.message || "没有保存成功，请检查本机存储空间");
      return false;
    }
  },
  invalid(message) {
    this.setData({ feedback: message });
    store.toast(message);
  },
  changeTab(event) {
    const tab = event.currentTarget.dataset.tab;
    if (["daily", "schedule", "supplies"].includes(tab))
      this.setData({ tab, dailySelected: [] });
    this.refreshDaily();
  },
  chooseDay(event) {
    this.setData({ selectedDay: event.currentTarget.dataset.day });
    this.refresh();
  },
  dateChange(event) {
    if (
      !Number.isFinite(planner.daysBetween(store.date(), event.detail.value))
    ) {
      this.invalid("请选择有效日期。");
      return;
    }
    this.setData({ dailySelected: [], feedback: "" });
    this.setData({ selectedDay: event.detail.value });
    this.refresh();
  },
  shiftWeek(event) {
    this.setData({
      selectedDay: planner.addDays(
        this.data.selectedDay,
        Number(event.currentTarget.dataset.delta) * 7,
      ),
    });
    this.refresh();
  },
  returnToday() {
    this.setData({ selectedDay: store.date() });
    this.refresh();
  },
  togglePlans() {
    this.setData({ showPlans: !this.data.showPlans });
  },
  toggleDone(event) {
    if (this.data.selectedDay !== store.date()) {
      store.toast("只有今天的照顾可以打卡，其他日期只读");
      return;
    }
    const id = event.currentTarget.dataset.id;
    const day = store.date();
    let wasDone = false;
    const saved = this.mutate((state) => {
      const plan = (state.carePlans || []).find((item) => item.id === id);
      if (!planner.isDue(plan, day)) throw new Error("这张计划今天不需要完成");
      state.planLogs = state.planLogs || {};
      const key = id + ":" + day;
      wasDone = !!state.planLogs[key];
      if (wasDone) delete state.planLogs[key];
      else
        state.planLogs[key] = {
          completedAt: new Date().toISOString(),
          memberId: plan.assigneeId || "",
        };
    });
    if (saved)
      store.toast(wasDone ? "已撤销今日打卡" : "今日的小事，认真做好啦 ♡");
  },
  openPlan(event) {
    const id = event && event.currentTarget && event.currentTarget.dataset.id;
    const state = store.get();
    const existing =
      id &&
      (state.carePlans || []).find(
        (item) => item.id === id && !item.archivedAt,
      );
    if (id && !existing) {
      store.toast("这张计划已经收起了");
      return;
    }
    const startDate = this.data.selectedDay || store.date();
    const day = planner.daysBetween("2024-01-01", startDate);
    const defaultWeekday = (((day % 7) + 7) % 7) + 1;
    const form = existing
      ? store.clone(existing)
      : {
          title: "",
          petIds: state.pets.map((pet) => pet.id),
          assigneeId: "",
          rule: "daily",
          startDate,
          weekdays: [defaultWeekday],
          intervalDays: 2,
          time: "",
          note: "",
          enabled: true,
        };
    const memberOptions = [{ id: "", name: "家人一起 · 暂不指派" }].concat(
      state.members.map((member) => ({ id: member.id, name: member.name })),
    );
    // Keep a removed assignee visible until the user explicitly chooses another member.
    if (
      form.assigneeId &&
      !memberOptions.some((member) => member.id === form.assigneeId)
    )
      memberOptions.push({
        id: form.assigneeId,
        name: "原成员已移除 · 请重新指派",
      });
    this.setData({
      drawerKind: "plan",
      drawerTitle: existing ? "改一张照顾便签" : "写一张照顾便签",
      form,
      memberOptions,
      memberIndex: Math.max(
        0,
        memberOptions.findIndex((member) => member.id === form.assigneeId),
      ),
      ruleIndex: Math.max(
        0,
        rules.findIndex((rule) => rule.id === form.rule),
      ),
      petOptions: state.pets.map((pet) => ({
        id: pet.id,
        name: pet.name,
        active: form.petIds.indexOf(pet.id) >= 0,
      })),
      weekdays: weekNames.map((label, index) => ({
        id: index + 1,
        label,
        active: (form.weekdays || []).indexOf(index + 1) >= 0,
      })),
    });
  },
  formInput(event) {
    const field = event.currentTarget.dataset.field;
    if (
      [
        "title",
        "note",
        "intervalDays",
        "name",
        "unit",
        "threshold",
        "amount",
        "movementNote",
      ].indexOf(field) < 0
    )
      return;
    const patch = {};
    patch["form." + field] = event.detail.value;
    this.setData(patch);
  },
  startDateChange(event) {
    this.setData({ "form.startDate": event.detail.value });
  },
  timeChange(event) {
    this.setData({ "form.time": event.detail.value });
  },
  clearTime() {
    this.setData({ "form.time": "" });
  },
  ruleChange(event) {
    const index = Number(event.detail.value);
    this.setData({ ruleIndex: index, "form.rule": rules[index].id });
  },
  memberChange(event) {
    const index = Number(event.detail.value);
    this.setData({
      memberIndex: index,
      "form.assigneeId": this.data.memberOptions[index].id,
    });
  },
  togglePet(event) {
    const id = event.currentTarget.dataset.id;
    const ids = (this.data.form.petIds || []).slice();
    const at = ids.indexOf(id);
    if (at >= 0) ids.splice(at, 1);
    else ids.push(id);
    this.setData({
      "form.petIds": ids,
      petOptions: this.data.petOptions.map((pet) =>
        Object.assign({}, pet, { active: ids.indexOf(pet.id) >= 0 }),
      ),
    });
  },
  toggleWeekday(event) {
    const id = Number(event.currentTarget.dataset.id);
    const days = (this.data.form.weekdays || []).slice();
    const at = days.indexOf(id);
    if (at >= 0) days.splice(at, 1);
    else days.push(id);
    days.sort((a, b) => a - b);
    this.setData({
      "form.weekdays": days,
      weekdays: this.data.weekdays.map((day) =>
        Object.assign({}, day, { active: days.indexOf(day.id) >= 0 }),
      ),
    });
  },
  savePlan() {
    const form = this.data.form;
    const title = String(form.title || "").trim();
    if (!title) {
      this.invalid("先写下这件照顾小事吧");
      return;
    }
    if (!Number.isFinite(planner.daysBetween(form.startDate, store.date()))) {
      this.invalid("请选择有效的开始日期");
      return;
    }
    if (form.rule === "weekly" && !(form.weekdays || []).length) {
      this.invalid("每周至少选择一天");
      return;
    }
    if (
      form.rule === "interval" &&
      (!Number.isInteger(Number(form.intervalDays)) ||
        Number(form.intervalDays) < 1 ||
        Number(form.intervalDays) > 3650)
    ) {
      this.invalid("间隔天数请填 1 到 3650 的整数");
      return;
    }
    if (form.time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(form.time)) {
      this.invalid("时间格式应为 00:00 到 23:59");
      return;
    }
    const record = {
      id: form.id || store.uid(),
      title,
      petIds: form.petIds || [],
      assigneeId: form.assigneeId || "",
      rule: form.rule,
      startDate: form.startDate,
      weekdays: form.weekdays || [],
      intervalDays: Number(form.intervalDays) || 1,
      time: form.time || "",
      note: String(form.note || "").trim(),
      enabled: form.enabled !== false,
      createdAt: form.createdAt || new Date().toISOString(),
    };
    if (
      this.mutate((state) => {
        if (
          record.assigneeId &&
          !state.members.some((member) => member.id === record.assigneeId)
        )
          throw new Error("原来的家人已移除，请重新选择指派人");
        state.carePlans = state.carePlans || [];
        const at = state.carePlans.findIndex((plan) => plan.id === record.id);
        if (form.id && at < 0) throw new Error("这张计划已经收起了");
        if (at >= 0) state.carePlans[at] = record;
        else state.carePlans.push(record);
      }, "照顾便签贴好啦 ♡")
    )
      this.closeDrawer();
  },
  togglePlan(event) {
    const id = event.currentTarget.dataset.id;
    this.mutate((state) => {
      const plan = (state.carePlans || []).find((item) => item.id === id);
      if (plan) plan.enabled = plan.enabled === false;
    });
  },
  deletePlan(event) {
    const id = event.currentTarget.dataset.id;
    wx.showModal({
      title: "收起这张计划？",
      content:
        "它将从日程里移除，已完成的记录会保留在周报中。暂时不做也可以选择暂停。",
      confirmText: "收起计划",
      confirmColor: "#9b6d85",
      success: (result) => {
        if (!result.confirm) return;
        this.mutate((state) => {
          const plan = (state.carePlans || []).find((item) => item.id === id);
          if (plan) plan.archivedAt = new Date().toISOString();
        }, "这张计划已收起，完成记录保留");
      },
    });
  },
  openSupply(event) {
    const id = event && event.currentTarget && event.currentTarget.dataset.id;
    const state = store.get();
    const existing =
      id && (state.supplies || []).find((item) => item.id === id);
    if (id && !existing) {
      store.toast("这件补给已经收起了");
      return;
    }
    const form = existing
      ? store.clone(existing)
      : {
          name: "",
          quantity: 0,
          unit: "袋",
          threshold: "1",
          petIds: state.pets.map((pet) => pet.id),
          movements: [],
        };
    this.setData({
      drawerKind: "supply",
      drawerTitle: existing ? "整理一格补给抽屉" : "添一格补给抽屉",
      form,
      petOptions: state.pets.map((pet) => ({
        id: pet.id,
        name: pet.name,
        active: (form.petIds || []).indexOf(pet.id) >= 0,
      })),
    });
  },
  saveSupply() {
    const form = this.data.form;
    const name = String(form.name || "").trim();
    const unit = String(form.unit || "").trim();
    const threshold = Number(form.threshold);
    if (!name || !unit) {
      this.invalid("请写下物品名称和计量单位");
      return;
    }
    if (
      String(form.threshold).trim() === "" ||
      !Number.isFinite(threshold) ||
      threshold < 0 ||
      threshold > 1000000
    ) {
      this.invalid("提醒数量请填 0 到 1000000");
      return;
    }
    if (Math.abs(threshold * 1000 - Math.round(threshold * 1000)) > 0.00001) {
      this.invalid("提醒数量最多填写三位小数");
      return;
    }
    if (
      this.mutate(
        (state) => {
          state.supplies = state.supplies || [];
          const at = state.supplies.findIndex((item) => item.id === form.id);
          if (form.id && at < 0) throw new Error("这件补给已经收起了");
          if (
            at >= 0 &&
            state.supplies[at].unit !== unit &&
            ((state.supplies[at].movements || []).length ||
              Number(state.supplies[at].quantity) !== 0)
          )
            throw new Error("已有库存记录，请保持原单位；新单位可新增一格补给");
          const record = Object.assign(
            {},
            at >= 0
              ? state.supplies[at]
              : { id: store.uid(), quantity: 0, movements: [] },
            {
              name,
              unit,
              threshold: quantity(threshold),
              petIds: form.petIds || [],
            },
          );
          if (at >= 0) state.supplies[at] = record;
          else state.supplies.push(record);
        },
        form.id ? "补给标签更新啦" : "抽屉准备好了，记得登记实际补货",
      )
    )
      this.closeDrawer();
  },
  openMovement(event) {
    const selectedSupply = (store.get().supplies || []).find(
      (item) => item.id === event.currentTarget.dataset.id,
    );
    if (!selectedSupply) return;
    const movementMode =
      event.currentTarget.dataset.mode === "out" ? "out" : "in";
    this.setData({
      drawerKind: "movement",
      drawerTitle: movementMode === "in" ? "新补给，欢迎回家" : "记下这次领用",
      selectedSupply,
      movementMode,
      form: { amount: "", movementNote: "" },
    });
  },
  saveMovement() {
    const form = this.data.form;
    const amount = Number(form.amount);
    if (
      String(form.amount).trim() === "" ||
      !Number.isFinite(amount) ||
      quantity(amount) <= 0 ||
      amount > 1000000
    ) {
      this.invalid("数量需大于 0，最多三位小数");
      return;
    }
    if (Math.abs(amount * 1000 - Math.round(amount * 1000)) > 0.00001) {
      this.invalid("数量最多填写三位小数");
      return;
    }
    const delta =
      quantity(amount) * (this.data.movementMode === "out" ? -1 : 1);
    const id = this.data.selectedSupply.id;
    if (
      this.mutate(
        (state) => {
          const item = (state.supplies || []).find(
            (supply) => supply.id === id,
          );
          if (!item) throw new Error("这件补给已经收起了");
          const next = quantity(Number(item.quantity) + delta);
          if (next < 0) throw new Error("领用数量超过库存啦");
          if (next > 1000000) throw new Error("库存上限为 1000000，请检查单位");
          item.quantity = next;
          item.movements = (item.movements || []).concat([
            {
              id: store.uid(),
              delta,
              at: new Date().toISOString(),
              note: String(form.movementNote || "").trim(),
            },
          ]);
        },
        delta > 0 ? "补给已放回抽屉 ♡" : "这次领用记好啦",
      )
    )
      this.closeDrawer();
  },
  toggleHistory(event) {
    const id = event.currentTarget.dataset.id;
    this.setData({ expandedSupply: this.data.expandedSupply === id ? "" : id });
  },
  deleteSupply(event) {
    const id = event.currentTarget.dataset.id;
    wx.showModal({
      title: "收起这格补给？",
      content: "物品和出入库记录将一起删除。",
      confirmText: "收起补给",
      confirmColor: "#9b6d85",
      success: (result) => {
        if (result.confirm)
          this.mutate((state) => {
            state.supplies = (state.supplies || []).filter(
              (item) => item.id !== id,
            );
          }, "这格补给已收起");
      },
    });
  },
  openHandover() {
    wx.navigateTo({ url: "/pages/insights/index?tab=handover" });
  },
  closeDrawer() {
    this.setData({ drawerKind: "", selectedSupply: null, feedback: "" });
  },
  stopTap() {},
});
