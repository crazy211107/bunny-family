import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button, Drawer, Icon, PageTitle, Empty } from "./ui";
import { Photo } from "./media";
import "./album-enhanced.css";

const petIdsFor = (photo, pets) =>
  Array.isArray(photo.petIds)
    ? photo.petIds
    : pets
        .filter((p) => photo.tag === p.name || photo.tag === "一起")
        .map((p) => p.id);
export default function Album({ state, setState, open, upload, notify }) {
  const [filter, setFilter] = useState("all"),
    [query, setQuery] = useState(""),
    [sort, setSort] = useState("newest"),
    [trash, setTrash] = useState(false),
    [selecting, setSelecting] = useState(false),
    [selected, setSelected] = useState([]),
    [editing, setEditing] = useState(null),
    [classifying, setClassifying] = useState(false),
    [batchTag, setBatchTag] = useState(""),
    [batchPets, setBatchPets] = useState([]);
  const photos = useMemo(
    () =>
      state.photos
        .filter((p) => {
          if (!!p.trashedAt !== trash) return false;
          const pets = petIdsFor(p, state.pets),
            q = query.trim().toLocaleLowerCase(),
            match =
              filter === "all" ||
              (filter === "liked" && p.liked) ||
              (filter === "together" &&
                (pets.length > 1 || p.tag === "一起")) ||
              (filter === "art" && (p.tag === "作品" || !!p.template)) ||
              (filter.startsWith("pet:") && pets.includes(filter.slice(4)));
          return (
            match &&
            (!q ||
              [
                p.title,
                p.tag,
                ...state.pets
                  .filter((pet) => pets.includes(pet.id))
                  .map((pet) => pet.name),
              ]
                .join(" ")
                .toLocaleLowerCase()
                .includes(q))
          );
        })
        .sort((a, b) => {
          if (sort === "title")
            return (a.title || "").localeCompare(b.title || "", "zh-CN");
          if (!a.date || !b.date) return a.date ? -1 : b.date ? 1 : 0;
          return sort === "oldest"
            ? a.date.localeCompare(b.date)
            : b.date.localeCompare(a.date);
        }),
    [state.photos, state.pets, filter, query, sort, trash],
  );
  const ids = photos.map((p) => p.id),
    chosen = selected.filter((id) => ids.includes(id)),
    chosenSet = new Set(chosen),
    editingPhoto = state.photos.find((p) => p.id === editing && !p.trashedAt),
    trashCount = state.photos.filter((p) => p.trashedAt).length;
  const view = (run) => {
    setSelected([]);
    setClassifying(false);
    run();
  };
  const update = (targets, change, message) => {
    const keys = new Set(targets);
    if (!keys.size) return;
    setState((s) => ({
      ...s,
      photos: s.photos.map((p) => (keys.has(p.id) ? change(p) : p)),
    }));
    notify?.(message);
  };
  const move = (targets, restore = false) => {
    const trashedAt = restore ? null : new Date().toISOString();
    update(
      targets,
      (p) => ({ ...p, trashedAt }),
      restore
        ? "已找回 " + targets.length + " 帧回忆 ♡"
        : "已将 " + targets.length + " 帧放入回收站，随时可以找回",
    );
    setSelected([]);
    setClassifying(false);
  };
  const filters = [
    { id: "all", name: "全部" },
    { id: "together", name: "一起" },
    ...state.pets.map((p) => ({ id: "pet:" + p.id, name: p.name })),
    { id: "liked", name: "喜欢" },
    { id: "art", name: "作品" },
  ];
  return (
    <div className="album-page page-enter">
      <PageTitle
        title={trash ? "回忆回收站" : "回忆放映室"}
        subtitle={
          trash
            ? "舍不得的片段，都可以重新找回来。"
            : "不用特别的日子，特别的是你们。"
        }
      >
        <Button variant="pink tape-button" icon="ImagePlus" onClick={upload}>
          添一帧回忆
        </Button>
      </PageTitle>
      <div className="album-room-switch" aria-label="相册位置">
        <button
          className={!trash ? "active" : ""}
          onClick={() => view(() => setTrash(false))}
        >
          <Icon name="Images" size={17} />
          回忆相册 <small>{state.photos.length - trashCount}</small>
        </button>
        <button
          className={trash ? "active" : ""}
          onClick={() => view(() => setTrash(true))}
        >
          <Icon name="Trash2" size={17} />
          回收站 <small>{trashCount}</small>
        </button>
      </div>
      <div className="album-filter" aria-label="筛选回忆">
        {filters.map((f) => (
          <button
            key={f.id}
            className={filter === f.id ? "active" : ""}
            aria-pressed={filter === f.id}
            onClick={() => view(() => setFilter(f.id))}
          >
            {f.id === "liked" && <Icon name="Heart" size={15} />} {f.name}
          </button>
        ))}
      </div>
      <div className="album-tools">
        <label className="album-search">
          <Icon name="NotebookPen" size={18} />
          <input
            type="search"
            maxLength={100}
            aria-label="搜索照片标题、标签或兔兔"
            placeholder="找找某一帧、一个标签…"
            value={query}
            onChange={(e) => view(() => setQuery(e.target.value))}
          />
        </label>
        <label className="album-sort">
          <span>排列方式</span>
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="newest">日期 · 从新到旧</option>
            <option value="oldest">日期 · 从旧到新</option>
            <option value="title">照片标题</option>
          </select>
        </label>
        <Button
          variant="small outline"
          icon={selecting ? "X" : "Check"}
          aria-pressed={selecting}
          onClick={() => {
            setSelecting((v) => !v);
            setSelected([]);
            setClassifying(false);
          }}
        >
          {selecting ? "退出多选" : "整理相册"}
        </Button>
      </div>
      <div className="album-result-line">
        <span>
          找到 <strong>{photos.length}</strong> 帧{trash ? "暂存的" : "小小的"}
          回忆
        </span>
        {selecting && (
          <button
            className="text-button"
            disabled={!photos.length}
            onClick={() =>
              setSelected(chosen.length === photos.length ? [] : ids)
            }
          >
            {photos.length > 0 && chosen.length === photos.length
              ? "取消全选"
              : "全选当前结果"}
          </button>
        )}
      </div>
      {selecting && (
        <div className="album-selection-panel">
          <div className="album-batch-actions">
            <strong>已选 {chosen.length} 帧</strong>
            {trash ? (
              <Button
                variant="small mint"
                icon="RotateCcw"
                disabled={!chosen.length}
                onClick={() => move(chosen, true)}
              >
                把回忆找回来
              </Button>
            ) : (
              <>
                <Button
                  variant="small pink"
                  icon="Heart"
                  disabled={!chosen.length}
                  onClick={() =>
                    update(
                      chosen,
                      (p) => ({ ...p, liked: true }),
                      "已喜欢所选回忆 ♡",
                    )
                  }
                >
                  喜欢
                </Button>
                <Button
                  variant="small outline"
                  disabled={!chosen.length}
                  onClick={() =>
                    update(
                      chosen,
                      (p) => ({ ...p, liked: false }),
                      "已取消所选照片的喜欢",
                    )
                  }
                >
                  取消喜欢
                </Button>
                <Button
                  variant="small outline"
                  icon="NotebookPen"
                  disabled={!chosen.length}
                  onClick={() => setClassifying((v) => !v)}
                >
                  批量分类
                </Button>
                <Button
                  variant="small outline"
                  icon="Trash2"
                  disabled={!chosen.length}
                  onClick={() => move(chosen)}
                >
                  放入回收站
                </Button>
              </>
            )}
          </div>
          {classifying && !trash && (
            <form
              className="album-classification"
              onSubmit={(e) => {
                e.preventDefault();
                if (!chosen.length || (!batchTag.trim() && !batchPets.length))
                  return;
                update(
                  chosen,
                  (p) => ({
                    ...p,
                    ...(batchTag.trim() ? { tag: batchTag.trim() } : {}),
                    ...(batchPets.length ? { petIds: batchPets } : {}),
                  }),
                  "已整理所选回忆的分类",
                );
                setClassifying(false);
              }}
            >
              <label>
                给回忆贴标签
                <input
                  maxLength={24}
                  value={batchTag}
                  onChange={(e) => setBatchTag(e.target.value)}
                  placeholder="如：周末、一起、作品"
                />
              </label>
              <PetChoices
                pets={state.pets}
                selected={batchPets}
                setSelected={setBatchPets}
                title="这一组照片里的兔兔"
              />
              <small>
                留空的标签与兔兔归属会保留原设置；勾选兔兔时统一替换归属。
              </small>
              <Button
                type="submit"
                variant="small mint"
                disabled={
                  !chosen.length || (!batchTag.trim() && !batchPets.length)
                }
              >
                应用到所选照片
              </Button>
            </form>
          )}
        </div>
      )}
      <div className="contact-sheet enhanced-contact-sheet">
        {photos.map((p, i) => {
          const labels = [
            ...new Set(
              [
                ...state.pets
                  .filter((pet) => petIdsFor(p, state.pets).includes(pet.id))
                  .map((pet) => pet.name),
                p.tag,
              ].filter(Boolean),
            ),
          ].join(" · ");
          return (
            <article
              className={
                "album-photo-card " + (chosenSet.has(p.id) ? "is-selected" : "")
              }
              key={p.id}
            >
              <button
                className={"contact-photo tilt-" + (i % 3)}
                aria-label={
                  (selecting
                    ? chosenSet.has(p.id)
                      ? "取消选择"
                      : "选择"
                    : trash
                      ? "选择待恢复"
                      : "放映") +
                  "照片：" +
                  p.title
                }
                aria-pressed={selecting ? chosenSet.has(p.id) : undefined}
                onClick={() => {
                  if (selecting)
                    setSelected((s) =>
                      s.includes(p.id)
                        ? s.filter((id) => id !== p.id)
                        : [...s, p.id],
                    );
                  else if (!trash) open({ type: "photo", id: p.id, ids });
                  else {
                    setSelecting(true);
                    setSelected([p.id]);
                  }
                }}
              >
                <span className="contact-index">
                  FRAME {String(i + 1).padStart(2, "0")}
                </span>
                {selecting && (
                  <span className="album-selection-mark" aria-hidden="true">
                    {chosenSet.has(p.id) && <Icon name="Check" size={17} />}
                  </span>
                )}
                <Photo item={p} loading="lazy" />
                <span className="contact-caption">
                  {p.title}
                  <i>{p.liked ? "♥" : "♡"}</i>
                </span>
                <small>{p.date || "日期待补充"}</small>
              </button>
              <div className="album-card-meta">
                <span title={labels}>{labels || "等你贴个标签"}</span>
                <div>
                  {trash ? (
                    <button
                      className="tiny-button album-recover"
                      aria-label={"恢复照片：" + p.title}
                      onClick={() => move([p.id], true)}
                    >
                      <Icon name="RotateCcw" size={17} />
                      找回
                    </button>
                  ) : (
                    <>
                      <button
                        className={"tiny-button " + (p.liked ? "liked" : "")}
                        aria-label={
                          (p.liked ? "取消喜欢" : "喜欢") + "照片：" + p.title
                        }
                        aria-pressed={!!p.liked}
                        onClick={() =>
                          update(
                            [p.id],
                            (photo) => ({ ...photo, liked: !photo.liked }),
                            p.liked ? "已取消喜欢" : "喜欢这一帧 ♡",
                          )
                        }
                      >
                        <Icon name="Heart" size={17} />
                      </button>
                      <button
                        className="tiny-button"
                        aria-label={"编辑照片资料：" + p.title}
                        onClick={() => setEditing(p.id)}
                      >
                        <Icon name="Pencil" size={17} />
                      </button>
                      <button
                        className="tiny-button"
                        aria-label={"将照片放入回收站：" + p.title}
                        onClick={() => move([p.id])}
                      >
                        <Icon name="Trash2" size={17} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {!photos.length && (
        <Empty
          text={
            query || filter !== "all"
              ? "没找到这一帧，换个词或分类试试看。"
              : trash
                ? "回收站空空的，可爱的回忆都好好留着。"
                : "这里还没有回忆，留下一点可爱吧。"
          }
        />
      )}
      {trash && (
        <p className="album-storage-note">
          这里只是暂时收起照片。点击“找回”即可恢复，照片文件会一直保留在本机。
        </p>
      )}
      {editingPhoto && (
        <Drawer title="给这一帧补一点旁白" onClose={() => setEditing(null)}>
          <PhotoDetails
            key={editingPhoto.id}
            photo={editingPhoto}
            pets={state.pets}
            onSave={(details) => {
              update(
                [editingPhoto.id],
                (p) => ({
                  ...p,
                  ...details,
                  updatedAt: new Date().toISOString(),
                }),
                "照片资料已经好好收起来啦 ♡",
              );
              setEditing(null);
            }}
          />
        </Drawer>
      )}
    </div>
  );
}
function PetChoices({ pets, selected, setSelected, title }) {
  return (
    <fieldset className="album-pet-choices">
      <legend>{title}</legend>
      {pets.map((p) => (
        <label key={p.id}>
          <input
            type="checkbox"
            checked={selected.includes(p.id)}
            onChange={() =>
              setSelected((s) =>
                s.includes(p.id) ? s.filter((id) => id !== p.id) : [...s, p.id],
              )
            }
          />
          {p.name}
        </label>
      ))}
    </fieldset>
  );
}
function PhotoDetails({ photo, pets, onSave }) {
  const [title, setTitle] = useState(photo.title || ""),
    [date, setDate] = useState(photo.date || ""),
    [tag, setTag] = useState(photo.tag || ""),
    [petIds, setPetIds] = useState(petIdsFor(photo, pets));
  return (
    <form
      className="form-stack album-details"
      onSubmit={(e) => {
        e.preventDefault();
        if (title.trim())
          onSave({ title: title.trim(), date, tag: tag.trim(), petIds });
      }}
    >
      <div className="album-detail-photo">
        <Photo item={photo} />
      </div>
      <label>
        这一帧叫什么
        <input
          required
          maxLength={60}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>
      <label>
        拍下它的日子
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </label>
      <PetChoices
        pets={pets}
        selected={petIds}
        setSelected={setPetIds}
        title="镜头里的小主角"
      />
      <label>
        回忆标签
        <input
          maxLength={24}
          placeholder="例如：一起、午后、作品"
          value={tag}
          onChange={(e) => setTag(e.target.value)}
        />
      </label>
      <Button
        type="submit"
        variant="pink tape-button"
        icon="Save"
        disabled={!title.trim()}
      >
        把旁白收好
      </Button>
    </form>
  );
}
export function PhotoTheater({ state, setState, id, ids, onClose, onEdit }) {
  const root = useRef(null),
    [currentId, setCurrentId] = useState(id),
    [playing, setPlaying] = useState(false),
    [showInfo, setShowInfo] = useState(false);
  const photos = useMemo(() => {
    const available = state.photos.filter((p) => !p.trashedAt);
    if (!Array.isArray(ids)) return available;
    const byId = new Map(available.map((p) => [p.id, p]));
    return [...new Set(ids)].map((key) => byId.get(key)).filter(Boolean);
  }, [state.photos, ids]);
  const current = Math.max(
      0,
      photos.findIndex((p) => p.id === currentId),
    ),
    photo = photos[current];
  const next = useCallback(
    (delta) => {
      if (!photos.length) return;
      setCurrentId((previous) => {
        const index = Math.max(
          0,
          photos.findIndex((p) => p.id === previous),
        );
        return photos[(index + delta + photos.length) % photos.length].id;
      });
    },
    [photos],
  );
  useEffect(() => setCurrentId(id), [id]);
  useEffect(() => {
    if (!photo) setPlaying(false);
  }, [photo]);
  useEffect(() => {
    const before = document.activeElement,
      overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    root.current?.querySelector("button")?.focus();
    return () => {
      document.body.style.overflow = overflow;
      if (before?.isConnected) before.focus?.();
    };
  }, []);
  useEffect(() => {
    if (!playing || photos.length < 2) return;
    const timer = setInterval(() => next(1), 4000);
    return () => clearInterval(timer);
  }, [playing, photos.length, next]);
  const keyboard = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      next(1);
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      next(-1);
    }
    if (e.key === "Tab") {
      const nodes = [
          ...root.current.querySelectorAll(
            'button,a[href],input,select,textarea,[tabindex="0"]',
          ),
        ].filter((n) => !n.disabled && n.getClientRects().length),
        first = nodes[0],
        last = nodes.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }
  };
  return (
    <div
      ref={root}
      className="photo-theater"
      role="dialog"
      aria-modal="true"
      aria-label="回忆放映室"
      onKeyDown={keyboard}
    >
      <div className="theater-top">
        <span>
          <Icon name="Film" />
          我们的回忆放映室
        </span>
        <button
          className="icon-button"
          aria-label="关闭照片放映"
          onClick={onClose}
        >
          <Icon name="X" />
        </button>
      </div>
      {photo ? (
        <>
          <div className="theater-stage">
            <button
              className="theater-arrow prev"
              aria-label="上一张照片"
              disabled={photos.length < 2}
              onClick={() => next(-1)}
            >
              <Icon name="ArrowLeft" />
            </button>
            <figure className="theater-polaroid">
              <span className="tape pink-dots" />
              <Photo item={photo} />
              <figcaption>{photo.title} ♡</figcaption>
            </figure>
            <button
              className="theater-arrow next"
              aria-label="下一张照片"
              disabled={photos.length < 2}
              onClick={() => next(1)}
            >
              <Icon name="ArrowRight" />
            </button>
            <span className="theater-doodle">♡</span>
          </div>
          <div className="theater-controls">
            <span className="theater-count">
              {String(current + 1).padStart(2, "0")}{" "}
              <i>/ {String(photos.length).padStart(2, "0")}</i>
            </span>
            <button
              className="icon-button"
              aria-label={playing ? "暂停放映" : "播放幻灯片"}
              disabled={photos.length < 2}
              onClick={() => setPlaying((v) => !v)}
            >
              <Icon name={playing ? "Pause" : "Play"} />
            </button>
            <button
              className={"icon-button " + (photo.liked ? "liked" : "")}
              aria-label={photo.liked ? "取消喜欢这张照片" : "喜欢这张照片"}
              aria-pressed={!!photo.liked}
              onClick={() =>
                setState((s) => ({
                  ...s,
                  photos: s.photos.map((p) =>
                    p.id === photo.id ? { ...p, liked: !p.liked } : p,
                  ),
                }))
              }
            >
              <Icon name="Heart" />
            </button>
            <button
              className="icon-button"
              aria-label="查看照片旁白"
              aria-expanded={showInfo}
              onClick={() => setShowInfo((v) => !v)}
            >
              <Icon name="NotebookPen" />
            </button>
            <Button
              variant="pink"
              icon="WandSparkles"
              onClick={() => onEdit(photo)}
            >
              让回忆变可爱
            </Button>
          </div>
          {showInfo && (
            <div className="theater-photo-info">
              <strong>{photo.title}</strong>
              <span>
                {photo.date || "拍摄日期待补充"}
                {photo.tag ? " · " + photo.tag : ""}
              </span>
              <span>
                {state.pets
                  .filter((p) => petIdsFor(photo, state.pets).includes(p.id))
                  .map((p) => p.name)
                  .join(" & ") || "这一帧还没有标记主角"}
              </span>
            </div>
          )}
          <small className="theater-hint">
            只放映本次相册结果 · 左右方向键切换
          </small>
        </>
      ) : (
        <div className="theater-empty">
          <Empty text="这组照片已经被收起，回相册看看其他回忆吧。">
            <Button variant="pink" onClick={onClose}>
              回到相册
            </Button>
          </Empty>
        </div>
      )}
    </div>
  );
}
