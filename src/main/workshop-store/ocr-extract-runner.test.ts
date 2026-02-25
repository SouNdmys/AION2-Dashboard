import { describe, expect, it } from "vitest";
import { runPaddleExtractWithFallback } from "./ocr-extract-runner";

describe("workshop/ocr-extract-runner", () => {
  it("returns ONNX outcome immediately when ONNX succeeds", async () => {
    const result = await runPaddleExtractWithFallback(
      {
        imagePath: "x.png",
        language: "ch",
        safeMode: true,
        enablePythonFallback: true,
        confidenceScale: 100,
      },
      {
        runOnnxExtract: async () => ({ ok: true, language: "ch", rawText: "ok", words: [] }),
        buildPaddleLanguageCandidates: () => ["ch"],
        runPaddleWithWorker: async () => ({ ok: false, language: "", rawText: "", words: [], errorMessage: "unused" }),
        buildPaddleCommandAttempts: () => [],
        runPaddleWithCommand: async () => ({ ok: false, stdout: "", stderr: "unused" }),
        parsePaddlePayload: () => ({ ok: false, language: "", rawText: "", words: [], errorMessage: "unused" }),
        pythonScript: "print(1)",
      },
    );

    expect(result).toEqual({ ok: true, language: "ch", rawText: "ok", words: [] });
  });

  it("returns ONNX failure directly when python fallback is disabled", async () => {
    const result = await runPaddleExtractWithFallback(
      {
        imagePath: "x.png",
        language: "ch",
        safeMode: true,
        enablePythonFallback: false,
        confidenceScale: 100,
      },
      {
        runOnnxExtract: async () => ({ ok: false, language: "ch", rawText: "", words: [], errorMessage: "onnx-fail" }),
        buildPaddleLanguageCandidates: () => ["ch"],
        runPaddleWithWorker: async () => ({ ok: false, language: "", rawText: "", words: [], errorMessage: "unused" }),
        buildPaddleCommandAttempts: () => [],
        runPaddleWithCommand: async () => ({ ok: false, stdout: "", stderr: "unused" }),
        parsePaddlePayload: () => ({ ok: false, language: "", rawText: "", words: [], errorMessage: "unused" }),
        pythonScript: "print(1)",
      },
    );

    expect(result.errorMessage).toBe("onnx-fail");
    expect(result.ok).toBe(false);
  });

  it("uses worker and command fallback chain when ONNX fails and fallback is enabled", async () => {
    const result = await runPaddleExtractWithFallback(
      {
        imagePath: "x.png",
        language: "ch",
        safeMode: true,
        enablePythonFallback: true,
        confidenceScale: 100,
      },
      {
        runOnnxExtract: async () => ({ ok: false, language: "ch", rawText: "", words: [], errorMessage: "onnx-fail" }),
        buildPaddleLanguageCandidates: () => ["ch", "en"],
        runPaddleWithWorker: async () => ({ ok: false, language: "", rawText: "", words: [], errorMessage: "import paddleocr failed: x" }),
        buildPaddleCommandAttempts: () => [{ command: "py", args: ["-c", "x"], label: "py-3.11" }],
        runPaddleWithCommand: async () => ({ ok: true, stdout: "payload", stderr: "" }),
        parsePaddlePayload: () => ({ ok: true, language: "en", rawText: "hello", words: [] }),
        pythonScript: "print(1)",
      },
    );

    expect(result.ok).toBe(true);
    expect(result.language).toBe("en");
    expect(result.rawText).toBe("hello");
  });
});
