import { JSDOM } from "jsdom";
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://isolated-ui.invalid/",
});
for (const key of [
  "window",
  "document",
  "HTMLElement",
  "HTMLInputElement",
  "HTMLTextAreaElement",
  "Element",
  "Node",
  "NodeFilter",
  "DocumentFragment",
  "MutationObserver",
  "CustomEvent",
  "Event",
  "MouseEvent",
  "KeyboardEvent",
  "localStorage",
  "getComputedStyle",
])
  Object.defineProperty(globalThis, key, {
    configurable: true,
    value:
      key === "getComputedStyle"
        ? dom.window.getComputedStyle.bind(dom.window)
        : dom.window[key],
  });
Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: dom.window.navigator,
});
for (const key of Object.getOwnPropertyNames(dom.window).filter((key) =>
  /^(HTML|SVG)/.test(key),
))
  Object.defineProperty(globalThis, key, {
    configurable: true,
    value: dom.window[key],
  });
const matchMedia = (query) => ({
  matches: false,
  media: query,
  addListener() {},
  removeListener() {},
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent() {
    return false;
  },
});
globalThis.matchMedia = matchMedia;
window.matchMedia = matchMedia;
globalThis.requestAnimationFrame = (callback) =>
  setTimeout(() => callback(Date.now()), 0);
globalThis.cancelAnimationFrame = clearTimeout;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
globalThis.PointerEvent = dom.window.MouseEvent;
HTMLElement.prototype.scrollIntoView = function () {};
HTMLElement.prototype.hasPointerCapture = () => false;
HTMLElement.prototype.setPointerCapture = function () {};
HTMLElement.prototype.releasePointerCapture = function () {};
Object.defineProperty(navigator, "clipboard", {
  value: {
    writeText: async (text) => {
      globalThis.__copied = text;
    },
  },
  configurable: true,
});
globalThis.fetch = async () => {
  throw new Error("No real network is allowed in this fixture.");
};
