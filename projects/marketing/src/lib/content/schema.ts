import { z } from "zod";

export const contentTypeSchema = z.enum([
  "ARTICLE",
  "SOCIAL_POST",
  "CAPTION",
  "THREAD",
  "GRAPHIC",
  "CAROUSEL",
  "VIDEO_CONCEPT",
  "VIDEO_SCRIPT",
  "CAMPAIGN_CONTENT",
]);

export const contentForReviewSchema = z.object({
  brandId: z.uuid("Select a valid brand."),
  title: z.string().trim().min(1, "Title is required.").max(200, "Title must be 200 characters or fewer."),
  contentType: contentTypeSchema,
  body: z.string().max(50_000, "Content must be 50,000 characters or fewer."),
});

export const reviewDecisionSchema = z.object({
  contentId: z.uuid("Invalid content item."),
  decision: z.enum(["APPROVED", "REJECTED"]),
  notes: z.string().trim().max(4_000, "Review notes must be 4,000 characters or fewer."),
}).superRefine((review, context) => {
  if (review.decision === "REJECTED" && !review.notes) {
    context.addIssue({ code: "custom", path: ["notes"], message: "Explain why this content is being rejected." });
  }
});

export const aiDraftRequestSchema = z.object({
  brandId: z.uuid("Select a valid brand."),
  contentType: z.enum(["SOCIAL_POST", "CAPTION", "THREAD"]),
  brief: z.string().trim().min(10, "Give the Agent at least a short content brief.").max(4_000, "Brief must be 4,000 characters or fewer."),
});

export const dailyBriefingRequestSchema = z.object({
  brandId: z.uuid("Select a valid brand."),
  operatorFocus: z.string().trim().max(1_000, "Daily focus must be 1,000 characters or fewer."),
});

export type ContentForReviewInput = z.infer<typeof contentForReviewSchema>;
export type ReviewDecisionInput = z.infer<typeof reviewDecisionSchema>;
export type AiDraftRequestInput = z.infer<typeof aiDraftRequestSchema>;
export type DailyBriefingRequestInput = z.infer<typeof dailyBriefingRequestSchema>;

export function contentForReviewFromFormData(formData: FormData) {
  return contentForReviewSchema.safeParse({
    brandId: formData.get("brandId"),
    title: formData.get("title"),
    contentType: formData.get("contentType"),
    body: formData.get("body"),
  });
}

export function reviewDecisionFromFormData(contentId: string, formData: FormData) {
  return reviewDecisionSchema.safeParse({
    contentId,
    decision: formData.get("decision"),
    notes: formData.get("notes"),
  });
}

export function aiDraftRequestFromFormData(formData: FormData) {
  return aiDraftRequestSchema.safeParse({
    brandId: formData.get("brandId"),
    contentType: formData.get("contentType"),
    brief: formData.get("brief"),
  });
}

export function dailyBriefingRequestFromFormData(formData: FormData) {
  return dailyBriefingRequestSchema.safeParse({
    brandId: formData.get("brandId"),
    operatorFocus: formData.get("operatorFocus") ?? "",
  });
}
