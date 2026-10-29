// Calendar arithmetic uses UTC day numbers; visible dates stay local YYYY-MM-DD strings.
const DAY = 86400000;
function dayNumber(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return NaN;
  const parts = value.split("-").map(Number);
  if (parts[0] < 1 || parts[0] > 9999) return NaN;
  const day = new Date(0);
  day.setUTCHours(0, 0, 0, 0);
  day.setUTCFullYear(parts[0], parts[1] - 1, parts[2]);
  if (
    day.getUTCFullYear() !== parts[0] ||
    day.getUTCMonth() !== parts[1] - 1 ||
    day.getUTCDate() !== parts[2]
  )
    return NaN;
  return day.getTime() / DAY;
}
function fromDay(number) {
  if (!Number.isFinite(number)) return "";
  const day = new Date(number * DAY);
  if (!Number.isFinite(day.getTime())) return "";
  const year = day.getUTCFullYear();
  return year < 1 || year > 9999
    ? ""
    : [
        String(year).padStart(4, "0"),
        String(day.getUTCMonth() + 1).padStart(2, "0"),
        String(day.getUTCDate()).padStart(2, "0"),
      ].join("-");
}
function addDays(value, amount) {
  return Number.isInteger(amount) ? fromDay(dayNumber(value) + amount) : "";
}
function daysBetween(from, to) {
  return dayNumber(to) - dayNumber(from);
}
function weekday(value) {
  const number = dayNumber(value);
  return Number.isFinite(number) ? new Date(number * DAY).getUTCDay() || 7 : 0;
}
function weekStart(value) {
  return addDays(value, 1 - weekday(value));
}
function isDue(plan, value) {
  if (!plan || plan.enabled === false || plan.archivedAt) return false;
  const difference = daysBetween(plan.startDate, value);
  if (!Number.isFinite(difference) || difference < 0) return false;
  if (plan.rule === "once") return difference === 0;
  if (plan.rule === "daily") return true;
  if (plan.rule === "weekly") {
    const days = Array.isArray(plan.weekdays)
      ? plan.weekdays.filter((n) => Number.isInteger(n) && n >= 1 && n <= 7)
      : [];
    return (
      (days.length ? days : [weekday(plan.startDate)]).indexOf(
        weekday(value),
      ) >= 0
    );
  }
  const interval = Number(plan.intervalDays);
  return (
    plan.rule === "interval" &&
    Number.isInteger(interval) &&
    interval > 0 &&
    difference % interval === 0
  );
}
function occurrences(state, value) {
  const members = Array.isArray(state.members) ? state.members : [];
  const pets = Array.isArray(state.pets) ? state.pets : [];
  const logs = state.planLogs || {};
  return (Array.isArray(state.carePlans) ? state.carePlans : [])
    .filter((plan) => isDue(plan, value))
    .map((plan) => {
      const member = members.find((item) => item.id === plan.assigneeId);
      const selectedPets = pets.filter(
        (pet) => (plan.petIds || []).indexOf(pet.id) >= 0,
      );
      const log = logs[plan.id + ":" + value];
      return Object.assign({}, plan, {
        day: value,
        done: !!(log && log.completedAt),
        completedAt: (log && log.completedAt) || "",
        assigneeName: member
          ? member.name
          : plan.assigneeId
            ? "原成员已移除"
            : "家人一起",
        petNames: selectedPets.map((pet) => pet.name).join("、") || "我们家",
      });
    })
    .sort(
      (a, b) =>
        (a.time || "99:99").localeCompare(b.time || "99:99") ||
        a.title.localeCompare(b.title),
    );
}
module.exports = { addDays, daysBetween, isDue, occurrences, weekStart };
