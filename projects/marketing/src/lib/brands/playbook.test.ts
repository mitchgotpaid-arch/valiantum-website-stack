import { describe, expect, it } from "vitest";
import { brandInputSchema } from "./schema";
import { compactBrandPlaybook, parseBrandPlaybook } from "./playbook";

const minimalInput = {
  name: "Nati Sports",
  slug: "nati-sports",
  description: "",
  websiteUrl: "",
  industry: "",
  targetAudience: "",
  brandVoice: "",
  marketingObjectives: "",
  contentPillars: "",
  freeformInstructions: "",
};

describe("Brand Playbook", () => {
  it("provides stable empty values for old and blank profiles", () => {
    expect(parseBrandPlaybook(null)).toMatchObject({ mission: "", offers: [], officialSources: [] });
    expect(compactBrandPlaybook(brandInputSchema.parse(minimalInput))).toEqual({});
  });

  it("stores only populated settings and normalizes saved data", () => {
    const input = brandInputSchema.parse({
      ...minimalInput,
      mission: "  Keep Cincinnati fans informed. ",
      differentiators: "Local expertise\n\nAccuracy first",
      officialSources: "https://www.mlb.com/reds",
    });
    const compact = compactBrandPlaybook(input);
    expect(compact).toEqual({
      mission: "Keep Cincinnati fans informed.",
      differentiators: ["Local expertise", "Accuracy first"],
      officialSources: ["https://www.mlb.com/reds"],
    });
    expect(parseBrandPlaybook(compact)).toMatchObject(compact);
  });

  it("rejects malformed official source URLs", () => {
    const result = brandInputSchema.safeParse({ ...minimalInput, officialSources: "reds.example.com" });
    expect(result.success).toBe(false);
  });
});
