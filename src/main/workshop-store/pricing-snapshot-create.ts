import { randomUUID } from "node:crypto";
import type {
  AddWorkshopPriceSnapshotInput,
  WorkshopItemCategory,
  WorkshopPriceSnapshot,
} from "../../shared/types";
import {
  WORKSHOP_PRICE_NOTE_TAG_HARD,
  WORKSHOP_PRICE_NOTE_TAG_SUSPECT,
  appendNoteTag,
  assessPriceAnomalyWithCategory,
  collectBaselinePricesForItem,
} from "./pricing-anomaly";
import { sanitizePriceMarket } from "./pricing-snapshot-normalize";

export interface BuildWorkshopPriceSnapshotWithAnomalyInput {
  payload: AddWorkshopPriceSnapshotInput;
  prices: WorkshopPriceSnapshot[];
  itemCategory: WorkshopItemCategory | "other";
}

export interface BuildWorkshopPriceSnapshotWithAnomalyDeps {
  toNonNegativeInt: (raw: unknown, fallback: number) => number;
  asIso: (raw: unknown, fallbackIso: string) => string;
  nowIso?: () => string;
  createId?: () => string;
}

export function createWorkshopPriceSnapshotWithAnomalyDeps(
  deps: BuildWorkshopPriceSnapshotWithAnomalyDeps,
): Required<BuildWorkshopPriceSnapshotWithAnomalyDeps> {
  return {
    toNonNegativeInt: deps.toNonNegativeInt,
    asIso: deps.asIso,
    nowIso: deps.nowIso ?? (() => new Date().toISOString()),
    createId: deps.createId ?? randomUUID,
  };
}

export function buildWorkshopPriceSnapshotWithAnomaly(
  input: BuildWorkshopPriceSnapshotWithAnomalyInput,
  deps: BuildWorkshopPriceSnapshotWithAnomalyDeps,
): WorkshopPriceSnapshot {
  const runtimeDeps = createWorkshopPriceSnapshotWithAnomalyDeps(deps);

  const unitPrice = runtimeDeps.toNonNegativeInt(input.payload.unitPrice, -1);
  if (unitPrice <= 0) {
    throw new Error("价格必须是大于 0 的整数。");
  }

  const capturedAt = input.payload.capturedAt
    ? runtimeDeps.asIso(input.payload.capturedAt, runtimeDeps.nowIso())
    : runtimeDeps.nowIso();
  const source = input.payload.source === "import" ? "import" : "manual";
  const market = sanitizePriceMarket(input.payload.market);
  const baselinePrices = collectBaselinePricesForItem(input.prices, input.payload.itemId, market, capturedAt);
  const anomaly = assessPriceAnomalyWithCategory(unitPrice, baselinePrices, input.itemCategory);

  let note = input.payload.note?.trim() || undefined;
  if (anomaly.kind === "hard") {
    note = appendNoteTag(note, WORKSHOP_PRICE_NOTE_TAG_HARD);
  } else if (anomaly.kind === "suspect") {
    note = appendNoteTag(note, WORKSHOP_PRICE_NOTE_TAG_SUSPECT);
  }

  return {
    id: runtimeDeps.createId(),
    itemId: input.payload.itemId,
    unitPrice,
    capturedAt,
    source,
    market,
    note,
  };
}
