// Native WeChat SDK only. No browser/CDP access and no test data written.
const fs = require("fs");
const path = require("path");
const automator = require("D:/java/yuanbao/mp-runnable/_tools/node_modules/miniprogram-automator");
const root = path.resolve(__dirname, "..");
const output = path.join(root, "output", "native-qa");
fs.mkdirSync(output, { recursive: true });
const timeout = (promise, ms, name) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(name + " timeout")), ms),
    ),
  ]);
(async () => {
  const mp = await timeout(
    automator.connect({ wsEndpoint: "ws://127.0.0.1:9420" }),
    12000,
    "connect",
  );
  const errors = [];
  mp.on("exception", (error) => errors.push(String(error.message || error)));
  try {
    const routes = process.argv.slice(2).length
      ? process.argv.slice(2)
      : [
          "home",
          "care",
          "insights",
          "pets",
          "family",
          "diary",
          "album",
          "studio",
          "video",
        ];
    for (const route of routes) {
      const [name, query] = route.split("?");
      const page = await timeout(
        mp.reLaunch("/pages/" + name + "/index" + (query ? "?" + query : "")),
        18000,
        name,
      );
      await page.waitFor(650);
      const destination = path.join(
        output,
        route.replace(/[?=&]/g, "-") + ".png",
      );
      await timeout(mp.screenshot({ path: destination }), 10000, "screenshot");
      console.log("✓", route, "原生页面截图", path.basename(destination));
    }
    fs.writeFileSync(
      path.join(output, "runtime.json"),
      JSON.stringify({ at: new Date().toISOString(), errors }, null, 2),
    );
    if (errors.length) throw new Error(errors.join("\n"));
  } finally {
    await mp.disconnect();
  }
})()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
