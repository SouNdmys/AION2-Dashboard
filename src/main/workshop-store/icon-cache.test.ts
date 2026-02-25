import { describe, expect, it } from "vitest";
import { normalizeLookupName } from "./ocr-name-matching";
import {
  cacheIconByName,
  extractItemAliasesFromNotes,
  isCapturedImageIcon,
  normalizeIconCache,
  resolveItemIconWithCache,
  sanitizeIconToken,
  serializeIconCache,
} from "./icon-cache";

describe("workshop/icon-cache", () => {
  it("sanitizes icon token and normalizes icon cache keys", () => {
    expect(sanitizeIconToken("  icon-a  ")).toBe("icon-a");
    expect(sanitizeIconToken("   ")).toBeUndefined();

    const cache = normalizeIconCache({
      " 勇者长剑 ": "  icon-weapon ",
      " ": "icon-empty-key",
      "失效值": "   ",
    });
    expect(cache.get(normalizeLookupName("勇者长剑"))).toBe("icon-weapon");
    expect(cache.has("")).toBe(false);
    expect(cache.has(normalizeLookupName("失效值"))).toBe(false);
  });

  it("resolves icon by explicit value, cache, then inferred fallback", () => {
    const cache = new Map<string, string>();
    const explicit = resolveItemIconWithCache(cache, "勇者长剑", "equipment", " icon-explicit ");
    expect(explicit).toBe("icon-explicit");
    expect(cache.get(normalizeLookupName("勇者长剑"))).toBe("icon-explicit");

    cache.set(normalizeLookupName("魔石"), "icon-cached");
    expect(resolveItemIconWithCache(cache, " 魔石 ", "material")).toBe("icon-cached");

    const inferredOre = resolveItemIconWithCache(cache, "奥里哈康礦石", "material");
    const inferredComponent = resolveItemIconWithCache(cache, "强化核心", "component");
    expect(inferredOre).toBe("icon-material-ore");
    expect(inferredComponent).toBe("icon-component");
  });

  it("caches by normalized name and parses alias notes", () => {
    const cache = new Map<string, string>();
    cacheIconByName(cache, "  金属碎片 ", "icon-fragment");
    cacheIconByName(cache, " ", "icon-empty");
    expect(cache.get(normalizeLookupName("金属碎片"))).toBe("icon-fragment");
    expect(cache.has("")).toBe(false);

    const aliases = extractItemAliasesFromNotes("來源: x; 別名: 鋼鐵、铁块,ore/礦片 ; 備註: y");
    expect(aliases).toEqual(["鋼鐵", "铁块", "ore", "礦片"]);
  });

  it("serializes cache in key order and detects captured-image icon", () => {
    const serialized = serializeIconCache(
      new Map<string, string>([
        ["b", "icon-b"],
        ["a", "icon-a"],
      ]),
    );
    expect(Object.keys(serialized)).toEqual(["a", "b"]);
    expect(serialized.a).toBe("icon-a");
    expect(isCapturedImageIcon("icon-img-abc")).toBe(true);
    expect(isCapturedImageIcon("icon-equipment")).toBe(false);
  });
});
