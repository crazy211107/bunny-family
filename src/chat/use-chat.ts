import { useCallback, useEffect, useRef, useState } from "react";
import "./browser-adapter";
import * as core from "./generated/core";
import type {
  Attachment,
  ContextPack,
  FamilySnapshot,
  Message,
  RequestHandle,
  Session,
  Settings,
} from "./types";
const id = () => crypto.randomUUID();
const stamp = () => new Date().toISOString();
interface ActiveRun {
  handle?: RequestHandle;
  answerId: string;
  pending: string;
  sessionId: string;
  timer?: ReturnType<typeof setTimeout>;
}
const fresh = (): Session => ({
  id: id(),
  title: "新的对话",
  createdAt: stamp(),
  updatedAt: stamp(),
  messages: [],
});
const safeRead = <T>(read: () => T, fallback: T): T => {
  try {
    return read();
  } catch {
    return fallback;
  }
};
export const serviceHost = (value: string) => {
  try {
    return new URL(value).host;
  } catch {
    return "尚未配置的服务";
  }
};
export function useChat(getFamily: () => FamilySnapshot, origin: string) {
  const [settings, setSettings] = useState<Settings>(() =>
    safeRead(core.getSettings, core.defaults()),
  );
  const [sessions, setSessions] = useState<Session[]>(() =>
    safeRead(core.listSessions, []),
  );
  const [session, setSession] = useState<Session>(() =>
    safeRead(() => core.listSessions()[0] || fresh(), fresh()),
  );
  const current = useRef(session);
  current.current = session;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const familyRef = useRef(getFamily);
  familyRef.current = getFamily;
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [running, setRunning] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const run = useRef<ActiveRun | null>(null);
  const mounted = useRef(true);
  const friendly = (failure: unknown) => {
    let message =
      failure instanceof Error ? failure.message : "操作暂未完成，请重试。";
    const secret = safeRead(core.getSecret, "");
    if (secret) message = message.split(secret).join("[已隐藏密钥]");
    return message.slice(0, 500);
  };
  const persist = useCallback((value: Session) => {
    if (!settingsRef.current.keepHistory) return;
    try {
      core.saveSession(value);
      if (mounted.current) setSessions(core.listSessions());
    } catch {
      if (mounted.current)
        setError("本机历史保存失败。当前对话仍在，请检查存储空间。");
    }
  }, []);
  const commit = useCallback(
    (value: Session, save = false) => {
      current.current = value;
      if (mounted.current) setSession(value);
      if (save) persist(value);
    },
    [persist],
  );
  const stop = useCallback(() => {
    const active = run.current;
    if (!active) return;
    run.current = null;
    clearTimeout(active.timer);
    active.handle?.abort();
    const value = {
      ...current.current,
      updatedAt: stamp(),
      messages: current.current.messages.map((message) =>
        message.id === active.answerId
          ? { ...message, content: active.pending, status: "aborted" as const }
          : message,
      ),
    };
    commit(value, true);
    if (mounted.current) {
      setRunning(false);
      setNotice("已停止，收到的回答已保留。");
    }
  }, [commit]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      stop();
    };
  }, [stop]);
  const context = (question = "", withAttachment = !!attachment): ContextPack =>
    core.buildContext({
      state: familyRef.current(),
      scopes: settingsRef.current.scopes,
      query: question,
      page: origin,
      platform: "web",
      includeContacts: settingsRef.current.includeContacts,
      maxChars: withAttachment
        ? Math.min(8000, settingsRef.current.maxContextChars)
        : settingsRef.current.maxContextChars,
    });
  async function send(question: string, history?: Message[]) {
    if (run.current || !question.trim()) return false;
    let secret: string, pack: ContextPack, messages: unknown[], historyScopes: string[];
    const config = settingsRef.current;
    try {
      secret = core.getSecret();
      core.validateSettings(config, secret);
      pack = context(question);
      const prepared = core.prepareMessages({
        question,
        history: history || current.current.messages,
        settings: config,
        context: pack,
        attachment,
      });
      messages = prepared.messages;
      historyScopes = prepared.historyScopes;
    } catch (failure) {
      setError(friendly(failure));
      return false;
    }
    const answerId = id(),
      time = stamp(),
      source = history || current.current.messages;
    const value: Session = {
      ...current.current,
      title: source.length ? current.current.title : question.slice(0, 32),
      updatedAt: time,
      messages: [
        ...source,
        {
          id: id(),
          role: "user",
          content:
            question + (attachment ? `\n[附图：${attachment.name}]` : ""),
          createdAt: time,
          status: "complete",
          hasAttachment: !!attachment,
        },
        {
          id: answerId,
          role: "assistant",
          content: "",
          createdAt: time,
          status: "streaming",
          sources: pack.sources,
          historyScopes,
          hasAttachment: !!attachment,
        },
      ],
    };
    commit(value, true);
    setRunning(true);
    setError("");
    setNotice("");
    setAttachment(null);
    setDrafts((previous) => ({ ...previous, [value.id]: "" }));
    const active: ActiveRun = { answerId, pending: "", sessionId: value.id };
    run.current = active;
    const flush = () => {
      if (run.current !== active) return;
      commit({
        ...current.current,
        messages: current.current.messages.map((message) =>
          message.id === answerId
            ? { ...message, content: active.pending }
            : message,
        ),
      });
    };
    const finish = (status: Message["status"]) => {
      clearTimeout(active.timer);
      run.current = null;
      const result = {
        ...current.current,
        updatedAt: stamp(),
        messages: current.current.messages.map((message) =>
          message.id === answerId
            ? { ...message, content: active.pending, status }
            : message,
        ),
      };
      commit(result, true);
      if (mounted.current) setRunning(false);
    };
    try {
      active.handle = core.requestChat({
        settings: config,
        secret,
        messages,
        onDelta: (content) => {
          if (run.current !== active) return;
          active.pending = content;
          if (!active.timer)
            active.timer = setTimeout(() => {
              active.timer = undefined;
              flush();
            }, 80);
        },
      });
      const result = await active.handle.promise;
      if (run.current !== active) return true;
      active.pending = result.text;
      if (!result.text.trim())
        throw new Error("服务没有返回回答，请检查模型后重试。");
      finish("complete");
      if (result.finishReason === "length")
        setNotice("已达到输出上限，可以继续追问。");
    } catch (failure) {
      if (run.current !== active) return true;
      finish("error");
      if (mounted.current) setError(friendly(failure));
    }
    return true;
  }
  function newChat() {
    stop();
    commit(fresh());
    setAttachment(null);
    setError("");
    setNotice("");
  }
  function selectSession(value: Session) {
    stop();
    commit(value.id === current.current.id ? current.current : value);
    setAttachment(null);
    setError("");
    setNotice("");
  }
  function removeSession(value: Session) {
    try {
      core.removeSession(value.id);
      setSessions(core.listSessions());
      if (value.id === current.current.id) newChat();
    } catch (failure) {
      setError(friendly(failure));
    }
  }
  function saveSettings(value: Settings, secret: string) {
    try {
      const previous = settingsRef.current;
      if (
        (value.mode !== previous.mode ||
          serviceHost(value.baseUrl) !== serviceHost(previous.baseUrl)) &&
        !secret
      )
        throw new Error("切换连接方式或服务域名后，请重新输入该服务的密钥。");
      const key = secret || core.getSecret();
      core.validateSettings(value, key);
      const saved = core.saveSettings(value, {
        secret: key,
        remember: value.rememberKey,
      });
      setSettings(saved);
      settingsRef.current = saved;
      if (!saved.visionEnabled) setAttachment(null);
      setError("");
      setNotice("设置已保存。仅在发送或测试连接时请求服务。");
      return true;
    } catch (failure) {
      setError(friendly(failure));
      return false;
    }
  }
  function regenerate() {
    const source = current.current.messages,
      user = source.at(-2),
      answer = source.at(-1);
    if (
      running ||
      !user ||
      !answer ||
      user.role !== "user" ||
      answer.role !== "assistant"
    )
      return;
    if (user.hasAttachment) {
      setError("附图不保存在历史中，请重新选择图片后发送。");
      return;
    }
    void send(user.content, source.slice(0, -2));
  }
  return {
    settings,
    sessions,
    session,
    running,
    error,
    notice,
    setError,
    setNotice,
    attachment,
    setAttachment,
    context,
    send,
    stop,
    newChat,
    selectSession,
    removeSession,
    saveSettings,
    regenerate,
    question: drafts[session.id] || "",
    setQuestion: (value: string) =>
      setDrafts((previous) => ({ ...previous, [current.current.id]: value })),
  };
}
export type ChatController = ReturnType<typeof useChat>;
