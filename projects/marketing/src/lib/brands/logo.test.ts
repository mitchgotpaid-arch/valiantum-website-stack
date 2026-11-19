import { describe, expect, it } from "vitest";
import { BRAND_LOGO_MAX_BYTES, validateBrandLogo } from "./logo";

describe("Brand logo validation", () => {
  it("accepts supported image signatures", () => {
    expect(validateBrandLogo("image/png", 8, new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBeNull();
    expect(validateBrandLogo("image/jpeg", 3, new Uint8Array([0xff, 0xd8, 0xff]))).toBeNull();
    expect(validateBrandLogo("image/webp", 12, new TextEncoder().encode("RIFF0000WEBP"))).toBeNull();
  });

  it("rejects unsupported, oversized, and spoofed files", () => {
    expect(validateBrandLogo("image/svg+xml", 10, new Uint8Array(10))).toContain("PNG");
    expect(validateBrandLogo("image/png", BRAND_LOGO_MAX_BYTES + 1, new Uint8Array(8))).toContain("5 MB");
    expect(validateBrandLogo("image/png", 8, new Uint8Array(8))).toContain("contents");
  });
});
