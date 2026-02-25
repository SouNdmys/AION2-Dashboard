import { describe, expect, it } from "vitest";
import { buildOnnxOcrOutcome, normalizeOnnxLineWord } from "./ocr-onnx-output";

describe("workshop/ocr-onnx-output", () => {
  it("normalizes ONNX box coordinates into OCR TSV word", () => {
    const word = normalizeOnnxLineWord(
      {
        text: " Foo ",
        box: [
          [10.2, 20.1],
          [13.9, 20.2],
          [13.8, 24.7],
          [10.1, 24.8],
        ],
        mean: 0.88,
      } as any,
      100,
    );
    expect(word).toMatchObject({
      text: "Foo",
      left: 10,
      top: 20,
      width: 4,
      height: 5,
      confidence: 88,
    });
  });

  it("falls back to default rect when box is missing", () => {
    const word = normalizeOnnxLineWord(
      {
        text: "NoBox",
        mean: 0.9,
      } as any,
      100,
    );
    expect(word).toMatchObject({
      text: "NoBox",
      left: 0,
      top: 0,
      width: 1,
      height: 1,
      confidence: 90,
    });
  });

  it("returns null when text is empty or box points are invalid", () => {
    expect(normalizeOnnxLineWord({ text: "   ", box: [], mean: 0.5 } as any, 100)).toBeNull();
    expect(normalizeOnnxLineWord({ text: "bad", box: [["x", 1]], mean: 0.5 } as any, 100)).toBeNull();
  });

  it("builds successful OCR outcome from detected lines", () => {
    const outcome = buildOnnxOcrOutcome(
      [
        { text: " 第一行 ", box: [], mean: 0.9 },
        { text: " ", box: [], mean: 0.8 },
        { text: "第二行", box: [], mean: 0.7 },
      ] as any,
      "chi_tra",
      100,
    );
    expect(outcome.ok).toBe(true);
    expect(outcome.language).toBe("chi_tra");
    expect(outcome.rawText).toBe("第一行\n第二行");
    expect(outcome.words).toHaveLength(2);
  });
});
