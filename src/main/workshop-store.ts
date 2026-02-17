import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { nativeImage } from "electron";
import Store from "electron-store";
import type {
  AddWorkshopPriceSnapshotInput,
  WorkshopCatalogImportFromFileInput,
  WorkshopCatalogImportResult,
  WorkshopOcrExtractTextInput,
  WorkshopOcrExtractTextResult,
  WorkshopOcrIconCaptureConfig,
  WorkshopOcrPriceImportInput,
  WorkshopOcrPriceImportResult,
  WorkshopRect,
  WorkshopTradeBoardPreset,
  UpsertWorkshopInventoryInput,
  UpsertWorkshopItemInput,
  UpsertWorkshopRecipeInput,
  WorkshopCraftOption,
  WorkshopCraftSimulationInput,
  WorkshopCraftSimulationResult,
  WorkshopInventoryItem,
  WorkshopItem,
  WorkshopItemCategory,
  WorkshopPriceMarket,
  WorkshopPriceHistoryPoint,
  WorkshopPriceHistoryQuery,
  WorkshopPriceHistoryResult,
  WorkshopPriceSignalQuery,
  WorkshopPriceSignalResult,
  WorkshopPriceSignalRow,
  WorkshopPriceSignalRule,
  WorkshopPriceTrendTag,
  WorkshopPriceSnapshot,
  WorkshopRecipe,
  WorkshopRecipeInput,
  WorkshopState,
  WorkshopWeekdayAverage,
} from "../shared/types";

const WORKSHOP_STATE_VERSION = 6;
const WORKSHOP_PRICE_HISTORY_LIMIT = 8_000;
const WORKSHOP_HISTORY_DEFAULT_DAYS = 30;
const WORKSHOP_HISTORY_MAX_DAYS = 365;
const WORKSHOP_SIGNAL_THRESHOLD_DEFAULT = 0.15;
const WORKSHOP_SIGNAL_THRESHOLD_MIN = 0.15;
const WORKSHOP_SIGNAL_THRESHOLD_MAX = 0.5;
const WORKSHOP_SIGNAL_MIN_SAMPLE_COUNT = 5;
const WORKSHOP_PRICE_ANOMALY_BASELINE_DAYS = 30;
const WORKSHOP_PRICE_ANOMALY_BASELINE_MIN_SAMPLES = 8;
const WORKSHOP_PRICE_ANOMALY_SOFT_UPPER_RATIO = 2.2;
const WORKSHOP_PRICE_ANOMALY_SOFT_LOWER_RATIO = 0.45;
const WORKSHOP_PRICE_ANOMALY_HARD_UPPER_RATIO = 8;
const WORKSHOP_PRICE_ANOMALY_HARD_LOWER_RATIO = 0.125;
const WORKSHOP_PRICE_NOTE_TAG_SUSPECT = "qa:suspect:auto";
const WORKSHOP_PRICE_NOTE_TAG_HARD = "qa:hard-outlier:auto";
const WORKSHOP_ICON_CACHE_KEY = "iconCache";
const WORKSHOP_KNOWN_INVALID_ITEM_NAMES = new Set<string>([
  "燦爛的奧里哈康礫石",
  "純淨的奧里哈康磐石",
  "高純度的奧里哈康磐石",
  "新鮮的金盒花",
]);
const WORKSHOP_OCR_DEFAULT_LANGUAGE = "chi_tra";
const WORKSHOP_OCR_DEFAULT_PSM = 6;
const OCR_TSV_NAME_CONFIDENCE_MIN = 35;
const OCR_TSV_NUMERIC_CONFIDENCE_MIN = 20;
const ICON_CAPTURE_CALIBRATION_MAX_OFFSET_X = 16;
const ICON_CAPTURE_CALIBRATION_MAX_OFFSET_Y = 24;
const ICON_CAPTURE_CALIBRATION_STEP = 2;
const ICON_CAPTURE_CALIBRATION_SAMPLE_LIMIT = 8;
const OCR_PADDLE_CONFIDENCE_SCALE = 100;
const OCR_PADDLE_MAX_BUFFER = 64 * 1024 * 1024;
const OCR_PADDLE_REQUEST_TIMEOUT_MS = 20_000;
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
const BUILTIN_CATALOG_FILE_NAME = "制作管理.md";

const workshopStore = new Store<Record<string, unknown>>({
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function asIso(raw: unknown, fallbackIso: string): string {
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

function sanitizePriceMarket(raw: unknown): WorkshopPriceMarket {
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
}

interface SnapshotQualityTag {
  isSuspect: boolean;
  reason: string | null;
}

function appendNoteTag(note: string | undefined, tag: string): string {
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

function resolveSnapshotQualityTag(note: string | undefined): SnapshotQualityTag {
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

function normalizePriceMarketForCompare(market: WorkshopPriceMarket | undefined): WorkshopPriceMarket {
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
    };
  }
  const median = computeMedian(baselinePrices);
  if (median === null || median <= 0) {
    return {
      kind: "normal",
      sampleCount: baselinePrices.length,
      median: null,
      ratio: null,
    };
  }
  const ratio = unitPrice / median;
  if (ratio >= WORKSHOP_PRICE_ANOMALY_HARD_UPPER_RATIO || ratio <= WORKSHOP_PRICE_ANOMALY_HARD_LOWER_RATIO) {
    return {
      kind: "hard",
      sampleCount: baselinePrices.length,
      median,
      ratio,
    };
  }
  if (ratio >= WORKSHOP_PRICE_ANOMALY_SOFT_UPPER_RATIO || ratio <= WORKSHOP_PRICE_ANOMALY_SOFT_LOWER_RATIO) {
    return {
      kind: "suspect",
      sampleCount: baselinePrices.length,
      median,
      ratio,
    };
  }
  return {
    kind: "normal",
    sampleCount: baselinePrices.length,
    median,
    ratio,
  };
}

function formatAnomalyReason(assessment: PriceAnomalyAssessment): string {
  if (assessment.kind === "normal" || assessment.median === null || assessment.ratio === null) {
    return "";
  }
  const ratioText = `${assessment.ratio >= 1 ? "高于" : "低于"}中位数 ${assessment.ratio.toFixed(2)}x`;
  return `${ratioText}（中位数 ${Math.round(assessment.median)}，样本 ${assessment.sampleCount}）`;
}

function collectBaselinePricesForItem(
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
  净: "淨",
  淨: "淨",
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

function normalizeLookupCjkVariants(value: string): string {
  return value.replace(/[纯純净淨头頭台臺后後里裡矿礦铁鐵锭錠级級制製]/gu, (char) => LOOKUP_CJK_VARIANT_MAP[char] ?? char);
}

function normalizeLookupName(name: string): string {
  return normalizeLookupCjkVariants(name.trim().toLocaleLowerCase().replace(/\s+/g, ""));
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

function buildOcrLookupCandidates(rawName: string): string[] {
  const candidates = new Set<string>();
  const add = (value: string): void => {
    const normalized = normalizeLookupName(value);
    if (normalized.length >= 2) {
      candidates.add(normalized);
    }
  };
  add(rawName);
  const cleaned = sanitizeOcrLineItemName(rawName).replace(/[^0-9a-zA-Z\u3400-\u9fff]/gu, "");
  add(cleaned);
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
  const ocrKey = normalizeLookupName(sanitized);
  if (!ocrKey || ocrKey.length < 3) {
    return sanitized || rawOcrName;
  }
  const hasExact = items.some((item) => normalizeLookupName(item.name) === ocrKey);
  if (hasExact) {
    return sanitized || rawOcrName;
  }

  const candidates: Array<{ itemName: string; score: number }> = [];
  items.forEach((item) => {
    const itemKey = normalizeLookupName(item.name);
    if (!itemKey || Math.abs(itemKey.length - ocrKey.length) > 1) {
      return;
    }
    const distance = levenshteinDistance(ocrKey, itemKey);
    if (distance !== 1) {
      return;
    }
    const prefix = commonPrefixLength(ocrKey, itemKey);
    const suffix = commonSuffixLength(ocrKey, itemKey);
    // Require at least a stable 2-char anchor (prefix or suffix) to avoid over-correction.
    if (prefix < 2 && suffix < 2) {
      return;
    }
    const score = prefix * 3 + suffix * 2 - Math.abs(itemKey.length - ocrKey.length);
    candidates.push({ itemName: item.name, score });
  });
  if (candidates.length === 0) {
    return sanitized || rawOcrName;
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
    return sanitized || rawOcrName;
  }
  return best.itemName;
}

function resolveItemByOcrName(itemByLookupName: Map<string, WorkshopItem>, rawName: string): WorkshopItem | undefined {
  const candidates = buildOcrLookupCandidates(rawName);
  for (const candidate of candidates) {
    const exact = itemByLookupName.get(candidate);
    if (exact) {
      return exact;
    }
  }

  let bestContainItem: WorkshopItem | undefined;
  let bestContainOverlap = -1;
  let bestContainScore = -1;
  itemByLookupName.forEach((item, lookup) => {
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

function normalizeIconCache(raw: unknown): Map<string, string> {
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

function resolveItemIconWithCache(
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

function stripCatalogImprintTag(value: string): string {
  return value.replace(/[（(]\s*刻印\s*[）)]/gu, "");
}

function normalizeCatalogItemName(name: string): string {
  return stripCatalogImprintTag(name).trim().replace(/\s+/g, " ");
}

function normalizeCatalogLookupName(name: string): string {
  return normalizeCatalogItemName(name).toLocaleLowerCase().replace(/\s+/g, "");
}

function normalizeCatalogMainCategory(raw: string): string {
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

function mapCatalogCategory(rawCategory: string): WorkshopItemCategory {
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

interface CatalogItemRow {
  name: string;
  rawCategory: string;
  mainCategory?: string;
  alias?: string;
}

interface CatalogRecipeRow {
  outputName: string;
  outputQuantity: number;
  mainCategory?: string;
  inputs: WorkshopRecipeInput[];
}

function parseCatalogCsvText(text: string): {
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
      if (!name) {
        return;
      }
      if (!rawCategory) {
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

    if (mode === "recipe") {
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
      const inputChunks = inputText.split(/[;；]/u).map((entry) => entry.trim()).filter(Boolean);
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
      return;
    }
  });

  return {
    items: itemRows,
    recipes: recipeRows,
    warnings,
  };
}

function toPositiveInt(raw: unknown, fallback: number): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return fallback;
  }
  return Math.max(1, Math.floor(raw));
}

function toNonNegativeInt(raw: unknown, fallback: number): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return fallback;
  }
  return Math.max(0, Math.floor(raw));
}

function normalizeRecipeInputs(raw: unknown): WorkshopRecipeInput[] {
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

function writeWorkshopState(next: WorkshopState): WorkshopState {
  const iconCache = normalizeIconCache(workshopStore.get(WORKSHOP_ICON_CACHE_KEY));
  const normalizedItems = next.items.map((item) => {
    const icon = resolveItemIconWithCache(iconCache, item.name, item.category, item.icon);
    const aliases = extractItemAliasesFromNotes(item.notes);
    aliases.forEach((alias) => cacheIconByName(iconCache, alias, icon));
    return icon === item.icon ? item : { ...item, icon };
  });
  workshopStore.set("version", next.version);
  workshopStore.set("items", normalizedItems);
  workshopStore.set("recipes", next.recipes);
  workshopStore.set("prices", next.prices.slice(-WORKSHOP_PRICE_HISTORY_LIMIT));
  workshopStore.set("inventory", next.inventory);
  workshopStore.set("signalRule", normalizeSignalRule(next.signalRule));
  workshopStore.set(WORKSHOP_ICON_CACHE_KEY, serializeIconCache(iconCache));
  return normalizeWorkshopState(workshopStore.store);
}

function readWorkshopState(): WorkshopState {
  const rawVersion = workshopStore.get("version");
  const storedBuiltinCatalogSignature = workshopStore.get("builtinCatalogSignature");
  const normalized = normalizeWorkshopState(workshopStore.store);
  const cleaned = removeKnownInvalidItems(normalized);
  const currentState = cleaned === normalized ? normalized : writeWorkshopState(cleaned);
  const version = typeof rawVersion === "number" ? Math.floor(rawVersion) : 0;
  const currentBuiltinCatalogSignature = resolveBuiltinCatalogSignature();
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
  const builtin = buildBuiltinCatalogState();
  const rebuilt = remapRuntimeStateToBuiltin(currentState, builtin);
  const persisted = writeWorkshopState(rebuilt);
  workshopStore.set("builtinCatalogSignature", currentBuiltinCatalogSignature);
  return persisted;
}

function remapRuntimeStateToBuiltin(previous: WorkshopState, builtin: WorkshopState): WorkshopState {
  const builtinByLookup = new Map<string, WorkshopItem>();
  builtin.items.forEach((item) => {
    builtinByLookup.set(normalizeCatalogLookupName(item.name), item);
  });

  const mappedItemIdByLegacyId = new Map<string, string>();
  previous.items.forEach((item) => {
    const key = normalizeCatalogLookupName(item.name);
    const hit = builtinByLookup.get(key);
    if (!hit) {
      return;
    }
    mappedItemIdByLegacyId.set(item.id, hit.id);
  });

  const mappedPrices = previous.prices
    .map((row) => {
      const mappedItemId = mappedItemIdByLegacyId.get(row.itemId);
      if (!mappedItemId) {
        return null;
      }
      return {
        ...row,
        itemId: mappedItemId,
      };
    })
    .filter((row): row is WorkshopPriceSnapshot => row !== null)
    .slice(-WORKSHOP_PRICE_HISTORY_LIMIT);

  const mappedInventoryByItemId = new Map<string, WorkshopInventoryItem>();
  previous.inventory.forEach((row) => {
    const mappedItemId = mappedItemIdByLegacyId.get(row.itemId);
    if (!mappedItemId) {
      return;
    }
    const prev = mappedInventoryByItemId.get(mappedItemId);
    if (!prev) {
      mappedInventoryByItemId.set(mappedItemId, {
        ...row,
        itemId: mappedItemId,
      });
      return;
    }
    const prevTs = new Date(prev.updatedAt).getTime();
    const nextTs = new Date(row.updatedAt).getTime();
    if (nextTs >= prevTs) {
      mappedInventoryByItemId.set(mappedItemId, {
        ...row,
        itemId: mappedItemId,
      });
    }
  });

  return normalizeWorkshopState({
    ...builtin,
    version: WORKSHOP_STATE_VERSION,
    prices: mappedPrices,
    inventory: Array.from(mappedInventoryByItemId.values()).sort((left, right) => left.itemId.localeCompare(right.itemId)),
    signalRule: previous.signalRule,
  });
}

function ensureItemExists(state: WorkshopState, itemId: string): void {
  if (!state.items.some((item) => item.id === itemId)) {
    throw new Error("物品不存在，请先创建物品。");
  }
}

function getLatestPriceMap(state: WorkshopState): Map<string, WorkshopPriceSnapshot> {
  const scoreByMarket = (market: WorkshopPriceMarket | undefined): number => {
    if (market === "server") return 3;
    if (market === "single") return 2;
    if (market === "world") return 1;
    return 0;
  };
  const map = new Map<string, WorkshopPriceSnapshot>();
  state.prices.forEach((snapshot) => {
    const previous = map.get(snapshot.itemId);
    if (!previous) {
      map.set(snapshot.itemId, snapshot);
      return;
    }
    const prevTs = new Date(previous.capturedAt).getTime();
    const nextTs = new Date(snapshot.capturedAt).getTime();
    if (nextTs > prevTs) {
      map.set(snapshot.itemId, snapshot);
      return;
    }
    if (nextTs === prevTs && scoreByMarket(snapshot.market) > scoreByMarket(previous.market)) {
      map.set(snapshot.itemId, snapshot);
    }
  });
  return map;
}

interface LatestPriceByMarket {
  server: WorkshopPriceSnapshot | null;
  world: WorkshopPriceSnapshot | null;
  single: WorkshopPriceSnapshot | null;
}

function getLatestPriceByItemAndMarketMap(state: WorkshopState): Map<string, LatestPriceByMarket> {
  const map = new Map<string, LatestPriceByMarket>();
  state.prices.forEach((snapshot) => {
    const market = normalizePriceMarketForCompare(snapshot.market);
    const current = map.get(snapshot.itemId) ?? { server: null, world: null, single: null };
    const previous = current[market];
    if (!previous) {
      current[market] = snapshot;
      map.set(snapshot.itemId, current);
      return;
    }
    const prevTs = new Date(previous.capturedAt).getTime();
    const nextTs = new Date(snapshot.capturedAt).getTime();
    if (nextTs > prevTs || (nextTs === prevTs && snapshot.id.localeCompare(previous.id) > 0)) {
      current[market] = snapshot;
      map.set(snapshot.itemId, current);
    }
  });
  return map;
}

function resolveCheapestMaterialPrice(
  row: LatestPriceByMarket | undefined,
): { unitPrice: number | null; market: WorkshopPriceMarket | undefined } {
  if (!row) {
    return { unitPrice: null, market: undefined };
  }
  const serverPrice = row.server?.unitPrice ?? null;
  const worldPrice = row.world?.unitPrice ?? null;
  if (serverPrice !== null && worldPrice !== null) {
    if (serverPrice <= worldPrice) {
      return { unitPrice: serverPrice, market: "server" };
    }
    return { unitPrice: worldPrice, market: "world" };
  }
  if (serverPrice !== null) {
    return { unitPrice: serverPrice, market: "server" };
  }
  if (worldPrice !== null) {
    return { unitPrice: worldPrice, market: "world" };
  }
  if (row.single?.unitPrice !== undefined) {
    return { unitPrice: row.single.unitPrice, market: "single" };
  }
  return { unitPrice: null, market: undefined };
}

function buildSimulation(
  state: WorkshopState,
  recipe: WorkshopRecipe,
  runs: number,
  taxRate: number,
  materialMode: "expanded" | "direct",
): WorkshopCraftSimulationResult {
  const recipeByOutput = new Map(state.recipes.map((entry) => [entry.outputItemId, entry]));
  const itemById = new Map(state.items.map((entry) => [entry.id, entry]));
  const inventoryByItemId = new Map(state.inventory.map((entry) => [entry.itemId, entry.quantity]));
  const latestPriceByItemId = getLatestPriceMap(state);
  const latestPriceByItemAndMarket = getLatestPriceByItemAndMarketMap(state);
  const requiredMaterials = new Map<string, number>();
  const craftRuns = new Map<string, number>();
  const visiting = new Set<string>();
  const stack: string[] = [];

  const addMaterial = (itemId: string, quantity: number): void => {
    requiredMaterials.set(itemId, (requiredMaterials.get(itemId) ?? 0) + quantity);
  };

  const addCraftRuns = (itemId: string, stepRuns: number): void => {
    craftRuns.set(itemId, (craftRuns.get(itemId) ?? 0) + stepRuns);
  };

  const expandNeededItem = (itemId: string, neededQuantity: number): void => {
    if (neededQuantity <= 0) {
      return;
    }
    const nestedRecipe = recipeByOutput.get(itemId);
    if (!nestedRecipe) {
      addMaterial(itemId, neededQuantity);
      return;
    }
    if (visiting.has(itemId)) {
      const loopPath = [...stack, itemId]
        .map((loopItemId) => itemById.get(loopItemId)?.name ?? loopItemId)
        .join(" -> ");
      throw new Error(`检测到配方循环引用: ${loopPath}`);
    }
    visiting.add(itemId);
    stack.push(itemId);

    const nestedRuns = Math.ceil(neededQuantity / nestedRecipe.outputQuantity);
    addCraftRuns(itemId, nestedRuns);

    nestedRecipe.inputs.forEach((input) => {
      expandNeededItem(input.itemId, input.quantity * nestedRuns);
    });

    stack.pop();
    visiting.delete(itemId);
  };

  addCraftRuns(recipe.outputItemId, runs);
  if (materialMode === "direct") {
    recipe.inputs.forEach((input) => {
      addMaterial(input.itemId, input.quantity * runs);
    });
  } else {
    recipe.inputs.forEach((input) => {
      expandNeededItem(input.itemId, input.quantity * runs);
    });
  }

  const materialRows = Array.from(requiredMaterials.entries())
    .map(([itemId, required]) => {
      const requiredQty = Math.max(0, Math.floor(required));
      const owned = Math.max(0, Math.floor(inventoryByItemId.get(itemId) ?? 0));
      const missing = Math.max(0, requiredQty - owned);
      const priceChoice = resolveCheapestMaterialPrice(latestPriceByItemAndMarket.get(itemId));
      const latestUnitPrice = priceChoice.unitPrice;
      const requiredCost = latestUnitPrice === null ? null : latestUnitPrice * requiredQty;
      const missingCost = latestUnitPrice === null ? null : latestUnitPrice * missing;
      return {
        itemId,
        itemName: itemById.get(itemId)?.name ?? itemId,
        required: requiredQty,
        owned,
        missing,
        latestUnitPrice,
        latestPriceMarket: priceChoice.market,
        requiredCost,
        missingCost,
      };
    })
    .sort((left, right) => right.missing - left.missing || left.itemName.localeCompare(right.itemName, "zh-CN"));

  const unknownPriceItemIds = materialRows.filter((row) => row.latestUnitPrice === null).map((row) => row.itemId);
  const requiredMaterialCost =
    unknownPriceItemIds.length > 0 ? null : materialRows.reduce((acc, row) => acc + (row.requiredCost ?? 0), 0);
  const missingPurchaseCost =
    unknownPriceItemIds.length > 0 ? null : materialRows.reduce((acc, row) => acc + (row.missingCost ?? 0), 0);

  const outputUnitPrice = latestPriceByItemId.get(recipe.outputItemId)?.unitPrice ?? null;
  const totalOutputQuantity = recipe.outputQuantity * runs;
  const grossRevenue = outputUnitPrice === null ? null : outputUnitPrice * totalOutputQuantity;
  const netRevenueAfterTax = grossRevenue === null ? null : grossRevenue * (1 - taxRate);
  const estimatedProfit =
    netRevenueAfterTax === null || requiredMaterialCost === null ? null : netRevenueAfterTax - requiredMaterialCost;
  const estimatedProfitRate =
    estimatedProfit === null || requiredMaterialCost === null || requiredMaterialCost <= 0
      ? null
      : estimatedProfit / requiredMaterialCost;

  const craftSteps = Array.from(craftRuns.entries())
    .map(([itemId, itemRuns]) => ({
      itemId,
      itemName: itemById.get(itemId)?.name ?? itemId,
      runs: itemRuns,
    }))
    .sort((left, right) => right.runs - left.runs || left.itemName.localeCompare(right.itemName, "zh-CN"));

  return {
    recipeId: recipe.id,
    outputItemId: recipe.outputItemId,
    outputItemName: itemById.get(recipe.outputItemId)?.name ?? recipe.outputItemId,
    outputQuantity: recipe.outputQuantity,
    runs,
    totalOutputQuantity,
    taxRate,
    materialMode,
    materialRows,
    craftSteps,
    craftableNow: materialRows.every((row) => row.missing <= 0),
    unknownPriceItemIds,
    requiredMaterialCost,
    missingPurchaseCost,
    outputUnitPrice,
    grossRevenue,
    netRevenueAfterTax,
    estimatedProfit,
    estimatedProfitRate,
  };
}

function sanitizeTaxRate(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return 0.1;
  }
  return clamp(raw, 0, 0.95);
}

function parseOptionalIso(raw: unknown): Date | null {
  if (typeof raw !== "string") {
    return null;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function sanitizeLookbackDays(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return WORKSHOP_HISTORY_DEFAULT_DAYS;
  }
  return clamp(Math.floor(raw), 1, WORKSHOP_HISTORY_MAX_DAYS);
}

function sanitizeSignalThresholdRatio(raw: unknown): number {
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

interface PriceTrendAssessment {
  trendTag: WorkshopPriceTrendTag;
  confidenceScore: number;
  reasons: string[];
}

function formatRatioAsPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function resolvePriceTrendAssessment(
  sampleCount: number,
  deviationFromWeekdayAverage: number | null,
  deviationFromMa7: number | null,
  thresholdRatio: number,
): PriceTrendAssessment {
  if (sampleCount < WORKSHOP_SIGNAL_MIN_SAMPLE_COUNT) {
    return {
      trendTag: "watch",
      confidenceScore: 20,
      reasons: [`样本不足（${sampleCount}/${WORKSHOP_SIGNAL_MIN_SAMPLE_COUNT}）`],
    };
  }
  if (deviationFromWeekdayAverage === null) {
    return {
      trendTag: "watch",
      confidenceScore: 20,
      reasons: ["缺少同星期均价基线"],
    };
  }
  const ma7Threshold = thresholdRatio * 0.5;
  const buyByWeekday = deviationFromWeekdayAverage <= -thresholdRatio;
  const sellByWeekday = deviationFromWeekdayAverage >= thresholdRatio;
  const buyByMa7 = deviationFromMa7 === null ? true : deviationFromMa7 <= -ma7Threshold;
  const sellByMa7 = deviationFromMa7 === null ? true : deviationFromMa7 >= ma7Threshold;

  const sampleFactor = clamp(sampleCount / 20, 0.35, 1);
  const weekdayStrength = clamp(Math.abs(deviationFromWeekdayAverage) / thresholdRatio, 0, 2.5);
  const ma7Strength =
    deviationFromMa7 === null ? 1 : clamp(Math.abs(deviationFromMa7) / Math.max(ma7Threshold, Number.EPSILON), 0, 2.5);
  const confidenceScore = clamp(Math.round((weekdayStrength * 0.65 + ma7Strength * 0.35) * 42 * sampleFactor), 20, 99);

  if (buyByWeekday && buyByMa7) {
    return {
      trendTag: "buy-zone",
      confidenceScore,
      reasons: [
        `星期偏离 ${formatRatioAsPercent(deviationFromWeekdayAverage)} <= -${formatRatioAsPercent(thresholdRatio)}`,
        deviationFromMa7 === null
          ? "MA7 不可用（按星期偏离判定）"
          : `MA7偏离 ${formatRatioAsPercent(deviationFromMa7)} <= -${formatRatioAsPercent(ma7Threshold)}`,
      ],
    };
  }
  if (sellByWeekday && sellByMa7) {
    return {
      trendTag: "sell-zone",
      confidenceScore,
      reasons: [
        `星期偏离 ${formatRatioAsPercent(deviationFromWeekdayAverage)} >= ${formatRatioAsPercent(thresholdRatio)}`,
        deviationFromMa7 === null
          ? "MA7 不可用（按星期偏离判定）"
          : `MA7偏离 ${formatRatioAsPercent(deviationFromMa7)} >= ${formatRatioAsPercent(ma7Threshold)}`,
      ],
    };
  }
  return {
    trendTag: "watch",
    confidenceScore: clamp(Math.round(confidenceScore * 0.45), 10, 60),
    reasons: [
      `星期偏离 ${formatRatioAsPercent(deviationFromWeekdayAverage)} 未达阈值 ${formatRatioAsPercent(thresholdRatio)}`,
      deviationFromMa7 === null
        ? "MA7 不可用（仅参考星期偏离）"
        : `MA7偏离 ${formatRatioAsPercent(deviationFromMa7)}（确认阈值 ${formatRatioAsPercent(ma7Threshold)}）`,
    ],
  };
}

function buildWeekdayAverages(points: WorkshopPriceHistoryPoint[]): WorkshopWeekdayAverage[] {
  const aggregates = Array.from({ length: 7 }, () => ({ sum: 0, count: 0 }));
  points.forEach((point) => {
    const bucket = aggregates[point.weekday];
    bucket.sum += point.unitPrice;
    bucket.count += 1;
  });
  return aggregates.map((entry, weekday) => ({
    weekday,
    averagePrice: entry.count > 0 ? entry.sum / entry.count : null,
    sampleCount: entry.count,
  }));
}

function resolveHistoryRange(payload: WorkshopPriceHistoryQuery): { from: Date; to: Date } {
  const lookbackDays = sanitizeLookbackDays(payload.days);
  const parsedTo = parseOptionalIso(payload.toAt);
  const parsedFrom = parseOptionalIso(payload.fromAt);
  const now = new Date();
  const to = parsedTo ?? now;
  let from: Date;

  if (payload.fromAt && parsedFrom === null) {
    throw new Error("fromAt 不是有效时间格式。");
  }
  if (payload.toAt && parsedTo === null) {
    throw new Error("toAt 不是有效时间格式。");
  }

  if (parsedFrom) {
    from = parsedFrom;
  } else {
    const fromMs = to.getTime() - lookbackDays * 24 * 60 * 60 * 1000;
    from = new Date(fromMs);
  }

  if (from.getTime() > to.getTime()) {
    throw new Error("时间范围无效：fromAt 不能晚于 toAt。");
  }

  return { from, to };
}

function buildWorkshopPriceHistoryResult(state: WorkshopState, payload: WorkshopPriceHistoryQuery): WorkshopPriceHistoryResult {
  const { from, to } = resolveHistoryRange(payload);
  const includeSuspect = payload.includeSuspect === true;
  const targetMarket = payload.market === undefined ? undefined : sanitizePriceMarket(payload.market);
  const snapshots = state.prices
    .filter((entry) => entry.itemId === payload.itemId)
    .filter((entry) =>
      targetMarket === undefined ? true : normalizePriceMarketForCompare(entry.market) === normalizePriceMarketForCompare(targetMarket),
    )
    .map((entry) => ({
      ...entry,
      ts: new Date(entry.capturedAt).getTime(),
    }))
    .filter((entry) => Number.isFinite(entry.ts))
    .filter((entry) => entry.ts >= from.getTime() && entry.ts <= to.getTime())
    .sort((left, right) => left.ts - right.ts || left.id.localeCompare(right.id));

  const anomalyWindowMs = WORKSHOP_PRICE_ANOMALY_BASELINE_DAYS * 24 * 60 * 60 * 1000;
  const baselineByMarket = new Map<WorkshopPriceMarket, Array<{ ts: number; unitPrice: number }>>();
  const classifiedSnapshots = snapshots.map((entry) => {
    const market = normalizePriceMarketForCompare(entry.market);
    const baseline = baselineByMarket.get(market) ?? [];
    const baselineInWindow = baseline.filter((row) => row.ts >= entry.ts - anomalyWindowMs);
    const qualityTag = resolveSnapshotQualityTag(entry.note);
    const anomaly = qualityTag.isSuspect ? null : assessPriceAnomaly(entry.unitPrice, baselineInWindow.map((row) => row.unitPrice));
    const isSuspect = qualityTag.isSuspect || (anomaly !== null && anomaly.kind !== "normal");
    const suspectReason = qualityTag.reason ?? (anomaly ? formatAnomalyReason(anomaly) || null : null);
    if (!isSuspect) {
      baselineInWindow.push({
        ts: entry.ts,
        unitPrice: entry.unitPrice,
      });
      baselineByMarket.set(market, baselineInWindow);
    } else {
      baselineByMarket.set(market, baselineInWindow);
    }
    return {
      id: entry.id,
      itemId: entry.itemId,
      unitPrice: entry.unitPrice,
      capturedAt: new Date(entry.ts).toISOString(),
      weekday: new Date(entry.ts).getDay(),
      market,
      note: entry.note,
      isSuspect,
      suspectReason,
    };
  });

  const snapshotsForSeries = includeSuspect ? classifiedSnapshots : classifiedSnapshots.filter((entry) => !entry.isSuspect);
  let rollingSum = 0;
  const rollingWindow: number[] = [];
  const points: WorkshopPriceHistoryPoint[] = snapshotsForSeries.map((entry) => {
    rollingWindow.push(entry.unitPrice);
    rollingSum += entry.unitPrice;
    if (rollingWindow.length > 7) {
      const popped = rollingWindow.shift();
      if (popped !== undefined) {
        rollingSum -= popped;
      }
    }
    const ma7 = rollingWindow.length >= 7 ? rollingSum / rollingWindow.length : null;
    return {
      id: entry.id,
      itemId: entry.itemId,
      unitPrice: entry.unitPrice,
      capturedAt: entry.capturedAt,
      weekday: entry.weekday,
      ma7,
      market: entry.market,
      note: entry.note,
      isSuspect: entry.isSuspect,
      suspectReason: entry.suspectReason ?? undefined,
    };
  });
  const pointById = new Map(points.map((point) => [point.id, point]));
  const suspectPoints: WorkshopPriceHistoryPoint[] = classifiedSnapshots
    .filter((entry) => entry.isSuspect)
    .map((entry) => {
      const inSeries = pointById.get(entry.id);
      if (inSeries) {
        return inSeries;
      }
      return {
        id: entry.id,
        itemId: entry.itemId,
        unitPrice: entry.unitPrice,
        capturedAt: entry.capturedAt,
        weekday: entry.weekday,
        ma7: null,
        market: entry.market,
        note: entry.note,
        isSuspect: true,
        suspectReason: entry.suspectReason ?? undefined,
      };
    });

  const sampleCount = points.length;
  const averagePrice = sampleCount > 0 ? points.reduce((acc, point) => acc + point.unitPrice, 0) / sampleCount : null;
  const latestPoint = points[sampleCount - 1] ?? null;

  return {
    itemId: payload.itemId,
    market: targetMarket,
    fromAt: from.toISOString(),
    toAt: to.toISOString(),
    sampleCount,
    suspectCount: suspectPoints.length,
    latestPrice: latestPoint?.unitPrice ?? null,
    latestCapturedAt: latestPoint?.capturedAt ?? null,
    averagePrice,
    ma7Latest: latestPoint?.ma7 ?? null,
    points,
    suspectPoints,
    weekdayAverages: buildWeekdayAverages(points),
  };
}

interface WorkshopSampleItemSeed {
  name: string;
  category: WorkshopItemCategory;
  notes?: string;
}

interface WorkshopSampleRecipeSeed {
  outputName: string;
  outputQuantity: number;
  inputs: Array<{ inputName: string; quantity: number }>;
}

interface WorkshopSamplePriceSeed {
  itemName: string;
  unitPrice: number;
}

interface WorkshopSampleInventorySeed {
  itemName: string;
  quantity: number;
}

const WORKSHOP_SAMPLE_ITEMS: WorkshopSampleItemSeed[] = [
  { name: "样例-奥德矿石", category: "material", notes: "基础采集材料" },
  { name: "样例-副本核心", category: "material", notes: "副本掉落材料" },
  { name: "样例-研磨粉", category: "component", notes: "中间加工材料" },
  { name: "样例-强化锭", category: "component", notes: "进阶中间材料" },
  { name: "样例-勇者长剑", category: "equipment", notes: "样例成品装备" },
];

const WORKSHOP_SAMPLE_RECIPES: WorkshopSampleRecipeSeed[] = [
  {
    outputName: "样例-研磨粉",
    outputQuantity: 1,
    inputs: [{ inputName: "样例-奥德矿石", quantity: 3 }],
  },
  {
    outputName: "样例-强化锭",
    outputQuantity: 1,
    inputs: [
      { inputName: "样例-研磨粉", quantity: 2 },
      { inputName: "样例-副本核心", quantity: 1 },
    ],
  },
  {
    outputName: "样例-勇者长剑",
    outputQuantity: 1,
    inputs: [
      { inputName: "样例-强化锭", quantity: 5 },
      { inputName: "样例-副本核心", quantity: 2 },
    ],
  },
];

const WORKSHOP_SAMPLE_PRICES: WorkshopSamplePriceSeed[] = [
  { itemName: "样例-奥德矿石", unitPrice: 80 },
  { itemName: "样例-副本核心", unitPrice: 1200 },
  { itemName: "样例-研磨粉", unitPrice: 320 },
  { itemName: "样例-强化锭", unitPrice: 1900 },
  { itemName: "样例-勇者长剑", unitPrice: 18000 },
];

const WORKSHOP_SAMPLE_INVENTORY: WorkshopSampleInventorySeed[] = [
  { itemName: "样例-奥德矿石", quantity: 480 },
  { itemName: "样例-副本核心", quantity: 26 },
  { itemName: "样例-研磨粉", quantity: 8 },
  { itemName: "样例-强化锭", quantity: 3 },
  { itemName: "样例-勇者长剑", quantity: 0 },
];

interface ParsedOcrPriceLine {
  lineNumber: number;
  raw: string;
  itemName: string;
  unitPrice: number;
  market: WorkshopPriceMarket;
}

interface OcrIconCaptureOutcome {
  iconByLineNumber: Map<number, string>;
  iconCapturedCount: number;
  iconSkippedCount: number;
  warnings: string[];
}

function parseIntLike(raw: unknown): number | null {
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return null;
  }
  return Math.floor(raw);
}

function sanitizeOcrImportPayload(payload: WorkshopOcrPriceImportInput): {
  source: "manual" | "import";
  capturedAt: string;
  dedupeWithinSeconds: number;
  autoCreateMissingItems: boolean;
  strictIconMatch: boolean;
  defaultCategory: WorkshopItemCategory;
  text: string;
  tradeRows: WorkshopOcrPriceImportInput["tradeRows"];
  iconCapture: WorkshopOcrIconCaptureConfig | null;
  iconCaptureWarnings: string[];
} {
  const source = payload.source === "manual" ? "manual" : "import";
  const capturedAt = payload.capturedAt ? asIso(payload.capturedAt, new Date().toISOString()) : new Date().toISOString();
  const dedupeWithinSecondsRaw = parseIntLike(payload.dedupeWithinSeconds);
  const dedupeWithinSeconds =
    dedupeWithinSecondsRaw === null ? 0 : clamp(dedupeWithinSecondsRaw, 0, 600);
  const autoCreateMissingItems = payload.autoCreateMissingItems ?? false;
  const strictIconMatch = false;
  const defaultCategory = sanitizeCategory(payload.defaultCategory);
  const iconCaptureWarnings: string[] = [];
  if (payload.strictIconMatch === true || payload.iconCapture !== undefined) {
    iconCaptureWarnings.push("图标识别已停用，当前仅按名称识别。");
  }
  return {
    source,
    capturedAt,
    dedupeWithinSeconds,
    autoCreateMissingItems,
    strictIconMatch,
    defaultCategory,
    text: typeof payload.text === "string" ? payload.text : "",
    tradeRows: Array.isArray(payload.tradeRows) ? payload.tradeRows : undefined,
    iconCapture: null,
    iconCaptureWarnings,
  };
}

function captureOcrLineIcons(
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
    imagePath = resolveCatalogImportFilePath(config.screenshotPath);
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

function buildExpectedIconByLineNumber(
  parsedLines: ParsedOcrPriceLine[],
  itemByLookupName: Map<string, WorkshopItem>,
): Map<number, string> {
  const expected = new Map<number, string>();
  const uniqueLines = new Map<number, ParsedOcrPriceLine>();
  parsedLines.forEach((line) => {
    if (!uniqueLines.has(line.lineNumber)) {
      uniqueLines.set(line.lineNumber, line);
    }
  });
  Array.from(uniqueLines.values()).forEach((line) => {
    const key = normalizeLookupName(line.itemName);
    const exact = itemByLookupName.get(key);
    const resolved = exact ?? resolveItemByOcrName(itemByLookupName, line.itemName);
    const resolvedIcon = resolved?.icon;
    if (!resolved || !isCapturedImageIcon(resolvedIcon)) {
      return;
    }
    expected.set(line.lineNumber, resolvedIcon!);
  });
  return expected;
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
  for (let offsetY = -ICON_CAPTURE_CALIBRATION_MAX_OFFSET_Y; offsetY <= ICON_CAPTURE_CALIBRATION_MAX_OFFSET_Y; offsetY += ICON_CAPTURE_CALIBRATION_STEP) {
    for (let offsetX = -ICON_CAPTURE_CALIBRATION_MAX_OFFSET_X; offsetX <= ICON_CAPTURE_CALIBRATION_MAX_OFFSET_X; offsetX += ICON_CAPTURE_CALIBRATION_STEP) {
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

function parseOcrPriceLines(rawText: string): { parsedLines: ParsedOcrPriceLine[]; invalidLines: string[] } {
  const parsedLines: ParsedOcrPriceLine[] = [];
  const invalidLines: string[] = [];
  const lines = rawText.split(/\r?\n/);

  lines.forEach((origin, index) => {
    const lineNumber = index + 1;
    const raw = origin.trim();
    if (!raw) {
      return;
    }
    const normalizedLine = raw
      .replace(/[|丨]/g, " ")
      .replace(/[，]/g, ",")
      .replace(/[：]/g, ":")
      .replace(/\s+/g, " ");
    const match = normalizedLine.match(/(-?[0-9oOlI|sSbB][0-9oOlI|sSbB,\.\s]*)$/);
    if (!match || match.index === undefined) {
      invalidLines.push(`#${lineNumber} ${raw}`);
      return;
    }
    let itemName = normalizedLine.slice(0, match.index).trim();
    itemName = itemName
      .replace(/[:=\-–—|]\s*$/g, "")
      .replace(/^\d+\s*[.)、:：\-]\s*/, "")
      .trim();
    itemName = sanitizeOcrLineItemName(itemName);
    const unitPrice = normalizeNumericToken(match[1]);
    if (!itemName || unitPrice === null) {
      invalidLines.push(`#${lineNumber} ${raw}`);
      return;
    }
    parsedLines.push({
      lineNumber,
      raw,
      itemName,
      unitPrice,
      market: "single",
    });
  });

  return {
    parsedLines,
    invalidLines,
  };
}

function parseOcrTradeRows(
  tradeRows: WorkshopOcrPriceImportInput["tradeRows"],
): { parsedLines: ParsedOcrPriceLine[]; invalidLines: string[] } {
  if (!Array.isArray(tradeRows) || tradeRows.length === 0) {
    return {
      parsedLines: [],
      invalidLines: [],
    };
  }
  const parsedLines: ParsedOcrPriceLine[] = [];
  const invalidLines: string[] = [];

  tradeRows.forEach((row, index) => {
    const lineNumber = Number.isFinite(row.lineNumber) ? Math.max(1, Math.floor(row.lineNumber)) : index + 1;
    const rawName = typeof row.itemName === "string" ? row.itemName : "";
    const itemName = sanitizeOcrLineItemName(rawName);
    const serverPriceRaw = String(row.serverPrice ?? "").trim();
    const worldPriceRaw = String(row.worldPrice ?? "").trim();
    const parsedServerPrice = normalizeNumericToken(serverPriceRaw);
    const parsedWorldPrice = normalizeNumericToken(worldPriceRaw);
    const serverPrice = parsedServerPrice !== null && parsedServerPrice > 0 ? parsedServerPrice : null;
    const worldPrice = parsedWorldPrice !== null && parsedWorldPrice > 0 ? parsedWorldPrice : null;
    if (!itemName) {
      invalidLines.push(`#${lineNumber} ${rawName || "<空名称>"}`);
      return;
    }
    if (serverPriceRaw && parsedServerPrice === null) {
      invalidLines.push(`#${lineNumber} ${itemName} <伺服器价格无效: ${serverPriceRaw}>`);
    } else if (serverPriceRaw && parsedServerPrice !== null && parsedServerPrice <= 0) {
      invalidLines.push(`#${lineNumber} ${itemName} <伺服器价格无效(<=0): ${serverPriceRaw}>`);
    }
    if (worldPriceRaw && parsedWorldPrice === null) {
      invalidLines.push(`#${lineNumber} ${itemName} <世界价格无效: ${worldPriceRaw}>`);
    } else if (worldPriceRaw && parsedWorldPrice !== null && parsedWorldPrice <= 0) {
      invalidLines.push(`#${lineNumber} ${itemName} <世界价格无效(<=0): ${worldPriceRaw}>`);
    }
    if (serverPrice === null && worldPrice === null) {
      if (!serverPriceRaw && !worldPriceRaw) {
        invalidLines.push(`#${lineNumber} ${itemName} <双价格均为空>`);
      }
      return;
    }
    if (serverPrice !== null) {
      parsedLines.push({
        lineNumber,
        raw: `${itemName} server=${serverPrice}`,
        itemName,
        unitPrice: serverPrice,
        market: "server",
      });
    }
    if (worldPrice !== null) {
      parsedLines.push({
        lineNumber,
        raw: `${itemName} world=${worldPrice}`,
        itemName,
        unitPrice: worldPrice,
        market: "world",
      });
    }
  });

  return {
    parsedLines,
    invalidLines,
  };
}

function sanitizeOcrLanguage(raw: unknown): string {
  if (typeof raw !== "string") {
    return WORKSHOP_OCR_DEFAULT_LANGUAGE;
  }
  const value = raw.trim();
  if (!value) {
    return WORKSHOP_OCR_DEFAULT_LANGUAGE;
  }
  if (!/^[a-zA-Z0-9_+]+$/u.test(value)) {
    return WORKSHOP_OCR_DEFAULT_LANGUAGE;
  }
  return value;
}

function sanitizeOcrPsm(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return WORKSHOP_OCR_DEFAULT_PSM;
  }
  return clamp(Math.floor(raw), 3, 13);
}

function sanitizeOcrSafeMode(raw: unknown): boolean {
  return raw !== false;
}

function buildPaddleLanguageCandidates(language: string): string[] {
  const parts = language
    .split("+")
    .map((entry) => entry.trim().toLocaleLowerCase())
    .filter(Boolean);
  const candidates: string[] = [];
  const add = (value: string): void => {
    if (!candidates.includes(value)) {
      candidates.push(value);
    }
  };
  parts.forEach((part) => {
    if (part === "chi_tra") {
      add("chinese_cht");
      add("ch");
      return;
    }
    if (part === "chi_sim") {
      add("ch");
      return;
    }
    if (part === "eng") {
      add("en");
      return;
    }
    add(part);
  });
  add("ch");
  add("en");
  return candidates;
}

function sanitizeRect(raw: unknown): WorkshopRect | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const entity = raw as Partial<WorkshopRect>;
  const x = parseIntLike(entity.x);
  const y = parseIntLike(entity.y);
  const width = parseIntLike(entity.width);
  const height = parseIntLike(entity.height);
  if (x === null || y === null || width === null || height === null) {
    return null;
  }
  if (x < 0 || y < 0 || width <= 0 || height <= 0) {
    return null;
  }
  return { x, y, width, height };
}

function sanitizeTradeBoardPreset(raw: unknown): WorkshopTradeBoardPreset | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const entity = raw as Partial<WorkshopTradeBoardPreset>;
  if (!entity.enabled) {
    return null;
  }
  const namesRect = sanitizeRect(entity.namesRect);
  const pricesRect = sanitizeRect(entity.pricesRect);
  if (!namesRect || !pricesRect) {
    return null;
  }
  const rowCountRaw = parseIntLike(entity.rowCount);
  const rowCount = rowCountRaw === null ? 0 : clamp(rowCountRaw, 0, 30);
  return {
    enabled: true,
    rowCount,
    namesRect,
    pricesRect,
    priceMode: entity.priceMode === "single" ? "single" : "dual",
    priceColumn: entity.priceColumn === "right" ? "right" : "left",
    leftPriceRole: entity.leftPriceRole === "world" ? "world" : "server",
    rightPriceRole: entity.rightPriceRole === "server" ? "server" : "world",
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

interface OcrTsvWord {
  text: string;
  left: number;
  top: number;
  width: number;
  height: number;
  confidence: number;
}

interface PaddleOcrPayloadWord {
  text?: unknown;
  left?: unknown;
  top?: unknown;
  width?: unknown;
  height?: unknown;
  confidence?: unknown;
}

interface PaddleOcrPayload {
  id?: unknown;
  ready?: unknown;
  ok?: unknown;
  error?: unknown;
  language?: unknown;
  raw_text?: unknown;
  words?: unknown;
}

interface PaddleOcrOutcome {
  ok: boolean;
  language: string;
  rawText: string;
  words: OcrTsvWord[];
  errorMessage?: string;
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

let paddleWorkerProcess: ChildProcessWithoutNullStreams | null = null;
let paddleWorkerStartPromise: Promise<void> | null = null;
let paddleWorkerStdoutBuffer = "";
let paddleWorkerStderrBuffer = "";
const paddleWorkerPendingRequests = new Map<string, PaddleWorkerPendingRequest>();

function normalizePaddleWord(raw: PaddleOcrPayloadWord): OcrTsvWord | null {
  const text = typeof raw.text === "string" ? raw.text.trim() : "";
  if (!text) {
    return null;
  }
  const left = typeof raw.left === "number" && Number.isFinite(raw.left) ? Math.floor(raw.left) : 0;
  const top = typeof raw.top === "number" && Number.isFinite(raw.top) ? Math.floor(raw.top) : 0;
  const width = typeof raw.width === "number" && Number.isFinite(raw.width) ? Math.max(1, Math.floor(raw.width)) : 1;
  const height = typeof raw.height === "number" && Number.isFinite(raw.height) ? Math.max(1, Math.floor(raw.height)) : 1;
  const confidenceRaw =
    typeof raw.confidence === "number" && Number.isFinite(raw.confidence) ? raw.confidence : -1;
  const confidence =
    confidenceRaw >= 0 && confidenceRaw <= 1.5 ? confidenceRaw * OCR_PADDLE_CONFIDENCE_SCALE : confidenceRaw;
  return {
    text,
    left,
    top,
    width,
    height,
    confidence,
  };
}

function parsePaddlePayload(stdout: string): PaddleOcrOutcome {
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
      errorMessage: `PaddleOCR 输出 JSON 解析失败：${parseError || "未知错误"}。`,
    };
  }
  return parsePaddlePayloadObject(parsed);
}

function parsePaddlePayloadObject(parsed: PaddleOcrPayload): PaddleOcrOutcome {
  const ok = parsed.ok === true;
  if (!ok) {
    const errorMessage = typeof parsed.error === "string" ? parsed.error : "PaddleOCR 执行失败。";
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
        .map((entry) => normalizePaddleWord((entry ?? {}) as PaddleOcrPayloadWord))
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
  pending.resolve(parsePaddlePayloadObject(parsed));
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

async function runPaddleExtract(imagePath: string, language: string, safeMode = true): Promise<PaddleOcrOutcome> {
  const candidates = buildPaddleLanguageCandidates(language);
  const langArg = candidates.join(",");
  const attemptErrors: string[] = [];

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
    const payload = parsePaddlePayload(result.stdout);
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
    errorMessage: attemptErrors.join(" | ") || "PaddleOCR 调用失败。",
  };
}

export function cleanupWorkshopOcrEngine(): void {
  if (!paddleWorkerProcess && paddleWorkerPendingRequests.size === 0) {
    return;
  }
  resetPaddleWorkerState("应用退出");
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
    return `${message}。已自动尝试关闭 PIR/oneDNN。若仍失败，建议改用 Python 3.10 环境并安装：paddleocr==2.7.3、paddlepaddle==2.6.2。`;
  }
  if (
    lower.includes("no model source is available") ||
    lower.includes("proxyerror") ||
    lower.includes("max retries exceeded") ||
    lower.includes("connecterror")
  ) {
    return `${message}。PaddleOCR 模型下载失败，请确认网络/代理可访问 huggingface、modelscope 或 BOS，或先离线准备模型。`;
  }
  if (lower.includes("import paddleocr failed")) {
    return `${message}。请确认当前 Python 解释器已安装 paddleocr 和 paddlepaddle。`;
  }
  return message;
}

function normalizeNumericToken(raw: string): number | null {
  const normalized = raw
    .replace(/[０-９]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) - 0xff10 + 0x30))
    .replace(/[，、]/g, ",")
    .replace(/[。．]/g, ".")
    .replace(/[,\.\s]/g, "")
    .replace(/[oO〇○]/g, "0")
    .replace(/[lI|!]/g, "1")
    .replace(/[zZ]/g, "2")
    .replace(/[sS$]/g, "5")
    .replace(/[gG]/g, "6")
    .replace(/[bB]/g, "8")
    .replace(/[qQ]/g, "9")
    .replace(/[^0-9]/g, "");
  if (!normalized) {
    return null;
  }
  const num = Number(normalized);
  if (!Number.isFinite(num) || num < 0) {
    return null;
  }
  return Math.floor(num);
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

function parsePriceFromLine(line: string, column: "left" | "right"): number | null {
  const matches = Array.from(line.matchAll(/([0-9０-９oOlI|!sSbB$zZgGqQ〇○][0-9０-９oOlI|!sSbB$zZgGqQ〇○,\.\s，。．、]*)/g)).map(
    (entry) => entry[1] ?? "",
  );
  if (matches.length === 0) {
    return null;
  }
  const picked = column === "right" ? matches[matches.length - 1] : matches[0];
  return normalizeNumericToken(picked);
}

function parseNonEmptyLines(text: string): string[] {
  return text
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function estimateRowCountFromWords(words: OcrTsvWord[]): number | null {
  const effectiveWords = words.filter((word) => sanitizeOcrLineItemName(word.text).trim().length > 0);
  if (effectiveWords.length === 0) {
    return null;
  }
  const points = effectiveWords
    .map((word) => ({
      centerY: word.top + word.height / 2,
      height: Math.max(1, word.height),
    }))
    .sort((left, right) => left.centerY - right.centerY);
  if (points.length === 0) {
    return null;
  }
  const heights = points.map((entry) => entry.height).sort((left, right) => left - right);
  const medianHeight = heights[Math.floor(heights.length / 2)] ?? 1;
  const mergeDistance = Math.max(8, Math.floor(medianHeight * 0.65));

  let clusterCount = 0;
  let clusterCenter = 0;
  points.forEach((entry) => {
    if (clusterCount === 0) {
      clusterCount = 1;
      clusterCenter = entry.centerY;
      return;
    }
    if (Math.abs(entry.centerY - clusterCenter) <= mergeDistance) {
      clusterCenter = (clusterCenter + entry.centerY) / 2;
      return;
    }
    clusterCount += 1;
    clusterCenter = entry.centerY;
  });
  return clamp(clusterCount, 1, 30);
}

function resolveTradeBoardRowCount(
  configuredRowCount: number,
  nameWords: OcrTsvWord[],
  nameRawText: string,
  warnings: string[],
): number {
  if (configuredRowCount > 0) {
    return configuredRowCount;
  }
  const fromWords = estimateRowCountFromWords(nameWords);
  const fallbackLineCount = clamp(parseNonEmptyLines(nameRawText).length, 0, 30);
  const candidates: number[] = [];
  if (fromWords !== null && fromWords > 0) {
    candidates.push(fromWords);
  }
  if (fallbackLineCount > 0) {
    candidates.push(fallbackLineCount);
  }
  const resolved = candidates.length > 0 ? clamp(Math.max(...candidates), 1, 30) : 7;
  warnings.push(
    `交易行可见行数自动识别：${resolved} 行（词框=${fromWords ?? "--"}，文本行=${fallbackLineCount || "--"}）。`,
  );
  return resolved;
}

function groupWordsByRow<T extends OcrTsvWord>(words: T[], rowCount: number, totalHeight: number, startTop = 0): T[][] {
  const buckets: T[][] = Array.from({ length: rowCount }, () => []);
  const rowHeight = totalHeight / rowCount;
  words.forEach((word) => {
    const centerY = word.top + word.height / 2 - startTop;
    const rowIndex = clamp(Math.floor(centerY / Math.max(1, rowHeight)), 0, rowCount - 1);
    buckets[rowIndex].push(word);
  });
  return buckets.map((bucket) => bucket.sort((left, right) => left.left - right.left));
}

function buildNameRowsFromWords(words: OcrTsvWord[], rowCount: number, totalHeight: number): Array<string | null> {
  const rows = groupWordsByRow(words, rowCount, totalHeight);
  return rows.map((row) => {
    const confidentWords = row.filter((word) => word.confidence < 0 || word.confidence >= OCR_TSV_NAME_CONFIDENCE_MIN);
    const effectiveWords = confidentWords.length > 0 ? confidentWords : row;
    const text = effectiveWords
      .map((word) => sanitizeOcrLineItemName(word.text).replace(/\s+/g, ""))
      .filter(Boolean)
      .join("")
      .trim();
    return text || null;
  });
}

function buildPriceRowsFromWords(
  words: OcrTsvWord[],
  rowCount: number,
  column: "left" | "right",
  rowWarnings: string[],
): Array<number | null> {
  const numericWordsRaw = words
    .map((word) => ({
      ...word,
      value: normalizeNumericToken(word.text),
    }))
    .filter((entry): entry is OcrTsvWord & { value: number } => entry.value !== null);
  const confidentNumericWords = numericWordsRaw.filter(
    (entry) => entry.confidence < 0 || entry.confidence >= OCR_TSV_NUMERIC_CONFIDENCE_MIN,
  );
  const numericWords = confidentNumericWords.length > 0 ? confidentNumericWords : numericWordsRaw;
  if (numericWords.length === 0) {
    return Array.from({ length: rowCount }, (_, index) => {
      rowWarnings.push(`第 ${index + 1} 行价格解析失败（词框无数字词）。`);
      return null;
    });
  }

  let minTop = Number.POSITIVE_INFINITY;
  let maxBottom = Number.NEGATIVE_INFINITY;
  numericWords.forEach((word) => {
    minTop = Math.min(minTop, word.top);
    maxBottom = Math.max(maxBottom, word.top + word.height);
  });
  const distributionHeight = Math.max(1, maxBottom - minTop);
  const rowSpanPadding = Math.floor(distributionHeight * 0.06);
  const spanTop = Math.max(0, minTop - rowSpanPadding);
  const spanBottom = maxBottom + rowSpanPadding;
  const rows = groupWordsByRow(numericWords, rowCount, Math.max(1, spanBottom - spanTop), spanTop);
  return rows.map((row, index) => {
    if (row.length === 0) {
      rowWarnings.push(`第 ${index + 1} 行价格解析失败（词框无数字词）。`);
      return null;
    }
    row.sort((left, right) => left.left - right.left);
    const picked = column === "right" ? row[row.length - 1] : row[0];
    return picked.value;
  });
}

function detectTradePriceRoleByHeaderText(rawText: string): "server" | "world" | null {
  const normalized = rawText
    .replace(/\s+/g, "")
    .replace(/[：:]/g, "")
    .toLocaleLowerCase();
  if (!normalized) {
    return null;
  }
  const worldHints = ["世界", "world"];
  const serverHints = ["伺服器", "服务器", "本服", "server"];
  const worldHit = worldHints.some((hint) => normalized.includes(hint));
  const serverHit = serverHints.some((hint) => normalized.includes(hint));

  if (worldHit && serverHit) {
    return null;
  }
  if (worldHit) {
    return "world";
  }
  if (serverHit) {
    return "server";
  }
  return null;
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
    const rowsFromWords = buildPriceRowsFromWords(extract.words, rowCount, column, rowsFromWordsWarnings);
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
      engine: `paddleocr(${extract.language || "auto"})`,
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
    const leftValues = buildPriceRowsFromWords(leftWords, rowCount, "left", leftWarnings);
    const rightValues = buildPriceRowsFromWords(rightWords, rowCount, "left", rightWarnings);
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
        engine: `paddleocr(${extract.language || "auto"}, dual-split)`,
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

export async function extractWorkshopOcrText(payload: WorkshopOcrExtractTextInput): Promise<WorkshopOcrExtractTextResult> {
  const imageRawPath = payload.imagePath?.trim();
  if (!imageRawPath) {
    throw new Error("OCR 识别失败：请先填写截图路径。");
  }
  const imagePath = resolveCatalogImportFilePath(imageRawPath);
  const language = sanitizeOcrLanguage(payload.language);
  const psm = sanitizeOcrPsm(payload.psm);
  const safeMode = sanitizeOcrSafeMode(payload.safeMode);
  const warnings: string[] = [];
  const tradeBoardPreset = sanitizeTradeBoardPreset(payload.tradeBoardPreset);

  if (tradeBoardPreset) {
    let namesTempPath: string | null = null;
    try {
      const namesLanguage = buildPaddleLanguageCandidates(language).join("+");
      const namesScale = 2;
      const pricesScale = 2;
      namesTempPath = cropImageToTempFile(imagePath, tradeBoardPreset.namesRect, namesScale);
      const namesExtract = await runPaddleExtract(namesTempPath, namesLanguage, safeMode);
      if (!namesExtract.ok) {
        throw new Error(`名称区 OCR 失败：${formatPaddleOcrError(namesExtract.errorMessage)}`);
      }
      const effectiveRowCount = resolveTradeBoardRowCount(
        tradeBoardPreset.rowCount,
        namesExtract.words,
        namesExtract.rawText,
        warnings,
      );
      const nameRowsFromTsv = buildNameRowsFromWords(
        namesExtract.words,
        effectiveRowCount,
        Math.floor(tradeBoardPreset.namesRect.height * namesScale),
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
        engine: `paddleocr(names=${namesExtract.language || namesLanguage}, prices=${pricesEngine}, psm=${psm}, trade-board-roi)`,
        tradeRows,
      };
    } finally {
      cleanupTempFile(namesTempPath);
    }
  }

  const primary = await runPaddleExtract(imagePath, language, safeMode);
  if (!primary.ok) {
    throw new Error(
      `PaddleOCR 识别失败：${formatPaddleOcrError(primary.errorMessage)}。请先使用 Python 3.10/3.11 安装：pip install paddleocr paddlepaddle`,
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
    engine: `paddleocr(${primary.language || language}, psm=${psm})`,
  };
}

export function getWorkshopState(): WorkshopState {
  return readWorkshopState();
}

export function upsertWorkshopItem(payload: UpsertWorkshopItemInput): WorkshopState {
  const state = readWorkshopState();
  const nowIso = new Date().toISOString();
  const name = payload.name.trim();
  if (!name) {
    throw new Error("物品名称不能为空。");
  }

  const duplicate = state.items.find(
    (item) => item.id !== payload.id && item.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase(),
  );
  if (duplicate) {
    throw new Error(`物品名称重复: ${duplicate.name}`);
  }

  const category = payload.category ?? "material";
  const existing = payload.id ? state.items.find((item) => item.id === payload.id) : undefined;
  const iconCache = normalizeIconCache(workshopStore.get(WORKSHOP_ICON_CACHE_KEY));
  const resolvedIcon = resolveItemIconWithCache(iconCache, name, category, payload.icon?.trim() || existing?.icon);
  const nextItem: WorkshopItem = existing
    ? {
        ...existing,
        name,
        category,
        icon: resolvedIcon,
        notes: payload.notes?.trim() || undefined,
        updatedAt: nowIso,
      }
    : {
        id: randomUUID(),
        name,
        category,
        icon: resolvedIcon,
        notes: payload.notes?.trim() || undefined,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

  const existingIndex = state.items.findIndex((item) => item.id === nextItem.id);
  const nextItems = [...state.items];
  if (existingIndex >= 0) {
    nextItems[existingIndex] = nextItem;
  } else {
    nextItems.push(nextItem);
  }

  return writeWorkshopState({
    ...state,
    version: WORKSHOP_STATE_VERSION,
    items: nextItems,
  });
}

export function deleteWorkshopItem(itemId: string): WorkshopState {
  const state = readWorkshopState();
  const exists = state.items.some((item) => item.id === itemId);
  if (!exists) {
    return state;
  }

  return writeWorkshopState({
    ...state,
    version: WORKSHOP_STATE_VERSION,
    items: state.items.filter((item) => item.id !== itemId),
    recipes: state.recipes.filter(
      (recipe) => recipe.outputItemId !== itemId && !recipe.inputs.some((input) => input.itemId === itemId),
    ),
    prices: state.prices.filter((price) => price.itemId !== itemId),
    inventory: state.inventory.filter((row) => row.itemId !== itemId),
  });
}

export function upsertWorkshopRecipe(payload: UpsertWorkshopRecipeInput): WorkshopState {
  const state = readWorkshopState();
  ensureItemExists(state, payload.outputItemId);

  const outputQuantity = toPositiveInt(payload.outputQuantity, 0);
  if (outputQuantity <= 0) {
    throw new Error("成品数量必须是正整数。");
  }

  const inputs = normalizeRecipeInputs(payload.inputs);
  if (inputs.length === 0) {
    throw new Error("至少需要一个材料输入。");
  }

  inputs.forEach((input) => ensureItemExists(state, input.itemId));
  if (inputs.some((input) => input.itemId === payload.outputItemId)) {
    throw new Error("配方输入不能包含成品本身。");
  }

  const duplicateOutput = state.recipes.find(
    (recipe) => recipe.id !== payload.id && recipe.outputItemId === payload.outputItemId,
  );
  if (duplicateOutput) {
    throw new Error("同一个成品只允许存在一条配方，请先删除旧配方。");
  }

  const nowIso = new Date().toISOString();
  const nextRecipe: WorkshopRecipe = {
    id: payload.id ?? randomUUID(),
    outputItemId: payload.outputItemId,
    outputQuantity,
    inputs,
    updatedAt: nowIso,
  };

  const existingIndex = state.recipes.findIndex((recipe) => recipe.id === nextRecipe.id);
  const nextRecipes = [...state.recipes];
  if (existingIndex >= 0) {
    nextRecipes[existingIndex] = nextRecipe;
  } else {
    nextRecipes.push(nextRecipe);
  }

  return writeWorkshopState({
    ...state,
    version: WORKSHOP_STATE_VERSION,
    recipes: nextRecipes,
  });
}

export function deleteWorkshopRecipe(recipeId: string): WorkshopState {
  const state = readWorkshopState();
  if (!state.recipes.some((recipe) => recipe.id === recipeId)) {
    return state;
  }
  return writeWorkshopState({
    ...state,
    version: WORKSHOP_STATE_VERSION,
    recipes: state.recipes.filter((recipe) => recipe.id !== recipeId),
  });
}

export function addWorkshopPriceSnapshot(payload: AddWorkshopPriceSnapshotInput): WorkshopState {
  const state = readWorkshopState();
  ensureItemExists(state, payload.itemId);
  const unitPrice = toNonNegativeInt(payload.unitPrice, -1);
  if (unitPrice <= 0) {
    throw new Error("价格必须是大于 0 的整数。");
  }

  const capturedAt = payload.capturedAt ? asIso(payload.capturedAt, new Date().toISOString()) : new Date().toISOString();
  const source = payload.source === "import" ? "import" : "manual";
  const market = sanitizePriceMarket(payload.market);
  const baselinePrices = collectBaselinePricesForItem(state.prices, payload.itemId, market, capturedAt);
  const anomaly = assessPriceAnomaly(unitPrice, baselinePrices);
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

export function importWorkshopOcrPrices(payload: WorkshopOcrPriceImportInput): WorkshopOcrPriceImportResult {
  const state = readWorkshopState();
  const sanitized = sanitizeOcrImportPayload(payload);
  const hasStructuredTradeRows = Array.isArray(sanitized.tradeRows) && sanitized.tradeRows.length > 0;
  if (!sanitized.text.trim() && !hasStructuredTradeRows) {
    throw new Error("OCR 导入内容为空，请先粘贴文本。");
  }

  const tradeRowsParsed = parseOcrTradeRows(sanitized.tradeRows);
  const parsedFromTradeRows = hasStructuredTradeRows;
  const { parsedLines, invalidLines } = parsedFromTradeRows ? tradeRowsParsed : parseOcrPriceLines(sanitized.text);
  const items = [...state.items];
  const prices = [...state.prices];
  const iconCache = normalizeIconCache(workshopStore.get(WORKSHOP_ICON_CACHE_KEY));
  const itemByLookupName = new Map<string, WorkshopItem>();
  items.forEach((item) => {
    itemByLookupName.set(normalizeLookupName(item.name), item);
  });
  const expectedIconByLineNumber = sanitized.iconCapture ? buildExpectedIconByLineNumber(parsedLines, itemByLookupName) : undefined;
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

  parsedLines.forEach((line) => {
    const correctedLineName = tryCorrectOcrNameByKnownItems(line.itemName, items);
    const normalizedLineName = correctedLineName || line.itemName;
    if (normalizedLineName !== line.itemName && nameCorrectionWarnings.length < 20) {
      nameCorrectionWarnings.push(`名称纠错：${line.itemName} -> ${normalizedLineName}`);
    }
    if (!Number.isFinite(line.unitPrice) || line.unitPrice <= 0) {
      if (priceQualityWarnings.length < 40) {
        priceQualityWarnings.push(`第 ${line.lineNumber} 行「${normalizedLineName}」已跳过：价格无效（${line.unitPrice}）。`);
      }
      return;
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
      return;
    }

    if (sanitized.strictIconMatch) {
      if (!capturedIcon) {
        const canFallbackByExactName =
          item !== undefined && !isCapturedImageIcon(item.icon) && isExactOcrNameMatch(item, normalizedLineName);
        if (!canFallbackByExactName) {
          unknownItemNameSet.add(`${normalizedLineName}（严格模式需开启图标抓取）`);
          return;
        }
      }
      if (!item && iconMatchedItem) {
        item = iconMatchedItem;
        itemByLookupName.set(key, item);
      }
      if (item && iconMatchedItem && item.id !== iconMatchedItem.id) {
        unknownItemNameSet.add(`${normalizedLineName}（名称与图标冲突）`);
        return;
      }
      if (item && capturedIcon && isCapturedImageIcon(item.icon) && item.icon !== capturedIcon) {
        unknownItemNameSet.add(`${normalizedLineName}（图标不匹配）`);
        return;
      }
      if (item && !isCapturedImageIcon(item.icon) && !isExactOcrNameMatch(item, normalizedLineName)) {
        unknownItemNameSet.add(`${normalizedLineName}（严格模式缺少图标基线）`);
        return;
      }
      if (item && !isExactOcrNameMatch(item, normalizedLineName) && !iconMatchedItem) {
        unknownItemNameSet.add(`${normalizedLineName}（严格模式下名称不精确）`);
        return;
      }
    } else {
      if (item && iconMatchedItem && item.id !== iconMatchedItem.id) {
        unknownItemNameSet.add(`${normalizedLineName}（名称与图标冲突）`);
        return;
      }
      if (!item && iconMatchedItem) {
        item = iconMatchedItem;
        itemByLookupName.set(key, item);
      }
      // Only block fuzzy/heuristic matches; exact key matches should be trusted.
      if (item && !matchedByExactName && !iconMatchedItem && isAmbiguousExactOcrNameMatch(item, normalizedLineName, items)) {
        unknownItemNameSet.add(`${normalizedLineName}（名称歧义，已跳过）`);
        return;
      }
    }

    let createdItem = false;
    if (!item) {
      if (!sanitized.autoCreateMissingItems) {
        unknownItemNameSet.add(normalizedLineName);
        return;
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
        return;
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
    const anomaly = assessPriceAnomaly(line.unitPrice, anomalyBaseline);
    if (anomaly.kind === "hard") {
      unknownItemNameSet.add(`${normalizedLineName}（价格异常偏离，已自动过滤）`);
      if (priceQualityWarnings.length < 40) {
        priceQualityWarnings.push(`第 ${line.lineNumber} 行「${normalizedLineName}」已跳过：${formatAnomalyReason(anomaly)}`);
      }
      return;
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
      return;
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
  });

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

function resolveCatalogImportFilePath(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("导入文件路径不能为空。");
  }
  if (path.isAbsolute(trimmed) && fs.existsSync(trimmed)) {
    return trimmed;
  }
  const candidates = [
    path.resolve(process.cwd(), trimmed),
    path.resolve(process.cwd(), path.basename(trimmed)),
  ];
  const hit = candidates.find((entry) => fs.existsSync(entry));
  if (!hit) {
    throw new Error(`未找到导入文件: ${trimmed}`);
  }
  return hit;
}

function resolveBuiltinCatalogFilePath(): string {
  const candidates = [
    path.resolve(process.cwd(), BUILTIN_CATALOG_FILE_NAME),
    path.resolve(process.cwd(), "..", BUILTIN_CATALOG_FILE_NAME),
    path.resolve(process.cwd(), "..", "..", BUILTIN_CATALOG_FILE_NAME),
  ];
  const hit = candidates.find((entry) => fs.existsSync(entry));
  if (!hit) {
    throw new Error(`未找到内置目录文件: ${BUILTIN_CATALOG_FILE_NAME}`);
  }
  return hit;
}

function resolveBuiltinCatalogSignature(): string {
  const filePath = resolveBuiltinCatalogFilePath();
  const text = fs.readFileSync(filePath, "utf8");
  return createHash("sha1").update(text).digest("hex");
}

function applyCatalogData(
  baseState: WorkshopState,
  parsed: { items: CatalogItemRow[]; recipes: CatalogRecipeRow[]; warnings: string[] },
  sourceTag: string,
): WorkshopCatalogImportResult {
  const nowIso = new Date().toISOString();
  const items = [...baseState.items];
  const iconCache = normalizeIconCache(workshopStore.get(WORKSHOP_ICON_CACHE_KEY));
  const itemByLookup = new Map<string, WorkshopItem>();
  items.forEach((item) => {
    itemByLookup.set(normalizeCatalogLookupName(item.name), item);
  });

  let importedItemCount = 0;
  let createdImplicitItemCount = 0;

  const ensureItemByName = (
    itemName: string,
    fallbackCategory: WorkshopItemCategory,
    mainCategory?: string,
  ): WorkshopItem => {
    const normalized = normalizeCatalogItemName(itemName);
    const key = normalizeCatalogLookupName(normalized);
    const existing = itemByLookup.get(key);
    if (existing) {
      return existing;
    }
    const normalizedMainCategory = mainCategory ? normalizeCatalogMainCategory(mainCategory) : "";
    const note = normalizedMainCategory
      ? `來源: ${sourceTag}; 大類: ${normalizedMainCategory}; 分類: 隱式`
      : `來源: ${sourceTag}; 分類: 隱式`;
    const created: WorkshopItem = {
      id: randomUUID(),
      name: normalized,
      category: fallbackCategory,
      icon: resolveItemIconWithCache(iconCache, normalized, fallbackCategory),
      notes: note,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    items.push(created);
    itemByLookup.set(key, created);
    createdImplicitItemCount += 1;
    return created;
  };

  parsed.items.forEach((row) => {
    const key = normalizeCatalogLookupName(row.name);
    const mappedCategory = mapCatalogCategory(row.rawCategory);
    const normalizedMainCategory = row.mainCategory ? normalizeCatalogMainCategory(row.mainCategory) : "";
    const mainCategoryNote = normalizedMainCategory ? `; 大類: ${normalizedMainCategory}` : "";
    const note =
      row.alias
        ? `來源: ${sourceTag}${mainCategoryNote}; 分類: ${row.rawCategory}; 別名: ${row.alias}`
        : `來源: ${sourceTag}${mainCategoryNote}; 分類: ${row.rawCategory}`;
    const existing = itemByLookup.get(key);
    if (existing) {
      const shouldRefreshNote = !existing.notes || existing.notes.includes("來源:");
      const resolvedIcon = resolveItemIconWithCache(iconCache, existing.name, mappedCategory, existing.icon);
      const nextExisting: WorkshopItem = {
        ...existing,
        category: mappedCategory,
        icon: resolvedIcon,
        notes: shouldRefreshNote ? note : existing.notes,
        updatedAt: nowIso,
      };
      const index = items.findIndex((item) => item.id === existing.id);
      if (index >= 0) {
        items[index] = nextExisting;
      }
      itemByLookup.set(key, nextExisting);
      cacheIconByName(iconCache, row.name, resolvedIcon);
      if (row.alias) {
        cacheIconByName(iconCache, row.alias, resolvedIcon);
      }
      importedItemCount += 1;
      return;
    }
    const createdIcon = resolveItemIconWithCache(iconCache, row.name, mappedCategory);
    const created: WorkshopItem = {
      id: randomUUID(),
      name: row.name,
      category: mappedCategory,
      icon: createdIcon,
      notes: note,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    items.push(created);
    itemByLookup.set(key, created);
    if (row.alias) {
      cacheIconByName(iconCache, row.alias, createdIcon);
    }
    importedItemCount += 1;
  });

  let importedRecipeCount = 0;
  let skippedRecipeCount = 0;
  const warnings = [...parsed.warnings];
  const nextRecipes = [...baseState.recipes];
  const touchedOutputItemIds = new Set<string>();
  const touchedOutputItemOrder: string[] = [];

  parsed.recipes.forEach((recipeRow) => {
    const outputItem = ensureItemByName(recipeRow.outputName, "equipment", recipeRow.mainCategory);
    if (touchedOutputItemIds.has(outputItem.id)) {
      skippedRecipeCount += 1;
      warnings.push(`重复产物配方已跳过: ${recipeRow.outputName}`);
      return;
    }
    touchedOutputItemIds.add(outputItem.id);
    touchedOutputItemOrder.push(outputItem.id);

    const inputRows = recipeRow.inputs
      .map((input) => {
        const inputItem = ensureItemByName(input.itemId, "component");
        return {
          itemId: inputItem.id,
          quantity: input.quantity,
        };
      })
      .filter((entry) => entry.quantity > 0);

    const dedupInputMap = new Map<string, number>();
    inputRows.forEach((entry) => {
      dedupInputMap.set(entry.itemId, (dedupInputMap.get(entry.itemId) ?? 0) + entry.quantity);
    });
    const dedupInputs = Array.from(dedupInputMap.entries())
      .map(([itemId, quantity]) => ({ itemId, quantity: Math.max(1, Math.floor(quantity)) }))
      .sort((left, right) => left.itemId.localeCompare(right.itemId));
    if (dedupInputs.length === 0) {
      skippedRecipeCount += 1;
      warnings.push(`配方材料为空已跳过: ${recipeRow.outputName}`);
      return;
    }

    const existingIndex = nextRecipes.findIndex((entry) => entry.outputItemId === outputItem.id);
    if (existingIndex >= 0) {
      nextRecipes[existingIndex] = {
        ...nextRecipes[existingIndex],
        outputQuantity: Math.max(1, Math.floor(recipeRow.outputQuantity)),
        inputs: dedupInputs,
        updatedAt: nowIso,
      };
    } else {
      nextRecipes.push({
        id: randomUUID(),
        outputItemId: outputItem.id,
        outputQuantity: Math.max(1, Math.floor(recipeRow.outputQuantity)),
        inputs: dedupInputs,
        updatedAt: nowIso,
      });
    }
    importedRecipeCount += 1;
  });

  const touchedOrderByOutputItemId = new Map<string, number>();
  touchedOutputItemOrder.forEach((itemId, index) => {
    touchedOrderByOutputItemId.set(itemId, index);
  });
  const orderedTouchedRecipes = nextRecipes
    .filter((recipe) => touchedOrderByOutputItemId.has(recipe.outputItemId))
    .sort(
      (left, right) =>
        (touchedOrderByOutputItemId.get(left.outputItemId) ?? Number.MAX_SAFE_INTEGER) -
        (touchedOrderByOutputItemId.get(right.outputItemId) ?? Number.MAX_SAFE_INTEGER),
    );
  const orderedUntouchedRecipes = nextRecipes.filter((recipe) => !touchedOrderByOutputItemId.has(recipe.outputItemId));
  const orderedRecipes = [...orderedTouchedRecipes, ...orderedUntouchedRecipes];

  const nextState = normalizeWorkshopState({
    ...baseState,
    version: WORKSHOP_STATE_VERSION,
    items,
    recipes: orderedRecipes,
  });

  return {
    state: nextState,
    importedItemCount,
    importedRecipeCount,
    createdImplicitItemCount,
    skippedRecipeCount,
    warnings,
  };
}

function buildBuiltinCatalogState(): WorkshopState {
  const filePath = resolveBuiltinCatalogFilePath();
  const text = fs.readFileSync(filePath, "utf8");
  const parsed = parseCatalogCsvText(text);
  const baseState: WorkshopState = {
    version: WORKSHOP_STATE_VERSION,
    items: [],
    recipes: [],
    prices: [],
    inventory: [],
    signalRule: DEFAULT_WORKSHOP_SIGNAL_RULE,
  };
  const result = applyCatalogData(baseState, parsed, path.basename(filePath));
  if (result.state.items.length === 0 || result.state.recipes.length === 0) {
    throw new Error(`内置目录解析失败: ${filePath}`);
  }
  return result.state;
}

export function importWorkshopCatalogFromFile(payload: WorkshopCatalogImportFromFileInput): WorkshopCatalogImportResult {
  const state = readWorkshopState();
  const fullPath = resolveCatalogImportFilePath(payload.filePath);
  const text = fs.readFileSync(fullPath, "utf8");
  const parsed = parseCatalogCsvText(text);
  const result = applyCatalogData(state, parsed, path.basename(fullPath));
  return {
    ...result,
    state: writeWorkshopState(result.state),
  };
}

export function upsertWorkshopInventory(payload: UpsertWorkshopInventoryInput): WorkshopState {
  const state = readWorkshopState();
  ensureItemExists(state, payload.itemId);

  const quantity = toNonNegativeInt(payload.quantity, -1);
  if (quantity < 0) {
    throw new Error("库存必须是大于等于 0 的整数。");
  }

  const nextInventory =
    quantity === 0
      ? state.inventory.filter((row) => row.itemId !== payload.itemId)
      : [
          ...state.inventory.filter((row) => row.itemId !== payload.itemId),
          {
            itemId: payload.itemId,
            quantity,
            updatedAt: new Date().toISOString(),
          },
        ].sort((left, right) => left.itemId.localeCompare(right.itemId));

  return writeWorkshopState({
    ...state,
    version: WORKSHOP_STATE_VERSION,
    inventory: nextInventory,
  });
}

export function simulateWorkshopCraft(payload: WorkshopCraftSimulationInput): WorkshopCraftSimulationResult {
  const state = readWorkshopState();
  const recipe = state.recipes.find((entry) => entry.id === payload.recipeId);
  if (!recipe) {
    throw new Error("未找到目标配方。");
  }
  const runs = toPositiveInt(payload.runs, 0);
  if (runs <= 0) {
    throw new Error("制作次数必须是正整数。");
  }
  const taxRate = sanitizeTaxRate(payload.taxRate);
  const materialMode = payload.materialMode === "expanded" ? "expanded" : "direct";
  return buildSimulation(state, recipe, runs, taxRate, materialMode);
}

export function getWorkshopCraftOptions(payload?: { taxRate?: number }): WorkshopCraftOption[] {
  const state = readWorkshopState();
  const taxRate = sanitizeTaxRate(payload?.taxRate);
  const inventoryByItemId = new Map(state.inventory.map((entry) => [entry.itemId, entry.quantity]));

  const options = state.recipes.map((recipe) => {
    // Reverse suggestion should reflect direct recipe inputs (not expanded sub-recipes),
    // so missing/unknown material hints stay aligned with what players see in the recipe.
    const simulation = buildSimulation(state, recipe, 1, taxRate, "direct");
    const craftableCountFromInventory =
      simulation.materialRows.length === 0
        ? 0
        : simulation.materialRows.reduce((acc, row) => {
            if (row.required <= 0) {
              return acc;
            }
            const owned = inventoryByItemId.get(row.itemId) ?? 0;
            return Math.min(acc, Math.floor(owned / row.required));
          }, Number.MAX_SAFE_INTEGER);

    const craftableCount = Number.isFinite(craftableCountFromInventory) ? Math.max(0, craftableCountFromInventory) : 0;
    return {
      recipeId: recipe.id,
      outputItemId: recipe.outputItemId,
      outputItemName: simulation.outputItemName,
      craftableCount,
      requiredMaterialCostPerRun: simulation.requiredMaterialCost,
      estimatedProfitPerRun: simulation.estimatedProfit,
      unknownPriceItemIds: simulation.unknownPriceItemIds,
      materialRowsForOneRun: simulation.materialRows,
      missingRowsForOneRun: simulation.materialRows.filter((row) => row.missing > 0),
    };
  });

  return options.sort((left, right) => {
    if (right.craftableCount !== left.craftableCount) {
      return right.craftableCount - left.craftableCount;
    }
    const rightProfit = right.estimatedProfitPerRun ?? Number.NEGATIVE_INFINITY;
    const leftProfit = left.estimatedProfitPerRun ?? Number.NEGATIVE_INFINITY;
    if (rightProfit !== leftProfit) {
      return rightProfit - leftProfit;
    }
    return left.outputItemName.localeCompare(right.outputItemName, "zh-CN");
  });
}

export function getWorkshopPriceHistory(payload: WorkshopPriceHistoryQuery): WorkshopPriceHistoryResult {
  const state = readWorkshopState();
  ensureItemExists(state, payload.itemId);
  return buildWorkshopPriceHistoryResult(state, payload);
}

export function updateWorkshopSignalRule(payload: Partial<WorkshopPriceSignalRule>): WorkshopState {
  const state = readWorkshopState();
  const nextRule: WorkshopPriceSignalRule = {
    enabled: typeof payload.enabled === "boolean" ? payload.enabled : state.signalRule.enabled,
    lookbackDays:
      payload.lookbackDays === undefined ? state.signalRule.lookbackDays : sanitizeLookbackDays(payload.lookbackDays),
    dropBelowWeekdayAverageRatio:
      payload.dropBelowWeekdayAverageRatio === undefined
        ? state.signalRule.dropBelowWeekdayAverageRatio
        : sanitizeSignalThresholdRatio(payload.dropBelowWeekdayAverageRatio),
  };

  return writeWorkshopState({
    ...state,
    version: WORKSHOP_STATE_VERSION,
    signalRule: nextRule,
  });
}

export function getWorkshopPriceSignals(payload?: WorkshopPriceSignalQuery): WorkshopPriceSignalResult {
  const state = readWorkshopState();
  const lookbackDays = payload?.lookbackDays === undefined ? state.signalRule.lookbackDays : sanitizeLookbackDays(payload.lookbackDays);
  const thresholdRatio =
    payload?.thresholdRatio === undefined
      ? state.signalRule.dropBelowWeekdayAverageRatio
      : sanitizeSignalThresholdRatio(payload.thresholdRatio);
  const targetMarket = payload?.market === undefined ? undefined : sanitizePriceMarket(payload.market);
  const effectiveThresholdRatio = sanitizeSignalThresholdRatio(thresholdRatio);
  const rows: WorkshopPriceSignalRow[] = state.items.map((item) => {
    const history = buildWorkshopPriceHistoryResult(state, {
      itemId: item.id,
      days: lookbackDays,
      market: targetMarket,
    });
    const latestPoint = history.points[history.points.length - 1] ?? null;
    const latestWeekday = latestPoint?.weekday ?? null;
    const weekdayAveragePrice =
      latestWeekday === null ? null : history.weekdayAverages.find((entry) => entry.weekday === latestWeekday)?.averagePrice ?? null;
    const deviationRatioFromWeekdayAverage =
      history.latestPrice === null || weekdayAveragePrice === null || weekdayAveragePrice <= 0
        ? null
        : (history.latestPrice - weekdayAveragePrice) / weekdayAveragePrice;
    const deviationRatioFromMa7 =
      history.latestPrice === null || history.ma7Latest === null || history.ma7Latest <= 0
        ? null
        : (history.latestPrice - history.ma7Latest) / history.ma7Latest;
    const assessment = resolvePriceTrendAssessment(
      history.sampleCount,
      deviationRatioFromWeekdayAverage,
      deviationRatioFromMa7,
      effectiveThresholdRatio,
    );
    const triggered = state.signalRule.enabled && assessment.trendTag === "buy-zone";

    return {
      itemId: item.id,
      itemName: item.name,
      market: targetMarket,
      latestPrice: history.latestPrice,
      latestCapturedAt: history.latestCapturedAt,
      latestWeekday,
      weekdayAveragePrice,
      deviationRatioFromWeekdayAverage,
      ma7Price: history.ma7Latest,
      deviationRatioFromMa7,
      effectiveThresholdRatio,
      trendTag: assessment.trendTag,
      confidenceScore: assessment.confidenceScore,
      reasons: assessment.reasons,
      sampleCount: history.sampleCount,
      triggered,
    };
  });

  rows.sort((left, right) => {
    if (left.triggered !== right.triggered) {
      return left.triggered ? -1 : 1;
    }
    const leftTrendRank = left.trendTag === "buy-zone" ? 0 : left.trendTag === "sell-zone" ? 1 : 2;
    const rightTrendRank = right.trendTag === "buy-zone" ? 0 : right.trendTag === "sell-zone" ? 1 : 2;
    if (leftTrendRank !== rightTrendRank) {
      return leftTrendRank - rightTrendRank;
    }
    if (left.confidenceScore !== right.confidenceScore) {
      return right.confidenceScore - left.confidenceScore;
    }
    const leftDeviation = left.deviationRatioFromWeekdayAverage;
    const rightDeviation = right.deviationRatioFromWeekdayAverage;
    if (leftDeviation !== null && rightDeviation !== null && leftDeviation !== rightDeviation) {
      if (left.trendTag === "sell-zone" && right.trendTag === "sell-zone") {
        return rightDeviation - leftDeviation;
      }
      return leftDeviation - rightDeviation;
    }
    if (leftDeviation === null && rightDeviation !== null) {
      return 1;
    }
    if (leftDeviation !== null && rightDeviation === null) {
      return -1;
    }
    if (right.sampleCount !== left.sampleCount) {
      return right.sampleCount - left.sampleCount;
    }
    return left.itemName.localeCompare(right.itemName, "zh-CN");
  });

  return {
    generatedAt: new Date().toISOString(),
    market: targetMarket,
    lookbackDays,
    thresholdRatio,
    effectiveThresholdRatio,
    ruleEnabled: state.signalRule.enabled,
    triggeredCount: rows.filter((row) => row.triggered).length,
    buyZoneCount: rows.filter((row) => row.trendTag === "buy-zone").length,
    sellZoneCount: rows.filter((row) => row.trendTag === "sell-zone").length,
    rows,
  };
}

export function seedWorkshopSampleData(): WorkshopState {
  const state = readWorkshopState();
  const nowIso = new Date().toISOString();

  const byName = new Map(state.items.map((item) => [item.name, item] as const));
  const items = [...state.items];

  const ensureSampleItem = (seed: WorkshopSampleItemSeed): WorkshopItem => {
    const existing = byName.get(seed.name);
    if (existing) {
      const nextExisting: WorkshopItem = {
        ...existing,
        category: seed.category,
        notes: seed.notes ?? existing.notes,
        updatedAt: nowIso,
      };
      const index = items.findIndex((item) => item.id === existing.id);
      if (index >= 0) {
        items[index] = nextExisting;
      }
      byName.set(seed.name, nextExisting);
      return nextExisting;
    }

    const nextItem: WorkshopItem = {
      id: randomUUID(),
      name: seed.name,
      category: seed.category,
      notes: seed.notes,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    items.push(nextItem);
    byName.set(seed.name, nextItem);
    return nextItem;
  };

  WORKSHOP_SAMPLE_ITEMS.forEach((seed) => {
    ensureSampleItem(seed);
  });

  const sampleItemIdByName = new Map<string, string>();
  WORKSHOP_SAMPLE_ITEMS.forEach((seed) => {
    const item = byName.get(seed.name);
    if (!item) {
      throw new Error(`样例物品创建失败: ${seed.name}`);
    }
    sampleItemIdByName.set(seed.name, item.id);
  });

  const recipeByOutputItemId = new Map(state.recipes.map((recipe) => [recipe.outputItemId, recipe] as const));
  const nextRecipes = [...state.recipes];
  WORKSHOP_SAMPLE_RECIPES.forEach((seed) => {
    const outputItemId = sampleItemIdByName.get(seed.outputName);
    if (!outputItemId) {
      return;
    }
    const inputs = seed.inputs
      .map((inputSeed) => {
        const inputItemId = sampleItemIdByName.get(inputSeed.inputName);
        if (!inputItemId) {
          return null;
        }
        return {
          itemId: inputItemId,
          quantity: inputSeed.quantity,
        };
      })
      .filter((entry): entry is WorkshopRecipeInput => entry !== null);
    if (inputs.length === 0) {
      return;
    }

    const existing = recipeByOutputItemId.get(outputItemId);
    if (existing) {
      const index = nextRecipes.findIndex((recipe) => recipe.id === existing.id);
      const nextRecipe: WorkshopRecipe = {
        ...existing,
        outputQuantity: seed.outputQuantity,
        inputs: normalizeRecipeInputs(inputs),
        updatedAt: nowIso,
      };
      if (index >= 0) {
        nextRecipes[index] = nextRecipe;
      }
      recipeByOutputItemId.set(outputItemId, nextRecipe);
      return;
    }

    const created: WorkshopRecipe = {
      id: randomUUID(),
      outputItemId,
      outputQuantity: seed.outputQuantity,
      inputs: normalizeRecipeInputs(inputs),
      updatedAt: nowIso,
    };
    nextRecipes.push(created);
    recipeByOutputItemId.set(outputItemId, created);
  });

  const nextPrices = [...state.prices];
  const latestPriceMap = getLatestPriceMap({
    ...state,
    items,
    recipes: nextRecipes,
    prices: nextPrices,
    inventory: state.inventory,
  });
  WORKSHOP_SAMPLE_PRICES.forEach((seed) => {
    const itemId = sampleItemIdByName.get(seed.itemName);
    if (!itemId) {
      return;
    }
    const latest = latestPriceMap.get(itemId);
    if (latest && latest.unitPrice === seed.unitPrice) {
      return;
    }
    const snapshot: WorkshopPriceSnapshot = {
      id: randomUUID(),
      itemId,
      unitPrice: seed.unitPrice,
      capturedAt: nowIso,
      source: "manual",
      note: "phase1.1-sample-seed",
    };
    nextPrices.push(snapshot);
    latestPriceMap.set(itemId, snapshot);
  });

  const inventoryByItemId = new Map(state.inventory.map((entry) => [entry.itemId, entry] as const));
  WORKSHOP_SAMPLE_INVENTORY.forEach((seed) => {
    const itemId = sampleItemIdByName.get(seed.itemName);
    if (!itemId) {
      return;
    }
    inventoryByItemId.set(itemId, {
      itemId,
      quantity: Math.max(0, Math.floor(seed.quantity)),
      updatedAt: nowIso,
    });
  });

  return writeWorkshopState({
    version: WORKSHOP_STATE_VERSION,
    items,
    recipes: nextRecipes,
    prices: nextPrices.slice(-WORKSHOP_PRICE_HISTORY_LIMIT),
    inventory: Array.from(inventoryByItemId.values()).sort((left, right) => left.itemId.localeCompare(right.itemId)),
    signalRule: state.signalRule,
  });
}
