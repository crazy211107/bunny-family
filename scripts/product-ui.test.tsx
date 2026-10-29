import React, { useState } from "react";
import assert from "node:assert/strict";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
  within,
  act,
} from "@testing-library/react";
import LandingHome from "../src/pages/LandingHome";
import CareWorkspace from "../src/pages/CareWorkspace";
import { DataTableState } from "../src/patterns/product-patterns";
import { createInitialState } from "../src/data";
import App from "../src/App";
import { localDay, type FamilyData } from "../src/pages/product-types";
let passed = 0;
const test = async (name: string, run: () => void | Promise<void>) => {
  try {
    await run();
    passed++;
    console.log("✓ " + name);
  } finally {
    cleanup();
  }
};
window.scrollTo = () => {};
const day = localDay();
const fixture = (): FamilyData => ({
  ...createInitialState(),
  checkins: { ["qiu:" + day]: { hay: new Date().toISOString() } },
});
function Workspace({ error = "" }: { error?: string }) {
  const [state, setState] = useState(fixture());
  return (
    <CareWorkspace
      state={state}
      setState={setState}
      go={() => {}}
      openAI={() => {}}
      storageError={error}
    />
  );
}
await test("首页有真实照片与同源记录证明，主 CTA 到达核心功能", () => {
  const routes: string[] = [];
  render(
    <LandingHome
      state={fixture()}
      setState={() => {}}
      go={(page) => routes.push(page)}
      openAI={() => routes.push("ai")}
    />,
  );
  const image = screen.getByAltText("豆米和豆糕依偎在一起的真实照片");
  assert.equal(image.getAttribute("src"), "/photos/together-home.jpg");
  assert.equal(
    screen
      .getByRole("progressbar", { name: "豆米今日记录" })
      .getAttribute("aria-valuenow"),
    "1",
  );
  assert.equal(
    screen
      .getByRole("progressbar", { name: "豆糕今日记录" })
      .getAttribute("aria-valuenow"),
    "0",
  );
  fireEvent.click(screen.getByRole("button", { name: "打开照顾工作台" }));
  assert.equal(routes.at(-1), "care");
  assert.ok(!document.body.textContent?.includes("节省 90%"));
  assert.ok(screen.getByText("私人家庭项目 · 当前版本无云同步"));
});
await test("移动导航可展开并直接进入功能页，不依赖返回", () => {
  const routes: string[] = [];
  render(
    <LandingHome
      state={fixture()}
      setState={() => {}}
      go={(page) => routes.push(page)}
      openAI={() => {}}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "展开产品导航" }));
  const nav = screen.getByRole("navigation", { name: "移动端产品导航" });
  fireEvent.click(within(nav).getByRole("link", { name: /照顾工作台/ }));
  assert.equal(routes.at(-1), "care");
  assert.equal(
    screen.queryByRole("navigation", { name: "移动端产品导航" }),
    null,
  );
});
await test("工作台单项记录及撤销使用真实状态，不改另一只兔兔", () => {
  render(<Workspace />);
  assert.equal(screen.getAllByRole("row").length, 9);
  fireEvent.click(screen.getByRole("button", { name: "记录豆糕的换水" }));
  assert.ok(screen.getByRole("button", { name: "撤销豆糕的换水" }));
  assert.ok(screen.getByRole("button", { name: "记录豆米的换水" }));
  fireEvent.click(screen.getByRole("button", { name: "撤销豆糕的换水" }));
  assert.ok(screen.getByRole("button", { name: "记录豆糕的换水" }));
});
await test("批量只记录显式勾选事项，主操作空选禁用", () => {
  render(<Workspace />);
  assert.equal(
    (screen.getByRole("button", { name: "记录选中" }) as HTMLButtonElement)
      .disabled,
    true,
  );
  fireEvent.click(screen.getByRole("checkbox", { name: "选择豆米的换水" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "选择豆糕的陪玩" }));
  fireEvent.click(screen.getByRole("button", { name: "记录选中（2）" }));
  assert.ok(screen.getByRole("button", { name: "撤销豆米的换水" }));
  assert.ok(screen.getByRole("button", { name: "撤销豆糕的陪玩" }));
  assert.ok(screen.getByRole("button", { name: "记录豆米的陪玩" }));
});
await test("兔兔/状态/关键词筛选与空状态，筛选改变清除旧选择", async () => {
  render(<Workspace />);
  fireEvent.click(screen.getByRole("checkbox", { name: "选择豆糕的换水" }));
  fireEvent.change(screen.getByRole("combobox", { name: "筛选兔兔" }), {
    target: { value: "qiu" },
  });
  await waitFor(() =>
    assert.equal(
      (screen.getByRole("button", { name: "记录选中" }) as HTMLButtonElement)
        .disabled,
      true,
    ),
  );
  assert.equal(screen.getAllByRole("row").length, 5);
  fireEvent.change(screen.getByRole("combobox", { name: "筛选记录状态" }), {
    target: { value: "done" },
  });
  assert.equal(screen.getAllByRole("row").length, 2);
  fireEvent.change(screen.getByRole("textbox", { name: "搜索照顾事项" }), {
    target: { value: "不存在的事项" },
  });
  assert.ok(screen.getByText("这个筛选下没有事项"));
});
await test("过去日期保持只读，未来日期被拒绝", () => {
  render(<Workspace />);
  const past = new Date();
  past.setDate(past.getDate() - 1);
  fireEvent.change(screen.getByLabelText("记录日期"), {
    target: { value: localDay(past) },
  });
  assert.ok(screen.getByText("历史只读"));
  assert.equal(
    (
      screen.getByRole("button", {
        name: "记录豆米的换水",
      }) as HTMLButtonElement
    ).disabled,
    true,
  );
  const future = new Date();
  future.setDate(future.getDate() + 1);
  fireEvent.change(screen.getByLabelText("记录日期"), {
    target: { value: localDay(future) },
  });
  assert.ok(screen.getByRole("alert").textContent?.includes("不晚于今天"));
});
await test("CSV 导出按当前筛选生成，用户字段防止公式注入", async () => {
  const data = fixture();
  data.pets[0].name = "=1+1";
  let blob: Blob | undefined,
    filename = "";
  const create = URL.createObjectURL,
    revoke = URL.revokeObjectURL,
    click = HTMLAnchorElement.prototype.click;
  URL.createObjectURL = (value) => {
    blob = value as Blob;
    return "blob:test-fixture";
  };
  URL.revokeObjectURL = () => {};
  HTMLAnchorElement.prototype.click = function () {
    filename = this.download;
  };
  try {
    render(
      <CareWorkspace
        state={data}
        setState={() => {}}
        go={() => {}}
        openAI={() => {}}
      />,
    );
    fireEvent.change(screen.getByRole("combobox", { name: "筛选兔兔" }), {
      target: { value: "qiu" },
    });
    fireEvent.click(screen.getByRole("button", { name: "导出 CSV" }));
    assert.ok(filename.includes(day));
    const text = await blob!.text();
    assert.ok(text.includes("'=1+1"));
    assert.ok(!text.includes("豆糕"));
  } finally {
    URL.createObjectURL = create;
    URL.revokeObjectURL = revoke;
    HTMLAnchorElement.prototype.click = click;
  }
});
await test("存储错误、加载与空数据状态都有可读说明", () => {
  const view = render(<Workspace error="本机空间不足" />);
  assert.ok(screen.getByRole("alert").textContent?.includes("本机空间不足"));
  assert.equal(
    (screen.getByRole("button", { name: "记录选中" }) as HTMLButtonElement)
      .disabled,
    true,
  );
  view.unmount();
  const loading = render(
    <DataTableState loading empty={false}>
      <span>不应提前展示</span>
    </DataTableState>,
  );
  assert.ok(screen.getByRole("status").textContent?.includes("正在读取"));
  assert.equal(screen.queryByText("不应提前展示"), null);
  loading.unmount();
  render(
    <DataTableState empty>
      <span>无数据</span>
    </DataTableState>,
  );
  assert.ok(screen.getByText("这个筛选下没有事项"));
});
await test("真实 App 路由：首页→工作台→AI→返回列表→返回工作台", async () => {
  localStorage.setItem("bunny-cinema-v1", JSON.stringify(fixture()));
  window.history.replaceState(null, "", "#/home");
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "打开照顾工作台" }));
  assert.ok(screen.getByRole("heading", { name: "照顾工作台" }));
  assert.equal(window.location.hash, "#/care");
  fireEvent.click(screen.getByRole("button", { name: "打开豆伴 AI 对话" }));
  await waitFor(() =>
    assert.ok(screen.getByRole("textbox", { name: "向豆伴提问" })),
  );
  fireEvent.click(screen.getByRole("button", { name: "返回", exact: true }));
  assert.ok(screen.getByRole("heading", { name: "会话列表" }));
  fireEvent.click(screen.getByRole("button", { name: "返回", exact: true }));
  await waitFor(() =>
    assert.ok(screen.getByRole("heading", { name: "照顾工作台" })),
  );
  assert.equal(window.location.hash, "#/care");
  fireEvent.click(screen.getByRole("button", { name: "返回首页" }));
  assert.equal(window.location.hash, "#/home");
});
console.log(
  `\n✓ ${passed} 组首页/工作台 DOM 验证通过；无真实网络、未写用户资料，不代表像素/真机验收。`,
);
window.close();
