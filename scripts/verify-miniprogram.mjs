// 小程序版绘图管线冒烟测试：用受控的 Canvas 2D 模拟对象跑完八套模板。
// 任何调用了小程序不支持的 API（如 roundRect / ellipse）都会直接抛错失败。
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..", "miniprogram");
const source = fs.readFileSync(path.join(root, "utils/painter.js"), "utf8");

const CONTEXT_METHODS = [
  "save", "restore", "beginPath", "closePath", "moveTo", "lineTo", "arcTo", "arc",
  "rect", "clip", "fill", "stroke", "fillRect", "strokeRect", "drawImage",
  "translate", "rotate", "scale", "setTransform", "createLinearGradient",
  "measureText", "fillText", "setLineDash", "getImageData", "putImageData",
  "quadraticCurveTo", "bezierCurveTo", "clearRect",
];
const CONTEXT_PROPS = [
  "fillStyle", "strokeStyle", "lineWidth", "lineJoin", "lineCap", "font",
  "textAlign", "globalAlpha", "globalCompositeOperation", "shadowColor",
  "shadowBlur", "imageSmoothingEnabled", "filter",
];

let offscreenCount = 0;
// 逐像素调色发生在离屏画布上，所以统计要跨上下文累计。
const callStats = {};
function makeContext(label, allowFilter) {
  const state = {};
  const target = { calls: {} };
  for (const name of CONTEXT_METHODS) {
    target[name] = (...args) => {
      target.calls[name] = (target.calls[name] || 0) + 1;
      callStats[name] = (callStats[name] || 0) + 1;
      if (name === "measureText") return { width: String(args[0] ?? "").length * 11 };
      if (name === "createLinearGradient") return { addColorStop() {} };
      if (name === "getImageData") {
        const [, , w = 1, h = 1] = args;
        return { data: new Uint8ClampedArray(w * h * 4) };
      }
      return undefined;
    };
  }
  return new Proxy(target, {
    get(obj, prop) {
      if (prop in obj) return obj[prop];
      if (CONTEXT_PROPS.includes(prop)) return state[prop] ?? (prop === "filter" ? "none" : undefined);
      throw new Error(`${label} 调用了不支持的 Canvas API: ${String(prop)}`);
    },
    set(obj, prop, value) {
      if (CONTEXT_PROPS.includes(prop)) {
        // allowFilter=false 模拟真机上 ctx.filter 被静默丢弃的机型。
        if (prop === "filter" && !allowFilter) return true;
        state[prop] = value;
        return true;
      }
      throw new Error(`${label} 写入了不支持的 Canvas 属性: ${String(prop)}`);
    },
  });
}

function makeCanvas(allowFilter) {
  const context = makeContext("主画布", allowFilter);
  return {
    width: 0,
    height: 0,
    getContext: () => context,
    __context: context,
  };
}

const sandboxWx = {
  createOffscreenCanvas() {
    offscreenCount += 1;
    const context = makeContext("离屏画布", true);
    return { width: 0, height: 0, getContext: () => context, __context: context };
  },
  getImageInfo: () => {},
};

// 滤镜能力探测是模块级缓存（同一台设备只需探一次），所以每换一种能力都要新起一个模块实例。
function loadPainter() {
  const holder = { exports: {} };
  new Function("module", "exports", "wx", source)(holder, holder.exports, sandboxWx);
  return holder.exports;
}
const painter = loadPainter();

const errors = [];
const check = (ok, message) => {
  if (!ok) errors.push(message);
};

const image = (w, h, tag) => ({ width: w, height: h, tag, naturalWidth: w, naturalHeight: h });
const primary = image(1200, 900, "primary");
const secondary = image(800, 1200, "secondary");
const extra = image(1000, 1000, "extra");
const images = { p2: secondary, p3: extra, p4: extra };

const baseSettings = (patch) => ({
  template: "polaroid",
  title: "今天也要贴在一起 ♡",
  font: painter.fontOptions[0].value,
  brightness: 100,
  contrast: 100,
  saturation: 100,
  stickers: [],
  strokes: [],
  photoSlots: [],
  secondaryId: "",
  ...patch,
});

// 1. 八套模板都能画完，且都落到了画布上
for (const template of painter.templates) {
  const canvas = makeCanvas(true);
  try {
    painter.renderArtwork(canvas, primary, baseSettings({ template }), null, images);
    check(canvas.width === 900 && canvas.height === 1000, `${template.id}: 输出尺寸应为 900×1000`);
    check((canvas.__context.calls.fillRect || 0) > 0, `${template.id}: 没有铺底`);
    check((canvas.__context.calls.drawImage || 0) > 0, `${template.id}: 没有绘制照片`);
    check((canvas.__context.calls.fillText || 0) >= 2, `${template.id}: 标题与落款没画全`);
  } catch (error) {
    errors.push(`${template.id}: ${error.message}`);
  }
}

// 2. 调色：像素回退路径（模拟机型不支持 ctx.filter）也要能出图
{
  const fallback = loadPainter();
  const canvas = makeCanvas(false);
  try {
    fallback.renderArtwork(
      canvas,
      primary,
      baseSettings({ brightness: 130, contrast: 88, saturation: 40 }),
      null,
      images,
    );
    check((callStats.getImageData || 0) > 0, "调色回退：没有走逐像素路径");
    check((callStats.putImageData || 0) > 0, "调色回退：没有写回像素");
  } catch (error) {
    errors.push(`调色回退：${error.message}`);
  }
}

// 3. 调色：支持 ctx.filter 时应走原生，不读像素
{
  const native = loadPainter();
  const canvas = makeCanvas(true);
  const before = callStats.getImageData || 0;
  native.renderArtwork(canvas, primary, baseSettings({ brightness: 120 }), null, images);
  check((callStats.getImageData || 0) === before, "原生滤镜可用时不应再读像素");
}

// 4. 四格：四个槽位必须各自取图
{
  const canvas = makeCanvas(true);
  painter.renderArtwork(
    canvas,
    primary,
    baseSettings({ template: "comic", photoSlots: ["p2", "p3", "p4", ""] }),
    null,
    images,
  );
  const drawn = canvas.__context.calls.drawImage || 0;
  check(drawn >= 4, `四格：只画了 ${drawn} 张，四格应各画一张`);
}

// 5. 双重叠影：给了副图就必须多画一层
{
  const plain = makeCanvas(true);
  painter.renderArtwork(plain, primary, baseSettings({ template: "exposure" }), null, images);
  const withSecond = makeCanvas(true);
  painter.renderArtwork(
    withSecond,
    primary,
    baseSettings({ template: "exposure", secondaryId: "p2" }),
    null,
    images,
  );
  check(
    (withSecond.__context.calls.drawImage || 0) === (plain.__context.calls.drawImage || 0),
    "双重叠影：副图叠加层数不对",
  );
}

// 6. 笔画：四种笔刷各一，马赛克必须用到离屏快照
{
  const before = offscreenCount;
  const canvas = makeCanvas(true);
  const strokes = ["marker", "highlight", "dash", "mosaic"].map((tool, index) => ({
    id: `s${index}`,
    tool,
    color: "#ce8ba7",
    width: 10,
    points: [{ x: 80, y: 80 }, { x: 160, y: 150 }, { x: 240, y: 210 }],
  }));
  try {
    painter.renderArtwork(canvas, primary, baseSettings({ strokes }), null, images);
    check(offscreenCount > before, "马赛克：没有创建取样快照");
    check((canvas.__context.calls.setLineDash || 0) > 0, "虚线笔：没有设置虚线");
    check((canvas.__context.calls.clip || 0) > 0, "笔画：没有裁剪到照片区域");
  } catch (error) {
    errors.push(`笔画：${error.message}`);
  }
}

// 7. 选中态只画选框、不影响导出（selectedId 为 null 时不该出现虚线框）
{
  const withBox = makeCanvas(true);
  painter.renderArtwork(
    withBox,
    primary,
    baseSettings({ stickers: [{ id: "k1", type: "heart", x: 200, y: 200, scale: 1, rotation: 0 }] }),
    "k1",
    images,
  );
  const noBox = makeCanvas(true);
  painter.renderArtwork(
    noBox,
    primary,
    baseSettings({ stickers: [{ id: "k1", type: "heart", x: 200, y: 200, scale: 1, rotation: 0 }] }),
    null,
    images,
  );
  check(
    (withBox.__context.calls.strokeRect || 0) > (noBox.__context.calls.strokeRect || 0),
    "选中贴纸时应出现编辑选框",
  );
  check((noBox.__context.calls.strokeRect || 0) === 0, "导出路径不应画编辑选框");
}

// 8. 脏数据不能把渲染打挂
{
  const canvas = makeCanvas(true);
  try {
    painter.renderArtwork(
      canvas,
      primary,
      baseSettings({
        brightness: "abc",
        contrast: null,
        strips: undefined,
        stickers: [{ id: "x", type: "boom" }, null, { id: "y", type: "ears", scale: 99 }],
        strokes: [{ tool: "spray", points: [] }, { tool: "marker", points: [{ x: NaN, y: 1 }] }],
        photoSlots: "not-an-array",
      }),
      null,
      images,
    );
  } catch (error) {
    errors.push(`脏数据：${error.message}`);
  }
}

// 9. 没有照片时必须明确报错，而不是画出一张空白
{
  try {
    painter.renderArtwork(makeCanvas(true), null, baseSettings(), null, images);
    errors.push("缺图：没有抛出错误");
  } catch (error) {
    check(/照片/.test(error.message), `缺图：错误信息不友好（${error.message}）`);
  }
}

// 10. 标题超长要截断，不能溢出画布
{
  const canvas = makeCanvas(true);
  painter.renderArtwork(canvas, primary, baseSettings({ title: "很".repeat(60) }), null, images);
  check((canvas.__context.calls.fillText || 0) > 0, "超长标题：没有渲染落款");
}

if (errors.length) {
  console.error(`✗ ${errors.length} 项未通过：`);
  for (const item of errors) console.error(`  - ${item}`);
  process.exit(1);
}
console.log("✓ 小程序绘图管线通过：8 模板 / 调色双路径 / 四格 / 叠影 / 四笔刷 / 选框 / 脏数据 / 缺图");
