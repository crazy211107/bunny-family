import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";
const root = path.resolve(import.meta.dirname, "..");
const suite = process.argv[2] === 'product' ? 'product' : 'chat';
const output = path.join(root, `output/chat-qa/${suite}-dom-test.mjs`);
await build({
  entryPoints: [path.join(root, `scripts/${suite}-ui.test.tsx`)],
  outfile: output,
  bundle: true,
  platform: "node",
  format: "esm",
  packages: "external",
  loader: { ".css": "empty" },
  logLevel: "warning",
  target: "node22",
});
const result = spawnSync(
  process.execPath,
  [
    "--import",
    pathToFileURL(path.join(root, "scripts/chat-test-env.mjs")).href,
    output,
  ],
  {
    cwd: root,
    encoding: "utf8",
    timeout: 50000,
    env: { ...process.env, DEBUG_PRINT_LIMIT: "700", COLORS: "false" },
  },
);
process.stdout.write(result.stdout || "");
process.stderr.write(result.stderr || "");
if (result.error) process.stderr.write('DOM runner did not finish: ' + result.error.message + '\n');
process.exit(result.status ?? 1);
