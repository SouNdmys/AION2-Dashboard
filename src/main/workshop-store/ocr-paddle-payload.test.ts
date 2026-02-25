import { describe, expect, it } from "vitest";
import { parsePaddlePayload, parsePaddlePayloadObject } from "./ocr-paddle-payload";

describe("workshop/ocr-paddle-payload", () => {
  it("parses noisy stdout and normalizes OCR words", () => {
    const stdout = [
      "bootstrap log",
      "{\"ok\":true,\"language\":\"en\",\"words\":[{\"text\":\" Foo \",\"left\":10.7,\"top\":20.1,\"width\":0.4,\"height\":2.9,\"confidence\":0.9},{\"text\":\" \",\"left\":1}],\"raw_text\":\"\"}",
    ].join("\n");

    const result = parsePaddlePayload(stdout, 100);
    expect(result.ok).toBe(true);
    expect(result.language).toBe("en");
    expect(result.rawText).toBe("");
    expect(result.words).toHaveLength(1);
    expect(result.words[0]).toMatchObject({
      text: "Foo",
      left: 10,
      top: 20,
      width: 1,
      height: 2,
      confidence: 90,
    });
  });

  it("extracts object payload even when ANSI logs are present", () => {
    const stdout = `\u001b[33mwarn\u001b[0m\n{"ok":false,"error":"worker failed"}`;
    const result = parsePaddlePayload(stdout, 100);
    expect(result.ok).toBe(false);
    expect(result.errorMessage).toBe("worker failed");
  });

  it("returns parse error when payload JSON is missing", () => {
    const result = parsePaddlePayload("not a json payload", 100);
    expect(result.ok).toBe(false);
    expect(result.errorMessage?.includes("OCR 输出 JSON 解析失败")).toBe(true);
  });

  it("falls back to joined word text when raw_text is missing", () => {
    const result = parsePaddlePayloadObject(
      {
        ok: true,
        language: "ch",
        words: [{ text: "奥德矿石", confidence: 0.88 }, { text: "燦爛", confidence: 0.9 }],
      },
      100,
    );
    expect(result.ok).toBe(true);
    expect(result.language).toBe("ch");
    expect(result.rawText).toBe("奥德矿石\n燦爛");
  });
});
