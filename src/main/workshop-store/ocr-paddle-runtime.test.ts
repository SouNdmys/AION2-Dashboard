import { describe, expect, it } from "vitest";
import { buildPaddleCommandAttempts, createPaddleOcrRuntime } from "./ocr-paddle-runtime";

describe("workshop/ocr-paddle-runtime", () => {
  it("builds python command attempts with optional unbuffered flag", () => {
    const buffered = buildPaddleCommandAttempts("print(1)", ["a", "b"]);
    expect(buffered).toEqual([
      { command: "py", args: ["-3.11", "-c", "print(1)", "a", "b"], label: "py-3.11" },
      { command: "py", args: ["-3", "-c", "print(1)", "a", "b"], label: "py-3" },
      { command: "python", args: ["-c", "print(1)", "a", "b"], label: "python" },
    ]);

    const unbuffered = buildPaddleCommandAttempts("print(1)", ["x"], true);
    expect(unbuffered[0].args).toEqual(["-3.11", "-u", "-c", "print(1)", "x"]);
    expect(unbuffered[1].args).toEqual(["-3", "-u", "-c", "print(1)", "x"]);
    expect(unbuffered[2].args).toEqual(["-u", "-c", "print(1)", "x"]);
  });

  it("starts idle and allows no-op cleanup", () => {
    const runtime = createPaddleOcrRuntime({ confidenceScale: 100 });
    expect(runtime.hasActivity()).toBe(false);
    runtime.cleanup("unit-test");
    expect(runtime.hasActivity()).toBe(false);
  });
});
