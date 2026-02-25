import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import type { WorkshopItemCategory, WorkshopRecipeInput } from "../../shared/types";

const BUILTIN_CATALOG_FILE_NAME = "制作管理.md";

export interface CatalogItemRow {
  name: string;
  rawCategory: string;
  mainCategory?: string;
  alias?: string;
}

export interface CatalogRecipeRow {
  outputName: string;
  outputQuantity: number;
  mainCategory?: string;
  inputs: WorkshopRecipeInput[];
}

function stripCatalogImprintTag(value: string): string {
  return value.replace(/[（(]\s*刻印\s*[）)]/gu, "");
}

export function normalizeCatalogItemName(name: string): string {
  return stripCatalogImprintTag(name).trim().replace(/\s+/g, " ");
}

export function normalizeCatalogLookupName(name: string): string {
  return normalizeCatalogItemName(name).toLocaleLowerCase().replace(/\s+/g, "");
}

export function normalizeCatalogMainCategory(raw: string): string {
  const value = raw.trim();
  if (!value) {
    return "";
  }
  if (value === "铁匠") {
    return "鐵匠";
  }
  if (value === "手工艺") {
    return "手工藝";
  }
  if (value === "采集材料") {
    return "採集材料";
  }
  return value;
}

function isMajorCatalogMainCategory(category: string): boolean {
  return (
    category === "採集材料" ||
    category === "鐵匠" ||
    category === "盔甲" ||
    category === "手工藝" ||
    category === "煉金" ||
    category === "料理"
  );
}

function sanitizeRecipeOutputName(raw: string): string {
  return normalizeCatalogItemName(raw).replace(/\s*[（(]批量[）)]\s*$/u, "");
}

function parseRecipeInputChunk(chunk: string): { itemName: string; quantity: number } | null {
  const value = chunk.trim();
  if (!value) {
    return null;
  }
  const match = value.match(/^(.*?)(\d+)$/u);
  if (!match) {
    return null;
  }
  const head = match[1]?.replace(/[*xX×]\s*$/u, "").trim() ?? "";
  const tail = match[2] ?? "";
  const quantity = Number(tail);
  if (!head || !Number.isFinite(quantity) || quantity <= 0) {
    return null;
  }
  return {
    itemName: normalizeCatalogItemName(head),
    quantity: Math.floor(quantity),
  };
}

export function mapCatalogCategory(rawCategory: string): WorkshopItemCategory {
  const category = rawCategory.trim();
  if (category.includes("武器") || category.includes("裝備") || category.includes("防具") || category.includes("盔甲")) {
    return "equipment";
  }
  if (category.includes("採集")) {
    return "material";
  }
  if (category.includes("材料") || category.includes("消耗")) {
    return "component";
  }
  return "other";
}

export function parseCatalogCsvText(text: string): {
  items: CatalogItemRow[];
  recipes: CatalogRecipeRow[];
  warnings: string[];
} {
  const lines = text.split(/\r?\n/u);
  const warnings: string[] = [];
  const itemRows: CatalogItemRow[] = [];
  const recipeRows: CatalogRecipeRow[] = [];
  let mode: "item" | "recipe" = "item";
  let currentMainCategory = "未分類";

  lines.forEach((rawLine, index) => {
    const lineNo = index + 1;
    const line = rawLine.trim();
    if (!line) {
      return;
    }
    if (line.startsWith("#")) {
      const heading = normalizeCatalogMainCategory(line.replace(/^#+\s*/u, ""));
      if (heading && isMajorCatalogMainCategory(heading)) {
        currentMainCategory = heading;
      }
      mode = "item";
      return;
    }
    if (line.startsWith("名稱(繁體),分類")) {
      mode = "item";
      return;
    }
    if (line.startsWith("成品名稱,產量")) {
      mode = "recipe";
      return;
    }

    if (mode === "item") {
      const segments = rawLine.split(",");
      const name = normalizeCatalogItemName(segments[0] ?? "");
      const rawCategory = (segments[1] ?? "").trim();
      const alias = normalizeCatalogItemName(segments.slice(2).join(","));
      if (!name || !rawCategory) {
        return;
      }
      itemRows.push({
        name,
        rawCategory,
        mainCategory: currentMainCategory,
        alias: alias || undefined,
      });
      return;
    }

    const first = rawLine.indexOf(",");
    const second = first < 0 ? -1 : rawLine.indexOf(",", first + 1);
    if (first < 0 || second < 0) {
      warnings.push(`第 ${lineNo} 行配方格式异常: ${line}`);
      return;
    }
    const outputRawName = normalizeCatalogItemName(rawLine.slice(0, first));
    const outputQuantityRaw = rawLine.slice(first + 1, second).trim();
    const inputText = rawLine.slice(second + 1).trim();
    const outputQuantity = Number(outputQuantityRaw);
    if (!outputRawName || !Number.isFinite(outputQuantity) || outputQuantity <= 0) {
      warnings.push(`第 ${lineNo} 行配方产物格式异常: ${line}`);
      return;
    }
    const outputName = sanitizeRecipeOutputName(outputRawName);
    const inputChunks = inputText
      .split(/[;；]/u)
      .map((entry) => entry.trim())
      .filter(Boolean);
    const parsedInputs = inputChunks
      .map((entry) => parseRecipeInputChunk(entry))
      .filter((entry): entry is { itemName: string; quantity: number } => entry !== null)
      .map((entry) => ({
        itemId: entry.itemName,
        quantity: entry.quantity,
      }));
    if (parsedInputs.length === 0) {
      warnings.push(`第 ${lineNo} 行配方材料为空: ${line}`);
      return;
    }
    recipeRows.push({
      outputName,
      outputQuantity: Math.floor(outputQuantity),
      mainCategory: currentMainCategory,
      inputs: parsedInputs,
    });
  });

  return {
    items: itemRows,
    recipes: recipeRows,
    warnings,
  };
}

export function resolveCatalogImportFilePath(raw: string): string {
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

export function resolveBuiltinCatalogFilePath(): string {
  const candidates: string[] = [];
  const pushCandidate = (entry: string): void => {
    if (!entry || candidates.includes(entry)) {
      return;
    }
    candidates.push(entry);
  };

  const tryResolveWithBase = (baseDir: string): void => {
    if (!baseDir) {
      return;
    }
    pushCandidate(path.resolve(baseDir, BUILTIN_CATALOG_FILE_NAME));
    pushCandidate(path.resolve(baseDir, "..", BUILTIN_CATALOG_FILE_NAME));
    pushCandidate(path.resolve(baseDir, "..", "..", BUILTIN_CATALOG_FILE_NAME));
  };

  tryResolveWithBase(process.cwd());
  if (process.resourcesPath) {
    tryResolveWithBase(process.resourcesPath);
    tryResolveWithBase(path.resolve(process.resourcesPath, "app.asar.unpacked"));
  }
  try {
    tryResolveWithBase(app.getAppPath());
  } catch {
    // ignore before app ready
  }

  const hit = candidates.find((entry) => fs.existsSync(entry));
  if (!hit) {
    throw new Error(`未找到内置目录文件: ${BUILTIN_CATALOG_FILE_NAME}`);
  }
  return hit;
}

export function resolveBuiltinCatalogSignature(): string {
  const filePath = resolveBuiltinCatalogFilePath();
  const text = fs.readFileSync(filePath, "utf8");
  return createHash("sha1").update(text).digest("hex");
}
