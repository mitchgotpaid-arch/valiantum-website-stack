import "server-only";
import { requireUser } from "@/data/auth";
import type { ContentForReviewInput, ReviewDecisionInput } from "@/lib/content/schema";
import type { Database, Json } from "@/types/database";

type ContentStatus = Database["public"]["Enums"]["content_status"];
type VerificationStatus = Database["public"]["Enums"]["verification_status"];
type RiskLevel = Database["public"]["Enums"]["risk_level"];

export interface ContentQueueItem {
  id: string;
  brandId: string;
  brandName: string;
  title: string;
  contentType: string;
  body: string;
  status: ContentStatus;
  verificationStatus: VerificationStatus;
  risk: RiskLevel;
  requiresHumanApproval: boolean;
  hasProhibitedClaim: boolean;
  mediaPolicySatisfied: boolean;
  createdAt: string;
}

export interface ApprovalRecord {
  id: string;
  decision: "APPROVED" | "REJECTED";
  notes: string;
  createdAt: string;
}

export interface ContentReviewDetail extends ContentQueueItem {
  canReview: boolean;
  approvals: ApprovalRecord[];
}

export class ContentDataError extends Error {
  constructor(public readonly code: "NOT_FOUND" | "NOT_PERMITTED" | "INVALID_STATE" | "DATABASE_ERROR") {
    super(code);
    this.name = "ContentDataError";
  }
}

const contentSelection = "id,brand_id,title,content_type,body,status,verification_status,risk,requires_human_approval,has_prohibited_claim,media_policy_satisfied,created_at,brands(name)" as const;

function logDatabaseError(operation: string, error: { code?: string; message?: string; hint?: string }) {
  console.error(`[content] ${operation} failed`, { code: error.code, message: error.message, hint: error.hint });
}

function toQueueItem(row: {
  id: string;
  brand_id: string;
  title: string;
  content_type: string;
  body: string;
  status: ContentStatus;
  verification_status: VerificationStatus;
  risk: RiskLevel;
  requires_human_approval: boolean;
  has_prohibited_claim: boolean;
  media_policy_satisfied: boolean;
  created_at: string;
  brands: { name: string } | null;
}): ContentQueueItem {
  return {
    id: row.id,
    brandId: row.brand_id,
    brandName: row.brands?.name ?? "Unknown brand",
    title: row.title,
    contentType: row.content_type,
    body: row.body,
    status: row.status,
    verificationStatus: row.verification_status,
    risk: row.risk,
    requiresHumanApproval: row.requires_human_approval,
    hasProhibitedClaim: row.has_prohibited_claim,
    mediaPolicySatisfied: row.media_policy_satisfied,
    createdAt: row.created_at,
  };
}

export async function listContentQueue(): Promise<ContentQueueItem[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.from("content_items").select(contentSelection).order("created_at", { ascending: false });
  if (error) {
    logDatabaseError("list", error);
    throw new ContentDataError("DATABASE_ERROR");
  }
  return data.map(toQueueItem);
}

export async function getContentReview(contentId: string): Promise<ContentReviewDetail | null> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.from("content_items").select(contentSelection).eq("id", contentId).maybeSingle();
  if (error) {
    logDatabaseError("read", error);
    throw new ContentDataError("DATABASE_ERROR");
  }
  if (!data) return null;

  const [approvalsResult, reviewResult] = await Promise.all([
    supabase.from("approvals").select("id,decision,notes,created_at").eq("content_id", contentId).order("created_at", { ascending: false }),
    supabase.rpc("can_review_brand", { target_brand_id: data.brand_id }),
  ]);
  if (approvalsResult.error || reviewResult.error) {
    if (approvalsResult.error) logDatabaseError("approval history", approvalsResult.error);
    if (reviewResult.error) logDatabaseError("review permission", reviewResult.error);
    throw new ContentDataError("DATABASE_ERROR");
  }

  return {
    ...toQueueItem(data),
    canReview: reviewResult.data,
    approvals: approvalsResult.data.map((approval) => ({
      id: approval.id,
      decision: parseDecision(approval.decision),
      notes: approval.notes,
      createdAt: approval.created_at,
    })),
  };
}

export async function createContentForReview(input: ContentForReviewInput): Promise<string> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("create_content_for_review", {
    p_brand_id: input.brandId,
    p_title: input.title,
    p_content_type: input.contentType,
    p_body: input.body,
  });
  if (error) {
    logDatabaseError("create for review", error);
    throw mapDatabaseError(error.code);
  }
  return data;
}

export async function recordContentDecision(input: ReviewDecisionInput): Promise<string> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("record_content_decision", {
    p_content_id: input.contentId,
    p_decision: input.decision,
    p_notes: input.notes,
  });
  if (error) {
    logDatabaseError("record decision", error);
    throw mapDatabaseError(error.code);
  }
  return data;
}

function mapDatabaseError(code?: string) {
  if (code === "42501") return new ContentDataError("NOT_PERMITTED");
  if (code === "23514") return new ContentDataError("INVALID_STATE");
  if (code === "P0002") return new ContentDataError("NOT_FOUND");
  return new ContentDataError("DATABASE_ERROR");
}

function parseDecision(value: string): ApprovalRecord["decision"] {
  if (value === "APPROVED" || value === "REJECTED") return value;
  throw new ContentDataError("DATABASE_ERROR");
}

export function displayJsonValue(value: Json): string {
  if (typeof value === "object" && value !== null && !Array.isArray(value) && typeof value.value === "string") return value.value;
  return JSON.stringify(value);
}
