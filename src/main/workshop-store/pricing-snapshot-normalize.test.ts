import { describe, expect, it } from "vitest";
import { normalizePriceSnapshot, sanitizePriceMarket } from "./pricing-snapshot-normalize";

describe("workshop/pricing-snapshot-normalize", () => {
  it("sanitizes market to known values", () => {
    expect(sanitizePriceMarket("server")).toBe("server");
    expect(sanitizePriceMarket("world")).toBe("world");
    expect(sanitizePriceMarket("single")).toBe("single");
    expect(sanitizePriceMarket("unknown")).toBe("single");
    expect(sanitizePriceMarket(undefined)).toBe("single");
  });

  it("normalizes snapshot payload with sanitized source/market/note", () => {
    const snapshot = normalizePriceSnapshot(
      {
        id: "row-1",
        itemId: "item-1",
        unitPrice: 123.9,
        capturedAt: "invalid-date",
        source: "whatever",
        market: "bad-market",
        note: "  qa note  ",
      },
      {
        asIso: (_raw, fallback) => fallback,
        toNonNegativeInt: (raw, fallback) =>
          typeof raw === "number" && Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : fallback,
      },
    );

    expect(snapshot).not.toBeNull();
    expect(snapshot?.id).toBe("row-1");
    expect(snapshot?.itemId).toBe("item-1");
    expect(snapshot?.unitPrice).toBe(123);
    expect(snapshot?.source).toBe("manual");
    expect(snapshot?.market).toBe("single");
    expect(snapshot?.note).toBe("qa note");
  });

  it("returns null for invalid price snapshot payloads", () => {
    const deps = {
      asIso: (_raw: unknown, fallback: string) => fallback,
      toNonNegativeInt: (raw: unknown, fallback: number) =>
        typeof raw === "number" && Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : fallback,
    };

    expect(normalizePriceSnapshot(null, deps)).toBeNull();
    expect(normalizePriceSnapshot({ id: "a", unitPrice: 100 }, deps)).toBeNull();
    expect(normalizePriceSnapshot({ id: "a", itemId: "item-1", unitPrice: 0 }, deps)).toBeNull();
  });
});
