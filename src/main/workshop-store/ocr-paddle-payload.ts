export interface OcrTsvWord {
  text: string;
  left: number;
  top: number;
  width: number;
  height: number;
  confidence: number;
}

export interface PaddleOcrPayloadWord {
  text?: unknown;
  left?: unknown;
  top?: unknown;
  width?: unknown;
  height?: unknown;
  confidence?: unknown;
}

export interface PaddleOcrPayload {
  id?: unknown;
  ready?: unknown;
  ok?: unknown;
  error?: unknown;
  language?: unknown;
  raw_text?: unknown;
  words?: unknown;
}

export interface PaddleOcrOutcome {
  ok: boolean;
  language: string;
  rawText: string;
  words: OcrTsvWord[];
  errorMessage?: string;
}

export function normalizePaddleWord(raw: PaddleOcrPayloadWord, confidenceScale: number): OcrTsvWord | null {
  const text = typeof raw.text === "string" ? raw.text.trim() : "";
  if (!text) {
    return null;
  }
  const left = typeof raw.left === "number" && Number.isFinite(raw.left) ? Math.floor(raw.left) : 0;
  const top = typeof raw.top === "number" && Number.isFinite(raw.top) ? Math.floor(raw.top) : 0;
  const width = typeof raw.width === "number" && Number.isFinite(raw.width) ? Math.max(1, Math.floor(raw.width)) : 1;
  const height = typeof raw.height === "number" && Number.isFinite(raw.height) ? Math.max(1, Math.floor(raw.height)) : 1;
  const confidenceRaw = typeof raw.confidence === "number" && Number.isFinite(raw.confidence) ? raw.confidence : -1;
  const confidence = confidenceRaw >= 0 && confidenceRaw <= 1.5 ? confidenceRaw * confidenceScale : confidenceRaw;
  return {
    text,
    left,
    top,
    width,
    height,
    confidence,
  };
}

export function parsePaddlePayload(stdout: string, confidenceScale: number): PaddleOcrOutcome {
  const stripAnsi = (input: string): string => input.replace(/\x1b\[[0-9;]*m/g, "");
  const cleaned = stripAnsi(stdout).trim();
  const candidates: string[] = [];
  const pushCandidate = (value: string): void => {
    const text = value.trim();
    if (!text || candidates.includes(text)) {
      return;
    }
    candidates.push(text);
  };
  pushCandidate(cleaned);
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    pushCandidate(cleaned.slice(firstBrace, lastBrace + 1));
  }
  const lines = cleaned
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    if (line.startsWith("{") && line.endsWith("}")) {
      pushCandidate(line);
    }
  }

  let parsed: PaddleOcrPayload | null = null;
  let parseError = "";
  for (const candidate of candidates) {
    try {
      parsed = JSON.parse(candidate) as PaddleOcrPayload;
      break;
    } catch (err) {
      parseError = err instanceof Error ? err.message : "JSON 解析失败";
    }
  }
  if (!parsed) {
    return {
      ok: false,
      language: "",
      rawText: "",
      words: [],
      errorMessage: `OCR 输出 JSON 解析失败：${parseError || "未知错误"}。`,
    };
  }
  return parsePaddlePayloadObject(parsed, confidenceScale);
}

export function parsePaddlePayloadObject(parsed: PaddleOcrPayload, confidenceScale: number): PaddleOcrOutcome {
  const ok = parsed.ok === true;
  if (!ok) {
    const errorMessage = typeof parsed.error === "string" ? parsed.error : "OCR 执行失败。";
    return {
      ok: false,
      language: "",
      rawText: "",
      words: [],
      errorMessage,
    };
  }
  const words = Array.isArray(parsed.words)
    ? parsed.words
        .map((entry) => normalizePaddleWord((entry ?? {}) as PaddleOcrPayloadWord, confidenceScale))
        .filter((entry): entry is OcrTsvWord => entry !== null)
    : [];
  const rawText = typeof parsed.raw_text === "string" ? parsed.raw_text : words.map((word) => word.text).join("\n");
  return {
    ok: true,
    language: typeof parsed.language === "string" ? parsed.language : "",
    rawText,
    words,
  };
}
