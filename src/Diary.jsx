import React, { useMemo, useState } from "react";
import { Button, Icon, PageTitle, Drawer, Empty } from "./ui";
import { Photo } from "./media";
import { activePhotos, localDate, uid } from "./data";
import "./diary.css";
export const moods = ["开心", "治愈", "平静", "想念", "有点累"];
const moodMarks = { 开心: "☀", 治愈: "♡", 平静: "☁", 想念: "✉", 有点累: "☾" };
export default function Diary({ state, setState, notify, open }) {
  const [query, setQuery] = useState(""),
    [mood, setMood] = useState("全部"),
    [petId, setPetId] = useState("全部"),
    [month, setMonth] = useState(""),
    [trash, setTrash] = useState(false),
    [current, setCurrent] = useState(null);
  const notes = useMemo(
    () =>
      state.notes
        .filter(
          (n) =>
            !!n.trashedAt === trash &&
            (!query.trim() ||
              [n.title, n.body, ...(n.tags || [])]
                .join(" ")
                .toLowerCase()
                .includes(query.trim().toLowerCase())) &&
            (mood === "全部" || n.mood === mood) &&
            (petId === "全部" || n.petIds?.includes(petId)) &&
            (!month || n.date?.startsWith(month)),
        )
        .sort(
          (a, b) =>
            (b.date || "").localeCompare(a.date || "") ||
            String(b.createdAt).localeCompare(String(a.createdAt)),
        ),
    [state.notes, query, mood, petId, month, trash],
  );
  const softDelete = (id) => {
    setState((s) => ({
      ...s,
      notes: s.notes.map((n) =>
        n.id === id ? { ...n, trashedAt: new Date().toISOString() } : n,
      ),
    }));
    setCurrent(null);
    notify("日记已放进回收信箱，可以随时取回");
  };
  const restore = (id) => {
    setState((s) => ({
      ...s,
      notes: s.notes.map((n) => (n.id === id ? { ...n, trashedAt: null } : n)),
    }));
    notify("这一页故事又回来了 ♡");
  };
  const note = state.notes.find((n) => n.id === current);
  return (
    <div className="diary-page page-enter">
      <PageTitle
        title="小日子信笺"
        subtitle="把心情写成旁白，把我们留在每一页。"
      >
        <Button
          variant="pink tape-button"
          icon="NotebookPen"
          onClick={() => open({ type: "note" })}
        >
          写一页故事
        </Button>
      </PageTitle>
      <div className="diary-toolbar paper-card">
        <label className="search-field">
          <Icon name="Search" size={18} />
          <input
            aria-label="搜索日记"
            placeholder="找一找那天的心情、故事或标签…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div className="diary-filters">
          <label>
            心情
            <select
              aria-label="按心情筛选日记"
              value={mood}
              onChange={(e) => setMood(e.target.value)}
            >
              <option>全部</option>
              {moods.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>
          <label>
            小主
            <select
              aria-label="按兔兔筛选日记"
              value={petId}
              onChange={(e) => setPetId(e.target.value)}
            >
              <option value="全部">全部</option>
              {state.pets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            月份
            <input
              aria-label="按月份筛选日记"
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          </label>
          <button
            className="text-button"
            onClick={() => {
              setQuery("");
              setMood("全部");
              setPetId("全部");
              setMonth("");
            }}
          >
            清空筛选
          </button>
        </div>
      </div>
      <div className="diary-section-heading">
        <div>
          <span className="handwritten">
            {trash ? "被暂时收起的故事" : "每一页，都是闪闪发光的小日子"}
          </span>
          <p>找到 {notes.length} 页故事</p>
        </div>
        <button
          className={`button small ${trash ? "pink" : ""}`}
          onClick={() => {
            setTrash((v) => !v);
            setCurrent(null);
          }}
        >
          <Icon name={trash ? "NotebookPen" : "Archive"} size={17} />
          {trash ? "回到故事" : "回收信箱"}
        </button>
      </div>
      <div className="diary-shelf">
        {notes.map((n, i) => {
          const photo = state.photos.find(
            (p) => p.id === n.photoIds?.[0] && !p.trashedAt,
          );
          return (
            <article key={n.id} className={`story-letter letter-${i % 3}`}>
              <span className="tape" />
              <button
                className="story-letter-hit"
                onClick={() => setCurrent(n.id)}
              >
                <div className="story-letter-date">
                  <span>{n.date || "未记日期"}</span>
                  <i>
                    {moodMarks[n.mood] || "♡"} {n.mood || "平静"}
                  </i>
                </div>
                <h3>{n.title}</h3>
                <p>{n.body || "这一页没有旁白，照片已经说了很多。"}</p>
                {photo && <Photo item={photo} className="story-thumb" />}
                <div className="story-letter-tags">
                  {n.petIds?.map((id) => (
                    <span key={id}>
                      ♡ {state.pets.find((p) => p.id === id)?.name || "兔兔"}
                    </span>
                  ))}
                  {n.tags?.map((t) => (
                    <span key={t}>#{t}</span>
                  ))}
                </div>
              </button>
              <div className="story-letter-actions">
                {trash ? (
                  <button className="text-button" onClick={() => restore(n.id)}>
                    <Icon name="RotateCcw" size={15} /> 取回这一页
                  </button>
                ) : (
                  <>
                    <button
                      className="text-button"
                      onClick={() => open({ type: "note", id: n.id })}
                    >
                      <Icon name="Pencil" size={15} /> 续写
                    </button>
                    <button
                      className="text-button"
                      aria-label={`收起日记：${n.title}`}
                      onClick={() => softDelete(n.id)}
                    >
                      <Icon name="Archive" size={15} />
                    </button>
                  </>
                )}
              </div>
            </article>
          );
        })}
      </div>
      {!notes.length && (
        <Empty
          text={
            trash
              ? "回收信箱空空的，故事都好好收着。"
              : "没有找到这页故事，换个筛选试试吧。"
          }
        >
          <Button
            variant="pink"
            icon="Plus"
            onClick={() => open({ type: "note" })}
          >
            写下第一个瞬间
          </Button>
        </Empty>
      )}
      {note && (
        <Drawer title="这一页的小故事" wide onClose={() => setCurrent(null)}>
          <article className="story-detail">
            <span className="handwritten">
              {note.date} · {note.mood || "平静"}
            </span>
            <h2>{note.title}</h2>
            <p>{note.body}</p>
            <div className="story-detail-photos">
              {note.photoIds?.map((id) => {
                const p = state.photos.find((p) => p.id === id && !p.trashedAt);
                return p ? (
                  <button
                    key={id}
                    onClick={() => {
                      setCurrent(null);
                      open({ type: "photo", id, ids: note.photoIds });
                    }}
                  >
                    <Photo item={p} />
                  </button>
                ) : (
                  <small key={id}>这张照片已暂时收起</small>
                );
              })}
            </div>
            <div className="story-detail-footer">
              <small>
                创建于 {new Date(note.createdAt).toLocaleString("zh-CN")}
                {note.updatedAt &&
                  ` · 修改于 ${new Date(note.updatedAt).toLocaleString("zh-CN")}`}
              </small>
              {!note.trashedAt && (
                <Button
                  variant="pink"
                  icon="Pencil"
                  onClick={() => {
                    setCurrent(null);
                    open({ type: "note", id: note.id });
                  }}
                >
                  继续写这一页
                </Button>
              )}
            </div>
          </article>
        </Drawer>
      )}
    </div>
  );
}

export function NoteEditor({ state, note, setState, notify, onClose }) {
  const [title, setTitle] = useState(note?.title || ""),
    [body, setBody] = useState(note?.body || ""),
    [date, setDate] = useState(note?.date || localDate()),
    [mood, setMood] = useState(note?.mood || "治愈"),
    [petIds, setPetIds] = useState(note?.petIds || []),
    [photoIds, setPhotoIds] = useState(note?.photoIds || []),
    [tags, setTags] = useState(note?.tags?.join("，") || "");
  const toggle = (list, set, id, max = 99) =>
    set(
      list.includes(id)
        ? list.filter((x) => x !== id)
        : list.length < max
          ? [...list, id]
          : list,
    );
  const save = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    const now = new Date().toISOString();
    const entry = {
      ...note,
      id: note?.id || uid(),
      title: title.trim(),
      body: body.trim(),
      date,
      mood,
      petIds,
      photoIds,
      tags: [
        ...new Set(
          tags
            .split(/[,，]/)
            .map((t) => t.trim())
            .filter(Boolean),
        ),
      ].slice(0, 6),
      createdAt: note?.createdAt || now,
      updatedAt: note ? now : null,
      trashedAt: null,
    };
    setState((s) => ({
      ...s,
      notes: note
        ? s.notes.map((n) => (n.id === note.id ? entry : n))
        : [entry, ...s.notes],
    }));
    notify(note ? "这一页的旁白更新啦 ♡" : "新的故事已经收好啦 ♡");
    onClose();
  };
  return (
    <form className="form-stack note-editor" onSubmit={save}>
      <div className="note-quote">
        小事也值得被记住，
        <br />
        比如，今天又多喜欢你们一点。
      </div>
      <label>
        给这一刻起个名字
        <input
          required
          maxLength={60}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="今天发生了什么可爱的事？"
        />
      </label>
      <label>
        故事发生在哪一天
        <input
          required
          type="date"
          max={localDate()}
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </label>
      <fieldset>
        <legend>今天的心情</legend>
        <div className="mood-options">
          {moods.map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mood === m}
              className={mood === m ? "selected" : ""}
              onClick={() => setMood(m)}
            >
              <span>{moodMarks[m]}</span>
              {m}
            </button>
          ))}
        </div>
      </fieldset>
      <label>
        心情旁白
        <textarea
          maxLength={4000}
          rows={6}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="慢慢写，兔兔在旁边陪着你。"
        />
      </label>
      <fieldset>
        <legend>谁出现在这一页？</legend>
        <div className="note-pet-options">
          {state.pets.map((p) => (
            <button
              type="button"
              key={p.id}
              aria-pressed={petIds.includes(p.id)}
              className={petIds.includes(p.id) ? "selected" : ""}
              onClick={() => toggle(petIds, setPetIds, p.id)}
            >
              <img src={p.photo} alt="" />
              {p.name}
              {petIds.includes(p.id) && <Icon name="Check" size={15} />}
            </button>
          ))}
        </div>
      </fieldset>
      <label>
        给故事贴标签（逗号分隔，最多 6 个）
        <input
          maxLength={100}
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="贴贴，开心，平凡的一天"
        />
      </label>
      <fieldset>
        <legend>夹几张照片（最多 4 张）</legend>
        <div className="note-photo-picker">
          {activePhotos(state).map((p) => (
            <button
              type="button"
              key={p.id}
              aria-label={`关联照片：${p.title}`}
              aria-pressed={photoIds.includes(p.id)}
              className={photoIds.includes(p.id) ? "selected" : ""}
              onClick={() => toggle(photoIds, setPhotoIds, p.id, 4)}
            >
              <Photo item={p} />
              {photoIds.includes(p.id) && (
                <span>
                  <Icon name="Check" size={14} />
                </span>
              )}
            </button>
          ))}
        </div>
        {photoIds
          .filter((id) => !activePhotos(state).some((p) => p.id === id))
          .map((id) => (
            <button
              type="button"
              className="text-button danger"
              key={id}
              onClick={() => setPhotoIds((ids) => ids.filter((x) => x !== id))}
            >
              <Icon name="X" size={15} />
              取消已收起照片：
              {state.photos.find((p) => p.id === id)?.title || "照片文件已缺失"}
            </button>
          ))}
      </fieldset>
      <Button
        type="submit"
        variant="pink tape-button"
        icon="Heart"
        disabled={!title.trim()}
      >
        {note ? "保存这一页的修改" : "把这一刻收好"}
      </Button>
    </form>
  );
}
