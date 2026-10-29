import React from "react";
import assert from "node:assert/strict";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
  cleanup,
  within,
} from "@testing-library/react";
import ChatApp from "../src/chat/ChatApp";
import * as core from "../src/chat/generated/core";
import { MessageList } from "../src/chat/MessageList";
import type { Message, Session, Settings } from "../src/chat/types";
const key = "fixture-key-not-a-real-credential";
let count = 0;
const test = async (name: string, run: () => Promise<void> | void) => {
  try {
    await run();
    count++;
    console.log("✓ " + name);
  } finally {
    cleanup();
  }
};
const config: Settings = core.defaults();
const data = {
  pets: [
    { id: "qiu", name: "豆米", birthday: "", weights: [] },
    { id: "dou", name: "豆糕", birthday: "", weights: [] },
  ],
  photos: [],
  notes: [],
  checkins: {},
  members: [],
  todos: [],
  carePlans: [],
  planLogs: {},
  handover: {},
};
const reset = () => {
  for (const session of core.listSessions()) core.removeSession(session.id);
  core.saveSettings(config, { secret: key, remember: false });
};
let exits = 0;
const mount = () =>
  render(
    <ChatApp getFamily={() => data} onExit={() => exits++} origin="pets" />,
  );
const question = () => screen.getByRole("textbox", { name: "向豆伴提问" });
const message = (
  id: string,
  role: Message["role"],
  content: string,
  status: Message["status"] = "complete",
): Message => ({
  id,
  role,
  content,
  status,
  createdAt: new Date().toISOString(),
});
function seed(content = "历史回答") {
  const time = new Date().toISOString(),
    session: Session = {
      id: "fixture-session",
      title: "照顾记录测试",
      createdAt: time,
      updatedAt: time,
      messages: [
        message("u", "user", "请整理照顾"),
        message("a", "assistant", content),
      ],
    };
  core.saveSession(session);
  return session;
}
function stream(chunks: string[], delay = 1) {
  let sent = 0;
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      await new Promise((resolve) => setTimeout(resolve, delay));
      if (sent < chunks.length)
        controller.enqueue(encoder.encode(chunks[sent++]));
      else controller.close();
    },
  });
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}
const delta = (text: string, finish: string | null = null) =>
  "data: " +
  JSON.stringify({
    choices: [{ delta: { content: text }, finish_reason: finish }],
  }) +
  "\n\n";

await test("返回按钮从对话到列表再到来源页，保留输入并高亮当前会话", async () => {
  reset();
  exits = 0;
  mount();
  fireEvent.change(question(), { target: { value: "这是一份未发送的草稿" } });
  fireEvent.click(screen.getByRole("button", { name: "返回", exact: true }));
  assert.ok(screen.getByRole("heading", { name: "会话列表" }));
  assert.ok(document.querySelector('[aria-current="true"]'));
  fireEvent.click(screen.getByRole("button", { name: /新的对话.*当前会话/ }));
  assert.equal(
    (question() as HTMLTextAreaElement).value,
    "这是一份未发送的草稿",
  );
  fireEvent.click(screen.getByRole("button", { name: "返回", exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "返回", exact: true }));
  assert.equal(exits, 1);
});
await test("空输入禁发，示例仅填入输入框，不自动调用接口", () => {
  reset();
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    throw new Error();
  };
  mount();
  assert.equal(
    (screen.getByRole("button", { name: "发送消息" }) as HTMLButtonElement)
      .disabled,
    true,
  );
  fireEvent.click(screen.getByRole("button", { name: /安排今天的照顾/ }));
  assert.ok((question() as HTMLTextAreaElement).value.includes("豆米"));
  assert.equal(calls, 0);
});
await test("Enter 发送真实组件请求，流式累积，结束后可重新生成", async () => {
  reset();
  let calls = 0;
  globalThis.fetch = async (_url, init) => {
    calls++;
    const payload = JSON.parse(String(init?.body));
    assert.ok(JSON.stringify(payload.messages).includes("豆米"));
    assert.equal(payload.apiKey, undefined);
    return stream([
      delta("第一段"),
      delta("，第二段", "stop"),
      "data: [DONE]\n\n",
    ]);
  };
  mount();
  fireEvent.change(question(), { target: { value: "整理记录" } });
  fireEvent.keyDown(question(), { key: "Enter", code: "Enter", keyCode: 13 });
  await waitFor(() => assert.ok(screen.getByText("第一段，第二段")));
  await waitFor(() =>
    assert.ok(screen.getByRole("button", { name: "重新生成" })),
  );
  assert.equal(calls, 1);
  fireEvent.click(screen.getByRole("button", { name: "重新生成" }));
  await waitFor(() => assert.equal(calls, 2));
  await waitFor(() =>
    assert.ok(screen.getByRole("button", { name: "重新生成" })),
  );
});
await test("Shift+Enter 与输入法组合回车不发送", () => {
  reset();
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    throw new Error();
  };
  mount();
  fireEvent.change(question(), { target: { value: "尚未确认的文字" } });
  fireEvent.keyDown(question(), { key: "Enter", shiftKey: true });
  fireEvent.keyDown(question(), {
    key: "Enter",
    isComposing: true,
    keyCode: 229,
  });
  assert.equal(calls, 0);
});
await test("停止生成保留部分回答；迟到数据不会覆写", async () => {
  reset();
  let abort = false;
  globalThis.fetch = async (_url, init) => {
    init?.signal?.addEventListener("abort", () => {
      abort = true;
    });
    return stream(
      [
        delta("已收到的部分"),
        delta("迟到内容"),
        delta("不该覆盖", "stop"),
        "data: [DONE]\n\n",
      ],
      180,
    );
  };
  mount();
  fireEvent.change(question(), { target: { value: "停止测试" } });
  fireEvent.click(screen.getByRole("button", { name: "发送消息" }));
  await waitFor(() => assert.ok(screen.getByText("已收到的部分")));
  fireEvent.click(screen.getByRole("button", { name: "停止生成" }));
  await waitFor(() => assert.ok(screen.getByText("已停止 · 保留部分回答")));
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 250));
  });
  assert.ok(abort);
  assert.ok(screen.queryByText("已收到的部分"));
  assert.equal(screen.queryByText("已收到的部分迟到内容不该覆盖"), null);
});
await test("HTTP 失败显示可重试状态，不泄漏服务端正文", async () => {
  reset();
  globalThis.fetch = async () =>
    new Response("private-upstream-detail", { status: 429 });
  mount();
  fireEvent.change(question(), { target: { value: "错误测试" } });
  fireEvent.click(screen.getByRole("button", { name: "发送消息" }));
  await waitFor(() => assert.ok(screen.getByRole("button", { name: "重试" })));
  assert.ok(screen.getByRole("alert"));
  assert.ok(!document.body.textContent?.includes("private-upstream-detail"));
});
await test("Markdown 代码高亮/表格/引用渲染，代码和消息可复制", async () => {
  reset();
  seed(
    '## 照顾示例\n\n> 仅用于隔离测试\n\n| 项目 | 状态 |\n|---|---|\n| 喂草 | 待记录 |\n\n```js\nconst rabbit = "豆米";\n```',
  );
  mount();
  assert.ok(screen.getByRole("table"));
  assert.ok(document.querySelector("blockquote"));
  assert.ok(document.querySelector(".hljs-keyword"));
  fireEvent.click(screen.getByRole("button", { name: "复制代码" }));
  await waitFor(() =>
    assert.equal(
      (globalThis as { __copied?: string }).__copied,
      'const rabbit = "豆米";',
    ),
  );
  fireEvent.click(screen.getByRole("button", { name: "复制回答" }));
  await waitFor(() =>
    assert.ok(
      (globalThis as { __copied?: string }).__copied?.includes("## 照顾示例"),
    ),
  );
});
await test("模型 HTML 与远程图片不执行，不自动下载", () => {
  reset();
  seed(
    "<script>malicious()</script>\n\n![不应加载](https://outside.invalid/track)",
  );
  mount();
  assert.equal(document.querySelector("script"), null);
  assert.equal(document.querySelector(".chat-markdown img"), null);
});
await test("会话切换、搜索、新建各自独立，草稿按会话保留", () => {
  reset();
  const first = seed();
  const second = {
    ...first,
    id: "other",
    title: "另一份对话",
    updatedAt: "2020-01-01T00:00:00Z",
    messages: [],
  };
  core.saveSession(second);
  mount();
  fireEvent.change(question(), { target: { value: "第一份的草稿" } });
    fireEvent.click(screen.getByRole("button", { name: /^另一份对话/ }));
  assert.equal((question() as HTMLTextAreaElement).value, "");
    fireEvent.click(screen.getByRole("button", { name: /^照顾记录测试/ }));
  assert.equal((question() as HTMLTextAreaElement).value, "第一份的草稿");
  fireEvent.change(screen.getByRole("textbox", { name: "搜索对话标题" }), {
    target: { value: "不存在的标题" },
  });
  assert.ok(screen.getByText(/没有找到这个标题/));
  fireEvent.click(
    screen.getAllByRole("button", { name: "新建对话", exact: true })[0],
  );
  assert.equal((question() as HTMLTextAreaElement).value, "");
});
await test("资料预览只读且列出实际范围，无外部网络", async () => {
  reset();
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    throw new Error();
  };
  mount();
  fireEvent.click(screen.getByRole("button", { name: /资料范围/ }));
  const dialog = screen.getByRole("dialog");
  assert.ok(within(dialog).getByRole("heading", { name: "本次家庭资料" }));
  assert.ok(dialog.textContent?.includes("豆米"));
  assert.ok(dialog.textContent?.includes("尚未发送"));
  assert.equal(calls, 0);
});
await test("移动端抽屉有名称，Esc 关闭并恢复触发器焦点", async () => {
  reset();
  mount();
  const trigger = screen.getByRole("button", { name: "打开会话抽屉" });
  trigger.focus();
  fireEvent.click(trigger);
  const dialog = screen.getByRole("dialog");
  assert.ok(within(dialog).getByRole("heading", { name: "会话导航" }));
  await waitFor(() => assert.ok(dialog.contains(document.activeElement)));
  fireEvent.keyDown(document.activeElement || dialog, { key: "Escape" });
  await waitFor(() => assert.equal(screen.queryByRole("dialog"), null));
  await waitFor(() => assert.equal(document.activeElement, trigger));
});
await test("深色模式、侧栏折叠与返回按钮保持独立", () => {
  reset();
  mount();
  fireEvent.click(screen.getByRole("button", { name: "切换深色模式" }));
  assert.equal(
    document.querySelector(".chat-workspace")?.getAttribute("data-theme"),
    "dark",
  );
  fireEvent.click(screen.getByRole("button", { name: "折叠侧栏" }));
  assert.ok(screen.getByRole("button", { name: "展开侧栏" }));
  assert.ok(screen.getByRole("button", { name: "返回", exact: true }));
});
await test("设置使用可聚焦表单、范围开关，并阻止跨主机沿用密钥", async () => {
  reset();
  mount();
  fireEvent.click(screen.getAllByRole("button", { name: "连接与资料设置" })[0]);
  const dialog = screen.getByRole("dialog");
  const address = within(dialog).getByRole("textbox", { name: /API 地址/ });
  fireEvent.change(address, {
    target: { value: "https://another.invalid/v1" },
  });
  fireEvent.submit(dialog.querySelector("form")!);
  await waitFor(() => assert.ok(within(dialog).getByRole("alert")));
  assert.ok(dialog.textContent?.includes("重新输入"));
  assert.equal(core.getSettings().baseUrl, config.baseUrl);
});
await test("长对话初始只挂载末 40 条，可展开；上滚暂停自动跟随", async () => {
  const messages = Array.from({ length: 60 }, (_, index) =>
    message("long-" + index, index % 2 ? "assistant" : "user", "消息" + index),
  );
  const props = {
    sessionId: "long",
    running: true,
    onRegenerate() {},
    onError() {},
  };
  const rendered = render(<MessageList {...props} messages={messages} />);
  assert.equal(screen.getAllByRole("article").length, 40);
  const region = screen.getByRole("region", { name: /对话消息/ });
  Object.defineProperties(region, {
    scrollHeight: { configurable: true, value: 2000 },
    clientHeight: { configurable: true, value: 400 },
  });
  region.scrollTop = 100;
  fireEvent.wheel(region, { deltaY: -100 });
  fireEvent.scroll(region);
  const updated = messages.map((item, index) =>
    index === 59 ? { ...item, content: "消息59更新" } : item,
  );
  rendered.rerender(<MessageList {...props} messages={updated} />);
  assert.equal(region.scrollTop, 100);
  assert.ok(screen.getByRole("button", { name: "最新消息" }));
  fireEvent.click(screen.getByRole("button", { name: /展开更早/ }));
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 5));
  });
  assert.equal(screen.getAllByRole("article").length, 60);
});
console.log(
  `\n✓ ${count} 组 React DOM 验证通过；未使用真实 API、未写入用户资料，不代表浏览器截图验收。`,
);
window.close();
