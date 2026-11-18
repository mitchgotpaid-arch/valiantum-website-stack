import { describe, expect, it } from "vitest";
import { decryptProviderCredential, encryptProviderCredential } from "./credential-crypto";

describe("provider credential encryption", () => {
  const secret = "0123456789abcdef0123456789abcdef";
  const context = "brand:11111111-1111-4111-8111-111111111111:provider:META";

  it("round trips credentials only with the matching context", () => {
    const value = { accessToken: "token", pageId: "page" };
    const encrypted = encryptProviderCredential(value, secret, context);
    expect(encrypted).not.toContain("token");
    expect(decryptProviderCredential(encrypted, secret, context)).toEqual(value);
    expect(() => decryptProviderCredential(encrypted, secret, `${context}:wrong`)).toThrow();
  });

  it("rejects tampered ciphertext", () => {
    const encrypted = encryptProviderCredential({ accessToken: "token" }, secret, context);
    const parts = encrypted.split(".");
    parts[2] = `${parts[2].startsWith("A") ? "B" : "A"}${parts[2].slice(1)}`;
    const tampered = parts.join(".");
    expect(() => decryptProviderCredential(tampered, secret, context)).toThrow();
  });
});
