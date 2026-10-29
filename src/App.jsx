import React, { Suspense, lazy, useEffect, useRef, useState } from "react";
import { BunnyLogo } from "./chat/ui";
const ChatApp = lazy(() => import("./chat/ChatApp"));
import Home, { TodoNote } from "./Home";
import Pets, { PetEdit, WeightForm, ReminderForm } from "./Pets";
import Family, { MemberForm } from "./Family";
import Album, { PhotoTheater } from "./Album";
import Studio from "./Studio";
import Diary, { NoteEditor } from "./Diary";
import { Button, Icon, Bunny, Drawer, Empty } from "./ui";
import { Photo, imageFile, putMedia } from "./media";
import { useFamilyStore, localDate, careCount, uid } from "./data";

const chapters = [
  {
    id: "home",
    name: "手账墙",
    line: "小日子，慢慢放映。",
    icon: "NotebookPen",
    photo: "/photos/together-home.jpg",
  },
  {
    id: "pets",
    name: "兔兔档案",
    line: "把每一份照顾，认真记好。",
    icon: "Rabbit",
    photo: "/photos/qiuqiu-close.jpg",
  },
  {
    id: "family",
    name: "家庭成员",
    line: "我们故事里的每一个你。",
    icon: "UsersRound",
    photo: "/photos/together-sleep.jpg",
  },
  {
    id: "studio",
    name: "创意工坊",
    line: "给回忆，加一点小心思。",
    icon: "WandSparkles",
    photo: "/photos/doudou-close.jpg",
  },
  {
    id: "album",
    name: "回忆相册",
    line: "可爱的片段，值得慢慢看。",
    icon: "Images",
    photo: "/photos/qiuqiu-home.jpg",
  },
  {
    id: "diary",
    name: "小日子信笺",
    line: "每一页，都是我们的心情旁白。",
    icon: "NotebookPen",
    photo: "/photos/together-home.jpg",
  },
];
export default function App() {
  const [state, setState, storageError] = useFamilyStore();
  const [page, setPage] = useState(() =>
    ["home", "pets", "family", "studio", "album", "diary"].includes(
      window.location.hash.slice(2),
    )
      ? window.location.hash.slice(2)
      : "home",
  );
  const [aiOpen, setAiOpen] = useState(() => window.location.hash === "#/ai");
  const aiOrigin = useRef({ hash: "", scroll: 0 });
  const [selectedPet, setSelectedPet] = useState("qiu");
  const [overlay, setOverlay] = useState(null);
  const [menu, setMenu] = useState(false);
  const [fab, setFab] = useState(false);
  const [toast, setToast] = useState("");
  const [burst, setBurst] = useState(false);
  const [studioPhoto, setStudioPhoto] = useState(null);
  const [studioMode, setStudioMode] = useState("photo");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const timer = useRef(null),
    burstTimer = useRef(null),
    fileInput = useRef(null),
    holdTimer = useRef(null),
    longPressed = useRef(false);
  const notify = (message) => {
    setToast(message);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(""), 3500);
  };
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      clearTimeout(burstTimer.current);
      clearTimeout(holdTimer.current);
    },
    [],
  );
  useEffect(() => {
    const route = () => {
      const next = window.location.hash.slice(2);
      setAiOpen(next === "ai");
      if (["home", "pets", "family", "studio", "album", "diary"].includes(next))
        setPage(next);
      else if (!next) setPage("home");
    };
    window.addEventListener("hashchange", route);
    return () => window.removeEventListener("hashchange", route);
  }, []);
  useEffect(() => {
    const key = (e) => {
      if (e.key === "Escape") {
        setMenu(false);
        setFab(false);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  const go = (id, pet, mode = "photo") => {
    setPage(id);
    window.history.pushState(
      null,
      "",
      window.location.pathname + window.location.search + "#/" + id,
    );
    if (pet) setSelectedPet(pet);
    setStudioMode(mode);
    setMenu(false);
    setFab(false);
    setOverlay(null);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const editPhoto = (photo) => {
    setStudioPhoto(photo);
    go("studio");
  };
  const open = (value) => {
    setOverlay(value);
    setFab(false);
  };
  const upload = () => {
    setFab(false);
    fileInput.current?.click();
  };
  const pick = async (e) => {
    const files = Array.from(e.target.files || []).slice(0, 12);
    if (!files.length) return;
    setUploading(true);
    const added = [],
      failed = [];
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadProgress(`${i + 1} / ${files.length} · ${file.name}`);
        try {
          const blob = await imageFile(file),
            id = uid();
          await putMedia(id, blob);
          added.push({
            id,
            mediaKey: id,
            title:
              file.name.replace(/\.[^.]+$/, "").slice(0, 40) ||
              "新的一帧小美好",
            tag: "未分类",
            petIds: [],
            date: localDate(),
            liked: false,
          });
        } catch (error) {
          failed.push(`${file.name}：${error.message || "保存失败"}`);
        }
      }
      if (e.target.files.length > 12)
        failed.push("一次最多处理 12 张照片，其余请再选一次。");
      if (added.length) {
        setState((s) => ({ ...s, photos: [...added, ...s.photos] }));
        if (added.length === 1) {
          setStudioPhoto(added[0]);
          go("studio");
        } else go("album");
      }
      if (failed.length)
        setOverlay({
          type: "upload-report",
          message: `成功收好 ${added.length} 张照片；另有 ${failed.length} 项需要注意。`,
          failures: failed,
        });
      else notify(`成功收好 ${added.length} 张新回忆 ♡`);
    } catch (error) {
      notify(error.message || "照片保存失败，请检查本机空间");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };
  const summon = () => {
    setBurst(true);
    setFab(false);
    notify(`${state.pets.map((p) => p.name).join("和")}来贴贴啦 ♡`);
    clearTimeout(burstTimer.current);
    burstTimer.current = setTimeout(() => setBurst(false), 2200);
  };
  const actions = [
    {
      label: "拍照片",
      icon: "Camera",
      color: "mint",
      x: -132,
      y: -72,
      run: upload,
    },
    {
      label: "录视频",
      icon: "Video",
      color: "yellow",
      x: -55,
      y: -154,
      run: () => go("studio", null, "video"),
    },
    {
      label: "记一笔",
      icon: "NotebookPen",
      color: "pink",
      x: 55,
      y: -154,
      run: () => open({ type: "note" }),
    },
    {
      label: "召唤兔兔",
      icon: "Rabbit",
      color: "lilac",
      x: 132,
      y: -72,
      run: summon,
    },
  ];
  const pet = state.pets.find((p) => p.id === overlay?.id);
  const openAI = () => {
    aiOrigin.current = {
      hash: window.location.hash === "#/ai" ? "" : window.location.hash,
      scroll: window.scrollY,
    };
    setAiOpen(true);
    window.location.hash = "/ai";
  };
  const exitAI = () => {
    setAiOpen(false);
    window.history.replaceState(
      null,
      "",
      window.location.pathname + window.location.search + aiOrigin.current.hash,
    );
    requestAnimationFrame(() => {
      window.scrollTo({ top: aiOrigin.current.scroll });
      document.querySelector(".bunny-ai-launcher")?.focus();
    });
  };
  if (aiOpen)
    return (
      <Suspense
        fallback={
          <div className="chat-app chat-workspace" role="status">
            <div className="chat-empty">
              <BunnyLogo />
              <p>正在打开豆伴…</p>
              <button
                className="chat-button chat-button-outline chat-button-default"
                onClick={exitAI}
                aria-label="返回"
              >
                ← 返回小窝
              </button>
            </div>
          </div>
        }
      >
        <ChatApp getFamily={() => state} origin={page} onExit={exitAI} />
      </Suspense>
    );
  return (
    <>
      <button
        className="bunny-ai-launcher"
        onClick={openAI}
        aria-label="打开豆伴 AI 对话"
      >
        <BunnyLogo />
        <span>
          <strong>豆伴</strong>
          <small>聊聊小日子</small>
        </span>
      </button>
      <div
        className="app-paper"
        inert={menu || overlay ? "" : undefined}
        aria-hidden={menu || overlay ? true : undefined}
      >
        <header className="app-header">
          <button
            className="brand"
            onClick={() => go("home")}
            aria-label="兔兔小窝，返回首页"
          >
            <Bunny size={48} />
            <span>
              <strong>
                兔兔小窝 <i>♡</i>
              </strong>
              <small>生活里的可爱，正在放映</small>
            </span>
          </button>
          <div className="header-actions">
            {page !== "home" && (
              <button className="header-back" onClick={() => go("home")}>
                <Icon name="ArrowLeft" size={17} />
                <span>回到我们家</span>
              </button>
            )}
            <button
              className="directory-button"
              aria-label="翻开目录"
              aria-expanded={menu}
              onClick={() => {
                setMenu(true);
                setFab(false);
              }}
            >
              <Icon name="BookOpen" size={25} />
              <span>翻开目录</span>
              <i>✦</i>
            </button>
          </div>
        </header>
        {storageError && (
          <p className="storage-warning" role="alert">
            {storageError}
          </p>
        )}
        <main className="main-content">
          {page === "home" && (
            <Home
              state={state}
              setState={setState}
              go={go}
              open={open}
              notify={notify}
            />
          )}{" "}
          {page === "pets" && (
            <Pets
              state={state}
              setState={setState}
              selected={selectedPet}
              setSelected={setSelectedPet}
              open={open}
              notify={notify}
            />
          )}{" "}
          {page === "family" && (
            <Family
              state={state}
              setState={setState}
              open={open}
              notify={notify}
            />
          )}{" "}
          {page === "album" && (
            <Album
              state={state}
              setState={setState}
              open={open}
              upload={upload}
              notify={notify}
            />
          )}{" "}
          {page === "diary" && (
            <Diary
              state={state}
              setState={setState}
              open={open}
              notify={notify}
            />
          )}
          {page === "studio" && (
            <Studio
              state={state}
              setState={setState}
              requested={studioPhoto}
              modeRequested={studioMode}
              upload={upload}
              notify={notify}
            />
          )}
        </main>
      </div>
      <input
        hidden
        type="file"
        accept="image/*"
        multiple
        ref={fileInput}
        onChange={pick}
      />
      {!menu && !overlay && (
        <>
          {fab && (
            <button
              className="fab-scrim"
              onClick={() => setFab(false)}
              aria-label="收起快捷菜单"
            />
          )}
          <div className={`bunny-dock ${fab ? "expanded" : ""}`}>
            <div className="fan-actions" aria-hidden={!fab}>
              {actions.map((a, i) => (
                <button
                  key={a.label}
                  tabIndex={fab ? 0 : -1}
                  className={`fan-action ${a.color}`}
                  style={{
                    "--x": `${a.x}px`,
                    "--y": `${a.y}px`,
                    "--delay": `${i * 35}ms`,
                  }}
                  onClick={a.run}
                >
                  <Icon name={a.icon} size={25} />
                  <span>{a.label}</span>
                </button>
              ))}
            </div>
            <button
              className="bunny-fab"
              aria-label={fab ? "收起兔兔快捷菜单" : "打开兔兔快捷菜单"}
              aria-expanded={fab}
              onClick={() => {
                if (longPressed.current) {
                  longPressed.current = false;
                  return;
                }
                setFab((v) => !v);
              }}
              onPointerDown={() => {
                longPressed.current = false;
                holdTimer.current = setTimeout(() => {
                  longPressed.current = true;
                  summon();
                }, 800);
              }}
              onPointerUp={() => clearTimeout(holdTimer.current)}
              onPointerLeave={() => clearTimeout(holdTimer.current)}
              onPointerCancel={() => clearTimeout(holdTimer.current)}
            >
              <span className="fab-ear one" />
              <span className="fab-ear two" />
              {fab ? <Icon name="X" size={30} /> : <Bunny size={41} />}
            </button>
            <span className="fab-caption">
              {fab ? "选一个小心思" : "记下一点可爱"}
            </span>
          </div>
        </>
      )}
      {menu && (
        <ChapterMenu current={page} go={go} close={() => setMenu(false)} />
      )}{" "}
      {overlay?.type === "photo" && (
        <PhotoTheater
          state={state}
          setState={setState}
          id={overlay.id}
          ids={overlay.ids}
          onClose={() => setOverlay(null)}
          onEdit={editPhoto}
        />
      )}{" "}
      {overlay && overlay.type !== "photo" && (
        <Drawer
          title={
            {
              journal: "今天的小手账",
              note: overlay.id ? "续写这一页故事" : "记一笔小美好",
              "upload-report": "照片入镜小报告",
              "pet-edit": "小主的专属档案",
              weight: "成长的小刻度",
              reminder: "贴一张健康便签",
              member: overlay.id ? "编辑这个家人" : "请一位家人入镜",
            }[overlay.type] || "小手账"
          }
          onClose={() => setOverlay(null)}
        >
          {overlay.type === "journal" && (
            <Journal
              state={state}
              setState={setState}
              notify={notify}
              open={open}
              go={go}
            />
          )}{" "}
          {overlay.type === "note" && (
            <NoteEditor
              key={overlay.id || "new-note"}
              state={state}
              note={state.notes.find((n) => n.id === overlay.id)}
              setState={setState}
              notify={notify}
              onClose={() => setOverlay(null)}
            />
          )}{" "}
          {overlay.type === "upload-report" && (
            <div className="form-stack">
              <p>{overlay.message}</p>
              {overlay.failures.map((m, i) => (
                <p className="error-text" key={i}>
                  {m}
                </p>
              ))}
              <Button variant="pink" onClick={() => setOverlay(null)}>
                知道啦
              </Button>
            </div>
          )}
          {overlay.type === "pet-edit" && pet && (
            <PetEdit
              pet={pet}
              setState={setState}
              notify={notify}
              onClose={() => setOverlay(null)}
            />
          )}{" "}
          {overlay.type === "weight" && pet && (
            <WeightForm
              pet={pet}
              setState={setState}
              notify={notify}
              onClose={() => setOverlay(null)}
            />
          )}{" "}
          {overlay.type === "reminder" && pet && (
            <ReminderForm
              pet={pet}
              setState={setState}
              notify={notify}
              onClose={() => setOverlay(null)}
            />
          )}{" "}
          {overlay.type === "member" && (
            <MemberForm
              member={state.members.find((m) => m.id === overlay.id)}
              state={state}
              setState={setState}
              notify={notify}
              onClose={() => setOverlay(null)}
            />
          )}
        </Drawer>
      )}
      {toast && (
        <div className="toast" role="status">
          <Icon name="Heart" size={18} />
          {toast}
        </div>
      )}
      {uploading && (
        <div className="upload-status" role="status">
          <Bunny size={34} />
          <span>
            正在把照片带回家…
            <small style={{ display: "block", fontSize: 12, marginTop: 12 }}>
              {uploadProgress}
            </small>
          </span>
        </div>
      )}
      {burst && (
        <div className="bunny-burst" aria-hidden="true">
          {Array.from({ length: 14 }, (_, i) => (
            <span
              key={i}
              style={{
                "--i": i,
                "--dx": `${Math.sin(i * 2.4) * 40}vw`,
                "--rot": `${i * 53}deg`,
              }}
            >
              {i % 3 === 0 ? <Bunny size={45} /> : i % 3 === 1 ? "♡" : "✦"}
            </span>
          ))}
        </div>
      )}
    </>
  );
}

function ChapterMenu({ current, go, close }) {
  const root = useRef(null);
  useEffect(() => {
    const before = document.activeElement,
      previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    root.current?.querySelector("button")?.focus();
    const key = (e) => {
      if (e.key === "Escape") close();
      if (e.key === "Tab") {
        const nodes = root.current.querySelectorAll("button");
        if (e.shiftKey && document.activeElement === nodes[0]) {
          e.preventDefault();
          nodes[nodes.length - 1]?.focus();
        } else if (
          !e.shiftKey &&
          document.activeElement === nodes[nodes.length - 1]
        ) {
          e.preventDefault();
          nodes[0]?.focus();
        }
      }
    };
    const el = root.current;
    el.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = previous;
      el.removeEventListener("keydown", key);
      before?.focus?.();
    };
  }, []);
  return (
    <div
      ref={root}
      className="chapter-menu"
      role="dialog"
      aria-modal="true"
      aria-label="故事目录"
    >
      <div className="chapter-top">
        <div>
          <span className="handwritten">一本属于我们的小电影</span>
          <h2>
            今天，翻到哪一页？<i>♡</i>
          </h2>
        </div>
        <button className="icon-button" aria-label="合上目录" onClick={close}>
          <Icon name="X" size={27} />
        </button>
      </div>
      <div className="chapter-pages">
        {chapters.map((c, i) => (
          <button
            key={c.id}
            className={`chapter-page chapter-${i} ${current === c.id ? "current" : ""}`}
            onClick={() => go(c.id)}
          >
            <span className="tape" />
            <span className="chapter-number">CHAPTER 0{i + 1}</span>
            <img src={c.photo} alt="" />
            <div>
              <Icon name={c.icon} size={23} />
              <h3>{c.name}</h3>
              <Icon name="ArrowUpRight" />
            </div>
            <p>{c.line}</p>
            {current === c.id && <small>你正读到这里 ♡</small>}
          </button>
        ))}
      </div>
      <div className="chapter-footer">
        <Bunny size={47} />
        <span>不用着急，我们有一整个小日子。</span>
      </div>
    </div>
  );
}
function Journal({ state, setState, notify, open, go }) {
  const notes = state.notes.filter(
    (n) => !n.trashedAt && (n.date || localDate(n.createdAt)) === localDate(),
  );
  return (
    <div className="journal">
      <span className="journal-date">
        {localDate().replaceAll("-", ".")} · 今日场记
      </span>
      <div className="journal-pets">
        {state.pets.map((p) => (
          <button key={p.id} onClick={() => go("pets", p.id)}>
            <img src={p.photo} alt="" />
            <strong>{p.name}</strong>
            <span>照顾 {careCount(state, p.id)} / 4</span>
            <Icon name="ArrowUpRight" size={16} />
          </button>
        ))}
      </div>
      <TodoNote state={state} setState={setState} notify={notify} />
      <div className="section-heading">
        <h3>今天的心情旁白</h3>
        <Button
          variant="small pink"
          icon="Plus"
          onClick={() => open({ type: "note" })}
        >
          记一笔
        </Button>
      </div>
      {notes.length ? (
        notes.map((n) => (
          <article className="diary-note" key={n.id}>
            <small>
              {n.mood || "平静"} · {n.date}
            </small>
            <h4>{n.title}</h4>
            <p>{n.body}</p>
            <button
              className="tiny-button"
              aria-label={`编辑日记：${n.title}`}
              onClick={() => open({ type: "note", id: n.id })}
            >
              <Icon name="Pencil" size={16} />
            </button>
          </article>
        ))
      ) : (
        <Empty text="今天还没有旁白，写下一个小小的瞬间吧。" />
      )}
      <Button variant="mint" icon="BookOpen" onClick={() => go("diary")}>
        翻开所有小日子 · 搜索与回看
      </Button>
    </div>
  );
}
