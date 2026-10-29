// A deliberately attached image is the only photo binary sent to the provider.
// Package photos, album paths, and video files are never uploaded in bulk.
function chooseImage() {
  return new Promise((resolve, reject) => {
    wx.chooseMedia({
      count: 1,
      mediaType: ["image"],
      sourceType: ["album", "camera"],
      sizeType: ["compressed"],
      async success(result) {
        const file = result.tempFiles && result.tempFiles[0];
        if (!file) {
          resolve(null);
          return;
        }
        wx.showLoading({ title: "准备这一帧", mask: true });
        try {
          const info = await new Promise((done, fail) =>
            wx.getImageInfo({ src: file.tempFilePath, success: done, fail }),
          );
          let path = file.tempFilePath;
          for (const quality of [65, 40, 20]) {
            const sourceWidth = Number(info.width) || 768,
              sourceHeight = Number(info.height) || 768;
            const scale = Math.min(
              1,
              768 / Math.max(sourceWidth, sourceHeight),
            );
            const width = Math.max(1, Math.round(sourceWidth * scale)),
              height = Math.max(1, Math.round(sourceHeight * scale));
            const compressed = await new Promise((done, fail) =>
              wx.compressImage({
                src: file.tempFilePath,
                quality,
                compressedWidth: width,
                compressedHeight: Math.max(1, height),
                success: done,
                fail,
              }),
            );
            path = compressed.tempFilePath;
            const base64 = await new Promise((done, fail) =>
              wx
                .getFileSystemManager()
                .readFile({
                  filePath: path,
                  encoding: "base64",
                  success: (data) => done(data.data),
                  fail,
                }),
            );
            const format = await new Promise((done, fail) =>
              wx.getImageInfo({
                src: path,
                success: (data) => done(String(data.type || "").toLowerCase()),
                fail,
              }),
            );
            const mime = format === "jpg" ? "jpeg" : format;
            if (["jpeg", "png", "webp"].indexOf(mime) < 0)
              throw new Error("这张图片格式暂不支持，请选 JPEG、PNG 或 WebP");
            const dataUrl = "data:image/" + mime + ";base64," + base64;
            if (dataUrl.length <= 180000) {
              resolve({ name: "本次附图", preview: path, dataUrl });
              return;
            }
          }
          throw new Error("这张图片仍然偏大，请裁小后再附上；文字对话不受影响");
        } catch (error) {
          reject(new Error(error.message || "图片准备失败，请重新选择"));
        } finally {
          wx.hideLoading();
        }
      },
      fail(error) {
        if (/cancel/i.test(error.errMsg || "")) resolve(null);
        else reject(new Error("未能选取图片，请检查相册权限"));
      },
    });
  });
}
module.exports = { chooseImage };
