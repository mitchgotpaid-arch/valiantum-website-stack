import { describe, expect, it } from "vitest";
import type { BrandSummary } from "@/data/brands";
import { parseBrandPlaybook } from "./playbook";
import { buildBrandAgentContext } from "./agent-context";

const minimalBrand: BrandSummary = {
  id: "5e24b103-9b7d-45c2-8648-a3a4d84d6e08",
  name: "Nati Sports",
  slug: "nati-sports",
  description: "",
  websiteUrl: null,
  industry: null,
  targetAudience: null,
  brandVoice: null,
  marketingObjectives: [],
  contentPillars: [],
  freeformInstructions: "",
  playbook: parseBrandPlaybook({}),
  logoPath: null,
  logoUrl: null,
  autonomy: "LEVEL_1_MANUAL",
  publishingEnabled: false,
  updatedAt: "2026-09-24T00:00:00.000Z",
};

describe("Brand Agent context", () => {
  it("omits every optional setting when it is blank", () => {
    expect(buildBrandAgentContext(minimalBrand)).toEqual({ name: "Nati Sports" });
  });

  it("includes only populated settings and removes blank list items", () => {
    expect(buildBrandAgentContext({
      ...minimalBrand,
      websiteUrl: "https://natisports.net",
      contentPillars: ["Cincinnati Reds", "  ", "Cincinnati Bengals"],
      freeformInstructions: "  Clearly label rumors.  ",
      logoPath: "5e24b103-9b7d-45c2-8648-a3a4d84d6e08/logo",
      logoUrl: "https://assets.example.test/signed-logo",
      playbook: parseBrandPlaybook({
        positioning: "The independent Cincinnati sports desk.",
        differentiators: ["Local expertise", "  "],
        audienceObjections: ["Too much unverified rumor coverage"],
        officialSources: ["https://www.mlb.com/reds"],
        approvedExamples: "Direct, local, and sourced.",
      }),
    })).toEqual({
      name: "Nati Sports",
      website: "https://natisports.net",
      coverage: ["Cincinnati Reds", "Cincinnati Bengals"],
      instructionsAndBoundaries: "Clearly label rumors.",
      logoAssetUrl: "https://assets.example.test/signed-logo",
      strategy: {
        positioning: "The independent Cincinnati sports desk.",
        differentiators: ["Local expertise"],
      },
      audienceIntelligence: { objections: ["Too much unverified rumor coverage"] },
      officialSources: ["https://www.mlb.com/reds"],
      examples: { approved: "Direct, local, and sourced." },
    });
  });
});
