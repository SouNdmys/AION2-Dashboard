import { buildNameRowsFromWords, parseNonEmptyLines, resolveTradeBoardRowCount } from "./ocr-tradeboard-rows";
import type { OcrTsvWord } from "./ocr-paddle-payload";

interface BuildTradeBoardNameRowsInput {
  namesWords: OcrTsvWord[];
  namesRawText: string;
  expectedRowCount: number;
  namesRectHeight: number;
  namesScale: number;
  warnings: string[];
}

interface BuildTradeBoardNameRowsDeps {
  sanitizeOcrLineItemName: (raw: string) => string;
  clamp: (value: number, min: number, max: number) => number;
  nameConfidenceMin: number;
}

interface BuildTradeBoardNameRowsResult {
  effectiveRowCount: number;
  nameRows: Array<string | null>;
}

export function buildTradeBoardNameRows(
  input: BuildTradeBoardNameRowsInput,
  deps: BuildTradeBoardNameRowsDeps,
): BuildTradeBoardNameRowsResult {
  const effectiveRowCount = resolveTradeBoardRowCount(
    input.expectedRowCount,
    input.namesWords,
    input.namesRawText,
    input.warnings,
    {
      sanitizeOcrLineItemName: deps.sanitizeOcrLineItemName,
      clamp: deps.clamp,
    },
  );
  const nameRowsFromTsv = buildNameRowsFromWords(
    input.namesWords,
    effectiveRowCount,
    Math.floor(input.namesRectHeight * input.namesScale),
    {
      sanitizeOcrLineItemName: deps.sanitizeOcrLineItemName,
      clamp: deps.clamp,
      nameConfidenceMin: deps.nameConfidenceMin,
    },
  );
  const nameRowsTsvSanitized = nameRowsFromTsv.map((row) => {
    const cleaned = deps.sanitizeOcrLineItemName(row ?? "");
    return cleaned || null;
  });
  const nameLinesFallback = parseNonEmptyLines(input.namesRawText)
    .map((line) => deps.sanitizeOcrLineItemName(line))
    .filter(Boolean)
    .slice(0, effectiveRowCount);
  const nameRowsFallback = Array.from({ length: effectiveRowCount }, (_, index) => nameLinesFallback[index] ?? null);
  const nameRows =
    nameRowsTsvSanitized.filter((entry) => entry !== null).length >= nameLinesFallback.length
      ? nameRowsTsvSanitized
      : nameRowsFallback;

  return {
    effectiveRowCount,
    nameRows,
  };
}
