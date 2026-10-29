import React, { useEffect, useRef, useState } from "react";
import { Button, Icon, Empty } from "./ui";
import { Photo, useMediaSource, readMedia, putMedia } from "./media";
import { activePhotos, localDate, uid } from "./data";
import {
  newHistory,
  commitHistory,
  undoHistory,
  redoHistory,
} from "./editorHistory";
import { templates, fontOptions, W, H, renderArtwork } from "./painter";
import "./workshop.css";
const defaults = () => ({
  template: "polaroid",
  title: "今天也要贴在一起 ♡",
  font: fontOptions[0].value,
  brightness: 100,
  contrast: 100,
  saturation: 100,
  stickers: [],
  strokes: [],
  photoSlots: [],
  secondaryId: "",
});
async function decodePhoto(photo) {
  if (!photo) throw new Error("照片资料不存在");
  let url = photo.src,
    owned = false;
  if (photo.mediaKey) {
    const blob = await readMedia(photo.mediaKey);
    if (!blob) throw new Error("照片文件没有找到");
    url = URL.createObjectURL(blob);
    owned = true;
  }
  try {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error("图片解码失败"));
      img.src = url;
    });
    return img;
  } finally {
    if (owned) URL.revokeObjectURL(url);
  }
}
export default function PhotoWorkshop({
  state,
  setState,
  requested,
  upload,
  notify,
}) {
  const photos = activePhotos(state),
    [chosenId, setChosenId] = useState(requested?.id || photos[0]?.id || ""),
    [history, setHistory] = useState(() => newHistory(defaults())),
    [selected, setSelected] = useState(null),
    [active, setActive] = useState("模板"),
    [image, setImage] = useState(null),
    [extras, setExtras] = useState({}),
    [extrasStatus, setExtrasStatus] = useState({
      key: "",
      loading: false,
      failed: false,
    }),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [draftId, setDraftId] = useState(""),
    [paintMode, setPaintMode] = useState("select"),
    [brush, setBrush] = useState("marker"),
    [color, setColor] = useState("#ce8ba7"),
    [width, setWidth] = useState(8),
    [slotPicker, setSlotPicker] = useState(null);
  const canvas = useRef(null),
    gesture = useRef(null),
    settings = history.present;
  const chosen = photos.find((p) => p.id === chosenId) || photos[0];
  useEffect(() => {
    if (requested) {
      setChosenId(requested.id);
      setImage(null);
    }
  }, [requested?.id]);
  useEffect(() => {
    let valid = true;
    setImage(null);
    setError("");
    if (!chosen) return;
    decodePhoto(chosen)
      .then((img) => {
        if (valid) setImage(img);
      })
      .catch((e) => {
        if (valid) setError(`${e.message}，可以在下方重新选图。`);
      });
    return () => {
      valid = false;
    };
  }, [chosen?.id, chosen?.mediaKey, chosen?.src]);
  const ids = (
    settings.template === "comic"
      ? settings.photoSlots || []
      : settings.template === "exposure"
        ? [settings.secondaryId]
        : []
  )
    .filter(Boolean)
    .join("|");
  const waitingForExtras =
    !!ids && (extrasStatus.key !== ids || extrasStatus.loading);
  const extrasFailed = !!ids && extrasStatus.key === ids && extrasStatus.failed;
  useEffect(() => {
    let valid = true;
    const wanted = [...new Set(ids.split("|").filter(Boolean))];
    if (!wanted.length) {
      setExtras({});
      setExtrasStatus({ key: ids, loading: false, failed: false });
      return;
    }
    setExtrasStatus({ key: ids, loading: true, failed: false });
    Promise.all(
      wanted.map(async (id) => {
        try {
          return [id, await decodePhoto(photos.find((p) => p.id === id))];
        } catch {
          return [id, null];
        }
      }),
    ).then((entries) => {
      if (!valid) return;
      setExtras(Object.fromEntries(entries.filter(([, img]) => img)));
      setExtrasStatus({
        key: ids,
        loading: false,
        failed: entries.some(([, img]) => !img),
      });
    });
    return () => {
      valid = false;
    };
  }, [ids, state.photos]);
  useEffect(() => {
    if (image && canvas.current)
      renderArtwork(canvas.current, image, settings, selected, extras);
  }, [image, settings, selected, extras]);
  const update = (next) =>
    setHistory((h) => {
      const value = typeof next === "function" ? next(h.present) : next;
      return gesture.current
        ? { ...h, present: value }
        : commitHistory(h, value);
    });
  const change = (key, value) => update((s) => ({ ...s, [key]: value }));
  const begin = () => {
    if (!gesture.current) gesture.current = { base: structuredClone(settings) };
  };
  const finish = () => {
    const g = gesture.current;
    if (!g) return;
    gesture.current = null;
    setHistory((h) => commitHistory({ ...h, present: g.base }, h.present));
  };
  const choose = (p) => {
    setChosenId(p.id);
    setImage(null);
    setSelected(null);
    setError("");
  };
  const reset = () => {
    setHistory((h) => commitHistory(h, defaults()));
    setSelected(null);
    notify("已回到最初的模样，仍然可以撤销");
  };
  const addSticker = (type) => {
    if (settings.stickers.length >= 16) {
      notify("最多放 16 张贴纸，先整理一下吧");
      return;
    }
    const s = {
      id: uid(),
      type,
      x: 225,
      y: type === "ears" ? 125 : 280,
      scale: 1,
      rotation: 0,
    };
    change("stickers", [...settings.stickers, s]);
    setSelected(s.id);
    setPaintMode("select");
  };
  const current = settings.stickers.find((s) => s.id === selected);
  const stickerChange = (key, value) =>
    update((s) => ({
      ...s,
      stickers: s.stickers.map((t) =>
        t.id === selected ? { ...t, [key]: value } : t,
      ),
    }));
  const point = (e) => {
    const rect = canvas.current.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(W, ((e.clientX - rect.left) * W) / rect.width)),
      y: Math.max(0, Math.min(H, ((e.clientY - rect.top) * H) / rect.height)),
    };
  };
  const down = (e) => {
    const p = point(e);
    if (paintMode === "draw") {
      if (settings.strokes.length >= 200) {
        notify("笔画已经很多啦，先保存这张作品吧");
        return;
      }
      begin();
      gesture.current.paint = true;
      const stroke = { id: uid(), tool: brush, color, width, points: [p] };
      gesture.current.strokeId = stroke.id;
      setSelected(null);
      update((s) => ({ ...s, strokes: [...s.strokes, stroke] }));
    } else {
      const hit = [...settings.stickers]
        .reverse()
        .find(
          (s) =>
            Math.abs(p.x - s.x) < 40 * s.scale &&
            Math.abs(p.y - s.y) < 58 * s.scale,
        );
      setSelected(hit?.id || null);
      if (!hit) return;
      begin();
      gesture.current.stickerId = hit.id;
      gesture.current.dx = p.x - hit.x;
      gesture.current.dy = p.y - hit.y;
    }
    canvas.current.setPointerCapture(e.pointerId);
  };
  const move = (e) => {
    const g = gesture.current;
    if (!g || (!g.paint && !g.stickerId)) return;
    const p = point(e);
    if (g.paint)
      update((s) => ({
        ...s,
        strokes: s.strokes.map((st) => {
          if (st.id !== g.strokeId || st.points.length >= 1000) return st;
          const last = st.points.at(-1);
          return Math.hypot(last.x - p.x, last.y - p.y) < 1
            ? st
            : { ...st, points: [...st.points, p] };
        }),
      }));
    else
      update((s) => ({
        ...s,
        stickers: s.stickers.map((t) =>
          t.id === g.stickerId
            ? {
                ...t,
                x: Math.max(15, Math.min(W - 15, p.x - g.dx)),
                y: Math.max(15, Math.min(H - 15, p.y - g.dy)),
              }
            : t,
        ),
      }));
  };
  const saveDraft = () => {
    if (!chosen) return;
    const id = draftId || uid();
    const draft = {
      id,
      name: settings.title.trim() || "还没写完的可爱",
      photoId: chosen.id,
      settings: structuredClone(settings),
      updatedAt: new Date().toISOString(),
    };
    setState((s) => ({
      ...s,
      editorDrafts: [draft, ...s.editorDrafts.filter((d) => d.id !== id)],
    }));
    setDraftId(id);
    notify("编辑草稿已保存在本机");
  };
  const restoreDraft = (d) => {
    const p = photos.find((p) => p.id === d.photoId);
    if (!p) {
      notify("草稿的主照片暂时不在相册，请先从回收站恢复");
      return;
    }
    setChosenId(p.id);
    setHistory(
      newHistory({
        ...defaults(),
        ...d.settings,
        stickers: Array.isArray(d.settings.stickers)
          ? d.settings.stickers
              .filter((t) => t && typeof t.id === "string")
              .slice(0, 16)
          : [],
        strokes: Array.isArray(d.settings.strokes)
          ? d.settings.strokes
              .filter((t) => t && Array.isArray(t.points))
              .slice(0, 200)
          : [],
        photoSlots: Array.isArray(d.settings.photoSlots)
          ? d.settings.photoSlots
              .filter((id) => typeof id === "string")
              .slice(0, 4)
          : [],
      }),
    );
    setSelected(null);
    setDraftId(d.id);
    setPaintMode("select");
    notify("接着上一次的小心思继续吧 ♡");
  };
  const save = async (kind) => {
    if (!image || waitingForExtras || extrasFailed) return;
    setBusy(true);
    setError("");
    try {
      const target = document.createElement("canvas");
      renderArtwork(target, image, settings, null, extras);
      const blob = await new Promise((resolve, reject) =>
        target.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("图片生成失败"))),
          "image/png",
        ),
      );
      if (kind === "download") {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `兔兔小窝-${localDate()}.png`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
        notify("PNG 已准备好，请查看浏览器下载");
      } else {
        const id = uid();
        await putMedia(id, blob);
        setState((s) => ({
          ...s,
          photos: [
            {
              id,
              mediaKey: id,
              title: settings.title.trim() || "新的一帧小美好",
              tag: "作品",
              petIds: chosen.petIds || [],
              date: localDate(),
              liked: false,
              template: settings.template,
            },
            ...s.photos,
          ],
        }));
        notify("作品已经收进回忆相册 ♡");
      }
    } catch (e) {
      setError(`${e.message || "作品保存失败"}，请检查本机可用空间。`);
    } finally {
      setBusy(false);
    }
  };
  const changeSlot = (index, id) => {
    const slots = [...(settings.photoSlots || [])];
    while (slots.length < 4) slots.push(chosen?.id || "");
    slots[index] = id;
    change("photoSlots", slots);
  };
  const historyKey = (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    if (e.key.toLowerCase() === "z") {
      e.preventDefault();
      finish();
      setHistory(e.shiftKey ? redoHistory : undoHistory);
    } else if (e.key.toLowerCase() === "y") {
      e.preventDefault();
      finish();
      setHistory(redoHistory);
    }
  };
  if (!chosen)
    return (
      <Empty text="先从相册带一张照片过来，开始制造可爱。">
        <Button variant="pink" icon="ImagePlus" onClick={upload}>
          选择照片
        </Button>
      </Empty>
    );
  return (
    <div className="workshop" onKeyDown={historyKey}>
      <div className="workshop-steps">
        <span className="done">01 选一帧回忆</span>
        <i>⌁</i>
        <span className="active">02 加一点可爱</span>
        <i>⌁</i>
        <span>03 收进小日子</span>
      </div>
      <div className="editor-layout">
        <div className="editor-film">
          <div className="editor-preview-top">
            <span>
              <Icon name="Sparkles" size={17} />{" "}
              {templates.find((t) => t.id === settings.template)?.name} ·{" "}
              {settings.stickers.length} 张贴纸 · {settings.strokes.length} 笔
            </span>
            <button className="text-button" onClick={reset}>
              <Icon name="RotateCcw" size={15} />
              复位
            </button>
          </div>
          <div className="editor-history-bar">
            <button
              className="text-button"
              disabled={!history.past.length}
              aria-label="撤销上一步编辑"
              onClick={() => {
                finish();
                setHistory(undoHistory);
              }}
            >
              <Icon name="Undo2" size={17} />
              撤销
            </button>
            <span>{history.past.length} / 30 步</span>
            <button
              className="text-button"
              disabled={!history.future.length}
              aria-label="重做编辑"
              onClick={() => {
                finish();
                setHistory(redoHistory);
              }}
            >
              <Icon name="Redo2" size={17} />
              重做
            </button>
            <button
              className="text-button draft-save"
              disabled={!image}
              onClick={saveDraft}
            >
              <Icon name="Save" size={16} />
              留作草稿
            </button>
          </div>
          <div
            className={`canvas-stage advanced-canvas ${paintMode === "draw" ? "drawing" : ""}`}
          >
            {image ? (
              <canvas
                ref={canvas}
                tabIndex={0}
                role="img"
                aria-label="可编辑照片画布，可拖动贴纸或画笔涂鸦"
                onPointerDown={down}
                onPointerMove={move}
                onPointerUp={finish}
                onPointerCancel={finish}
                onLostPointerCapture={finish}
                onKeyDown={(e) => {
                  if (!current) return;
                  const dirs = {
                    ArrowLeft: [-5, 0],
                    ArrowRight: [5, 0],
                    ArrowUp: [0, -5],
                    ArrowDown: [0, 5],
                  };
                  if (dirs[e.key]) {
                    e.preventDefault();
                    const [dx, dy] = dirs[e.key];
                    update((s) => ({
                      ...s,
                      stickers: s.stickers.map((t) =>
                        t.id === current.id
                          ? {
                              ...t,
                              x: Math.max(15, Math.min(W - 15, t.x + dx)),
                              y: Math.max(15, Math.min(H - 15, t.y + dy)),
                            }
                          : t,
                      ),
                    }));
                  }
                }}
              />
            ) : (
              <Empty text={error || "正在展开照片…"} />
            )}
          </div>
          <div className="editor-photo-rail">
            {photos.map((p) => (
              <button
                key={p.id}
                className={chosen.id === p.id ? "selected" : ""}
                aria-label={`编辑照片：${p.title}`}
                onClick={() => choose(p)}
              >
                <Photo item={p} />
              </button>
            ))}
            <button
              className="upload-tile"
              aria-label="选择新照片"
              onClick={upload}
            >
              <Icon name="Plus" />
            </button>
          </div>
          <div className="workshop-drafts">
            <div className="section-heading">
              <h3>
                <Icon name="NotebookPen" size={18} />
                还没写完的小心思
              </h3>
              <small>{state.editorDrafts.length} 份草稿</small>
            </div>
            {state.editorDrafts.length ? (
              <div className="draft-cards">
                {state.editorDrafts.map((d) => (
                  <div key={d.id}>
                    <button onClick={() => restoreDraft(d)}>
                      <Icon name="FileImage" size={20} />
                      <span>
                        {d.name}
                        <small>
                          {new Date(d.updatedAt).toLocaleString("zh-CN", {
                            month: "2-digit",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </small>
                      </span>
                      <Icon name="ArrowUpRight" size={16} />
                    </button>
                    <button
                      className="tiny-button"
                      aria-label={`删除草稿：${d.name}`}
                      onClick={() =>
                        setState((s) => ({
                          ...s,
                          editorDrafts: s.editorDrafts.filter(
                            (x) => x.id !== d.id,
                          ),
                        }))
                      }
                    >
                      <Icon name="X" size={14} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p>随时存一份草稿，下次接着把可爱写完。</p>
            )}
          </div>
        </div>
        <div className="editor-controls paper-card">
          <div className="editor-tabs workshop-tabs">
            {[
              { name: "模板", icon: "PanelsTopLeft" },
              { name: "贴纸", icon: "Sticker" },
              { name: "涂鸦", icon: "Paintbrush" },
              { name: "文字", icon: "Type" },
              { name: "调色", icon: "SlidersHorizontal" },
            ].map((t) => (
              <button
                key={t.name}
                className={active === t.name ? "selected" : ""}
                onClick={() => {
                  finish();
                  setActive(t.name);
                  setPaintMode(t.name === "涂鸦" ? "draw" : "select");
                }}
              >
                <Icon name={t.icon} size={20} />
                {t.name}
              </button>
            ))}
          </div>
          <div className="tool-body">
            {active === "模板" && (
              <>
                <h3>给回忆穿件新衣服</h3>
                <p className="muted">八款小心思，每一款都能真的导出。</p>
                <div className="template-grid">
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      className={settings.template === t.id ? "selected" : ""}
                      aria-pressed={settings.template === t.id}
                      onClick={() => change("template", t.id)}
                    >
                      <span
                        className={`template-art template-${t.id}`}
                        style={{ backgroundColor: t.color }}
                      >
                        <Photo item={chosen} />
                        {t.id === "comic" && <i />}
                        {t.id === "date" && (
                          <small>
                            {localDate().slice(5).replace("-", ".")}
                          </small>
                        )}
                      </span>
                      <span>{t.name}</span>
                    </button>
                  ))}
                </div>
                {settings.template === "comic" && (
                  <div className="multi-photo-slots">
                    <h4>四格故事，每一格都可以换图</h4>
                    <div>
                      {[0, 1, 2, 3].map((i) => {
                        const p =
                          photos.find(
                            (p) => p.id === settings.photoSlots?.[i],
                          ) || chosen;
                        return (
                          <button
                            key={i}
                            className={slotPicker === i ? "selected" : ""}
                            aria-label={`选择第 ${i + 1} 格照片`}
                            onClick={() =>
                              setSlotPicker(slotPicker === i ? null : i)
                            }
                          >
                            <Photo item={p} />
                            <span>第 {i + 1} 格</span>
                          </button>
                        );
                      })}
                    </div>
                    {slotPicker !== null && (
                      <PhotoPicker
                        photos={photos}
                        choose={(p) => {
                          changeSlot(slotPicker, p.id);
                          setSlotPicker(null);
                        }}
                      />
                    )}
                  </div>
                )}
                {settings.template === "exposure" && (
                  <div className="exposure-picker">
                    <h4>让两帧回忆，轻轻重叠</h4>
                    <label>
                      第二张照片
                      <select
                        aria-label="选择曝光第二张照片"
                        value={settings.secondaryId}
                        onChange={(e) => change("secondaryId", e.target.value)}
                      >
                        <option value="">同图柔和叠影</option>
                        {photos.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.title}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}
              </>
            )}
            {active === "贴纸" && (
              <>
                <h3>今天也要兔里兔气</h3>
                <p className="muted">添加后直接拖动，也可用方向键微调。</p>
                <div className="sticker-tray">
                  {[
                    { id: "ears", label: "兔耳朵", icon: "Rabbit" },
                    { id: "carrot", label: "胡萝卜", icon: "Carrot" },
                    { id: "heart", label: "小爱心", icon: "Heart" },
                    { id: "star", label: "闪亮星", icon: "Star" },
                  ].map((t) => (
                    <button key={t.id} onClick={() => addSticker(t.id)}>
                      <Icon name={t.icon} size={32} />
                      <span>{t.label}</span>
                    </button>
                  ))}
                </div>
                {current ? (
                  <div className="form-stack sticker-adjust">
                    <label>
                      贴纸大小
                      <input
                        type="range"
                        min="0.5"
                        max="2.5"
                        step="0.05"
                        value={current.scale}
                        onPointerDown={begin}
                        onPointerUp={finish}
                        onPointerCancel={finish}
                        onBlur={finish}
                        onChange={(e) =>
                          stickerChange("scale", Number(e.target.value))
                        }
                      />
                    </label>
                    <label>
                      转个方向
                      <input
                        type="range"
                        min="-180"
                        max="180"
                        value={current.rotation}
                        onPointerDown={begin}
                        onPointerUp={finish}
                        onPointerCancel={finish}
                        onBlur={finish}
                        onChange={(e) =>
                          stickerChange("rotation", Number(e.target.value))
                        }
                      />
                    </label>
                    <Button
                      variant="small"
                      icon="Trash2"
                      onClick={() => {
                        change(
                          "stickers",
                          settings.stickers.filter((t) => t.id !== selected),
                        );
                        setSelected(null);
                      }}
                    >
                      移除贴纸（可以撤销）
                    </Button>
                  </div>
                ) : (
                  <div className="sticker-tip">
                    点选一张贴纸，就能调整大小与角度。
                  </div>
                )}
              </>
            )}
            {active === "涂鸦" && (
              <>
                <h3>给照片画一句悄悄话</h3>
                <div className="brush-options">
                  {[
                    { id: "marker", name: "马克笔", icon: "Paintbrush" },
                    { id: "highlight", name: "荧光笔", icon: "Highlighter" },
                    { id: "dash", name: "虚线笔", icon: "Spline" },
                    { id: "mosaic", name: "马赛克", icon: "Grid2X2" },
                  ].map((t) => (
                    <button
                      className={brush === t.id ? "selected" : ""}
                      aria-pressed={brush === t.id}
                      key={t.id}
                      onClick={() => {
                        setBrush(t.id);
                        setPaintMode("draw");
                      }}
                    >
                      <Icon name={t.icon} size={23} />
                      {t.name}
                    </button>
                  ))}
                </div>
                <div className="brush-colors">
                  {["#ce8ba7", "#a8c6aa", "#e8c46d", "#6b5b73", "#fff9f0"].map(
                    (c) => (
                      <button
                        key={c}
                        aria-label={`画笔颜色 ${c}`}
                        aria-pressed={c === color}
                        className={c === color ? "selected" : ""}
                        style={{ backgroundColor: c }}
                        onClick={() => setColor(c)}
                      />
                    ),
                  )}
                </div>
                <label className="brush-width">
                  笔触大小 · {width}px
                  <input
                    type="range"
                    min="3"
                    max="35"
                    value={width}
                    onChange={(e) => setWidth(Number(e.target.value))}
                  />
                </label>
                <p className="muted">
                  在照片区域直接画。每一笔都可撤销；马赛克取样原照片，不覆盖文字与贴纸。
                </p>
                <Button
                  variant="small"
                  icon="Eraser"
                  onClick={() => change("strokes", [])}
                  disabled={!settings.strokes.length}
                >
                  清空笔画（可以撤销）
                </Button>
              </>
            )}
            {active === "文字" && (
              <div className="form-stack">
                <h3>想对这一刻说什么？</h3>
                <label>
                  照片批注
                  <input
                    maxLength={24}
                    value={settings.title}
                    onFocus={begin}
                    onBlur={finish}
                    onChange={(e) => change("title", e.target.value)}
                  />
                </label>
                <label>
                  字迹
                  <select
                    value={settings.font}
                    onChange={(e) => change("font", e.target.value)}
                  >
                    {fontOptions.map((f) => (
                      <option key={f.name} value={f.value}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="muted">
                  字体随设备回退，微信版本需配置授权字体。
                </p>
              </div>
            )}
            {active === "调色" && (
              <div className="form-stack">
                <h3>把光调成喜欢的样子</h3>
                {[
                  { id: "brightness", name: "亮一点", min: 50, max: 150 },
                  { id: "contrast", name: "对比度", min: 50, max: 150 },
                  { id: "saturation", name: "色彩浓度", min: 0, max: 200 },
                ].map((t) => (
                  <label key={t.id}>
                    {t.name}
                    <span className="range-value">{settings[t.id]}%</span>
                    <input
                      type="range"
                      min={t.min}
                      max={t.max}
                      value={settings[t.id]}
                      onPointerDown={begin}
                      onPointerUp={finish}
                      onPointerCancel={finish}
                      onBlur={finish}
                      onChange={(e) => change(t.id, Number(e.target.value))}
                    />
                  </label>
                ))}
                <Button
                  variant="small"
                  icon="Sun"
                  onClick={() =>
                    update((s) => ({
                      ...s,
                      brightness: 108,
                      contrast: 94,
                      saturation: 88,
                    }))
                  }
                >
                  一键奶油光
                </Button>
              </div>
            )}
          </div>
          <div className="editor-save">
            {(error || extrasFailed || waitingForExtras) && (
              <p className="error-text" role="alert">
                {error ||
                  (waitingForExtras
                    ? "正在准备拼图素材，完成后即可保存与导出。"
                    : "部分关联照片无法读取，请更换照片或恢复原图后再导出。")}
              </p>
            )}
            <Button
              variant="pink tape-button"
              icon="Heart"
              disabled={!image || busy || waitingForExtras || extrasFailed}
              onClick={() => save("album")}
            >
              {busy ? "正在收好…" : "存进回忆"}
            </Button>
            <Button
              variant="outline"
              icon="Download"
              disabled={!image || busy || waitingForExtras || extrasFailed}
              onClick={() => save("download")}
            >
              导出 PNG · 2×
            </Button>
            <small>预览和导出使用同一张画布，编辑选框不会导出。</small>
          </div>
        </div>
      </div>
    </div>
  );
}
function PhotoPicker({ photos, choose }) {
  return (
    <div className="slot-photo-picker">
      {photos.map((p) => (
        <button
          key={p.id}
          aria-label={`选择拼图照片：${p.title}`}
          onClick={() => choose(p)}
        >
          <Photo item={p} />
        </button>
      ))}
    </div>
  );
}
