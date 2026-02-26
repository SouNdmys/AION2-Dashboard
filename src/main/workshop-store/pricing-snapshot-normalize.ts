import { randomUUID } from "node:crypto";
import type { WorkshopPriceMarket, WorkshopPriceSnapshot } from "../../shared/types";

export interface NormalizePriceSnapshotDeps {
  asIso: (raw: unknown, fallbackIso: string) => string;
  toNonNegativeInt: (raw: unknown, fallback: number) => number;
}

export function sanitizePriceMarket(raw: unknown): WorkshopPriceMarket {
  if (raw === "server" || raw === "world" || raw === "single") {
    return raw;
  }
  return "single";
}

function sanitizePriceNote(raw: unknown): string | undefined {
  if (typeof raw !== "string") {
    return undefined;
  }
  const trimmed = raw.trim();
  return trimmed || undefined;
}

export function normalizePriceSnapshot(
  raw: unknown,
  deps: NormalizePriceSnapshotDeps,
  createId: () => string = randomUUID,
): WorkshopPriceSnapshot | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const id = typeof (raw as { id?: unknown }).id === "string" ? (raw as { id: string }).id : createId();
  const itemId = typeof (raw as { itemId?: unknown }).itemId === "string" ? (raw as { itemId: string }).itemId : "";
  if (!itemId) {
    return null;
  }

  const unitPrice = deps.toNonNegativeInt((raw as { unitPrice?: unknown }).unitPrice, -1);
  if (unitPrice <= 0) {
    return null;
  }

  const sourceRaw = (raw as { source?: unknown }).source;
  const source = sourceRaw === "import" ? "import" : "manual";
  const market = sanitizePriceMarket((raw as { market?: unknown }).market);
  const capturedAt = deps.asIso((raw as { capturedAt?: unknown }).capturedAt, new Date().toISOString());
  const note = sanitizePriceNote((raw as { note?: unknown }).note);

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
