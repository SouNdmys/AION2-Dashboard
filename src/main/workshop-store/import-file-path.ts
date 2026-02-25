import fs from "node:fs";
import path from "node:path";

export function resolveImportFilePath(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("导入文件路径不能为空。");
  }
  if (path.isAbsolute(trimmed) && fs.existsSync(trimmed)) {
    return trimmed;
  }
  const candidates = [path.resolve(process.cwd(), trimmed), path.resolve(process.cwd(), path.basename(trimmed))];
  const hit = candidates.find((entry) => fs.existsSync(entry));
  if (!hit) {
    throw new Error(`未找到导入文件: ${trimmed}`);
  }
  return hit;
}
