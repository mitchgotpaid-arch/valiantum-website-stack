import { describe, expect, it } from "vitest";
import { brandFactInputSchema, brandRuleInputSchema, brandSourceInputSchema, mediaPolicyInputSchema } from "./governance-schema";

describe("brand governance input", () => {
  it("accepts a namespaced fact key and explicit human verification state", () => {
    const result = brandFactInputSchema.parse({ factKey: "pricing.monthly", value: "$9.99", verificationStatus: "VERIFIED", sourceUrl: "https://example.com/pricing" });
    expect(result.factKey).toBe("pricing.monthly");
  });

  it("rejects a fact without a value or trustworthy URL shape", () => {
    expect(brandFactInputSchema.safeParse({ factKey: "Feature Name", value: "", verificationStatus: "UNVERIFIED", sourceUrl: "example.com" }).success).toBe(false);
  });

  it("requires a web source for supported or verified facts", () => {
    expect(brandFactInputSchema.safeParse({ factKey: "pricing.monthly", value: "$9.99", verificationStatus: "VERIFIED", sourceUrl: "" }).success).toBe(false);
    expect(brandFactInputSchema.safeParse({ factKey: "pricing.monthly", value: "$9.99", verificationStatus: "UNVERIFIED", sourceUrl: "" }).success).toBe(true);
    expect(brandFactInputSchema.safeParse({ factKey: "pricing.monthly", value: "$9.99", verificationStatus: "UNVERIFIED", sourceUrl: "javascript:alert(1)" }).success).toBe(false);
  });

  it("requires structured constitution rule types", () => {
    expect(brandRuleInputSchema.parse({ ruleType: "NEVER", ruleText: "Invent customer testimonials." }).ruleType).toBe("NEVER");
    expect(brandRuleInputSchema.safeParse({ ruleType: "SOMETIMES", ruleText: "Maybe" }).success).toBe(false);
  });

  it("constrains sources to tiers 1 through 4 and HTTP(S)", () => {
    expect(brandSourceInputSchema.safeParse({ name: "Official", baseUrl: "https://example.com", sourceTier: 1, isApproved: true }).success).toBe(true);
    expect(brandSourceInputSchema.safeParse({ name: "Bad", baseUrl: "file:///tmp/x", sourceTier: 5, isApproved: true }).success).toBe(false);
    expect(brandSourceInputSchema.safeParse({ name: "Forum", baseUrl: "https://example.com", sourceTier: 4, isApproved: true }).success).toBe(false);
    expect(brandSourceInputSchema.safeParse({ name: "No URL", baseUrl: "", sourceTier: 1, isApproved: true }).success).toBe(false);
  });

  it("keeps real-person likeness policy explicitly tri-state", () => {
    const base = { aiIllustrationsAllowed: false, aiBackgroundsAllowed: false, realPersonPhotosRequireApproval: true, textGraphicsAllowed: true, statisticalGraphicsAllowed: true, policyNotes: "" };
    expect(mediaPolicyInputSchema.safeParse({ ...base, aiRealPersonLikenesses: "UNSET" }).success).toBe(true);
    expect(mediaPolicyInputSchema.safeParse({ ...base, aiRealPersonLikenesses: "maybe" }).success).toBe(false);
  });
});
