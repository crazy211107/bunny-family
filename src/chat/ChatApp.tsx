import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  ChevronRight,
  Database,
  FileText,
  History,
  Home,
  ImagePlus,
  Menu,
  MessageSquare,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Square,
  Sun,
  Trash2,
  X,
} from "lucide-react";
import { Button, BunnyLogo, Modal, SelectControl, cn } from "./ui";
import { useChat, serviceHost, type ChatController } from "./use-chat";
import { MessageList } from "./MessageList";
import { SettingsPanel } from "./SettingsPanel";
import { readImage } from "./browser-adapter";
import * as core from "./generated/core";
import type {
  ContextPack,
  FamilySnapshot,
  Session,
  Settings,
  Theme,
  View,
} from "./types";
import "./chat.css";
const suggestions = [
  {
    icon: ShieldCheck,
    title: "安排今天的照顾",
    text: "今天豆米和豆糕还有哪些照顾需要记录？",
    note: "照顾 · 日程",
  },
  {
    icon: FileText,
    title: "把日子写成手账",
    text: "结合最近的小日子记录，帮我起草一段温暖的手账文案。",
    note: "手账 · 回忆",
  },
  {
    icon: Sparkles,
    title: "准备一份交接",
    text: "根据已有记录，整理一份豆米和豆糕的照顾交接清单。",
    note: "交接 · 家人",
  },
];
export function BackButton({
  destination,
  onBack,
}: {
  destination: string;
  onBack(): void;
}) {
  return (
    <Button
      variant="ghost"
      className="chat-back"
      onClick={onBack}
      aria-label="返回"
      title={`返回${destination}`}
    >
      <ArrowLeft />
      <span>返回</span>
      <span className="chat-sr-only">{destination}</span>
    </Button>
  );
}
export function ModelSelector({
  settings,
  disabled,
  onChange,
}: {
  settings: Settings;
  disabled: boolean;
  onChange(model: string): void;
}) {
  const options = Array.from(
    new Set([settings.model, "deepseek-flash", "deepseek-v4-pro"]),
  )
    .filter(Boolean)
    .map((id) => ({ id, name: id }));
  return (
    <div className="chat-model">
      <SelectControl
        value={settings.model}
        label={
          settings.mode === "relay" ? "中转模型（服务端固定）" : "选择模型"
        }
        options={options}
        disabled={disabled || settings.mode === "relay"}
        onChange={onChange}
      />
    </div>
  );
}
export function ChatHeader({
  view,
  title,
  running,
  settings,
  onBack,
  onSidebar,
  onNew,
  onSettings,
  onModel,
}: {
  view: View;
  title: string;
  running: boolean;
  settings: Settings;
  onBack(): void;
  onSidebar(): void;
  onNew(): void;
  onSettings(): void;
  onModel(model: string): void;
}) {
  return (
    <header className="chat-header">
      <BackButton
        destination={view === "chat" ? "会话列表" : "进入前的小窝页面"}
        onBack={onBack}
      />
      <span className="chat-header-divider" />
      <Button
        variant="ghost"
        size="icon"
        className="chat-mobile-menu"
        onClick={onSidebar}
        aria-label="打开会话抽屉"
      >
        <Menu />
      </Button>
      <div className="chat-header-title">
        <strong>{view === "sessions" ? "全部对话" : title}</strong>
        <span>{running ? "正在生成回答" : "豆伴 · 家庭手账助手"}</span>
      </div>
      <div className="chat-header-actions">
        <ModelSelector
          settings={settings}
          disabled={running}
          onChange={onModel}
        />
        <Button
          variant="ghost"
          size="icon"
          className="chat-header-settings"
          onClick={onSettings}
          aria-label="连接与资料设置"
          title="设置"
        >
          <Settings2 />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onNew}
          aria-label="新建对话"
        >
          <Plus />
          <span className="chat-new-label">新对话</span>
        </Button>
      </div>
    </header>
  );
}
function SessionRows({
  sessions,
  currentId,
  query,
  onSelect,
  onDelete,
}: {
  sessions: Session[];
  currentId: string;
  query: string;
  onSelect(value: Session): void;
  onDelete(value: Session): void;
}) {
  const matching = sessions.filter((session) =>
    session.title.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <div className="chat-session-rows">
      {matching.map((session) => (
        <div
          key={session.id}
          className={cn(
            "chat-session-row",
            session.id === currentId && "chat-session-current",
          )}
        >
          <button
            className="chat-session-open"
            aria-current={session.id === currentId ? "true" : undefined}
            onClick={() => onSelect(session)}
          >
            <MessageSquare size={15} />
            <span>
              <strong>{session.title}</strong>
              <small>
                {new Date(session.updatedAt).toLocaleDateString("zh-CN", {
                  month: "short",
                  day: "numeric",
                })}
                {session.id === currentId ? " · 当前会话" : ""}
              </small>
            </span>
          </button>
          <Button
            variant="ghost"
            size="icon"
            className="chat-session-delete"
            onClick={() => onDelete(session)}
            aria-label={`删除对话：${session.title}`}
          >
            <Trash2 />
          </Button>
        </div>
      ))}
      {!matching.length && (
        <p className="chat-list-empty">
          {query
            ? "没有找到这个标题，试试其他关键词。"
            : "还没有保存的对话。写下第一句，就从这里开始。"}
        </p>
      )}
    </div>
  );
}
export function Sidebar({
  chat,
  collapsed,
  onCollapse,
  onSettings,
  onSelect,
  onDelete,
  onList,
  theme,
  onTheme,
  onNew,
  mobile = false,
}: {
  chat: ChatController;
  collapsed: boolean;
  onCollapse(): void;
  onSettings(): void;
  onSelect(value: Session): void;
  onDelete(value: Session): void;
  onList(): void;
  theme: Theme;
  onTheme(): void;
  onNew(): void;
  mobile?: boolean;
}) {
  const [query, setQuery] = useState("");
  return (
    <aside
      className={cn(
        "chat-sidebar",
        collapsed && "chat-sidebar-collapsed",
        mobile && "chat-sidebar-mobile",
      )}
      aria-label="会话导航"
    >
      <div className="chat-sidebar-brand">
        <BunnyLogo />
        <div className="chat-sidebar-wordmark">
          <strong>豆伴</strong>
          <span>小窝里的 AI 助手</span>
        </div>
        {!mobile && (
          <Button
            variant="ghost"
            size="icon"
            className="chat-collapse"
            onClick={onCollapse}
            aria-label={collapsed ? "展开侧栏" : "折叠侧栏"}
            title={collapsed ? "展开侧栏" : "折叠侧栏"}
          >
            {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          </Button>
        )}
      </div>
      <Button
        variant="outline"
        className="chat-sidebar-new"
        onClick={onNew}
        aria-label="新建对话"
      >
        <Plus />
        <span>新建对话</span>
        <kbd>⌘/Ctrl K</kbd>
      </Button>
      {!collapsed && (
        <>
          <label className="chat-search">
            <Search size={15} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索对话"
              aria-label="搜索对话标题"
            />
          </label>
          <div className="chat-sidebar-section">
            <span>最近对话</span>
            <Button variant="ghost" size="sm" onClick={onList}>
              全部
              <ChevronRight />
            </Button>
          </div>
          <nav className="chat-sidebar-history">
            <SessionRows
              sessions={chat.sessions}
              currentId={chat.session.id}
              query={query}
              onSelect={onSelect}
              onDelete={onDelete}
            />
          </nav>
        </>
      )}
      <div className="chat-sidebar-bottom">
        {!collapsed && (
          <div className="chat-local-card">
            <span className="chat-connection-dot" />
            <div>
              <strong>
                {chat.settings.mode === "relay" ? "自有中转" : "自定义 AI 连接"}
              </strong>
              <span>{serviceHost(chat.settings.baseUrl)}</span>
            </div>
            <ShieldCheck size={15} />
          </div>
        )}
        <div className="chat-sidebar-bottom-actions">
          <Button
            variant="ghost"
            className="chat-sidebar-setting"
            onClick={onSettings}
            aria-label="连接与资料设置"
          >
            <Settings2 />
            <span>连接与资料</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onTheme}
            aria-label={theme === "light" ? "切换深色模式" : "切换浅色模式"}
            title={theme === "light" ? "深色模式" : "浅色模式"}
          >
            {theme === "light" ? <Moon /> : <Sun />}
          </Button>
        </div>
        {!collapsed && (
          <p className="chat-sidebar-footnote">
            对话保存在本机 · 资料范围由你决定
          </p>
        )}
      </div>
    </aside>
  );
}
export function EmptyState({
  onPrompt,
  configured,
  onSettings,
}: {
  onPrompt(value: string): void;
  configured: boolean;
  onSettings(): void;
}) {
  return (
    <section className="chat-empty">
      <div className="chat-empty-eyebrow">
        <span />
        为豆米和豆糕，留一份用心
      </div>
      <BunnyLogo />
      <h1>
        小日子的事，
        <br />
        <span>一起慢慢理清。</span>
      </h1>
      <p>
        照顾安排、成长回忆，或一句还没想好的手账旁白。
        <br className="chat-desktop-break" />
        告诉豆伴，你今天想从哪里开始。
      </p>
      <div className="chat-suggestions">
        {suggestions.map((item) => (
          <button key={item.title} onClick={() => onPrompt(item.text)}>
            <span className="chat-suggestion-icon">
              <item.icon size={19} />
            </span>
            <strong>{item.title}</strong>
            <small>{item.note}</small>
            <ArrowRight size={16} />
          </button>
        ))}
      </div>
      {!configured && (
        <div className="chat-setup-note">
          <KeyIcon />
          <span>先连接你的 AI 服务，就可以开始对话。</span>
          <button onClick={onSettings}>
            去设置
            <ArrowRight size={13} />
          </button>
        </div>
      )}
    </section>
  );
}
function KeyIcon() {
  return <ShieldCheck size={15} aria-hidden="true" />;
}
export function ChatInput({
  chat,
  onSettings,
  onPreview,
  inputRef,
}: {
  chat: ChatController;
  onSettings(): void;
  onPreview(): void;
  inputRef: React.RefObject<HTMLTextAreaElement>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [choosing, setChoosing] = useState(false);
  useLayoutEffect(() => {
    const input = inputRef.current;
    if (input) {
      input.style.height = "0px";
      input.style.height =
        Math.max(54, Math.min(190, input.scrollHeight)) + "px";
    }
  }, [chat.question, inputRef]);
  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    if (!choosing && !chat.running && chat.question.trim())
      void chat.send(chat.question.trim());
  };
  return (
    <div className="chat-input-area">
      <form className="chat-composer" onSubmit={submit} aria-label="发送消息">
        {chat.attachment && (
          <div className="chat-input-attachment">
            <img src={chat.attachment.preview} alt="本次附图预览" />
            <span>
              <strong>{chat.attachment.name}</strong>
              <small>仅本次发送，不存入历史</small>
            </span>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => chat.setAttachment(null)}
              aria-label="移除附件"
            >
              <X />
            </Button>
          </div>
        )}
        <label className="chat-sr-only" htmlFor="chat-question">
          向豆伴提问
        </label>
        <textarea
          id="chat-question"
          ref={inputRef}
          value={chat.question}
          onChange={(event) => chat.setQuestion(event.target.value)}
          maxLength={3000}
          placeholder="说说今天的小事，或问问豆伴…"
          rows={1}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing &&
              event.keyCode !== 229
            ) {
              event.preventDefault();
              submit();
            }
          }}
          aria-describedby="chat-input-help"
        />
        <div className="chat-composer-tools">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              disabled={chat.running || choosing}
              aria-label="添加图片附件"
              title="添加图片"
              onClick={() => {
                if (!chat.settings.visionEnabled) {
                  onSettings();
                  return;
                }
                fileRef.current?.click();
              }}
            >
              <ImagePlus />
            </Button>
            <Button variant="ghost" size="sm" onClick={onPreview}>
              <Database />
              <span>资料范围</span>
              <span className="chat-scope-number">
                {Object.values(chat.settings.scopes).filter(Boolean).length}
              </span>
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <span className="chat-input-shortcut">
              {choosing ? "整理图片中…" : "Enter 发送"}
            </span>
            {chat.running ? (
              <Button
                className="chat-send"
                variant="outline"
                size="icon"
                onClick={chat.stop}
                aria-label="停止生成"
              >
                <Square fill="currentColor" size={13} />
              </Button>
            ) : (
              <Button
                className="chat-send"
                type="submit"
                size="icon"
                disabled={!chat.question.trim() || choosing}
                aria-label="发送消息"
              >
                <ArrowUp />
              </Button>
            )}
          </div>
        </div>
        <input
          className="chat-sr-only"
          type="file"
          ref={fileRef}
          accept="image/jpeg,image/png,image/webp"
          tabIndex={-1}
          aria-label="选择一张图片"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            setChoosing(true);
            void readImage(file)
              .then(chat.setAttachment)
              .catch((failure) =>
                chat.setError(
                  failure instanceof Error ? failure.message : "图片读取失败。",
                ),
              )
              .finally(() => setChoosing(false));
          }}
        />
      </form>
      <div id="chat-input-help" className="chat-input-help">
        <ShieldCheck size={12} />
        <span>AI 回答请核实 · 发送至 {serviceHost(chat.settings.baseUrl)}</span>
        <span className="chat-shift-help">Shift + Enter 换行</span>
      </div>
    </div>
  );
}
export default function ChatApp({
  getFamily,
  origin = "home",
  onExit,
}: {
  getFamily(): FamilySnapshot;
  origin?: string;
  onExit(): void;
}) {
  const chat = useChat(getFamily, origin);
  const chatRef = useRef(chat);
  chatRef.current = chat;
  const [view, setView] = useState<View>("chat"),
    [collapsed, setCollapsed] = useState(false),
    [drawer, setDrawer] = useState(false),
    [settingsOpen, setSettingsOpen] = useState(false),
    [preview, setPreview] = useState<ContextPack | null>(null),
    [deleting, setDeleting] = useState<Session | null>(null),
    [search, setSearch] = useState("");
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem("bunny-chat-theme");
      return saved === "dark" ||
        (!saved && matchMedia("(prefers-color-scheme: dark)").matches)
        ? "dark"
        : "light";
    } catch {
      return "light";
    }
  });
  const inputRef = useRef<HTMLTextAreaElement>(null),
    backFocus = useRef<HTMLDivElement>(null);
  const regenerate = useCallback(() => chatRef.current.regenerate(), []);
  const newChat = () => {
    chat.newChat();
    setView("chat");
    setDrawer(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  };
  const back = () => {
    if (view === "chat") {
      chat.stop();
      setView("sessions");
      setDrawer(false);
      requestAnimationFrame(() =>
        backFocus.current
          ?.querySelector<HTMLButtonElement>('[aria-label="返回"]')
          ?.focus(),
      );
    } else {
      chat.stop();
      onExit();
    }
  };
  useEffect(() => {
    const previous = document.title;
    document.title = "豆伴 · AI 对话";
    return () => {
      document.title = previous;
    };
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("bunny-chat-theme", theme);
    } catch {
      /* Styling is still usable without storage. */
    }
  }, [theme]);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        if (document.querySelector('[role="dialog"]')) return;
        event.preventDefault();
        chatRef.current.newChat();
        setView("chat");
        setDrawer(false);
        requestAnimationFrame(() => inputRef.current?.focus());
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  const select = (session: Session) => {
    chat.selectSession(session);
    setView("chat");
    setDrawer(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  };
  const openSettings = () => {
    chat.stop();
    setDrawer(false);
    setSettingsOpen(true);
  };
  const onPrompt = (text: string) => {
    chat.setQuestion(text);
    inputRef.current?.focus();
  };
  const sidebarProps = {
    chat,
    collapsed,
    onCollapse: () => setCollapsed((value) => !value),
    onSettings: openSettings,
    onSelect: select,
    onDelete: setDeleting,
    onList: () => {
      chat.stop();
      setView("sessions");
      setDrawer(false);
    },
    theme,
    onTheme: () => setTheme((value) => (value === "light" ? "dark" : "light")),
    onNew: newChat,
  };
  const configured = (() => {
    try {
      return !!core.getSecret();
    } catch {
      return false;
    }
  })();
  const listSessions = chat.sessions.some(
    (session) => session.id === chat.session.id,
  )
    ? chat.sessions
    : [chat.session, ...chat.sessions];
  return (
    <div className="chat-app chat-workspace" data-theme={theme} ref={backFocus}>
      <a className="chat-skip-link" href="#chat-question">
        跳到消息输入框
      </a>
      <div className="chat-desktop-sidebar">
        <Sidebar {...sidebarProps} />
      </div>
      <main className="chat-main">
        <ChatHeader
          view={view}
          title={chat.session.messages.length ? chat.session.title : "新的对话"}
          running={chat.running}
          settings={chat.settings}
          onBack={back}
          onSidebar={() => setDrawer(true)}
          onNew={newChat}
          onSettings={openSettings}
          onModel={(model) => {
            chat.saveSettings({ ...chat.settings, model }, "");
          }}
        />
        {view === "sessions" ? (
          <section className="chat-session-page">
            <span className="chat-page-eyebrow">你的对话，随时回来继续</span>
            <h1>会话列表</h1>
            <p>保存在当前设备。返回对话时，会保留未发送的文字。</p>
            <label className="chat-search">
              <Search size={16} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="查找一个对话…"
                aria-label="搜索全部会话"
              />
            </label>
            <SessionRows
              sessions={listSessions}
              currentId={chat.session.id}
              query={search}
              onSelect={select}
              onDelete={setDeleting}
            />
            {!listSessions.length && (
              <Button onClick={newChat}>
                <Plus />
                开始新对话
              </Button>
            )}
            <Button
              className="chat-return-home"
              variant="ghost"
              onClick={() => {
                chat.stop();
                onExit();
              }}
            >
              <Home />
              回到进入前的小窝页面
            </Button>
          </section>
        ) : (
          <>
            {chat.session.messages.length ? (
              <MessageList
                messages={chat.session.messages}
                sessionId={chat.session.id}
                running={chat.running}
                onRegenerate={regenerate}
                onError={chat.setError}
              />
            ) : (
              <div className="chat-empty-scroll">
                <EmptyState
                  onPrompt={onPrompt}
                  configured={configured}
                  onSettings={openSettings}
                />
              </div>
            )}
            {(chat.error || chat.notice) && (
              <div
                className={cn(
                  "chat-feedback",
                  chat.error && "chat-feedback-error",
                )}
                role={chat.error ? "alert" : "status"}
              >
                <span>{chat.error || chat.notice}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    chat.setError("");
                    chat.setNotice("");
                  }}
                  aria-label="关闭提示"
                >
                  <X />
                </Button>
              </div>
            )}
            <ChatInput
              chat={chat}
              onSettings={openSettings}
              onPreview={() => {
                try {
                  setPreview(chat.context(chat.question));
                } catch {
                  chat.setError("本机资料暂未读取成功，请稍后重试。");
                }
              }}
              inputRef={inputRef}
            />
          </>
        )}
      </main>
      <Modal
        open={drawer}
        onOpenChange={setDrawer}
        title="会话导航"
        description="切换已有对话或开始新的对话。"
        theme={theme}
        sheet
      >
        <Sidebar {...sidebarProps} mobile collapsed={false} />
      </Modal>
      <SettingsPanel
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={chat.settings}
        save={chat.saveSettings}
        error={chat.error}
        theme={theme}
      />
      <Modal
        open={!!preview}
        onOpenChange={(open) => {
          if (!open) setPreview(null);
        }}
        title="本次家庭资料"
        description={`即将交给 ${serviceHost(chat.settings.baseUrl)}，尚未发送。`}
        theme={theme}
      >
        <div className="chat-context-preview">
          <p>
            以下只预览家庭快照。发送还会包含当前问题、符合当前范围的最近问答，以及你主动选择的本次附图。
          </p>
          <div className="chat-context-tags">
            {preview?.sources.map((source) => (
              <span key={source.id} data-included={!!source.included}>
                {source.label}
                <strong>
                  {source.included}/{source.count}
                </strong>
              </span>
            ))}
          </div>
          <p>
            {preview?.chars} 字符
            {preview?.truncated ? " · 已按预算裁剪，不代表全部历史" : ""}
          </p>
          <pre tabIndex={0}>{preview?.text}</pre>
        </div>
      </Modal>
      <Modal
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title="删除这份本机对话？"
        description={`“${deleting?.title || ""}”删除后无法恢复，家庭资料不受影响。`}
        theme={theme}
      >
        <div className="chat-confirm-actions">
          <Button variant="outline" onClick={() => setDeleting(null)}>
            保留对话
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              if (deleting) chat.removeSession(deleting);
              setDeleting(null);
            }}
          >
            删除对话
          </Button>
        </div>
      </Modal>
    </div>
  );
}
