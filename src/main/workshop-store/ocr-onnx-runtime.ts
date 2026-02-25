import type { PaddleOcrOutcome } from "./ocr-paddle-payload";

export interface OnnxOcrEngine {
  detect: (imagePath: string, options?: unknown) => Promise<unknown[]>;
  destroy?: () => void | Promise<void>;
}

interface CreateOnnxOcrRuntimeOptions {
  createEngine: () => Promise<OnnxOcrEngine>;
  buildOnnxOcrOutcome: (lines: unknown[], language: string, confidenceScale: number) => PaddleOcrOutcome;
  confidenceScale: number;
}

export interface OnnxOcrRuntime {
  runExtract: (imagePath: string, language: string, safeMode?: boolean) => Promise<PaddleOcrOutcome>;
  cleanup: () => void;
}

export function createOnnxOcrRuntime(options: CreateOnnxOcrRuntimeOptions): OnnxOcrRuntime {
  let onnxOcrEngine: OnnxOcrEngine | null = null;
  let onnxOcrEnginePromise: Promise<OnnxOcrEngine> | null = null;

  const ensureOnnxOcrEngine = async (_safeMode = true): Promise<OnnxOcrEngine> => {
    if (onnxOcrEngine) {
      return onnxOcrEngine;
    }
    if (onnxOcrEnginePromise) {
      return onnxOcrEnginePromise;
    }
    onnxOcrEnginePromise = (async () => {
      const created = await options.createEngine();
      onnxOcrEngine = created;
      return created;
    })();
    try {
      return await onnxOcrEnginePromise;
    } finally {
      onnxOcrEnginePromise = null;
    }
  };

  const runExtract = async (imagePath: string, language: string, safeMode = true): Promise<PaddleOcrOutcome> => {
    try {
      const engine = await ensureOnnxOcrEngine(safeMode);
      const lines = await engine.detect(imagePath);
      return options.buildOnnxOcrOutcome(lines, language, options.confidenceScale);
    } catch (err) {
      const message = err instanceof Error ? err.message : "ONNX 引擎异常";
      return {
        ok: false,
        language,
        rawText: "",
        words: [],
        errorMessage: `ONNX OCR 执行失败：${message}`,
      };
    }
  };

  const cleanup = (): void => {
    if (onnxOcrEngine && typeof onnxOcrEngine.destroy === "function") {
      try {
        const maybePromise = onnxOcrEngine.destroy();
        if (maybePromise && typeof (maybePromise as Promise<void>).then === "function") {
          void (maybePromise as Promise<void>).catch(() => {
            // ignore onnx cleanup error
          });
        }
      } catch {
        // ignore onnx cleanup error
      }
    }
    onnxOcrEngine = null;
    onnxOcrEnginePromise = null;
  };

  return {
    runExtract,
    cleanup,
  };
}
