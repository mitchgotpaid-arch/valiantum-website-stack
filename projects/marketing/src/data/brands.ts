import "server-only";
import { requireUser } from "@/data/auth";
import { compactBrandPlaybook, parseBrandPlaybook, type BrandPlaybook } from "@/lib/brands/playbook";
import type { BrandInput } from "@/lib/brands/schema";

export interface BrandSummary {
  id: string;
  name: string;
  slug: string;
  description: string;
  websiteUrl: string | null;
  industry: string | null;
  targetAudience: string | null;
  brandVoice: string | null;
  marketingObjectives: string[];
  contentPillars: string[];
  freeformInstructions: string;
  playbook: BrandPlaybook;
  logoPath: string | null;
  logoUrl: string | null;
  autonomy: "LEVEL_1_MANUAL" | "LEVEL_2_ASSISTED" | "LEVEL_3_TRUSTED" | "LEVEL_4_AUTONOMOUS";
  publishingEnabled: boolean;
  updatedAt: string;
}

export class BrandDataError extends Error {
  constructor(public readonly code: "NOT_FOUND" | "SLUG_TAKEN" | "DUPLICATE_KEY" | "HAS_DEPENDENCIES" | "DATABASE_ERROR") {
    super(code);
    this.name = "BrandDataError";
  }
}

function logDatabaseError(operation: string, error: { code?: string; message?: string; hint?: string }) {
  console.error(`[brands] ${operation} failed`, {
    code: error.code,
    message: error.message,
    hint: error.hint,
  });
}

const selection = "id,name,slug,description,website_url,industry,target_audience,brand_voice,marketing_objectives,content_pillars,freeform_instructions,agent_profile,logo_path,autonomy,publishing_enabled,updated_at" as const;
const logoBucket = "brand-assets";

type BrandRow = {
  id: string; name: string; slug: string; description: string; website_url: string | null; industry: string | null;
  target_audience: string | null; brand_voice: string | null; marketing_objectives: unknown; content_pillars: unknown;
  freeform_instructions: string; agent_profile: unknown; logo_path: string | null; autonomy: BrandSummary["autonomy"];
  publishing_enabled: boolean; updated_at: string;
};

function toStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean);
}

function toSummary(row: BrandRow, logoUrl: string | null = null): BrandSummary {
  return {
    id: row.id, name: row.name, slug: row.slug, description: row.description, websiteUrl: row.website_url,
    industry: row.industry, targetAudience: row.target_audience, brandVoice: row.brand_voice,
    marketingObjectives: toStringList(row.marketing_objectives), contentPillars: toStringList(row.content_pillars),
    freeformInstructions: row.freeform_instructions,
    playbook: parseBrandPlaybook(row.agent_profile),
    logoPath: row.logo_path, logoUrl,
    autonomy: row.autonomy, publishingEnabled: row.publishing_enabled, updatedAt: row.updated_at,
  };
}

async function toSummaryWithLogo(supabase: Awaited<ReturnType<typeof requireUser>>["supabase"], row: BrandRow) {
  if (!row.logo_path) return toSummary(row);
  const { data, error } = await supabase.storage.from(logoBucket).createSignedUrl(row.logo_path, 3600);
  if (error) {
    console.error("[brands] logo signing failed", { message: error.message, brandId: row.id });
    return toSummary(row);
  }
  return toSummary(row, data.signedUrl);
}

export async function listBrands(): Promise<BrandSummary[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.from("brands").select(selection).order("name");
  if (error) throw new BrandDataError("DATABASE_ERROR");
  return Promise.all(data.map((row) => toSummaryWithLogo(supabase, row)));
}

export async function getBrand(id: string): Promise<BrandSummary | null> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.from("brands").select(selection).eq("id", id).maybeSingle();
  if (error) throw new BrandDataError("DATABASE_ERROR");
  return data ? toSummaryWithLogo(supabase, data) : null;
}

export async function uploadBrandLogo(brandId: string, bytes: Uint8Array, contentType: string): Promise<void> {
  const { supabase } = await requireUser();
  const path = `${brandId}/logo`;
  const { data: brand, error: readError } = await supabase.from("brands").select("id").eq("id", brandId).maybeSingle();
  if (readError) throw new BrandDataError("DATABASE_ERROR");
  if (!brand) throw new BrandDataError("NOT_FOUND");

  const { error: uploadError } = await supabase.storage.from(logoBucket).upload(path, bytes, {
    cacheControl: "3600",
    contentType,
    upsert: true,
  });
  if (uploadError) {
    console.error("[brands] logo upload failed", { message: uploadError.message, brandId });
    throw new BrandDataError("DATABASE_ERROR");
  }

  const { data, error } = await supabase.from("brands").update({ logo_path: path }).eq("id", brandId).select("id").maybeSingle();
  if (error) throw new BrandDataError("DATABASE_ERROR");
  if (!data) throw new BrandDataError("NOT_FOUND");
}

export async function removeBrandLogo(brandId: string): Promise<void> {
  const { supabase } = await requireUser();
  const { data: brand, error: readError } = await supabase.from("brands").select("logo_path").eq("id", brandId).maybeSingle();
  if (readError) throw new BrandDataError("DATABASE_ERROR");
  if (!brand) throw new BrandDataError("NOT_FOUND");
  if (!brand.logo_path) return;

  const { data, error } = await supabase.from("brands").update({ logo_path: null }).eq("id", brandId).select("id").maybeSingle();
  if (error) throw new BrandDataError("DATABASE_ERROR");
  if (!data) throw new BrandDataError("NOT_FOUND");

  const { error: storageError } = await supabase.storage.from(logoBucket).remove([brand.logo_path]);
  if (storageError) console.error("[brands] logo cleanup failed", { message: storageError.message, brandId });
}

export async function createBrand(input: BrandInput): Promise<string> {
  const { supabase, user } = await requireUser();
  const id = crypto.randomUUID();
  const { error } = await supabase.from("brands").insert({
    id,
    owner_user_id: user.id,
    name: input.name,
    slug: input.slug,
    description: input.description,
    website_url: input.websiteUrl,
    industry: input.industry,
    target_audience: input.targetAudience,
    brand_voice: input.brandVoice,
    marketing_objectives: input.marketingObjectives,
    content_pillars: input.contentPillars,
    freeform_instructions: input.freeformInstructions,
    agent_profile: compactBrandPlaybook(input),
    autonomy: "LEVEL_1_MANUAL",
    publishing_enabled: false,
  });
  if (error?.code === "23505") throw new BrandDataError("SLUG_TAKEN");
  if (error) {
    logDatabaseError("create", error);
    throw new BrandDataError("DATABASE_ERROR");
  }
  return id;
}

export async function updateBrand(id: string, input: BrandInput): Promise<void> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.from("brands").update({
    name: input.name,
    slug: input.slug,
    description: input.description,
    website_url: input.websiteUrl,
    industry: input.industry,
    target_audience: input.targetAudience,
    brand_voice: input.brandVoice,
    marketing_objectives: input.marketingObjectives,
    content_pillars: input.contentPillars,
    freeform_instructions: input.freeformInstructions,
    agent_profile: compactBrandPlaybook(input),
  }).eq("id", id).select("id").maybeSingle();
  if (error?.code === "23505") throw new BrandDataError("SLUG_TAKEN");
  if (error) throw new BrandDataError("DATABASE_ERROR");
  if (!data) throw new BrandDataError("NOT_FOUND");
}

export async function deleteBrand(id: string, expectedName: string): Promise<void> {
  const { supabase } = await requireUser();
  const { data: existing, error: readError } = await supabase.from("brands").select("name").eq("id", id).maybeSingle();
  if (readError) throw new BrandDataError("DATABASE_ERROR");
  if (!existing) throw new BrandDataError("NOT_FOUND");
  if (existing.name !== expectedName) throw new BrandDataError("NOT_FOUND");

  const { data, error } = await supabase.from("brands").delete().eq("id", id).select("id").maybeSingle();
  if (error) {
    logDatabaseError("delete", error);
    if (error.code === "23503") throw new BrandDataError("HAS_DEPENDENCIES");
    throw new BrandDataError("DATABASE_ERROR");
  }
  if (!data) throw new BrandDataError("NOT_FOUND");
}
