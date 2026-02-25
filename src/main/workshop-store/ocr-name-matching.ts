import { tify } from "chinese-conv";
import type { WorkshopItem } from "../../shared/types";

const LOOKUP_CJK_VARIANT_MAP: Record<string, string> = {
  纯: "純",
  純: "純",
  强: "強",
  強: "強",
  净: "淨",
  凈: "淨",
  淨: "淨",
  奥: "奧",
  奧: "奧",
  灿: "燦",
  燦: "燦",
  烂: "爛",
  爛: "爛",
  龙: "龍",
  龍: "龍",
  头: "頭",
  頭: "頭",
  台: "臺",
  臺: "臺",
  后: "後",
  後: "後",
  里: "裡",
  裡: "裡",
  矿: "礦",
  礦: "礦",
  铁: "鐵",
  鐵: "鐵",
  锭: "錠",
  錠: "錠",
  级: "級",
  級: "級",
  制: "製",
  製: "製",
};

const OCR_QUALIFIER_PREFIXES = [
  "燦爛的",
  "燦爛",
  "純淨的",
  "純淨",
  "高純度",
  "精製",
  "特級",
  "上級",
  "高級",
  "濃縮",
  "優質",
];

type OcrQualifierFamily = "brilliant" | "pure" | "highPure";

interface OcrQualifierRule {
  family: OcrQualifierFamily;
  canonicalPrefix: string;
  pattern: RegExp;
}

const OCR_QUALIFIER_RULES: OcrQualifierRule[] = [
  {
    family: "brilliant",
    canonicalPrefix: "燦爛的",
    pattern: /^(?:燦爛的|燦爛|燦的|燦|灿烂的|灿烂|灿的|灿)/u,
  },
  {
    family: "pure",
    canonicalPrefix: "純淨的",
    pattern: /^(?:純淨的|純淨|純凈的|純凈|純净的|純净|純的|纯淨的|纯淨|纯凈的|纯凈|纯净的|纯净|纯的|淨的|凈的|净的)/u,
  },
  {
    family: "highPure",
    canonicalPrefix: "高純度的",
    pattern: /^(?:高純度的|高純度|高纯度的|高纯度)/u,
  },
];

const OCR_DOMAIN_NAME_REPLACEMENTS: Array<[RegExp, string]> = [
  [/慎怒/gu, "憤怒"],
  [/憤怒望/gu, "憤怒願望"],
  [/憤怒願$/gu, "憤怒願望"],
  [/愤怒望/gu, "憤怒願望"],
  [/^(?:純|纯)的/u, "純淨的"],
  [/^珂尼$/u, "珂尼玳"],
  [/提石/gu, "提煉石"],
  [/提烦/gu, "提煉"],
  [/(奧[里裡]哈康)石/gu, "$1礦石"],
  [/龍族片/gu, "龍族鱗片"],
];

function normalizeLookupScriptVariant(value: string): string {
  const source = value.trim();
  if (!source) {
    return "";
  }
  try {
    return tify(source);
  } catch {
    return source;
  }
}

function normalizeLookupCjkVariants(value: string): string {
  return value.replace(/[纯純强強净凈淨奥奧灿燦烂爛龙龍头頭台臺后後里裡矿礦铁鐵锭錠级級制製]/gu, (char) => LOOKUP_CJK_VARIANT_MAP[char] ?? char);
}

export function normalizeLookupName(name: string): string {
  const scriptNormalized = normalizeLookupScriptVariant(name);
  return normalizeLookupCjkVariants(scriptNormalized.trim().toLocaleLowerCase().replace(/\s+/g, ""));
}

export function sanitizeOcrLineItemName(raw: string): string {
  const normalized = raw
    .normalize("NFKC")
    .replace(/[\u00A0\u3000]/g, " ")
    .replace(/[|丨]/g, " ")
    .replace(/[，]/g, ",")
    .replace(/[：]/g, ":")
    .replace(/[“”‘’"'`]/g, "")
    .replace(/[()（）[\]{}<>﹤﹥]/g, " ")
    .replace(/[^0-9a-zA-Z\u3400-\u9fff]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  const compact = normalized.replace(/\s+/g, "");
  return compact ? normalized : "";
}

export function normalizeOcrDomainName(rawName: string): string {
  let value = sanitizeOcrLineItemName(rawName).replace(/\s+/g, "");
  if (!value) {
    return "";
  }
  value = normalizeLookupScriptVariant(value);
  OCR_DOMAIN_NAME_REPLACEMENTS.forEach(([pattern, replacement]) => {
    value = value.replace(pattern, replacement);
  });
  return value;
}

export function shouldIgnoreOcrItemName(rawName: string): boolean {
  const normalized = normalizeOcrDomainName(rawName);
  if (!normalized) {
    return false;
  }
  const withoutLevelPrefix = normalized.replace(/^道具(?:等級|等级)\d+/u, "");
  return withoutLevelPrefix.startsWith("閃耀的");
}

function findOcrQualifierRule(rawName: string): OcrQualifierRule | undefined {
  const compact = normalizeOcrDomainName(rawName);
  if (!compact) {
    return undefined;
  }
  return OCR_QUALIFIER_RULES.find((rule) => rule.pattern.test(compact));
}

function resolveOcrQualifierFamily(rawName: string): OcrQualifierFamily | undefined {
  return findOcrQualifierRule(rawName)?.family;
}

function normalizeOcrQualifierPrefix(rawName: string): string {
  const compact = normalizeOcrDomainName(rawName);
  if (!compact) {
    return "";
  }
  const rule = findOcrQualifierRule(compact);
  if (!rule) {
    return compact;
  }
  const matched = compact.match(rule.pattern)?.[0] ?? "";
  if (!matched || matched === rule.canonicalPrefix) {
    return compact;
  }
  const rest = compact.slice(matched.length);
  if (!rest) {
    return compact;
  }
  return `${rule.canonicalPrefix}${rest}`;
}

function buildOcrLookupCandidates(rawName: string): string[] {
  const candidates = new Set<string>();
  const add = (value: string): void => {
    const normalized = normalizeLookupName(value);
    if (normalized.length >= 2) {
      candidates.add(normalized);
    }
  };
  add(rawName);
  const domainNormalized = normalizeOcrDomainName(rawName);
  add(domainNormalized);
  const cleaned = sanitizeOcrLineItemName(rawName).replace(/[^0-9a-zA-Z\u3400-\u9fff]/gu, "");
  add(cleaned);
  add(normalizeOcrDomainName(cleaned));
  const normalizedQualifier = normalizeOcrQualifierPrefix(cleaned || rawName);
  if (normalizedQualifier && normalizedQualifier !== cleaned) {
    add(normalizedQualifier);
  }
  const normalizedCleaned = normalizeLookupName(cleaned);
  const trimmedLeadingDigits = normalizedCleaned.replace(/^[0-9]+/u, "");
  if (trimmedLeadingDigits !== normalizedCleaned) {
    add(trimmedLeadingDigits);
  }
  return Array.from(candidates);
}

function hasQualifiedPrefix(name: string): boolean {
  const key = normalizeLookupName(sanitizeOcrLineItemName(name));
  if (!key) {
    return false;
  }
  if (resolveOcrQualifierFamily(name)) {
    return true;
  }
  return OCR_QUALIFIER_PREFIXES.some((prefix) => key.startsWith(normalizeLookupName(prefix)));
}

export function isQualifiedNameCollapsedToBaseName(ocrName: string, matchedItemName: string): boolean {
  const ocrKey = normalizeLookupName(sanitizeOcrLineItemName(ocrName));
  const matchedKey = normalizeLookupName(matchedItemName);
  if (!ocrKey || !matchedKey || ocrKey === matchedKey) {
    return false;
  }
  if (!ocrKey.endsWith(matchedKey)) {
    return false;
  }
  if (ocrKey.length - matchedKey.length < 2) {
    return false;
  }
  return hasQualifiedPrefix(ocrName) && !hasQualifiedPrefix(matchedItemName);
}

function levenshteinDistance(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  if (!left) {
    return right.length;
  }
  if (!right) {
    return left.length;
  }
  const prev = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    let diagonal = prev[0];
    prev[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const up = prev[j];
      const leftCost = prev[j - 1] + 1;
      const upCost = up + 1;
      const replaceCost = diagonal + (left[i - 1] === right[j - 1] ? 0 : 1);
      prev[j] = Math.min(leftCost, upCost, replaceCost);
      diagonal = up;
    }
  }
  return prev[right.length];
}

function commonPrefixLength(left: string, right: string): number {
  const max = Math.min(left.length, right.length);
  let count = 0;
  while (count < max && left[count] === right[count]) {
    count += 1;
  }
  return count;
}

function commonSuffixLength(left: string, right: string): number {
  const max = Math.min(left.length, right.length);
  let count = 0;
  while (count < max && left[left.length - 1 - count] === right[right.length - 1 - count]) {
    count += 1;
  }
  return count;
}

export function tryCorrectOcrNameByKnownItems(rawOcrName: string, items: WorkshopItem[]): string {
  const sanitized = sanitizeOcrLineItemName(rawOcrName);
  const domainNormalized = normalizeOcrDomainName(sanitized || rawOcrName) || sanitized;
  const normalizedQualifierName = normalizeOcrQualifierPrefix(domainNormalized);
  const normalizedQualifierKey = normalizeLookupName(normalizedQualifierName);
  const ocrKey = normalizeLookupName(domainNormalized);
  const ocrQualifierFamily = resolveOcrQualifierFamily(domainNormalized) ?? resolveOcrQualifierFamily(normalizedQualifierName);
  const fallbackName = domainNormalized || rawOcrName;
  const seedKey = normalizedQualifierKey || ocrKey;
  if (!seedKey || seedKey.length < 3) {
    return fallbackName;
  }
  const exactItem = items.find((item) => {
    const itemKey = normalizeLookupName(item.name);
    return itemKey === seedKey || itemKey === ocrKey;
  });
  if (exactItem) {
    return exactItem.name;
  }

  const candidates: Array<{ itemName: string; score: number }> = [];
  items.forEach((item) => {
    const itemQualifierFamily = resolveOcrQualifierFamily(item.name);
    if (ocrQualifierFamily && itemQualifierFamily !== ocrQualifierFamily) {
      return;
    }
    const itemKey = normalizeLookupName(item.name);
    const maxLengthGap = ocrQualifierFamily ? 2 : 1;
    if (!itemKey || Math.abs(itemKey.length - seedKey.length) > maxLengthGap) {
      return;
    }
    const distance = levenshteinDistance(seedKey, itemKey);
    const maxDistance = ocrQualifierFamily ? 2 : 1;
    if (distance <= 0 || distance > maxDistance) {
      return;
    }
    const prefix = commonPrefixLength(seedKey, itemKey);
    const suffix = commonSuffixLength(seedKey, itemKey);
    if (ocrQualifierFamily && suffix < 2) {
      return;
    }
    if (prefix < 2 && suffix < 2) {
      return;
    }
    let score = prefix * 3 + suffix * 2 - Math.abs(itemKey.length - seedKey.length) - distance * 2;
    if (ocrQualifierFamily && itemQualifierFamily === ocrQualifierFamily) {
      score += 5;
    }
    candidates.push({ itemName: item.name, score });
  });
  if (candidates.length === 0) {
    return fallbackName;
  }
  candidates.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }
    return left.itemName.localeCompare(right.itemName, "zh-CN");
  });
  const best = candidates[0];
  const second = candidates[1];
  if (second && second.score >= best.score - 1) {
    return fallbackName;
  }
  return best.itemName;
}

export function resolveItemByOcrName(itemByLookupName: Map<string, WorkshopItem>, rawName: string): WorkshopItem | undefined {
  const candidates = buildOcrLookupCandidates(rawName);
  const ocrQualifierFamily = resolveOcrQualifierFamily(rawName) ?? resolveOcrQualifierFamily(normalizeOcrQualifierPrefix(rawName));
  const isQualifierCompatible = (itemName: string): boolean => {
    if (!ocrQualifierFamily) {
      return true;
    }
    return resolveOcrQualifierFamily(itemName) === ocrQualifierFamily;
  };
  for (const candidate of candidates) {
    const exact = itemByLookupName.get(candidate);
    if (exact && isQualifierCompatible(exact.name)) {
      return exact;
    }
  }

  let bestContainItem: WorkshopItem | undefined;
  let bestContainOverlap = -1;
  let bestContainScore = -1;
  itemByLookupName.forEach((item, lookup) => {
    if (!isQualifierCompatible(item.name)) {
      return;
    }
    if (lookup.length < 4) {
      return;
    }
    candidates.forEach((candidate) => {
      const overlap = Math.min(candidate.length, lookup.length);
      if (overlap < 4) {
        return;
      }
      if (!candidate.includes(lookup) && !lookup.includes(candidate)) {
        return;
      }
      const score = overlap / Math.max(candidate.length, lookup.length);
      if (overlap > bestContainOverlap || (overlap === bestContainOverlap && score > bestContainScore)) {
        bestContainItem = item;
        bestContainOverlap = overlap;
        bestContainScore = score;
      }
    });
  });
  if (bestContainItem) {
    return bestContainItem;
  }

  const fuzzy: Array<{ item: WorkshopItem; ratio: number; maxLen: number }> = [];
  itemByLookupName.forEach((item, lookup) => {
    if (!isQualifierCompatible(item.name)) {
      return;
    }
    candidates.forEach((candidate) => {
      if (candidate.length < 4 || lookup.length < 4) {
        return;
      }
      if (Math.abs(candidate.length - lookup.length) > 4) {
        return;
      }
      const dist = levenshteinDistance(candidate, lookup);
      const maxLen = Math.max(candidate.length, lookup.length);
      const ratio = 1 - dist / maxLen;
      const threshold = maxLen >= 8 ? 0.62 : 0.68;
      if (ratio < threshold) {
        return;
      }
      fuzzy.push({ item, ratio, maxLen });
    });
  });
  if (fuzzy.length === 0) {
    return undefined;
  }
  fuzzy.sort((left, right) => {
    if (right.ratio !== left.ratio) {
      return right.ratio - left.ratio;
    }
    if (right.maxLen !== left.maxLen) {
      return right.maxLen - left.maxLen;
    }
    return left.item.name.localeCompare(right.item.name, "zh-CN");
  });
  const best = fuzzy[0];
  const second = fuzzy[1];
  if (best.ratio >= 0.9) {
    return best.item;
  }
  if (!second || best.ratio - second.ratio >= 0.08) {
    return best.item;
  }
  return undefined;
}

export function resolveUniqueItemByIcon(items: WorkshopItem[], icon: string | undefined): WorkshopItem | undefined {
  if (!icon) {
    return undefined;
  }
  let matched: WorkshopItem | undefined;
  for (const item of items) {
    if (item.icon !== icon) {
      continue;
    }
    if (matched) {
      return undefined;
    }
    matched = item;
  }
  return matched;
}

export function isAmbiguousExactOcrNameMatch(item: WorkshopItem, ocrName: string, items: WorkshopItem[]): boolean {
  const ocrKey = normalizeLookupName(sanitizeOcrLineItemName(ocrName));
  if (!ocrKey) {
    return false;
  }
  const itemKey = normalizeLookupName(item.name);
  if (!itemKey || itemKey !== ocrKey) {
    return false;
  }
  return items.some((other) => {
    if (other.id === item.id) {
      return false;
    }
    const otherKey = normalizeLookupName(other.name);
    return otherKey.length > ocrKey.length && otherKey.includes(ocrKey);
  });
}

export function isExactOcrNameMatch(item: WorkshopItem, ocrName: string): boolean {
  const ocrKey = normalizeLookupName(sanitizeOcrLineItemName(ocrName));
  const itemKey = normalizeLookupName(item.name);
  return Boolean(ocrKey) && ocrKey === itemKey;
}
