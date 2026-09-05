import { spawn } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const [tool, ...args] = process.argv.slice(2);
const allowed = new Set(["vite", "vinext", "eslint", "drizzle-kit"]);
if (!allowed.has(tool)) throw new Error(`Unsupported tool: ${tool}`);
const packagePath = resolve(root, "node_modules", tool, "package.json");
const pkg = JSON.parse(readFileSync(packagePath, "utf8"));
const bin = typeof pkg.bin === "string" ? pkg.bin : pkg.bin[tool];
if (!bin) throw new Error(`Missing executable for ${tool}`);
const logs = resolve(root, ".wrangler", "logs");
mkdirSync(logs, { recursive: true });
const child = spawn(process.execPath, [resolve(dirname(packagePath), bin), ...args], {
  cwd: root,
  stdio: "inherit",
  env: {
    ...process.env,
    WRANGLER_WRITE_LOGS: "false",
    WRANGLER_LOG_PATH: logs,
    MINIFLARE_REGISTRY_PATH: resolve(root, ".wrangler", "registry"),
  },
});
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on("exit", (code) => { process.exitCode = code ?? 1; });
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
