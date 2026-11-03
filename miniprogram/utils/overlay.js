// Wait for native drawing surfaces to leave the view layer before showing a mask.
// Owners are component instances; a hidden page cannot release another page's mask.
const owners = new Map();
const listeners = new Set();
function publish(done) {
  const callbacks = Array.from(listeners);
  let remaining = callbacks.length;
  if (!remaining) { if (done) done(); return; }
  callbacks.forEach(listener => {
    let settled = false;
    const acknowledge = () => {
      if (settled) return;
      settled = true;
      if (--remaining === 0 && done) done();
    };
    try { listener(owners.size > 0, acknowledge); } catch (error) { acknowledge(); }
  });
}
function open(owner, ready) {
  const token = {};
  owners.set(owner, token);
  publish(() => { if (owners.get(owner) === token && ready) ready(); });
}
function close(owner) { if (owners.delete(owner)) publish(); }
function subscribe(listener) {
  listeners.add(listener);
  listener(owners.size > 0, () => {});
  return () => listeners.delete(listener);
}
module.exports = { open, close, subscribe, active: () => owners.size > 0 };
