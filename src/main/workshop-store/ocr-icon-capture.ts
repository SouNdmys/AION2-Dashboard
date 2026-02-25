import { createHash } from "node:crypto";
import path from "node:path";
import { nativeImage } from "electron";
import type { WorkshopItem, WorkshopOcrIconCaptureConfig, WorkshopRect } from "../../shared/types";
import type { ParsedOcrPriceLine } from "./ocr-import-parser";
import { resolveImportFilePath } from "./import-file-path";

const ICON_CAPTURE_CALIBRATION_MAX_OFFSET_X = 16;
const ICON_CAPTURE_CALIBRATION_MAX_OFFSET_Y = 24;
const ICON_CAPTURE_CALIBRATION_STEP = 2;
const ICON_CAPTURE_CALIBRATION_SAMPLE_LIMIT = 8;

export interface OcrIconCaptureOutcome {
  iconByLineNumber: Map<number, string>;
  iconCapturedCount: number;
  iconSkippedCount: number;
  warnings: string[];
}

interface OcrIconMatchingDeps {
  normalizeLookupName: (name: string) => string;
  resolveItemByOcrName: (itemByLookupName: Map<string, WorkshopItem>, rawName: string) => WorkshopItem | undefined;
  isCapturedImageIcon: (icon: string | undefined) => boolean;
}

export function buildExpectedIconByLineNumber(
  parsedLines: ParsedOcrPriceLine[],
  itemByLookupName: Map<string, WorkshopItem>,
  deps: OcrIconMatchingDeps,
): Map<number, string> {
  const expected = new Map<number, string>();
  const uniqueLines = new Map<number, ParsedOcrPriceLine>();
  parsedLines.forEach((line) => {
    if (!uniqueLines.has(line.lineNumber)) {
      uniqueLines.set(line.lineNumber, line);
    }
  });
  Array.from(uniqueLines.values()).forEach((line) => {
    const key = deps.normalizeLookupName(line.itemName);
    const exact = itemByLookupName.get(key);
    const resolved = exact ?? deps.resolveItemByOcrName(itemByLookupName, line.itemName);
    const resolvedIcon = resolved?.icon;
    if (!resolved || !deps.isCapturedImageIcon(resolvedIcon)) {
      return;
    }
    expected.set(line.lineNumber, resolvedIcon!);
  });
  return expected;
}

export function captureOcrLineIcons(
  parsedLines: ParsedOcrPriceLine[],
  config: WorkshopOcrIconCaptureConfig,
  expectedIconByLineNumber?: Map<number, string>,
): OcrIconCaptureOutcome {
  const iconByLineNumber = new Map<number, string>();
  const warnings: string[] = [];
  const uniqueLineCount = new Set(parsedLines.map((line) => line.lineNumber)).size;
  const addWarning = (message: string): void => {
    if (warnings.length < 40) {
      warnings.push(message);
    }
  };

  let imagePath: string;
  try {
    imagePath = resolveImportFilePath(config.screenshotPath);
  } catch (err) {
    addWarning(err instanceof Error ? `图标抓取失败：${err.message}` : "图标抓取失败：无法定位截图路径。");
    return {
      iconByLineNumber,
      iconCapturedCount: 0,
      iconSkippedCount: uniqueLineCount,
      warnings,
    };
  }

  const image = nativeImage.createFromPath(imagePath);
  if (image.isEmpty()) {
    addWarning(`图标抓取失败：截图无法读取 (${path.basename(imagePath)})。`);
    return {
      iconByLineNumber,
      iconCapturedCount: 0,
      iconSkippedCount: uniqueLineCount,
      warnings,
    };
  }

  const imageSize = image.getSize();
  let iconCapturedCount = 0;
  let iconSkippedCount = 0;
  const uniqueLines = new Map<number, ParsedOcrPriceLine>();
  parsedLines.forEach((line) => {
    if (!uniqueLines.has(line.lineNumber)) {
      uniqueLines.set(line.lineNumber, line);
    }
  });

  const calibration = calibrateIconCaptureOffset(Array.from(uniqueLines.values()), expectedIconByLineNumber, config, image, imageSize);
  const calibratedOffsetX = calibration.offsetX;
  const calibratedOffsetY = calibration.offsetY;
  if (
    calibration.sampleCount > 0 &&
    calibration.matchedCount > 0 &&
    (calibratedOffsetX !== 0 || calibratedOffsetY !== 0)
  ) {
    addWarning(
      `图标抓取已自动微调偏移：X ${calibratedOffsetX >= 0 ? "+" : ""}${calibratedOffsetX}px，Y ${
        calibratedOffsetY >= 0 ? "+" : ""
      }${calibratedOffsetY}px（命中 ${calibration.matchedCount}/${calibration.sampleCount}）。`,
    );
  }

  Array.from(uniqueLines.values()).forEach((line) => {
    const rowIndex = Math.max(0, line.lineNumber - 1);
    const left = config.nameAnchorX + config.iconOffsetX + calibratedOffsetX;
    const top = config.firstRowTop + rowIndex * config.rowHeight + config.iconTopOffset + calibratedOffsetY;
    const rect = {
      x: Math.floor(left),
      y: Math.floor(top),
      width: Math.floor(config.iconWidth),
      height: Math.floor(config.iconHeight),
    };
    const isInside =
      rect.x >= 0 &&
      rect.y >= 0 &&
      rect.width > 0 &&
      rect.height > 0 &&
      rect.x + rect.width <= imageSize.width &&
      rect.y + rect.height <= imageSize.height;
    if (!isInside) {
      iconSkippedCount += 1;
      addWarning(`第 ${line.lineNumber} 行图标窗口越界，已跳过。`);
      return;
    }
    const bitmap = image.crop(rect).toBitmap();
    if (!bitmap || bitmap.length === 0) {
      iconSkippedCount += 1;
      addWarning(`第 ${line.lineNumber} 行图标抓取为空，已跳过。`);
      return;
    }
    const hash = createHash("sha1").update(bitmap).digest("hex").slice(0, 16);
    iconByLineNumber.set(line.lineNumber, `icon-img-${hash}`);
    iconCapturedCount += 1;
  });

  return {
    iconByLineNumber,
    iconCapturedCount,
    iconSkippedCount,
    warnings,
  };
}

function captureIconHashByRect(
  image: Electron.NativeImage,
  imageSize: { width: number; height: number },
  rect: WorkshopRect,
): string | null {
  const isInside =
    rect.x >= 0 &&
    rect.y >= 0 &&
    rect.width > 0 &&
    rect.height > 0 &&
    rect.x + rect.width <= imageSize.width &&
    rect.y + rect.height <= imageSize.height;
  if (!isInside) {
    return null;
  }
  const bitmap = image.crop(rect).toBitmap();
  if (!bitmap || bitmap.length === 0) {
    return null;
  }
  const hash = createHash("sha1").update(bitmap).digest("hex").slice(0, 16);
  return `icon-img-${hash}`;
}

function calibrateIconCaptureOffset(
  uniqueLines: ParsedOcrPriceLine[],
  expectedIconByLineNumber: Map<number, string> | undefined,
  config: WorkshopOcrIconCaptureConfig,
  image: Electron.NativeImage,
  imageSize: { width: number; height: number },
): { offsetX: number; offsetY: number; matchedCount: number; sampleCount: number } {
  if (!expectedIconByLineNumber || expectedIconByLineNumber.size === 0) {
    return { offsetX: 0, offsetY: 0, matchedCount: 0, sampleCount: 0 };
  }

  const sampleLines = uniqueLines
    .filter((line) => expectedIconByLineNumber.has(line.lineNumber))
    .sort((left, right) => left.lineNumber - right.lineNumber)
    .slice(0, ICON_CAPTURE_CALIBRATION_SAMPLE_LIMIT);
  if (sampleLines.length === 0) {
    return { offsetX: 0, offsetY: 0, matchedCount: 0, sampleCount: 0 };
  }

  let best = { offsetX: 0, offsetY: 0, matchedCount: 0, score: Number.POSITIVE_INFINITY };
  for (
    let offsetY = -ICON_CAPTURE_CALIBRATION_MAX_OFFSET_Y;
    offsetY <= ICON_CAPTURE_CALIBRATION_MAX_OFFSET_Y;
    offsetY += ICON_CAPTURE_CALIBRATION_STEP
  ) {
    for (
      let offsetX = -ICON_CAPTURE_CALIBRATION_MAX_OFFSET_X;
      offsetX <= ICON_CAPTURE_CALIBRATION_MAX_OFFSET_X;
      offsetX += ICON_CAPTURE_CALIBRATION_STEP
    ) {
      let matchedCount = 0;
      sampleLines.forEach((line) => {
        const rowIndex = Math.max(0, line.lineNumber - 1);
        const rect: WorkshopRect = {
          x: Math.floor(config.nameAnchorX + config.iconOffsetX + offsetX),
          y: Math.floor(config.firstRowTop + rowIndex * config.rowHeight + config.iconTopOffset + offsetY),
          width: Math.floor(config.iconWidth),
          height: Math.floor(config.iconHeight),
        };
        const hash = captureIconHashByRect(image, imageSize, rect);
        const expected = expectedIconByLineNumber.get(line.lineNumber);
        if (hash && expected && hash === expected) {
          matchedCount += 1;
        }
      });

      const score = Math.abs(offsetX) + Math.abs(offsetY);
      if (matchedCount > best.matchedCount || (matchedCount === best.matchedCount && score < best.score)) {
        best = { offsetX, offsetY, matchedCount, score };
      }
    }
  }

  if (best.matchedCount <= 0) {
    return { offsetX: 0, offsetY: 0, matchedCount: 0, sampleCount: sampleLines.length };
  }
  return {
    offsetX: best.offsetX,
    offsetY: best.offsetY,
    matchedCount: best.matchedCount,
    sampleCount: sampleLines.length,
  };
}
