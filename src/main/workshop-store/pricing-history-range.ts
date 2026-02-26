import type { WorkshopPriceHistoryQuery } from "../../shared/types";
import { sanitizeLookbackDays } from "./pricing-signal-rule";

export function parseOptionalIso(raw: unknown): Date | null {
  if (typeof raw !== "string") {
    return null;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

export function resolveHistoryRange(payload: WorkshopPriceHistoryQuery): { from: Date; to: Date } {
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
