export type ResponseHeadersLike = Record<string, string[] | string | undefined> | undefined;

function normalizeDirective(directive: string, values: string[]): string {
  return `${directive} ${values.join(" ")}`;
}

export function buildRendererContentSecurityPolicy(isDev: boolean): string {
  if (isDev) {
    return [
      normalizeDirective("default-src", ["'self'"]),
      normalizeDirective("script-src", ["'self'", "'unsafe-inline'", "'unsafe-eval'", "http://localhost:*", "http://127.0.0.1:*"]),
      normalizeDirective("style-src", ["'self'", "'unsafe-inline'", "http://localhost:*", "http://127.0.0.1:*"]),
      normalizeDirective("img-src", ["'self'", "data:", "blob:", "http://localhost:*", "http://127.0.0.1:*"]),
      normalizeDirective("font-src", ["'self'", "data:", "http://localhost:*", "http://127.0.0.1:*"]),
      normalizeDirective("connect-src", ["'self'", "http://localhost:*", "http://127.0.0.1:*", "ws://localhost:*", "ws://127.0.0.1:*"]),
      normalizeDirective("object-src", ["'none'"]),
      normalizeDirective("base-uri", ["'self'"]),
      normalizeDirective("frame-ancestors", ["'none'"]),
    ].join("; ");
  }

  return [
    normalizeDirective("default-src", ["'self'"]),
    normalizeDirective("script-src", ["'self'"]),
    normalizeDirective("style-src", ["'self'", "'unsafe-inline'"]),
    normalizeDirective("img-src", ["'self'", "data:", "blob:"]),
    normalizeDirective("font-src", ["'self'", "data:"]),
    normalizeDirective("connect-src", ["'self'"]),
    normalizeDirective("object-src", ["'none'"]),
    normalizeDirective("base-uri", ["'self'"]),
    normalizeDirective("frame-ancestors", ["'none'"]),
  ].join("; ");
}

export function withContentSecurityPolicyHeader(
  responseHeaders: ResponseHeadersLike,
  policy: string,
): Record<string, string[]> {
  const next: Record<string, string[]> = {};
  Object.entries(responseHeaders ?? {}).forEach(([key, value]) => {
    if (key.toLowerCase() === "content-security-policy") {
      return;
    }
    if (Array.isArray(value)) {
      next[key] = value.map((item) => String(item));
      return;
    }
    if (typeof value === "string") {
      next[key] = [value];
    }
  });
  next["Content-Security-Policy"] = [policy];
  return next;
}
