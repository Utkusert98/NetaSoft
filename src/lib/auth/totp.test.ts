import { describe, it, expect } from "vitest";
import * as OTPAuth from "otpauth";
import { createTotp, verifyTotpCode } from "./totp";

const EMAIL = "eczaci@example.com";

function makeSecret(): string {
  return new OTPAuth.Secret({ size: 20 }).base32;
}

describe("createTotp", () => {
  it("ayarlar sayfası kurulum akışıyla aynı parametrelerle TOTP oluşturur", () => {
    const secret = makeSecret();
    const totp = createTotp(EMAIL, secret);
    expect(totp.issuer).toBe("NetaSoft");
    expect(totp.label).toBe(EMAIL);
    expect(totp.algorithm).toBe("SHA1");
    expect(totp.digits).toBe(6);
    expect(totp.period).toBe(30);
  });
});

describe("verifyTotpCode", () => {
  it("kabul eder: o an geçerli olan kod", () => {
    const secret = makeSecret();
    const totp = createTotp(EMAIL, secret);
    const code = totp.generate();
    expect(verifyTotpCode(EMAIL, secret, code)).toBe(true);
  });

  it("reddeder: yanlış kod", () => {
    const secret = makeSecret();
    const totp = createTotp(EMAIL, secret);
    const code = totp.generate();
    // Geçerli kodu bozarak kesin olarak yanlış bir kod üret.
    const wrongCode = code === "000000" ? "111111" : "000000";
    expect(verifyTotpCode(EMAIL, secret, wrongCode)).toBe(false);
  });

  it("reddeder: boş kod", () => {
    const secret = makeSecret();
    expect(verifyTotpCode(EMAIL, secret, "")).toBe(false);
  });

  it("reddeder: boş gizli anahtar", () => {
    expect(verifyTotpCode(EMAIL, "", "123456")).toBe(false);
  });

  it("reddeder: 6 haneden farklı uzunlukta kod", () => {
    const secret = makeSecret();
    expect(verifyTotpCode(EMAIL, secret, "12345")).toBe(false);
    expect(verifyTotpCode(EMAIL, secret, "1234567")).toBe(false);
  });

  it("reddeder: rakam olmayan kod", () => {
    const secret = makeSecret();
    expect(verifyTotpCode(EMAIL, secret, "abcdef")).toBe(false);
  });

  it("kabul eder: bir önceki periyottaki kod (zaman kayması toleransı)", () => {
    const secret = makeSecret();
    const totp = createTotp(EMAIL, secret);
    const previousStep = totp.generate({ timestamp: Date.now() - 30_000 });
    expect(verifyTotpCode(EMAIL, secret, previousStep)).toBe(true);
  });
});
