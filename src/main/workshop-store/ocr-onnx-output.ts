import type { Line as OnnxOcrLine } from "@gutenye/ocr-node";
import type { OcrTsvWord, PaddleOcrOutcome } from "./ocr-paddle-payload";

export function normalizeOnnxLineWord(raw: OnnxOcrLine, confidenceScale: number): OcrTsvWord | null {
  const text = typeof raw.text === "string" ? raw.text.trim() : "";
  if (!text) {
    return null;
  }
  const box = raw.box;
  if (!Array.isArray(box) || box.length === 0) {
    return {
      text,
      left: 0,
      top: 0,
      width: 1,
      height: 1,
      confidence:
        typeof raw.mean === "number" && Number.isFinite(raw.mean) && raw.mean >= 0 && raw.mean <= 1.5
          ? raw.mean * confidenceScale
          : typeof raw.mean === "number" && Number.isFinite(raw.mean)
            ? raw.mean
            : -1,
    };
  }
  const xs: number[] = [];
  const ys: number[] = [];
  for (const point of box) {
    if (!Array.isArray(point) || point.length < 2) {
      continue;
    }
    const xRaw = point[0];
    const yRaw = point[1];
    if (typeof xRaw !== "number" || !Number.isFinite(xRaw) || typeof yRaw !== "number" || !Number.isFinite(yRaw)) {
      continue;
    }
    xs.push(xRaw);
    ys.push(yRaw);
  }
  if (xs.length === 0 || ys.length === 0) {
    return null;
  }
  const left = Math.floor(Math.min(...xs));
  const top = Math.floor(Math.min(...ys));
  const right = Math.ceil(Math.max(...xs));
  const bottom = Math.ceil(Math.max(...ys));
  const confidenceRaw = typeof raw.mean === "number" && Number.isFinite(raw.mean) ? raw.mean : -1;
  return {
    text,
    left,
    top,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
    confidence: confidenceRaw >= 0 && confidenceRaw <= 1.5 ? confidenceRaw * confidenceScale : confidenceRaw,
  };
}

export function buildOnnxOcrOutcome(lines: OnnxOcrLine[], language: string, confidenceScale: number): PaddleOcrOutcome {
  const words = lines
    .map((line) => normalizeOnnxLineWord(line, confidenceScale))
    .filter((line): line is OcrTsvWord => line !== null);
  const rawText = lines
    .map((line) => (typeof line.text === "string" ? line.text.trim() : ""))
    .filter(Boolean)
    .join("\n");
  return {
    ok: true,
    language,
    rawText,
    words,
  };
}
