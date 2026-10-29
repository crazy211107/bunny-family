import CareHistory from "./CareHistory";
import React, { useEffect, useRef, useState } from "react";
import { Button, Icon, PageTitle, Empty } from "./ui";
import {
  careTypes,
  careKey,
  careCount,
  localDate,
  streak,
  ageLabel,
  daysUntil,
  uid,
} from "./data";
export function WeightChart({ weights }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!weights.length) return;
    const canvas = ref.current;
    const w = canvas.clientWidth || 500,
      h = 180;
    canvas.width = w * 2;
    canvas.height = h * 2;
    const c = canvas.getContext("2d");
    c.scale(2, 2);
    c.clearRect(0, 0, w, h);
    const values = weights.map((x) => x.kg);
    let min = Math.min(...values) - 0.1,
      max = Math.max(...values) + 0.1;
    const x = (i) =>
      36 + (w - 70) * (weights.length === 1 ? 0.5 : i / (weights.length - 1));
    const y = (v) => h - 32 - ((v - min) / (max - min)) * (h - 66);
    c.font = "11px sans-serif";
    c.fillStyle = "#958999";
    c.strokeStyle = "#dcd0cf";
    c.setLineDash([4, 5]);
    for (let i = 0; i < 3; i++) {
      const yy = 25 + i * 56;
      c.beginPath();
      c.moveTo(35, yy);
      c.lineTo(w - 20, yy);
      c.stroke();
      c.fillText((max - ((max - min) * i) / 2).toFixed(2), 0, yy + 4);
    }
    c.strokeStyle = "#adbc95";
    c.lineWidth = 2;
    c.beginPath();
    values.forEach((v, i) => {
      if (!i) c.moveTo(x(i), y(v));
      else {
        const mid = (x(i - 1) + x(i)) / 2;
        c.bezierCurveTo(mid, y(values[i - 1]), mid, y(v), x(i), y(v));
      }
    });
    c.stroke();
    c.setLineDash([]);
    values.forEach((v, i) => {
      c.save();
      c.translate(x(i), y(v));
      c.rotate(0.3);
      c.fillStyle = "#e6ac72";
      c.beginPath();
      c.moveTo(-5, -5);
      c.lineTo(4, -5);
      c.lineTo(0, 8);
      c.closePath();
      c.fill();
      c.strokeStyle = "#87ab83";
      c.beginPath();
      c.moveTo(0, -5);
      c.lineTo(-3, -10);
      c.moveTo(0, -5);
      c.lineTo(4, -11);
      c.stroke();
      c.restore();
      c.fillStyle = "#958999";
      if (i === 0 || i === values.length - 1)
        c.fillText(weights[i].date.slice(5), x(i) - 15, h - 7);
    });
  }, [weights]);
  return weights.length ? (
    <canvas
      className="weight-canvas"
      ref={ref}
      role="img"
      aria-label={`体重趋势，共 ${weights.length} 条记录，最新 ${weights.at(-1).kg.toFixed(2)} kg`}
    />
  ) : (
    <Empty text="还没有体重记录，第一笔从今天开始。" />
  );
}

export default function Pets({
  state,
  setState,
  selected,
  setSelected,
  open,
  notify,
}) {
  const pet = state.pets.find((p) => p.id === selected) || state.pets[0];
  const done = state.checkins[careKey(pet.id)] || {};
  const count = careCount(state, pet.id);
  const days = streak(state, pet.id);
  const toggle = (type) => {
    setState((s) => {
      const key = careKey(pet.id);
      const marks = { ...(s.checkins[key] || {}) };
      if (marks[type]) delete marks[type];
      else marks[type] = new Date().toISOString();
      return { ...s, checkins: { ...s.checkins, [key]: marks } };
    });
    notify(
      done[type]
        ? "已撤销这次打卡"
        : `${pet.name}的${careTypes.find((t) => t.id === type).label}已打卡 ♡`,
    );
  };
  return (
    <div className="page-enter pet-page">
      <PageTitle title="兔兔档案" subtitle="每一份小小的照顾，都是大大的爱。">
        <div className="pet-switch">
          {state.pets.map((p) => (
            <button
              className={p.id === pet.id ? "selected" : ""}
              aria-pressed={p.id === pet.id}
              onClick={() => setSelected(p.id)}
              key={p.id}
            >
              <img src={p.photo} alt="" />
              {p.name}
            </button>
          ))}
        </div>
      </PageTitle>
      <section className="pet-feature">
        <div className="pet-portrait">
          <img src={pet.photo} alt={`${pet.name}的照片`} />
          <span className="tape pink-dots" />
          <div className="portrait-note">本片主演：{pet.name} ♡</div>
        </div>
        <div className="pet-information">
          <div className="pet-name-row">
            <h2>
              {pet.name}
              <span>♡</span>
            </h2>
            <button
              className="text-button"
              onClick={() => open({ type: "pet-edit", id: pet.id })}
            >
              完善档案 <Icon name="Pencil" size={16} />
            </button>
          </div>
          <div className="pet-facts">
            <div>
              <small>小小身份</small>
              <span>{pet.breed || "品种待填写"}</span>
            </div>
            <div>
              <small>在这个世界</small>
              <span>{ageLabel(pet.birthday)}</span>
            </div>
            <div>
              <small>最近体重</small>
              <span>
                {pet.weights.length
                  ? `${pet.weights.at(-1).kg.toFixed(2)} kg`
                  : "等你记第一笔"}
              </span>
            </div>
            <div>
              <small>绝育状态</small>
              <span>{pet.neutered}</span>
            </div>
          </div>
          <div className="care-title">
            <h3>今日照顾打卡</h3>
            <span>{count} / 4 已完成</span>
          </div>
          <div className="checkin-grid">
            {careTypes.map((t, i) => (
              <button
                key={t.id}
                className={`care-button care-${i} ${done[t.id] ? "checked" : ""}`}
                aria-label={`${pet.name}${t.label}`}
                aria-pressed={!!done[t.id]}
                onClick={() => toggle(t.id)}
              >
                <Icon name={done[t.id] ? "Check" : t.icon} size={28} />
                <strong>{t.label}</strong>
                <small>
                  {done[t.id]
                    ? new Date(done[t.id]).toLocaleTimeString("zh-CN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "轻轻点一下"}
                </small>
              </button>
            ))}
          </div>
          <p className={`streak-note ${days >= 7 ? "unlocked" : ""}`}>
            <Icon name={days >= 7 ? "Award" : "Sparkles"} size={19} />
            {days >= 7
              ? `兔兔守护者 · 已连续 ${days} 天`
              : `${days ? `已连续完成 ${days} 天` : "把今天的四份爱心集齐吧"}，连续 7 天解锁守护者徽章`}
          </p>
        </div>
      </section>
      <CareHistory state={state} pet={pet} />
      <section className="pet-records">
        <div className="paper-card weight-card">
          <div className="section-heading">
            <h3>
              <Icon name="ChartNoAxesCombined" />
              体重小曲线
            </h3>
            <Button
              icon="Plus"
              variant="small pink"
              onClick={() => open({ type: "weight", id: pet.id })}
            >
              记一笔
            </Button>
          </div>
          <WeightChart weights={pet.weights} />
          {pet.weights.length > 0 && (
            <div className="weight-logs">
              {pet.weights.map((w) => (
                <div key={w.date}>
                  <span>{w.date}</span>
                  <strong>{w.kg.toFixed(2)} kg</strong>
                  <button
                    className="tiny-button"
                    aria-label={`删除 ${w.date} 体重`}
                    onClick={() => {
                      setState((s) => ({
                        ...s,
                        pets: s.pets.map((p) =>
                          p.id === pet.id
                            ? {
                                ...p,
                                weights: p.weights.filter(
                                  (x) => x.date !== w.date,
                                ),
                              }
                            : p,
                        ),
                      }));
                      notify("体重记录已删除");
                    }}
                  >
                    <Icon name="X" size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="reminder-note">
          <span className="tape pink-dots" />
          <div className="section-heading">
            <h3>
              <Icon name="Bell" />
              健康小提醒
            </h3>
            <button
              className="icon-button"
              aria-label="添加健康提醒"
              onClick={() => open({ type: "reminder", id: pet.id })}
            >
              <Icon name="Plus" />
            </button>
          </div>
          {pet.reminders.length ? (
            pet.reminders.map((r) => {
              const n = daysUntil(r.date);
              return (
                <div
                  className={`reminder-item ${n < 7 ? "urgent" : ""}`}
                  key={r.id}
                >
                  <div>
                    <strong>{r.title}</strong>
                    <small>
                      {r.date} ·{" "}
                      {n < 0
                        ? `已逾期 ${-n} 天`
                        : n === 0
                          ? "就是今天"
                          : `还有 ${n} 天`}
                    </small>
                  </div>
                  <button
                    className="tiny-button"
                    aria-label={`删除提醒：${r.title}`}
                    onClick={() =>
                      setState((s) => ({
                        ...s,
                        pets: s.pets.map((p) =>
                          p.id === pet.id
                            ? {
                                ...p,
                                reminders: p.reminders.filter(
                                  (x) => x.id !== r.id,
                                ),
                              }
                            : p,
                        ),
                      }))
                    }
                  >
                    <Icon name="X" size={15} />
                  </button>
                </div>
              );
            })
          ) : (
            <>
              <p>
                还没有设置提醒。
                <br />
                把需要记住的日期，贴在这里吧。
              </p>
              <button
                className="text-button"
                onClick={() => open({ type: "reminder", id: pet.id })}
              >
                贴一张提醒便签 <Icon name="ArrowUpRight" size={17} />
              </button>
            </>
          )}
          <small className="health-note">提醒内容与日期由你填写。</small>
        </div>
      </section>
    </div>
  );
}

export function PetEdit({ pet, setState, onClose, notify }) {
  const [form, setForm] = useState(pet);
  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <form
      className="form-stack"
      onSubmit={(e) => {
        e.preventDefault();
        setState((s) => ({
          ...s,
          pets: s.pets.map((p) =>
            p.id === pet.id ? { ...p, ...form, name: form.name.trim() } : p,
          ),
        }));
        notify("小主的档案贴好啦 ♡");
        onClose();
      }}
    >
      <img className="form-avatar" src={pet.photo} alt={pet.name} />
      <label>
        小主的名字
        <input
          required
          value={form.name}
          maxLength={20}
          onChange={(e) => update("name", e.target.value)}
        />
      </label>
      <label>
        品种 / 小小介绍
        <input
          value={form.breed}
          maxLength={40}
          placeholder="不知道也没关系，可以先留空"
          onChange={(e) => update("breed", e.target.value)}
        />
      </label>
      <label>
        生日
        <input
          type="date"
          value={form.birthday}
          max={localDate()}
          onChange={(e) => update("birthday", e.target.value)}
        />
      </label>
      <label>
        绝育状态
        <select
          value={form.neutered}
          onChange={(e) => update("neutered", e.target.value)}
        >
          <option>待填写</option>
          <option>已绝育</option>
          <option>未绝育</option>
          <option>暂不记录</option>
        </select>
      </label>
      <Button
        variant="pink tape-button"
        icon="Heart"
        type="submit"
        disabled={!form.name.trim()}
      >
        保存这位小主
      </Button>
      <p className="muted form-hint">
        白色兔兔叫豆米，黄色兔兔叫豆糕；名字也可以在这里调整。
      </p>
    </form>
  );
}
export function WeightForm({ pet, setState, onClose, notify }) {
  const [date, setDate] = useState(localDate());
  const [value, setValue] = useState("");
  const existing = pet.weights.find((x) => x.date === date);
  return (
    <form
      className="form-stack"
      onSubmit={(e) => {
        e.preventDefault();
        const kg = Number(value);
        if (!Number.isFinite(kg) || kg <= 0) return;
        setState((s) => ({
          ...s,
          pets: s.pets.map((p) =>
            p.id === pet.id
              ? {
                  ...p,
                  weights: [
                    ...p.weights.filter((x) => x.date !== date),
                    { date, kg: Math.round(kg * 100) / 100 },
                  ].sort((a, b) => a.date.localeCompare(b.date)),
                }
              : p,
          ),
        }));
        notify(existing ? "当天体重已更新" : "新的成长记录收好啦");
        onClose();
      }}
    >
      <p>给 {pet.name} 记一笔，慢慢看着你长大。</p>
      <label>
        记录日期
        <input
          type="date"
          required
          value={date}
          max={localDate()}
          onChange={(e) => setDate(e.target.value)}
        />
      </label>
      <label>
        体重（kg）
        <input
          type="number"
          required
          min="0.01"
          step="0.01"
          value={value}
          placeholder={existing ? existing.kg.toFixed(2) : "例如 1.25"}
          onChange={(e) => setValue(e.target.value)}
        />
      </label>
      {existing && <p className="muted">这天已有记录，保存将更新当天体重。</p>}
      <Button type="submit" variant="pink" icon="Check">
        保存体重
      </Button>
    </form>
  );
}
export function ReminderForm({ pet, setState, onClose, notify }) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  return (
    <form
      className="form-stack"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        setState((s) => ({
          ...s,
          pets: s.pets.map((p) =>
            p.id === pet.id
              ? {
                  ...p,
                  reminders: [
                    ...p.reminders,
                    { id: uid(), title: title.trim(), date },
                  ],
                }
              : p,
          ),
        }));
        notify("提醒便签贴好了");
        onClose();
      }}
    >
      <p>只记录你为 {pet.name} 安排的事项。</p>
      <label>
        提醒事项
        <input
          required
          maxLength={40}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="例如：预约复查"
        />
      </label>
      <label>
        日期
        <input
          type="date"
          required
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </label>
      <Button type="submit" variant="pink" icon="Bell">
        贴上提醒
      </Button>
    </form>
  );
}
