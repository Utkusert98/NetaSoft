import { describe, it, expect } from "vitest";
import { toCapitalCase, formatCurrency, formatFileSize, getInitials } from "./index";

describe("toCapitalCase", () => {
  it("her kelimenin ilk harfini büyütür", () => {
    expect(toCapitalCase("toplam gelir")).toBe("Toplam Gelir");
  });

  it("boş string için boş string döner", () => {
    expect(toCapitalCase("")).toBe("");
  });
});

describe("formatCurrency", () => {
  it("sayısal tutarı TL olarak formatlar", () => {
    expect(formatCurrency(1234.5)).toContain("1.234,50");
  });

  it("string tutarı da kabul eder", () => {
    expect(formatCurrency("500")).toContain("500,00");
  });
});

describe("formatFileSize", () => {
  it("0 bayt için '0 B' döner", () => {
    expect(formatFileSize(0)).toBe("0 B");
  });

  it("KB birimine dönüştürür", () => {
    expect(formatFileSize(2048)).toBe("2 KB");
  });
});

describe("getInitials", () => {
  it("ad soyadın baş harflerini büyük olarak döner", () => {
    expect(getInitials("ahmet yılmaz")).toBe("AY");
  });
});
