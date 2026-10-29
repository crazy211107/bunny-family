// AI settings and conversation history stay separate from household records.
const SETTINGS_KEY = "bunny-ai-settings-v1";
const HISTORY_KEY = "bunny-ai-history-v1";
const POSITION_KEY = "bunny-ai-position-v1";
const copy = (value) => JSON.parse(JSON.stringify(value));
let sessionSecret = "",
  memorySessions = null;
const uid = () =>
  "ai" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
function defaults() {
  return {
    mode: "direct",
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-flash",
    maxTokens: 2048,
    temperature: 0.7,
    systemPrompt: "",
    maxContextChars: 18000,
    includeContacts: false,
    keepHistory: true,
    rememberKey: false,
    visionEnabled: false,
    scopes: {
      pets: true,
      members: true,
      care: true,
      plans: true,
      supplies: true,
      diary: true,
      photos: true,
      creative: true,
      todos: true,
      handover: true,
      drafts: false,
    },
  };
}
function normalized(value) {
  const source = value && typeof value === "object" ? value : {},
    result = defaults();
  result.mode = source.mode === "relay" ? "relay" : "direct";
  for (const key of ["baseUrl", "model", "systemPrompt"])
    if (typeof source[key] === "string")
      result[key] = source[key]
        .slice(0, key === "systemPrompt" ? 6000 : key === "model" ? 120 : 512)
        .trim();
  for (const key of ["includeContacts", "rememberKey", "visionEnabled"])
    result[key] = source[key] === true;
  result.keepHistory = source.keepHistory !== false;
  if (Number.isFinite(Number(source.maxTokens)))
    result.maxTokens = Math.max(
      128,
      Math.min(4096, Math.round(Number(source.maxTokens))),
    );
  if (Number.isFinite(Number(source.temperature)))
    result.temperature = Math.max(0, Math.min(2, Number(source.temperature)));
  if (Number.isFinite(Number(source.maxContextChars)))
    result.maxContextChars = Math.max(
      2500,
      Math.min(28000, Math.round(Number(source.maxContextChars))),
    );
  Object.keys(result.scopes).forEach((key) => {
    if (source.scopes && typeof source.scopes[key] === "boolean")
      result.scopes[key] = source.scopes[key];
  });
  return result;
}
function getSettings() {
  return normalized(wx.getStorageSync(SETTINGS_KEY));
}
function getSecret() {
  if (sessionSecret) return sessionSecret;
  const saved = wx.getStorageSync(SETTINGS_KEY);
  return saved && saved.rememberKey && typeof saved.secret === "string"
    ? saved.secret
    : "";
}
function saveSettings(value, options) {
  const settings = normalized(value),
    opt = options || {};
  const nextSecret =
    typeof opt.secret === "string" ? opt.secret.trim() : getSecret();
  settings.rememberKey =
    opt.remember === undefined ? settings.rememberKey : !!opt.remember;
  const saved = copy(settings);
  if (settings.rememberKey && nextSecret) saved.secret = nextSecret;
  wx.setStorageSync(SETTINGS_KEY, saved);
  sessionSecret = nextSecret;
  return copy(settings);
}
function clearSecret() {
  const settings = getSettings();
  settings.rememberKey = false;
  wx.setStorageSync(SETTINGS_KEY, settings);
  sessionSecret = "";
}
function sanitizeSession(value) {
  const source = value || {},
    now = new Date().toISOString();
  return {
    id: String(source.id || uid()).slice(0, 80),
    title: String(source.title || "一页新的对话").slice(0, 40),
    createdAt: source.createdAt || now,
    updatedAt: source.updatedAt || now,
    messages: (Array.isArray(source.messages) ? source.messages : [])
      .filter(
        (message) =>
          message &&
          ["user", "assistant"].indexOf(message.role) >= 0 &&
          typeof message.content === "string",
      )
      .slice(-60)
      .map((message) => ({
        id: String(message.id || uid()),
        role: message.role,
        content: message.content.slice(0, 16000),
        status:
          ["complete", "streaming", "aborted", "error"].indexOf(
            message.status,
          ) >= 0
            ? message.status
            : "complete",
        createdAt: message.createdAt || now,
        hasAttachment: !!message.hasAttachment,
        historyScopes: Array.isArray(message.historyScopes)
          ? message.historyScopes.filter((id) => typeof id === "string").slice(0, 12)
          : null,
        sources: (Array.isArray(message.sources) ? message.sources : []).map(
          (source) => ({
            id: String(source.id || "").slice(0, 30),
            label: String(source.label || "").slice(0, 30),
            count: Number(source.count) || 0,
            included: Number(source.included) || 0,
          }),
        ),
      })),
  };
}
function loadSessions() {
  if (!memorySessions) {
    const saved = wx.getStorageSync(HISTORY_KEY);
    memorySessions = (Array.isArray(saved) ? saved : []).map(sanitizeSession);
    memorySessions.forEach((session) =>
      session.messages.forEach((message) => {
        if (message.status === "streaming") message.status = "aborted";
      }),
    );
  }
  return copy(memorySessions);
}
function bounded(sessions) {
  const result = sessions.slice(0, 20);
  const size = () => JSON.stringify(result).length;
  while (result.length > 1 && size() > 180000) result.pop();
  while (result.length && result[0].messages.length > 2 && size() > 180000)
    result[0].messages.splice(0, 2);
  return result;
}
function listSessions() {
  return loadSessions().sort((a, b) =>
    String(b.updatedAt).localeCompare(String(a.updatedAt)),
  );
}
function newSession() {
  return sanitizeSession({ id: uid(), title: "一页新的对话", messages: [] });
}
function getSession(id) {
  return loadSessions().find((session) => session.id === id) || null;
}
function saveSession(value) {
  const session = sanitizeSession(value),
    next = bounded(
      [session].concat(loadSessions().filter((item) => item.id !== session.id)),
    );
  if (getSettings().keepHistory) wx.setStorageSync(HISTORY_KEY, next);
  memorySessions = next;
  return copy(session);
}
function removeSession(id) {
  const next = loadSessions().filter((session) => session.id !== id);
  const saved = wx.getStorageSync(HISTORY_KEY);
  wx.setStorageSync(
    HISTORY_KEY,
    (Array.isArray(saved) ? saved : []).filter((session) => session.id !== id),
  );
  memorySessions = next;
}
function getFloatPosition() {
  const position = wx.getStorageSync(POSITION_KEY);
  return position && Number.isFinite(position.x) && Number.isFinite(position.y)
    ? { x: position.x, y: position.y }
    : null;
}
function saveFloatPosition(position) {
  if (position && Number.isFinite(position.x) && Number.isFinite(position.y))
    wx.setStorageSync(POSITION_KEY, { x: position.x, y: position.y });
}
module.exports = {
  defaults,
  getSettings,
  saveSettings,
  getSecret,
  clearSecret,
  listSessions,
  newSession,
  getSession,
  saveSession,
  removeSession,
  getFloatPosition,
  saveFloatPosition,
};
