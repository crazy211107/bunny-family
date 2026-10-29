const planner = require("./planner");
const store = require("./store");
const validDate = (value) =>
  typeof value === "string" &&
  Number.isFinite(planner.daysBetween(value, value));

function weekly(state, selected, today) {
  const start = planner.weekStart(selected),
    end = planner.addDays(start, 6);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = planner.addDays(start, index);
    return {
      date,
      label: "一二三四五六日"[index],
      number: Number(date.slice(8)),
      future: date > today,
    };
  });
  const elapsed = days.filter((day) => !day.future).length;
  const pets = (state.pets || []).map((pet) => {
    const marks = days.map((day) =>
      Object.assign({}, day, {
        count: day.future ? 0 : store.careCount(state, pet.id, day.date),
      }),
    );
    const count = marks.reduce((sum, day) => sum + day.count, 0);
    const weights = (pet.weights || [])
      .filter(
        (item) =>
          validDate(item.date) &&
          item.date >= start &&
          item.date <= end &&
          item.date <= today &&
          Number.isFinite(Number(item.kg)) &&
          Number(item.kg) > 0,
      )
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date));
    const first = weights[0],
      last = weights[weights.length - 1];
    const delta =
      weights.length >= 2
        ? Math.round((Number(last.kg) - Number(first.kg)) * 1000) / 1000
        : null;
    return {
      id: pet.id,
      name: pet.name,
      photo: pet.photo,
      count,
      total: elapsed * 4,
      completeDays: marks.filter((day) => !day.future && day.count === 4)
        .length,
      marks,
      weightText:
        delta === null
          ? "本周至少记录两次体重后显示变化"
          : first.date.slice(5) +
            " → " +
            last.date.slice(5) +
            "：" +
            (delta > 0 ? "+" : "") +
            delta +
            " kg",
      weightHint: delta === null ? "" : "仅展示记录差值，不作健康判断",
    };
  });
  const inWeek = (day) =>
    validDate(day) && day >= start && day <= end && day <= today;
  const photos = (state.photos || []).filter(
    (photo) => !photo.trashedAt && inWeek(photo.date),
  );
  const notes = (state.notes || []).filter(
    (note) =>
      !note.trashedAt &&
      inWeek(note.date || (note.createdAt ? store.date(note.createdAt) : "")),
  );
  const planDone = Object.keys(state.planLogs || {}).filter(
    (key) =>
      inWeek(key.slice(-10)) &&
      state.planLogs[key] &&
      state.planLogs[key].completedAt,
  ).length;
  const count = pets.reduce((sum, pet) => sum + pet.count, 0),
    total = pets.reduce((sum, pet) => sum + pet.total, 0);
  return {
    start,
    end,
    elapsed,
    days,
    pets,
    count,
    total,
    planDone,
    photoCount: photos.length,
    noteCount: notes.length,
    memories: photos.slice(0, 4),
    canNext: start < planner.weekStart(today),
    label:
      start.slice(5).replace("-", ".") + " — " + end.slice(5).replace("-", "."),
    progress: total ? Math.round((count / total) * 100) : 0,
  };
}

function handover(state, today) {
  const info = Object.assign(
    {
      contactName: "",
      contactPhone: "",
      clinic: "",
      clinicPhone: "",
      note: "",
      petNotes: {},
    },
    state.handover || {},
  );
  const pets = (state.pets || []).map((pet) => ({
    id: pet.id,
    name: pet.name,
    photo: pet.photo,
    note: (info.petNotes || {})[pet.id] || "",
    marks: store.careTypes.map((type) => ({
      label: type.label,
      done: !!((state.checkins || {})[store.careKey(pet.id, today)] || {})[
        type.id
      ],
    })),
  }));
  const plans = [];
  for (let i = 0; i < 3; i++) {
    const date = planner.addDays(today, i);
    planner
      .occurrences(state, date)
      .filter((plan) => !plan.done)
      .forEach((plan) =>
        plans.push({
          id: plan.id + ":" + date,
          title: plan.title,
          day: date,
          time: plan.time || "时间灵活",
          assignee: plan.assigneeName,
          pets: plan.petNames,
          note: plan.note || "",
        }),
      );
  }
  const low = (state.supplies || []).filter(
    (item) =>
      Number.isFinite(Number(item.quantity)) &&
      Number(item.quantity) <= Number(item.threshold),
  );
  const reminders = [];
  (state.pets || []).forEach((pet) =>
    (pet.reminders || []).forEach((item) => {
      const due = planner.daysBetween(today, item.date);
      if (Number.isFinite(due) && due <= 3)
        reminders.push({
          id: item.id,
          title: item.title,
          pet: pet.name,
          date: item.date,
          due:
            due < 0
              ? "逾期 " + -due + " 天"
              : due === 0
                ? "今天"
                : due + " 天后",
        });
    }),
  );
  reminders.sort((a, b) => a.date.localeCompare(b.date));
  return { info, pets, plans, low, reminders };
}

function handoverText(data, day) {
  const lines = ["豆米与豆糕 · 照顾交接卡", "更新于 " + day, ""];
  data.pets.forEach((pet) => {
    lines.push(
      pet.name +
        "：" +
        pet.marks
          .map((mark) => mark.label + (mark.done ? "已完成" : "待照顾"))
          .join(" / "),
    );
    if (pet.note) lines.push("照顾说明：" + pet.note);
  });
  lines.push("", "未来三天待办");
  data.plans.forEach((plan) =>
    lines.push(
      plan.day +
        " " +
        plan.time +
        " · " +
        plan.title +
        " · " +
        plan.pets +
        " · " +
        plan.assignee +
        (plan.note ? "\n说明：" + plan.note : ""),
    ),
  );
  if (!data.plans.length) lines.push("尚未安排照顾日程");
  data.reminders.forEach((item) =>
    lines.push(
      item.pet +
        " · " +
        item.title +
        " · " +
        item.date +
        "（" +
        item.due +
        "）",
    ),
  );
  data.low.forEach((item) =>
    lines.push(
      "需补给：" + item.name + "，余 " + item.quantity + " " + item.unit,
    ),
  );
  if (data.info.contactName || data.info.contactPhone)
    lines.push(
      "",
      "联系家人：" +
        [data.info.contactName, data.info.contactPhone]
          .filter(Boolean)
          .join(" "),
    );
  if (data.info.clinic || data.info.clinicPhone)
    lines.push(
      "常去医院：" +
        [data.info.clinic, data.info.clinicPhone].filter(Boolean).join(" "),
    );
  if (data.info.note) lines.push("", "交接留言：" + data.info.note);
  lines.push("", "这是本机记录的快照，完成状态以更新日期为准。");
  return lines.join("\n");
}

module.exports = { weekly, handover, handoverText };
