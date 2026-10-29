const store = require("../../utils/store");
const planner = require("../../utils/planner");
const insights = require("../../utils/insights");

function box(ctx, x, y, width, height, radius, fill) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}
function wrap(ctx, text, x, y, maxWidth, maxLines) {
  const rows = [];
  let row = "";
  for (const character of String(text)) {
    if (
      character === "\n" ||
      (row && ctx.measureText(row + character).width > maxWidth)
    ) {
      rows.push(row);
      row = character === "\n" ? "" : character;
    } else row += character;
  }
  if (row) rows.push(row);
  const shown = rows.slice(0, maxLines);
  if (rows.length > maxLines)
    shown[maxLines - 1] = shown[maxLines - 1].slice(0, -1) + "…";
  shown.forEach((line, index) => ctx.fillText(line, x, y + index * 34));
  return Math.max(1, shown.length) * 34;
}

Page({
  data: {
    tab: "week",
    report: null,
    card: null,
    selected: "",
    today: "",
    editing: false,
    form: {},
    petFields: [],
    feedback: "",
    exporting: false,
    exportPath: "",
  },
  onLoad(options) {
    this.setData({
      tab: options.tab === "handover" ? "handover" : "week",
      selected: store.date(),
    });
  },
  onShow() {
    this.setData({ safeTop: getApp().globalData.safeTop || 64 });
    this.refresh();
  },
  refresh() {
    try {
      const state = store.get(),
        today = store.date();
      this.setData({
        today,
        report: insights.weekly(state, this.data.selected || today, today),
        card: insights.handover(state, today),
      });
    } catch (error) {
      store.toast("记录暂时未能读取，请保留当前页面");
    }
  },
  tabChange(event) {
    this.setData({ tab: event.currentTarget.dataset.tab });
  },
  weekChange(event) {
    const delta = Number(event.currentTarget.dataset.delta);
    if (delta > 0 && !this.data.report.canNext) return;
    this.setData({
      selected: planner.addDays(this.data.report.start, delta * 7),
    });
    this.refresh();
  },
  currentWeek() {
    this.setData({ selected: store.date() });
    this.refresh();
  },
  goCare() {
    wx.navigateTo({ url: "/pages/care/index" });
  },
  goSupplies() {
    wx.navigateTo({ url: "/pages/care/index?tab=supplies" });
  },
  goDiary() {
    wx.navigateTo({ url: "/pages/diary/index" });
  },
  pet(event) {
    wx.navigateTo({
      url: "/pages/pets/index?id=" + event.currentTarget.dataset.id,
    });
  },
  previewPhoto(event) {
    const current = event.currentTarget.dataset.src;
    const urls = this.data.report.memories.map((photo) => photo.src);
    if (urls.length) wx.previewImage({ current, urls });
  },
  edit() {
    const state = store.get(),
      form = store.clone(this.data.card.info);
    form.petNotes = form.petNotes || {};
    this.setData({
      editing: true,
      form,
      feedback: "",
      petFields: state.pets.map((pet) => ({
        id: pet.id,
        name: pet.name,
        value: form.petNotes[pet.id] || "",
      })),
    });
  },
  field(event) {
    const name = event.currentTarget.dataset.field;
    if (
      ["contactName", "contactPhone", "clinic", "clinicPhone", "note"].indexOf(
        name,
      ) < 0
    )
      return;
    const patch = {};
    patch["form." + name] = event.detail.value;
    this.setData(patch);
  },
  petField(event) {
    const id = event.currentTarget.dataset.id,
      patch = {};
    patch["form.petNotes." + id] = event.detail.value;
    this.setData(patch);
  },
  close() {
    this.setData({ editing: false });
  },
  stop() {},
  save() {
    try {
      const form = store.clone(this.data.form);
      ["contactName", "contactPhone", "clinic", "clinicPhone", "note"].forEach(
        (key) => {
          form[key] = String(form[key] || "").trim();
        },
      );
      store.update((state) => {
        state.handover = form;
      });
      this.setData({ editing: false });
      this.refresh();
      store.toast("照顾说明已经夹进手账");
    } catch (error) {
      this.setData({
        feedback: "未能保存，文字仍保留在这里，请检查本机空间后重试。",
      });
    }
  },
  copy() {
    this.refresh();
    wx.setClipboardData({
      data: insights.handoverText(this.data.card, this.data.today),
      fail() {
        store.toast("未能复制，请重试");
      },
    });
  },
  async exportCard() {
    if (this.data.exporting) return;
    this.refresh();
    this.setData({ exporting: true });
    wx.showLoading({ title: "把照顾装进信封", mask: true });
    try {
      const result = await new Promise((resolve, reject) =>
        wx
          .createSelectorQuery()
          .in(this)
          .select("#handover-canvas")
          .fields({ node: true, size: true })
          .exec((rows) =>
            rows[0] && rows[0].node
              ? resolve(rows[0])
              : reject(new Error("画布尚未准备好，请重试")),
          ),
      );
      const canvas = result.node,
        ctx = canvas.getContext("2d"),
        card = this.data.card;
      canvas.width = 750;
      canvas.height = 1480;
      ctx.fillStyle = "#FFF9F0";
      ctx.fillRect(0, 0, 750, 1480);
      ctx.fillStyle = "#EADBD4";
      for (let x = 15; x < 750; x += 30)
        for (let y = 15; y < 1480; y += 30) ctx.fillRect(x, y, 1, 1);
      box(ctx, 28, 28, 694, 1424, 24, "#FFFCF6");
      box(ctx, 235, 18, 280, 38, 4, "#FFD9E8");
      ctx.fillStyle = "#6B5B73";
      ctx.font = "bold 38px sans-serif";
      ctx.fillText("豆米与豆糕 · 照顾交接卡", 64, 115);
      ctx.font = "22px sans-serif";
      ctx.fillStyle = "#866C81";
      ctx.fillText(
        "更新于 " + this.data.today + "  /  家人接力的小日子",
        64,
        157,
      );
      let y = 200;
      for (const pet of card.pets.slice(0, 2)) {
        box(ctx, 58, y, 634, 174, 18, pet.id === "qiu" ? "#EDF5EA" : "#FFF1CB");
        ctx.font = "bold 28px sans-serif";
        ctx.fillStyle = "#6B5B73";
        ctx.fillText(pet.name, 82, y + 42);
        ctx.font = "22px sans-serif";
        ctx.fillText(
          pet.marks
            .map((mark) => mark.label + (mark.done ? "✓" : "待做"))
            .join("  "),
          82,
          y + 82,
        );
        ctx.font = "22px sans-serif";
        wrap(
          ctx,
          pet.note || "还没有特别照顾说明，可向家人补充。",
          82,
          y + 121,
          582,
          2,
        );
        y += 194;
      }
      ctx.font = "bold 27px sans-serif";
      ctx.fillStyle = "#6B5B73";
      ctx.fillText("未来三天 · 照顾便签", 64, y + 28);
      y += 72;
      ctx.font = "23px sans-serif";
      const plans = card.plans.slice(0, 4);
      if (!plans.length) {
        ctx.fillText("尚未安排日程，翻开照顾页添一张。", 64, y);
        y += 44;
      }
      plans.forEach((plan) => {
        y +=
          wrap(
            ctx,
            plan.day.slice(5) +
              " " +
              plan.time +
              " · " +
              plan.title +
              " / " +
              plan.assignee,
            64,
            y,
            610,
            2,
          ) + 12;
      });
      if (card.plans.length > 4) {
        ctx.font = "20px sans-serif";
        ctx.fillText(
          "另有 " + (card.plans.length - 4) + " 项，请查看完整文字交接。",
          64,
          y,
        );
        y += 38;
      }
      const alerts = card.reminders
        .map((item) => item.pet + " " + item.title + "（" + item.due + "）")
        .concat(
          card.low.map(
            (item) =>
              item.name + "余 " + item.quantity + item.unit + "，记得补给",
          ),
        );
      ctx.font = "22px sans-serif";
      ctx.fillStyle = "#966078";
      if (alerts.length)
        y += wrap(ctx, alerts.join("；"), 64, y + 10, 610, 2) + 22;
      ctx.fillStyle = "#6B5B73";
      ctx.font = "23px sans-serif";
      if (card.info.note)
        y += wrap(ctx, "家人留言：" + card.info.note, 64, y + 8, 610, 3) + 20;
      const contact = [card.info.contactName, card.info.contactPhone]
        .filter(Boolean)
        .join(" ");
      const clinic = [card.info.clinic, card.info.clinicPhone]
        .filter(Boolean)
        .join(" ");
      y = Math.min(y + 20, 1260);
      if (contact) y += wrap(ctx, "联系家人：" + contact, 64, y, 610, 2) + 8;
      if (clinic) wrap(ctx, "常去医院：" + clinic, 64, y, 610, 2);
      ctx.font = "19px sans-serif";
      ctx.fillStyle = "#866C81";
      ctx.fillText("本机记录快照 · 长说明与全部日程请复制完整文字", 64, 1405);
      const path = await new Promise((resolve, reject) =>
        wx.canvasToTempFilePath(
          {
            canvas,
            fileType: "png",
            quality: 1,
            success: (file) => resolve(file.tempFilePath),
            fail: reject,
          },
          this,
        ),
      );
      this.setData({ exportPath: path });
      wx.previewImage({ current: path, urls: [path] });
    } catch (error) {
      store.toast(error.message || "交接卡生成失败，请重试");
    } finally {
      wx.hideLoading();
      this.setData({ exporting: false });
    }
  },
  saveCard() {
    if (!this.data.exportPath) return;
    wx.saveImageToPhotosAlbum({
      filePath: this.data.exportPath,
      success() {
        store.toast("交接卡已保存到相册");
      },
      fail(error) {
        store.toast(
          (error.errMsg || "").indexOf("auth") >= 0
            ? "保存需要相册权限，可在微信设置中开启后重试"
            : "未能保存，可以重新预览后手动保存",
        );
      },
    });
  },
});
