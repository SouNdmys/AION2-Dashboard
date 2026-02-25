import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { parsePaddlePayloadObject } from "./ocr-paddle-payload";
import type { PaddleOcrOutcome, PaddleOcrPayload } from "./ocr-paddle-payload";

const DEFAULT_OCR_PADDLE_MAX_BUFFER = 64 * 1024 * 1024;
const DEFAULT_OCR_PADDLE_REQUEST_TIMEOUT_MS = 20_000;

export const PADDLE_OCR_PYTHON_SCRIPT = String.raw`import json
import os
import sys

os.environ.setdefault("FLAGS_enable_pir_api", "0")
os.environ.setdefault("FLAGS_enable_pir_in_executor", "0")
os.environ.setdefault("FLAGS_use_mkldnn", "0")
os.environ.setdefault("FLAGS_prim_all", "0")

try:
    import paddle
    from paddleocr import PaddleOCR
    try:
        paddle.set_flags(
            {
                "FLAGS_enable_pir_api": False,
                "FLAGS_enable_pir_in_executor": False,
                "FLAGS_use_mkldnn": False,
                "FLAGS_prim_all": False,
            }
        )
    except Exception:
        pass
except Exception as exc:
    print(json.dumps({"ok": False, "error": f"import paddleocr failed: {exc}"}, ensure_ascii=False))
    sys.exit(0)


def parse_safe_mode(raw):
    if raw is None:
        return True
    if isinstance(raw, bool):
        return raw
    text = str(raw).strip().lower()
    return text not in {"0", "false", "off", "no"}


def make_engine(lang, safe_mode):
    strict_cpu = [
        {
            "lang": lang,
            "device": "cpu",
            "show_log": False,
            "enable_mkldnn": False,
            "use_doc_orientation_classify": False,
            "use_doc_unwarping": False,
            "use_textline_orientation": False,
            "use_angle_cls": False,
        },
        {"lang": lang, "show_log": False, "device": "cpu", "enable_mkldnn": False},
    ]
    performance = [
        {
            "lang": lang,
            "show_log": False,
            "enable_mkldnn": False,
            "use_doc_orientation_classify": False,
            "use_doc_unwarping": False,
            "use_textline_orientation": False,
            "use_angle_cls": False,
        },
        {"lang": lang, "show_log": False, "enable_mkldnn": False},
        {"lang": lang},
    ]
    attempts = strict_cpu if safe_mode else (performance + strict_cpu)
    errors = []
    for kwargs in attempts:
        try:
            return PaddleOCR(**kwargs)
        except Exception as exc:
            errors.append(str(exc))
    raise RuntimeError("create engine failed: " + " | ".join(errors))


def parse_line(line):
    if not isinstance(line, (list, tuple)) or len(line) < 2:
        return None
    box = line[0]
    info = line[1]
    if not isinstance(box, (list, tuple)) or len(box) == 0:
        return None
    xs = []
    ys = []
    for point in box:
        if not isinstance(point, (list, tuple)) or len(point) < 2:
            continue
        try:
            xs.append(float(point[0]))
            ys.append(float(point[1]))
        except Exception:
            continue
    if len(xs) == 0 or len(ys) == 0:
        return None
    text = ""
    confidence = -1.0
    if isinstance(info, (list, tuple)):
        if len(info) >= 1 and info[0] is not None:
            text = str(info[0]).strip()
        if len(info) >= 2:
            try:
                confidence = float(info[1])
            except Exception:
                confidence = -1.0
    else:
        text = str(info).strip()
    if not text:
        return None
    if confidence >= 0 and confidence <= 1.5:
        confidence = confidence * 100.0
    left = int(min(xs))
    top = int(min(ys))
    right = int(max(xs))
    bottom = int(max(ys))
    return {
        "text": text,
        "left": left,
        "top": top,
        "width": max(1, right - left),
        "height": max(1, bottom - top),
        "confidence": confidence,
    }


def collect_words(ocr_result):
    words = []
    texts = []
    if not isinstance(ocr_result, list):
        return words, texts
    for block in ocr_result:
        if not isinstance(block, list):
            continue
        for line in block:
            parsed = parse_line(line)
            if not parsed:
                continue
            words.append(parsed)
            texts.append(parsed["text"])
    return words, texts


def main():
    if len(sys.argv) < 3:
        print(json.dumps({"ok": False, "error": "missing args"}, ensure_ascii=False))
        return
    image_path = sys.argv[1]
    langs = [entry.strip() for entry in sys.argv[2].split(",") if entry.strip()]
    if len(langs) == 0:
        langs = ["ch"]
    safe_mode = parse_safe_mode(os.environ.get("AION2_OCR_SAFE_MODE", "1"))
    errors = []
    for lang in langs:
        try:
            ocr = make_engine(lang, safe_mode)
            try:
                result = ocr.ocr(image_path, cls=False)
            except TypeError:
                result = ocr.ocr(image_path)
            words, texts = collect_words(result)
            print(
                json.dumps(
                    {
                        "ok": True,
                        "language": lang,
                        "raw_text": "\n".join(texts),
                        "words": words,
                    },
                    ensure_ascii=False,
                )
            )
            return
        except Exception as exc:
            errors.append(f"{lang}: {exc}")
    print(json.dumps({"ok": False, "error": " | ".join(errors) or "paddle ocr failed"}, ensure_ascii=False))


if __name__ == "__main__":
    main()
`;

const PADDLE_OCR_PYTHON_WORKER_SCRIPT = String.raw`import json
import os
import sys

os.environ.setdefault("FLAGS_enable_pir_api", "0")
os.environ.setdefault("FLAGS_enable_pir_in_executor", "0")
os.environ.setdefault("FLAGS_use_mkldnn", "0")
os.environ.setdefault("FLAGS_prim_all", "0")

try:
    import paddle
    from paddleocr import PaddleOCR
    try:
        paddle.set_flags(
            {
                "FLAGS_enable_pir_api": False,
                "FLAGS_enable_pir_in_executor": False,
                "FLAGS_use_mkldnn": False,
                "FLAGS_prim_all": False,
            }
        )
    except Exception:
        pass
except Exception as exc:
    print(json.dumps({"ok": False, "error": f"import paddleocr failed: {exc}"}, ensure_ascii=False), flush=True)
    sys.exit(0)


def parse_safe_mode(raw):
    if raw is None:
        return True
    if isinstance(raw, bool):
        return raw
    text = str(raw).strip().lower()
    return text not in {"0", "false", "off", "no"}


def make_engine(lang, safe_mode):
    strict_cpu = [
        {
            "lang": lang,
            "device": "cpu",
            "show_log": False,
            "enable_mkldnn": False,
            "use_doc_orientation_classify": False,
            "use_doc_unwarping": False,
            "use_textline_orientation": False,
            "use_angle_cls": False,
        },
        {"lang": lang, "show_log": False, "device": "cpu", "enable_mkldnn": False},
    ]
    performance = [
        {
            "lang": lang,
            "show_log": False,
            "enable_mkldnn": False,
            "use_doc_orientation_classify": False,
            "use_doc_unwarping": False,
            "use_textline_orientation": False,
            "use_angle_cls": False,
        },
        {"lang": lang, "show_log": False, "enable_mkldnn": False},
        {"lang": lang},
    ]
    attempts = strict_cpu if safe_mode else (performance + strict_cpu)
    errors = []
    for kwargs in attempts:
        try:
            return PaddleOCR(**kwargs)
        except Exception as exc:
            errors.append(str(exc))
    raise RuntimeError("create engine failed: " + " | ".join(errors))


def parse_line(line):
    if not isinstance(line, (list, tuple)) or len(line) < 2:
        return None
    box = line[0]
    info = line[1]
    if not isinstance(box, (list, tuple)) or len(box) == 0:
        return None
    xs = []
    ys = []
    for point in box:
        if not isinstance(point, (list, tuple)) or len(point) < 2:
            continue
        try:
            xs.append(float(point[0]))
            ys.append(float(point[1]))
        except Exception:
            continue
    if len(xs) == 0 or len(ys) == 0:
        return None
    text = ""
    confidence = -1.0
    if isinstance(info, (list, tuple)):
        if len(info) >= 1 and info[0] is not None:
            text = str(info[0]).strip()
        if len(info) >= 2:
            try:
                confidence = float(info[1])
            except Exception:
                confidence = -1.0
    else:
        text = str(info).strip()
    if not text:
        return None
    if confidence >= 0 and confidence <= 1.5:
        confidence = confidence * 100.0
    left = int(min(xs))
    top = int(min(ys))
    right = int(max(xs))
    bottom = int(max(ys))
    return {
        "text": text,
        "left": left,
        "top": top,
        "width": max(1, right - left),
        "height": max(1, bottom - top),
        "confidence": confidence,
    }


def collect_words(ocr_result):
    words = []
    texts = []
    if not isinstance(ocr_result, list):
        return words, texts
    for block in ocr_result:
        if not isinstance(block, list):
            continue
        for line in block:
            parsed = parse_line(line)
            if not parsed:
                continue
            words.append(parsed)
            texts.append(parsed["text"])
    return words, texts


ENGINE_CACHE = {}


def get_engine(lang, safe_mode):
    key = f"{lang}|{'safe' if safe_mode else 'performance'}"
    if key in ENGINE_CACHE:
        return ENGINE_CACHE[key]
    engine = make_engine(lang, safe_mode)
    ENGINE_CACHE[key] = engine
    return engine


def resolve_languages(raw):
    if isinstance(raw, list):
        langs = [str(entry).strip() for entry in raw if str(entry).strip()]
        return langs or ["ch"]
    if isinstance(raw, str):
        langs = [entry.strip() for entry in raw.split(",") if entry.strip()]
        return langs or ["ch"]
    return ["ch"]


def process(req):
    req_id = str(req.get("id", "")).strip()
    image_path = str(req.get("image_path", "")).strip()
    if not image_path:
        return {"id": req_id, "ok": False, "error": "missing image_path"}
    langs = resolve_languages(req.get("languages"))
    safe_mode = parse_safe_mode(req.get("safe_mode", True))
    errors = []
    for lang in langs:
        try:
            ocr = get_engine(lang, safe_mode)
            try:
                result = ocr.ocr(image_path, cls=False)
            except TypeError:
                result = ocr.ocr(image_path)
            words, texts = collect_words(result)
            return {
                "id": req_id,
                "ok": True,
                "language": lang,
                "raw_text": "\n".join(texts),
                "words": words,
            }
        except Exception as exc:
            errors.append(f"{lang}: {exc}")
    return {"id": req_id, "ok": False, "error": " | ".join(errors) or "paddle ocr failed"}


def emit(payload):
    print(json.dumps(payload, ensure_ascii=False), flush=True)


def main():
    emit({"ready": True})
    for line in sys.stdin:
        text = line.strip()
        if not text:
            continue
        try:
            req = json.loads(text)
            if not isinstance(req, dict):
                emit({"ok": False, "error": "invalid request"})
                continue
        except Exception as exc:
            emit({"ok": False, "error": f"invalid json: {exc}"})
            continue
        emit(process(req))


if __name__ == "__main__":
    main()
`;

interface PaddleWorkerPendingRequest {
  resolve: (value: PaddleOcrOutcome) => void;
  reject: (reason: Error) => void;
  timeoutId: NodeJS.Timeout;
}

export interface PaddleCommandAttempt {
  command: string;
  args: string[];
  label: string;
}

export interface PaddleCommandResult {
  stdout: string;
  stderr: string;
  ok: boolean;
  errorMessage?: string;
}

export interface PaddleOcrRuntime {
  buildCommandAttempts: (script: string, scriptArgs: string[], unbuffered?: boolean) => PaddleCommandAttempt[];
  runWithWorker: (imagePath: string, candidates: string[], safeMode: boolean) => Promise<PaddleOcrOutcome>;
  runWithCommand: (command: string, args: string[], safeMode: boolean) => Promise<PaddleCommandResult>;
  hasActivity: () => boolean;
  cleanup: (reason: string) => void;
}

interface PaddleOcrRuntimeOptions {
  confidenceScale: number;
  maxBuffer?: number;
  requestTimeoutMs?: number;
  runtimeRoot?: string;
}

export function buildPaddleCommandAttempts(
  script: string,
  scriptArgs: string[],
  unbuffered = false,
): PaddleCommandAttempt[] {
  const bufferArg = unbuffered ? ["-u"] : [];
  return [
    { command: "py", args: ["-3.11", ...bufferArg, "-c", script, ...scriptArgs], label: "py-3.11" },
    { command: "py", args: ["-3", ...bufferArg, "-c", script, ...scriptArgs], label: "py-3" },
    { command: "python", args: [...bufferArg, "-c", script, ...scriptArgs], label: "python" },
  ];
}

export function createPaddleOcrRuntime(options: PaddleOcrRuntimeOptions): PaddleOcrRuntime {
  const maxBuffer = options.maxBuffer ?? DEFAULT_OCR_PADDLE_MAX_BUFFER;
  const requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_OCR_PADDLE_REQUEST_TIMEOUT_MS;
  const runtimeRoot = options.runtimeRoot ?? path.join(os.tmpdir(), "aion2-paddle-runtime");
  const runtimeUser = path.join(runtimeRoot, "user");
  const runtimeCache = path.join(runtimeRoot, "cache");
  const runtimeHome = path.join(runtimeRoot, "paddle");

  let paddleWorkerProcess: ChildProcessWithoutNullStreams | null = null;
  let paddleWorkerStartPromise: Promise<void> | null = null;
  let paddleWorkerStdoutBuffer = "";
  let paddleWorkerStderrBuffer = "";
  const paddleWorkerPendingRequests = new Map<string, PaddleWorkerPendingRequest>();

  const ensurePaddleRuntimeDirectories = (): void => {
    try {
      fs.mkdirSync(runtimeRoot, { recursive: true });
      fs.mkdirSync(runtimeUser, { recursive: true });
      fs.mkdirSync(runtimeCache, { recursive: true });
      fs.mkdirSync(runtimeHome, { recursive: true });
    } catch {
      // best effort; if mkdir fails, spawn will still try with current env
    }
  };

  const createPaddleEnv = (safeMode: boolean): NodeJS.ProcessEnv => {
    return {
      ...process.env,
      HOME: runtimeUser,
      USERPROFILE: runtimeUser,
      XDG_CACHE_HOME: runtimeCache,
      PADDLE_HOME: runtimeHome,
      PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK: "True",
      FLAGS_enable_pir_api: "0",
      FLAGS_enable_pir_in_executor: "0",
      FLAGS_use_mkldnn: "0",
      FLAGS_prim_all: "0",
      PYTHONUTF8: "1",
      PYTHONIOENCODING: "utf-8",
      AION2_OCR_SAFE_MODE: safeMode ? "1" : "0",
    };
  };

  const trimBuffer = (input: string): string => {
    if (input.length <= maxBuffer) {
      return input;
    }
    return input.slice(input.length - maxBuffer);
  };

  const resetPaddleWorkerState = (reason: string): void => {
    const worker = paddleWorkerProcess;
    paddleWorkerProcess = null;
    paddleWorkerStartPromise = null;
    paddleWorkerStdoutBuffer = "";
    paddleWorkerStderrBuffer = "";
    const error = new Error(`OCR 常驻进程不可用：${reason}`);
    paddleWorkerPendingRequests.forEach((pending) => {
      clearTimeout(pending.timeoutId);
      pending.reject(error);
    });
    paddleWorkerPendingRequests.clear();
    if (worker && !worker.killed) {
      try {
        worker.kill();
      } catch {
        // ignore worker termination failure
      }
    }
  };

  const processPaddleWorkerStdoutLine = (rawLine: string): void => {
    const line = rawLine.trim();
    if (!line) {
      return;
    }
    let parsed: PaddleOcrPayload | null = null;
    try {
      parsed = JSON.parse(line) as PaddleOcrPayload;
    } catch {
      return;
    }
    if (!parsed || parsed.ready === true) {
      return;
    }
    const requestId = typeof parsed.id === "string" ? parsed.id : "";
    if (!requestId) {
      return;
    }
    const pending = paddleWorkerPendingRequests.get(requestId);
    if (!pending) {
      return;
    }
    paddleWorkerPendingRequests.delete(requestId);
    clearTimeout(pending.timeoutId);
    pending.resolve(parsePaddlePayloadObject(parsed, options.confidenceScale));
  };

  const attachPaddleWorkerListeners = (worker: ChildProcessWithoutNullStreams): void => {
    worker.stdout.setEncoding("utf8");
    worker.stderr.setEncoding("utf8");
    worker.stdout.on("data", (chunk: string) => {
      paddleWorkerStdoutBuffer = trimBuffer(paddleWorkerStdoutBuffer + chunk);
      let lineBreakIndex = paddleWorkerStdoutBuffer.indexOf("\n");
      while (lineBreakIndex >= 0) {
        const line = paddleWorkerStdoutBuffer.slice(0, lineBreakIndex).replace(/\r$/u, "");
        paddleWorkerStdoutBuffer = paddleWorkerStdoutBuffer.slice(lineBreakIndex + 1);
        processPaddleWorkerStdoutLine(line);
        lineBreakIndex = paddleWorkerStdoutBuffer.indexOf("\n");
      }
    });
    worker.stderr.on("data", (chunk: string) => {
      paddleWorkerStderrBuffer = trimBuffer(paddleWorkerStderrBuffer + chunk);
    });
    worker.on("error", (err) => {
      if (paddleWorkerProcess !== worker) {
        return;
      }
      resetPaddleWorkerState(err.message || "进程异常");
    });
    worker.on("close", (code) => {
      if (paddleWorkerProcess !== worker) {
        return;
      }
      const stderrTail = paddleWorkerStderrBuffer.trim();
      const detail = stderrTail ? `退出码 ${code ?? -1} / ${stderrTail}` : `退出码 ${code ?? -1}`;
      resetPaddleWorkerState(detail);
    });
  };

  const startPaddleWorker = async (): Promise<void> => {
    if (paddleWorkerProcess && !paddleWorkerProcess.killed) {
      return;
    }
    if (paddleWorkerStartPromise) {
      return paddleWorkerStartPromise;
    }
    paddleWorkerStartPromise = (async () => {
      ensurePaddleRuntimeDirectories();
      const attempts = buildPaddleCommandAttempts(PADDLE_OCR_PYTHON_WORKER_SCRIPT, [], true);
      const errors: string[] = [];
      for (const attempt of attempts) {
        try {
          const worker = await new Promise<ChildProcessWithoutNullStreams>((resolve, reject) => {
            let settled = false;
            const child = spawn(attempt.command, attempt.args, {
              windowsHide: true,
              env: createPaddleEnv(true),
              shell: false,
            });
            const finishResolve = (): void => {
              if (settled) {
                return;
              }
              settled = true;
              resolve(child);
            };
            const finishReject = (message: string): void => {
              if (settled) {
                return;
              }
              settled = true;
              reject(new Error(message));
            };
            child.once("spawn", finishResolve);
            child.once("error", (err) => finishReject(err.message || "启动失败"));
            child.once("close", (code) => finishReject(`启动后立即退出: ${code ?? -1}`));
          });
          paddleWorkerProcess = worker;
          paddleWorkerStdoutBuffer = "";
          paddleWorkerStderrBuffer = "";
          attachPaddleWorkerListeners(worker);
          return;
        } catch (err) {
          const message = err instanceof Error ? err.message : "启动失败";
          errors.push(`${attempt.label}: ${message}`);
        }
      }
      throw new Error(errors.join(" | ") || "无法启动 OCR 常驻进程。");
    })();
    try {
      await paddleWorkerStartPromise;
    } finally {
      paddleWorkerStartPromise = null;
    }
  };

  const runWithWorker = async (imagePath: string, candidates: string[], safeMode: boolean): Promise<PaddleOcrOutcome> => {
    await startPaddleWorker();
    const worker = paddleWorkerProcess;
    if (!worker || worker.killed || worker.stdin.destroyed) {
      throw new Error("OCR 常驻进程未就绪。");
    }
    const requestId = randomUUID();
    return new Promise<PaddleOcrOutcome>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        if (paddleWorkerPendingRequests.delete(requestId)) {
          resetPaddleWorkerState("请求超时");
          reject(new Error(`OCR 常驻请求超时（>${requestTimeoutMs}ms）`));
        }
      }, requestTimeoutMs);
      paddleWorkerPendingRequests.set(requestId, { resolve, reject, timeoutId });
      try {
        worker.stdin.write(
          `${JSON.stringify({ id: requestId, image_path: imagePath, languages: candidates, safe_mode: safeMode })}\n`,
          "utf8",
        );
      } catch (err) {
        clearTimeout(timeoutId);
        paddleWorkerPendingRequests.delete(requestId);
        const message = err instanceof Error ? err.message : "发送请求失败";
        reject(new Error(message));
      }
    });
  };

  const runWithCommand = async (
    command: string,
    args: string[],
    safeMode: boolean,
  ): Promise<PaddleCommandResult> => {
    ensurePaddleRuntimeDirectories();
    return new Promise((resolve) => {
      const child = spawn(command, args, {
        windowsHide: true,
        env: createPaddleEnv(safeMode),
        shell: false,
      });
      let stdout = "";
      let stderr = "";
      let resolved = false;
      const finish = (value: PaddleCommandResult): void => {
        if (resolved) {
          return;
        }
        resolved = true;
        resolve(value);
      };
      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk: string) => {
        stdout += chunk;
        if (stdout.length + stderr.length > maxBuffer) {
          child.kill();
          finish({
            stdout,
            stderr,
            ok: false,
            errorMessage: "OCR 输出过大，已中断。",
          });
        }
      });
      child.stderr.on("data", (chunk: string) => {
        stderr += chunk;
        if (stdout.length + stderr.length > maxBuffer) {
          child.kill();
          finish({
            stdout,
            stderr,
            ok: false,
            errorMessage: "OCR 输出过大，已中断。",
          });
        }
      });
      child.on("error", (err) => {
        finish({
          stdout,
          stderr,
          ok: false,
          errorMessage: err.message,
        });
      });
      child.on("close", (code) => {
        if (code !== 0 && !stdout.trim()) {
          finish({
            stdout,
            stderr,
            ok: false,
            errorMessage: stderr.trim() || `进程退出码 ${code ?? -1}`,
          });
          return;
        }
        finish({
          stdout,
          stderr,
          ok: true,
        });
      });
    });
  };

  const hasActivity = (): boolean => {
    return Boolean(paddleWorkerProcess) || paddleWorkerPendingRequests.size > 0;
  };

  const cleanup = (reason: string): void => {
    if (!hasActivity()) {
      return;
    }
    resetPaddleWorkerState(reason);
  };

  return {
    buildCommandAttempts: buildPaddleCommandAttempts,
    runWithWorker,
    runWithCommand,
    hasActivity,
    cleanup,
  };
}
