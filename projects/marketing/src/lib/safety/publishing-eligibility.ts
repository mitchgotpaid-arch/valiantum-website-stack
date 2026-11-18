export type AutonomyLevel = 1 | 2 | 3 | 4;
export type VerificationStatus = "VERIFIED" | "SUPPORTED" | "UNVERIFIED" | "CONFLICTING" | "INCORRECT";
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "BLOCKED";
export type ApprovalStatus = "NOT_REQUIRED" | "PENDING" | "APPROVED" | "REJECTED";

export type PublicationBlockCode =
  | "GLOBAL_AUTO_PUBLISH_DISABLED"
  | "BRAND_PUBLISHING_DISABLED"
  | "MANUAL_AUTONOMY"
  | "CONTENT_BLOCKED"
  | "VERIFICATION_INSUFFICIENT"
  | "HUMAN_APPROVAL_REQUIRED"
  | "HUMAN_APPROVAL_REJECTED"
  | "PROHIBITED_CLAIM"
  | "MEDIA_POLICY_FAILED"
  | "DUPLICATE_PUBLICATION"
  | "MISSING_CREDENTIALS"
  | "MISSING_IDEMPOTENCY_KEY"
  | "AI_BUDGET_EXCEEDED";

export interface AutomaticPublicationContext {
  globalAutoPublishEnabled: boolean;
  brandPublishingEnabled: boolean;
  autonomyLevel: AutonomyLevel;
  riskLevel: RiskLevel;
  verificationStatus: VerificationStatus;
  approvalStatus: ApprovalStatus;
  hasProhibitedClaim: boolean;
  mediaPolicySatisfied: boolean;
  isDuplicate: boolean;
  providerCredentialsAvailable: boolean;
  idempotencyKey?: string;
  aiBudgetHardLimitExceeded: boolean;
}

export interface PublicationEligibility {
  eligible: boolean;
  blocks: PublicationBlockCode[];
}

export function evaluateAutomaticPublication(context: AutomaticPublicationContext): PublicationEligibility {
  const blocks: PublicationBlockCode[] = [];
  if (!context.globalAutoPublishEnabled) blocks.push("GLOBAL_AUTO_PUBLISH_DISABLED");
  if (!context.brandPublishingEnabled) blocks.push("BRAND_PUBLISHING_DISABLED");
  if (context.autonomyLevel === 1) blocks.push("MANUAL_AUTONOMY");
  if (context.riskLevel === "BLOCKED") blocks.push("CONTENT_BLOCKED");
  if (!(["VERIFIED", "SUPPORTED"] as VerificationStatus[]).includes(context.verificationStatus)) blocks.push("VERIFICATION_INSUFFICIENT");
  if (context.approvalStatus === "PENDING") blocks.push("HUMAN_APPROVAL_REQUIRED");
  if (context.approvalStatus === "REJECTED") blocks.push("HUMAN_APPROVAL_REJECTED");
  if (context.hasProhibitedClaim) blocks.push("PROHIBITED_CLAIM");
  if (!context.mediaPolicySatisfied) blocks.push("MEDIA_POLICY_FAILED");
  if (context.isDuplicate) blocks.push("DUPLICATE_PUBLICATION");
  if (!context.providerCredentialsAvailable) blocks.push("MISSING_CREDENTIALS");
  if (!context.idempotencyKey?.trim()) blocks.push("MISSING_IDEMPOTENCY_KEY");
  if (context.aiBudgetHardLimitExceeded) blocks.push("AI_BUDGET_EXCEEDED");
  return { eligible: blocks.length === 0, blocks };
}
