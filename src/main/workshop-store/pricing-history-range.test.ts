import { describe, expect, it } from "vitest";
import { resolveHistoryRange } from "./pricing-history-range";

describe("workshop/pricing-history-range", () => {
  it("resolves explicit from/to range", () => {
    const fromAt = "2026-02-01T00:00:00.000Z";
    const toAt = "2026-02-10T00:00:00.000Z";
    const range = resolveHistoryRange({
      itemId: "item-1",
      fromAt,
      toAt,
    });
    expect(range.from.toISOString()).toBe(fromAt);
    expect(range.to.toISOString()).toBe(toAt);
  });

  it("builds range by lookback days when fromAt is omitted", () => {
    const toAt = "2026-02-10T00:00:00.000Z";
    const range = resolveHistoryRange({
      itemId: "item-1",
      toAt,
      days: 7,
    });
    expect(range.to.toISOString()).toBe(toAt);
    expect(range.from.toISOString()).toBe("2026-02-03T00:00:00.000Z");
  });

  it("throws on invalid date payloads", () => {
    expect(() =>
      resolveHistoryRange({
        itemId: "item-1",
        fromAt: "invalid-date",
      }),
    ).toThrow("fromAt 不是有效时间格式。");
    expect(() =>
      resolveHistoryRange({
        itemId: "item-1",
        toAt: "invalid-date",
      }),
    ).toThrow("toAt 不是有效时间格式。");
  });

  it("throws when fromAt is later than toAt", () => {
    expect(() =>
      resolveHistoryRange({
        itemId: "item-1",
        fromAt: "2026-02-11T00:00:00.000Z",
        toAt: "2026-02-10T00:00:00.000Z",
      }),
    ).toThrow("时间范围无效：fromAt 不能晚于 toAt。");
  });
});
