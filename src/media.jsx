import React, { useEffect, useState } from "react";
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("bunny-cinema-media", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("files");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
export async function putMedia(key, blob) {
  const db = await openDB();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction("files", "readwrite");
      tx.objectStore("files").put(blob, key);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error("媒体保存失败"));
    });
  } finally {
    db.close();
  }
}
export async function readMedia(key) {
  const db = await openDB();
  try {
    return await new Promise((resolve, reject) => {
      const req = db.transaction("files").objectStore("files").get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}
export async function deleteMedia(key) {
  const db = await openDB();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction("files", "readwrite");
      tx.objectStore("files").delete(key);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
export function useMediaSource(item) {
  const [source, setSource] = useState(item?.src || "");
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false,
      url = "";
    setSource(item?.src || "");
    setError("");
    if (item?.mediaKey)
      readMedia(item.mediaKey)
        .then((blob) => {
          if (!blob) throw new Error("媒体文件不存在");
          if (!cancelled) {
            url = URL.createObjectURL(blob);
            setSource(url);
          }
        })
        .catch(() => {
          if (!cancelled) setError("这段回忆暂时无法读取，请重新选择文件。");
        });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [item?.id, item?.src, item?.mediaKey]);
  return [source, error];
}
export function Photo({ item, ...props }) {
  const [src, error] = useMediaSource(item);
  return src ? (
    <img src={src} {...props} alt={props.alt || item?.title || "兔兔照片"} />
  ) : (
    <div className="media-error">{error || "正在展开回忆…"}</div>
  );
}
export async function imageFile(file, max = 1800) {
  if (!file.type.startsWith("image/")) throw new Error("请选择图片文件");
  if (file.size > 25 * 1024 * 1024) throw new Error("图片请小于 25MB");
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () =>
        reject(new Error("图片无法读取，请换一张 JPEG 或 PNG"));
      img.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("图片处理失败"))),
        "image/jpeg",
        0.92,
      ),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
