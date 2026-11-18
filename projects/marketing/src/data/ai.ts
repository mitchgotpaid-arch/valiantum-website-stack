import "server-only";
import { requireUser } from "@/data/auth";
import type { AiDraftRequestInput } from "@/lib/content/schema";
import type { GeneratedDraft } from "@/lib/ai/draft-generator";
import type { GeneratedDailyBriefing } from "@/lib/ai/daily-briefing";

export class AiDataError extends Error {
  constructor(public readonly code: "NOT_PERMITTED" | "BUDGET_EXCEEDED" | "INVALID_RESULT" | "DATABASE_ERROR") {
    super(code);
    this.name = "AiDataError";
  }
}

export interface AiBudgetStatus {
  monthlyBudgetCents: number;
  usedCostMicros: number;
  reservedCostMicros: number;
  remainingCostMicros: number;
}

export async function getAiBudgetStatus(): Promise<AiBudgetStatus> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("get_ai_budget_status");
  if (error || !data?.[0]) throw new AiDataError("DATABASE_ERROR");
  const status = data[0];
  const limitMicros = status.monthly_budget_cents * 10_000;
  return {
    monthlyBudgetCents: status.monthly_budget_cents,
    usedCostMicros: status.used_cost_micros,
    reservedCostMicros: status.reserved_cost_micros,
    remainingCostMicros: Math.max(0, limitMicros - status.used_cost_micros - status.reserved_cost_micros),
  };
}

export async function reserveAiBudget(brandId: string, model: string, task: "BRAND_DRAFT_GENERATION" | "DAILY_BRIEFING_GENERATION", reservedCostMicros: number): Promise<string> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("reserve_ai_budget", {
    p_brand_id: brandId,
    p_model: model,
    p_task: task,
    p_reserved_cost_micros: reservedCostMicros,
  });
  if (error?.code === "42501") throw new AiDataError("NOT_PERMITTED");
  if (error?.code === "P0001") throw new AiDataError("BUDGET_EXCEEDED");
  if (error) throw new AiDataError("DATABASE_ERROR");
  return data;
}

export async function failAiBudgetReservation(reservationId: string): Promise<void> {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("fail_ai_budget_reservation", { p_reservation_id: reservationId });
  if (error) throw new AiDataError("DATABASE_ERROR");
}

export async function canGenerateForBrand(brandId: string): Promise<boolean> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("can_edit_brand", { target_brand_id: brandId });
  if (error) throw new AiDataError("DATABASE_ERROR");
  return data;
}

export async function saveGeneratedDraft(input: AiDraftRequestInput, draft: GeneratedDraft, reservationId: string): Promise<string> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("create_ai_content_for_review", {
    p_brand_id: input.brandId,
    p_title: draft.title,
    p_content_type: input.contentType,
    p_body: draft.body,
    p_model: draft.model,
    p_input_tokens: draft.inputTokens,
    p_output_tokens: draft.outputTokens,
    p_estimated_cost_micros: draft.estimatedCostMicros,
    p_latency_ms: draft.latencyMs,
    p_requires_research: draft.requiresResearch,
    p_research_notes: draft.researchNotes,
    p_reservation_id: reservationId,
  });
  if (error?.code === "42501") throw new AiDataError("NOT_PERMITTED");
  if (error?.code === "23514") throw new AiDataError("INVALID_RESULT");
  if (error) throw new AiDataError("DATABASE_ERROR");
  return data;
}

export async function saveGeneratedDailyBriefing(brandId: string, briefing: GeneratedDailyBriefing, reservationId: string): Promise<string> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("create_ai_briefing_for_review", {
    p_brand_id: brandId,
    p_title: briefing.title,
    p_body: briefing.body,
    p_model: briefing.model,
    p_input_tokens: briefing.inputTokens,
    p_output_tokens: briefing.outputTokens,
    p_estimated_cost_micros: briefing.estimatedCostMicros,
    p_latency_ms: briefing.latencyMs,
    p_source_urls: briefing.sourceUrls,
    p_prompt_version: briefing.promptVersion,
    p_reservation_id: reservationId,
  });
  if (error?.code === "42501") throw new AiDataError("NOT_PERMITTED");
  if (error?.code === "23514") throw new AiDataError("INVALID_RESULT");
  if (error) throw new AiDataError("DATABASE_ERROR");
  return data;
}

export async function saveCapturedDailyBriefing(brandId: string, briefing: GeneratedDailyBriefing, reservationId: string): Promise<string> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("create_ai_briefing_capture", {
    p_brand_id: brandId,
    p_title: `Research capture — ${briefing.title}`.slice(0, 200),
    p_body: briefing.body,
    p_input_tokens: briefing.inputTokens,
    p_output_tokens: briefing.outputTokens,
    p_latency_ms: briefing.latencyMs,
    p_source_urls: briefing.sourceUrls,
    p_quality_issues: briefing.qualityIssues,
    p_prompt_version: briefing.promptVersion,
    p_reservation_id: reservationId,
  });
  if (error?.code === "42501") throw new AiDataError("NOT_PERMITTED");
  if (error?.code === "23514") throw new AiDataError("INVALID_RESULT");
  if (error) throw new AiDataError("DATABASE_ERROR");
  return data;
}
