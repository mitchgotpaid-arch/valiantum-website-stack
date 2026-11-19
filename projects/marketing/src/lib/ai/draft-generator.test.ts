import { describe, expect, it } from "vitest";
import { buildDraftMessages, estimateDraftCostMicros } from "./draft-generator";

describe("AI draft generation boundaries", () => {
  it("omits signed logo URLs from text prompts and includes fail-closed instructions", () => {
    const messages = buildDraftMessages({
      contentType: "SOCIAL_POST",
      brief: "Announce the weekly recap.",
      brand: { name: "Nati Sports", voice: "Direct", logoAssetUrl: "https://signed.example/logo?secret=1" },
    });
    expect(messages[0].content).toContain("Never publish");
    expect(messages[1].content).toContain("Nati Sports");
    expect(messages[1].content).not.toContain("signed.example");
  });

  it("estimates the configured low-cost model in integer microdollars", () => {
    expect(estimateDraftCostMicros("gpt-6-luna", 1_000, 500)).toBe(350);
    expect(estimateDraftCostMicros("custom-model", 1_000, 500)).toBe(10_000);
  });
});
