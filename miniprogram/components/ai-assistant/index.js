const aiState = require("../../utils/ai-state");
const aiContext = require("../../utils/ai-context");
const aiClient = require("../../utils/ai-client");
const aiMedia = require("../../utils/ai-media");
const store = require("../../utils/store");
const markdown = require("../../utils/ai-markdown");

const clone = (value) => JSON.parse(JSON.stringify(value));
const now = () => new Date().toISOString();
const uid = () =>
  "ai-" +
  Date.now().toString(36) +
  "-" +
  Math.random().toString(36).slice(2, 8);
const host = (url) => {
  const match = String(url || "").match(/^https?:\/\/([^/?#]+)/i);
  return match ? match[1] : "尚未配置的服务";
};
const route = () => {
  const pages = getCurrentPages();
  return pages.length ? pages[pages.length - 1].route : "";
};
const clockText = (value) => {
  const d = new Date(value);
  return Number.isFinite(d.getTime())
    ? d.getMonth() +
        1 +
        "/" +
        d.getDate() +
        " " +
        String(d.getHours()).padStart(2, "0") +
        ":" +
        String(d.getMinutes()).padStart(2, "0")
    : "";
};
function freshSession() {
  const time = now();
  return {
    id: uid(),
    title: "新的小窝对话",
    createdAt: time,
    updatedAt: time,
    messages: [],
  };
}

Component({
  options: { styleIsolation: "isolated" },
  data: {
    opened: false,
    menuOpen: false,
    advancedOpen: false,
    previewHistoryOpen: false,
    previewDataOpen: false,
    inputFocused: false,
    canSend: false,
    hiddenMessages: 0,
    newerMessages: 0,
    collapsed: false,
    screen: "chat",
    returnScreen: "chat",
    floatX: 0,
    floatY: 260,
    floatSize: 52,
    floatWidth: 108,
    safeTop: 64,
    panelHeight: 600,
    keyboardHeight: 0,
    title: "新的小窝对话",
    messages: [],
    sessions: [],
    question: "",
    running: false,
    testing: false,
    error: "",
    notice: "",
    scrollTarget: "ai-bottom-a",
    destination: "",
    scopeCount: 0,
    settings: {},
    form: {},
    scopeRows: [],
    hasSecret: false,
    secretInput: "",
    showSecret: false,
    previewText: "",
    previewSources: [],
    previewChars: 0,
    previewTruncated: false,
    previewHistory: [],
    previewHistoryNote: "",
    historyHint: "连续对话 · 暂无上文",
    attachment: null,
    choosingImage: false,
    prompts: [
      "今天还有哪些照顾没做？",
      "帮我写一段家庭交接留言",
    ],
  },
  lifetimes: {
    attached() {
      this._alive = true;
      this._visible = true;
      this._request = null;
      this._renderTimer = null;
      this._pauseScroll = false;
      this.registerGlobal();
      this.measure();
      this.loadSettings();
      this._keyboardHandler = (event) => {
        if (!this._alive || !this._visible || !this.data.opened) return;
        const height = Math.max(0, Number(event.height) || 0);
        this._layoutScrollUntil = Date.now() + 250;
        this.setData({ keyboardHeight: height });
        if (!height) this.measure();
        this.measureMessages();
        this.scrollBottom();
      };
      if (wx.onKeyboardHeightChange)
        wx.onKeyboardHeightChange(this._keyboardHandler);
    },
    detached() {
      this.halt("已离开页面，回答已停止。");
      this._alive = false;
      try {
        const app = getApp();
        if (app.globalData.openAI === this._openHandler)
          app.globalData.openAI = null;
      } catch (error) {}
      clearTimeout(this._renderTimer);
      clearTimeout(this._dragTimer);
      clearTimeout(this._focusTimer);
      clearTimeout(this._scrollTimer);
      this._imageToken = (this._imageToken || 0) + 1;
      if (wx.offKeyboardHeightChange && this._keyboardHandler)
        wx.offKeyboardHeightChange(this._keyboardHandler);
    },
  },
  pageLifetimes: {
    show() {
      this._visible = true;
      this.registerGlobal();
      this.measure();
      this.loadSettings();
    },
    hide() {
      this.halt("已离开页面，回答已停止，可回来继续。");
      this._visible = false;
    },
    resize() {
      this.measure();
    },
  },
  methods: {
    registerGlobal() {
      try {
        if (!this._openHandler) this._openHandler = () => this.openChat();
        getApp().globalData.openAI = this._openHandler;
      } catch (error) {}
    },
    safeSet(patch) {
      if (Object.prototype.hasOwnProperty.call(patch, "question"))
        patch.canSend = !!String(patch.question || "").trim();
      if (this._alive) this.setData(patch);
    },
    toggleMenu() {
      this.safeSet({ menuOpen: !this.data.menuOpen });
    },
    closeMenu() {
      if (this.data.menuOpen) this.safeSet({ menuOpen: false });
    },
    toggleAdvanced() { this.safeSet({ advancedOpen: !this.data.advancedOpen }); },
    togglePreview(event) {
      const field = event.currentTarget.dataset.field;
      if (field === "previewHistoryOpen" || field === "previewDataOpen")
        this.safeSet({ [field]: !this.data[field] });
    },
    focusInput() {
      clearTimeout(this._focusTimer);
      this.safeSet({ inputFocused: false });
      this._focusTimer = setTimeout(() => {
        if (this._alive && this.data.screen === "chat") this.safeSet({ inputFocused: true });
      }, 0);
    },
    inputBlur() { this.safeSet({ inputFocused: false }); },
    rememberCurrent() {
      if (!this._session) return;
      this._drafts = this._drafts || {};
      this._localSessions = this._localSessions || {};
      this._drafts[this._session.id] = this.data.question;
      const saved = clone(this._session);
      if (!saved.messages.length && this.data.question.trim())
        saved.title = "未发送 · " + this.data.question.trim().slice(0, 20);
      this._localSessions[saved.id] = saved;
    },
    resetMessageWindow() {
      this._historyEnd = null;
      this._messageLimit = 30;
      this._lastScrollTop = 0;
      this._pauseScroll = false;
      this._userScrollActive = false;
      this._layoutScrollUntil = Date.now() + 250;
    },
    measureMessages() {
      if (!this._alive || !this.data.opened || !this.createSelectorQuery) return;
      const run = () => {
        if (!this._alive || !this.data.opened) return;
        this.createSelectorQuery().select("#ai-message-scroll").boundingClientRect((rect) => {
          if (rect && rect.height > 0) this._messageViewportHeight = rect.height;
        }).exec();
      };
      if (wx.nextTick) wx.nextTick(run); else run();
    },
    friendly(error) {
      let message = String(
        (error && (error.message || error.errMsg)) ||
          "连接暂时没有成功，请检查配置后重试。",
      );
      let savedSecret = "";
      try {
        savedSecret = aiState.getSecret();
      } catch (readError) {}
      const secrets = [savedSecret, this.data.secretInput];
      secrets.filter(Boolean).forEach((secret) => {
        message = message.split(secret).join("[已隐藏密钥]");
      });
      return message.slice(0, 500);
    },
    measure() {
      if (this.data.keyboardHeight > 0) return;
      try {
        const info = wx.getWindowInfo
          ? wx.getWindowInfo()
          : wx.getSystemInfoSync();
        this._width = info.windowWidth || 375;
        this._height = info.windowHeight || 667;
        this._size = Math.max(44, Math.min(58, (this._width * 104) / 750));
        this._floatWidth = this.data.collapsed
          ? this._size
          : Math.min(112, this._size * 2.05);
        const safeTop =
          (getApp().globalData || {}).safeTop ||
          (info.statusBarHeight || 24) + 46;
        const saved = aiState.getFloatPosition() || {};
        const x = Number.isFinite(saved.x)
          ? saved.x < this._width / 2 ? 8 : this._width - this._floatWidth - 8
          : this._width - this._floatWidth - 12;
        const y = Number.isFinite(saved.y) ? saved.y : this._height * 0.57;
        const pos = this.clampPosition(x, y);
        this.safeSet({
          safeTop,
          panelHeight: this._height,
          floatSize: this._size,
          floatWidth: this._floatWidth,
          floatX: pos.x,
          floatY: pos.y,
        });
      } catch (error) {
        this.safeSet({ error: "悬浮位置暂未读取，可以继续打开豆伴。" });
      }
    },
    clampPosition(x, y) {
      const size = this._size || 52,
        width = this._width || 375,
        height = this._height || 667;
      const top = this.data.safeTop || 64;
      return {
        x: Math.max(8, Math.min(width - (this._floatWidth || size) - 8, x)),
        y: Math.max(
          top + 58,
          Math.min(Math.max(top + 58, height - size - 110), y),
        ),
      };
    },
    dragStart(event) {
      const touch = event.touches && event.touches[0];
      if (!touch) return;
      this._drag = {
        x: touch.clientX,
        y: touch.clientY,
        left: this.data.floatX,
        top: this.data.floatY,
      };
      this._dragged = false;
    },
    dragMove(event) {
      const touch = event.touches && event.touches[0];
      if (!this._drag || !touch) return;
      const dx = touch.clientX - this._drag.x,
        dy = touch.clientY - this._drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 6) this._dragged = true;
      if (this._dragged) {
        const pos = this.clampPosition(
          this._drag.left + dx,
          this._drag.top + dy,
        );
        this.safeSet({ floatX: pos.x, floatY: pos.y });
      }
    },
    dragEnd() {
      if (!this._drag) return;
      this._drag = null;
      if (this._dragged) {
        const x =
          this.data.floatX + (this._floatWidth || this._size) / 2 <
          this._width / 2
            ? 8
            : this._width - (this._floatWidth || this._size) - 8;
        const pos = this.clampPosition(x, this.data.floatY);
        this.safeSet({ floatX: pos.x, floatY: pos.y });
        try {
          aiState.saveFloatPosition(pos);
        } catch (error) {
          /* 位置保存失败不影响聊天。 */
        }
        clearTimeout(this._dragTimer);
        this._dragTimer = setTimeout(() => {
          this._dragged = false;
        }, 280);
      }
    },
    loadSettings() {
      try {
        const settings = aiState.getSettings();
        this.safeSet({
          settings,
          destination: host(settings.baseUrl),
          scopeCount: aiContext.SCOPES.filter(
            (scope) => settings.scopes && settings.scopes[scope.id],
          ).length,
          hasSecret: !!aiState.getSecret(),
        });
        if (!settings.visionEnabled && this._attachment) this.removeImage();
      } catch (error) {
        this.safeSet({ error: "本机 AI 设置暂未读取，请打开设置重新保存。" });
      }
    },
    openChat() {
      if (this._dragged) return;
      this.loadSettings();
      if (!this._session) {
        try {
          const sessions = aiState.listSessions() || [];
          this._session =
            this.data.settings.keepHistory && sessions.length
              ? aiState.getSession(sessions[0].id) || freshSession()
              : freshSession();
        } catch (error) {
          this._session = freshSession();
        }
      }
      this._pauseScroll = false;
      this.safeSet({
        opened: true,
        menuOpen: false,
        collapsed: false,
        screen: "chat",
        keyboardHeight: 0,
        showLatest: false,
      });
      this.renderSession();
      this.measureMessages();
    },
    closeChat() {
      this.rememberCurrent();
      this.halt("对话已收起，回答已停止。");
      this.safeSet({ opened: false, collapsed: true, keyboardHeight: 0, menuOpen: false, inputFocused: false });
      this.measure();
      if (wx.hideKeyboard) wx.hideKeyboard();
    },
    scrollBottom(force) {
      if (!this._alive) return;
      if (force) {
        this._pauseScroll = false;
        this._userScrollActive = false;
        this._forceScrollUntil = Date.now() + 350;
        if (this.data.showLatest) this.safeSet({ showLatest: false });
      }
      if (this._pauseScroll) return;
      if (this._scrollTimer) return;
      this._scrollTimer = setTimeout(() => {
        this._scrollTimer = null;
        if (!this._alive || this._pauseScroll || this.data.screen !== "chat") return;
        this._bottom = !this._bottom;
        this.safeSet({ scrollTarget: this._bottom ? "ai-bottom-a" : "ai-bottom-b" });
      }, 0);
    },
    messageTouch(event) {
      this.closeMenu();
      const touch = event && event.touches && event.touches[0];
      this._messageTouchY = touch ? touch.clientY : null;
    },
    messageMove(event) {
      const touch = event.touches && event.touches[0];
      if (touch && this._messageTouchY !== null && Math.abs(touch.clientY - this._messageTouchY) > 8) {
        this._userScrollActive = true;
        this._pauseScroll = true;
        if (!this.data.showLatest) this.safeSet({ showLatest: true });
      }
    },
    messageScroll(event) {
      const detail = event.detail || {}, top = Number(detail.scrollTop) || 0;
      const height = this._messageViewportHeight;
      const remaining = height > 0 ? Number(detail.scrollHeight) - top - height : null;
      const now = Date.now();
      if (!this._loadingEarlier && now > (this._forceScrollUntil || 0) && now > (this._layoutScrollUntil || 0)) {
        if (remaining !== null && remaining <= 40 && this._userScrollActive && !this.data.newerMessages) this.resumeScroll();
        else if (remaining !== null && remaining > 80 && top < (this._lastScrollTop || 0) - 8) {
          this._userScrollActive = true;
          this._pauseScroll = true;
          if (!this.data.showLatest) this.safeSet({ showLatest: true });
        }
      }
      this._lastScrollTop = top;
    },
    resumeScroll() {
      if (this.data.newerMessages || !this._userScrollActive || Date.now() <= (this._forceScrollUntil || 0)) return;
      this._pauseScroll = false;
      this._userScrollActive = false;
      if (this.data.showLatest) this.safeSet({ showLatest: false });
    },
    latest() {
      if (this.data.newerMessages) {
        this.resetMessageWindow();
        this.renderSession();
      }
      this.scrollBottom(true);
    },
    loadEarlier() {
      if (!this.data.hiddenMessages || !this._session) return;
      const anchor = this.data.messages[0] && this.data.messages[0].id;
      this._pauseScroll = true;
      this._loadingEarlier = true;
      this._layoutScrollUntil = Date.now() + 250;
      this._historyEnd = this._viewEnd;
      this._messageLimit = (this._messageLimit || 30) + 20;
      this.renderSession(true, true);
      const kept = this.data.messages.find((item) => item.id === anchor);
      const fallback = this.data.messages[this.data.messages.length - 1];
      if (kept || fallback) this.safeSet({ scrollTarget: "ai-message-" + (kept || fallback).id });
      this._loadingEarlier = false;
      this.safeSet({ showLatest: true });
    },
    messageView(message, previous, isLast) {
      const hasImage = !!(previous && /\n\[附图：/.test(previous.content || ""));
      return Object.assign({}, message, {
        content: message.role === "user" ? message.content : "",
        hasContent: !!message.content,
        blocks: message.role === "assistant" ? markdown.blocks(message.content) : [],
        time: clockText(message.createdAt),
        sourceLabels: (message.sources || []).filter((item) => Number(item.included) > 0).map((item) => item.label),
        retryable: isLast && message.role === "assistant" && (message.status === "error" || message.status === "aborted") && !hasImage,
        imageRetry: isLast && hasImage && (message.status === "error" || message.status === "aborted"),
      });
    },
    renderSession(preserveScroll, preferEarlier) {
      if (!this._session) return;
      const original = this._session.messages || [];
      let end = Math.min(this._historyEnd == null ? original.length : this._historyEnd, original.length);
      let start = Math.max(0, end - (this._messageLimit || 30));
      let source = original.slice(start, end);
      let characters = source.reduce(
        (sum, message) => sum + String(message.content || "").length,
        0,
      );
      while (source.length > 2 && characters > 100000) {
        const removed = preferEarlier ? source.splice(-2, 2) : source.splice(0, 2);
        if (preferEarlier) end -= removed.length; else start += removed.length;
        characters -= removed.reduce(
          (sum, message) => sum + String(message.content || "").length,
          0,
        );
      }
      this._viewEnd = end;
      const messages = source.map((message, index) => {
        return this.messageView(message, original[start + index - 1], start + index === original.length - 1);
      });
      this.safeSet({
        messages,
        hiddenMessages: start,
        newerMessages: original.length - end,
        title: this._session.title || "新的小窝对话",
        historyHint: this.historyLabel(aiContext.conversationHistory({
          history: original, settings: this.data.settings, attachment: this._attachment,
        }).stats),
      });
      if (!preserveScroll) this.scrollBottom();
    },
    persist() {
      if (!this._session || !this.data.settings.keepHistory) return true;
      this._session.updatedAt = now();
      try {
        const saved = aiState.saveSession(this._session);
        if (!this._request && saved && Array.isArray(saved.messages))
          this._session = saved;
        return true;
      } catch (error) {
        this.safeSet({
          error: "对话仍在当前页，历史保存未成功，请检查本机空间。",
        });
        return false;
      }
    },
    inputQuestion(event) {
      this.safeSet({ question: event.detail.value });
    },
    prompt(event) {
      this.safeSet({ question: event.currentTarget.dataset.text });
    },
    async chooseImage() {
      if (this.data.running || this.data.testing || this.data.choosingImage)
        return;
      if (!this.data.settings.visionEnabled) {
        this.safeSet({ error: "请先在设置中确认所选模型支持图片输入。" });
        return;
      }
      this.safeSet({ choosingImage: true });
      const token = this._imageToken = (this._imageToken || 0) + 1;
      const sessionId = this._session && this._session.id;
      try {
        const file = await aiMedia.chooseImage();
        if (file && this._alive && token === this._imageToken && this._session && this._session.id === sessionId) {
          this._attachment = file;
          this.safeSet({
            attachment: { name: file.name, preview: file.preview },
            error: "",
          });
        }
      } catch (error) {
        if (token === this._imageToken) this.safeSet({ error: this.friendly(error) });
      } finally {
        if (token === this._imageToken) this.safeSet({ choosingImage: false });
      }
    },
    removeImage() {
      this._imageToken = (this._imageToken || 0) + 1;
      this._attachment = null;
      this.safeSet({ attachment: null, choosingImage: false });
    },
    contextBudget(settings) {
      const budget = Number(settings.maxContextChars) || 18000;
      return this._attachment ? Math.min(8000, budget) : budget;
    },
    historyLabel(stats) {
      let label = this.data.running ? "本次已带 " : "连续对话 · 可带 ";
      label += stats.includedTurns + " 轮";
      if (stats.shortenedTurns || stats.omittedTurns) label += " · 有节选";
      if (stats.blockedTurns) label += " · 按范围过滤";
      return label;
    },
    submit() {
      if (this.data.running || this.data.testing || this.data.choosingImage)
        return;
      const question = this.data.question.trim();
      if (!question) {
        this.safeSet({ error: "先写下想问豆伴的一句话。" });
        return;
      }
      this.startQuestion(question);
    },
    startQuestion(question, historyOverride) {
      let settings, context, messages, secret, historyScopes;
      const attachment = this._attachment;
      try {
        settings = aiState.getSettings();
        secret = aiState.getSecret();
        aiClient.validateSettings(settings, secret);
        context = aiContext.buildContext({
          state: store.get(),
          scopes: settings.scopes,
          query: question,
          page: route(),
          includeContacts: settings.includeContacts,
          maxChars: this.contextBudget(settings),
        });
        const history =
          historyOverride || (this._session && this._session.messages) || [];
        const prepared = aiContext.prepareMessages({
          question,
          history,
          settings,
          context,
          attachment: attachment
            ? { dataUrl: attachment.dataUrl, name: attachment.name }
            : null,
        });
        messages = prepared.messages;
        historyScopes = prepared.historyScopes;
      } catch (error) {
        this.safeSet({
          error: this.friendly(error),
          notice: "可打开设置检查服务地址、模型与密钥。",
        });
        return;
      }
      if (!this._session) this._session = freshSession();
      if (historyOverride) this._session.messages = historyOverride.slice();
      const time = now(),
        answer = {
          id: uid(),
          role: "assistant",
          content: "",
          status: "streaming",
          createdAt: time,
          hasAttachment: !!attachment,
          historyScopes,
          sources: clone(context.sources || []),
        };
      this._session.messages.push(
        {
          id: uid(),
          role: "user",
          content:
            question + (attachment ? "\n[附图：" + attachment.name + "]" : ""),
          status: "complete",
          createdAt: time,
          hasAttachment: !!attachment,
        },
        answer,
      );
      if (this._session.messages.length === 2)
        this._session.title = question.slice(0, 24);
      this.safeSet({
        question: "",
        menuOpen: false,
        running: true,
        error: "",
        notice: "",
        settings,
        destination: host(settings.baseUrl),
        attachment: null,
      });
      this._attachment = null;
      this.resetMessageWindow();
      this.safeSet({ showLatest: false });
      this.renderSession();
      const run = {
        id: answer.id,
        answer,
        cancelled: false,
        pending: "",
        request: null,
      };
      this._request = run;
      this.persist();
      try {
        run.request = aiClient.requestChat({
          settings,
          secret,
          messages,
          onDelta: (text) => {
            if (this._request !== run || run.cancelled) return;
            run.pending = String(text || "");
            if (!this._renderTimer)
              this._renderTimer = setTimeout(() => {
                this._renderTimer = null;
                if (this._request === run) this.flush(run);
              }, 80);
          },
        });
        run.request.promise
          .then((result) => {
            if (this._request !== run || run.cancelled) return;
            run.pending =
              result && typeof result.text === "string"
                ? result.text
                : run.pending;
            if (!run.pending.trim()) {
              this.finish(
                run,
                "error",
                "服务没有返回回答，请检查模型与接口后重试。",
              );
              return;
            }
            this.finish(
              run,
              "complete",
              result && result.finishReason === "length"
                ? "回答已达到本次输出上限，可以接着问“请继续”。"
                : "",
            );
          })
          .catch((error) => {
            if (this._request === run && !run.cancelled)
              this.finish(
                run,
                error && error.code === "ABORTED" ? "aborted" : "error",
                this.friendly(error),
              );
          });
      } catch (error) {
        this.finish(run, "error", this.friendly(error));
      }
    },
    flush(run) {
      run.answer.content = run.pending;
      const index = this.data.messages.findIndex((item) => item.id === run.id);
      if (index < 0) return;
      const source = this._session.messages;
      this.safeSet({ ["messages[" + index + "]"]: this.messageView(run.answer, source[source.length - 2], true) });
      this.scrollBottom();
    },
    finish(run, status, message) {
      clearTimeout(this._renderTimer);
      this._renderTimer = null;
      run.answer.content = run.pending;
      run.answer.status = status;
      this._request = null;
      this.safeSet({
        running: false,
        error: status === "error" ? message : "",
        notice:
          status === "complete"
            ? message || ""
            : message || "回答已停止，已收到的文字仍保留。",
      });
      this.renderSession();
      this.persist();
    },
    halt(message) {
      const run = this._request;
      if (run) {
        run.cancelled = true;
        if (run.request) {
          try {
            run.request.abort();
          } catch (error) {}
        }
        this.finish(
          run,
          "aborted",
          message || "回答已停止，已收到的文字仍保留。",
        );
      }
      if (this._testRequest) {
        try {
          this._testRequest.abort();
        } catch (error) {}
        this._testRequest = null;
        this.safeSet({ testing: false, notice: "连接测试已停止。" });
      }
    },
    stop() {
      this.halt();
    },
    retry() {
      if (this.data.running || !this._session) return;
      const source = this._session.messages,
        answer = source[source.length - 1],
        user = source[source.length - 2];
      if (
        !answer ||
        !user ||
        answer.role !== "assistant" ||
        user.role !== "user"
      )
        return;
      if (/\n\[附图：/.test(user.content || "")) {
        this.safeSet({ error: "上次附图仅临时发送，请重新选择图片后再提问。" });
        return;
      }
      this.startQuestion(user.content, source.slice(0, -2));
    },
    copyMessage(event) {
      const message = ((this._session && this._session.messages) || []).find(
        (item) => item.id === event.currentTarget.dataset.id,
      );
      if (message && message.content)
        wx.setClipboardData({
          data: message.content,
          fail: () => this.safeSet({ error: "文字暂未复制成功，请重试。" }),
        });
    },
    copyCode(event) {
      const data = event.currentTarget.dataset;
      const message = ((this._session && this._session.messages) || []).find(
        (item) => item.id === data.message,
      );
      const block =
        message &&
        markdown
          .blocks(message.content)
          .find(
            (item) => item.id === Number(data.index) && item.type === "code",
          );
      if (block)
        wx.setClipboardData({
          data: block.text,
          fail: () => this.safeSet({ error: "代码未复制成功，请重试。" }),
        });
    },
    navigateBack() {
      if (this.data.menuOpen) { this.closeMenu(); return; }
      if (this.data.screen === "chat") this.openHistory();
      else if (this.data.screen === "history") this.closeChat();
      else if (this.data.screen === "context") this.backPreview();
      else this.backChat();
    },
    newChat() {
      const empty = this._session && !this._session.messages.length && !this.data.question && !this._attachment
        && !this.data.running && !this.data.testing && !this.data.choosingImage;
      if (empty) {
        this.safeSet({ screen: "chat", menuOpen: false, error: "", notice: "" });
        this.focusInput();
        if (wx.showToast) wx.showToast({ title: "已在新对话", icon: "none" });
        return;
      }
      this.halt();
      this.rememberCurrent();
      if (this._session && this._session.messages.length && !this.persist()) {
        this.safeSet({ menuOpen: false, error: "旧对话保存失败，已保留当前内容，请稍后再试。" });
        return;
      }
      this._session = freshSession();
      this.removeImage();
      this.resetMessageWindow();
      this.safeSet({
        screen: "chat",
        menuOpen: false,
        question: "",
        error: "",
        notice: "",
        showLatest: false,
      });
      this.renderSession();
      this.focusInput();
    },
    openHistory() {
      if (this.data.running) this.halt("已保留部分回答，稍后可以重试。");
      this.rememberCurrent();
      try {
        const sessions = aiState.listSessions() || [];
        Object.keys(this._localSessions || {}).forEach((id) => {
          if (!sessions.some((item) => item.id === id)) sessions.push(this._localSessions[id]);
        });
        if (
          this._session &&
          !sessions.some((item) => item.id === this._session.id)
        )
          sessions.unshift(this._session);
        this.safeSet({
          screen: "history",
          menuOpen: false,
          sessions: sessions.map((item) =>
            Object.assign({}, item, {
              when: clockText(item.updatedAt || item.createdAt),
              current: !!(this._session && item.id === this._session.id),
            }),
          ),
        });
      } catch (error) {
        this.safeSet({ error: "本机历史暂未读取，请稍后重试。" });
      }
    },
    openSession(event) {
      try {
        const id = event.currentTarget.dataset.id;
        const session =
          this._session && this._session.id === id
            ? this._session
            : aiState.getSession(id) || (this._localSessions || {})[id];
        if (!session) throw new Error("这份对话已经被收起。");
        this.rememberCurrent();
        this._session = session;
        this.removeImage();
        this.resetMessageWindow();
        this.safeSet({
          screen: "chat",
          menuOpen: false,
          question: (this._drafts || {})[id] || "",
          error: "",
          notice: "",
          showLatest: false,
        });
        this.renderSession();
      } catch (error) {
        this.safeSet({ error: this.friendly(error) });
      }
    },
    deleteSession(event) {
      const id = event.currentTarget.dataset.id;
      wx.showModal({
        title: "删除这份本机对话？",
        content: "删除后无法从本机历史恢复，不影响家庭资料。",
        confirmText: "删除对话",
        confirmColor: "#91546f",
        success: (result) => {
          if (!result.confirm) return;
          try {
            aiState.removeSession(id);
            if (this._localSessions) delete this._localSessions[id];
            if (this._drafts) delete this._drafts[id];
            if (this._session && this._session.id === id) {
              this._session = freshSession();
              this.renderSession();
            }
            this.openHistory();
          } catch (error) {
            this.safeSet({ error: "删除未成功，请稍后重试。" });
          }
        },
      });
    },
    backChat() {
      this.safeSet({ screen: "chat", menuOpen: false });
      this.scrollBottom();
    },
    openSettings() {
      this.halt("回答已停止，当前文字已保留。");
      try {
        const form = clone(aiState.getSettings());
        this._originalConnection = {
          mode: form.mode,
          host: host(form.baseUrl).toLowerCase(),
        };
        this._keyChanged = false;
        this.safeSet({
          screen: "settings",
          menuOpen: false,
          advancedOpen: false,
          form,
          secretInput: "",
          showSecret: false,
          hasSecret: !!aiState.getSecret(),
          error: "",
          notice: "",
        });
        this.refreshScopeRows();
      } catch (error) {
        this.safeSet({ error: this.friendly(error) });
      }
    },
    refreshScopeRows() {
      const scopes = this.data.form.scopes || {};
      this.safeSet({
        scopeRows: aiContext.SCOPES.map((item) =>
          Object.assign({}, item, { selected: !!scopes[item.id] }),
        ),
      });
    },
    formInput(event) {
      const field = event.currentTarget.dataset.field;
      if (
        [
          "baseUrl",
          "model",
          "maxTokens",
          "temperature",
          "systemPrompt",
          "maxContextChars",
        ].indexOf(field) < 0
      )
        return;
      const patch = { error: "" };
      patch["form." + field] = event.detail.value;
      this.safeSet(patch);
    },
    secretInput(event) {
      this._keyChanged = true;
      this.safeSet({ secretInput: event.detail.value, error: "" });
    },
    showSecret() {
      this.safeSet({ showSecret: !this.data.showSecret });
    },
    changeMode(event) {
      const mode = event.currentTarget.dataset.mode;
      if (mode === "direct" || mode === "relay") {
        const patch = { "form.mode": mode, error: "" };
        if (mode === "relay" && Number(this.data.form.maxTokens) < 512)
          patch["form.maxTokens"] = 512;
        this.safeSet(patch);
      }
    },
    formSwitch(event) {
      const field = event.currentTarget.dataset.field;
      if (
        [
          "includeContacts",
          "keepHistory",
          "rememberKey",
          "visionEnabled",
        ].indexOf(field) < 0
      )
        return;
      const patch = {};
      patch["form." + field] = !!event.detail.value;
      this.safeSet(patch);
    },
    toggleScope(event) {
      const id = event.currentTarget.dataset.id;
      if (!aiContext.SCOPES.some((scope) => scope.id === id)) return;
      const scopes = Object.assign({}, this.data.form.scopes);
      scopes[id] = !scopes[id];
      this.safeSet({ "form.scopes": scopes });
      this.refreshScopeRows();
    },
    settingsValue() {
      const settings = clone(this.data.form);
      settings.baseUrl = String(settings.baseUrl || "").trim();
      settings.model = String(settings.model || "").trim();
      settings.maxTokens = Number(settings.maxTokens);
      settings.temperature = Number(settings.temperature);
      settings.maxContextChars = Number(settings.maxContextChars) || 18000;
      settings.systemPrompt = String(settings.systemPrompt || "").trim();
      return settings;
    },
    connectionSecret(settings) {
      const original = this._originalConnection || {
        mode: this.data.settings.mode,
        host: host(this.data.settings.baseUrl).toLowerCase(),
      };
      const changed =
        settings.mode !== original.mode ||
        host(settings.baseUrl).toLowerCase() !== original.host;
      if (changed && (!this._keyChanged || !this.data.secretInput.trim()))
        throw new Error(
          "服务域名或连接方式已变更，请重新输入该服务的密钥或访问令牌。原密钥不会自动带过去。",
        );
      return this._keyChanged
        ? this.data.secretInput.trim()
        : aiState.getSecret();
    },
    saveSettings() {
      if (this.data.testing) return;
      try {
        const settings = this.settingsValue(),
          secret = this.connectionSecret(settings);
        aiClient.validateSettings(settings, secret);
        aiState.saveSettings(settings, {
          secret,
          remember: !!settings.rememberKey,
        });
        this.loadSettings();
        this._keyChanged = false;
        this._originalConnection = {
          mode: settings.mode,
          host: host(settings.baseUrl).toLowerCase(),
        };
        if (!settings.visionEnabled) this.removeImage();
        this.safeSet({
          screen: "chat",
          secretInput: "",
          showSecret: false,
          error: "",
          notice: "设置已留在本机。只有点击发送或测试连接时才会请求服务。",
        });
        this.renderSession();
      } catch (error) {
        this.safeSet({ error: this.friendly(error) });
      }
    },
    clearSecret() {
      try {
        aiState.clearSecret();
        this._keyChanged = true;
        this.safeSet({
          hasSecret: false,
          secretInput: "",
          notice: "已清除本机与本次运行中的密钥。",
          error: "",
        });
      } catch (error) {
        this.safeSet({ error: "密钥暂未清除，请稍后重试。" });
      }
    },
    testConnection() {
      if (this.data.testing || this.data.running) return;
      let settings, secret;
      try {
        settings = this.settingsValue();
        secret = this.connectionSecret(settings);
        aiClient.validateSettings(settings, secret);
      } catch (error) {
        this.safeSet({ error: this.friendly(error) });
        return;
      }
      this.safeSet({
        testing: true,
        error: "",
        notice: "正在测试连接，仅发送“请只回复：连接成功”，不包含家庭资料。",
      });
      let request;
      try {
        request = aiClient.requestChat({
          settings,
          secret,
          messages: [{ role: "user", content: "请只回复：连接成功" }],
          onDelta() {},
        });
        this._testRequest = request;
      } catch (error) {
        this.safeSet({
          testing: false,
          error: this.friendly(error),
          notice: "",
        });
        return;
      }
      request.promise
        .then((result) => {
          if (this._testRequest === request)
            this.safeSet({
              notice:
                result && result.text
                  ? "服务已响应：" + result.text.slice(0, 120)
                  : "服务已连接，但没有返回文字。",
            });
        })
        .catch((error) => {
          if (this._testRequest === request)
            this.safeSet({ error: this.friendly(error), notice: "" });
        })
        .then(() => {
          if (this._testRequest === request) {
            this._testRequest = null;
            this.safeSet({ testing: false });
          }
        });
    },
    previewContext() {
      try {
        const previous = this.data.screen,
          settings =
            previous === "settings"
              ? this.settingsValue()
              : aiState.getSettings();
        const context = aiContext.buildContext({
          state: store.get(),
          scopes: settings.scopes,
          query: this.data.question.trim(),
          page: route(),
          includeContacts: settings.includeContacts,
          maxChars: this.contextBudget(settings),
        });
        const history = aiContext.conversationHistory({
          history: (this._session && this._session.messages) || [],
          settings, attachment: this._attachment,
        });
        const stats = history.stats;
        const notes = ["携带 " + stats.includedTurns + " 轮文字问答，最多最近 " + stats.limit + " 轮。"];
        if (stats.shortenedTurns) notes.push(stats.shortenedTurns + " 轮长文字按预算保留首尾，并标明省略处。");
        if (stats.omittedTurns) notes.push(stats.omittedTurns + " 轮较早对话未发送。");
        if (stats.blockedTurns) notes.push(stats.blockedTurns + " 轮涉及已关闭的资料范围，未发送。");
        if (stats.partialTurns) notes.push("中断的回答标为未完成，便于继续。");
        if (stats.imageTurns) notes.push("保留附图时的文字，原图不会再次发送。");
        this.safeSet({
          screen: "context",
          menuOpen: false,
          previewHistoryOpen: false,
          previewDataOpen: false,
          returnScreen: previous,
          previewText: context.text || "当前选中范围没有可发送的记录。",
          previewSources: context.sources || [],
          previewChars: context.chars || 0,
          previewTruncated: !!context.truncated,
          previewDestination: host(settings.baseUrl),
          previewVision: !!this._attachment,
          previewHistory: history.messages.map((item, index) => ({
            id: index, role: item.role, content: item.content,
          })),
          previewHistoryNote: notes.join(" "),
          error: "",
        });
      } catch (error) {
        this.safeSet({ error: this.friendly(error) });
      }
    },
    backPreview() {
      this.safeSet({ screen: this.data.returnScreen || "chat" });
    },
    stopTap() {},
  },
});
