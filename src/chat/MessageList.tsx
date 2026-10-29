import {
  memo,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { ArrowDown, Check, Copy, RotateCcw, Square } from "lucide-react";
import { Button, BunnyLogo } from "./ui";
import type { Message } from "./types";
export async function copyText(value: string) {
  if (!navigator.clipboard)
    throw new Error("当前环境不支持剪贴板，请选择文字复制。");
  await navigator.clipboard.writeText(value);
}
function CopyButton({
  text,
  label,
  onError,
}: {
  text: string;
  label: string;
  onError(message: string): void;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <Button
      size="sm"
      variant="ghost"
      aria-label={label}
      onClick={() => {
        void copyText(text)
          .then(() => {
            setCopied(true);
            clearTimeout(timer.current);
            timer.current = setTimeout(() => setCopied(false), 1600);
          })
          .catch(() => onError("复制未成功，请选择文字复制。"));
      }}
    >
      {copied ? <Check /> : <Copy />}
      <span>{copied ? "已复制" : label}</span>
    </Button>
  );
}
const plainText = (node: ReactNode): string =>
  typeof node === "string" || typeof node === "number"
    ? String(node)
    : Array.isArray(node)
      ? node.map(plainText).join("")
      : node && typeof node === "object" && "props" in node
        ? plainText((node.props as { children?: ReactNode }).children)
        : "";
export function CodeBlock({
  children,
  onError,
}: {
  children: ReactNode;
  onError(message: string): void;
}) {
  const element = Array.isArray(children) ? children[0] : children;
  const props =
    element && typeof element === "object" && "props" in element
      ? (element.props as { className?: string; children?: ReactNode })
      : {};
  const language = props.className?.match(/language-([^\s]+)/)?.[1] || "text";
  const text = plainText(props.children).replace(/\n$/, "");
  return (
    <div className="chat-code-block">
      <div className="chat-code-toolbar">
        <span>{language}</span>
        <CopyButton text={text} label="复制代码" onError={onError} />
      </div>
      <pre tabIndex={0} aria-label={`${language} 代码`}>
        {children}
      </pre>
    </div>
  );
}
export const MessageItem = memo(function MessageItem({
  message,
  last,
  onRegenerate,
  onError,
}: {
  message: Message;
  last: boolean;
  onRegenerate(): void;
  onError(message: string): void;
}) {
  const assistant = message.role === "assistant";
  return (
    <article
      className={`chat-message ${assistant ? "chat-assistant" : "chat-user"}`}
      aria-label={assistant ? "豆伴的回答" : "你的问题"}
    >
      {assistant && (
        <div className="chat-message-author">
          <BunnyLogo small />
          <span>豆伴</span>
          <span className="chat-author-note">家庭手账助手</span>
        </div>
      )}
      <div className="chat-message-body">
        {assistant ? (
          <div className="chat-markdown">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[[rehypeHighlight, { detect: false }]]}
              skipHtml
              components={{
                pre: ({ children }) => (
                  <CodeBlock onError={onError}>{children}</CodeBlock>
                ),
                a: ({ href, children }) =>
                  /^https?:\/\//i.test(href || "") ? (
                    <a href={href} target="_blank" rel="noopener noreferrer">
                      {children}
                    </a>
                  ) : (
                    <span>{children}</span>
                  ),
                img: ({ alt }) => (
                  <span className="chat-muted">
                    [模型提及图片：{alt || "未加载"}]
                  </span>
                ),
                table: ({ children }) => (
                  <div className="chat-table-wrap">
                    <table>{children}</table>
                  </div>
                ),
              }}
            >
              {message.content}
            </ReactMarkdown>
            {message.status === "streaming" && (
              <div className="chat-generating" role="status">
                <span className="chat-pulse" />
                {message.content ? "正在生成" : "正在整理回答"}
                <span className="chat-ellipsis">•••</span>
              </div>
            )}
          </div>
        ) : (
          <p className="chat-user-content">{message.content}</p>
        )}
      </div>
      {assistant && message.status !== "streaming" && (
        <div className="chat-message-actions">
          {message.content && (
            <CopyButton
              text={message.content}
              label="复制回答"
              onError={onError}
            />
          )}
          {last && (
            <Button variant="ghost" size="sm" onClick={onRegenerate}>
              <RotateCcw />
              {message.status === "error" ? "重试" : "重新生成"}
            </Button>
          )}
          {message.status === "aborted" && <span>已停止 · 保留部分回答</span>}
          {message.status === "error" && (
            <span className="chat-error-text">回答未完成</span>
          )}
        </div>
      )}
      {assistant &&
        message.sources?.some((source) => source.included) &&
        message.status !== "streaming" && (
          <details className="chat-sources">
            <summary>
              本次提供了{" "}
              {message.sources.filter((source) => source.included).length}{" "}
              类家庭资料
            </summary>
            <p>
              {message.sources
                .filter((source) => source.included)
                .map((source) => `${source.label} ${source.included} 条`)
                .join(" · ")}
              。这是发送范围，并非外部引用。
            </p>
          </details>
        )}
    </article>
  );
});
export function MessageList({
  messages,
  sessionId,
  running,
  onRegenerate,
  onError,
}: {
  messages: Message[];
  sessionId: string;
  running: boolean;
  onRegenerate(): void;
  onError(message: string): void;
}) {
  const viewport = useRef<HTMLDivElement>(null),
    following = useRef(true),
    lastTop = useRef(0);
  const [showLatest, setShowLatest] = useState(false),
    [limit, setLimit] = useState(40);
  const last = messages.at(-1);
  const latestQuestionId = last?.role === 'user' ? last.id : messages.at(-2)?.role === 'user' ? messages.at(-2)?.id : '';
  const bottom = () => {
    const el = viewport.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
      lastTop.current = el.scrollTop;
    }
    following.current = true;
    setShowLatest(false);
  };
  useLayoutEffect(() => {
    following.current = true;
    setLimit(40);
    bottom();
  }, [sessionId]);
  // Sending a new question intentionally returns to its answer; token updates keep the reader's choice.
  useLayoutEffect(() => { if (latestQuestionId) bottom(); }, [latestQuestionId]);
  useLayoutEffect(() => {
    if (following.current) bottom();
    else setShowLatest(true);
  }, [last?.content, last?.status, messages.length]);
  const visible = messages.slice(-limit);
  return (
    <div className="chat-message-region">
      <div
        className="chat-scroll"
        ref={viewport}
        tabIndex={0}
        role="region"
        aria-label="对话消息，可滚动阅读"
        onWheel={(event) => {
          if (event.deltaY < 0) following.current = false;
        }}
        onTouchMove={() => {
          following.current = false;
        }}
        onScroll={() => {
          const el = viewport.current;
          if (!el) return;
          const near = el.scrollHeight - el.clientHeight - el.scrollTop < 48;
          if (el.scrollTop < lastTop.current - 2) following.current = false;
          if (near) following.current = true;
          lastTop.current = el.scrollTop;
          setShowLatest(!near);
        }}
      >
        <div className="chat-transcript">
          {messages.length > limit && (
            <Button
              className="chat-load-earlier"
              variant="outline"
              onClick={() => {
                const el = viewport.current;
                if (!el) return;
                const height = el.scrollHeight,
                  top = el.scrollTop;
                following.current = false;
                setLimit((previous) => previous + 30);
                requestAnimationFrame(() => {
                  el.scrollTop = top + el.scrollHeight - height;
                });
              }}
            >
              展开更早的 {Math.min(30, messages.length - limit)} 条消息
            </Button>
          )}
          {visible.map((message, index) => (
            <MessageItem
              key={message.id}
              message={message}
              last={!running && index === visible.length - 1}
              onRegenerate={onRegenerate}
              onError={onError}
            />
          ))}
          <div className="chat-scroll-end" />
        </div>
      </div>
      {showLatest && (
        <Button
          className="chat-jump-latest"
          variant="outline"
          size="sm"
          onClick={bottom}
        >
          <ArrowDown />
          最新消息
        </Button>
      )}
      <span className="chat-sr-only" role="status" aria-live="polite">
        {running
          ? "豆伴正在生成回答。"
          : last?.role === "assistant"
            ? "回答已结束。"
            : ""}
      </span>
    </div>
  );
}
