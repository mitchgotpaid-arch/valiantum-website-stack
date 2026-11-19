"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AiDataError, canGenerateForBrand, failAiBudgetReservation, reserveAiBudget, saveCapturedDailyBriefing, saveGeneratedDailyBriefing, saveGeneratedDraft } from "@/data/ai";
import { AuthenticationRequiredError } from "@/data/auth";
import { BrandDataError, getBrand } from "@/data/brands";
import { BRAND_DRAFT_RESERVATION_MICROS, generateBrandDraft } from "@/lib/ai/draft-generator";
import { DAILY_BRIEFING_RESERVATION_MICROS, generateDailyBriefing } from "@/lib/ai/daily-briefing";
import { getAiEnvironment } from "@/lib/ai/config";
import {buildBrandKnowledge} from "@/lib/brands/knowledge";
import {getBrandGovernance} from "@/data/brand-governance";
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
    const training=buildBrandKnowledge(brand,await getBrandGovernance(brand.id),parsed.data.brief);

    reservationId = await reserveAiBudget(parsed.data.brandId, environment.OPENAI_DRAFT_MODEL, "BRAND_DRAFT_GENERATION", BRAND_DRAFT_RESERVATION_MICROS);
    const draft = await generateBrandDraft({
      contentType: parsed.data.contentType,
      brief: parsed.data.brief+"\nTarget channel: "+(parsed.data.channel||"FACEBOOK"),
      brand: training.context,
    }, environment);
    if(!training.ready){const issue="Brand setup is incomplete: "+training.checks.filter(check=>!check.passed).map(check=>check.label).join(', ');draft.requiresResearch=true;draft.researchNotes=[...draft.researchNotes,issue];if(draft.knowledgeRecord)draft.knowledgeRecord.issues=[...draft.knowledgeRecord.issues,issue];}
    contentId = await saveGeneratedDraft({...parsed.data,channel:parsed.data.channel||'FACEBOOK'}, draft, reservationId);
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
    const training=buildBrandKnowledge(brand,await getBrandGovernance(brand.id),parsed.data.operatorFocus);
    if(!training.ready)return {error:"Complete this brand’s Knowledge setup before generating: "+training.checks.filter(check=>!check.passed).map(check=>check.label).join(", ")+". No API request was made."};
    reservationId = await reserveAiBudget(parsed.data.brandId, environment.OPENAI_BRIEFING_MODEL, "DAILY_BRIEFING_GENERATION", DAILY_BRIEFING_RESERVATION_MICROS);
    const timezone = "America/New_York";
    const briefing = await generateDailyBriefing({
      date: new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()),
      timezone,
      operatorFocus: parsed.data.operatorFocus,
      brand: training.context,
    }, environment);
    contentId = briefing.qualityIssues.length
      ? await saveCapturedDailyBriefing(parsed.data.brandId, briefing, reservationId)
      : await saveGeneratedDailyBriefing(parsed.data.brandId, briefing, reservationId);
    reservationId = undefined;
  } catch (error) {
    if (reservationId) await consumeFailedReservation(reservationId);
    if (error instanceof AuthenticationRequiredError) return { error: "Your session expired. Sign in and try again." };
    if (error instanceof AiDataError && error.code === "NOT_PERMITTED") return { error: "You do not have permission to generate a briefing for this Brand." };
    if (error instanceof AiDataError && error.code === "BUDGET_EXCEEDED") return { error: "The $15 monthly OpenAI budget does not have enough remaining for another briefing. No API request was made." };
    if (error instanceof AiDataError || error instanceof BrandDataError) return { error: "The briefing could not be saved. Nothing was published." };
    if (error instanceof Error && error.message === "OpenAI draft generation is not configured.") return { error: "Add the server-only OpenAI API key before generating briefings." };
    console.error(`[agent] daily briefing generation failed: ${error instanceof Error ? error.name : "unknown error"}`);
    return { error: "Daily briefing generation failed. Nothing was saved or published. Try again later." };
  }
  revalidatePath("/");
  revalidatePath("/content");
  redirect(`/content/${contentId}`);
}

async function consumeFailedReservation(reservationId: string) {
  try {
    await failAiBudgetReservation(reservationId);
  } catch (reservationError) {
    console.error(`[agent] failed to close AI budget reservation: ${reservationError instanceof Error ? reservationError.name : "unknown error"}`);
  }
}
