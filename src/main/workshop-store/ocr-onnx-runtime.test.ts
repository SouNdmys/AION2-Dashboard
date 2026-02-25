import { describe, expect, it, vi } from "vitest";
import { createOnnxOcrRuntime, type OnnxOcrEngine } from "./ocr-onnx-runtime";

describe("workshop/ocr-onnx-runtime", () => {
  it("reuses created engine and builds OCR outcome", async () => {
    const detect = vi.fn(async () => [{ id: 1 }]);
    const createEngine = vi.fn(async (): Promise<OnnxOcrEngine> => ({ detect }));
    const buildOnnxOcrOutcome = vi.fn(() => ({ ok: true, language: "ch", rawText: "ok", words: [] }));
    const runtime = createOnnxOcrRuntime({
      createEngine,
      buildOnnxOcrOutcome,
      confidenceScale: 100,
    });

    const first = await runtime.runExtract("a.png", "ch");
    const second = await runtime.runExtract("b.png", "ch");

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(createEngine).toHaveBeenCalledTimes(1);
    expect(detect).toHaveBeenCalledTimes(2);
    expect(buildOnnxOcrOutcome).toHaveBeenCalledTimes(2);
  });

  it("returns formatted failure outcome when engine throws", async () => {
    const runtime = createOnnxOcrRuntime({
      createEngine: async () => {
        throw new Error("engine init failed");
      },
      buildOnnxOcrOutcome: () => ({ ok: true, language: "ch", rawText: "", words: [] }),
      confidenceScale: 100,
    });

    const result = await runtime.runExtract("a.png", "ch");
    expect(result.ok).toBe(false);
    expect(result.errorMessage).toContain("engine init failed");
  });

  it("cleans up engine by calling destroy when present", async () => {
    const destroy = vi.fn();
    const runtime = createOnnxOcrRuntime({
      createEngine: async () => ({
        detect: async () => [],
        destroy,
      }),
      buildOnnxOcrOutcome: () => ({ ok: true, language: "ch", rawText: "", words: [] }),
      confidenceScale: 100,
    });

    await runtime.runExtract("a.png", "ch");
    runtime.cleanup();
    expect(destroy).toHaveBeenCalledTimes(1);
  });
});
