const KEY = "bunny-family-native-v1";
const careTypes = [
  { id: "hay", label: "喂草", symbol: "♧" },
  { id: "water", label: "换水", symbol: "♧" },
  { id: "clean", label: "铲屎", symbol: "✧" },
  { id: "play", label: "陪玩", symbol: "♡" },
];
const clone = (value) => JSON.parse(JSON.stringify(value));
const date = (value) => {
  const d = value ? new Date(value) : new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const uid = () =>
  `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
const asset = (name) => `/assets/photos/${name}.jpg`;
function initial() {
  return {
    version: 1,
    pets: [
      {
        id: "qiu",
        name: "豆米",
        photo: asset("qiuqiu-close"),
        breed: "",
        birthday: "",
        neutered: "待填写",
        weights: [],
        reminders: [],
      },
      {
        id: "dou",
        name: "豆糕",
        photo: asset("doudou-close"),
        breed: "",
        birthday: "",
        neutered: "待填写",
        weights: [],
        reminders: [],
      },
    ],
    members: [
      {
        id: "m1",
        name: "我",
        role: "喂兔专员",
        birthday: "",
        avatar: "",
        relationTo: "",
        relation: "",
      },
      {
        id: "m2",
        name: "家人",
        role: "快乐铲屎官",
        birthday: "",
        avatar: "",
        relationTo: "",
        relation: "",
      },
    ],
    photos: [
      {
        id: "p1",
        src: asset("together-home"),
        title: "今天也要贴在一起",
        tag: "一起",
        petIds: ["qiu", "dou"],
        liked: true,
        date: "",
      },
      {
        id: "p2",
        src: asset("qiuqiu-close"),
        title: "认真看世界的小眼睛",
        tag: "豆米",
        petIds: ["qiu"],
        liked: false,
        date: "",
      },
      {
        id: "p3",
        src: asset("doudou-close"),
        title: "靠近一点，再靠近一点",
        tag: "豆糕",
        petIds: ["dou"],
        liked: false,
        date: "",
      },
      {
        id: "p4",
        src: asset("qiuqiu-front"),
        title: "今日份的乖巧",
        tag: "豆米",
        petIds: ["qiu"],
        liked: false,
        date: "",
      },
      {
        id: "p5",
        src: asset("qiuqiu-home"),
        title: "在家发呆也很好",
        tag: "豆米",
        petIds: ["qiu"],
        liked: false,
        date: "",
      },
      {
        id: "p6",
        src: asset("together-sleep"),
        title: "陪你一起慢慢长大",
        tag: "一起",
        petIds: ["qiu", "dou"],
        liked: false,
        date: "",
      },
    ],
    checkins: {},
    todos: [
      { id: "t1", text: "给小主添一把新鲜牧草", done: false },
      { id: "t2", text: "留一张今天的合照", done: false },
    ],
    notes: [],
    videos: [],
    editorDrafts: [],
  };
}
let cache = null;
// 历史数据里可能存了不带前导斜杠的包内路径（"assets/..."），
// 小程序会把它当成相对页面目录解析，于是变成 /pages/xxx/assets/... 直接 500。
const fixAsset = (value) => {
  if (typeof value !== "string" || !value) return value;
  if (value.charAt(0) === "/") return value;
  if (/^[a-z]+:\/\//i.test(value)) return value;
  if (value.indexOf("data:") === 0) return value;
  return "/" + value;
};
function normalizeAssets(state) {
  if (Array.isArray(state.photos))
    state.photos.forEach((photo) => {
      if (photo) photo.src = fixAsset(photo.src);
    });
  if (Array.isArray(state.pets))
    state.pets.forEach((pet) => {
      if (pet) pet.photo = fixAsset(pet.photo);
    });
  if (Array.isArray(state.members))
    state.members.forEach((member) => {
      if (member) member.avatar = fixAsset(member.avatar);
    });
  return state;
}
function get() {
  if (!cache) {
    const saved = wx.getStorageSync(KEY);
    cache = Object.assign(initial(), {
      carePlans: [],
      planLogs: {},
      supplies: [],
      albums: [],
      diaryDraft: null,
      handover: {
        contactName: "",
        contactPhone: "",
        clinic: "",
        clinicPhone: "",
        note: "",
        petNotes: {},
      },
    });
    if (saved && saved.version === 1) {
      cache = Object.assign(cache, saved);
      [
        "pets",
        "members",
        "photos",
        "todos",
        "notes",
        "videos",
        "editorDrafts",
        "carePlans",
        "supplies",
        "albums",
      ].forEach((key) => {
        if (!Array.isArray(cache[key])) cache[key] = initial()[key] || [];
      });
      ["checkins", "planLogs"].forEach((key) => {
        if (
          !cache[key] ||
          Array.isArray(cache[key]) ||
          typeof cache[key] !== "object"
        )
          cache[key] = {};
      });
      if (
        !cache.handover ||
        Array.isArray(cache.handover) ||
        typeof cache.handover !== "object"
      )
        cache.handover = {};
    }
    normalizeAssets(cache);
  }
  return clone(cache);
}
function save(next) {
  wx.setStorageSync(KEY, next);
  cache = clone(next);
  return get();
}
function update(mutator) {
  const next = get();
  return save(mutator(next) || next);
}
const careKey = (id, day) => `${id}:${day || date()}`;
const careCount = (state, id, day) =>
  careTypes.filter(
    (t) =>
      state.checkins[careKey(id, day)] &&
      state.checkins[careKey(id, day)][t.id],
  ).length;
function streak(state, id) {
  const d = new Date();
  if (careCount(state, id) < 4) d.setDate(d.getDate() - 1);
  let days = 0;
  while (days < 3660 && careCount(state, id, date(d)) === 4) {
    days++;
    d.setDate(d.getDate() - 1);
  }
  return days;
}
function birthdayCountdown(value) {
  if (!value) return null;
  const source = new Date(`${value}T00:00:00`);
  if (isNaN(source.getTime())) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const make = (year) =>
    new Date(
      year,
      source.getMonth(),
      Math.min(
        source.getDate(),
        new Date(year, source.getMonth() + 1, 0).getDate(),
      ),
    );
  let next = make(now.getFullYear());
  if (next < now) next = make(now.getFullYear() + 1);
  return Math.round((next - now) / 86400000);
}
function ageLabel(value) {
  if (!value) return "年龄待填写";
  const born = new Date(`${value}T00:00:00`),
    now = new Date();
  let n =
    (now.getFullYear() - born.getFullYear()) * 12 +
    now.getMonth() -
    born.getMonth();
  if (now.getDate() < born.getDate()) n--;
  return n < 0 || isNaN(n)
    ? "年龄待填写"
    : n >= 12
      ? `${Math.floor(n / 12)} 岁 ${n % 12} 个月`
      : `${n} 个月`;
}
const toast = (text) =>
  wx.showToast({
    title: String(text).slice(0, 50),
    icon: "none",
    duration: 2300,
  });
const activePhotos = (state) => state.photos.filter((p) => !p.trashedAt);
const getPhotoSource = (photo) => fixAsset((photo && photo.src) || "");
function saveFile(path) {
  return new Promise((resolve, reject) => {
    const legacy = () =>
      wx.saveFile({
        tempFilePath: path,
        success: (r) => resolve(r.savedFilePath),
        fail: reject,
      });
    try {
      const match = /\.(jpe?g|png|webp|gif|heic)$/i.exec(path);
      const ext = match ? match[1].toLowerCase() : "jpg";
      wx.getFileSystemManager().saveFile({
        tempFilePath: path,
        filePath: `${wx.env.USER_DATA_PATH}/${uid()}.${ext}`,
        success: (r) => resolve(r.savedFilePath),
        fail: legacy,
      });
    } catch (error) {
      legacy();
    }
  });
}
function choosePhotos(count) {
  return new Promise((resolve, reject) =>
    wx.chooseMedia({
      count: Math.min(9, count || 9),
      mediaType: ["image"],
      sourceType: ["album", "camera"],
      sizeType: ["compressed"],
      success: async (result) => {
        const added = [],
          failed = [];
        try {
          for (let i = 0; i < result.tempFiles.length; i++) {
            wx.showLoading({
              title: `带回家 ${i + 1}/${result.tempFiles.length}`,
              mask: true,
            });
            try {
              const src = await saveFile(result.tempFiles[i].tempFilePath);
              added.push({
                id: uid(),
                src,
                title: "新的一帧小美好",
                tag: "未分类",
                petIds: [],
                date: date(),
                liked: false,
              });
            } catch (error) {
              failed.push(error);
            }
          }
          if (added.length)
            update((s) => {
              s.photos = added.concat(s.photos);
            });
          wx.hideLoading();
          if (failed.length)
            toast(`${added.length} 张成功，${failed.length} 张未能保存`);
          resolve(added);
        } catch (error) {
          wx.hideLoading();
          reject(error);
        }
      },
      fail: (error) => {
        if ((error.errMsg || "").indexOf("cancel") >= 0) resolve([]);
        else reject(error);
      },
    }),
  );
}
module.exports = {
  get,
  save,
  update,
  initial,
  date,
  uid,
  clone,
  careTypes,
  careKey,
  careCount,
  streak,
  birthdayCountdown,
  ageLabel,
  toast,
  activePhotos,
  getPhotoSource,
  choosePhotos,
  saveFile,
};
