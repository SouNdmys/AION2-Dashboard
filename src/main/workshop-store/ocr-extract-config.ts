const WORKSHOP_OCR_DEFAULT_LANGUAGE = "chi_tra";
const WORKSHOP_OCR_DEFAULT_PSM = 6;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function sanitizeOcrLanguage(raw: unknown): string {
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

export function sanitizeOcrPsm(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return WORKSHOP_OCR_DEFAULT_PSM;
  }
  return clamp(Math.floor(raw), 3, 13);
}

export function sanitizeOcrSafeMode(raw: unknown): boolean {
  return raw !== false;
}

export function buildPaddleLanguageCandidates(language: string): string[] {
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
