// 兔兔小窝 · 照片工坊绘图管线（微信小程序 Canvas 2D 版）
// 逻辑画布 450×500，输出 900×1000。预览与导出共用同一函数。
const W = 450;
const H = 500;

const templates = [
  { id: 'polaroid', name: '拍立得', color: '#fffbf5' },
  { id: 'tape', name: '胶带拼贴', color: '#f4e5d5' },
  { id: 'comic', name: '四格镜头', color: '#fff0e0' },
  { id: 'journal', name: '手账贴纸', color: '#dcebdc' },
  { id: 'exposure', name: '双重叠影', color: '#f1dce6' },
  { id: 'mirror', name: '镜像贴贴', color: '#f1e4ef' },
  { id: 'dots', name: '波点漏光', color: '#ffe5c4' },
  { id: 'date', name: '日期拍立得', color: '#fff4d7' }
];

// canvas 字段是小程序 Canvas 2D 可解析的字体族，避免带引号的多重回退串被丢弃。
const fontOptions = [
  { name: '手写小楷', value: '"KaiTi","STKaiti",serif', canvas: '23px KaiTi' },
  { name: '软软圆体', value: '"YouYuan","Microsoft YaHei",sans-serif', canvas: '23px YouYuan' },
  { name: '文艺手记', value: '"STXingkai","KaiTi",cursive', canvas: '23px STXingkai' }
];

function number(value, fallback, min, max) {
  const candidate = Number(value);
  if (!isFinite(candidate)) return fallback;
  return Math.max(min, Math.min(max, candidate));
}

function sourceSize(image) {
  const w = Number(image && (image.width || image.naturalWidth)) || 0;
  const h = Number(image && (image.height || image.naturalHeight)) || 0;
  return { w: w, h: h };
}

function validImage(image) {
  const box = sourceSize(image);
  return box.w > 0 && box.h > 0;
}

// 小程序 Canvas 2D 没有可靠的 roundRect，这里用 arcTo 手绘。
function roundPath(context, x, y, width, height, radius) {
  const r = Math.max(0, Math.min(number(radius, 8, 0, 999), Math.min(width, height) / 2));
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
}

// 不调用 beginPath，便于一条路径里叠加多个椭圆（兔耳朵）。
function addEllipse(context, cx, cy, rx, ry, rotation) {
  const steps = 36;
  const cos = Math.cos(rotation || 0);
  const sin = Math.sin(rotation || 0);
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * Math.PI * 2;
    const px = Math.cos(angle) * rx;
    const py = Math.sin(angle) * ry;
    const x = cx + px * cos - py * sin;
    const y = cy + px * sin + py * cos;
    if (i) context.lineTo(x, y);
    else context.moveTo(x, y);
  }
  context.closePath();
}

function cover(context, source, sourceWidth, sourceHeight, x, y, width, height, offset) {
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const drawnWidth = sourceWidth * scale;
  const drawnHeight = sourceHeight * scale;
  const room = (drawnWidth - width) / 2;
  const safeOffset = Math.max(-room, Math.min(room, offset || 0));
  context.save();
  context.beginPath();
  context.rect(x, y, width, height);
  context.clip();
  context.drawImage(
    source,
    x + (width - drawnWidth) / 2 + safeOffset,
    y + (height - drawnHeight) / 2,
    drawnWidth,
    drawnHeight
  );
  context.restore();
}

function photoPolygon(x, y, width, height, rotation) {
  const points = [
    { x: x, y: y },
    { x: x + width, y: y },
    { x: x + width, y: y + height },
    { x: x, y: y + height }
  ];
  if (!rotation) return points;
  return points.map(function (point) {
    const dx = point.x - 225;
    const dy = point.y - 215;
    return {
      x: 225 + dx * Math.cos(rotation) - dy * Math.sin(rotation),
      y: 215 + dx * Math.sin(rotation) + dy * Math.cos(rotation)
    };
  });
}

function clipPhotos(context, areas) {
  if (!areas.length) return;
  context.beginPath();
  areas.forEach(function (area) {
    context.moveTo(area[0].x, area[0].y);
    area.slice(1).forEach(function (point) {
      context.lineTo(point.x, point.y);
    });
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
  context.strokeStyle = '#6b5b73';
  context.lineJoin = 'round';
  if (sticker.type === 'ears') {
    context.fillStyle = '#fff9f0';
    context.beginPath();
    addEllipse(context, -15, -13, 12, 38, -0.2);
    addEllipse(context, 15, -13, 12, 38, 0.2);
    context.fill();
    context.stroke();
    context.fillStyle = '#ffc4da';
    context.beginPath();
    addEllipse(context, -15, -17, 4, 24, -0.2);
    addEllipse(context, 15, -17, 4, 24, 0.2);
    context.fill();
  } else if (sticker.type === 'carrot') {
    context.fillStyle = '#ffc28f';
    context.beginPath();
    context.moveTo(-14, -15);
    context.quadraticCurveTo(2, -22, 15, -13);
    context.lineTo(-1, 30);
    context.closePath();
    context.fill();
    context.stroke();
    context.strokeStyle = '#96b699';
    context.lineWidth = 5;
    context.beginPath();
    context.moveTo(0, -16);
    context.lineTo(-8, -30);
    context.moveTo(0, -16);
    context.lineTo(4, -34);
    context.moveTo(0, -16);
    context.lineTo(15, -26);
    context.stroke();
  } else if (sticker.type === 'heart') {
    context.fillStyle = '#ffd9e8';
    context.beginPath();
    context.moveTo(0, 22);
    context.bezierCurveTo(-50, -10, -15, -40, 0, -15);
    context.bezierCurveTo(15, -40, 50, -10, 0, 22);
    context.fill();
    context.stroke();
  } else {
    context.fillStyle = '#ffe9a8';
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

/* ---------------- 调色 ---------------- */

// 小程序多数机型的 Canvas 2D 忽略 ctx.filter，先探测再决定用原生还是逐像素。
let nativeFilterSupport = null;
function supportsNativeFilter(context) {
  if (nativeFilterSupport !== null) return nativeFilterSupport;
  try {
    context.filter = 'brightness(50%)';
    nativeFilterSupport =
      typeof context.filter === 'string' && context.filter.indexOf('brightness') >= 0;
    context.filter = 'none';
  } catch (error) {
    nativeFilterSupport = false;
  }
  return nativeFilterSupport;
}

function toneSpec(settings) {
  const b = number(settings.brightness, 100, 30, 180) / 100;
  const c = number(settings.contrast, 100, 30, 180) / 100;
  const s = number(settings.saturation, 100, 0, 220) / 100;
  return {
    b: b,
    c: c,
    s: s,
    active: Math.abs(b - 1) > 0.001 || Math.abs(c - 1) > 0.001 || Math.abs(s - 1) > 0.001
  };
}

const toneCache = [];
const TONE_CACHE_MAX = 4;
let toneSeq = 0;

function applyTone(image, spec) {
  const box = sourceSize(image);
  if (!box.w || !box.h) return null;
  const limit = 1200;
  const scale = Math.min(1, limit / Math.max(box.w, box.h));
  const width = Math.max(1, Math.round(box.w * scale));
  const height = Math.max(1, Math.round(box.h * scale));
  try {
    const offscreen = wx.createOffscreenCanvas({ type: '2d', width: width, height: height });
    const context = offscreen.getContext('2d');
    if (!context) return null;
    context.drawImage(image, 0, 0, width, height);
    const frame = context.getImageData(0, 0, width, height);
    const data = frame.data;
    // brightness 与 contrast 都是逐通道线性运算，先做 256 级查表。
    const lut = new Uint8ClampedArray(256);
    for (let i = 0; i < 256; i++) {
      let value = (i / 255) * spec.b;
      value = (value - 0.5) * spec.c + 0.5;
      lut[i] = value * 255;
    }
    const plain = Math.abs(spec.s - 1) < 0.001;
    for (let i = 0; i < data.length; i += 4) {
      const r = lut[data[i]];
      const g = lut[data[i + 1]];
      const b = lut[data[i + 2]];
      if (plain) {
        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
      } else {
        const lum = 0.213 * r + 0.715 * g + 0.072 * b;
        data[i] = lum + (r - lum) * spec.s;
        data[i + 1] = lum + (g - lum) * spec.s;
        data[i + 2] = lum + (b - lum) * spec.s;
      }
    }
    context.putImageData(frame, 0, 0);
    return { source: offscreen, w: width, h: height };
  } catch (error) {
    return null;
  }
}

function toneDrawable(image, spec) {
  if (!image.__bunnyToneId) image.__bunnyToneId = 'img' + ++toneSeq;
  const key = image.__bunnyToneId + '|' + spec.b + '|' + spec.c + '|' + spec.s;
  for (let i = 0; i < toneCache.length; i++) {
    if (toneCache[i].key === key) return toneCache[i].drawable;
  }
  const drawable = applyTone(image, spec);
  if (drawable) {
    toneCache.unshift({ key: key, drawable: drawable });
    if (toneCache.length > TONE_CACHE_MAX) toneCache.pop();
  }
  return drawable;
}

/* ---------------- 笔画 ---------------- */

function cleanStrokes(value) {
  if (!Array.isArray(value)) return [];
  const result = [];
  value.slice(0, 200).forEach(function (stroke) {
    if (!stroke || ['marker', 'highlight', 'dash', 'mosaic'].indexOf(stroke.tool) < 0) return;
    if (!Array.isArray(stroke.points)) return;
    const points = stroke.points
      .slice(0, 2400)
      .filter(function (point) {
        return point && isFinite(point.x) && isFinite(point.y);
      })
      .map(function (point) {
        return {
          x: Math.max(0, Math.min(W, point.x)),
          y: Math.max(0, Math.min(H, point.y))
        };
      });
    if (!points.length) return;
    result.push({
      tool: stroke.tool,
      color: /^#(?:[\da-f]{3}|[\da-f]{6}|[\da-f8]{8})$/i.test(stroke.color || '')
        ? stroke.color
        : '#b77894',
      width: number(stroke.width, 12, 1, 64),
      points: points
    });
  });
  return result;
}

function cleanStickers(value) {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, 32)
    .filter(function (sticker) {
      return sticker && ['ears', 'carrot', 'heart', 'star'].indexOf(sticker.type) >= 0;
    })
    .map(function (sticker) {
      return {
        id: sticker.id,
        type: sticker.type,
        x: number(sticker.x, W / 2, 0, W),
        y: number(sticker.y, H / 2, 0, H),
        scale: number(sticker.scale, 1, 0.25, 4),
        rotation: number(sticker.rotation, 0, -360, 360)
      };
    });
}

// 马赛克必须取未落笔的原始照片层，因此先冻结一份画布快照。
function makeSnapshot(canvas) {
  if (!wx.createOffscreenCanvas) return null;
  try {
    const snapshot = wx.createOffscreenCanvas({ type: '2d', width: W * 2, height: H * 2 });
    const context = snapshot.getContext('2d');
    if (!context) return null;
    context.drawImage(canvas, 0, 0, W * 2, H * 2);
    return snapshot;
  } catch (error) {
    return null;
  }
}

function drawMosaic(context, snapshot, stroke) {
  const block = Math.max(8, Math.min(22, Math.round(stroke.width / 2)));
  const radius = Math.max(stroke.width / 2, block / 2);
  const tiles = {};
  const order = [];
  const addTiles = function (point) {
    const minRow = Math.max(0, Math.floor((point.y - radius) / block));
    const maxRow = Math.min(Math.ceil(H / block) - 1, Math.floor((point.y + radius) / block));
    const minColumn = Math.max(0, Math.floor((point.x - radius) / block));
    const maxColumn = Math.min(Math.ceil(W / block) - 1, Math.floor((point.x + radius) / block));
    for (let row = minRow; row <= maxRow; row++) {
      for (let column = minColumn; column <= maxColumn; column++) {
        const dx = column * block + block / 2 - point.x;
        const dy = row * block + block / 2 - point.y;
        if (Math.sqrt(dx * dx + dy * dy) > radius + block * 0.6) continue;
        const key = column + ':' + row;
        if (tiles[key]) continue;
        tiles[key] = true;
        order.push([column, row]);
      }
    }
  };
  addTiles(stroke.points[0]);
  for (let i = 1; i < stroke.points.length; i++) {
    const previous = stroke.points[i - 1];
    const current = stroke.points[i];
    const dx = current.x - previous.x;
    const dy = current.y - previous.y;
    const steps = Math.max(1, Math.ceil(Math.sqrt(dx * dx + dy * dy) / Math.max(3, radius / 2)));
    for (let step = 1; step <= steps; step++) {
      addTiles({
        x: previous.x + (dx * step) / steps,
        y: previous.y + (dy * step) / steps
      });
    }
  }
  context.save();
  context.imageSmoothingEnabled = false;
  order.forEach(function (tile) {
    const x = tile[0] * block;
    const y = tile[1] * block;
    const sx = Math.min(W - 1, x + block / 2) * 2;
    const sy = Math.min(H - 1, y + block / 2) * 2;
    context.drawImage(snapshot, sx, sy, 2, 2, x, y, block, block);
  });
  context.restore();
}

function drawStrokes(context, strokes, areas, snapshot) {
  strokes.forEach(function (stroke) {
    if (stroke.tool === 'mosaic' && !snapshot) return;
    context.save();
    clipPhotos(context, areas);
    if (stroke.tool === 'mosaic') {
      drawMosaic(context, snapshot, stroke);
    } else {
      context.strokeStyle = stroke.color;
      context.fillStyle = stroke.color;
      context.lineWidth = stroke.width;
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.globalAlpha = stroke.tool === 'highlight' ? 0.3 : 1;
      if (stroke.tool === 'dash') {
        context.setLineDash([stroke.width * 1.7, stroke.width * 1.3]);
      }
      const first = stroke.points[0];
      context.beginPath();
      if (stroke.points.length === 1) {
        context.arc(first.x, first.y, stroke.width / 2, 0, Math.PI * 2);
        context.fill();
      } else {
        context.moveTo(first.x, first.y);
        for (let i = 1; i < stroke.points.length; i++) {
          context.lineTo(stroke.points[i].x, stroke.points[i].y);
        }
        context.stroke();
      }
    }
    context.restore();
  });
}

/* ---------------- 主渲染 ---------------- */

function renderArtwork(canvas, primaryImage, settings, selectedId, images) {
  if (!canvas || typeof canvas.getContext !== 'function') {
    throw new Error('照片画布还没准备好');
  }
  if (!validImage(primaryImage)) {
    throw new Error('照片还未准备好，请重新选择照片');
  }
  settings = settings && typeof settings === 'object' ? settings : {};
  images = images && typeof images === 'object' ? images : {};

  // 尺寸只在变化时设置：每次赋值都会重新分配整块像素缓冲，拖拽时逐帧重分配会明显掉帧。
  if (canvas.width !== W * 2) canvas.width = W * 2;
  if (canvas.height !== H * 2) canvas.height = H * 2;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('当前环境无法打开照片画布');
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.scale(2, 2);
  // 画布不清空：下面第一笔就是整幅铺底，全覆盖。


  const meta =
    templates.filter(function (item) {
      return item.id === settings.template;
    })[0] || templates[0];
  const template = meta.id;
  const tone = toneSpec(settings);
  const native = supportsNativeFilter(context);
  const filterText =
    'brightness(' +
    number(settings.brightness, 100, 30, 180) +
    '%) contrast(' +
    number(settings.contrast, 100, 30, 180) +
    '%) saturate(' +
    number(settings.saturation, 100, 0, 220) +
    '%)';
  const stickers = cleanStickers(settings.stickers);
  const strokes = cleanStrokes(settings.strokes);
  const slots = Array.isArray(settings.photoSlots) ? settings.photoSlots.slice(0, 4) : [];
  const imageFor = function (id) {
    return validImage(images[id]) ? images[id] : primaryImage;
  };

  function drawableFor(image) {
    const box = sourceSize(image);
    if (!tone.active) return { source: image, w: box.w, h: box.h, native: false };
    if (native) return { source: image, w: box.w, h: box.h, native: true };
    const cached = toneDrawable(image, tone);
    if (cached) return { source: cached.source, w: cached.w, h: cached.h, native: false };
    return { source: image, w: box.w, h: box.h, native: false };
  }

  const photoAreas = [];
  context.fillStyle = meta.color;
  context.fillRect(0, 0, W, H);
  context.strokeStyle = '#d9ccd0';
  context.lineWidth = 1;
  roundPath(context, 9, 9, W - 18, H - 18, 5);
  context.stroke();

  const photo = function (image, x, y, width, height, offset) {
    if (!validImage(image)) return;
    const item = drawableFor(image);
    context.save();
    if (item.native) context.filter = filterText;
    cover(context, item.source, item.w, item.h, x, y, width, height, offset || 0);
    context.restore();
  };

  if (template === 'comic') {
    for (let i = 0; i < 4; i++) {
      const x = 23 + (i % 2) * 206;
      const y = 29 + Math.floor(i / 2) * 183;
      photo(imageFor(slots[i] || ''), x, y, 198, 175);
      photoAreas.push(photoPolygon(x, y, 198, 175));
    }
  } else if (template === 'mirror') {
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
    if (template === 'tape') {
      context.save();
      context.translate(225, 215);
      context.rotate(-0.035);
      context.fillStyle = '#fff9f0';
      context.shadowColor = '#6b5b7330';
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
    if (template === 'exposure') {
      context.save();
      context.globalAlpha = 0.3;
      context.globalCompositeOperation = 'screen';
      photo(imageFor(settings.secondaryId), 25, 35, 400, 352, settings.secondaryId ? 0 : -20);
      context.restore();
    }
    if (template === 'dots') {
      context.save();
      context.fillStyle = '#fff9f0';
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
      leak.addColorStop(0, '#ffc28f80');
      leak.addColorStop(0.4, '#ffe4d600');
      leak.addColorStop(1, '#ffd9e860');
      context.fillStyle = leak;
      context.fillRect(25, 35, 400, 352);
      context.restore();
    }
  }

  // 照片层只冻结一次：马赛克永远采样原照片，不会吃掉后来画上去的笔迹。
  const snapshot =
    strokes.filter(function (stroke) {
      return stroke.tool === 'mosaic';
    }).length > 0
      ? makeSnapshot(canvas)
      : null;
  drawStrokes(context, strokes, photoAreas, snapshot);

  if (template === 'comic') {
    for (let i = 0; i < 4; i++) {
      const x = 23 + (i % 2) * 206;
      const y = 29 + Math.floor(i / 2) * 183;
      context.fillStyle = '#fff9f0';
      roundPath(context, x + 6, y + 6, 34, 23, 5);
      context.fill();
      context.fillStyle = '#6b5b73';
      context.font = '12px sans-serif';
      context.fillText('0' + (i + 1), x + 14, y + 22);
    }
  }
  if (['tape', 'journal', 'polaroid'].indexOf(template) >= 0) {
    context.save();
    context.translate(225, 28);
    context.rotate(-0.04);
    context.fillStyle = template === 'journal' ? '#ffdfdccc' : '#ffd9e8d9';
    context.fillRect(-58, -10, 116, 24);
    context.fillStyle = '#fff9f0ba';
    for (let i = 0; i < 12; i++) {
      context.beginPath();
      context.arc(-51 + i * 10, -1, 1.6, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }

  context.fillStyle = '#6b5b73';
  context.textAlign = 'center';
  const fontOption =
    fontOptions.filter(function (item) {
      return item.value === settings.font;
    })[0] || fontOptions[0];
  context.font = fontOption.canvas;
  const title =
    typeof settings.title === 'string' && settings.title.trim()
      ? settings.title.slice(0, 200)
      : '把这一刻，收进回忆里 ♡';
  let text = title;
  while (context.measureText(text).width > 398 && text.length > 1) {
    text = text.slice(0, -2) + '…';
  }
  context.fillText(text, W / 2, 431);

  context.font = '12px sans-serif';
  context.fillStyle = '#978496';
  const now = new Date();
  const defaultDate =
    now.getFullYear() +
    '.' +
    ('0' + (now.getMonth() + 1)).slice(-2) +
    '.' +
    ('0' + now.getDate()).slice(-2);
  const date =
    typeof settings.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(settings.date)
      ? settings.date.replace(/-/g, '.')
      : defaultDate;
  context.fillText(
    template === 'date' ? date + '  /  我们的小日子' : '兔兔小窝 · little things, big love',
    W / 2,
    462
  );

  stickers.forEach(function (sticker) {
    drawSticker(context, sticker);
  });

  const selected = selectedId
    ? stickers.filter(function (sticker) {
        return sticker.id === selectedId;
      })[0]
    : null;
  if (selected) {
    context.save();
    context.translate(selected.x, selected.y);
    context.rotate((selected.rotation * Math.PI) / 180);
    context.strokeStyle = '#b05f84';
    context.lineWidth = 1.2;
    context.setLineDash([4, 3]);
    context.strokeRect(
      -37 * selected.scale,
      -57 * selected.scale,
      74 * selected.scale,
      98 * selected.scale
    );
    context.restore();
  }
  return canvas;
}

module.exports = {
  W: W,
  H: H,
  templates: templates,
  fontOptions: fontOptions,
  renderArtwork: renderArtwork
};
