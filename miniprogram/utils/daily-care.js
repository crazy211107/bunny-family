// 四项基础照顾直接复用兔兔档案的 checkins，不新增一套完成状态。
const store = require("./store");
const planner = require("./planner");
function snapshot(state, day, filters) {
  const options = filters || {},
    pets = Array.isArray(state.pets) ? state.pets : [];
  const all = pets.reduce(
    (items, pet) =>
      items.concat(
        store.careTypes.map((type) => {
          const recordedAt =
            ((state.checkins || {})[store.careKey(pet.id, day)] || {})[
              type.id
            ] || "";
          const date = new Date(recordedAt);
          return {
            id: pet.id + "|" + type.id,
            petId: pet.id,
            petName: pet.name,
            photo: pet.photo,
            type: type.id,
            label: type.label,
            done: !!recordedAt,
            recordedAt,
            time:
              recordedAt && Number.isFinite(+date)
                ? String(date.getHours()).padStart(2, "0") +
                  ":" +
                  String(date.getMinutes()).padStart(2, "0")
                : "",
          };
        }),
      ),
    [],
  );
  return {
    total: all.length,
    done: all.filter((row) => row.done).length,
    rows: all.filter(
      (row) =>
        (!options.petId ||
          options.petId === "all" ||
          row.petId === options.petId) &&
        (!options.status ||
          options.status === "all" ||
          (options.status === "done" ? row.done : !row.done)),
    ),
  };
}
function apply(state, day, keys, remove) {
  if (
    !Number.isFinite(planner.daysBetween(store.date(), day)) ||
    day !== store.date()
  )
    throw new Error("这一天只供回看，照顾打卡留给今天。");
  const ids = Array.from(new Set(Array.isArray(keys) ? keys : []));
  const all = snapshot(state, day).rows;
  const rows = ids.map((id) => {
    const row = all.find((item) => item.id === id);
    if (!row) throw new Error("事项已经变化，请重新选择。");
    return row;
  });
  const now = new Date().toISOString();
  state.checkins = state.checkins || {};
  rows.forEach((row) => {
    const key = store.careKey(row.petId, day),
      marks = Object.assign({}, state.checkins[key]);
    if (remove) delete marks[row.type];
    else if (!marks[row.type]) marks[row.type] = now;
    state.checkins[key] = marks;
  });
  return state;
}
function report(state, day, filters) {
  const pack = snapshot(state, day, filters);
  return (
    day +
    " · 兔兔照顾小票\n" +
    pack.rows
      .map(
        (row) =>
          row.petName +
          " · " +
          row.label +
          "：" +
          (row.done ? "已记录" + (row.time ? " " + row.time : "") : "未记录"),
      )
      .join("\n") +
    "\n未记录不代表没有照顾；记录时间为本机打卡时间。"
  );
}
module.exports = { snapshot, apply, report };
