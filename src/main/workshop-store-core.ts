import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { nativeImage } from "electron";
import Store from "electron-store";
import OcrNode, { type Line as OnnxOcrLine } from "@gutenye/ocr-node";
import { tify } from "chinese-conv";
import { resolveImportFilePath } from "./workshop-store/import-file-path";
import { getBuiltinCatalogSignature, rebuildStateWithBuiltinCatalog } from "./workshop-store/catalog-bootstrap";
import {
  buildPaddleLanguageCandidates,
  sanitizeOcrLanguage,
  sanitizeOcrPsm,
  sanitizeOcrSafeMode,
} from "./workshop-store/ocr-extract-config";
import { buildExpectedIconByLineNumber, captureOcrLineIcons } from "./workshop-store/ocr-icon-capture";
import { sanitizeTradeBoardPreset } from "./workshop-store/ocr-tradeboard-preset";
import {
  buildNameRowsFromWords,
  buildPriceRowsFromWords,
  detectTradePriceRoleByHeaderText,
  normalizeNumericToken,
  parseNonEmptyLines,
  parsePriceFromLine,
  resolveTradeBoardRowCount,
} from "./workshop-store/ocr-tradeboard-rows";
import {
  parseOcrPriceLines,
  parseOcrTradeRows,
  sanitizeOcrImportPayload,
} from "./workshop-store/ocr-import-parser";
import { buildOnnxOcrOutcome } from "./workshop-store/ocr-onnx-output";
import { parsePaddlePayload, parsePaddlePayloadObject } from "./workshop-store/ocr-paddle-payload";
import type { OcrTsvWord, PaddleOcrOutcome, PaddleOcrPayload } from "./workshop-store/ocr-paddle-payload";
import type {
  AddWorkshopPriceSnapshotInput,
  WorkshopOcrExtractTextInput,
  WorkshopOcrExtractTextResult,
  WorkshopOcrPriceImportInput,
  WorkshopOcrPriceImportResult,
  WorkshopRect,
  WorkshopInventoryItem,
  WorkshopItem,
  WorkshopItemCategory,
  WorkshopPriceMarket,
  WorkshopPriceSignalRule,
  WorkshopPriceSnapshot,
  WorkshopRecipe,
  WorkshopRecipeInput,
  WorkshopState,
} from "../shared/types";

export const WORKSHOP_STATE_VERSION = 6;
export const WORKSHOP_PRICE_HISTORY_LIMIT = 8_000;
export const WORKSHOP_HISTORY_DEFAULT_DAYS = 30;
export const WORKSHOP_HISTORY_MAX_DAYS = 365;
export const WORKSHOP_SIGNAL_THRESHOLD_DEFAULT = 0.15;
export const WORKSHOP_SIGNAL_THRESHOLD_MIN = 0.15;
export const WORKSHOP_SIGNAL_THRESHOLD_MAX = 0.5;
export const WORKSHOP_SIGNAL_MIN_SAMPLE_COUNT = 5;
export const WORKSHOP_PRICE_ANOMALY_BASELINE_DAYS = 30;
const WORKSHOP_PRICE_ANOMALY_BASELINE_MIN_SAMPLES = 8;
const WORKSHOP_PRICE_ANOMALY_SOFT_UPPER_RATIO = 2.2;
const WORKSHOP_PRICE_ANOMALY_SOFT_LOWER_RATIO = 0.45;
const WORKSHOP_PRICE_ANOMALY_HARD_UPPER_RATIO = 8;
const WORKSHOP_PRICE_ANOMALY_HARD_LOWER_RATIO = 0.125;
const WORKSHOP_PRICE_RULE_EQUIPMENT_MIN_SUSPECT = 500_000;
const WORKSHOP_PRICE_RULE_EQUIPMENT_MIN_HARD = 100_000;
const WORKSHOP_PRICE_RULE_EQUIPMENT_MAX_SUSPECT = 1_000_000_000;
const WORKSHOP_PRICE_RULE_EQUIPMENT_MAX_HARD = 2_000_000_000;
const WORKSHOP_PRICE_RULE_MATERIAL_MAX_SUSPECT = 10_000_000;
const WORKSHOP_PRICE_RULE_MATERIAL_MAX_HARD = 100_000_000;
const WORKSHOP_PRICE_RULE_COMPONENT_MAX_SUSPECT = 10_000_000;
const WORKSHOP_PRICE_RULE_COMPONENT_MAX_HARD = 100_000_000;
export const WORKSHOP_PRICE_NOTE_TAG_SUSPECT = "qa:suspect:auto";
export const WORKSHOP_PRICE_NOTE_TAG_HARD = "qa:hard-outlier:auto";
export const WORKSHOP_ICON_CACHE_KEY = "iconCache";
const WORKSHOP_OCR_IMPORT_YIELD_EVERY = 40;
export const WORKSHOP_SIGNAL_YIELD_EVERY = 12;
const WORKSHOP_KNOWN_INVALID_ITEM_NAMES = new Set<string>([
  "燦爛的奧里哈康礫石",
  "純淨的奧里哈康磐石",
  "高純度的奧里哈康磐石",
  "新鮮的金盒花",
]);
const OCR_TSV_NAME_CONFIDENCE_MIN = 35;
const OCR_TSV_NUMERIC_CONFIDENCE_MIN = 20;
const OCR_TRADE_BOARD_NAME_SCALE = 3;
const OCR_PADDLE_CONFIDENCE_SCALE = 100;
const OCR_PADDLE_MAX_BUFFER = 64 * 1024 * 1024;
const OCR_PADDLE_REQUEST_TIMEOUT_MS = 20_000;
const OCR_ENABLE_PYTHON_FALLBACK = false;
const OCR_PADDLE_RUNTIME_ROOT = path.join(os.tmpdir(), "aion2-paddle-runtime");
const OCR_PADDLE_RUNTIME_USER = path.join(OCR_PADDLE_RUNTIME_ROOT, "user");
const OCR_PADDLE_RUNTIME_CACHE = path.join(OCR_PADDLE_RUNTIME_ROOT, "cache");
const OCR_PADDLE_RUNTIME_HOME = path.join(OCR_PADDLE_RUNTIME_ROOT, "paddle");
const PADDLE_OCR_PYTHON_SCRIPT = String.raw`import json
import os
import sys

os.environ.setdefault("FLAGS_enable_pir_api", "0")
os.environ.setdefault("FLAGS_enable_pir_in_executor", "0")
os.environ.setdefault("FLAGS_use_mkldnn", "0")
os.environ.setdefault("FLAGS_prim_all", "0")

try:
    import paddle
    from paddleocr import PaddleOCR
    try:
        paddle.set_flags(
            {
                "FLAGS_enable_pir_api": False,
                "FLAGS_enable_pir_in_executor": False,
                "FLAGS_use_mkldnn": False,
                "FLAGS_prim_all": False,
            }
        )
    except Exception:
        pass
except Exception as exc:
    print(json.dumps({"ok": False, "error": f"import paddleocr failed: {exc}"}, ensure_ascii=False))
    sys.exit(0)


def parse_safe_mode(raw):
    if raw is None:
        return True
    if isinstance(raw, bool):
        return raw
    text = str(raw).strip().lower()
    return text not in {"0", "false", "off", "no"}


def make_engine(lang, safe_mode):
    strict_cpu = [
        {
            "lang": lang,
            "device": "cpu",
            "show_log": False,
            "enable_mkldnn": False,
            "use_doc_orientation_classify": False,
            "use_doc_unwarping": False,
            "use_textline_orientation": False,
            "use_angle_cls": False,
        },
        {"lang": lang, "show_log": False, "device": "cpu", "enable_mkldnn": False},
    ]
    performance = [
        {
            "lang": lang,
            "show_log": False,
            "enable_mkldnn": False,
            "use_doc_orientation_classify": False,
            "use_doc_unwarping": False,
            "use_textline_orientation": False,
            "use_angle_cls": False,
        },
        {"lang": lang, "show_log": False, "enable_mkldnn": False},
        {"lang": lang},
    ]
    attempts = strict_cpu if safe_mode else (performance + strict_cpu)
    errors = []
    for kwargs in attempts:
        try:
            return PaddleOCR(**kwargs)
        except Exception as exc:
            errors.append(str(exc))
    raise RuntimeError("create engine failed: " + " | ".join(errors))


def parse_line(line):
    if not isinstance(line, (list, tuple)) or len(line) < 2:
        return None
    box = line[0]
    info = line[1]
    if not isinstance(box, (list, tuple)) or len(box) == 0:
        return None
    xs = []
    ys = []
    for point in box:
        if not isinstance(point, (list, tuple)) or len(point) < 2:
            continue
        try:
            xs.append(float(point[0]))
            ys.append(float(point[1]))
        except Exception:
            continue
    if len(xs) == 0 or len(ys) == 0:
        return None
    text = ""
    confidence = -1.0
    if isinstance(info, (list, tuple)):
        if len(info) >= 1 and info[0] is not None:
            text = str(info[0]).strip()
        if len(info) >= 2:
            try:
                confidence = float(info[1])
            except Exception:
                confidence = -1.0
    else:
        text = str(info).strip()
    if not text:
        return None
    if confidence >= 0 and confidence <= 1.5:
        confidence = confidence * 100.0
    left = int(min(xs))
    top = int(min(ys))
    right = int(max(xs))
    bottom = int(max(ys))
    return {
        "text": text,
        "left": left,
        "top": top,
        "width": max(1, right - left),
        "height": max(1, bottom - top),
        "confidence": confidence,
    }


def collect_words(ocr_result):
    words = []
    texts = []
    if not isinstance(ocr_result, list):
        return words, texts
    for block in ocr_result:
        if not isinstance(block, list):
            continue
        for line in block:
            parsed = parse_line(line)
            if not parsed:
                continue
            words.append(parsed)
            texts.append(parsed["text"])
    return words, texts


def main():
    if len(sys.argv) < 3:
        print(json.dumps({"ok": False, "error": "missing args"}, ensure_ascii=False))
        return
    image_path = sys.argv[1]
    langs = [entry.strip() for entry in sys.argv[2].split(",") if entry.strip()]
    if len(langs) == 0:
        langs = ["ch"]
    safe_mode = parse_safe_mode(os.environ.get("AION2_OCR_SAFE_MODE", "1"))
    errors = []
    for lang in langs:
        try:
            ocr = make_engine(lang, safe_mode)
            try:
                result = ocr.ocr(image_path, cls=False)
            except TypeError:
                result = ocr.ocr(image_path)
            words, texts = collect_words(result)
            print(
                json.dumps(
                    {
                        "ok": True,
                        "language": lang,
                        "raw_text": "\n".join(texts),
                        "words": words,
                    },
                    ensure_ascii=False,
                )
            )
            return
        except Exception as exc:
            errors.append(f"{lang}: {exc}")
    print(json.dumps({"ok": False, "error": " | ".join(errors) or "paddle ocr failed"}, ensure_ascii=False))


if __name__ == "__main__":
    main()
`;
const PADDLE_OCR_PYTHON_WORKER_SCRIPT = String.raw`import json
import os
import sys

os.environ.setdefault("FLAGS_enable_pir_api", "0")
os.environ.setdefault("FLAGS_enable_pir_in_executor", "0")
os.environ.setdefault("FLAGS_use_mkldnn", "0")
os.environ.setdefault("FLAGS_prim_all", "0")

try:
    import paddle
    from paddleocr import PaddleOCR
    try:
        paddle.set_flags(
            {
                "FLAGS_enable_pir_api": False,
                "FLAGS_enable_pir_in_executor": False,
                "FLAGS_use_mkldnn": False,
                "FLAGS_prim_all": False,
            }
        )
    except Exception:
        pass
except Exception as exc:
    print(json.dumps({"ok": False, "error": f"import paddleocr failed: {exc}"}, ensure_ascii=False), flush=True)
    sys.exit(0)


def parse_safe_mode(raw):
    if raw is None:
        return True
    if isinstance(raw, bool):
        return raw
    text = str(raw).strip().lower()
    return text not in {"0", "false", "off", "no"}


def make_engine(lang, safe_mode):
    strict_cpu = [
        {
            "lang": lang,
            "device": "cpu",
            "show_log": False,
            "enable_mkldnn": False,
            "use_doc_orientation_classify": False,
            "use_doc_unwarping": False,
            "use_textline_orientation": False,
            "use_angle_cls": False,
        },
        {"lang": lang, "show_log": False, "device": "cpu", "enable_mkldnn": False},
    ]
    performance = [
        {
            "lang": lang,
            "show_log": False,
            "enable_mkldnn": False,
            "use_doc_orientation_classify": False,
            "use_doc_unwarping": False,
            "use_textline_orientation": False,
            "use_angle_cls": False,
        },
        {"lang": lang, "show_log": False, "enable_mkldnn": False},
        {"lang": lang},
    ]
    attempts = strict_cpu if safe_mode else (performance + strict_cpu)
    errors = []
    for kwargs in attempts:
        try:
            return PaddleOCR(**kwargs)
        except Exception as exc:
            errors.append(str(exc))
    raise RuntimeError("create engine failed: " + " | ".join(errors))


def parse_line(line):
    if not isinstance(line, (list, tuple)) or len(line) < 2:
        return None
    box = line[0]
    info = line[1]
    if not isinstance(box, (list, tuple)) or len(box) == 0:
        return None
    xs = []
    ys = []
    for point in box:
        if not isinstance(point, (list, tuple)) or len(point) < 2:
            continue
        try:
            xs.append(float(point[0]))
            ys.append(float(point[1]))
        except Exception:
            continue
    if len(xs) == 0 or len(ys) == 0:
        return None
    text = ""
    confidence = -1.0
    if isinstance(info, (list, tuple)):
        if len(info) >= 1 and info[0] is not None:
            text = str(info[0]).strip()
        if len(info) >= 2:
            try:
                confidence = float(info[1])
            except Exception:
                confidence = -1.0
    else:
        text = str(info).strip()
    if not text:
        return None
    if confidence >= 0 and confidence <= 1.5:
        confidence = confidence * 100.0
    left = int(min(xs))
    top = int(min(ys))
    right = int(max(xs))
    bottom = int(max(ys))
    return {
        "text": text,
        "left": left,
        "top": top,
        "width": max(1, right - left),
        "height": max(1, bottom - top),
        "confidence": confidence,
    }


def collect_words(ocr_result):
    words = []
    texts = []
    if not isinstance(ocr_result, list):
        return words, texts
    for block in ocr_result:
        if not isinstance(block, list):
            continue
        for line in block:
            parsed = parse_line(line)
            if not parsed:
                continue
            words.append(parsed)
            texts.append(parsed["text"])
    return words, texts


ENGINE_CACHE = {}


def get_engine(lang, safe_mode):
    key = f"{lang}|{'safe' if safe_mode else 'performance'}"
    if key in ENGINE_CACHE:
        return ENGINE_CACHE[key]
    engine = make_engine(lang, safe_mode)
    ENGINE_CACHE[key] = engine
    return engine


def resolve_languages(raw):
    if isinstance(raw, list):
        langs = [str(entry).strip() for entry in raw if str(entry).strip()]
        return langs or ["ch"]
    if isinstance(raw, str):
        langs = [entry.strip() for entry in raw.split(",") if entry.strip()]
        return langs or ["ch"]
    return ["ch"]


def process(req):
    req_id = str(req.get("id", "")).strip()
    image_path = str(req.get("image_path", "")).strip()
    if not image_path:
        return {"id": req_id, "ok": False, "error": "missing image_path"}
    langs = resolve_languages(req.get("languages"))
    safe_mode = parse_safe_mode(req.get("safe_mode", True))
    errors = []
    for lang in langs:
        try:
            ocr = get_engine(lang, safe_mode)
            try:
                result = ocr.ocr(image_path, cls=False)
            except TypeError:
                result = ocr.ocr(image_path)
            words, texts = collect_words(result)
            return {
                "id": req_id,
                "ok": True,
                "language": lang,
                "raw_text": "\n".join(texts),
                "words": words,
            }
        except Exception as exc:
            errors.append(f"{lang}: {exc}")
    return {"id": req_id, "ok": False, "error": " | ".join(errors) or "paddle ocr failed"}


def emit(payload):
    print(json.dumps(payload, ensure_ascii=False), flush=True)


def main():
    emit({"ready": True})
    for line in sys.stdin:
        text = line.strip()
        if not text:
            continue
        try:
            req = json.loads(text)
            if not isinstance(req, dict):
                emit({"ok": False, "error": "invalid request"})
                continue
        except Exception as exc:
            emit({"ok": False, "error": f"invalid json: {exc}"})
            continue
        emit(process(req))


if __name__ == "__main__":
    main()
`;

const DEFAULT_WORKSHOP_SIGNAL_RULE: WorkshopPriceSignalRule = {
  enabled: true,
  lookbackDays: WORKSHOP_HISTORY_DEFAULT_DAYS,
  dropBelowWeekdayAverageRatio: WORKSHOP_SIGNAL_THRESHOLD_DEFAULT,
};

export const workshopStore = new Store<Record<string, unknown>>({
  name: "aion2-dashboard-workshop",
  clearInvalidConfig: true,
  defaults: {
    version: WORKSHOP_STATE_VERSION,
    items: [],
    recipes: [],
    prices: [],
    inventory: [],
    signalRule: DEFAULT_WORKSHOP_SIGNAL_RULE,
    iconCache: {},
  },
});

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function asIso(raw: unknown, fallbackIso: string): string {
  if (typeof raw !== "string") {
    return fallbackIso;
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return fallbackIso;
  }
  return date.toISOString();
}

function sanitizeCategory(raw: unknown): WorkshopItemCategory {
  if (raw === "material" || raw === "equipment" || raw === "component" || raw === "other") {
    return raw;
  }
  return "material";
}

export function sanitizePriceMarket(raw: unknown): WorkshopPriceMarket {
  if (raw === "server" || raw === "world" || raw === "single") {
    return raw;
  }
  return "single";
}

function sanitizeName(raw: unknown, fallback = ""): string {
  if (typeof raw !== "string") {
    return fallback;
  }
  return raw.trim();
}

type PriceAnomalyKind = "normal" | "suspect" | "hard";

interface PriceAnomalyAssessment {
  kind: PriceAnomalyKind;
  sampleCount: number;
  median: number | null;
  ratio: number | null;
  reason: string | null;
}

interface SnapshotQualityTag {
  isSuspect: boolean;
  reason: string | null;
}

export function appendNoteTag(note: string | undefined, tag: string): string {
  const current = note?.trim() ?? "";
  if (!current) {
    return tag;
  }
  const exists = current
    .split(";")
    .map((token) => token.trim())
    .some((token) => token === tag);
  if (exists) {
    return current;
  }
  return `${current};${tag}`;
}

function hasNoteTag(note: string | undefined, prefix: string): boolean {
  if (!note) {
    return false;
  }
  return note
    .split(";")
    .map((token) => token.trim())
    .some((token) => token.startsWith(prefix));
}

export function resolveSnapshotQualityTag(note: string | undefined): SnapshotQualityTag {
  if (hasNoteTag(note, "qa:hard-outlier")) {
    return {
      isSuspect: true,
      reason: "写入时已标记为极端异常价",
    };
  }
  if (hasNoteTag(note, "qa:suspect")) {
    return {
      isSuspect: true,
      reason: "写入时已标记为可疑价",
    };
  }
  return {
    isSuspect: false,
    reason: null,
  };
}

export function normalizePriceMarketForCompare(market: WorkshopPriceMarket | undefined): WorkshopPriceMarket {
  return market ?? "single";
}

function computeMedian(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[mid];
  }
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

function assessPriceAnomaly(unitPrice: number, baselinePrices: number[]): PriceAnomalyAssessment {
  if (baselinePrices.length < WORKSHOP_PRICE_ANOMALY_BASELINE_MIN_SAMPLES) {
    return {
      kind: "normal",
      sampleCount: baselinePrices.length,
      median: null,
      ratio: null,
      reason: null,
    };
  }
  const median = computeMedian(baselinePrices);
  if (median === null || median <= 0) {
    return {
      kind: "normal",
      sampleCount: baselinePrices.length,
      median: null,
      ratio: null,
      reason: null,
    };
  }
  const ratio = unitPrice / median;
  if (ratio >= WORKSHOP_PRICE_ANOMALY_HARD_UPPER_RATIO || ratio <= WORKSHOP_PRICE_ANOMALY_HARD_LOWER_RATIO) {
    return {
      kind: "hard",
      sampleCount: baselinePrices.length,
      median,
      ratio,
      reason: null,
    };
  }
  if (ratio >= WORKSHOP_PRICE_ANOMALY_SOFT_UPPER_RATIO || ratio <= WORKSHOP_PRICE_ANOMALY_SOFT_LOWER_RATIO) {
    return {
      kind: "suspect",
      sampleCount: baselinePrices.length,
      median,
      ratio,
      reason: null,
    };
  }
  return {
    kind: "normal",
    sampleCount: baselinePrices.length,
    median,
    ratio,
    reason: null,
  };
}

function anomalyKindSeverity(kind: PriceAnomalyKind): number {
  if (kind === "hard") {
    return 2;
  }
  if (kind === "suspect") {
    return 1;
  }
  return 0;
}

function assessCategoryPriceAnomaly(unitPrice: number, category: WorkshopItemCategory): PriceAnomalyAssessment {
  const asRule = (kind: PriceAnomalyKind, reason: string): PriceAnomalyAssessment => ({
    kind,
    sampleCount: 0,
    median: null,
    ratio: null,
    reason,
  });

  if (category === "equipment") {
    if (unitPrice < WORKSHOP_PRICE_RULE_EQUIPMENT_MIN_HARD) {
      return asRule("hard", `低于装备最低价护栏（${WORKSHOP_PRICE_RULE_EQUIPMENT_MIN_HARD}）`);
    }
    if (unitPrice < WORKSHOP_PRICE_RULE_EQUIPMENT_MIN_SUSPECT) {
      return asRule("suspect", `低于装备可疑阈值（${WORKSHOP_PRICE_RULE_EQUIPMENT_MIN_SUSPECT}）`);
    }
    if (unitPrice > WORKSHOP_PRICE_RULE_EQUIPMENT_MAX_HARD) {
      return asRule("hard", `高于装备最高价护栏（${WORKSHOP_PRICE_RULE_EQUIPMENT_MAX_HARD}）`);
    }
    if (unitPrice > WORKSHOP_PRICE_RULE_EQUIPMENT_MAX_SUSPECT) {
      return asRule("suspect", `高于装备可疑阈值（${WORKSHOP_PRICE_RULE_EQUIPMENT_MAX_SUSPECT}）`);
    }
    return asRule("normal", "");
  }

  if (category === "material") {
    if (unitPrice > WORKSHOP_PRICE_RULE_MATERIAL_MAX_HARD) {
      return asRule("hard", `高于材料最高价护栏（${WORKSHOP_PRICE_RULE_MATERIAL_MAX_HARD}）`);
    }
    if (unitPrice > WORKSHOP_PRICE_RULE_MATERIAL_MAX_SUSPECT) {
      return asRule("suspect", `高于材料可疑阈值（${WORKSHOP_PRICE_RULE_MATERIAL_MAX_SUSPECT}）`);
    }
    return asRule("normal", "");
  }

  if (category === "component") {
    if (unitPrice > WORKSHOP_PRICE_RULE_COMPONENT_MAX_HARD) {
      return asRule("hard", `高于製作材料最高价护栏（${WORKSHOP_PRICE_RULE_COMPONENT_MAX_HARD}）`);
    }
    if (unitPrice > WORKSHOP_PRICE_RULE_COMPONENT_MAX_SUSPECT) {
      return asRule("suspect", `高于製作材料可疑阈值（${WORKSHOP_PRICE_RULE_COMPONENT_MAX_SUSPECT}）`);
    }
    return asRule("normal", "");
  }

  return asRule("normal", "");
}

function mergePriceAnomalyAssessment(
  baseline: PriceAnomalyAssessment,
  categoryRule: PriceAnomalyAssessment,
): PriceAnomalyAssessment {
  const baselineScore = anomalyKindSeverity(baseline.kind);
  const ruleScore = anomalyKindSeverity(categoryRule.kind);
  if (ruleScore > baselineScore) {
    return categoryRule;
  }
  if (ruleScore === baselineScore && ruleScore > 0 && categoryRule.reason && !baseline.reason) {
    return {
      ...baseline,
      reason: categoryRule.reason,
    };
  }
  return baseline;
}

export function assessPriceAnomalyWithCategory(
  unitPrice: number,
  baselinePrices: number[],
  category: WorkshopItemCategory,
): PriceAnomalyAssessment {
  const baseline = assessPriceAnomaly(unitPrice, baselinePrices);
  const categoryRule = assessCategoryPriceAnomaly(unitPrice, category);
  return mergePriceAnomalyAssessment(baseline, categoryRule);
}

export function formatAnomalyReason(assessment: PriceAnomalyAssessment): string {
  if (assessment.kind === "normal") {
    return assessment.reason ?? "";
  }
  if (assessment.reason) {
    return assessment.reason;
  }
  if (assessment.median === null || assessment.ratio === null) {
    return "";
  }
  const ratioText = `${assessment.ratio >= 1 ? "高于" : "低于"}中位数 ${assessment.ratio.toFixed(2)}x`;
  return `${ratioText}（中位数 ${Math.round(assessment.median)}，样本 ${assessment.sampleCount}）`;
}

export function collectBaselinePricesForItem(
  prices: WorkshopPriceSnapshot[],
  itemId: string,
  market: WorkshopPriceMarket | undefined,
  capturedAtIso: string,
): number[] {
  const targetMarket = normalizePriceMarketForCompare(market);
  const capturedAtMs = new Date(capturedAtIso).getTime();
  const hasValidCapturedAt = Number.isFinite(capturedAtMs);
  const lookbackWindowMs = WORKSHOP_PRICE_ANOMALY_BASELINE_DAYS * 24 * 60 * 60 * 1000;

  return prices
    .filter((row) => row.itemId === itemId)
    .filter((row) => normalizePriceMarketForCompare(row.market) === targetMarket)
    .filter((row) => !resolveSnapshotQualityTag(row.note).isSuspect)
    .filter((row) => {
      if (!hasValidCapturedAt) {
        return true;
      }
      const rowMs = new Date(row.capturedAt).getTime();
      if (!Number.isFinite(rowMs)) {
        return false;
      }
      return rowMs <= capturedAtMs && rowMs >= capturedAtMs - lookbackWindowMs;
    })
    .map((row) => row.unitPrice);
}

function sanitizeIconToken(raw: unknown): string | undefined {
  if (typeof raw !== "string") {
    return undefined;
  }
  const icon = raw.trim();
  return icon || undefined;
}

function isCapturedImageIcon(icon: string | undefined): boolean {
  return typeof icon === "string" && icon.startsWith("icon-img-");
}

const LOOKUP_CJK_VARIANT_MAP: Record<string, string> = {
  纯: "純",
  純: "純",
  强: "強",
  強: "強",
  净: "淨",
  凈: "淨",
  淨: "淨",
  奥: "奧",
  奧: "奧",
  灿: "燦",
  燦: "燦",
  烂: "爛",
  爛: "爛",
  龙: "龍",
  龍: "龍",
  头: "頭",
  頭: "頭",
  台: "臺",
  臺: "臺",
  后: "後",
  後: "後",
  里: "裡",
  裡: "裡",
  矿: "礦",
  礦: "礦",
  铁: "鐵",
  鐵: "鐵",
  锭: "錠",
  錠: "錠",
  级: "級",
  級: "級",
  制: "製",
  製: "製",
};

const OCR_QUALIFIER_PREFIXES = [
  "燦爛的",
  "燦爛",
  "純淨的",
  "純淨",
  "高純度",
  "精製",
  "特級",
  "上級",
  "高級",
  "濃縮",
  "優質",
];

type OcrQualifierFamily = "brilliant" | "pure" | "highPure";

interface OcrQualifierRule {
  family: OcrQualifierFamily;
  canonicalPrefix: string;
  pattern: RegExp;
}

const OCR_QUALIFIER_RULES: OcrQualifierRule[] = [
  {
    family: "brilliant",
    canonicalPrefix: "燦爛的",
    pattern: /^(?:燦爛的|燦爛|燦的|燦|灿烂的|灿烂|灿的|灿)/u,
  },
  {
    family: "pure",
    canonicalPrefix: "純淨的",
    pattern: /^(?:純淨的|純淨|純凈的|純凈|純净的|純净|純的|纯淨的|纯淨|纯凈的|纯凈|纯净的|纯净|纯的|淨的|凈的|净的)/u,
  },
  {
    family: "highPure",
    canonicalPrefix: "高純度的",
    pattern: /^(?:高純度的|高純度|高纯度的|高纯度)/u,
  },
];

const OCR_DOMAIN_NAME_REPLACEMENTS: Array<[RegExp, string]> = [
  [/慎怒/gu, "憤怒"],
  [/憤怒望/gu, "憤怒願望"],
  [/憤怒願$/gu, "憤怒願望"],
  [/愤怒望/gu, "憤怒願望"],
  [/^(?:純|纯)的/u, "純淨的"],
  [/^珂尼$/u, "珂尼玳"],
  [/提石/gu, "提煉石"],
  [/提烦/gu, "提煉"],
  [/(奧[里裡]哈康)石/gu, "$1礦石"],
  [/龍族片/gu, "龍族鱗片"],
];

function normalizeLookupScriptVariant(value: string): string {
  const source = value.trim();
  if (!source) {
    return "";
  }
  try {
    return tify(source);
  } catch {
    return source;
  }
}

function normalizeLookupCjkVariants(value: string): string {
  return value.replace(/[纯純强強净凈淨奥奧灿燦烂爛龙龍头頭台臺后後里裡矿礦铁鐵锭錠级級制製]/gu, (char) => LOOKUP_CJK_VARIANT_MAP[char] ?? char);
}

function normalizeLookupName(name: string): string {
  const scriptNormalized = normalizeLookupScriptVariant(name);
  return normalizeLookupCjkVariants(scriptNormalized.trim().toLocaleLowerCase().replace(/\s+/g, ""));
}

function sanitizeOcrLineItemName(raw: string): string {
  const normalized = raw
    .normalize("NFKC")
    .replace(/[\u00A0\u3000]/g, " ")
    .replace(/[|丨]/g, " ")
    .replace(/[，]/g, ",")
    .replace(/[：]/g, ":")
    .replace(/[“”‘’"'`]/g, "")
    .replace(/[()（）[\]{}<>﹤﹥]/g, " ")
    .replace(/[^0-9a-zA-Z\u3400-\u9fff]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  const compact = normalized.replace(/\s+/g, "");
  return compact ? normalized : "";
}

function normalizeOcrDomainName(rawName: string): string {
  let value = sanitizeOcrLineItemName(rawName).replace(/\s+/g, "");
  if (!value) {
    return "";
  }
  value = normalizeLookupScriptVariant(value);
  OCR_DOMAIN_NAME_REPLACEMENTS.forEach(([pattern, replacement]) => {
    value = value.replace(pattern, replacement);
  });
  return value;
}

function shouldIgnoreOcrItemName(rawName: string): boolean {
  const normalized = normalizeOcrDomainName(rawName);
  if (!normalized) {
    return false;
  }
  const withoutLevelPrefix = normalized.replace(/^道具(?:等級|等级)\d+/u, "");
  return withoutLevelPrefix.startsWith("閃耀的");
}

function findOcrQualifierRule(rawName: string): OcrQualifierRule | undefined {
  const compact = normalizeOcrDomainName(rawName);
  if (!compact) {
    return undefined;
  }
  return OCR_QUALIFIER_RULES.find((rule) => rule.pattern.test(compact));
}

function resolveOcrQualifierFamily(rawName: string): OcrQualifierFamily | undefined {
  return findOcrQualifierRule(rawName)?.family;
}

function normalizeOcrQualifierPrefix(rawName: string): string {
  const compact = normalizeOcrDomainName(rawName);
  if (!compact) {
    return "";
  }
  const rule = findOcrQualifierRule(compact);
  if (!rule) {
    return compact;
  }
  const matched = compact.match(rule.pattern)?.[0] ?? "";
  if (!matched || matched === rule.canonicalPrefix) {
    return compact;
  }
  const rest = compact.slice(matched.length);
  if (!rest) {
    return compact;
  }
  return `${rule.canonicalPrefix}${rest}`;
}

function buildOcrLookupCandidates(rawName: string): string[] {
  const candidates = new Set<string>();
  const add = (value: string): void => {
    const normalized = normalizeLookupName(value);
    if (normalized.length >= 2) {
      candidates.add(normalized);
    }
  };
  add(rawName);
  const domainNormalized = normalizeOcrDomainName(rawName);
  add(domainNormalized);
  const cleaned = sanitizeOcrLineItemName(rawName).replace(/[^0-9a-zA-Z\u3400-\u9fff]/gu, "");
  add(cleaned);
  add(normalizeOcrDomainName(cleaned));
  const normalizedQualifier = normalizeOcrQualifierPrefix(cleaned || rawName);
  if (normalizedQualifier && normalizedQualifier !== cleaned) {
    add(normalizedQualifier);
  }
  const normalizedCleaned = normalizeLookupName(cleaned);
  // Keep limited tolerance for OCR leading numeric noise, but do not trim arbitrary prefixes.
  const trimmedLeadingDigits = normalizedCleaned.replace(/^[0-9]+/u, "");
  if (trimmedLeadingDigits !== normalizedCleaned) {
    add(trimmedLeadingDigits);
  }
  return Array.from(candidates);
}

function hasQualifiedPrefix(name: string): boolean {
  const key = normalizeLookupName(sanitizeOcrLineItemName(name));
  if (!key) {
    return false;
  }
  if (resolveOcrQualifierFamily(name)) {
    return true;
  }
  return OCR_QUALIFIER_PREFIXES.some((prefix) => key.startsWith(normalizeLookupName(prefix)));
}

function isQualifiedNameCollapsedToBaseName(ocrName: string, matchedItemName: string): boolean {
  const ocrKey = normalizeLookupName(sanitizeOcrLineItemName(ocrName));
  const matchedKey = normalizeLookupName(matchedItemName);
  if (!ocrKey || !matchedKey || ocrKey === matchedKey) {
    return false;
  }
  if (!ocrKey.endsWith(matchedKey)) {
    return false;
  }
  if (ocrKey.length - matchedKey.length < 2) {
    return false;
  }
  return hasQualifiedPrefix(ocrName) && !hasQualifiedPrefix(matchedItemName);
}

function levenshteinDistance(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  if (!left) {
    return right.length;
  }
  if (!right) {
    return left.length;
  }
  const prev = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    let diagonal = prev[0];
    prev[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const up = prev[j];
      const leftCost = prev[j - 1] + 1;
      const upCost = up + 1;
      const replaceCost = diagonal + (left[i - 1] === right[j - 1] ? 0 : 1);
      prev[j] = Math.min(leftCost, upCost, replaceCost);
      diagonal = up;
    }
  }
  return prev[right.length];
}

function commonPrefixLength(left: string, right: string): number {
  const max = Math.min(left.length, right.length);
  let count = 0;
  while (count < max && left[count] === right[count]) {
    count += 1;
  }
  return count;
}

function commonSuffixLength(left: string, right: string): number {
  const max = Math.min(left.length, right.length);
  let count = 0;
  while (count < max && left[left.length - 1 - count] === right[right.length - 1 - count]) {
    count += 1;
  }
  return count;
}

function tryCorrectOcrNameByKnownItems(rawOcrName: string, items: WorkshopItem[]): string {
  const sanitized = sanitizeOcrLineItemName(rawOcrName);
  const domainNormalized = normalizeOcrDomainName(sanitized || rawOcrName) || sanitized;
  const normalizedQualifierName = normalizeOcrQualifierPrefix(domainNormalized);
  const normalizedQualifierKey = normalizeLookupName(normalizedQualifierName);
  const ocrKey = normalizeLookupName(domainNormalized);
  const ocrQualifierFamily = resolveOcrQualifierFamily(domainNormalized) ?? resolveOcrQualifierFamily(normalizedQualifierName);
  const fallbackName = domainNormalized || rawOcrName;
  const seedKey = normalizedQualifierKey || ocrKey;
  if (!seedKey || seedKey.length < 3) {
    return fallbackName;
  }
  const exactItem = items.find((item) => {
    const itemKey = normalizeLookupName(item.name);
    return itemKey === seedKey || itemKey === ocrKey;
  });
  if (exactItem) {
    return exactItem.name;
  }

  const candidates: Array<{ itemName: string; score: number }> = [];
  items.forEach((item) => {
    const itemQualifierFamily = resolveOcrQualifierFamily(item.name);
    if (ocrQualifierFamily && itemQualifierFamily !== ocrQualifierFamily) {
      return;
    }
    const itemKey = normalizeLookupName(item.name);
    const maxLengthGap = ocrQualifierFamily ? 2 : 1;
    if (!itemKey || Math.abs(itemKey.length - seedKey.length) > maxLengthGap) {
      return;
    }
    const distance = levenshteinDistance(seedKey, itemKey);
    const maxDistance = ocrQualifierFamily ? 2 : 1;
    if (distance <= 0 || distance > maxDistance) {
      return;
    }
    const prefix = commonPrefixLength(seedKey, itemKey);
    const suffix = commonSuffixLength(seedKey, itemKey);
    if (ocrQualifierFamily && suffix < 2) {
      return;
    }
    // Require at least a stable 2-char anchor (prefix or suffix) to avoid over-correction.
    if (prefix < 2 && suffix < 2) {
      return;
    }
    let score = prefix * 3 + suffix * 2 - Math.abs(itemKey.length - seedKey.length) - distance * 2;
    if (ocrQualifierFamily && itemQualifierFamily === ocrQualifierFamily) {
      score += 5;
    }
    candidates.push({ itemName: item.name, score });
  });
  if (candidates.length === 0) {
    return fallbackName;
  }
  candidates.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }
    return left.itemName.localeCompare(right.itemName, "zh-CN");
  });
  const best = candidates[0];
  const second = candidates[1];
  if (second && second.score >= best.score - 1) {
    return fallbackName;
  }
  return best.itemName;
}

function resolveItemByOcrName(itemByLookupName: Map<string, WorkshopItem>, rawName: string): WorkshopItem | undefined {
  const candidates = buildOcrLookupCandidates(rawName);
  const ocrQualifierFamily = resolveOcrQualifierFamily(rawName) ?? resolveOcrQualifierFamily(normalizeOcrQualifierPrefix(rawName));
  const isQualifierCompatible = (itemName: string): boolean => {
    if (!ocrQualifierFamily) {
      return true;
    }
    return resolveOcrQualifierFamily(itemName) === ocrQualifierFamily;
  };
  for (const candidate of candidates) {
    const exact = itemByLookupName.get(candidate);
    if (exact && isQualifierCompatible(exact.name)) {
      return exact;
    }
  }

  let bestContainItem: WorkshopItem | undefined;
  let bestContainOverlap = -1;
  let bestContainScore = -1;
  itemByLookupName.forEach((item, lookup) => {
    if (!isQualifierCompatible(item.name)) {
      return;
    }
    if (lookup.length < 4) {
      return;
    }
    candidates.forEach((candidate) => {
      const overlap = Math.min(candidate.length, lookup.length);
      if (overlap < 4) {
        return;
      }
      if (!candidate.includes(lookup) && !lookup.includes(candidate)) {
        return;
      }
      const score = overlap / Math.max(candidate.length, lookup.length);
      if (
        overlap > bestContainOverlap ||
        (overlap === bestContainOverlap && score > bestContainScore)
      ) {
        bestContainItem = item;
        bestContainOverlap = overlap;
        bestContainScore = score;
      }
    });
  });
  if (bestContainItem) {
    return bestContainItem;
  }

  const fuzzy: Array<{ item: WorkshopItem; ratio: number; maxLen: number }> = [];
  itemByLookupName.forEach((item, lookup) => {
    if (!isQualifierCompatible(item.name)) {
      return;
    }
    candidates.forEach((candidate) => {
      if (candidate.length < 4 || lookup.length < 4) {
        return;
      }
      if (Math.abs(candidate.length - lookup.length) > 4) {
        return;
      }
      const dist = levenshteinDistance(candidate, lookup);
      const maxLen = Math.max(candidate.length, lookup.length);
      const ratio = 1 - dist / maxLen;
      const threshold = maxLen >= 8 ? 0.62 : 0.68;
      if (ratio < threshold) {
        return;
      }
      fuzzy.push({ item, ratio, maxLen });
    });
  });
  if (fuzzy.length === 0) {
    return undefined;
  }
  fuzzy.sort((left, right) => {
    if (right.ratio !== left.ratio) {
      return right.ratio - left.ratio;
    }
    if (right.maxLen !== left.maxLen) {
      return right.maxLen - left.maxLen;
    }
    return left.item.name.localeCompare(right.item.name, "zh-CN");
  });
  const best = fuzzy[0];
  const second = fuzzy[1];
  if (best.ratio >= 0.9) {
    return best.item;
  }
  if (!second || best.ratio - second.ratio >= 0.08) {
    return best.item;
  }
  return undefined;
}

function resolveUniqueItemByIcon(items: WorkshopItem[], icon: string | undefined): WorkshopItem | undefined {
  if (!icon) {
    return undefined;
  }
  let matched: WorkshopItem | undefined;
  for (const item of items) {
    if (item.icon !== icon) {
      continue;
    }
    if (matched) {
      return undefined;
    }
    matched = item;
  }
  return matched;
}

function isAmbiguousExactOcrNameMatch(item: WorkshopItem, ocrName: string, items: WorkshopItem[]): boolean {
  const ocrKey = normalizeLookupName(sanitizeOcrLineItemName(ocrName));
  if (!ocrKey) {
    return false;
  }
  const itemKey = normalizeLookupName(item.name);
  if (!itemKey || itemKey !== ocrKey) {
    return false;
  }
  return items.some((other) => {
    if (other.id === item.id) {
      return false;
    }
    const otherKey = normalizeLookupName(other.name);
    return otherKey.length > ocrKey.length && otherKey.includes(ocrKey);
  });
}

function isExactOcrNameMatch(item: WorkshopItem, ocrName: string): boolean {
  const ocrKey = normalizeLookupName(sanitizeOcrLineItemName(ocrName));
  const itemKey = normalizeLookupName(item.name);
  return Boolean(ocrKey) && ocrKey === itemKey;
}

function inferItemIcon(name: string, category: WorkshopItemCategory): string | undefined {
  if (category === "equipment") {
    return "icon-equipment";
  }
  if (category === "component") {
    return "icon-component";
  }
  const normalized = name.trim();
  if (!normalized) {
    return undefined;
  }
  if (normalized.includes("矿") || normalized.includes("礦") || normalized.includes("结晶") || normalized.includes("結晶") || normalized.includes("石")) {
    return "icon-material-ore";
  }
  if (normalized.includes("粉") || normalized.includes("碎片") || normalized.includes("核心")) {
    return "icon-material-fragment";
  }
  return category === "material" ? "icon-material" : "icon-other";
}

export function normalizeIconCache(raw: unknown): Map<string, string> {
  const map = new Map<string, string>();
  if (!raw || typeof raw !== "object") {
    return map;
  }
  Object.entries(raw as Record<string, unknown>).forEach(([rawKey, rawIcon]) => {
    const key = normalizeLookupName(rawKey);
    const icon = sanitizeIconToken(rawIcon);
    if (!key || !icon) {
      return;
    }
    map.set(key, icon);
  });
  return map;
}

function serializeIconCache(iconCache: Map<string, string>): Record<string, string> {
  const pairs = Array.from(iconCache.entries()).sort((left, right) => left[0].localeCompare(right[0]));
  return Object.fromEntries(pairs);
}

function cacheIconByName(iconCache: Map<string, string>, name: string, icon: string | undefined): void {
  if (!icon) {
    return;
  }
  const key = normalizeLookupName(name);
  if (!key) {
    return;
  }
  iconCache.set(key, icon);
}

function extractItemAliasesFromNotes(notes?: string): string[] {
  if (!notes) {
    return [];
  }
  const match = notes.match(/別名:\s*([^;]+)/u);
  if (!match?.[1]) {
    return [];
  }
  return match[1]
    .split(/[、,，/]/u)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function resolveItemIconWithCache(
  iconCache: Map<string, string>,
  name: string,
  category: WorkshopItemCategory,
  preferredIcon?: string,
): string | undefined {
  const explicitIcon = sanitizeIconToken(preferredIcon);
  if (explicitIcon) {
    cacheIconByName(iconCache, name, explicitIcon);
    return explicitIcon;
  }
  const lookup = normalizeLookupName(name);
  if (lookup) {
    const cached = iconCache.get(lookup);
    if (cached) {
      return cached;
    }
  }
  const inferred = inferItemIcon(name, category);
  cacheIconByName(iconCache, name, inferred);
  return inferred;
}

export function toPositiveInt(raw: unknown, fallback: number): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return fallback;
  }
  return Math.max(1, Math.floor(raw));
}

export function toNonNegativeInt(raw: unknown, fallback: number): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return fallback;
  }
  return Math.max(0, Math.floor(raw));
}

export function normalizeRecipeInputs(raw: unknown): WorkshopRecipeInput[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const dedup = new Map<string, number>();
  raw.forEach((entry) => {
    if (!entry || typeof entry !== "object") {
      return;
    }
    const itemId = typeof (entry as { itemId?: unknown }).itemId === "string" ? (entry as { itemId: string }).itemId : "";
    const quantity = toPositiveInt((entry as { quantity?: unknown }).quantity, 0);
    if (!itemId || quantity <= 0) {
      return;
    }
    dedup.set(itemId, (dedup.get(itemId) ?? 0) + quantity);
  });

  return Array.from(dedup.entries())
    .map(([itemId, quantity]) => ({ itemId, quantity }))
    .sort((left, right) => left.itemId.localeCompare(right.itemId));
}

function normalizeItem(raw: unknown, index: number): WorkshopItem {
  const nowIso = new Date().toISOString();
  const id = typeof (raw as { id?: unknown })?.id === "string" ? ((raw as { id: string }).id ?? randomUUID()) : randomUUID();
  const nameFallback = `物品-${index + 1}`;
  const name = sanitizeName((raw as { name?: unknown })?.name, nameFallback) || nameFallback;
  const createdAt = asIso((raw as { createdAt?: unknown })?.createdAt, nowIso);
  const updatedAt = asIso((raw as { updatedAt?: unknown })?.updatedAt, nowIso);
  const icon = sanitizeIconToken((raw as { icon?: unknown })?.icon);
  const notes = sanitizeName((raw as { notes?: unknown })?.notes) || undefined;

  return {
    id,
    name,
    category: sanitizeCategory((raw as { category?: unknown })?.category),
    icon,
    notes,
    createdAt,
    updatedAt,
  };
}

function normalizeRecipe(raw: unknown): WorkshopRecipe | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const id = typeof (raw as { id?: unknown }).id === "string" ? (raw as { id: string }).id : randomUUID();
  const outputItemId =
    typeof (raw as { outputItemId?: unknown }).outputItemId === "string" ? (raw as { outputItemId: string }).outputItemId : "";
  if (!outputItemId) {
    return null;
  }

  const outputQuantity = toPositiveInt((raw as { outputQuantity?: unknown }).outputQuantity, 1);
  const inputs = normalizeRecipeInputs((raw as { inputs?: unknown }).inputs);
  if (inputs.length === 0) {
    return null;
  }

  const updatedAt = asIso((raw as { updatedAt?: unknown }).updatedAt, new Date().toISOString());
  return {
    id,
    outputItemId,
    outputQuantity,
    inputs,
    updatedAt,
  };
}

function normalizePriceSnapshot(raw: unknown): WorkshopPriceSnapshot | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const id = typeof (raw as { id?: unknown }).id === "string" ? (raw as { id: string }).id : randomUUID();
  const itemId = typeof (raw as { itemId?: unknown }).itemId === "string" ? (raw as { itemId: string }).itemId : "";
  if (!itemId) {
    return null;
  }

  const unitPrice = toNonNegativeInt((raw as { unitPrice?: unknown }).unitPrice, -1);
  if (unitPrice <= 0) {
    return null;
  }

  const sourceRaw = (raw as { source?: unknown }).source;
  const source = sourceRaw === "import" ? "import" : "manual";
  const market = sanitizePriceMarket((raw as { market?: unknown }).market);
  const capturedAt = asIso((raw as { capturedAt?: unknown }).capturedAt, new Date().toISOString());
  const note = sanitizeName((raw as { note?: unknown }).note) || undefined;

  return {
    id,
    itemId,
    unitPrice,
    capturedAt,
    source,
    market,
    note,
  };
}

function normalizeInventoryItem(raw: unknown): WorkshopInventoryItem | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const itemId = typeof (raw as { itemId?: unknown }).itemId === "string" ? (raw as { itemId: string }).itemId : "";
  if (!itemId) {
    return null;
  }
  const quantity = toNonNegativeInt((raw as { quantity?: unknown }).quantity, -1);
  if (quantity < 0) {
    return null;
  }
  const updatedAt = asIso((raw as { updatedAt?: unknown }).updatedAt, new Date().toISOString());
  return {
    itemId,
    quantity,
    updatedAt,
  };
}

function normalizeWorkshopState(raw: unknown): WorkshopState {
  const entity = raw as Record<string, unknown> | undefined;
  const version = typeof entity?.version === "number" ? Math.floor(entity.version) : 0;
  const signalRule = normalizeSignalRule(entity?.signalRule);
  const iconCache = normalizeIconCache(entity?.[WORKSHOP_ICON_CACHE_KEY]);
  const itemsRaw = Array.isArray(entity?.items) ? entity?.items : [];
  const itemMap = new Map<string, WorkshopItem>();
  itemsRaw.forEach((entry, index) => {
    const item = normalizeItem(entry, index);
    itemMap.set(item.id, item);
  });

  const items = Array.from(itemMap.values()).map((item) => {
    const icon = resolveItemIconWithCache(iconCache, item.name, item.category, item.icon);
    const aliases = extractItemAliasesFromNotes(item.notes);
    aliases.forEach((alias) => cacheIconByName(iconCache, alias, icon));
    return icon === item.icon ? item : { ...item, icon };
  });
  const validItemIds = new Set(items.map((item) => item.id));

  const recipesRaw = Array.isArray(entity?.recipes) ? entity?.recipes : [];
  const recipeMap = new Map<string, WorkshopRecipe>();
  recipesRaw.forEach((entry) => {
    const recipe = normalizeRecipe(entry);
    if (!recipe) {
      return;
    }
    if (!validItemIds.has(recipe.outputItemId)) {
      return;
    }
    if (recipe.inputs.some((input) => !validItemIds.has(input.itemId))) {
      return;
    }
    recipeMap.set(recipe.id, recipe);
  });
  const recipes = Array.from(recipeMap.values());

  const pricesRaw = Array.isArray(entity?.prices) ? entity?.prices : [];
  const prices = pricesRaw
    .map((entry) => normalizePriceSnapshot(entry))
    .filter((entry): entry is WorkshopPriceSnapshot => entry !== null)
    .filter((entry) => validItemIds.has(entry.itemId))
    .slice(-WORKSHOP_PRICE_HISTORY_LIMIT);

  const inventoryRaw = Array.isArray(entity?.inventory) ? entity?.inventory : [];
  const inventoryMap = new Map<string, WorkshopInventoryItem>();
  inventoryRaw.forEach((entry) => {
    const row = normalizeInventoryItem(entry);
    if (!row || !validItemIds.has(row.itemId)) {
      return;
    }
    inventoryMap.set(row.itemId, row);
  });

  return {
    version: version > 0 ? WORKSHOP_STATE_VERSION : WORKSHOP_STATE_VERSION,
    items,
    recipes,
    prices,
    inventory: Array.from(inventoryMap.values()).sort((left, right) => left.itemId.localeCompare(right.itemId)),
    signalRule,
  };
}

function removeKnownInvalidItems(state: WorkshopState): WorkshopState {
  const invalidItemIds = new Set(
    state.items.filter((item) => WORKSHOP_KNOWN_INVALID_ITEM_NAMES.has(item.name.trim())).map((item) => item.id),
  );
  if (invalidItemIds.size === 0) {
    return state;
  }
  return {
    ...state,
    items: state.items.filter((item) => !invalidItemIds.has(item.id)),
    recipes: state.recipes.filter(
      (recipe) => !invalidItemIds.has(recipe.outputItemId) && !recipe.inputs.some((input) => invalidItemIds.has(input.itemId)),
    ),
    prices: state.prices.filter((row) => !invalidItemIds.has(row.itemId)),
    inventory: state.inventory.filter((row) => !invalidItemIds.has(row.itemId)),
  };
}

function buildWorkshopStateSignature(state: WorkshopState): string {
  return JSON.stringify({
    version: state.version,
    items: state.items,
    recipes: state.recipes,
    prices: state.prices,
    inventory: state.inventory,
    signalRule: state.signalRule,
  });
}

export function writeWorkshopState(next: WorkshopState): WorkshopState {
  const currentState = normalizeWorkshopState(workshopStore.store);
  const currentIconCache = serializeIconCache(normalizeIconCache(workshopStore.get(WORKSHOP_ICON_CACHE_KEY)));
  const iconCache = normalizeIconCache(workshopStore.get(WORKSHOP_ICON_CACHE_KEY));
  const normalizedItems = next.items.map((item) => {
    const icon = resolveItemIconWithCache(iconCache, item.name, item.category, item.icon);
    const aliases = extractItemAliasesFromNotes(item.notes);
    aliases.forEach((alias) => cacheIconByName(iconCache, alias, icon));
    return icon === item.icon ? item : { ...item, icon };
  });
  const candidateState: WorkshopState = {
    version: next.version,
    items: normalizedItems,
    recipes: next.recipes,
    prices: next.prices.slice(-WORKSHOP_PRICE_HISTORY_LIMIT),
    inventory: [...next.inventory].sort((left, right) => left.itemId.localeCompare(right.itemId)),
    signalRule: normalizeSignalRule(next.signalRule),
  };
  const candidateIconCache = serializeIconCache(iconCache);

  const stateChanged = buildWorkshopStateSignature(currentState) !== buildWorkshopStateSignature(candidateState);
  const iconCacheChanged = JSON.stringify(currentIconCache) !== JSON.stringify(candidateIconCache);
  if (!stateChanged && !iconCacheChanged) {
    return currentState;
  }

  workshopStore.set("version", candidateState.version);
  workshopStore.set("items", candidateState.items);
  workshopStore.set("recipes", candidateState.recipes);
  workshopStore.set("prices", candidateState.prices);
  workshopStore.set("inventory", candidateState.inventory);
  workshopStore.set("signalRule", candidateState.signalRule);
  workshopStore.set(WORKSHOP_ICON_CACHE_KEY, candidateIconCache);
  return normalizeWorkshopState(workshopStore.store);
}

export function readWorkshopState(): WorkshopState {
  const rawVersion = workshopStore.get("version");
  const storedBuiltinCatalogSignature = workshopStore.get("builtinCatalogSignature");
  const normalized = normalizeWorkshopState(workshopStore.store);
  const cleaned = removeKnownInvalidItems(normalized);
  const currentState = cleaned === normalized ? normalized : writeWorkshopState(cleaned);
  const version = typeof rawVersion === "number" ? Math.floor(rawVersion) : 0;
  const currentBuiltinCatalogSignature = getBuiltinCatalogSignature();
  const shouldRebuildForCatalogChange =
    typeof storedBuiltinCatalogSignature !== "string" || storedBuiltinCatalogSignature !== currentBuiltinCatalogSignature;
  const shouldRebuildFromBuiltin =
    version !== WORKSHOP_STATE_VERSION ||
    currentState.items.length === 0 ||
    currentState.recipes.length === 0 ||
    shouldRebuildForCatalogChange;
  if (!shouldRebuildFromBuiltin) {
    return currentState;
  }
  const rebuilt = rebuildStateWithBuiltinCatalog(currentState, {
    stateVersion: WORKSHOP_STATE_VERSION,
    priceHistoryLimit: WORKSHOP_PRICE_HISTORY_LIMIT,
    defaultSignalRule: DEFAULT_WORKSHOP_SIGNAL_RULE,
    normalizeState: normalizeWorkshopState,
    applyDeps: {
      stateVersion: WORKSHOP_STATE_VERSION,
      loadIconCache: () => normalizeIconCache(workshopStore.get(WORKSHOP_ICON_CACHE_KEY)),
      resolveItemIconWithCache,
      cacheIconByName,
      normalizeState: normalizeWorkshopState,
    },
  });
  const persisted = writeWorkshopState(rebuilt);
  workshopStore.set("builtinCatalogSignature", currentBuiltinCatalogSignature);
  return persisted;
}

export function ensureItemExists(state: WorkshopState, itemId: string): void {
  if (!state.items.some((item) => item.id === itemId)) {
    throw new Error("物品不存在，请先创建物品。");
  }
}

export function sanitizeLookbackDays(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return WORKSHOP_HISTORY_DEFAULT_DAYS;
  }
  return clamp(Math.floor(raw), 1, WORKSHOP_HISTORY_MAX_DAYS);
}

export function sanitizeSignalThresholdRatio(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return WORKSHOP_SIGNAL_THRESHOLD_DEFAULT;
  }
  return clamp(raw, WORKSHOP_SIGNAL_THRESHOLD_MIN, WORKSHOP_SIGNAL_THRESHOLD_MAX);
}

function normalizeSignalRule(raw: unknown): WorkshopPriceSignalRule {
  const entity = raw as Record<string, unknown> | undefined;
  const enabled = typeof entity?.enabled === "boolean" ? entity.enabled : DEFAULT_WORKSHOP_SIGNAL_RULE.enabled;
  return {
    enabled,
    lookbackDays: sanitizeLookbackDays(entity?.lookbackDays),
    dropBelowWeekdayAverageRatio: sanitizeSignalThresholdRatio(entity?.dropBelowWeekdayAverageRatio),
  };
}

function normalizeOcrText(raw: string): string {
  return raw
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

interface PaddleCommandAttempt {
  command: string;
  args: string[];
  label: string;
}

interface PaddleWorkerPendingRequest {
  resolve: (value: PaddleOcrOutcome) => void;
  reject: (reason: Error) => void;
  timeoutId: NodeJS.Timeout;
}

interface OnnxOcrEngine {
  detect: (imagePath: string, options?: unknown) => Promise<OnnxOcrLine[]>;
  destroy?: () => void | Promise<void>;
}

let paddleWorkerProcess: ChildProcessWithoutNullStreams | null = null;
let paddleWorkerStartPromise: Promise<void> | null = null;
let paddleWorkerStdoutBuffer = "";
let paddleWorkerStderrBuffer = "";
const paddleWorkerPendingRequests = new Map<string, PaddleWorkerPendingRequest>();
let onnxOcrEngine: OnnxOcrEngine | null = null;
let onnxOcrEnginePromise: Promise<OnnxOcrEngine> | null = null;

function ensurePaddleRuntimeDirectories(): void {
  try {
    fs.mkdirSync(OCR_PADDLE_RUNTIME_ROOT, { recursive: true });
    fs.mkdirSync(OCR_PADDLE_RUNTIME_USER, { recursive: true });
    fs.mkdirSync(OCR_PADDLE_RUNTIME_CACHE, { recursive: true });
    fs.mkdirSync(OCR_PADDLE_RUNTIME_HOME, { recursive: true });
  } catch {
    // best effort; if mkdir fails, spawn will still try with current env
  }
}

function createPaddleEnv(safeMode: boolean): NodeJS.ProcessEnv {
  return {
    ...process.env,
    HOME: OCR_PADDLE_RUNTIME_USER,
    USERPROFILE: OCR_PADDLE_RUNTIME_USER,
    XDG_CACHE_HOME: OCR_PADDLE_RUNTIME_CACHE,
    PADDLE_HOME: OCR_PADDLE_RUNTIME_HOME,
    PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK: "True",
    FLAGS_enable_pir_api: "0",
    FLAGS_enable_pir_in_executor: "0",
    FLAGS_use_mkldnn: "0",
    FLAGS_prim_all: "0",
    PYTHONUTF8: "1",
    PYTHONIOENCODING: "utf-8",
    AION2_OCR_SAFE_MODE: safeMode ? "1" : "0",
  };
}

function buildPaddleCommandAttempts(
  script: string,
  scriptArgs: string[],
  unbuffered = false,
): PaddleCommandAttempt[] {
  const bufferArg = unbuffered ? ["-u"] : [];
  return [
    { command: "py", args: ["-3.11", ...bufferArg, "-c", script, ...scriptArgs], label: "py-3.11" },
    { command: "py", args: ["-3", ...bufferArg, "-c", script, ...scriptArgs], label: "py-3" },
    { command: "python", args: [...bufferArg, "-c", script, ...scriptArgs], label: "python" },
  ];
}

function trimBuffer(input: string): string {
  if (input.length <= OCR_PADDLE_MAX_BUFFER) {
    return input;
  }
  return input.slice(input.length - OCR_PADDLE_MAX_BUFFER);
}

function resetPaddleWorkerState(reason: string): void {
  const worker = paddleWorkerProcess;
  paddleWorkerProcess = null;
  paddleWorkerStartPromise = null;
  paddleWorkerStdoutBuffer = "";
  paddleWorkerStderrBuffer = "";
  const error = new Error(`OCR 常驻进程不可用：${reason}`);
  paddleWorkerPendingRequests.forEach((pending) => {
    clearTimeout(pending.timeoutId);
    pending.reject(error);
  });
  paddleWorkerPendingRequests.clear();
  if (worker && !worker.killed) {
    try {
      worker.kill();
    } catch {
      // ignore worker termination failure
    }
  }
}

function processPaddleWorkerStdoutLine(rawLine: string): void {
  const line = rawLine.trim();
  if (!line) {
    return;
  }
  let parsed: PaddleOcrPayload | null = null;
  try {
    parsed = JSON.parse(line) as PaddleOcrPayload;
  } catch {
    return;
  }
  if (!parsed || parsed.ready === true) {
    return;
  }
  const requestId = typeof parsed.id === "string" ? parsed.id : "";
  if (!requestId) {
    return;
  }
  const pending = paddleWorkerPendingRequests.get(requestId);
  if (!pending) {
    return;
  }
  paddleWorkerPendingRequests.delete(requestId);
  clearTimeout(pending.timeoutId);
  pending.resolve(parsePaddlePayloadObject(parsed, OCR_PADDLE_CONFIDENCE_SCALE));
}

function attachPaddleWorkerListeners(worker: ChildProcessWithoutNullStreams): void {
  worker.stdout.setEncoding("utf8");
  worker.stderr.setEncoding("utf8");
  worker.stdout.on("data", (chunk: string) => {
    paddleWorkerStdoutBuffer = trimBuffer(paddleWorkerStdoutBuffer + chunk);
    let lineBreakIndex = paddleWorkerStdoutBuffer.indexOf("\n");
    while (lineBreakIndex >= 0) {
      const line = paddleWorkerStdoutBuffer.slice(0, lineBreakIndex).replace(/\r$/u, "");
      paddleWorkerStdoutBuffer = paddleWorkerStdoutBuffer.slice(lineBreakIndex + 1);
      processPaddleWorkerStdoutLine(line);
      lineBreakIndex = paddleWorkerStdoutBuffer.indexOf("\n");
    }
  });
  worker.stderr.on("data", (chunk: string) => {
    paddleWorkerStderrBuffer = trimBuffer(paddleWorkerStderrBuffer + chunk);
  });
  worker.on("error", (err) => {
    if (paddleWorkerProcess !== worker) {
      return;
    }
    resetPaddleWorkerState(err.message || "进程异常");
  });
  worker.on("close", (code) => {
    if (paddleWorkerProcess !== worker) {
      return;
    }
    const stderrTail = paddleWorkerStderrBuffer.trim();
    const detail = stderrTail ? `退出码 ${code ?? -1} / ${stderrTail}` : `退出码 ${code ?? -1}`;
    resetPaddleWorkerState(detail);
  });
}

async function startPaddleWorker(): Promise<void> {
  if (paddleWorkerProcess && !paddleWorkerProcess.killed) {
    return;
  }
  if (paddleWorkerStartPromise) {
    return paddleWorkerStartPromise;
  }
  paddleWorkerStartPromise = (async () => {
    ensurePaddleRuntimeDirectories();
    const attempts = buildPaddleCommandAttempts(PADDLE_OCR_PYTHON_WORKER_SCRIPT, [], true);
    const errors: string[] = [];
    for (const attempt of attempts) {
      try {
        const worker = await new Promise<ChildProcessWithoutNullStreams>((resolve, reject) => {
          let settled = false;
          const child = spawn(attempt.command, attempt.args, {
            windowsHide: true,
            env: createPaddleEnv(true),
            shell: false,
          });
          const finishResolve = (): void => {
            if (settled) {
              return;
            }
            settled = true;
            resolve(child);
          };
          const finishReject = (message: string): void => {
            if (settled) {
              return;
            }
            settled = true;
            reject(new Error(message));
          };
          child.once("spawn", finishResolve);
          child.once("error", (err) => finishReject(err.message || "启动失败"));
          child.once("close", (code) => finishReject(`启动后立即退出: ${code ?? -1}`));
        });
        paddleWorkerProcess = worker;
        paddleWorkerStdoutBuffer = "";
        paddleWorkerStderrBuffer = "";
        attachPaddleWorkerListeners(worker);
        return;
      } catch (err) {
        const message = err instanceof Error ? err.message : "启动失败";
        errors.push(`${attempt.label}: ${message}`);
      }
    }
    throw new Error(errors.join(" | ") || "无法启动 OCR 常驻进程。");
  })();
  try {
    await paddleWorkerStartPromise;
  } finally {
    paddleWorkerStartPromise = null;
  }
}

async function runPaddleWithWorker(imagePath: string, candidates: string[], safeMode: boolean): Promise<PaddleOcrOutcome> {
  await startPaddleWorker();
  const worker = paddleWorkerProcess;
  if (!worker || worker.killed || worker.stdin.destroyed) {
    throw new Error("OCR 常驻进程未就绪。");
  }
  const requestId = randomUUID();
  return new Promise<PaddleOcrOutcome>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      if (paddleWorkerPendingRequests.delete(requestId)) {
        resetPaddleWorkerState("请求超时");
        reject(new Error(`OCR 常驻请求超时（>${OCR_PADDLE_REQUEST_TIMEOUT_MS}ms）`));
      }
    }, OCR_PADDLE_REQUEST_TIMEOUT_MS);
    paddleWorkerPendingRequests.set(requestId, { resolve, reject, timeoutId });
    try {
      worker.stdin.write(
        `${JSON.stringify({ id: requestId, image_path: imagePath, languages: candidates, safe_mode: safeMode })}\n`,
        "utf8",
      );
    } catch (err) {
      clearTimeout(timeoutId);
      paddleWorkerPendingRequests.delete(requestId);
      const message = err instanceof Error ? err.message : "发送请求失败";
      reject(new Error(message));
    }
  });
}

async function runPaddleWithCommand(
  command: string,
  args: string[],
  safeMode: boolean,
): Promise<{ stdout: string; stderr: string; ok: boolean; errorMessage?: string }> {
  ensurePaddleRuntimeDirectories();
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      windowsHide: true,
      env: createPaddleEnv(safeMode),
      shell: false,
    });
    let stdout = "";
    let stderr = "";
    let resolved = false;
    const finish = (value: { stdout: string; stderr: string; ok: boolean; errorMessage?: string }): void => {
      if (resolved) {
        return;
      }
      resolved = true;
      resolve(value);
    };
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
      if (stdout.length + stderr.length > OCR_PADDLE_MAX_BUFFER) {
        child.kill();
        finish({
          stdout,
          stderr,
          ok: false,
          errorMessage: "OCR 输出过大，已中断。",
        });
      }
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
      if (stdout.length + stderr.length > OCR_PADDLE_MAX_BUFFER) {
        child.kill();
        finish({
          stdout,
          stderr,
          ok: false,
          errorMessage: "OCR 输出过大，已中断。",
        });
      }
    });
    child.on("error", (err) => {
      finish({
        stdout,
        stderr,
        ok: false,
        errorMessage: err.message,
      });
    });
    child.on("close", (code) => {
      if (code !== 0 && !stdout.trim()) {
        finish({
          stdout,
          stderr,
          ok: false,
          errorMessage: stderr.trim() || `进程退出码 ${code ?? -1}`,
        });
        return;
      }
      finish({
        stdout,
        stderr,
        ok: true,
      });
    });
  });
}

async function ensureOnnxOcrEngine(_safeMode = true): Promise<OnnxOcrEngine> {
  if (onnxOcrEngine) {
    return onnxOcrEngine;
  }
  if (onnxOcrEnginePromise) {
    return onnxOcrEnginePromise;
  }
  onnxOcrEnginePromise = (async () => {
    const created = (await OcrNode.create({
      onnxOptions: {
        executionMode: "sequential",
        graphOptimizationLevel: "all",
      },
    })) as OnnxOcrEngine;
    onnxOcrEngine = created;
    return created;
  })();
  try {
    return await onnxOcrEnginePromise;
  } finally {
    onnxOcrEnginePromise = null;
  }
}

async function runOnnxExtract(imagePath: string, language: string, safeMode = true): Promise<PaddleOcrOutcome> {
  try {
    const engine = await ensureOnnxOcrEngine(safeMode);
    const lines = await engine.detect(imagePath);
    return buildOnnxOcrOutcome(lines, language, OCR_PADDLE_CONFIDENCE_SCALE);
  } catch (err) {
    const message = err instanceof Error ? err.message : "ONNX 引擎异常";
    return {
      ok: false,
      language,
      rawText: "",
      words: [],
      errorMessage: `ONNX OCR 执行失败：${message}`,
    };
  }
}

async function runPaddleExtract(imagePath: string, language: string, safeMode = true): Promise<PaddleOcrOutcome> {
  const onnxResult = await runOnnxExtract(imagePath, language, safeMode);
  if (onnxResult.ok) {
    return onnxResult;
  }

  if (!OCR_ENABLE_PYTHON_FALLBACK) {
    return onnxResult;
  }

  const candidates = buildPaddleLanguageCandidates(language);
  const langArg = candidates.join(",");
  const attemptErrors: string[] = [onnxResult.errorMessage ?? "ONNX OCR 失败"];

  const isInterpreterNotAvailable = (message: string): boolean => {
    const normalized = message.toLocaleLowerCase();
    return normalized.includes("no suitable python runtime found") || normalized.includes("not recognized");
  };

  const isImportFailure = (message: string): boolean => {
    return message.toLocaleLowerCase().includes("import paddleocr failed");
  };

  try {
    const fromWorker = await runPaddleWithWorker(imagePath, candidates, safeMode);
    if (fromWorker.ok) {
      return fromWorker;
    }
    const payloadError = fromWorker.errorMessage ?? "输出无效";
    attemptErrors.push(`worker: ${payloadError}`);
    if (!isImportFailure(payloadError) && !isInterpreterNotAvailable(payloadError)) {
      return {
        ...fromWorker,
        errorMessage: `worker: ${payloadError}`,
      };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "worker 失败";
    attemptErrors.push(`worker: ${message}`);
  }

  const attempts = buildPaddleCommandAttempts(PADDLE_OCR_PYTHON_SCRIPT, [imagePath, langArg]);
  for (const attempt of attempts) {
    const result = await runPaddleWithCommand(attempt.command, attempt.args, safeMode);
    if (!result.ok) {
      const detail = (result.errorMessage ?? result.stderr.trim()) || "执行失败";
      attemptErrors.push(`${attempt.label}: ${detail}`);
      if (!isInterpreterNotAvailable(detail)) {
        break;
      }
      continue;
    }
    const payload = parsePaddlePayload(result.stdout, OCR_PADDLE_CONFIDENCE_SCALE);
    if (payload.ok) {
      return payload;
    }
    const payloadError = payload.errorMessage ?? "输出无效";
    attemptErrors.push(`${attempt.label}: ${payloadError}`);
    if (!isImportFailure(payloadError) && !isInterpreterNotAvailable(payloadError)) {
      return {
        ...payload,
        errorMessage: `${attempt.label}: ${payloadError}`,
      };
    }
  }

  return {
    ok: false,
    language: "",
    rawText: "",
    words: [],
    errorMessage: attemptErrors.join(" | ") || "ONNX OCR 调用失败。",
  };
}

export function cleanupWorkshopOcrEngineCore(): void {
  if (onnxOcrEngine && typeof onnxOcrEngine.destroy === "function") {
    try {
      const maybePromise = onnxOcrEngine.destroy();
      if (maybePromise && typeof (maybePromise as Promise<void>).then === "function") {
        void (maybePromise as Promise<void>).catch(() => {
          // ignore onnx cleanup error
        });
      }
    } catch {
      // ignore onnx cleanup error
    }
  }
  onnxOcrEngine = null;
  onnxOcrEnginePromise = null;
  if (paddleWorkerProcess || paddleWorkerPendingRequests.size > 0) {
    resetPaddleWorkerState("应用退出");
  }
}

function stringifyOcrWords(words: OcrTsvWord[]): string {
  return words
    .map((word) => `${word.left},${word.top},${word.width},${word.height},${word.confidence.toFixed(2)}\t${word.text}`)
    .join("\n");
}

function formatPaddleOcrError(raw: string | undefined): string {
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

function cropImageToTempFile(imagePath: string, rect: WorkshopRect, scale = 1): string {
  const image = nativeImage.createFromPath(imagePath);
  if (image.isEmpty()) {
    throw new Error(`截图无法读取: ${path.basename(imagePath)}`);
  }
  const size = image.getSize();
  if (
    rect.x < 0 ||
    rect.y < 0 ||
    rect.width <= 0 ||
    rect.height <= 0 ||
    rect.x + rect.width > size.width ||
    rect.y + rect.height > size.height
  ) {
    throw new Error(`ROI 越界: (${rect.x},${rect.y},${rect.width},${rect.height})，截图尺寸 ${size.width}x${size.height}`);
  }
  const cropped = image.crop({
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
  });
  const resized =
    scale > 1
      ? cropped.resize({
          width: Math.max(1, Math.floor(rect.width * scale)),
          height: Math.max(1, Math.floor(rect.height * scale)),
          quality: "best",
        })
      : cropped;
  const filePath = path.join(os.tmpdir(), `aion2-ocr-roi-${Date.now()}-${randomUUID()}.png`);
  fs.writeFileSync(filePath, resized.toPNG());
  return filePath;
}

function cleanupTempFile(filePath: string | null): void {
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

async function resolveDualPriceRolesByHeader(
  imagePath: string,
  pricesRect: WorkshopRect,
  language: string,
  safeMode: boolean,
  fallbackLeftRole: "server" | "world",
  fallbackRightRole: "server" | "world",
  warnings: string[],
): Promise<{ leftRole: "server" | "world"; rightRole: "server" | "world" }> {
  const headerHeight = clamp(Math.floor(pricesRect.height * 0.16), 40, 180);
  const leftWidth = Math.max(1, Math.floor(pricesRect.width / 2));
  const rightWidth = Math.max(1, pricesRect.width - leftWidth);
  const leftRect: WorkshopRect = {
    x: pricesRect.x,
    y: pricesRect.y,
    width: leftWidth,
    height: headerHeight,
  };
  const rightRect: WorkshopRect = {
    x: pricesRect.x + leftWidth,
    y: pricesRect.y,
    width: rightWidth,
    height: headerHeight,
  };
  const headerLanguage = buildPaddleLanguageCandidates(language).join("+");

  const readHeaderText = async (rect: WorkshopRect, label: "左列" | "右列"): Promise<string> => {
    let tempPath: string | null = null;
    try {
      tempPath = cropImageToTempFile(imagePath, rect, 2);
      const extract = await runPaddleExtract(tempPath, headerLanguage, safeMode);
      if (!extract.ok) {
        warnings.push(`${label}表头识别失败：${extract.errorMessage ?? "未知错误"}`);
        return "";
      }
      return extract.rawText;
    } catch (err) {
      warnings.push(`${label}表头识别失败：${err instanceof Error ? err.message : "未知异常"}`);
      return "";
    } finally {
      cleanupTempFile(tempPath);
    }
  };

  const [leftHeaderText, rightHeaderText] = await Promise.all([
    readHeaderText(leftRect, "左列"),
    readHeaderText(rightRect, "右列"),
  ]);
  const leftDetected = detectTradePriceRoleByHeaderText(leftHeaderText);
  const rightDetected = detectTradePriceRoleByHeaderText(rightHeaderText);

  if (leftDetected && rightDetected && leftDetected !== rightDetected) {
    return {
      leftRole: leftDetected,
      rightRole: rightDetected,
    };
  }
  if (leftDetected && !rightDetected) {
    return {
      leftRole: leftDetected,
      rightRole: leftDetected === "server" ? "world" : "server",
    };
  }
  if (!leftDetected && rightDetected) {
    return {
      leftRole: rightDetected === "server" ? "world" : "server",
      rightRole: rightDetected,
    };
  }
  warnings.push("价格表头自动识别失败，已回退到手动列角色预设。");
  return {
    leftRole: fallbackLeftRole,
    rightRole: fallbackRightRole,
  };
}

interface PriceRowsOcrOutcome {
  values: Array<number | null>;
  rawText: string;
  tsvText: string;
  engine: string;
}

interface DualPriceRowsOcrOutcome {
  leftValues: Array<number | null>;
  rightValues: Array<number | null>;
  rawText: string;
  tsvText: string;
  engine: string;
}

async function extractPriceRowsForRect(
  imagePath: string,
  rect: WorkshopRect,
  rowCount: number,
  scale: number,
  safeMode: boolean,
  column: "left" | "right",
  warnings: string[],
  warningPrefix: string,
): Promise<PriceRowsOcrOutcome> {
  const tempPath = cropImageToTempFile(imagePath, rect, scale);
  try {
    const extract = await runPaddleExtract(tempPath, "en", safeMode);
    if (!extract.ok) {
      throw new Error(`${warningPrefix}OCR 失败：${extract.errorMessage ?? "未知错误"}`);
    }
    const rowsFromWordsWarnings: string[] = [];
    const rowsFromWords = buildPriceRowsFromWords(extract.words, rowCount, column, rowsFromWordsWarnings, {
      clamp,
      numericConfidenceMin: OCR_TSV_NUMERIC_CONFIDENCE_MIN,
    });
    const fallbackWarnings: string[] = [];
    const fallbackRows = parseNonEmptyLines(extract.rawText)
      .slice(0, rowCount)
      .map((line, index) => {
        const parsed = parsePriceFromLine(line, column);
        if (parsed === null) {
          fallbackWarnings.push(`${warningPrefix}第 ${index + 1} 行价格解析失败：${line}`);
          return null;
        }
        return parsed;
      });
    const wordsValid = rowsFromWords.filter((entry): entry is number => entry !== null).length;
    const fallbackValid = fallbackRows.filter((entry): entry is number => entry !== null).length;
    const values = wordsValid >= fallbackValid ? rowsFromWords : fallbackRows;
    if (wordsValid < fallbackValid) {
      warnings.push(`${warningPrefix}词框结果不足，已回退到普通文本行解析。`);
      warnings.push(...fallbackWarnings);
    } else {
      warnings.push(...rowsFromWordsWarnings);
    }
    return {
      values,
      rawText: extract.rawText,
      tsvText: stringifyOcrWords(extract.words),
      engine: `onnx-ocr(${extract.language || "auto"})`,
    };
  } finally {
    cleanupTempFile(tempPath);
  }
}

async function extractDualPriceRowsForRect(
  imagePath: string,
  rect: WorkshopRect,
  rowCount: number,
  scale: number,
  safeMode: boolean,
  warnings: string[],
): Promise<DualPriceRowsOcrOutcome> {
  let fastModeError: string | null = null;
  const tempPath = cropImageToTempFile(imagePath, rect, scale);
  try {
    const extract = await runPaddleExtract(tempPath, "en", safeMode);
    if (!extract.ok) {
      throw new Error(extract.errorMessage ?? "未知错误");
    }

    const splitX = Math.floor((rect.width * scale) / 2);
    const leftWords = extract.words.filter((word) => word.left + word.width / 2 <= splitX);
    const rightWords = extract.words.filter((word) => word.left + word.width / 2 > splitX);
    const leftWarnings: string[] = [];
    const rightWarnings: string[] = [];
    const leftValues = buildPriceRowsFromWords(leftWords, rowCount, "left", leftWarnings, {
      clamp,
      numericConfidenceMin: OCR_TSV_NUMERIC_CONFIDENCE_MIN,
    });
    const rightValues = buildPriceRowsFromWords(rightWords, rowCount, "left", rightWarnings, {
      clamp,
      numericConfidenceMin: OCR_TSV_NUMERIC_CONFIDENCE_MIN,
    });
    const leftValid = leftValues.filter((entry): entry is number => entry !== null).length;
    const rightValid = rightValues.filter((entry): entry is number => entry !== null).length;
    const minValid = Math.max(2, Math.floor(rowCount * 0.5));

    if (leftValid >= minValid && rightValid >= minValid) {
      leftWarnings.forEach((line) => warnings.push(`左列价格：${line}`));
      rightWarnings.forEach((line) => warnings.push(`右列价格：${line}`));
      return {
        leftValues,
        rightValues,
        rawText: extract.rawText,
        tsvText: stringifyOcrWords(extract.words),
        engine: `onnx-ocr(${extract.language || "auto"}, dual-split)`,
      };
    }

    warnings.push("双列价格快速解析不足，已回退到双区块 OCR。");
  } catch (err) {
    fastModeError = err instanceof Error ? err.message : "未知错误";
  } finally {
    cleanupTempFile(tempPath);
  }

  if (fastModeError) {
    warnings.push(`双列价格快速解析失败，已回退到双区块 OCR：${fastModeError}`);
  }

  const leftWidth = Math.max(1, Math.floor(rect.width / 2));
  const rightWidth = Math.max(1, rect.width - leftWidth);
  const leftRect: WorkshopRect = {
    x: rect.x,
    y: rect.y,
    width: leftWidth,
    height: rect.height,
  };
  const rightRect: WorkshopRect = {
    x: rect.x + leftWidth,
    y: rect.y,
    width: rightWidth,
    height: rect.height,
  };
  const [leftOutcome, rightOutcome] = await Promise.all([
    extractPriceRowsForRect(imagePath, leftRect, rowCount, scale, safeMode, "left", warnings, "左列价格："),
    extractPriceRowsForRect(imagePath, rightRect, rowCount, scale, safeMode, "left", warnings, "右列价格："),
  ]);
  return {
    leftValues: leftOutcome.values,
    rightValues: rightOutcome.values,
    rawText: `${leftOutcome.rawText}\n\n---RIGHT_PRICE---\n\n${rightOutcome.rawText}`,
    tsvText: `${leftOutcome.tsvText}\n\n---RIGHT_PRICE_WORDS---\n\n${rightOutcome.tsvText}`,
    engine: `left=${leftOutcome.engine}, right=${rightOutcome.engine}`,
  };
}

export async function extractWorkshopOcrTextCore(
  payload: WorkshopOcrExtractTextInput,
): Promise<WorkshopOcrExtractTextResult> {
  const imageRawPath = payload.imagePath?.trim();
  if (!imageRawPath) {
    throw new Error("OCR 识别失败：请先填写截图路径。");
  }
  const imagePath = resolveImportFilePath(imageRawPath);
  const language = sanitizeOcrLanguage(payload.language);
  const psm = sanitizeOcrPsm(payload.psm);
  const safeMode = sanitizeOcrSafeMode(payload.safeMode);
  const warnings: string[] = [];
  const tradeBoardPreset = sanitizeTradeBoardPreset(payload.tradeBoardPreset);

  if (tradeBoardPreset) {
    let namesTempPath: string | null = null;
    try {
      const namesLanguage = buildPaddleLanguageCandidates(language).join("+");
      const namesScale = OCR_TRADE_BOARD_NAME_SCALE;
      const pricesScale = 2;
      namesTempPath = cropImageToTempFile(imagePath, tradeBoardPreset.namesRect, namesScale);
      const namesExtract = await runPaddleExtract(namesTempPath, namesLanguage, safeMode);
      if (!namesExtract.ok) {
        throw new Error(`名称区 OCR 失败：${formatPaddleOcrError(namesExtract.errorMessage)}`);
      }
      const effectiveRowCount = resolveTradeBoardRowCount(tradeBoardPreset.rowCount, namesExtract.words, namesExtract.rawText, warnings, {
        sanitizeOcrLineItemName,
        clamp,
      });
      const nameRowsFromTsv = buildNameRowsFromWords(
        namesExtract.words,
        effectiveRowCount,
        Math.floor(tradeBoardPreset.namesRect.height * namesScale),
        {
          sanitizeOcrLineItemName,
          clamp,
          nameConfidenceMin: OCR_TSV_NAME_CONFIDENCE_MIN,
        },
      );
      const nameRowsTsvSanitized = nameRowsFromTsv.map((row) => {
        const cleaned = sanitizeOcrLineItemName(row ?? "");
        return cleaned || null;
      });
      const nameLinesFallback = parseNonEmptyLines(namesExtract.rawText)
        .map((line) => sanitizeOcrLineItemName(line))
        .filter(Boolean)
        .slice(0, effectiveRowCount);
      const nameRowsFallback = Array.from({ length: effectiveRowCount }, (_, index) => nameLinesFallback[index] ?? null);
      const nameRows =
        nameRowsTsvSanitized.filter((entry) => entry !== null).length >= nameLinesFallback.length
          ? nameRowsTsvSanitized
          : nameRowsFallback;

      let leftValues: Array<number | null> = [];
      let rightValues: Array<number | null> = [];
      let rawPriceSection = "";
      let rawPriceTsvSection = "";
      let effectiveLeftRole: "server" | "world" = tradeBoardPreset.leftPriceRole === "world" ? "world" : "server";
      let effectiveRightRole: "server" | "world" = tradeBoardPreset.rightPriceRole === "server" ? "server" : "world";
      let pricesEngine = "";

      if (tradeBoardPreset.priceMode === "dual") {
        const detectedRoles = await resolveDualPriceRolesByHeader(
          imagePath,
          tradeBoardPreset.pricesRect,
          namesLanguage,
          safeMode,
          effectiveLeftRole,
          effectiveRightRole,
          warnings,
        );
        effectiveLeftRole = detectedRoles.leftRole;
        effectiveRightRole = detectedRoles.rightRole;
        const dualOutcome = await extractDualPriceRowsForRect(
          imagePath,
          tradeBoardPreset.pricesRect,
          effectiveRowCount,
          pricesScale,
          safeMode,
          warnings,
        );
        leftValues = dualOutcome.leftValues;
        rightValues = dualOutcome.rightValues;
        rawPriceSection = dualOutcome.rawText;
        rawPriceTsvSection = dualOutcome.tsvText;
        pricesEngine = dualOutcome.engine;
        warnings.push(
          `双价格列角色：左列=${effectiveLeftRole === "server" ? "伺服器" : "世界"}，右列=${
            effectiveRightRole === "server" ? "伺服器" : "世界"
          }。`,
        );
      } else {
        const singleOutcome = await extractPriceRowsForRect(
          imagePath,
          tradeBoardPreset.pricesRect,
          effectiveRowCount,
          pricesScale,
          safeMode,
          tradeBoardPreset.priceColumn,
          warnings,
          "",
        );
        if (tradeBoardPreset.priceColumn === "right") {
          leftValues = Array.from({ length: effectiveRowCount }, () => null);
          rightValues = singleOutcome.values;
        } else {
          leftValues = singleOutcome.values;
          rightValues = Array.from({ length: effectiveRowCount }, () => null);
        }
        rawPriceSection = singleOutcome.rawText;
        rawPriceTsvSection = singleOutcome.tsvText;
        pricesEngine = singleOutcome.engine;
      }

      const tradeRows: WorkshopOcrExtractTextResult["tradeRows"] = [];
      for (let index = 0; index < effectiveRowCount; index += 1) {
        const itemName = nameRows[index];
        if (!itemName) {
          continue;
        }
        const leftPrice = leftValues[index] ?? null;
        const rightPrice = rightValues[index] ?? null;
        const serverPrice =
          effectiveLeftRole === "server"
            ? leftPrice
            : effectiveRightRole === "server"
              ? rightPrice
              : null;
        const worldPrice =
          effectiveLeftRole === "world"
            ? leftPrice
            : effectiveRightRole === "world"
              ? rightPrice
              : null;
        if (serverPrice === null && worldPrice === null) {
          continue;
        }
        tradeRows.push({
          lineNumber: index + 1,
          itemName,
          serverPrice,
          worldPrice,
        });
      }

      const textLines = tradeRows
        .map((row) => {
          const primary =
            tradeBoardPreset.priceColumn === "right"
              ? effectiveRightRole === "server"
                ? row.serverPrice ?? row.worldPrice
                : row.worldPrice ?? row.serverPrice
              : effectiveLeftRole === "server"
                ? row.serverPrice ?? row.worldPrice
                : row.worldPrice ?? row.serverPrice;
          if (primary === null) {
            return null;
          }
          return `${row.itemName} ${primary}`;
        })
        .filter((entry): entry is string => entry !== null);
      if (tradeRows.length < effectiveRowCount) {
        warnings.push(`识别行不足：有效行 ${tradeRows.length}/${effectiveRowCount}。`);
      }
      const text = textLines.join("\n");
      return {
        rawText: `${namesExtract.rawText}\n\n---PRICE---\n\n${rawPriceSection}\n\n---NAMES_WORDS---\n\n${stringifyOcrWords(
          namesExtract.words,
        )}\n\n---PRICES_WORDS---\n\n${rawPriceTsvSection}`,
        text,
        lineCount: tradeRows.length,
        warnings,
        engine: `onnx-ocr(names=${namesExtract.language || namesLanguage}, prices=${pricesEngine}, psm=${psm}, trade-board-roi)`,
        tradeRows,
      };
    } finally {
      cleanupTempFile(namesTempPath);
    }
  }

  const primary = await runPaddleExtract(imagePath, language, safeMode);
  if (!primary.ok) {
    throw new Error(
      `ONNX OCR 识别失败：${formatPaddleOcrError(primary.errorMessage)}`,
    );
  }

  const rawText = primary.rawText;
  const text = normalizeOcrText(rawText);
  const lineCount = text ? text.split(/\n/u).length : 0;
  if (lineCount === 0) {
    warnings.push("OCR 返回为空，请检查截图裁切范围、清晰度或语言包。");
  }

  return {
    rawText,
    text,
    lineCount,
    warnings,
    engine: `onnx-ocr(${primary.language || language}, psm=${psm})`,
  };
}

export function addWorkshopPriceSnapshot(payload: AddWorkshopPriceSnapshotInput): WorkshopState {
  const state = readWorkshopState();
  ensureItemExists(state, payload.itemId);
  const item = state.items.find((entry) => entry.id === payload.itemId);
  const unitPrice = toNonNegativeInt(payload.unitPrice, -1);
  if (unitPrice <= 0) {
    throw new Error("价格必须是大于 0 的整数。");
  }

  const capturedAt = payload.capturedAt ? asIso(payload.capturedAt, new Date().toISOString()) : new Date().toISOString();
  const source = payload.source === "import" ? "import" : "manual";
  const market = sanitizePriceMarket(payload.market);
  const baselinePrices = collectBaselinePricesForItem(state.prices, payload.itemId, market, capturedAt);
  const anomaly = assessPriceAnomalyWithCategory(unitPrice, baselinePrices, item?.category ?? "other");
  let note = payload.note?.trim() || undefined;
  if (anomaly.kind === "hard") {
    note = appendNoteTag(note, WORKSHOP_PRICE_NOTE_TAG_HARD);
  } else if (anomaly.kind === "suspect") {
    note = appendNoteTag(note, WORKSHOP_PRICE_NOTE_TAG_SUSPECT);
  }
  const nextSnapshot: WorkshopPriceSnapshot = {
    id: randomUUID(),
    itemId: payload.itemId,
    unitPrice,
    capturedAt,
    source,
    market,
    note,
  };

  return writeWorkshopState({
    ...state,
    version: WORKSHOP_STATE_VERSION,
    prices: [...state.prices, nextSnapshot].slice(-WORKSHOP_PRICE_HISTORY_LIMIT),
  });
}

export function deleteWorkshopPriceSnapshot(snapshotId: string): WorkshopState {
  const state = readWorkshopState();
  if (!state.prices.some((entry) => entry.id === snapshotId)) {
    return state;
  }
  return writeWorkshopState({
    ...state,
    version: WORKSHOP_STATE_VERSION,
    prices: state.prices.filter((entry) => entry.id !== snapshotId),
  });
}

function isDuplicatePriceSnapshotByWindow(
  prices: WorkshopPriceSnapshot[],
  itemId: string,
  market: WorkshopPriceMarket | undefined,
  unitPrice: number,
  capturedAtIso: string,
  dedupeWithinSeconds: number,
): boolean {
  if (dedupeWithinSeconds <= 0) {
    return false;
  }
  const capturedAtMs = new Date(capturedAtIso).getTime();
  if (!Number.isFinite(capturedAtMs)) {
    return false;
  }
  const dedupeWindowMs = dedupeWithinSeconds * 1000;
  for (let index = prices.length - 1; index >= 0; index -= 1) {
    const row = prices[index];
    if (row.itemId !== itemId) {
      continue;
    }
    if ((row.market ?? "single") !== (market ?? "single")) {
      continue;
    }
    if (row.unitPrice !== unitPrice) {
      continue;
    }
    const rowMs = new Date(row.capturedAt).getTime();
    if (!Number.isFinite(rowMs)) {
      continue;
    }
    if (Math.abs(capturedAtMs - rowMs) <= dedupeWindowMs) {
      return true;
    }
  }
  return false;
}

export function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}

export async function importWorkshopOcrPricesCore(
  payload: WorkshopOcrPriceImportInput,
): Promise<WorkshopOcrPriceImportResult> {
  const state = readWorkshopState();
  const sanitized = sanitizeOcrImportPayload(payload, {
    asIso,
    clamp,
    sanitizeCategory,
  });
  const hasStructuredTradeRows = Array.isArray(sanitized.tradeRows) && sanitized.tradeRows.length > 0;
  if (!sanitized.text.trim() && !hasStructuredTradeRows) {
    throw new Error("OCR 导入内容为空，请先粘贴文本。");
  }

  const tradeRowsParsed = parseOcrTradeRows(sanitized.tradeRows, {
    sanitizeOcrLineItemName,
    normalizeNumericToken,
  });
  const parsedFromTradeRows = hasStructuredTradeRows;
  const { parsedLines, invalidLines } = parsedFromTradeRows
    ? tradeRowsParsed
    : parseOcrPriceLines(sanitized.text, {
        sanitizeOcrLineItemName,
        normalizeNumericToken,
      });
  const items = [...state.items];
  const prices = [...state.prices];
  const iconCache = normalizeIconCache(workshopStore.get(WORKSHOP_ICON_CACHE_KEY));
  const itemByLookupName = new Map<string, WorkshopItem>();
  items.forEach((item) => {
    itemByLookupName.set(normalizeLookupName(item.name), item);
  });
  const expectedIconByLineNumber = sanitized.iconCapture
    ? buildExpectedIconByLineNumber(parsedLines, itemByLookupName, {
        normalizeLookupName,
        resolveItemByOcrName,
        isCapturedImageIcon,
      })
    : undefined;
  const iconCaptureOutcome = sanitized.iconCapture
    ? captureOcrLineIcons(parsedLines, sanitized.iconCapture, expectedIconByLineNumber)
    : {
        iconByLineNumber: new Map<number, string>(),
        iconCapturedCount: 0,
        iconSkippedCount: 0,
        warnings: [] as string[],
      };
  const iconCaptureWarnings = [...sanitized.iconCaptureWarnings, ...iconCaptureOutcome.warnings];

  const unknownItemNameSet = new Set<string>();
  const importedEntries: WorkshopOcrPriceImportResult["importedEntries"] = [];
  const nameCorrectionWarnings: string[] = [];
  const priceQualityWarnings: string[] = [];
  let importedCount = 0;
  let duplicateSkippedCount = 0;
  let createdItemCount = 0;

  for (let index = 0; index < parsedLines.length; index += 1) {
    const line = parsedLines[index];
    if (shouldIgnoreOcrItemName(line.itemName)) {
      const ignoredName = normalizeOcrDomainName(line.itemName) || line.itemName;
      if (priceQualityWarnings.length < 40) {
        priceQualityWarnings.push(`第 ${line.lineNumber} 行「${ignoredName}」已忽略：閃耀前綴道具不納入導入。`);
      }
      continue;
    }
    const correctedLineName = tryCorrectOcrNameByKnownItems(line.itemName, items);
    const normalizedLineName = correctedLineName || line.itemName;
    if (normalizedLineName !== line.itemName && nameCorrectionWarnings.length < 20) {
      nameCorrectionWarnings.push(`名称纠错：${line.itemName} -> ${normalizedLineName}`);
    }
    if (!Number.isFinite(line.unitPrice) || line.unitPrice <= 0) {
      if (priceQualityWarnings.length < 40) {
        priceQualityWarnings.push(`第 ${line.lineNumber} 行「${normalizedLineName}」已跳过：价格无效（${line.unitPrice}）。`);
      }
      continue;
    }
    const key = normalizeLookupName(normalizedLineName);
    const capturedIcon = iconCaptureOutcome.iconByLineNumber.get(line.lineNumber);
    const exactMatchedItem = itemByLookupName.get(key);
    let item = exactMatchedItem;
    let matchedByExactName = Boolean(exactMatchedItem);
    if (!item && !sanitized.strictIconMatch) {
      item = resolveItemByOcrName(itemByLookupName, normalizedLineName);
      if (item) {
        itemByLookupName.set(key, item);
      }
    }
    const iconMatchedItem = resolveUniqueItemByIcon(items, capturedIcon);
    if (item && !matchedByExactName && !iconMatchedItem && isQualifiedNameCollapsedToBaseName(normalizedLineName, item.name)) {
      unknownItemNameSet.add(`${normalizedLineName}（限定词前缀疑似被折叠，已跳过）`);
      continue;
    }

    if (sanitized.strictIconMatch) {
      if (!capturedIcon) {
        const canFallbackByExactName =
          item !== undefined && !isCapturedImageIcon(item.icon) && isExactOcrNameMatch(item, normalizedLineName);
        if (!canFallbackByExactName) {
          unknownItemNameSet.add(`${normalizedLineName}（严格模式需开启图标抓取）`);
          continue;
        }
      }
      if (!item && iconMatchedItem) {
        item = iconMatchedItem;
        itemByLookupName.set(key, item);
      }
      if (item && iconMatchedItem && item.id !== iconMatchedItem.id) {
        unknownItemNameSet.add(`${normalizedLineName}（名称与图标冲突）`);
        continue;
      }
      if (item && capturedIcon && isCapturedImageIcon(item.icon) && item.icon !== capturedIcon) {
        unknownItemNameSet.add(`${normalizedLineName}（图标不匹配）`);
        continue;
      }
      if (item && !isCapturedImageIcon(item.icon) && !isExactOcrNameMatch(item, normalizedLineName)) {
        unknownItemNameSet.add(`${normalizedLineName}（严格模式缺少图标基线）`);
        continue;
      }
      if (item && !isExactOcrNameMatch(item, normalizedLineName) && !iconMatchedItem) {
        unknownItemNameSet.add(`${normalizedLineName}（严格模式下名称不精确）`);
        continue;
      }
    } else {
      if (item && iconMatchedItem && item.id !== iconMatchedItem.id) {
        unknownItemNameSet.add(`${normalizedLineName}（名称与图标冲突）`);
        continue;
      }
      if (!item && iconMatchedItem) {
        item = iconMatchedItem;
        itemByLookupName.set(key, item);
      }
      // Only block fuzzy/heuristic matches; exact key matches should be trusted.
      if (item && !matchedByExactName && !iconMatchedItem && isAmbiguousExactOcrNameMatch(item, normalizedLineName, items)) {
        unknownItemNameSet.add(`${normalizedLineName}（名称歧义，已跳过）`);
        continue;
      }
    }

    let createdItem = false;
    if (!item) {
      if (!sanitized.autoCreateMissingItems) {
        unknownItemNameSet.add(normalizedLineName);
        continue;
      }
      const nowIso = new Date().toISOString();
      item = {
        id: randomUUID(),
        name: normalizedLineName,
        category: sanitized.defaultCategory,
        icon: resolveItemIconWithCache(iconCache, normalizedLineName, sanitized.defaultCategory, capturedIcon),
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      items.push(item);
      itemByLookupName.set(key, item);
      createdItemCount += 1;
      createdItem = true;
    } else if (capturedIcon && item) {
      const currentItem = item;
      if (sanitized.strictIconMatch && isCapturedImageIcon(currentItem.icon) && currentItem.icon !== capturedIcon) {
        unknownItemNameSet.add(`${normalizedLineName}（图标不匹配）`);
        continue;
      }
      const canRefreshIcon =
        !sanitized.strictIconMatch && (matchedByExactName || (iconMatchedItem !== undefined && iconMatchedItem.id === currentItem.id));
      if (canRefreshIcon) {
        const resolvedIcon = resolveItemIconWithCache(iconCache, currentItem.name, currentItem.category, capturedIcon);
        if (resolvedIcon !== currentItem.icon) {
          const nextItem: WorkshopItem = {
            ...currentItem,
            icon: resolvedIcon,
            updatedAt: new Date().toISOString(),
          };
          const index = items.findIndex((entry) => entry.id === currentItem.id);
          if (index >= 0) {
            items[index] = nextItem;
          }
          itemByLookupName.set(key, nextItem);
          item = nextItem;
        }
      }
    }

    const anomalyBaseline = collectBaselinePricesForItem(prices, item.id, line.market, sanitized.capturedAt);
    const anomaly = assessPriceAnomalyWithCategory(line.unitPrice, anomalyBaseline, item.category);
    if (anomaly.kind === "hard") {
      unknownItemNameSet.add(`${normalizedLineName}（价格异常偏离，已自动过滤）`);
      if (priceQualityWarnings.length < 40) {
        priceQualityWarnings.push(`第 ${line.lineNumber} 行「${normalizedLineName}」已跳过：${formatAnomalyReason(anomaly)}`);
      }
      continue;
    }

    const duplicated = isDuplicatePriceSnapshotByWindow(
      prices,
      item.id,
      line.market,
      line.unitPrice,
      sanitized.capturedAt,
      sanitized.dedupeWithinSeconds,
    );
    if (duplicated) {
      duplicateSkippedCount += 1;
      continue;
    }
    let note = `ocr-import#${line.market}#line-${line.lineNumber}`;
    if (anomaly.kind === "suspect") {
      note = appendNoteTag(note, WORKSHOP_PRICE_NOTE_TAG_SUSPECT);
      if (priceQualityWarnings.length < 40) {
        priceQualityWarnings.push(`第 ${line.lineNumber} 行「${normalizedLineName}」标记可疑：${formatAnomalyReason(anomaly)}`);
      }
    }
    prices.push({
      id: randomUUID(),
      itemId: item.id,
      unitPrice: line.unitPrice,
      capturedAt: sanitized.capturedAt,
      source: sanitized.source,
      market: line.market,
      note,
    });
    importedEntries.push({
      lineNumber: line.lineNumber,
      itemId: item.id,
      itemName: item.name,
      unitPrice: line.unitPrice,
      market: line.market,
      capturedAt: sanitized.capturedAt,
      source: sanitized.source,
      createdItem,
    });
    importedCount += 1;
    if ((index + 1) % WORKSHOP_OCR_IMPORT_YIELD_EVERY === 0) {
      await yieldToEventLoop();
    }
  }

  const nextState = writeWorkshopState({
    ...state,
    version: WORKSHOP_STATE_VERSION,
    items,
    prices: prices.slice(-WORKSHOP_PRICE_HISTORY_LIMIT),
  });

  return {
    state: nextState,
    importedCount,
    duplicateSkippedCount,
    createdItemCount,
    parsedLineCount: parsedLines.length,
    unknownItemNames: Array.from(unknownItemNameSet).sort((left, right) => left.localeCompare(right, "zh-CN")),
    invalidLines,
    iconCapturedCount: iconCaptureOutcome.iconCapturedCount,
    iconSkippedCount: iconCaptureOutcome.iconSkippedCount,
    iconCaptureWarnings: [...iconCaptureWarnings, ...nameCorrectionWarnings, ...priceQualityWarnings],
    importedEntries,
  };
}
