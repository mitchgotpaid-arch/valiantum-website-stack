import "server-only";
import { requireUser } from "@/data/auth";
import { BrandDataError } from "@/data/brands";
import type { BrandFactInput, BrandRuleInput, BrandSourceInput, MediaPolicyInput } from "@/lib/brands/governance-schema";

export interface BrandFact {
  id: string;
  factKey: string;
  value: string;
  verificationStatus: "VERIFIED" | "SUPPORTED" | "UNVERIFIED" | "CONFLICTING" | "INCORRECT";
  sourceUrl: string | null;
}

export interface BrandRule {
  id: string;
  ruleType: "ALWAYS" | "NEVER" | "REQUIRE_REVIEW";
  ruleText: string;
  isActive: boolean;
}

export interface BrandSource { id: string; name: string; baseUrl: string | null; sourceTier: number; isApproved: boolean }
export interface MediaPolicy {
  aiIllustrationsAllowed: boolean; aiBackgroundsAllowed: boolean; aiRealPersonLikenesses: "UNSET" | "ALLOWED" | "PROHIBITED";
  realPersonPhotosRequireApproval: boolean; textGraphicsAllowed: boolean; statisticalGraphicsAllowed: boolean; policyNotes: string;
}

const defaultMediaPolicy: MediaPolicy = {
  aiIllustrationsAllowed: false, aiBackgroundsAllowed: false, aiRealPersonLikenesses: "UNSET",
  realPersonPhotosRequireApproval: true, textGraphicsAllowed: true, statisticalGraphicsAllowed: true, policyNotes: "",
};

function parseBrandRuleType(value: string): BrandRule["ruleType"] {
  if (value === "ALWAYS" || value === "NEVER" || value === "REQUIRE_REVIEW") return value;
  throw new BrandDataError("DATABASE_ERROR");
}

export async function getBrandGovernance(brandId: string): Promise<{ facts: BrandFact[]; rules: BrandRule[]; sources: BrandSource[]; mediaPolicy: MediaPolicy }> {
  const { supabase } = await requireUser();
  const [factsResult, rulesResult, sourcesResult, mediaResult] = await Promise.all([
    supabase.from("brand_facts").select("id,fact_key,value,verification_status,source_url").eq("brand_id", brandId).order("fact_key"),
    supabase.from("brand_rules").select("id,rule_type,rule_text,is_active").eq("brand_id", brandId).order("created_at"),
    supabase.from("brand_sources").select("id,name,base_url,source_tier,is_approved").eq("brand_id", brandId).order("source_tier").order("name"),
    supabase.from("brand_media_policies").select("ai_illustrations_allowed,ai_backgrounds_allowed,ai_real_person_likenesses_allowed,real_person_photos_require_approval,text_graphics_allowed,statistical_graphics_allowed,policy_notes").eq("brand_id", brandId).maybeSingle(),
  ]);
  if (factsResult.error || rulesResult.error || sourcesResult.error || mediaResult.error) throw new BrandDataError("DATABASE_ERROR");
  const media = mediaResult.data;
  return {
    facts: factsResult.data.map((fact) => ({
      id: fact.id,
      factKey: fact.fact_key,
      value: typeof fact.value === "object" && fact.value !== null && !Array.isArray(fact.value) && typeof fact.value.value === "string" ? fact.value.value : JSON.stringify(fact.value),
      verificationStatus: fact.verification_status,
      sourceUrl: fact.source_url,
    })),
    rules: rulesResult.data.map((rule) => ({ id: rule.id, ruleType: parseBrandRuleType(rule.rule_type), ruleText: rule.rule_text, isActive: rule.is_active })),
    sources: sourcesResult.data.map((source) => ({ id: source.id, name: source.name, baseUrl: source.base_url, sourceTier: source.source_tier, isApproved: source.is_approved })),
    mediaPolicy: media ? {
      aiIllustrationsAllowed: media.ai_illustrations_allowed, aiBackgroundsAllowed: media.ai_backgrounds_allowed,
      aiRealPersonLikenesses: media.ai_real_person_likenesses_allowed === null ? "UNSET" : media.ai_real_person_likenesses_allowed ? "ALLOWED" : "PROHIBITED",
      realPersonPhotosRequireApproval: media.real_person_photos_require_approval, textGraphicsAllowed: media.text_graphics_allowed,
      statisticalGraphicsAllowed: media.statistical_graphics_allowed, policyNotes: media.policy_notes,
    } : defaultMediaPolicy,
  };
}

export async function createBrandFact(brandId: string, input: BrandFactInput): Promise<void> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("brand_facts").insert({
    brand_id: brandId,
    fact_key: input.factKey,
    value: { value: input.value },
    verification_status: input.verificationStatus,
    source_url: input.sourceUrl,
  });
  if (error?.code === "23505") throw new BrandDataError("DUPLICATE_KEY");
  if (error) throw new BrandDataError("DATABASE_ERROR");
}

export async function deleteBrandFact(brandId: string, factId: string): Promise<void> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.from("brand_facts").delete().eq("brand_id", brandId).eq("id", factId).select("id").maybeSingle();
  if (error) throw new BrandDataError("DATABASE_ERROR");
  if (!data) throw new BrandDataError("NOT_FOUND");
}

export async function createBrandRule(brandId: string, input: BrandRuleInput): Promise<void> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("brand_rules").insert({ brand_id: brandId, rule_type: input.ruleType, rule_text: input.ruleText, is_active: true });
  if (error) throw new BrandDataError("DATABASE_ERROR");
}

export async function deleteBrandRule(brandId: string, ruleId: string): Promise<void> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.from("brand_rules").delete().eq("brand_id", brandId).eq("id", ruleId).select("id").maybeSingle();
  if (error) throw new BrandDataError("DATABASE_ERROR");
  if (!data) throw new BrandDataError("NOT_FOUND");
}

export async function createBrandSource(brandId: string, input: BrandSourceInput): Promise<void> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("brand_sources").insert({ brand_id: brandId, name: input.name, base_url: input.baseUrl, source_tier: input.sourceTier, is_approved: input.isApproved });
  if (error?.code === "23505") throw new BrandDataError("DUPLICATE_KEY");
  if (error) throw new BrandDataError("DATABASE_ERROR");
}

export async function deleteBrandSource(brandId: string, sourceId: string): Promise<void> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.from("brand_sources").delete().eq("brand_id", brandId).eq("id", sourceId).select("id").maybeSingle();
  if (error) throw new BrandDataError("DATABASE_ERROR");
  if (!data) throw new BrandDataError("NOT_FOUND");
}

export async function saveMediaPolicy(brandId: string, input: MediaPolicyInput): Promise<void> {
  const { supabase } = await requireUser();
  const likeness = input.aiRealPersonLikenesses === "UNSET" ? null : input.aiRealPersonLikenesses === "ALLOWED";
  const { error } = await supabase.from("brand_media_policies").upsert({
    brand_id: brandId, ai_illustrations_allowed: input.aiIllustrationsAllowed, ai_backgrounds_allowed: input.aiBackgroundsAllowed,
    ai_real_person_likenesses_allowed: likeness, real_person_photos_require_approval: input.realPersonPhotosRequireApproval,
    text_graphics_allowed: input.textGraphicsAllowed, statistical_graphics_allowed: input.statisticalGraphicsAllowed, policy_notes: input.policyNotes,
  }, { onConflict: "brand_id" });
  if (error) throw new BrandDataError("DATABASE_ERROR");
}
