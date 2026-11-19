import { describe, expect, it } from "vitest";
import { evaluateAutomaticPublication, type AutomaticPublicationContext, type PublicationBlockCode } from "./publishing-eligibility";

const safeContext: AutomaticPublicationContext = {
  globalAutoPublishEnabled: true,
  brandPublishingEnabled: true,
  autonomyLevel: 3,
  riskLevel: "LOW",
  verificationStatus: "VERIFIED",
  approvalStatus: "NOT_REQUIRED",
  hasProhibitedClaim: false,
  mediaPolicySatisfied: true,
  isDuplicate: false,
  providerCredentialsAvailable: true,
  idempotencyKey: "brand:content:destination:v1",
  aiBudgetHardLimitExceeded: false,
};

function expectBlocked(change: Partial<AutomaticPublicationContext>, code: PublicationBlockCode) {
  const result = evaluateAutomaticPublication({ ...safeContext, ...change });
  expect(result.eligible).toBe(false);
  expect(result.blocks).toContain(code);
}

describe("automatic publication eligibility", () => {
  it("allows only a fully eligible context", () => expect(evaluateAutomaticPublication(safeContext)).toEqual({ eligible: true, blocks: [] }));
  it("enforces the global kill switch", () => expectBlocked({ globalAutoPublishEnabled: false }, "GLOBAL_AUTO_PUBLISH_DISABLED"));
  it("enforces the brand kill switch", () => expectBlocked({ brandPublishingEnabled: false }, "BRAND_PUBLISHING_DISABLED"));
  it("does not auto-publish at manual autonomy", () => expectBlocked({ autonomyLevel: 1 }, "MANUAL_AUTONOMY"));
  it("blocks content with BLOCKED risk", () => expectBlocked({ riskLevel: "BLOCKED" }, "CONTENT_BLOCKED"));
  it.each(["UNVERIFIED", "CONFLICTING", "INCORRECT"] as const)("blocks %s claims", (verificationStatus) => expectBlocked({ verificationStatus }, "VERIFICATION_INSUFFICIENT"));
  it("requires a recorded mandatory approval", () => expectBlocked({ approvalStatus: "PENDING" }, "HUMAN_APPROVAL_REQUIRED"));
  it("honors a human rejection", () => expectBlocked({ approvalStatus: "REJECTED" }, "HUMAN_APPROVAL_REJECTED"));
  it("blocks prohibited claims", () => expectBlocked({ hasProhibitedClaim: true }, "PROHIBITED_CLAIM"));
  it("enforces media policy", () => expectBlocked({ mediaPolicySatisfied: false }, "MEDIA_POLICY_FAILED"));
  it("blocks duplicate publication", () => expectBlocked({ isDuplicate: true }, "DUPLICATE_PUBLICATION"));
  it("requires provider credentials", () => expectBlocked({ providerCredentialsAvailable: false }, "MISSING_CREDENTIALS"));
  it("requires idempotency", () => expectBlocked({ idempotencyKey: " " }, "MISSING_IDEMPOTENCY_KEY"));
  it("enforces a hard AI budget limit", () => expectBlocked({ aiBudgetHardLimitExceeded: true }, "AI_BUDGET_EXCEEDED"));
  it("reports every applicable block instead of failing open", () => {
    const result = evaluateAutomaticPublication({ ...safeContext, globalAutoPublishEnabled: false, riskLevel: "BLOCKED", verificationStatus: "INCORRECT" });
    expect(result.blocks).toEqual(["GLOBAL_AUTO_PUBLISH_DISABLED", "CONTENT_BLOCKED", "VERIFICATION_INSUFFICIENT"]);
  });
});
