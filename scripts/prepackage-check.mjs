import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, "..");

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function checkOutputs() {
  const requiredFiles = ["out/main/index.js", "out/preload/index.mjs", "out/renderer/index.html"];
  const missing = requiredFiles.filter((path) => !existsSync(resolve(projectRoot, path)));
  if (missing.length > 0) {
    console.error("[check:prepackage] Missing build artifacts:");
    for (const path of missing) {
      console.error(`  - ${path}`);
    }
    process.exit(1);
  }
}

console.log("[check:prepackage] Step 1/3: typecheck");
run("npm", ["run", "typecheck"]);

console.log("[check:prepackage] Step 2/3: build");
run("npm", ["run", "build"]);

console.log("[check:prepackage] Step 3/3: verify artifacts");
checkOutputs();

console.log("[check:prepackage] OK");
