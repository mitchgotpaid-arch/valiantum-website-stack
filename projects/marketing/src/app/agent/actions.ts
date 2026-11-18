"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AiDataError, canGenerateForBrand, failAiBudgetReservation, reserveAiBudget, saveGeneratedDailyBriefing, saveGeneratedDraft } from "@/data/ai";
import { AuthenticationRequiredError } from "@/data/auth";
import { BrandDataError, getBrand } from "@/data/brands";
import { BRAND_DRAFT_RESERVATION_MICROS, generateBrandDraft } from "@/lib/ai/draft-generator";
import { DAILY_BRIEFING_RESERVATION_MICROS, generateDailyBriefing } from "@/lib/ai/daily-briefing";
import { getAiEnvironment } from "@/lib/ai/config";
import { buildBrandAgentContext } from "@/lib/brands/agent-context";
import { aiDraftRequestFromFormData, dailyBriefingRequestFromFormData } from "@/lib/content/schema";

export interface AgentDraftActionState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

export async function generateDraftAction(_state: AgentDraftActionState, formData: FormData): Promise<AgentDraftActionState> {
  const parsed = aiDraftRequestFromFormData(formData);
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  let contentId: string;
  let reservationId: string | undefined;
  try {
    const environment = getAiEnvironment();
    if (!await canGenerateForBrand(parsed.data.brandId)) return { error: "You do not have permission to generate content for this Brand." };
    const brand = await getBrand(parsed.data.brandId);
    if (!brand) return { error: "The selected Brand was not found." };
    reservationId = await reserveAiBudget(parsed.data.brandId, environment.OPENAI_DRAFT_MODEL, "BRAND_DRAFT_GENERATION", BRAND_DRAFT_RESERVATION_MICROS);
    const draft = await generateBrandDraft({
      contentType: parsed.data.contentType,
      brief: parsed.data.brief,
      brand: buildBrandAgentContext(brand),
    }, environment);
    contentId = await saveGeneratedDraft(parsed.data, draft, reservationId);
    reservationId = undefined;
  } catch (error) {
    if (reservationId) await consumeFailedReservation(reservationId);
    if (error instanceof AuthenticationRequiredError) return { error: "Your session expired. Sign in and try again." };
    if (error instanceof AiDataError && error.code === "NOT_PERMITTED") return { error: "You do not have permission to generate content for this Brand." };
    if (error instanceof AiDataError && error.code === "BUDGET_EXCEEDED") return { error: "The $15 monthly OpenAI budget is exhausted or fully reserved. No API request was made." };
    if (error instanceof AiDataError || error instanceof BrandDataError) return { error: "The generated draft could not be saved. No content was published." };
    if (error instanceof Error && error.message === "OpenAI draft generation is not configured.") return { error: "Add the server-only OpenAI API key before generating drafts." };
    console.error("[agent] draft generation failed", { error: error instanceof Error ? error.name : "unknown" });
    return { error: "Draft generation failed. No content was saved or published. Try again later." };
  }
  revalidatePath("/");
  revalidatePath("/content");
  redirect(`/content/${contentId}`);
}

export async function generateDailyBriefingAction(_state: AgentDraftActionState, formData: FormData): Promise<AgentDraftActionState> {
  const parsed = dailyBriefingRequestFromFormData(formData);
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  let contentId: string;
  let reservationId: string | undefined;
  try {
    const environment = getAiEnvironment();
    if (!await canGenerateForBrand(parsed.data.brandId)) return { error: "You do not have permission to generate a briefing for this Brand." };
    const brand = await getBrand(parsed.data.brandId);
    if (!brand) return { error: "The selected Brand was not found." };
    reservationId = await reserveAiBudget(parsed.data.brandId, environment.OPENAI_BRIEFING_MODEL, "DAILY_BRIEFING_GENERATION", DAILY_BRIEFING_RESERVATION_MICROS);
    const timezone = "America/New_York";
    const briefing = await generateDailyBriefing({
      date: new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()),
      timezone,
      operatorFocus: parsed.data.operatorFocus,
      brand: buildBrandAgentContext(brand),
    }, environment);
    contentId = await saveGeneratedDailyBriefing(parsed.data.brandId, briefing, reservationId);
    reservationId = undefined;
  } catch (error) {
    if (reservationId) await consumeFailedReservation(reservationId);
    if (error instanceof AuthenticationRequiredError) return { error: "Your session expired. Sign in and try again." };
    if (error instanceof AiDataError && error.code === "NOT_PERMITTED") return { error: "You do not have permission to generate a briefing for this Brand." };
    if (error instanceof AiDataError && error.code === "BUDGET_EXCEEDED") return { error: "The $15 monthly OpenAI budget does not have enough remaining for another briefing. No API request was made." };
    if (error instanceof AiDataError || error instanceof BrandDataError) return { error: "The briefing could not be saved. Nothing was published." };
    if (error instanceof Error && error.message === "OpenAI draft generation is not configured.") return { error: "Add the server-only OpenAI API key before generating briefings." };
    console.error("[agent] daily briefing generation failed", { error: error instanceof Error ? error.name : "unknown" });
    return { error: "Daily briefing generation failed. Nothing was saved or published. Try again later." };
  }
  revalidatePath("/");
  revalidatePath("/content");
  redirect(`/content/${contentId}`);
}

async function consumeFailedReservation(reservationId: string) {
  try {
    await failAiBudgetReservation(reservationId);
  } catch (error) {
    console.error("[agent] failed to close AI budget reservation", { error: error instanceof Error ? error.name : "unknown" });
  }
}
