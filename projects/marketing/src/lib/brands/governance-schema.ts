import { z } from "zod";

function isHttpUrl(value: string) {
  if (!value) return true;
  try { return ["http:", "https:"].includes(new URL(value).protocol); } catch { return false; }
}

const optionalUrl = z.string().trim().max(500).refine(isHttpUrl, "Enter a complete http:// or https:// URL.").transform((value) => value || null);

export const brandFactInputSchema = z.object({
  factKey: z.string().trim().min(1, "Fact key is required.").max(120).regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/, "Use lowercase letters, numbers, dots, underscores, or hyphens."),
  value: z.string().trim().min(1, "Fact value is required.").max(4_000),
  verificationStatus: z.enum(["VERIFIED", "SUPPORTED", "UNVERIFIED", "CONFLICTING", "INCORRECT"]),
  sourceUrl: optionalUrl,
}).superRefine((fact, context) => {
  if (["VERIFIED", "SUPPORTED"].includes(fact.verificationStatus) && !fact.sourceUrl) {
    context.addIssue({ code: "custom", path: ["sourceUrl"], message: "Supported and verified facts require a source URL." });
  }
});

export const brandRuleInputSchema = z.object({
  ruleType: z.enum(["ALWAYS", "NEVER", "REQUIRE_REVIEW"]),
  ruleText: z.string().trim().min(3, "Rule must contain at least 3 characters.").max(2_000),
});

export const brandSourceInputSchema = z.object({
  name: z.string().trim().min(1, "Source name is required.").max(160),
  baseUrl: optionalUrl,
  sourceTier: z.coerce.number().int().min(1).max(4),
  isApproved: z.boolean(),
}).superRefine((source, context) => {
  if (source.isApproved && !source.baseUrl) context.addIssue({ code: "custom", path: ["baseUrl"], message: "Approved sources require a base URL." });
  if (source.isApproved && source.sourceTier === 4) context.addIssue({ code: "custom", path: ["isApproved"], message: "Tier 4 sources are discovery-only and cannot be approved as factual authority." });
});

export const mediaPolicyInputSchema = z.object({
  aiIllustrationsAllowed: z.boolean(),
  aiBackgroundsAllowed: z.boolean(),
  aiRealPersonLikenesses: z.enum(["UNSET", "ALLOWED", "PROHIBITED"]),
  realPersonPhotosRequireApproval: z.boolean(),
  textGraphicsAllowed: z.boolean(),
  statisticalGraphicsAllowed: z.boolean(),
  policyNotes: z.string().trim().max(4_000),
});

export type BrandFactInput = z.infer<typeof brandFactInputSchema>;
export type BrandRuleInput = z.infer<typeof brandRuleInputSchema>;
export type BrandSourceInput = z.infer<typeof brandSourceInputSchema>;
export type MediaPolicyInput = z.infer<typeof mediaPolicyInputSchema>;

export function brandFactInputFromFormData(formData: FormData) {
  return brandFactInputSchema.safeParse({
    factKey: formData.get("factKey"),
    value: formData.get("value"),
    verificationStatus: formData.get("verificationStatus"),
    sourceUrl: formData.get("sourceUrl"),
  });
}

export function brandRuleInputFromFormData(formData: FormData) {
  return brandRuleInputSchema.safeParse({ ruleType: formData.get("ruleType"), ruleText: formData.get("ruleText") });
}

export function brandSourceInputFromFormData(formData: FormData) {
  return brandSourceInputSchema.safeParse({
    name: formData.get("name"), baseUrl: formData.get("baseUrl"), sourceTier: formData.get("sourceTier"), isApproved: formData.get("isApproved") === "on",
  });
}

export function mediaPolicyInputFromFormData(formData: FormData) {
  return mediaPolicyInputSchema.safeParse({
    aiIllustrationsAllowed: formData.get("aiIllustrationsAllowed") === "on",
    aiBackgroundsAllowed: formData.get("aiBackgroundsAllowed") === "on",
    aiRealPersonLikenesses: formData.get("aiRealPersonLikenesses"),
    realPersonPhotosRequireApproval: formData.get("realPersonPhotosRequireApproval") === "on",
    textGraphicsAllowed: formData.get("textGraphicsAllowed") === "on",
    statisticalGraphicsAllowed: formData.get("statisticalGraphicsAllowed") === "on",
    policyNotes: formData.get("policyNotes"),
  });
}

export const idSchema = z.uuid();
