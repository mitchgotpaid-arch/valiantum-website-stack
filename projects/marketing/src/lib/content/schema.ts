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

const channelSchema=z.enum(["FACEBOOK","INSTAGRAM","X","TIKTOK","PINTEREST","LINKEDIN","YOUTUBE","THREADS","REDDIT","MASTODON","BLUESKY"]);
export const contentForReviewSchema = z.object({
  brandId: z.uuid("Select a valid brand."),
  channel:channelSchema.optional(),
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

export const reviseContentSchema = z.object({
  contentId: z.uuid("Invalid content item."),
  title: z.string().trim().min(1, "Title is required.").max(200, "Title must be 200 characters or fewer."),
  body: z.string().trim().min(1, "Post copy is required.").max(50_000, "Post copy must be 50,000 characters or fewer."),
});

export const briefingSocialDraftSchema = z.object({
  contentId: z.uuid("Invalid briefing."),
  rank: z.coerce.number().int().min(1).max(5),
  channel: z.enum(["FACEBOOK", "INSTAGRAM", "X"]),
});

export const aiDraftRequestSchema = z.object({
  channel:channelSchema.optional(),
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
export type ReviseContentInput = z.infer<typeof reviseContentSchema>;
export type AiDraftRequestInput = z.infer<typeof aiDraftRequestSchema>;
export type DailyBriefingRequestInput = z.infer<typeof dailyBriefingRequestSchema>;

export function contentForReviewFromFormData(formData: FormData) {
  return contentForReviewSchema.safeParse({
    brandId: formData.get("brandId"),
    channel:formData.get("channel")||undefined,
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

export function reviseContentFromFormData(contentId: string, formData: FormData) {
  return reviseContentSchema.safeParse({
    contentId,
    title: formData.get("title"),
    body: formData.get("body"),
  });
}

export function aiDraftRequestFromFormData(formData: FormData) {
  return aiDraftRequestSchema.safeParse({
    channel:formData.get("channel")||undefined,
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
