import React, { useEffect, useState } from "react";
import { Button, Icon, Bunny, PageTitle } from "./ui";
import { Photo } from "./media";
import { careCount, uid, localDate, activePhotos } from "./data";

export function TodoNote({ state, setState, notify }) {
  const [text, setText] = useState("");
  const add = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setState((s) => ({
      ...s,
      todos: [...s.todos, { id: uid(), text: text.trim(), done: false }],
    }));
    setText("");
    notify("把小事贴好了 ♡");
  };
  return (
    <section className="todo-note">
      <span className="tape mint" />
      <div className="note-heading">
        <h3>今天的小事</h3>
        <Icon name="Sun" size={27} />
      </div>
      <div className="todo-list">
        {state.todos.length ? (
          state.todos.map((t) => (
            <div className={`todo-row ${t.done ? "done" : ""}`} key={t.id}>
              <button
                aria-label={`${t.done ? "取消完成" : "完成"}：${t.text}`}
                aria-pressed={t.done}
                className="check-box"
                onClick={() =>
                  setState((s) => ({
                    ...s,
                    todos: s.todos.map((x) =>
                      x.id === t.id ? { ...x, done: !x.done } : x,
                    ),
                  }))
                }
              >
                {t.done && <Icon name="Check" size={17} />}
              </button>
              <span>{t.text}</span>
              <button
                className="tiny-button"
                aria-label={`删除待办：${t.text}`}
                onClick={() => {
                  setState((s) => ({
                    ...s,
                    todos: s.todos.filter((x) => x.id !== t.id),
                  }));
                  notify("这张小便签收好啦");
                }}
              >
                <Icon name="X" size={15} />
              </button>
            </div>
          ))
        ) : (
          <p className="muted">今天没有待办，和兔兔发会儿呆。</p>
        )}
      </div>
      <form onSubmit={add} className="todo-add">
        <input
          aria-label="新待办"
          placeholder="再添一件小事…"
          value={text}
          maxLength={60}
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit" className="tiny-button" aria-label="添加待办">
          <Icon name="Plus" size={19} />
        </button>
      </form>
    </section>
  );
}

export default function Home({ state, setState, go, open, notify }) {
  const photos = activePhotos(state);
  const [slide, setSlide] = useState(0);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing || !photos.length) return;
    const id = setInterval(
      () => setSlide((n) => (n + 1) % Math.max(1, photos.length)),
      4200,
    );
    return () => clearInterval(id);
  }, [playing, photos.length]);
  const photo = photos[slide % Math.max(1, photos.length)];
  const now = new Date();
  const date = localDate().replaceAll("-", ".");
  return (
    <div className="home page-enter">
      <div className="home-heading">
        <PageTitle title="我们家" />
        <div className="date-note">
          <span className="pin" />
          <small>{now.getFullYear()} 年</small>
          <strong>
            {String(now.getMonth() + 1).padStart(2, "0")} /{" "}
            {String(now.getDate()).padStart(2, "0")}
          </strong>
          <span>
            星期{"日一二三四五六"[now.getDay()]} · 宜贴贴{" "}
            <Icon name="Sun" size={19} />
          </span>
        </div>
      </div>
      <section className="opening-scene">
        <div className="opening-copy">
          <span className="little-film">
            <Icon name="Clapperboard" size={18} /> 我们的家庭映画
          </span>
          <h2>
            小日子，
            <br />
            <span>慢慢放映。</span>
            <i>✦</i>
          </h2>
          <p>
            两只兔兔，一屋子的可爱。
            <br />
            把平凡的每一天，收藏成喜欢的模样。
          </p>
          <Button
            variant="pink tape-button"
            icon="NotebookPen"
            onClick={() => open({ type: "journal" })}
          >
            翻开今日手账
          </Button>
          <button
            className="text-button opening-link"
            onClick={() => go("pets")}
          >
            去看看两位小主 <Icon name="ArrowUpRight" size={18} />
          </button>
          <div className="doodle-dash" aria-hidden="true">
            ⌁ ⌁ <span>♡</span>
          </div>
        </div>
        <figure className="hero-polaroid">
          <span className="tape pink-dots" />
          <div className="film-window">
            <button
              className="photo-hit"
              onClick={() =>
                photo ? open({ type: "photo", id: photo.id }) : go("album")
              }
              aria-label={`放大照片：${photo?.title || "等第一帧美好入镜"}`}
            >
              {photo ? (
                <Photo item={photo} key={photo.id} className="hero-photo" />
              ) : (
                <div className="empty-frame">
                  <Bunny size={65} />
                  <strong>回忆暂时收起来啦</strong>
                  <span>去相册取回一帧，继续慢慢放映。</span>
                </div>
              )}
            </button>
            <span className="film-corner tl" />
            <span className="film-corner tr" />
            <span className="film-corner bl" />
            <span className="film-corner br" />
            <span className="frame-mark">
              <span /> LIFE WITH BUNNIES
            </span>
          </div>
          <figcaption>
            <div className="film-actions">
              <button
                className="icon-button"
                aria-label={playing ? "暂停回忆放映" : "播放回忆放映"}
                disabled={!photos.length}
                onClick={() => setPlaying((v) => !v)}
              >
                <Icon name={playing ? "Pause" : "Play"} size={20} />
              </button>
              <span className="photo-caption">
                {photo?.title || "等第一帧美好入镜"} ♡
              </span>
            </div>
            <div className="film-counter">
              <span>
                {String(
                  photos.length ? (slide % photos.length) + 1 : 0,
                ).padStart(2, "0")}{" "}
                <i>/ {String(photos.length).padStart(2, "0")}</i>
              </span>
              <button
                className="icon-button"
                aria-label="下一张回忆"
                disabled={!photos.length}
                onClick={() =>
                  setSlide((n) => (n + 1) % Math.max(1, photos.length))
                }
              >
                <Icon name="ArrowRight" />
              </button>
            </div>
          </figcaption>
          <div className="photo-stamp">
            <Bunny size={43} />
            <span>一起可爱</span>
          </div>
        </figure>
      </section>
      <section className="daily-collage">
        <div className="pet-notes">
          <div className="section-kicker">
            <span>两位小主，今日营业中</span>
            <span>♡</span>
          </div>
          {state.pets.map((p, i) => (
            <button
              className={`pet-slip ${i ? "peach" : "mint"}`}
              onClick={() => go("pets", p.id)}
              key={p.id}
            >
              <img src={p.photo} alt={p.name} />
              <div>
                <h3>
                  {p.name} <span>♡</span>
                </h3>
                <p>
                  {careCount(state, p.id) === 4
                    ? "被好好照顾的一天"
                    : "今天也要好好照顾你"}
                </p>
              </div>
              <div className="care-stamp">
                <span>今日照顾</span>
                <strong>
                  {careCount(state, p.id)}
                  <i> / 4</i>
                </strong>
              </div>
              <Icon name="ArrowUpRight" size={19} />
            </button>
          ))}
        </div>
        <TodoNote state={state} setState={setState} notify={notify} />
      </section>
      <section className="memories-home">
        <div className="section-heading">
          <div>
            <span className="handwritten">little things, big love</span>
            <h2>
              捡来的小美好 <span>♡</span>
            </h2>
          </div>
          <button className="text-button" onClick={() => go("album")}>
            把回忆摊开 <Icon name="ArrowRight" size={18} />
          </button>
        </div>
        <div className="memory-strip">
          {photos.slice(0, 4).map((p, i) => (
            <button
              className={`mini-polaroid tilt-${i % 3}`}
              key={p.id}
              onClick={() => open({ type: "photo", id: p.id })}
            >
              <Photo item={p} loading="lazy" />
              <span>{p.title}</span>
              {p.liked && <i>♡</i>}
            </button>
          ))}
        </div>
      </section>
      <div className="home-footer">
        <Bunny size={35} />
        <span>和你们在一起，就是最好的日常。</span>
        <small>{date} · 我们的故事还在继续</small>
      </div>
    </div>
  );
}
