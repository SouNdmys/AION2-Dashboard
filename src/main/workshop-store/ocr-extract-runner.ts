import type { PaddleOcrOutcome } from "./ocr-paddle-payload";
import type { PaddleCommandAttempt, PaddleCommandResult } from "./ocr-paddle-runtime";

interface RunPaddleExtractInput {
  imagePath: string;
  language: string;
  safeMode: boolean;
  enablePythonFallback: boolean;
  confidenceScale: number;
}

interface RunPaddleExtractDeps {
  runOnnxExtract: (imagePath: string, language: string, safeMode?: boolean) => Promise<PaddleOcrOutcome>;
  buildPaddleLanguageCandidates: (language: string) => string[];
  runPaddleWithWorker: (imagePath: string, candidates: string[], safeMode: boolean) => Promise<PaddleOcrOutcome>;
  buildPaddleCommandAttempts: (script: string, scriptArgs: string[]) => PaddleCommandAttempt[];
  runPaddleWithCommand: (command: string, args: string[], safeMode: boolean) => Promise<PaddleCommandResult>;
  parsePaddlePayload: (stdout: string, confidenceScale: number) => PaddleOcrOutcome;
  pythonScript: string;
}

export async function runPaddleExtractWithFallback(
  input: RunPaddleExtractInput,
  deps: RunPaddleExtractDeps,
): Promise<PaddleOcrOutcome> {
  const onnxResult = await deps.runOnnxExtract(input.imagePath, input.language, input.safeMode);
  if (onnxResult.ok) {
    return onnxResult;
  }

  if (!input.enablePythonFallback) {
    return onnxResult;
  }

  const candidates = deps.buildPaddleLanguageCandidates(input.language);
  const langArg = candidates.join(",");
  const attemptErrors: string[] = [onnxResult.errorMessage ?? "ONNX OCR 失败"];

  const isInterpreterNotAvailable = (message: string): boolean => {
    const normalized = message.toLocaleLowerCase();
    return normalized.includes("no suitable python runtime found") || normalized.includes("not recognized");
  };

  const isImportFailure = (message: string): boolean => {
    return message.toLocaleLowerCase().includes("import paddleocr failed");
  };

  try {
    const fromWorker = await deps.runPaddleWithWorker(input.imagePath, candidates, input.safeMode);
    if (fromWorker.ok) {
      return fromWorker;
    }
    const payloadError = fromWorker.errorMessage ?? "输出无效";
    attemptErrors.push(`worker: ${payloadError}`);
    if (!isImportFailure(payloadError) && !isInterpreterNotAvailable(payloadError)) {
      return {
        ...fromWorker,
        errorMessage: `worker: ${payloadError}`,
      };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "worker 失败";
    attemptErrors.push(`worker: ${message}`);
  }

  const attempts = deps.buildPaddleCommandAttempts(deps.pythonScript, [input.imagePath, langArg]);
  for (const attempt of attempts) {
    const result = await deps.runPaddleWithCommand(attempt.command, attempt.args, input.safeMode);
    if (!result.ok) {
      const detail = (result.errorMessage ?? result.stderr.trim()) || "执行失败";
      attemptErrors.push(`${attempt.label}: ${detail}`);
      if (!isInterpreterNotAvailable(detail)) {
        break;
      }
      continue;
    }
    const payload = deps.parsePaddlePayload(result.stdout, input.confidenceScale);
    if (payload.ok) {
      return payload;
    }
    const payloadError = payload.errorMessage ?? "输出无效";
    attemptErrors.push(`${attempt.label}: ${payloadError}`);
    if (!isImportFailure(payloadError) && !isInterpreterNotAvailable(payloadError)) {
      return {
        ...payload,
        errorMessage: `${attempt.label}: ${payloadError}`,
      };
    }
  }

  return {
    ok: false,
    language: "",
    rawText: "",
    words: [],
    errorMessage: attemptErrors.join(" | ") || "ONNX OCR 调用失败。",
  };
}
