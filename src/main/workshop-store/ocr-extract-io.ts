import fs from "node:fs";
import type { OcrTsvWord } from "./ocr-paddle-payload";

export function cleanupTempFile(filePath: string | null): void {
  if (!filePath) {
    return;
  }
  if (!fs.existsSync(filePath)) {
    return;
  }
  try {
    fs.unlinkSync(filePath);
  } catch {
    // ignore
  }
}

export function stringifyOcrWords(words: OcrTsvWord[]): string {
  return words
    .map((word) => `${word.left},${word.top},${word.width},${word.height},${word.confidence.toFixed(2)}\t${word.text}`)
    .join("\n");
}
