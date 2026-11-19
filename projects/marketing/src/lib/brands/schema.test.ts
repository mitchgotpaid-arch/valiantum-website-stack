import { describe, expect, it } from "vitest";
import { brandInputSchema } from "./schema";
import { slugifyBrandName } from "./slug";

describe("brand input", () => {
  it("creates stable URL-safe slugs", () => {
    expect(slugifyBrandName("Nati Sports & More!" )).toBe("nati-sports-more");
    expect(slugifyBrandName("  PantryWise  ")).toBe("pantrywise");
  });

  it("accepts a safe minimal brand", () => {
    expect(brandInputSchema.parse({
      name: "PantryWise",
      slug: "pantrywise",
      description: "",
      websiteUrl: "",
      industry: "",
      targetAudience: "",
      brandVoice: "",
      marketingObjectives: "",
      contentPillars: "",
      freeformInstructions: "",
    })).toMatchObject({ name: "PantryWise", websiteUrl: null, industry: null, marketingObjectives: [], contentPillars: [] });
  });

  it("rejects malformed slugs and incomplete URLs", () => {
    const result = brandInputSchema.safeParse({
      name: "Example",
      slug: "Example Brand",
      description: "",
      websiteUrl: "example.com",
      industry: "",
      targetAudience: "",
      brandVoice: "",
      marketingObjectives: "",
      contentPillars: "",
      freeformInstructions: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-web URL schemes", () => {
    const result = brandInputSchema.safeParse({ name: "Example", slug: "example", description: "", websiteUrl: "javascript:alert(1)", industry: "", targetAudience: "", brandVoice: "", marketingObjectives: "", contentPillars: "", freeformInstructions: "" });
    expect(result.success).toBe(false);
  });

  it("converts line-based settings into clean lists", () => {
    const result = brandInputSchema.parse({ name: "Nati Sports", slug: "nati-sports", description: "", websiteUrl: "", industry: "", targetAudience: "", brandVoice: "", marketingObjectives: "Grow subscriptions\n\nIncrease discussion", contentPillars: "Reds\n Bengals ", freeformInstructions: "" });
    expect(result.marketingObjectives).toEqual(["Grow subscriptions", "Increase discussion"]);
    expect(result.contentPillars).toEqual(["Reds", "Bengals"]);
  });
});
