import "server-only";
import { requireUser } from "@/data/auth";
import type { Database } from "@/types/database";

type PublishingDestinationRow = Database["public"]["Tables"]["publishing_destinations"]["Row"];
type PublicationAttemptRow = Database["public"]["Tables"]["publication_attempts"]["Row"];

export type PublishingChannel = "FACEBOOK" | "INSTAGRAM" | "TIKTOK" | "X";
export type PublishingMode = "AUTOMATIC" | "MANUAL_HANDOFF" | "REVIEW_REQUIRED";
export type PublishingConnectionStatus = "SETUP_REQUIRED" | "CONNECTED" | "ACTION_REQUIRED" | "READY";

export interface PublishingDestination {
  id: string;
  brandId: string;
  provider: "META" | "TIKTOK" | "X";
  channel: PublishingChannel;
  publishMode: PublishingMode;
  connectionStatus: PublishingConnectionStatus;
  externalAccountId:string|null;
  externalAccountName: string | null;
  lastValidatedAt: string | null;
}

export interface PublicationAttempt {
  id: string;
  attemptKind: "UNPUBLISHED_TEST";
  status: "PROCESSING" | "SUCCEEDED" | "FAILED";
  attemptCount: number;
  externalPostId: string | null;
  errorCode: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface FacebookUnpublishedTestClaim {
  attemptId: string;
  shouldExecute: boolean;
  attemptStatus: PublicationAttempt["status"];
  brandId: string;
  pageId: string;
  contentBody: string;
  encryptedCredential: string;
}

export class PublishingDataError extends Error {
  constructor(public readonly code: "NOT_FOUND" | "NOT_PERMITTED" | "INVALID_STATE" | "DATABASE_ERROR" = "DATABASE_ERROR") {
    super(code);
    this.name = "PublishingDataError";
  }
}

const selection = "id,brand_id,provider,channel,publish_mode,connection_status,external_account_id,external_account_name,last_validated_at" as const;

export async function listPublishingDestinations(brandId: string): Promise<PublishingDestination[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.from("publishing_destinations").select(selection).eq("brand_id", brandId).order("channel");
  if (error) {
    console.error("[publishing] list destinations failed", { code: error.code, message: error.message });
    throw new PublishingDataError();
  }
  return data.map(toPublishingDestination);
}

export async function canAdminPublishingBrand(brandId: string): Promise<boolean> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("can_admin_brand", { target_brand_id: brandId });
  if (error) throw new PublishingDataError();
  return data;
}

export async function saveMetaConnection(input: {
  brandId: string;
  facebookPageId: string;
  facebookPageName: string;
  instagramAccountId: string | null;
  instagramAccountName: string | null;
  encryptedCredential: string;
  expiresAt: string | null;
}): Promise<void> {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("connect_meta_publishing_destinations", {
    p_brand_id: input.brandId,
    p_facebook_page_id: input.facebookPageId,
    p_facebook_page_name: input.facebookPageName,
    p_instagram_account_id: input.instagramAccountId ?? "",
    p_instagram_account_name: input.instagramAccountName ?? "",
    p_encrypted_credential: input.encryptedCredential,
    p_expires_at: input.expiresAt,
  });
  if (error?.code === "42501") throw new PublishingDataError("NOT_PERMITTED");
  if (error) {
    console.error("[publishing] save Meta connection failed", { code: error.code, message: error.message });
    throw new PublishingDataError();
  }
}

export async function listPublicationAttempts(contentId: string): Promise<PublicationAttempt[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("publication_attempts")
    .select("id,attempt_kind,status,attempt_count,external_post_id,error_code,created_at,completed_at")
    .eq("content_id", contentId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[publishing] list attempts failed", { code: error.code, message: error.message });
    throw new PublishingDataError();
  }
  return data.map(toPublicationAttempt);
}

export async function claimFacebookUnpublishedTest(contentId: string): Promise<FacebookUnpublishedTestClaim> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("claim_facebook_unpublished_test", { p_content_id: contentId });
  if (error) throw mapPublishingError(error.code);
  const claim = data[0];
  if (!claim) throw new PublishingDataError();
  return {
    attemptId: claim.attempt_id,
    shouldExecute: claim.should_execute,
    attemptStatus: parseAttemptStatus(claim.attempt_status),
    brandId: claim.brand_id,
    pageId: claim.page_id,
    contentBody: claim.content_body,
    encryptedCredential: claim.encrypted_credential,
  };
}

export async function completeFacebookUnpublishedTest(input: {
  attemptId: string;
  succeeded: boolean;
  externalPostId?: string;
  errorCode?: string;
}): Promise<void> {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("complete_facebook_unpublished_test", {
    p_attempt_id: input.attemptId,
    p_succeeded: input.succeeded,
    p_external_post_id: input.externalPostId ?? null,
    p_error_code: input.errorCode ?? null,
  });
  if (error) throw mapPublishingError(error.code);
}

function toPublishingDestination(row: Pick<PublishingDestinationRow, "id" | "brand_id" | "provider" | "channel" | "publish_mode" | "connection_status" | "external_account_id" | "external_account_name" | "last_validated_at">): PublishingDestination {
  return {
    id: row.id,
    brandId: row.brand_id,
    provider: parseProvider(row.provider),
    channel: parseChannel(row.channel),
    publishMode: parseMode(row.publish_mode),
    connectionStatus: parseStatus(row.connection_status),
    externalAccountId:row.external_account_id,
    externalAccountName: row.external_account_name,
    lastValidatedAt: row.last_validated_at,
  };
}

function toPublicationAttempt(row: Pick<PublicationAttemptRow, "id" | "attempt_kind" | "status" | "attempt_count" | "external_post_id" | "error_code" | "created_at" | "completed_at">): PublicationAttempt {
  if (row.attempt_kind !== "UNPUBLISHED_TEST") throw new PublishingDataError();
  return {
    id: row.id,
    attemptKind: row.attempt_kind,
    status: parseAttemptStatus(row.status),
    attemptCount: row.attempt_count,
    externalPostId: row.external_post_id,
    errorCode: row.error_code,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

function parseProvider(value: string): PublishingDestination["provider"] {
  if (value === "META" || value === "TIKTOK" || value === "X") return value;
  throw new PublishingDataError();
}

function parseChannel(value: string): PublishingChannel {
  if (value === "FACEBOOK" || value === "INSTAGRAM" || value === "TIKTOK" || value === "X") return value;
  throw new PublishingDataError();
}

function parseMode(value: string): PublishingMode {
  if (value === "AUTOMATIC" || value === "MANUAL_HANDOFF" || value === "REVIEW_REQUIRED") return value;
  throw new PublishingDataError();
}

function parseStatus(value: string): PublishingConnectionStatus {
  if (value === "SETUP_REQUIRED" || value === "CONNECTED" || value === "ACTION_REQUIRED" || value === "READY") return value;
  throw new PublishingDataError();
}

function parseAttemptStatus(value: string): PublicationAttempt["status"] {
  if (value === "PROCESSING" || value === "SUCCEEDED" || value === "FAILED") return value;
  throw new PublishingDataError();
}

function mapPublishingError(code?: string): PublishingDataError {
  if (code === "42501") return new PublishingDataError("NOT_PERMITTED");
  if (code === "23514") return new PublishingDataError("INVALID_STATE");
  if (code === "P0002") return new PublishingDataError("NOT_FOUND");
  return new PublishingDataError();
}
