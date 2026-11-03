const painter = require('./painter');
const finite = (value, fallback, min, max) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
};
const papers = [
  { name: '随模板', value: '' }, { name: '奶油信纸', value: '#fff9f0' },
  { name: '樱花便笺', value: '#ffe6ef' }, { name: '薄荷手账', value: '#dcebdc' },
  { name: '暖黄票根', value: '#fff0c9' }
];
const tones = [
  { id: 'original', name: '原片', b: 100, c: 100, s: 100, color: '#f0e6dc' },
  { id: 'cream', name: '奶油光', b: 108, c: 94, s: 88, color: '#fff0cf' },
  { id: 'film', name: '旧胶片', b: 104, c: 86, s: 72, color: '#ead3bb' },
  { id: 'fresh', name: '小春日', b: 106, c: 105, s: 115, color: '#dcebdc' },
  { id: 'mono', name: '黑白信', b: 103, c: 110, s: 0, color: '#d5d0d2' }
];
const stickerTypes = [
  { id: 'ears', name: '兔耳朵', symbol: '⑅' }, { id: 'carrot', name: '胡萝卜', symbol: '♧' },
  { id: 'heart', name: '小爱心', symbol: '♡' }, { id: 'star', name: '闪亮星', symbol: '✧' },
  { id: 'flower', name: '小花朵', symbol: '✿' }, { id: 'washi', name: '纸胶带', symbol: '▱' }
];
const colors = ['#ce8ba7', '#87a98d', '#d5ac51', '#6b5b73', '#fff9f0'];
const day = () => {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};
function defaults() {
  return { template: 'polaroid', title: '今天也要贴在一起 ♡', font: painter.fontOptions[0].value,
    brightness: 100, contrast: 100, saturation: 100, stickers: [], strokes: [], photoSlots: [], secondaryId: '',
    transform: { zoom: 1, x: 0, y: 0, rotation: 0, flipX: false, flipY: false }, slotTransforms: [], paper: '',
    titleColor: '#6b5b73', titleSize: 23, footerText: '兔兔小窝 · little things, big love', date: day(), showDate: false };
}
function cleanTransform(value) {
  const t = value || {};
  return { zoom: finite(t.zoom, 1, 1, 3), x: finite(t.x, 0, -100, 100), y: finite(t.y, 0, -100, 100),
    rotation: [0, 90, 180, 270].includes(Number(t.rotation)) ? Number(t.rotation) : 0, flipX: t.flipX === true, flipY: t.flipY === true };
}
function normalize(value) {
  const s = Object.assign(defaults(), value && typeof value === 'object' ? value : {});
  s.transform = cleanTransform(s.transform);
  s.slotTransforms = Array.isArray(s.slotTransforms) ? s.slotTransforms.slice(0, 4).map(t => t ? cleanTransform(t) : null) : [];
  if (!painter.templates.some(item => item.id === s.template)) s.template = 'polaroid';
  s.title = typeof s.title === 'string' ? Array.from(s.title).slice(0, 40).join('') : '';
  s.footerText = typeof s.footerText === 'string' ? Array.from(s.footerText).slice(0, 60).join('') : '';
  s.brightness = finite(s.brightness, 100, 50, 150);
  s.contrast = finite(s.contrast, 100, 50, 150);
  s.saturation = finite(s.saturation, 100, 0, 200);
  s.titleSize = finite(s.titleSize, 23, 16, 30);
  s.titleColor = colors.includes(s.titleColor) ? s.titleColor : '#6b5b73';
  s.paper = papers.some(p => p.value === s.paper) ? s.paper : '';
  s.stickers = painter.cleanStickers(s.stickers).slice(0, 16);
  s.strokes = Array.isArray(s.strokes) ? s.strokes.slice(0, 200) : [];
  s.photoSlots = Array.isArray(s.photoSlots) ? s.photoSlots.slice(0, 4) : [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s.date || '')) s.date = day();
  s.showDate = s.showDate === true;
  return s;
}
function slotCount(template) { return template === 'comic' ? 4 : template === 'duo' ? 2 : template === 'strip' ? 3 : 0; }
function layerName(layer) {
  if (layer.type === 'caption') return layer.text || '文字便签';
  const match = stickerTypes.find(item => item.id === layer.type);
  return match ? match.name : '贴纸';
}
module.exports = { defaults, normalize, slotCount, layerName, tones, papers, stickerTypes, colors, finite };
