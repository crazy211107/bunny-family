import { useEffect, useState } from "react";

export const localDate = (value = new Date()) => {
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const careTypes = [
  { id: "hay", label: "喂草", icon: "Sprout" },
  { id: "water", label: "换水", icon: "Droplets" },
  { id: "clean", label: "铲屎", icon: "Sparkles" },
  { id: "play", label: "陪玩", icon: "Heart" },
];
export const seedPhotos = [
  {
    id: "p1",
    src: "/photos/together-home.jpg",
    title: "今天也要贴在一起",
    tag: "一起",
    petIds: ["qiu", "dou"],
    date: "",
    liked: true,
  },
  {
    id: "p2",
    src: "/photos/qiuqiu-close.jpg",
    title: "认真看世界的小眼睛",
    tag: "豆米",
    petIds: ["qiu"],
    date: "",
    liked: false,
  },
  {
    id: "p3",
    src: "/photos/doudou-close.jpg",
    title: "靠近一点，再靠近一点",
    tag: "豆糕",
    petIds: ["dou"],
    date: "",
    liked: false,
  },
  {
    id: "p4",
    src: "/photos/qiuqiu-front.jpg",
    title: "今日份的乖巧",
    tag: "豆米",
    petIds: ["qiu"],
    date: "",
    liked: false,
  },
  {
    id: "p5",
    src: "/photos/qiuqiu-home.jpg",
    title: "在家发呆也很好",
    tag: "豆米",
    petIds: ["qiu"],
    date: "",
    liked: false,
  },
  {
    id: "p6",
    src: "/photos/together-sleep.jpg",
    title: "陪你一起慢慢长大",
    tag: "一起",
    petIds: ["qiu", "dou"],
    date: "",
    liked: false,
  },
];
const initial = {
  version: 1,
  schemaVersion: 2,
  petNamesRevision: 1,
  pets: [
    {
      id: "qiu",
      name: "豆米",
      photo: "/photos/qiuqiu-close.jpg",
      breed: "",
      birthday: "",
      neutered: "待填写",
      weights: [],
      reminders: [],
    },
    {
      id: "dou",
      name: "豆糕",
      photo: "/photos/doudou-close.jpg",
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
  todos: [
    { id: "t1", text: "给两位小主添一把新鲜牧草", done: false },
    { id: "t2", text: "留一张今天的合照", done: false },
  ],
  checkins: {},
  photos: seedPhotos,
  notes: [],
  videos: [],
  editorDrafts: [],
};
export const createInitialState = () => structuredClone(initial);
export const activePhotos = (state) => state.photos.filter((p) => !p.trashedAt);
export function migrateState(old) {
  if (!old || old.version !== 1) return createInitialState();
  const result = {
    ...createInitialState(),
    ...old,
    schemaVersion: 2,
    petNamesRevision: 1,
  };
  const list = (key, fallback = []) =>
    Array.isArray(old[key])
      ? old[key].filter(
          (x) => x && typeof x === "object" && typeof x.id === "string",
        )
      : fallback;
  const petList = list("pets");
  result.pets = initial.pets.map((base) => {
    const previous = petList.find((x) => x.id === base.id) || {};
    return {
      ...base,
      ...previous,
      name:
        old.petNamesRevision === 1 &&
        typeof previous.name === "string" &&
        previous.name.trim()
          ? previous.name
          : base.name,
      weights: Array.isArray(previous.weights)
        ? previous.weights
            .filter(
              (w) =>
                w &&
                typeof w.date === "string" &&
                Number.isFinite(w.kg) &&
                w.kg > 0,
            )
            .sort((a, b) => a.date.localeCompare(b.date))
        : [],
      reminders: Array.isArray(previous.reminders)
        ? previous.reminders.filter(
            (r) =>
              r &&
              r.id &&
              typeof r.date === "string" &&
              typeof r.title === "string",
          )
        : [],
    };
  });
  result.members = list("members", initial.members).map((m) => ({
    ...m,
    name: typeof m.name === "string" ? m.name : "家人",
    role: typeof m.role === "string" ? m.role : "",
    birthday: typeof m.birthday === "string" ? m.birthday : "",
    avatar: typeof m.avatar === "string" ? m.avatar : "",
  }));
  result.todos = list("todos", initial.todos)
    .filter((t) => typeof t.text === "string")
    .map((t) => ({ ...t, done: !!t.done }));
  result.photos = list("photos", seedPhotos)
    .filter((p) => typeof p.title === "string" && (p.src || p.mediaKey))
    .map((p) => {
      let petIds = Array.isArray(p.petIds)
        ? p.petIds.filter((id) => ["qiu", "dou"].includes(id))
        : p.tag === "球球" || p.tag === "豆米"
          ? ["qiu"]
          : p.tag === "豆豆" || p.tag === "豆糕"
            ? ["dou"]
            : p.tag === "一起"
              ? ["qiu", "dou"]
              : [];
      return {
        ...p,
        petIds,
        tag:
          p.tag === "球球"
            ? "豆米"
            : p.tag === "豆豆"
              ? "豆糕"
              : p.tag || "一起",
      };
    });
  result.notes = list("notes")
    .filter((n) => typeof n.title === "string")
    .map((n) => ({
      ...n,
      body: typeof n.body === "string" ? n.body : "",
      date: n.date || localDate(n.createdAt || new Date()),
      mood: n.mood || "平静",
      petIds: Array.isArray(n.petIds) ? n.petIds : [],
      photoIds: Array.isArray(n.photoIds) ? n.photoIds : [],
      tags: Array.isArray(n.tags) ? n.tags : [],
    }));
  result.videos = list("videos");
  result.editorDrafts = list("editorDrafts").filter(
    (d) =>
      d.settings &&
      typeof d.settings === "object" &&
      !Array.isArray(d.settings) &&
      typeof d.photoId === "string",
  );
  result.checkins = {};
  if (
    old.checkins &&
    typeof old.checkins === "object" &&
    !Array.isArray(old.checkins)
  )
    for (const [key, marks] of Object.entries(old.checkins)) {
      if (
        !/^(qiu|dou):\d{4}-\d{2}-\d{2}$/.test(key) ||
        !marks ||
        typeof marks !== "object"
      )
        continue;
      result.checkins[key] = Object.fromEntries(
        careTypes
          .filter(
            (t) =>
              typeof marks[t.id] === "string" &&
              Number.isFinite(Date.parse(marks[t.id])),
          )
          .map((t) => [t.id, marks[t.id]]),
      );
    }
  return result;
}
export const uid = () =>
  crypto.randomUUID?.() ||
  `${Date.now()}-${Math.random().toString(16).slice(2)}`;
export function useFamilyStore() {
  const [storageError, setStorageError] = useState("");
  const [state, setState] = useState(() => {
    try {
      const old = JSON.parse(localStorage.getItem("bunny-cinema-v1"));
      return migrateState(old);
    } catch {}
    return structuredClone(initial);
  });
  useEffect(()=>{
    setState(previous=>previous.schemaVersion!==2||previous.petNamesRevision!==1?migrateState(previous):previous);
  },[]);
  useEffect(() => {
    try {
      localStorage.setItem("bunny-cinema-v1", JSON.stringify(state));
      setStorageError("");
    } catch {
      setStorageError(
        "本机存储空间不足，当前改动暂未保存。请保留页面并释放空间。",
      );
    }
  }, [state]);
  return [state, setState, storageError];
}
export const careKey = (petId, date = localDate()) => `${petId}:${date}`;
export const careCount = (state, petId, date = localDate()) =>
  careTypes.filter((t) => !!state.checkins[careKey(petId, date)]?.[t.id])
    .length;
export function streak(state, petId) {
  let count = 0;
  const d = new Date();
  if (careCount(state, petId) < 4) d.setDate(d.getDate() - 1);
  for (let i = 0; i < 3660; i++) {
    if (careCount(state, petId, localDate(d)) !== 4) break;
    count++;
    d.setDate(d.getDate() - 1);
  }
  return count;
}
export const daysUntil = (date) => {
  if (!date) return null;
  const d = new Date(`${date}T00:00:00`);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((d - now) / 86400000);
};
export function birthdayCountdown(birthday) {
  if (!birthday) return null;
  const source = new Date(`${birthday}T00:00:00`);
  if (Number.isNaN(+source)) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const candidate = (y) => {
    const month = source.getMonth();
    const day = Math.min(source.getDate(), new Date(y, month + 1, 0).getDate());
    return new Date(y, month, day);
  };
  let next = candidate(now.getFullYear());
  if (next < now) next = candidate(now.getFullYear() + 1);
  return Math.round((next - now) / 86400000);
}
export function ageLabel(birthday) {
  if (!birthday) return "年龄待填写";
  const d = new Date(`${birthday}T00:00:00`);
  const now = new Date();
  let months =
    (now.getFullYear() - d.getFullYear()) * 12 + now.getMonth() - d.getMonth();
  if (now.getDate() < d.getDate()) months--;
  if (months < 0) return "年龄待填写";
  return months >= 12
    ? `${Math.floor(months / 12)} 岁 ${months % 12} 个月`
    : `${months} 个月`;
}
