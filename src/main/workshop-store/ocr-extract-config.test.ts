import { describe, expect, it } from "vitest";
import {
  buildPaddleLanguageCandidates,
  sanitizeOcrLanguage,
  sanitizeOcrPsm,
  sanitizeOcrSafeMode,
} from "./ocr-extract-config";

describe("workshop/ocr-extract-config", () => {
  it("sanitizeOcrLanguage falls back to default for invalid values", () => {
    expect(sanitizeOcrLanguage(undefined)).toBe("chi_tra");
    expect(sanitizeOcrLanguage("")).toBe("chi_tra");
    expect(sanitizeOcrLanguage("bad language")).toBe("chi_tra");
  });

  it("sanitizeOcrPsm clamps into supported range", () => {
    expect(sanitizeOcrPsm(undefined)).toBe(6);
    expect(sanitizeOcrPsm(1)).toBe(3);
    expect(sanitizeOcrPsm(99)).toBe(13);
    expect(sanitizeOcrPsm(7.9)).toBe(7);
  });

  it("sanitizeOcrSafeMode only disables when explicitly false", () => {
    expect(sanitizeOcrSafeMode(undefined)).toBe(true);
    expect(sanitizeOcrSafeMode(true)).toBe(true);
    expect(sanitizeOcrSafeMode(false)).toBe(false);
  });

  it("buildPaddleLanguageCandidates includes fallback languages", () => {
    const candidates = buildPaddleLanguageCandidates("chi_tra+eng");
    expect(candidates).toContain("chinese_cht");
    expect(candidates).toContain("ch");
    expect(candidates).toContain("en");
  });
});
