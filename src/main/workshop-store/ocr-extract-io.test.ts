import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { cleanupTempFile, stringifyOcrWords } from "./ocr-extract-io";

describe("workshop/ocr-extract-io", () => {
  it("serializes OCR words to tsv-compatible lines", () => {
    const text = stringifyOcrWords([
      { text: "A", left: 1, top: 2, width: 3, height: 4, confidence: 99.123 },
      { text: "B", left: 5, top: 6, width: 7, height: 8, confidence: 70 },
    ]);
    expect(text).toBe("1,2,3,4,99.12\tA\n5,6,7,8,70.00\tB");
  });

  it("cleans up existing temp files and ignores missing paths", () => {
    const filePath = path.join(os.tmpdir(), `aion2-ocr-extract-io-${Date.now()}.tmp`);
    fs.writeFileSync(filePath, "temp");
    expect(fs.existsSync(filePath)).toBe(true);

    cleanupTempFile(filePath);
    expect(fs.existsSync(filePath)).toBe(false);

    expect(() => cleanupTempFile(filePath)).not.toThrow();
    expect(() => cleanupTempFile(null)).not.toThrow();
  });
});
