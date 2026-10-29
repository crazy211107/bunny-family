export const newHistory = (value) => ({
  past: [],
  present: structuredClone(value),
  future: [],
});
export function commitHistory(history, value) {
  if (JSON.stringify(history.present) === JSON.stringify(value)) return history;
  return {
    past: [...history.past, structuredClone(history.present)].slice(-30),
    present: structuredClone(value),
    future: [],
  };
}
export function undoHistory(history) {
  if (!history.past.length) return history;
  return {
    past: history.past.slice(0, -1),
    present: structuredClone(history.past.at(-1)),
    future: [structuredClone(history.present), ...history.future].slice(0, 30),
  };
}
export function redoHistory(history) {
  if (!history.future.length) return history;
  return {
    past: [...history.past, structuredClone(history.present)].slice(-30),
    present: structuredClone(history.future[0]),
    future: history.future.slice(1),
  };
}
