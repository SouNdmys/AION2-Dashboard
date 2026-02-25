import type { WorkshopOcrExtractTextResult } from "../../shared/types";

export function normalizeOcrText(raw: string): string {
  return raw
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

export function formatPaddleOcrError(raw: string | undefined): string {
  const message = raw?.trim() || "未知错误";
  const lower = message.toLocaleLowerCase();
  if (lower.includes("convertpirattribute2runtimeattribute") || lower.includes("onednn_instruction.cc")) {
    return `${message}。ONNX 推理初始化失败，请重启后重试。`;
  }
  if (
    lower.includes("no model source is available") ||
    lower.includes("proxyerror") ||
    lower.includes("max retries exceeded") ||
    lower.includes("connecterror")
  ) {
    return `${message}。ONNX 模型加载失败，请检查安装包完整性。`;
  }
  if (lower.includes("onnx") || lower.includes("inference")) {
    return `${message}。请确认系统可加载 ONNX Runtime（首次启动可能稍慢）。`;
  }
  return message;
}

interface BuildPrimaryOcrTextResultInput {
  rawText: string;
  detectedLanguage: string;
  fallbackLanguage: string;
  psm: number;
  warnings: string[];
}

export function buildPrimaryOcrTextResult(input: BuildPrimaryOcrTextResultInput): WorkshopOcrExtractTextResult {
  const text = normalizeOcrText(input.rawText);
  const lineCount = text ? text.split(/\n/u).length : 0;
  if (lineCount === 0) {
    input.warnings.push("OCR 返回为空，请检查截图裁切范围、清晰度或语言包。");
  }
  return {
    rawText: input.rawText,
    text,
    lineCount,
    warnings: input.warnings,
    engine: `onnx-ocr(${input.detectedLanguage || input.fallbackLanguage}, psm=${input.psm})`,
  };
}
