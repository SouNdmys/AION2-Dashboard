import { describe, expect, it } from "vitest";
import type { WorkshopItem } from "../../shared/types";
import {
  isAmbiguousExactOcrNameMatch,
  isExactOcrNameMatch,
  isQualifiedNameCollapsedToBaseName,
  normalizeLookupName,
  normalizeOcrDomainName,
  resolveItemByOcrName,
  resolveUniqueItemByIcon,
  sanitizeOcrLineItemName,
  shouldIgnoreOcrItemName,
  tryCorrectOcrNameByKnownItems,
} from "./ocr-name-matching";

function makeItem(id: string, name: string, icon = "icon-material"): WorkshopItem {
  return {
    id,
    name,
    category: "material",
    icon,
    createdAt: "2026-02-01T00:00:00.000Z",
    updatedAt: "2026-02-01T00:00:00.000Z",
  };
}

describe("workshop/ocr-name-matching", () => {
  it("normalizes lookup names across script variants and whitespace", () => {
    const left = normalizeLookupName("  灿烂 的 奥里哈康矿石 ");
    const right = normalizeLookupName("燦爛的奧里哈康礦石");
    expect(left).toBe(right);
  });

  it("sanitizes OCR line names and applies domain-specific replacements", () => {
    expect(sanitizeOcrLineItemName("【燦爛的奧里哈康礦石】")).toBe("燦爛的奧里哈康礦石");
    expect(normalizeOcrDomainName("慎怒望")).toBe("憤怒願望");
  });

  it("ignores shiny-prefix item names even with level prefix", () => {
    expect(shouldIgnoreOcrItemName("道具等级1閃耀的奧里哈康礦石")).toBe(true);
    expect(shouldIgnoreOcrItemName("純淨的奧里哈康礦石")).toBe(false);
  });

  it("resolves OCR names by qualifier-aware matching", () => {
    const pure = makeItem("pure", "純淨的奧里哈康礦石");
    const brilliant = makeItem("brilliant", "燦爛的奧里哈康礦石");
    const map = new Map<string, WorkshopItem>([
      [normalizeLookupName(pure.name), pure],
      [normalizeLookupName(brilliant.name), brilliant],
    ]);

    const resolved = resolveItemByOcrName(map, "純的奧里哈康礦石");
    expect(resolved?.id).toBe("pure");
  });

  it("keeps fallback when typo correction confidence is low", () => {
    const items = [makeItem("target", "純淨的奧里哈康磐石"), makeItem("other", "燦爛的奧里哈康礦石")];
    const corrected = tryCorrectOcrNameByKnownItems("純淨的奧里哈康磐右", items);
    expect(corrected).toBe("純淨的奧裡哈康磐右");
  });

  it("detects qualifier-prefix collapse against base item names", () => {
    expect(isQualifiedNameCollapsedToBaseName("燦爛的奧里哈康礦石", "奧里哈康礦石")).toBe(true);
    expect(isQualifiedNameCollapsedToBaseName("奧里哈康礦石", "奧里哈康礦石")).toBe(false);
  });

  it("resolves unique icon matches and rejects ambiguous icons", () => {
    const a = makeItem("a", "A", "icon-img-1111");
    const b = makeItem("b", "B", "icon-img-2222");
    const c = makeItem("c", "C", "icon-img-2222");
    expect(resolveUniqueItemByIcon([a, b], "icon-img-1111")?.id).toBe("a");
    expect(resolveUniqueItemByIcon([a, b, c], "icon-img-2222")).toBeUndefined();
  });

  it("checks exact and ambiguous OCR name matches", () => {
    const base = makeItem("base", "奧里哈康礦石");
    const extended = makeItem("extended", "高純度的奧里哈康礦石");
    expect(isExactOcrNameMatch(base, "奧里哈康礦石")).toBe(true);
    expect(isAmbiguousExactOcrNameMatch(base, "奧里哈康礦石", [base, extended])).toBe(true);
  });
});
