const store = require("../../utils/store");

function dayValue(value) {
  const parts = String(value).split("-").map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2], 12);
}

function validWeights(pet) {
  return (Array.isArray(pet.weights) ? pet.weights : [])
    .filter(
      (item) =>
        item &&
        typeof item.date === "string" &&
        Number.isFinite(Number(item.kg)) &&
        Number(item.kg) > 0,
    )
    .map((item) => ({ date: item.date, kg: Number(item.kg) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function recordTime(value) {
  const date = new Date(value);
  if (!value || !Number.isFinite(date.getTime())) return "";
  return [date.getHours(), date.getMinutes(), date.getSeconds()]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
}

function knownMarks(state, petId, date) {
  const marks = (state.checkins || {})[store.careKey(petId, date)] || {};
  return store.careTypes.map((type) => {
    const time = recordTime(marks[type.id]);
    return {
      id: type.id,
      label: type.label,
      symbol: type.symbol || "♡",
      done: !!time,
      time: time || "尚无记录",
    };
  });
}

function countMarks(state, petId, date) {
  return knownMarks(state, petId, date).filter((item) => item.done).length;
}

Page({
  data: {
    pets: [],
    pet: null,
    selectedId: "qiu",
    today: "",
    monthKey: "",
    selectedDate: "",
    monthLabel: "",
    calendar: [],
    weekdays: ["日", "一", "二", "三", "四", "五", "六"],
    careButtons: [],
    historyRows: [],
    historyLabel: "",
    historyCount: 0,
    todayCount: 0,
    recentCount: 0,
    completeDays: 0,
    consecutiveDays: 0,
    canNext: false,
    weights: [],
    reminders: [],
    drawerKind: "",
    drawerTitle: "",
    petForm: {},
    weightForm: {},
    reminderForm: {},
    formError: "",
    neuterOptions: ["待填写", "已绝育", "未绝育", "暂不记录"],
    neuterIndex: 0,
  },

  onLoad(options) {
    const today = store.date();
    this.setData({
      selectedId: options.id || "qiu",
      today,
      monthKey: today.slice(0, 7),
      selectedDate: today,
    });
  },

  onShow() {
    this.setData({ safeTop: getApp().globalData.safeTop || 64 });
    this.refresh();
  },

  refresh() {
    const state = store.get();
    const pets = Array.isArray(state.pets) ? state.pets : [];
    const pet =
      pets.find((item) => item.id === this.data.selectedId) || pets[0];
    if (!pet) {
      this.setData({ pets: [], pet: null });
      return;
    }
    const today = store.date();
    const selectedDate =
      !this.data.selectedDate || this.data.selectedDate > today
        ? today
        : this.data.selectedDate;
    let monthKey = this.data.monthKey || today.slice(0, 7);
    if (monthKey > today.slice(0, 7)) monthKey = today.slice(0, 7);
    const parts = monthKey.split("-").map(Number);
    const first = new Date(parts[0], parts[1] - 1, 1, 12);
    const lastDay = new Date(parts[0], parts[1], 0, 12).getDate();
    const leading = first.getDay();
    const slots = Math.ceil((leading + lastDay) / 7) * 7;
    const calendar = Array.from({ length: slots }, (_, index) => {
      const day = index - leading + 1;
      if (day < 1 || day > lastDay)
        return { id: "blank-" + index, blank: true };
      const date = store.date(new Date(parts[0], parts[1] - 1, day, 12));
      const count = countMarks(state, pet.id, date);
      return {
        id: date,
        date,
        day,
        future: date > today,
        selected: date === selectedDate,
        today: date === today,
        count,
        complete: count === 4,
        dots: [0, 1, 2, 3].map((value) => ({
          id: value,
          filled: value < count,
        })),
        aria:
          date +
          (date === today ? "，今天" : "") +
          (date > today ? "，尚未到来" : "，完成" + count + "项照顾"),
      };
    });
    const careButtons = knownMarks(state, pet.id, today);
    const historyRows = knownMarks(state, pet.id, selectedDate);
    let recentCount = 0;
    let completeDays = 0;
    for (let i = 0; i < 7; i++) {
      const date = dayValue(today);
      date.setDate(date.getDate() - i);
      const count = countMarks(state, pet.id, store.date(date));
      recentCount += count;
      if (count === 4) completeDays++;
    }
    const heat = [];
    for (let i = 13; i >= 0; i--) {
      const date = dayValue(today);
      date.setDate(date.getDate() - i);
      heat.push({
        key: store.date(date),
        label: String(date.getDate()),
        level: countMarks(state, pet.id, store.date(date)),
        isToday: i === 0,
      });
    }
    const orderedWeights = validWeights(pet);
    const maximum = Math.max(0, ...orderedWeights.map((item) => item.kg));
    const weights = orderedWeights
      .slice()
      .reverse()
      .map((item) => ({
        date: item.date,
        kg: item.kg,
        display: item.kg.toFixed(2),
        bar: maximum ? Math.round((item.kg / maximum) * 100) : 0,
      }));
    const reminders = (pet.reminders || [])
      .map((item) => {
        const difference = Math.round(
          (dayValue(item.date).getTime() - dayValue(today).getTime()) /
            86400000,
        );
        return {
          id: item.id,
          title: item.title,
          date: item.date,
          urgent: Number.isFinite(difference) && difference < 7,
          caption: !Number.isFinite(difference)
            ? "日期待确认"
            : difference < 0
              ? "已逾期 " + -difference + " 天"
              : difference === 0
                ? "就是今天"
                : "还有 " + difference + " 天",
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));
    const selectedDay = dayValue(selectedDate);
    this.setData({
      pets: pets.map((item) => ({
        id: item.id,
        name: item.name,
        photo: item.photo,
        selected: item.id === pet.id,
      })),
      pet: {
        id: pet.id,
        name: pet.name,
        photo: pet.photo,
        breed: pet.breed || "品种待填写",
        birthday: pet.birthday || "",
        age: store.ageLabel(pet.birthday),
        neutered: pet.neutered || "待填写",
        weight: weights.length ? weights[0].display + " kg" : "等你记第一笔",
      },
      selectedId: pet.id,
      today,
      monthKey,
      selectedDate,
      monthLabel: parts[0] + " 年 " + parts[1] + " 月",
      calendar,
      careButtons,
      historyRows,
      historyLabel:
        selectedDay.getMonth() +
        1 +
        "月" +
        selectedDay.getDate() +
        "日 · 星期" +
        this.data.weekdays[selectedDay.getDay()],
      historyCount: historyRows.filter((item) => item.done).length,
      todayCount: careButtons.filter((item) => item.done).length,
      recentCount,
      completeDays,
      heat,
      consecutiveDays: store.streak(state, pet.id),
      canNext: monthKey < today.slice(0, 7),
      weights,
      reminders,
    });
  },

  mutate(fn, message) {
    try {
      store.update(fn);
      this.refresh();
      if (message) store.toast(message);
      return true;
    } catch (error) {
      const message = error.message || "保存失败，请检查本机存储空间";
      if (this.data.drawerKind) this.setData({ formError: message });
      store.toast(message);
      return false;
    }
  },

  selectPet(event) {
    this.setData({ selectedId: event.currentTarget.dataset.id });
    this.refresh();
  },

  toggleCare(event) {
    const id = event.currentTarget.dataset.id;
    if (!store.careTypes.some((item) => item.id === id)) return;
    const petId = this.data.selectedId;
    const today = store.date();
    const key = store.careKey(petId, today);
    const state = store.get();
    const existing = !!((state.checkins || {})[key] || {})[id];
    this.mutate(
      (draft) => {
        draft.checkins = draft.checkins || {};
        const marks = Object.assign({}, draft.checkins[key] || {});
        if (existing) delete marks[id];
        else marks[id] = new Date().toISOString();
        draft.checkins[key] = marks;
      },
      existing ? "已撤销这份照顾" : "这份照顾记好啦 ♡",
    );
  },

  moveMonth(event) {
    const delta = Number(event.currentTarget.dataset.delta);
    const parts = this.data.monthKey.split("-").map(Number);
    const next = new Date(parts[0], parts[1] - 1 + delta, 1, 12);
    const key = store.date(next).slice(0, 7);
    const today = store.date();
    if (key > today.slice(0, 7)) return;
    this.setData({
      monthKey: key,
      selectedDate: key === today.slice(0, 7) ? today : store.date(next),
    });
    this.refresh();
  },

  selectDay(event) {
    const date = event.currentTarget.dataset.date;
    if (!date || date > store.date()) return;
    this.setData({ selectedDate: date });
    this.refresh();
  },

  returnToday() {
    const today = store.date();
    this.setData({ monthKey: today.slice(0, 7), selectedDate: today });
    this.refresh();
  },

  openPetEditor() {
    const pet = store
      .get()
      .pets.find((item) => item.id === this.data.selectedId);
    if (!pet) return;
    const neutered = pet.neutered || "待填写";
    this.setData({
      drawerKind: "pet",
      drawerTitle: "小主的专属档案",
      formError: "",
      petPhotoChoices: store
        .activePhotos(store.get())
        .map((photo) => ({
          id: photo.id,
          src: store.getPhotoSource(photo),
          title: photo.title,
        })),
      petForm: {
        name: pet.name || "",
        breed: pet.breed || "",
        birthday: pet.birthday || "",
        neutered,
        photo: pet.photo || "",
        temporaryPhoto: false,
      },
      neuterIndex: Math.max(0, this.data.neuterOptions.indexOf(neutered)),
    });
  },

  choosePetPhoto() {
    if (this.data.photoSaving || this.data.choosingPhoto) return;
    const petId = this.data.selectedId;
    wx.showActionSheet({
      itemList: ["从手机相册选择", "拍一张新照片"],
      success: (action) => {
        this.setData({ choosingPhoto: true });
        wx.chooseMedia({
          count: 1,
          mediaType: ["image"],
          sourceType: [action.tapIndex === 1 ? "camera" : "album"],
          sizeType: ["compressed"],
          success: (result) => {
            const file = result.tempFiles && result.tempFiles[0];
            if (
              file &&
              this.data.drawerKind === "pet" &&
              this.data.selectedId === petId
            )
              this.setData({
                "petForm.photo": file.tempFilePath,
                "petForm.temporaryPhoto": true,
                formError: "",
              });
          },
          fail: (error) => {
            if (!/cancel/i.test(error.errMsg || ""))
              this.formFeedback("照片未能选取，请检查相册或相机权限");
          },
          complete: () => this.setData({ choosingPhoto: false }),
        });
      },
    });
  },
  selectPetPhoto(event) {
    if (this.data.photoSaving) return;
    const photo = store
      .activePhotos(store.get())
      .find((item) => item.id === event.currentTarget.dataset.id);
    if (photo)
      this.setData({
        "petForm.photo": store.getPhotoSource(photo),
        "petForm.temporaryPhoto": false,
        formError: "",
      });
  },

  openWeightEditor(event) {
    const date = event.currentTarget.dataset.date || store.date();
    const pet = store
      .get()
      .pets.find((item) => item.id === this.data.selectedId);
    const existing =
      pet && validWeights(pet).find((item) => item.date === date);
    this.setData({
      drawerKind: "weight",
      drawerTitle: existing ? "续写成长的小刻度" : "成长的小刻度",
      formError: "",
      weightForm: {
        date,
        kg: existing ? existing.kg.toFixed(2) : "",
        existing: !!existing,
      },
    });
  },

  openReminder() {
    this.setData({
      drawerKind: "reminder",
      drawerTitle: "贴一张健康便签",
      formError: "",
      reminderForm: { title: "", date: store.date() },
    });
  },

  formInput(event) {
    const path = event.currentTarget.dataset.path;
    const allowed = [
      "petForm.name",
      "petForm.breed",
      "weightForm.kg",
      "reminderForm.title",
    ];
    if (allowed.indexOf(path) < 0) return;
    const patch = { formError: "" };
    patch[path] = event.detail.value;
    this.setData(patch);
  },

  birthdayChange(event) {
    this.setData({ "petForm.birthday": event.detail.value });
  },
  clearBirthday() {
    this.setData({ "petForm.birthday": "" });
  },
  neuterChange(event) {
    const index = Number(event.detail.value);
    this.setData({
      neuterIndex: index,
      "petForm.neutered": this.data.neuterOptions[index],
    });
  },
  weightDateChange(event) {
    const date = event.detail.value;
    const pet = store
      .get()
      .pets.find((item) => item.id === this.data.selectedId);
    const existing =
      pet && validWeights(pet).find((item) => item.date === date);
    this.setData({
      "weightForm.date": date,
      "weightForm.kg": existing ? existing.kg.toFixed(2) : "",
      "weightForm.existing": !!existing,
    });
  },
  reminderDateChange(event) {
    this.setData({ "reminderForm.date": event.detail.value });
  },

  async saveCurrent() {
    if (this.data.photoSaving || this.data.choosingPhoto) return;
    const petId = this.data.selectedId;
    let change;
    let message;
    if (this.data.drawerKind === "pet") {
      const form = store.clone(this.data.petForm);
      if (!form.name.trim()) {
        this.formFeedback("给小主写一个名字吧");
        return;
      }
      if (form.birthday && form.birthday > store.date()) {
        this.formFeedback("生日不能晚于今天");
        return;
      }
      if (form.temporaryPhoto) {
        this.setData({ photoSaving: true });
        wx.showLoading({ title: "留住新的档案照", mask: true });
        try {
          form.photo = await store.saveFile(form.photo);
          form.temporaryPhoto = false;
          this.setData({
            "petForm.photo": form.photo,
            "petForm.temporaryPhoto": false,
          });
        } catch (error) {
          this.formFeedback("照片未能保存，原档案照仍保留，请重试");
          return;
        } finally {
          this.setData({ photoSaving: false });
          wx.hideLoading();
        }
      }
      change = (pet) =>
        Object.assign(pet, {
          name: form.name.trim(),
          breed: form.breed.trim(),
          birthday: form.birthday || "",
          neutered: form.neutered,
          photo: form.photo || pet.photo,
        });
      message = "小主的档案贴好啦 ♡";
    } else if (this.data.drawerKind === "weight") {
      const form = this.data.weightForm;
      const kg = Number(form.kg);
      const rounded = Math.round(kg * 100) / 100;
      if (!Number.isFinite(kg) || rounded <= 0) {
        this.formFeedback("请填写大于零的体重，单位 kg");
        return;
      }
      if (!form.date || form.date > store.date()) {
        this.formFeedback("请选择今天或过去的日期");
        return;
      }
      change = (pet) => {
        pet.weights = validWeights(pet)
          .filter((item) => item.date !== form.date)
          .concat([{ date: form.date, kg: rounded }])
          .sort((a, b) => a.date.localeCompare(b.date));
      };
      message = form.existing ? "这一天的体重更新啦" : "新的成长记录收好啦";
    } else if (this.data.drawerKind === "reminder") {
      const form = this.data.reminderForm;
      if (!form.title.trim() || !form.date) {
        this.formFeedback("请填写提醒事项与日期");
        return;
      }
      const reminder = {
        id: store.uid(),
        title: form.title.trim(),
        date: form.date,
      };
      change = (pet) => {
        pet.reminders = (pet.reminders || []).concat([reminder]);
      };
      message = "提醒便签贴好啦";
    } else return;
    if (
      this.mutate((draft) => {
        const pet = draft.pets.find((item) => item.id === petId);
        if (!pet) throw new Error("这位小主的资料暂未找到");
        change(pet);
      }, message)
    )
      this.closeDrawer();
  },

  deleteWeight(event) {
    const date = event.currentTarget.dataset.date;
    const petId = this.data.selectedId;
    wx.showModal({
      title: "收起这笔体重？",
      content: date + " 的体重记录将被删除。",
      confirmText: "删除记录",
      confirmColor: "#9b6d85",
      success: (result) => {
        if (!result.confirm) return;
        this.mutate((draft) => {
          const pet = draft.pets.find((item) => item.id === petId);
          if (pet)
            pet.weights = (pet.weights || []).filter(
              (item) => item.date !== date,
            );
        }, "这笔体重记录已删除");
      },
    });
  },

  deleteReminder(event) {
    const id = event.currentTarget.dataset.id;
    const petId = this.data.selectedId;
    this.mutate((draft) => {
      const pet = draft.pets.find((item) => item.id === petId);
      if (pet)
        pet.reminders = (pet.reminders || []).filter((item) => item.id !== id);
    }, "提醒便签已收起");
  },

  formFeedback(message) {
    this.setData({ formError: message });
    store.toast(message);
  },
  closeDrawer() {
    if (this.data.photoSaving) return;
    this.setData({ drawerKind: "", drawerTitle: "", formError: "" });
  },
  stopTap() {},
});
