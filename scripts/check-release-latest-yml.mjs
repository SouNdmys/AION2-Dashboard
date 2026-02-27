import { createHash } from "node:crypto";
import { createReadStream, existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, "..");

function parseArgs() {
  const args = process.argv.slice(2);
  const map = new Map();
  for (let i = 0; i < args.length; i += 1) {
    const token = args[i];
    if (!token.startsWith("--")) {
      continue;
    }
    const key = token.slice(2);
    const next = args[i + 1];
    if (!next || next.startsWith("--")) {
      map.set(key, "true");
      continue;
    }
    map.set(key, next);
    i += 1;
  }
  return map;
}

function readPackageVersion() {
  const packageJsonPath = resolve(projectRoot, "package.json");
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  return String(packageJson.version ?? "").trim();
}

function parseLatestYml(content) {
  const pathMatch = content.match(/^\s*path:\s*(.+)\s*$/m);
  const sizeMatch = content.match(/^\s*size:\s*(\d+)\s*$/m);
  const shaMatches = [...content.matchAll(/^\s*sha512:\s*([A-Za-z0-9+/=]+)\s*$/gm)].map((it) => it[1]);

  if (!pathMatch || !sizeMatch || shaMatches.length === 0) {
    throw new Error("latest.yml 缺少 path/size/sha512 字段");
  }

  return {
    expectedPath: pathMatch[1].replace(/^['"]|['"]$/g, ""),
    expectedSize: Number(sizeMatch[1]),
    expectedSha512: shaMatches[shaMatches.length - 1],
  };
}

function toBase64Sha512(filePath) {
  return new Promise((resolveSha, rejectSha) => {
    const hash = createHash("sha512");
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolveSha(hash.digest("base64")));
    stream.on("error", rejectSha);
  });
}

function collectSetupCandidates(releaseDir, expectedPath) {
  const candidates = new Set();
  candidates.add(resolve(releaseDir, expectedPath));
  for (const name of readdirSync(releaseDir)) {
    if (!name.toLowerCase().endsWith(".exe")) {
      continue;
    }
    if (!name.toLowerCase().includes("setup")) {
      continue;
    }
    candidates.add(resolve(releaseDir, name));
  }
  return [...candidates];
}

async function main() {
  const args = parseArgs();
  const version = args.get("version") ?? readPackageVersion();
  if (!version) {
    throw new Error("无法读取版本号，请通过 --version 显式传入");
  }

  const releaseDir = args.get("dir")
    ? resolve(projectRoot, args.get("dir"))
    : resolve(projectRoot, "release", version);
  const latestYmlPath = resolve(releaseDir, "latest.yml");

  if (!existsSync(releaseDir)) {
    throw new Error(`发布目录不存在: ${releaseDir}`);
  }
  if (!existsSync(latestYmlPath)) {
    throw new Error(`latest.yml 不存在: ${latestYmlPath}`);
  }

  const latestContent = readFileSync(latestYmlPath, "utf8");
  const { expectedPath, expectedSize, expectedSha512 } = parseLatestYml(latestContent);
  const candidates = collectSetupCandidates(releaseDir, expectedPath).filter((filePath) => existsSync(filePath));

  if (candidates.length === 0) {
    throw new Error(`未找到可校验的安装包: ${expectedPath}`);
  }

  let matchedFile = null;
  const tried = [];
  for (const filePath of candidates) {
    const fileSize = statSync(filePath).size;
    const fileSha512 = await toBase64Sha512(filePath);
    const matched = fileSize === expectedSize && fileSha512 === expectedSha512;
    tried.push({ filePath, fileSize, fileSha512, matched });
    if (matched) {
      matchedFile = filePath;
      break;
    }
  }

  if (!matchedFile) {
    console.error("[check:release-yml] latest.yml 与安装包不一致");
    console.error(`  releaseDir: ${releaseDir}`);
    console.error(`  expected.path: ${expectedPath}`);
    console.error(`  expected.size: ${expectedSize}`);
    console.error(`  expected.sha512: ${expectedSha512}`);
    for (const row of tried) {
      console.error(`  candidate: ${row.filePath}`);
      console.error(`    size: ${row.fileSize}`);
      console.error(`    sha512: ${row.fileSha512}`);
    }
    process.exit(1);
  }

  console.log("[check:release-yml] OK");
  console.log(`  matched: ${matchedFile}`);
  console.log(`  path(from latest.yml): ${expectedPath}`);
}

main().catch((error) => {
  console.error(`[check:release-yml] ${error.message}`);
  process.exit(1);
});
