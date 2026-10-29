import React, { useEffect, useRef, useState } from "react";
import { Button, Icon, PageTitle, Empty } from "./ui";
import { Photo, useMediaSource, putMedia } from "./media";
import { uid, localDate } from "./data";
import PhotoWorkshop from "./PhotoWorkshop";

export default function Studio({
  state,
  setState,
  requested,
  modeRequested = "photo",
  upload,
  notify,
}) {
  const [mode, setMode] = useState(modeRequested);
  useEffect(() => setMode(modeRequested), [modeRequested]);
  return (
    <div className="studio-page page-enter">
      <PageTitle
        title="可爱制造所"
        subtitle="给照片加一点想象，把回忆变得软乎乎。"
      >
        <div className="studio-modes">
          <button
            className={mode === "photo" ? "active" : ""}
            onClick={() => setMode("photo")}
          >
            <Icon name="Image" size={17} /> 照片工坊
          </button>
          <button
            className={mode === "video" ? "active" : ""}
            onClick={() => setMode("video")}
          >
            <Icon name="Clapperboard" size={17} /> 视频草稿
          </button>
        </div>
      </PageTitle>
      {mode === "photo" ? (
        <PhotoWorkshop
          state={state}
          setState={setState}
          requested={requested}
          upload={upload}
          notify={notify}
        />
      ) : (
        <VideoStudio state={state} setState={setState} notify={notify} />
      )}
    </div>
  );
}
function VideoStudio({ state, setState, notify }) {
  const input = useRef(null);
  const [file, setFile] = useState(null);
  const [current, setCurrent] = useState(null);
  const [title, setTitle] = useState("兔兔的可爱片段");
  const [caption, setCaption] = useState("");
  const [filter, setFilter] = useState("奶油");
  const [src, setSrc] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [savedSrc, savedError] = useMediaSource(current);
  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setSrc(url);
      return () => URL.revokeObjectURL(url);
    }
    setSrc(savedSrc);
  }, [file, savedSrc]);
  const choose = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setError("");
    if (!f.type.startsWith("video/") || f.size > 100 * 1024 * 1024) {
      setError("请选择小于 100MB 的视频");
      return;
    }
    const url = URL.createObjectURL(f);
    try {
      const v = document.createElement("video");
      v.preload = "metadata";
      v.src = url;
      await new Promise((resolve, reject) => {
        v.onloadedmetadata = resolve;
        v.onerror = () => reject(new Error("视频格式暂不支持，请选择 MP4"));
      });
      if (!Number.isFinite(v.duration) || v.duration > 60)
        throw new Error("请选择 60 秒以内的可爱片段");
      setFile(f);
      setCurrent(null);
    } catch (e) {
      setError(e.message);
    } finally {
      URL.revokeObjectURL(url);
      e.target.value = "";
    }
  };
  const filters = {
    奶油: "brightness(1.08) contrast(.94) saturate(.85)",
    薄荷: "hue-rotate(15deg) saturate(.8)",
    樱花: "sepia(.12) saturate(1.15)",
    复古: "sepia(.5) contrast(.95)",
  };
  const save = async () => {
    if (!title.trim()) return;
    setBusy(true);
    setError("");
    try {
      const id = current?.id || uid(),
        mediaKey = current?.mediaKey || id;
      if (file) await putMedia(mediaKey, file);
      const entry = {
        id,
        mediaKey,
        title: title.trim(),
        caption,
        filter,
        date: localDate(),
      };
      setState((s) => ({
        ...s,
        videos: [entry, ...s.videos.filter((v) => v.id !== id)],
      }));
      setCurrent(entry);
      setFile(null);
      notify("视频草稿保存在本机啦");
    } catch {
      setError("视频草稿保存失败，请检查本机可用空间。");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="video-layout">
      <div className="video-preview paper-card">
        <span className="tape pink-dots" />
        {src ? (
          <div className="video-screen">
            <video
              key={src}
              src={src}
              controls
              style={{ filter: filters[filter] }}
              playsInline
            />
            <span className="video-caption">{caption}</span>
          </div>
        ) : (
          <Empty text="把一段会动的可爱，带进来。">
            <Button
              variant="pink"
              icon="Video"
              onClick={() => input.current.click()}
            >
              选择视频
            </Button>
          </Empty>
        )}
        <input
          ref={input}
          type="file"
          accept="video/*"
          hidden
          onChange={choose}
        />
        <button className="text-button" onClick={() => input.current.click()}>
          <Icon name="Film" size={18} />{" "}
          {src ? "换一个片段" : "60 秒以内 · 本地视频"}
        </button>
        <p className="muted">
          这里是视频预览与草稿；滤镜、批注不会合成为 MP4。
        </p>
      </div>
      <div className="paper-card form-stack">
        <h3>给片段一点小心思</h3>
        <label>
          片名
          <input
            value={title}
            maxLength={40}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label>
          字幕批注
          <textarea
            value={caption}
            rows={2}
            maxLength={80}
            placeholder="手写一句想说的话"
            onChange={(e) => setCaption(e.target.value)}
          />
        </label>
        <label>
          预览滤镜
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            {Object.keys(filters).map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </label>
        {(error || savedError) && (
          <p role="alert" className="error-text">
            {error || savedError}
          </p>
        )}
        <Button
          variant="pink"
          icon="Save"
          disabled={!src || busy || !title.trim()}
          onClick={save}
        >
          {busy ? "正在收好…" : "保存视频草稿"}
        </Button>
        <small className="muted">
          剪辑、语音识别、转场、音乐和成片合成留待微信端接入。
        </small>
        {state.videos.length > 0 && (
          <div className="draft-list">
            <h4>已收好的草稿</h4>
            {state.videos.map((v) => (
              <button
                key={v.id}
                onClick={() => {
                  setCurrent(v);
                  setFile(null);
                  setTitle(v.title);
                  setCaption(v.caption);
                  setFilter(v.filter);
                }}
              >
                <Icon name="Clapperboard" />
                {v.title}
                <Icon name="ArrowUpRight" size={16} />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
