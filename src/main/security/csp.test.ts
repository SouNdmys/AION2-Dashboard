import { describe, expect, it } from "vitest";
import { buildRendererContentSecurityPolicy, withContentSecurityPolicyHeader } from "./csp";

describe("main/security/csp", () => {
  it("builds strict production policy without eval allowance", () => {
    const csp = buildRendererContentSecurityPolicy(false);

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).not.toContain("http://localhost:*");
  });

  it("builds relaxed development policy for vite hmr", () => {
    const csp = buildRendererContentSecurityPolicy(true);

    expect(csp).toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval'");
    expect(csp).toContain("connect-src 'self' http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:*");
  });

  it("injects csp header and preserves unrelated headers", () => {
    const next = withContentSecurityPolicyHeader(
      {
        "x-test": ["ok"],
        "Content-Security-Policy": ["default-src 'none'"],
      },
      "default-src 'self'",
    );

    expect(next["x-test"]).toEqual(["ok"]);
    expect(next["Content-Security-Policy"]).toEqual(["default-src 'self'"]);
    expect(Object.keys(next).filter((key) => key.toLowerCase() === "content-security-policy")).toHaveLength(1);
  });
});
