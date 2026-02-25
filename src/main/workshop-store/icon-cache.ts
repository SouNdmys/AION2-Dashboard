import type { WorkshopItemCategory } from "../../shared/types";
import { normalizeLookupName } from "./ocr-name-matching";

export function sanitizeIconToken(raw: unknown): string | undefined {
  if (typeof raw !== "string") {
    return undefined;
  }
  const icon = raw.trim();
  return icon || undefined;
}

export function isCapturedImageIcon(icon: string | undefined): boolean {
  return typeof icon === "string" && icon.startsWith("icon-img-");
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

export function normalizeIconCache(raw: unknown): Map<string, string> {
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

export function serializeIconCache(iconCache: Map<string, string>): Record<string, string> {
  const pairs = Array.from(iconCache.entries()).sort((left, right) => left[0].localeCompare(right[0]));
  return Object.fromEntries(pairs);
}

export function cacheIconByName(iconCache: Map<string, string>, name: string, icon: string | undefined): void {
  if (!icon) {
    return;
  }
  const key = normalizeLookupName(name);
  if (!key) {
    return;
  }
  iconCache.set(key, icon);
}

export function extractItemAliasesFromNotes(notes?: string): string[] {
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

export function resolveItemIconWithCache(
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
