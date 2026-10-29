import { useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  Download,
  RotateCcw,
  Search,
  ShieldCheck,
} from "lucide-react";
import { Badge, Button, Card } from "../design/primitives";
import {
  DataTableState,
  PageHeader,
  ProductHeader,
} from "../patterns/product-patterns";
import { careItems, localDay, type ProductPageProps } from "./product-types";
const validDay = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  localDay(new Date(value + "T12:00:00")) === value;
const timeOf = (value?: string) =>
  value && Number.isFinite(+new Date(value))
    ? new Date(value).toLocaleTimeString("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
const csvCell = (value: string) =>
  '"' +
  (/^[=+\-@\t\r]/.test(value) ? "'" : "") +
  value.replaceAll('"', '""') +
  '"';
export default function CareWorkspace({
  state,
  setState,
  go,
  openAI,
  storageError,
}: ProductPageProps) {
  const today = localDay(),
    [date, setDate] = useState(today),
    [petId, setPetId] = useState("all"),
    [status, setStatus] = useState("all"),
    [query, setQuery] = useState(""),
    [selected, setSelected] = useState<string[]>([]),
    [notice, setNotice] = useState(""),
    [error, setError] = useState("");
  const readOnly = date !== today;
  const allRows = state.pets.flatMap((pet) =>
    careItems.map((item) => ({
      id: pet.id + ":" + item.id,
      pet,
      item,
      recorded: state.checkins[pet.id + ":" + date]?.[item.id] || "",
    })),
  );
  const rows = allRows.filter(
    (row) =>
      (petId === "all" || row.pet.id === petId) &&
      (status === "all" ||
        (status === "done" ? !!row.recorded : !row.recorded)) &&
      (row.pet.name + row.item.name + row.item.detail).includes(query.trim()),
  );
  const count = allRows.filter((row) => row.recorded).length;
  useEffect(() => {
    setSelected([]);
    setNotice("");
  }, [date, petId, status, query]);
  const update = (ids: string[], remove = false) => {
    if (readOnly || storageError || !validDay(date) || date !== localDay()) {
      setError("当前日期不可编辑，请切换到今天后再记录。");
      return;
    }
    const changes = allRows.filter(
      (row) =>
        ids.includes(row.id) && (remove ? !!row.recorded : !row.recorded),
    );
    if (!changes.length) return;
    const now = new Date().toISOString();
    setState((previous) => {
      const checkins = { ...previous.checkins };
      for (const row of changes) {
        const key = row.pet.id + ":" + date;
        const marks = { ...(checkins[key] || {}) };
        if (remove) delete marks[row.item.id];
        else marks[row.item.id] = now;
        checkins[key] = marks;
      }
      return { ...previous, checkins };
    });
    setSelected([]);
    setError("");
    setNotice(
      remove
        ? `已撤销 ${changes.length} 项记录。`
        : `已记录 ${changes.length} 项照顾，误记可在本页撤销。`,
    );
  };
  const exportCSV = () => {
    try {
      const text =
        "\uFEFF" +
        [
          ["日期", "兔兔", "照顾事项", "记录状态", "记录时间"],
          ...rows.map((row) => [
            date,
            row.pet.name,
            row.item.name,
            row.recorded ? "已记录" : "未记录",
            row.recorded,
          ]),
        ]
          .map((row) => row.map(csvCell).join(","))
          .join("\r\n");
      const url = URL.createObjectURL(
          new Blob([text], { type: "text/csv;charset=utf-8" }),
        ),
        link = document.createElement("a");
      link.href = url;
      link.download = `兔兔照顾记录-${date}.csv`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice("已生成当前筛选的 CSV 文件。");
    } catch {
      setError("导出未成功，请稍后重试。");
    }
  };
  const days = Array.from({ length: 7 }, (_, index) => {
    const day = new Date();
    day.setDate(day.getDate() - index);
    const key = localDay(day);
    return {
      date: key,
      count: state.pets.reduce(
        (sum, pet) =>
          sum +
          careItems.filter(
            (item) => state.checkins[pet.id + ":" + key]?.[item.id],
          ).length,
        0,
      ),
    };
  });
  return (
    <div className="chat-app product-app product-workspace">
      <ProductHeader current="care" onNavigate={go} onAI={openAI} />
      <div className="product-workspace-content">
        <PageHeader
          title="照顾工作台"
          description="把今天的照顾认真记好。未记录，不等于没有照顾。"
          onBack={() => go("home")}
          action={
            <Button
              disabled={readOnly || !!storageError || !selected.length}
              onClick={() => update(selected)}
            >
              <Check />
              记录选中{selected.length ? `（${selected.length}）` : ""}
            </Button>
          }
        />
        <div className="product-workspace-stats">
          <div>
            <span>{date === today ? "今日记录" : "当日记录"}</span>
            <strong>
              {count}
              <small> / {allRows.length}</small>
            </strong>
          </div>
          <div>
            <span>未记录事项</span>
            <strong>
              {allRows.length - count}
              <small> 项</small>
            </strong>
          </div>
          <div>
            <span>正在照顾</span>
            <strong>
              {state.pets.length}
              <small> 只兔兔</small>
            </strong>
          </div>
          <div>
            <span>资料保存</span>
            <strong className="product-stat-text">
              本机<small>独立存储</small>
            </strong>
          </div>
        </div>
        <div className="product-workspace-grid">
          <Card className="product-task-card">
            <div className="product-task-title">
              <div>
                <h2>照顾事项</h2>
                <Badge>{readOnly ? "历史只读" : "今天可记录"}</Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={exportCSV}
                disabled={!rows.length}
              >
                <Download />
                导出 CSV
              </Button>
            </div>
            <div className="product-filters">
              <label>
                <span>日期</span>
                <input
                  type="date"
                  value={date}
                  max={today}
                  aria-label="记录日期"
                  onChange={(event) => {
                    const value = event.target.value;
                    if (validDay(value) && value <= today) {
                      setDate(value);
                      setError("");
                    } else setError("请选择有效且不晚于今天的日期。");
                  }}
                />
              </label>
              <label>
                <span>兔兔</span>
                <select
                  value={petId}
                  aria-label="筛选兔兔"
                  onChange={(event) => setPetId(event.target.value)}
                >
                  <option value="all">全部兔兔</option>
                  {state.pets.map((pet) => (
                    <option key={pet.id} value={pet.id}>
                      {pet.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>状态</span>
                <select
                  value={status}
                  aria-label="筛选记录状态"
                  onChange={(event) => setStatus(event.target.value)}
                >
                  <option value="all">全部状态</option>
                  <option value="pending">未记录</option>
                  <option value="done">已记录</option>
                </select>
              </label>
              <label className="product-filter-search">
                <span>查找事项</span>
                <div>
                  <Search size={14} />
                  <input
                    aria-label="搜索照顾事项"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="事项或兔兔名称"
                  />
                </div>
              </label>
            </div>
            {(error || notice) && (
              <p
                className={
                  "product-table-feedback " + (error ? "product-error" : "")
                }
                role={error ? "alert" : "status"}
              >
                {error || notice}
              </p>
            )}
            {readOnly && (
              <p className="product-readonly">
                <ShieldCheck size={13} />
                历史记录仅供回看。切回今天可继续记录。
              </p>
            )}
            <DataTableState empty={!rows.length} error={storageError}>
              <div
                className="product-table-wrap"
                tabIndex={0}
                role="region"
                aria-label="照顾事项表格，可横向滚动"
              >
                <table className="product-task-table">
                  <thead>
                    <tr>
                      <th className="product-selection-col">
                        <input
                          type="checkbox"
                          aria-label="选择当前筛选下所有未记录事项"
                          disabled={
                            readOnly || !rows.some((row) => !row.recorded)
                          }
                          checked={
                            rows.some((row) => !row.recorded) &&
                            rows
                              .filter((row) => !row.recorded)
                              .every((row) => selected.includes(row.id))
                          }
                          onChange={(event) =>
                            setSelected(
                              event.target.checked
                                ? rows
                                    .filter((row) => !row.recorded)
                                    .map((row) => row.id)
                                : [],
                            )
                          }
                        />
                      </th>
                      <th>兔兔 / 事项</th>
                      <th>状态</th>
                      <th>记录时间</th>
                      <th className="product-row-operation">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr
                        key={row.id}
                        data-selected={selected.includes(row.id)}
                      >
                        <td>
                          <input
                            type="checkbox"
                            aria-label={`选择${row.pet.name}的${row.item.name}`}
                            disabled={readOnly || !!row.recorded}
                            checked={selected.includes(row.id)}
                            onChange={(event) =>
                              setSelected((previous) =>
                                event.target.checked
                                  ? [...previous, row.id]
                                  : previous.filter((id) => id !== row.id),
                              )
                            }
                          />
                        </td>
                        <td>
                          <div className="product-task-name">
                            <span
                              className={
                                "product-pet-token product-pet-" + row.pet.id
                              }
                            >
                              {row.pet.name.slice(0, 1)}
                            </span>
                            <span>
                              <strong>
                                {row.pet.name}
                                <i>·</i>
                                {row.item.name}
                              </strong>
                              <small>{row.item.detail}</small>
                            </span>
                          </div>
                        </td>
                        <td>
                          <Badge tone={row.recorded ? "success" : "neutral"}>
                            {row.recorded ? "已记录" : "未记录"}
                          </Badge>
                        </td>
                        <td className="product-time-cell">
                          {timeOf(row.recorded)}
                        </td>
                        <td className="product-row-operation">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={readOnly || !!storageError}
                            onClick={() => update([row.id], !!row.recorded)}
                            aria-label={`${row.recorded ? "撤销" : "记录"}${row.pet.name}的${row.item.name}`}
                          >
                            {row.recorded ? <RotateCcw /> : <Check />}
                            {row.recorded ? "撤销" : "记录"}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </DataTableState>
            <div className="product-table-footer">
              <span>
                显示 {rows.length} / {allRows.length} 项
              </span>
              <span>每只兔兔每日四项基础照顾</span>
            </div>
          </Card>
          <aside className="product-workspace-aside">
            <Card>
              <div className="product-aside-heading">
                <h2>最近七天</h2>
                <span>已记录 / 总项数</span>
              </div>
              {days.map((day) => (
                <button
                  key={day.date}
                  className="product-day-row"
                  aria-pressed={day.date === date}
                  onClick={() => setDate(day.date)}
                >
                  <span>
                    {day.date === today
                      ? "今天"
                      : day.date.slice(5).replace("-", "/")}
                  </span>
                  <span className="product-mini-bar">
                    <i
                      style={{
                        width: `${allRows.length ? (day.count / allRows.length) * 100 : 0}%`,
                      }}
                    />
                  </span>
                  <strong>
                    {day.count}/{allRows.length}
                  </strong>
                </button>
              ))}
            </Card>
            <Card className="product-workspace-note">
              <ShieldCheck size={19} />
              <h2>记录由你确认</h2>
              <p>
                只记录你实际完成的照顾。时间是本机打卡时间，不推断实际喂养时间，也不替代健康判断。
              </p>
              <button onClick={openAI}>
                让豆伴帮我整理
                <ArrowRight size={14} />
              </button>
            </Card>
            <button className="product-open-pet" onClick={() => go("pets")}>
              查看兔兔完整档案
              <ArrowRight size={14} />
            </button>
          </aside>
        </div>
      </div>
    </div>
  );
}
