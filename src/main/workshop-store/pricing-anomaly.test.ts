import { describe, expect, it } from "vitest";
import type { WorkshopPriceSnapshot } from "../../shared/types";
import {
  WORKSHOP_PRICE_NOTE_TAG_HARD,
  WORKSHOP_PRICE_NOTE_TAG_SUSPECT,
  appendNoteTag,
  assessPriceAnomalyWithCategory,
  collectBaselinePricesForItem,
  formatAnomalyReason,
  resolveSnapshotQualityTag,
} from "./pricing-anomaly";

function buildSnapshot(partial: Partial<WorkshopPriceSnapshot> & Pick<WorkshopPriceSnapshot, "id">): WorkshopPriceSnapshot {
  return {
    id: partial.id,
    itemId: partial.itemId ?? "item-1",
    unitPrice: partial.unitPrice ?? 100,
    capturedAt: partial.capturedAt ?? new Date("2026-02-20T12:00:00.000Z").toISOString(),
    source: partial.source ?? "import",
    market: partial.market,
    note: partial.note,
  };
}

describe("workshop/pricing-anomaly", () => {
  it("appends note tags without duplication and resolves quality tags", () => {
    const tagged = appendNoteTag("ocr-import#line-1", WORKSHOP_PRICE_NOTE_TAG_SUSPECT);
    expect(tagged).toBe(`ocr-import#line-1;${WORKSHOP_PRICE_NOTE_TAG_SUSPECT}`);
    expect(appendNoteTag(tagged, WORKSHOP_PRICE_NOTE_TAG_SUSPECT)).toBe(tagged);

    const hardQuality = resolveSnapshotQualityTag(`foo;${WORKSHOP_PRICE_NOTE_TAG_HARD}`);
    expect(hardQuality.isSuspect).toBe(true);
    expect(hardQuality.reason).toContain("极端异常价");
  });

  it("collects baseline prices by market, quality, and 30-day window", () => {
    const capturedAt = new Date("2026-02-20T12:00:00.000Z").toISOString();
    const prices: WorkshopPriceSnapshot[] = [
      buildSnapshot({ id: "a", market: "server", unitPrice: 110, capturedAt: "2026-02-20T10:00:00.000Z" }),
      buildSnapshot({ id: "b", market: "server", unitPrice: 120, capturedAt: "2026-01-25T10:00:00.000Z" }),
      buildSnapshot({
        id: "c",
        market: "server",
        unitPrice: 130,
        capturedAt: "2026-02-19T10:00:00.000Z",
        note: WORKSHOP_PRICE_NOTE_TAG_SUSPECT,
      }),
      buildSnapshot({ id: "d", market: "world", unitPrice: 140, capturedAt: "2026-02-19T10:00:00.000Z" }),
      buildSnapshot({ id: "e", market: "server", unitPrice: 150, capturedAt: "2026-02-21T10:00:00.000Z" }),
      buildSnapshot({ id: "f", itemId: "item-2", market: "server", unitPrice: 160, capturedAt: "2026-02-19T10:00:00.000Z" }),
      buildSnapshot({ id: "g", market: "server", unitPrice: 170, capturedAt: "not-a-date" }),
    ];

    const baseline = collectBaselinePricesForItem(prices, "item-1", "server", capturedAt);
    expect(baseline).toEqual([110, 120]);
  });

  it("applies baseline and category rules with merged severity/reason", () => {
    const baseline = [100_000, 110_000, 120_000, 130_000, 140_000, 150_000, 160_000, 170_000];

    const suspect = assessPriceAnomalyWithCategory(450_000, baseline, "equipment");
    expect(suspect.kind).toBe("suspect");
    expect(formatAnomalyReason(suspect)).toContain("低于装备可疑阈值");

    const hard = assessPriceAnomalyWithCategory(50_000, baseline, "equipment");
    expect(hard.kind).toBe("hard");
    expect(formatAnomalyReason(hard)).toContain("低于装备最低价护栏");
  });

  it("formats ratio-based anomaly reason when no explicit rule reason exists", () => {
    const baseline = [100, 105, 110, 115, 120, 125, 130, 135];
    const assessment = assessPriceAnomalyWithCategory(300, baseline, "other");
    expect(assessment.kind).toBe("suspect");
    expect(formatAnomalyReason(assessment)).toContain("高于中位数");
    expect(formatAnomalyReason(assessment)).toContain("样本 8");
  });
});
