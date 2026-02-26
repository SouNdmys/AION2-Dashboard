import { describe, expect, it, vi } from "vitest";
import type { AddWorkshopPriceSnapshotInput, WorkshopPriceSnapshot } from "../../shared/types";
import {
  WORKSHOP_PRICE_NOTE_TAG_HARD,
  WORKSHOP_PRICE_NOTE_TAG_SUSPECT,
} from "./pricing-anomaly";
import { buildWorkshopPriceSnapshotWithAnomaly } from "./pricing-snapshot-create";

const NOW_ISO = "2026-02-26T08:00:00.000Z";

function buildPayload(partial: Partial<AddWorkshopPriceSnapshotInput>): AddWorkshopPriceSnapshotInput {
  return {
    itemId: "item-1",
    unitPrice: 100_000,
    ...partial,
  };
}

function buildDeps(overrides?: {
  toNonNegativeInt?: (raw: unknown, fallback: number) => number;
  asIso?: (raw: unknown, fallbackIso: string) => string;
  nowIso?: () => string;
  createId?: () => string;
}) {
  return {
    toNonNegativeInt:
      overrides?.toNonNegativeInt ??
      ((raw: unknown, fallback: number) =>
        typeof raw === "number" && Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : fallback),
    asIso: overrides?.asIso ?? ((_raw: unknown, fallbackIso: string) => fallbackIso),
    nowIso: overrides?.nowIso ?? (() => NOW_ISO),
    createId: overrides?.createId ?? (() => "snapshot-1"),
  };
}

describe("workshop/pricing-snapshot-create", () => {
  it("builds snapshot and appends hard tag for hard anomaly", () => {
    const snapshot = buildWorkshopPriceSnapshotWithAnomaly(
      {
        payload: buildPayload({
          unitPrice: 50_000,
          note: "  manual-check  ",
        }),
        prices: [],
        itemCategory: "equipment",
      },
      buildDeps(),
    );

    expect(snapshot).toEqual({
      id: "snapshot-1",
      itemId: "item-1",
      unitPrice: 50_000,
      capturedAt: NOW_ISO,
      source: "manual",
      market: "single",
      note: `manual-check;${WORKSHOP_PRICE_NOTE_TAG_HARD}`,
    });
  });

  it("keeps existing suspect tag without duplication and normalizes fallback fields", () => {
    const asIso = vi.fn((_raw: unknown, fallbackIso: string) => fallbackIso);
    const snapshot = buildWorkshopPriceSnapshotWithAnomaly(
      {
        payload: buildPayload({
          unitPrice: 300_000,
          source: "manual",
          market: "bad-market" as AddWorkshopPriceSnapshotInput["market"],
          capturedAt: "not-a-date",
          note: `ocr#line-1;${WORKSHOP_PRICE_NOTE_TAG_SUSPECT}`,
        }),
        prices: [],
        itemCategory: "equipment",
      },
      buildDeps({ asIso, createId: () => "snapshot-2" }),
    );

    expect(snapshot.note).toBe(`ocr#line-1;${WORKSHOP_PRICE_NOTE_TAG_SUSPECT}`);
    expect(snapshot.market).toBe("single");
    expect(snapshot.capturedAt).toBe(NOW_ISO);
    expect(asIso).toHaveBeenCalledWith("not-a-date", NOW_ISO);
  });

  it("preserves import source and appends suspect tag when needed", () => {
    const prices: WorkshopPriceSnapshot[] = [];
    const snapshot = buildWorkshopPriceSnapshotWithAnomaly(
      {
        payload: buildPayload({
          unitPrice: 1_500_000_000,
          source: "import",
          market: "server",
        }),
        prices,
        itemCategory: "equipment",
      },
      buildDeps({ createId: () => "snapshot-3" }),
    );

    expect(snapshot.source).toBe("import");
    expect(snapshot.market).toBe("server");
    expect(snapshot.note).toBe(WORKSHOP_PRICE_NOTE_TAG_SUSPECT);
  });

  it("throws when unit price is invalid", () => {
    expect(() =>
      buildWorkshopPriceSnapshotWithAnomaly(
        {
          payload: buildPayload({ unitPrice: -1 }),
          prices: [],
          itemCategory: "other",
        },
        buildDeps({
          toNonNegativeInt: () => 0,
        }),
      ),
    ).toThrow("价格必须是大于 0 的整数。");
  });
});
