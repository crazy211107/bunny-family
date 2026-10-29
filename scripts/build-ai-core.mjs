// One implementation of prompts, scope filtering, bounded history and SSE for both clients.
import fs from "node:fs";
import path from "node:path";
import { build } from "esbuild";
const root = path.resolve(import.meta.dirname, "..");
const target = path.join(root, "src/chat/generated");
fs.mkdirSync(target, { recursive: true });
const files = ["ai-context", "ai-state", "ai-client", "store", "planner"];
for (const file of files) {
  const source = fs.readFileSync(
    path.join(root, "miniprogram/utils", file + ".js"),
    "utf8",
  );
  fs.writeFileSync(
    path.join(target, file + ".cjs"),
    source.replace(/require\(['"]\.\/([^'"]+)['"]\)/g, "require('./$1.cjs')"),
  );
}
const exports = [
  "defaults",
  "getSettings",
  "saveSettings",
  "getSecret",
  "clearSecret",
  "listSessions",
  "newSession",
  "getSession",
  "saveSession",
  "removeSession",
];
const entry =
  `import state from './ai-state.cjs'; import context from './ai-context.cjs'; import client from './ai-client.cjs';\n` +
  exports.map((name) => `export const ${name} = state.${name};`).join("\n") +
  "\nexport const {SCOPES, SYSTEM_PROMPT, buildContext, buildMessages, prepareMessages} = context;\nexport const {requestChat, validateSettings} = client;";
await build({
  stdin: {
    contents: entry,
    resolveDir: target,
    sourcefile: "entry.mjs",
    loader: "js",
  },
  bundle: true,
  format: "esm",
  platform: "browser",
  outfile: path.join(target, "core.js"),
  logLevel: "warning",
});
for (const file of files) fs.unlinkSync(path.join(target, file + ".cjs"));
console.log(
  "✓ Web AI core built from native source (no duplicate prompts or transport).",
);
