import React, { useState } from "react";
import { Button, Icon } from "./ui";
import { localDate, careTypes, careKey } from "./data";
import "./care-history.css";

const weekdays = ["日", "一", "二", "三", "四", "五", "六"];

// Calendar dates are constructed locally at noon so daylight-saving changes
// cannot shift a selected day into the preceding date.
function localDay(date) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

function marksFor(state, petId, date) {
  const source = state.checkins?.[careKey(petId, date)] || {};
  return careTypes.filter((type) => {
    const value = source[type.id];
    return typeof value === "string" && Number.isFinite(+new Date(value));
  });
}

export function CareHistory({ state, pet }) {
  const today = localDate();
  const [month, setMonth] = useState(() => {
    const date = localDay(today);
    return new Date(date.getFullYear(), date.getMonth(), 1, 12);
  });
  const [selectedDate, setSelectedDate] = useState(today);
  if (!pet) return null;

  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const monthLabel = `${year} 年 ${monthIndex + 1} 月`;
  const currentMonth = today.slice(0, 7);
  const visibleMonth = localDate(month).slice(0, 7);
  const lastDay = new Date(year, monthIndex + 1, 0, 12).getDate();
  const leadingDays = month.getDay();
  const cellCount = Math.ceil((leadingDays + lastDay) / 7) * 7;
  const selectedMarks = marksFor(state, pet.id, selectedDate);
  const selectedSource = state.checkins?.[careKey(pet.id, selectedDate)] || {};
  const selectedLabel = localDay(selectedDate).toLocaleDateString("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "long",
  });
  const recentDays = Array.from({ length: 7 }, (_, offset) => {
    const date = localDay(today);
    date.setDate(date.getDate() - (6 - offset));
    const key = localDate(date);
    return { date: key, count: marksFor(state, pet.id, key).length };
  });
  const recentCount = recentDays.reduce((total, day) => total + day.count, 0);
  const completeDays = recentDays.filter((day) => day.count === 4).length;

  const moveMonth = (delta) => {
    const next = new Date(year, monthIndex + delta, 1, 12);
    if (localDate(next).slice(0, 7) > currentMonth) return;
    setMonth(next);
    setSelectedDate(
      localDate(next).slice(0, 7) === currentMonth ? today : localDate(next),
    );
  };
  const returnToday = () => {
    const date = localDay(today);
    setMonth(new Date(date.getFullYear(), date.getMonth(), 1, 12));
    setSelectedDate(today);
  };

  return (
    <section className="care-history" aria-label={`${pet.name}的照顾手账`}>
      <header className="care-history-heading">
        <div>
          <span className="care-history-eyebrow">一页页，都是爱你的证据</span>
          <h3><Icon name="NotebookPen" size={23} /> 照顾小月历 <span>♡</span></h3>
        </div>
        <span className="care-history-owner">{pet.name} 专属</span>
      </header>

      <div className="care-history-summary" aria-label="最近七天照顾统计，包含今天">
        <div>
          <small>近 7 天的小小照顾</small>
          <strong>{recentCount}<span> / 28 次</span></strong>
        </div>
        <div>
          <small>四项都完成的日子</small>
          <strong>{completeDays}<span> / 7 天</span></strong>
        </div>
        <p><Icon name="Heart" size={14} /> 每天四项，只记下真实发生的照顾。</p>
      </div>

      <div className="care-history-layout">
        <div className="care-calendar-paper">
          <div className="care-calendar-navigation">
            <button type="button" aria-label="查看上个月照顾记录" onClick={() => moveMonth(-1)}>
              <Icon name="ArrowLeft" size={19} />
            </button>
            <strong aria-live="polite">{monthLabel}</strong>
            <button type="button" aria-label="查看下个月照顾记录" disabled={visibleMonth >= currentMonth} onClick={() => moveMonth(1)}>
              <Icon name="ArrowRight" size={19} />
            </button>
          </div>
          <div className="care-calendar-weekdays" aria-hidden="true">
            {weekdays.map((day) => <span key={day}>{day}</span>)}
          </div>
          <div className="care-calendar-days" role="group" aria-label={`${monthLabel}，选择日期查看照顾记录`}>
            {Array.from({ length: cellCount }, (_, cell) => {
              const day = cell - leadingDays + 1;
              if (day < 1 || day > lastDay) return <span key={`blank-${cell}`} aria-hidden="true" />;
              const date = localDate(new Date(year, monthIndex, day, 12));
              const future = date > today;
              const count = marksFor(state, pet.id, date).length;
              return (
                <button
                  type="button"
                  key={date}
                  className={`care-calendar-day ${selectedDate === date ? "is-selected" : ""} ${count === 4 ? "is-complete" : ""}`}
                  disabled={future}
                  aria-pressed={selectedDate === date}
                  aria-current={date === today ? "date" : undefined}
                  aria-label={`${date}${date === today ? "，今天" : ""}，${future ? "尚未到来" : `完成 ${count} 项照顾`}`}
                  onClick={() => setSelectedDate(date)}
                >
                  <span>{day}</span>
                  <span className="care-calendar-marks" aria-hidden="true">
                    {careTypes.map((type, index) => <i key={type.id} className={index < count ? "filled" : ""} />)}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="care-calendar-footer">
            <span><i /> 四颗爱心点，代表四项照顾</span>
            <Button variant="small" icon="Sun" onClick={returnToday}>回到今天</Button>
          </div>
        </div>

        <div className="care-history-detail" aria-live="polite" aria-atomic="true">
          <span className="care-history-detail-kicker">{selectedDate === today ? "今天的温柔场记" : "翻到这一天的照顾"}</span>
          <div className="care-history-date">
            <h4>{selectedLabel}</h4>
            <span>{selectedMarks.length} / 4 项</span>
          </div>
          <p className="care-history-detail-hint">{selectedDate === today ? "今天的打卡变化，会在这里同步留下记录。" : "这里只读回看历史，让每一次照顾有迹可循。"}</p>
          <ol className="care-history-timeline">
            {careTypes.map((type) => {
              const completed = selectedMarks.some((mark) => mark.id === type.id);
              return (
                <li key={type.id} className={completed ? "recorded" : ""}>
                  <span className="care-history-type-icon"><Icon name={type.icon} size={19} /></span>
                  <strong>{type.label}</strong>
                  {completed ? <time dateTime={selectedSource[type.id]}>{new Date(selectedSource[type.id]).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}</time> : <span className="care-history-missing">尚无记录</span>}
                  {completed && <Icon name="Check" size={16} />}
                </li>
              );
            })}
          </ol>
          {!selectedMarks.length && <p className="care-history-empty"><Icon name="Rabbit" size={24} /><span>{selectedDate === today ? "今天的第一份照顾，还在等你写下。" : "这一天还没有留下照顾记录。"}</span></p>}
        </div>
      </div>
    </section>
  );
}

export default CareHistory;
