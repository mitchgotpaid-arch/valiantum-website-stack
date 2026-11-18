"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { AuthenticationRequiredError } from "@/data/auth";
import { ContentDataError, createContentForReview, createSocialDraftFromBriefing, getContentReview, recordContentDecision, reviseContentForReview } from "@/data/content";
import { PublishingDataError } from "@/data/publishing";
import { extractBriefingSocialDrafts } from "@/lib/content/briefing-social-drafts";
import { briefingSocialDraftSchema, contentForReviewFromFormData, reviewDecisionFromFormData, reviseContentFromFormData } from "@/lib/content/schema";
import { executeFacebookUnpublishedTest, PublicationExecutionError } from "@/lib/publishing/publication-service";

export interface ContentActionState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: string;
}

const initialFailure = "The change could not be saved. Try again or contact an administrator.";

function publicError(error: unknown): ContentActionState {
  if (error instanceof AuthenticationRequiredError) return { error: "Your session has expired. Sign in and try again." };
  if (error instanceof ContentDataError && error.code === "NOT_PERMITTED") return { error: "You do not have permission to perform this action." };
  if (error instanceof ContentDataError && error.code === "INVALID_STATE") return { error: "This content is no longer awaiting a decision. Reload and review its current status." };
  if (error instanceof ContentDataError && error.code === "NOT_FOUND") return { error: "The content item was not found." };
  if (error instanceof PublishingDataError && error.code === "NOT_PERMITTED") return { error: "Only a Brand owner or administrator can run a publishing test." };
  if (error instanceof PublishingDataError && error.code === "INVALID_STATE") return { error: "The content must be approved, contain text, and have a connected Facebook Page before testing." };
  if (error instanceof PublishingDataError && error.code === "NOT_FOUND") return { error: "The content item or publishing destination was not found." };
  if (error instanceof PublicationExecutionError && error.code === "CREDENTIAL_INVALID") return { error: "The stored Meta credential could not be used. Reconnect Meta and try again." };
  if (error instanceof PublicationExecutionError && error.code === "PROVIDER_REJECTED") return { error: "Meta rejected the unpublished test. Check the Page permissions and reconnect Meta if needed." };
  if (error instanceof PublicationExecutionError && error.code === "COMPLETION_FAILED") return { error: "Meta may have accepted the test, but its audit result could not be saved. Do not retry until the attempt is reviewed." };
  return { error: initialFailure };
}

export async function createContentAction(_state: ContentActionState, formData: FormData): Promise<ContentActionState> {
  const parsed = contentForReviewFromFormData(formData);
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  let contentId: string;
  try {
    contentId = await createContentForReview(parsed.data);
  } catch (error) {
    return publicError(error);
  }
  revalidatePath("/content");
  redirect(`/content/${contentId}`);
}

export async function recordDecisionAction(contentId: string, _state: ContentActionState, formData: FormData): Promise<ContentActionState> {
  const parsed = reviewDecisionFromFormData(contentId, formData);
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  try {
    await recordContentDecision(parsed.data);
  } catch (error) {
    return publicError(error);
  }
  revalidatePath("/");
  revalidatePath("/content");
  revalidatePath(`/content/${contentId}`);
  return { success: parsed.data.decision === "APPROVED" ? "Content approved and recorded." : "Content rejected and recorded." };
}

export async function reviseContentAction(contentId: string, _state: ContentActionState, formData: FormData): Promise<ContentActionState> {
  const parsed = reviseContentFromFormData(contentId, formData);
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  try {
    await reviseContentForReview(parsed.data);
  } catch (error) {
    return publicError(error);
  }
  revalidatePath("/content");
  revalidatePath(`/content/${contentId}`);
  return { success: "Saved and returned to the approval queue. Verification and media checks must be completed again." };
}

export async function createSocialDraftAction(contentId: string, _state: ContentActionState, formData: FormData): Promise<ContentActionState> {
  const parsed = briefingSocialDraftSchema.safeParse({
    contentId,
    rank: formData.get("rank"),
    channel: formData.get("channel"),
  });
  if (!parsed.success) return { error: "The selected briefing post is invalid." };
  let draftId: string;
  try {
    const source = await getContentReview(contentId);
    if (!source || source.contentType !== "DAILY_BRIEFING" || !["NEEDS_REVIEW", "APPROVED"].includes(source.status)) {
      return { error: "This briefing is not eligible for a social draft." };
    }
    if (!source.canEdit) return { error: "You do not have permission to create content for this Brand." };
    const draft = extractBriefingSocialDrafts(source.body).find((item) => item.rank === parsed.data.rank && item.channel === parsed.data.channel);
    if (!draft) return { error: "This post lacks a valid source or is no longer available. Reload the briefing." };
    draftId = await createSocialDraftFromBriefing(source, draft);
  } catch (error) {
    return publicError(error);
  }
  revalidatePath("/content");
  revalidatePath(`/content/${draftId}`);
  redirect(`/content/${draftId}`);
}

export async function createFacebookUnpublishedTestAction(contentId: string, _state: ContentActionState): Promise<ContentActionState> {
  void _state;
  if (!z.uuid().safeParse(contentId).success) return { error: "The content item is invalid." };
  try {
    const result = await executeFacebookUnpublishedTest(contentId);
    revalidatePath(`/content/${contentId}`);
    if (result.outcome === "SUCCEEDED") return { success: "Unpublished Facebook test created. It is not visible on the public Page feed." };
    if (result.outcome === "ALREADY_SUCCEEDED") return { success: "This exact content already has a successful unpublished Facebook test." };
    if (result.outcome === "PROCESSING") return { success: "A test for this content is already processing. No duplicate was sent." };
    return { error: "This test reached its retry limit. Review its attempt history before trying again." };
  } catch (error) {
    return publicError(error);
  }
}
