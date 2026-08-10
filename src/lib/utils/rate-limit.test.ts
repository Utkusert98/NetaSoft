import { describe, it, expect } from "vitest";
import { rateLimit } from "./rate-limit";

describe("rateLimit", () => {
  it("limit içindeyken isteklere izin verir", () => {
    const key = `test-${Math.random()}`;
    const r1 = rateLimit(key, 3, 60_000);
    const r2 = rateLimit(key, 3, 60_000);
    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(1);
  });

  it("limit aşıldığında isteği reddeder", () => {
    const key = `test-${Math.random()}`;
    rateLimit(key, 2, 60_000);
    rateLimit(key, 2, 60_000);
    const blocked = rateLimit(key, 2, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("pencere süresi dolunca sayaç sıfırlanır", () => {
    const key = `test-${Math.random()}`;
    rateLimit(key, 1, 1);
    const afterWindow = new Promise((resolve) => setTimeout(resolve, 10)).then(() =>
      rateLimit(key, 1, 60_000)
    );
    return afterWindow.then((result) => {
      expect((result as { allowed: boolean }).allowed).toBe(true);
    });
  });
});
