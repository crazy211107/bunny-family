export const W = 450;
export const H = 500;

export const templates = [
  { id: "polaroid", name: "拍立得", color: "#fffbf5" },
  { id: "tape", name: "胶带拼贴", color: "#f4e5d5" },
  { id: "comic", name: "四格镜头", color: "#fff0e0" },
  { id: "journal", name: "手账贴纸", color: "#dcebdc" },
  { id: "exposure", name: "双重叠影", color: "#f1dce6" },
  { id: "mirror", name: "镜像贴贴", color: "#f1e4ef" },
  { id: "dots", name: "波点漏光", color: "#ffe5c4" },
  { id: "date", name: "日期拍立得", color: "#fff4d7" },
];

export const fontOptions = [
  { name: "手写小楷", value: '"KaiTi","STKaiti",serif' },
  { name: "软软圆体", value: '"YouYuan","Microsoft YaHei",sans-serif' },
  { name: "文艺手记", value: '"STXingkai","KaiTi",cursive' },
];

function number(value, fallback, min, max) {
  const candidate = Number(value);
  return Number.isFinite(candidate)
    ? Math.max(min, Math.min(max, candidate))
    : fallback;
}

function validImage(image) {
  return (
    image &&
    Number(image.naturalWidth || image.width) > 0 &&
    Number(image.naturalHeight || image.height) > 0
  );
}

function round(context, x, y, width, height, radius = 8) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

function cover(context, image, x, y, width, height, offset = 0) {
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const drawnWidth = sourceWidth * scale;
  const drawnHeight = sourceHeight * scale;
  const horizontalRoom = (drawnWidth - width) / 2;
  const safeOffset = Math.max(
    -horizontalRoom,
    Math.min(horizontalRoom, offset),
  );
  context.save();
  context.beginPath();
  context.rect(x, y, width, height);
  context.clip();
  context.drawImage(
    image,
    x + (width - drawnWidth) / 2 + safeOffset,
    y + (height - drawnHeight) / 2,
    drawnWidth,
    drawnHeight,
  );
  context.restore();
}

function photoPolygon(x, y, width, height, rotation = 0) {
  const points = [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ];
  if (!rotation) return points;
  return points.map((point) => {
    const dx = point.x - 225;
    const dy = point.y - 215;
    return {
      x: 225 + dx * Math.cos(rotation) - dy * Math.sin(rotation),
      y: 215 + dx * Math.sin(rotation) + dy * Math.cos(rotation),
    };
  });
}

function clipPhotos(context, areas) {
  context.beginPath();
  areas.forEach((area) => {
    context.moveTo(area[0].x, area[0].y);
    area.slice(1).forEach((point) => context.lineTo(point.x, point.y));
    context.closePath();
  });
  context.clip();
}

function drawSticker(context, sticker) {
  context.save();
  context.translate(sticker.x, sticker.y);
  context.rotate((sticker.rotation * Math.PI) / 180);
  context.scale(sticker.scale, sticker.scale);
  context.lineWidth = 2.4;
  context.strokeStyle = "#6b5b73";
  context.lineJoin = "round";
  if (sticker.type === "ears") {
    context.fillStyle = "#fff9f0";
    context.beginPath();
    context.ellipse(-15, -13, 12, 38, -0.2, 0, Math.PI * 2);
    context.ellipse(15, -13, 12, 38, 0.2, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.fillStyle = "#ffc4da";
    context.beginPath();
    context.ellipse(-15, -17, 4, 24, -0.2, 0, Math.PI * 2);
    context.ellipse(15, -17, 4, 24, 0.2, 0, Math.PI * 2);
    context.fill();
  } else if (sticker.type === "carrot") {
    context.fillStyle = "#ffc28f";
    context.beginPath();
    context.moveTo(-14, -15);
    context.quadraticCurveTo(2, -22, 15, -13);
    context.lineTo(-1, 30);
    context.closePath();
    context.fill();
    context.stroke();
    context.strokeStyle = "#96b699";
    context.lineWidth = 5;
    context.beginPath();
    context.moveTo(0, -16);
    context.lineTo(-8, -30);
    context.moveTo(0, -16);
    context.lineTo(4, -34);
    context.moveTo(0, -16);
    context.lineTo(15, -26);
    context.stroke();
  } else if (sticker.type === "heart") {
    context.fillStyle = "#ffd9e8";
    context.beginPath();
    context.moveTo(0, 22);
    context.bezierCurveTo(-50, -10, -15, -40, 0, -15);
    context.bezierCurveTo(15, -40, 50, -10, 0, 22);
    context.fill();
    context.stroke();
  } else {
    context.fillStyle = "#ffe9a8";
    context.beginPath();
    for (let i = 0; i < 10; i++) {
      const angle = (i * Math.PI) / 5 - Math.PI / 2;
      const radius = i % 2 ? 13 : 28;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (i) context.lineTo(x, y);
      else context.moveTo(x, y);
    }
    context.closePath();
    context.fill();
    context.stroke();
  }
  context.restore();
}

function makeSnapshot(canvas) {
  let snapshot;
  if (canvas.ownerDocument?.createElement)
    snapshot = canvas.ownerDocument.createElement("canvas");
  else if (typeof OffscreenCanvas !== "undefined")
    snapshot = new OffscreenCanvas(canvas.width, canvas.height);
  else {
    try {
      snapshot = new canvas.constructor(canvas.width, canvas.height);
    } catch {
      throw new Error("当前环境无法创建照片取样画布");
    }
  }
  snapshot.width = canvas.width;
  snapshot.height = canvas.height;
  const context = snapshot.getContext("2d");
  if (!context) throw new Error("照片取样画布暂不可用");
  context.drawImage(canvas, 0, 0);
  return snapshot;
}

function cleanStrokes(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 200).flatMap((stroke) => {
    if (
      !stroke ||
      !["marker", "highlight", "dash", "mosaic"].includes(stroke.tool) ||
      !Array.isArray(stroke.points)
    )
      return [];
    const points = stroke.points
      .slice(0, 2400)
      .filter(
        (point) =>
          point && Number.isFinite(point.x) && Number.isFinite(point.y),
      )
      .map((point) => ({
        x: Math.max(0, Math.min(W, point.x)),
        y: Math.max(0, Math.min(H, point.y)),
      }));
    if (!points.length) return [];
    return [
      {
        tool: stroke.tool,
        color: /^#(?:[\da-f]{3}|[\da-f]{6}|[\da-f]{8})$/i.test(
          stroke.color || "",
        )
          ? stroke.color
          : "#b77894",
        width: number(stroke.width, 12, 1, 64),
        points,
      },
    ];
  });
}

function drawMosaic(context, snapshot, stroke) {
  const block = Math.max(8, Math.min(22, Math.round(stroke.width / 2)));
  const radius = Math.max(stroke.width / 2, block / 2);
  const tiles = new Set();
  const addTiles = (point) => {
    for (
      let row = Math.max(0, Math.floor((point.y - radius) / block));
      row <=
      Math.min(
        Math.ceil(H / block) - 1,
        Math.floor((point.y + radius) / block),
      );
      row++
    ) {
      for (
        let column = Math.max(0, Math.floor((point.x - radius) / block));
        column <=
        Math.min(
          Math.ceil(W / block) - 1,
          Math.floor((point.x + radius) / block),
        );
        column++
      ) {
        const dx = column * block + block / 2 - point.x;
        const dy = row * block + block / 2 - point.y;
        if (Math.hypot(dx, dy) <= radius + block * 0.6)
          tiles.add(`${column}:${row}`);
      }
    }
  };
  addTiles(stroke.points[0]);
  for (let i = 1; i < stroke.points.length; i++) {
    const previous = stroke.points[i - 1];
    const current = stroke.points[i];
    const steps = Math.max(
      1,
      Math.ceil(
        Math.hypot(current.x - previous.x, current.y - previous.y) /
          Math.max(3, radius / 2),
      ),
    );
    for (let step = 1; step <= steps; step++)
      addTiles({
        x: previous.x + ((current.x - previous.x) * step) / steps,
        y: previous.y + ((current.y - previous.y) * step) / steps,
      });
  }
  context.imageSmoothingEnabled = false;
  tiles.forEach((tile) => {
    const [column, row] = tile.split(":").map(Number);
    const x = column * block;
    const y = row * block;
    // Always sample the immutable photograph layer, before any ink or mosaic.
    const sx = Math.min(W - 1, x + block / 2) * 2;
    const sy = Math.min(H - 1, y + block / 2) * 2;
    context.drawImage(snapshot, sx, sy, 2, 2, x, y, block, block);
  });
}

function drawStrokes(context, strokes, areas, snapshot) {
  strokes.forEach((stroke) => {
    context.save();
    clipPhotos(context, areas);
    if (stroke.tool === "mosaic") drawMosaic(context, snapshot, stroke);
    else {
      context.strokeStyle = stroke.color;
      context.fillStyle = stroke.color;
      context.lineWidth = stroke.width;
      context.lineCap = "round";
      context.lineJoin = "round";
      context.globalAlpha = stroke.tool === "highlight" ? 0.3 : 1;
      if (stroke.tool === "dash")
        context.setLineDash([stroke.width * 1.7, stroke.width * 1.3]);
      context.beginPath();
      const first = stroke.points[0];
      if (stroke.points.length === 1) {
        context.arc(first.x, first.y, stroke.width / 2, 0, Math.PI * 2);
        context.fill();
      } else {
        context.moveTo(first.x, first.y);
        stroke.points
          .slice(1)
          .forEach((point) => context.lineTo(point.x, point.y));
        context.stroke();
      }
    }
    context.restore();
  });
}

function cleanStickers(value) {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, 32)
    .filter(
      (sticker) =>
        sticker && ["ears", "carrot", "heart", "star"].includes(sticker.type),
    )
    .map((sticker) => ({
      ...sticker,
      x: number(sticker.x, W / 2, 0, W),
      y: number(sticker.y, H / 2, 0, H),
      scale: number(sticker.scale, 1, 0.25, 4),
      rotation: number(sticker.rotation, 0, -360, 360),
    }));
}

export function renderArtwork(
  canvas,
  primaryImage,
  settings = {},
  selectedId = null,
  images = {},
) {
  if (!canvas?.getContext || !validImage(primaryImage))
    throw new Error("照片还未准备好，请重新选择照片");
  settings = settings && typeof settings === "object" ? settings : {};
  images = images && typeof images === "object" ? images : {};
  canvas.width = W * 2;
  canvas.height = H * 2;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("当前环境无法打开照片画布");
  context.scale(2, 2);
  const meta =
    templates.find((item) => item.id === settings.template) || templates[0];
  const template = meta.id;
  const filter = `brightness(${number(settings.brightness, 100, 30, 180)}%) contrast(${number(settings.contrast, 100, 30, 180)}%) saturate(${number(settings.saturation, 100, 0, 220)}%)`;
  const stickers = cleanStickers(settings.stickers);
  const strokes = cleanStrokes(settings.strokes);
  const slots = Array.isArray(settings.photoSlots)
    ? settings.photoSlots.slice(0, 4)
    : [];
  const imageFor = (id) => (validImage(images[id]) ? images[id] : primaryImage);
  const photoAreas = [];
  context.fillStyle = meta.color;
  context.fillRect(0, 0, W, H);
  context.strokeStyle = "#d9ccd0";
  context.lineWidth = 1;
  round(context, 9, 9, W - 18, H - 18, 5);
  context.stroke();
  const photo = (image, x, y, width, height, offset = 0) => {
    context.save();
    context.filter = filter;
    cover(context, image, x, y, width, height, offset);
    context.restore();
  };

  if (template === "comic") {
    for (let i = 0; i < 4; i++) {
      const x = 23 + (i % 2) * 206;
      const y = 29 + Math.floor(i / 2) * 183;
      photo(imageFor(slots[i]), x, y, 198, 175);
      photoAreas.push(photoPolygon(x, y, 198, 175));
    }
  } else if (template === "mirror") {
    context.save();
    context.beginPath();
    context.rect(25, 35, 400, 352);
    context.clip();
    photo(primaryImage, 25, 35, 200, 352);
    context.translate(W, 0);
    context.scale(-1, 1);
    photo(primaryImage, 25, 35, 200, 352);
    context.restore();
    photoAreas.push(photoPolygon(25, 35, 400, 352));
  } else {
    if (template === "tape") {
      context.save();
      context.translate(225, 215);
      context.rotate(-0.035);
      context.fillStyle = "#fff9f0";
      context.shadowColor = "#6b5b7330";
      context.shadowBlur = 12;
      context.fillRect(-204, -186, 408, 382);
      context.shadowBlur = 0;
      context.translate(-225, -215);
      photo(primaryImage, 30, 37, 390, 356);
      context.restore();
      photoAreas.push(photoPolygon(30, 37, 390, 356, -0.035));
    } else {
      photo(primaryImage, 25, 35, 400, 352);
      photoAreas.push(photoPolygon(25, 35, 400, 352));
    }
    if (template === "exposure") {
      context.save();
      context.globalAlpha = 0.3;
      context.globalCompositeOperation = "screen";
      photo(
        imageFor(settings.secondaryId),
        25,
        35,
        400,
        352,
        settings.secondaryId ? 0 : -20,
      );
      context.restore();
    }
    if (template === "dots") {
      context.save();
      context.fillStyle = "#fff9f0";
      for (let x = 7; x < W; x += 26) {
        for (let y = 8; y < H; y += 26) {
          if (y < 30 || y > 391 || x < 22 || x > 427) {
            context.beginPath();
            context.arc(x, y, 3, 0, Math.PI * 2);
            context.fill();
          }
        }
      }
      const leak = context.createLinearGradient(20, 0, 425, 0);
      leak.addColorStop(0, "#ffc28f80");
      leak.addColorStop(0.4, "#ffe4d600");
      leak.addColorStop(1, "#ffd9e860");
      context.fillStyle = leak;
      context.fillRect(25, 35, 400, 352);
      context.restore();
    }
  }

  // Freeze the photograph layer once. Mosaic never reads back modified ink.
  const snapshot = strokes.some((stroke) => stroke.tool === "mosaic")
    ? makeSnapshot(canvas)
    : null;
  drawStrokes(context, strokes, photoAreas, snapshot);

  if (template === "comic") {
    for (let i = 0; i < 4; i++) {
      const x = 23 + (i % 2) * 206;
      const y = 29 + Math.floor(i / 2) * 183;
      context.fillStyle = "#fff9f0";
      round(context, x + 6, y + 6, 34, 23, 5);
      context.fill();
      context.fillStyle = "#6b5b73";
      context.font = "12px sans-serif";
      context.fillText(`0${i + 1}`, x + 14, y + 22);
    }
  }
  if (["tape", "journal", "polaroid"].includes(template)) {
    context.save();
    context.translate(225, 28);
    context.rotate(-0.04);
    context.fillStyle = template === "journal" ? "#ffdfdccc" : "#ffd9e8d9";
    context.fillRect(-58, -10, 116, 24);
    context.fillStyle = "#fff9f0ba";
    for (let i = 0; i < 12; i++) {
      context.beginPath();
      context.arc(-51 + i * 10, -1, 1.6, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }

  context.fillStyle = "#6b5b73";
  context.textAlign = "center";
  const font =
    fontOptions.find((item) => item.value === settings.font)?.value ||
    fontOptions[0].value;
  context.font = `23px ${font}`;
  const title =
    typeof settings.title === "string" && settings.title.trim()
      ? settings.title.slice(0, 200)
      : "把这一刻，收进回忆里 ♡";
  let text = title;
  while (context.measureText(text).width > 398 && text.length > 1)
    text = text.slice(0, -2) + "…";
  context.fillText(text, W / 2, 431);
  context.font = "12px sans-serif";
  context.fillStyle = "#978496";
  const now = new Date();
  const defaultDate = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}.${String(now.getDate()).padStart(2, "0")}`;
  const date =
    typeof settings.date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(settings.date)
      ? settings.date.replaceAll("-", ".")
      : defaultDate;
  context.fillText(
    template === "date"
      ? `${date}  /  我们的小日子`
      : "兔兔小窝 · little things, big love",
    W / 2,
    462,
  );
  stickers.forEach((sticker) => drawSticker(context, sticker));
  const selected = selectedId
    ? stickers.find((sticker) => sticker.id === selectedId)
    : null;
  if (selected) {
    context.save();
    context.translate(selected.x, selected.y);
    context.rotate((selected.rotation * Math.PI) / 180);
    context.strokeStyle = "#b05f84";
    context.lineWidth = 1.2;
    context.setLineDash([4, 3]);
    context.strokeRect(
      -37 * selected.scale,
      -57 * selected.scale,
      74 * selected.scale,
      98 * selected.scale,
    );
    context.restore();
  }
  return canvas;
}
