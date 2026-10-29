interface NativeRequest {
  url: string;
  header: Record<string, string>;
  data: unknown;
  success(result: { statusCode: number; data: string }): void;
  fail(error: { errMsg: string }): void;
}
// Adapter is installed once before any core call; data is isolated from mini-program storage.
const request = (options: NativeRequest) => {
  const controller = new AbortController();
  let listener: ((event: { data: ArrayBuffer }) => void) | undefined;
  const timeout = window.setTimeout(() => controller.abort(), 60_000);
  void (async () => {
    try {
      const response = await fetch(options.url, {
        method: "POST",
        headers: options.header,
        body: JSON.stringify(options.data),
        signal: controller.signal,
        redirect: "error",
        credentials: "omit",
        referrerPolicy: "no-referrer",
      });
      if (
        response.ok &&
        response.headers.get("content-type")?.includes("text/event-stream") &&
        response.body
      ) {
        const reader = response.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          listener?.({
            data: value.buffer.slice(
              value.byteOffset,
              value.byteOffset + value.byteLength,
            ) as ArrayBuffer,
          });
        }
        options.success({ statusCode: response.status, data: "" });
      } else
        options.success({
          statusCode: response.status,
          data: await response.text(),
        });
    } catch {
      options.fail({
        errMsg: controller.signal.aborted
          ? "request:fail abort"
          : "request:fail 网络连接失败，请检查 API 地址、网络或服务端 CORS 设置",
      });
    } finally {
      window.clearTimeout(timeout);
    }
  })();
  return {
    abort: () => controller.abort(),
    onChunkReceived: (callback: typeof listener) => {
      listener = callback;
    },
  };
};
Object.assign(globalThis, {
  wx: {
    getStorageSync: (key: string) => {
      const value = localStorage.getItem("bunny-web:" + key);
      return value ? JSON.parse(value) : "";
    },
    setStorageSync: (key: string, value: unknown) =>
      localStorage.setItem("bunny-web:" + key, JSON.stringify(value)),
    removeStorageSync: (key: string) =>
      localStorage.removeItem("bunny-web:" + key),
    request,
  },
});
export async function readImage(
  file: File,
): Promise<import("./types").Attachment> {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 20 * 1024 * 1024
  )
    throw new Error("请选择 20MB 以内的 JPG、PNG 或 WebP 图片。");
  const bitmap = await createImageBitmap(file);
  try {
    const ratio = Math.min(1, 768 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
    canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("当前浏览器无法处理图片。");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.7, 0.45, 0.2]) {
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      if (dataUrl.length <= 180000)
        return { name: file.name.slice(0, 100), preview: dataUrl, dataUrl };
    }
    throw new Error("图片仍偏大，请先裁剪后再选择。");
  } finally {
    bitmap.close();
  }
}
