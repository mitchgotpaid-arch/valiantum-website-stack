"use server";

import { revalidatePath } from "next/cache";
import { createBrandFact, createBrandRule, createBrandSource, deleteBrandFact, deleteBrandRule, deleteBrandSource, saveMediaPolicy } from "@/data/brand-governance";
import { BrandDataError } from "@/data/brands";
import { AuthenticationRequiredError } from "@/data/auth";
import { brandFactInputFromFormData, brandRuleInputFromFormData, brandSourceInputFromFormData, mediaPolicyInputFromFormData, idSchema } from "@/lib/brands/governance-schema";

export interface GovernanceActionState { error?: string; fieldErrors?: Record<string, string[]>; success?: string }

function publicError(error: unknown): GovernanceActionState {
  if (error instanceof AuthenticationRequiredError) return { error: "Your session has expired. Sign in and try again." };
  if (error instanceof BrandDataError && error.code === "DUPLICATE_KEY") return { fieldErrors: { factKey: ["That fact key already exists for this brand."] } };
  if (error instanceof BrandDataError && error.code === "NOT_FOUND") return { error: "The item was not found or you do not have permission to change it." };
  return { error: "The change could not be saved. Try again or contact an administrator." };
}

export async function createFactAction(brandId: string, _state: GovernanceActionState, formData: FormData): Promise<GovernanceActionState> {
  if (!idSchema.safeParse(brandId).success) return { error: "Invalid brand." };
  const parsed = brandFactInputFromFormData(formData);
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  try {
    await createBrandFact(brandId, parsed.data);
    revalidatePath(`/brands/${brandId}/governance`); revalidatePath(`/brands/${brandId}/knowledge`); revalidatePath("/knowledge"); revalidatePath("/agent");
    return { success: "Fact added." };
  } catch (error) { return publicError(error); }
}

export async function removeFactAction(brandId: string, factId: string): Promise<void> {
  if (!idSchema.safeParse(brandId).success || !idSchema.safeParse(factId).success) return;
  await deleteBrandFact(brandId, factId);
  revalidatePath(`/brands/${brandId}/governance`); revalidatePath(`/brands/${brandId}/knowledge`); revalidatePath("/knowledge"); revalidatePath("/agent");
}

export async function createRuleAction(brandId: string, _state: GovernanceActionState, formData: FormData): Promise<GovernanceActionState> {
  if (!idSchema.safeParse(brandId).success) return { error: "Invalid brand." };
  const parsed = brandRuleInputFromFormData(formData);
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  try {
    await createBrandRule(brandId, parsed.data);
    revalidatePath(`/brands/${brandId}/governance`); revalidatePath(`/brands/${brandId}/knowledge`); revalidatePath("/knowledge"); revalidatePath("/agent");
    return { success: "Rule added." };
  } catch (error) { return publicError(error); }
}

export async function removeRuleAction(brandId: string, ruleId: string): Promise<void> {
  if (!idSchema.safeParse(brandId).success || !idSchema.safeParse(ruleId).success) return;
  await deleteBrandRule(brandId, ruleId);
  revalidatePath(`/brands/${brandId}/governance`); revalidatePath(`/brands/${brandId}/knowledge`); revalidatePath("/knowledge"); revalidatePath("/agent");
}

export async function createSourceAction(brandId: string, _state: GovernanceActionState, formData: FormData): Promise<GovernanceActionState> {
  if (!idSchema.safeParse(brandId).success) return { error: "Invalid brand." };
  const parsed = brandSourceInputFromFormData(formData);
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  try { await createBrandSource(brandId, parsed.data); revalidatePath(`/brands/${brandId}/governance`); revalidatePath(`/brands/${brandId}/knowledge`); revalidatePath("/knowledge"); revalidatePath("/agent"); return { success: "Source added." }; }
  catch (error) {
    if (error instanceof BrandDataError && error.code === "DUPLICATE_KEY") return { fieldErrors: { name: ["That source already exists for this brand."] } };
    return publicError(error);
  }
}

export async function removeSourceAction(brandId: string, sourceId: string): Promise<void> {
  if (!idSchema.safeParse(brandId).success || !idSchema.safeParse(sourceId).success) return;
  await deleteBrandSource(brandId, sourceId); revalidatePath(`/brands/${brandId}/governance`); revalidatePath(`/brands/${brandId}/knowledge`); revalidatePath("/knowledge"); revalidatePath("/agent");
}

export async function saveMediaPolicyAction(brandId: string, _state: GovernanceActionState, formData: FormData): Promise<GovernanceActionState> {
  if (!idSchema.safeParse(brandId).success) return { error: "Invalid brand." };
  const parsed = mediaPolicyInputFromFormData(formData);
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  try { await saveMediaPolicy(brandId, parsed.data); revalidatePath(`/brands/${brandId}/governance`); revalidatePath(`/brands/${brandId}/knowledge`); revalidatePath("/knowledge"); revalidatePath("/agent"); return { success: "Media policy saved." }; }
  catch (error) { return publicError(error); }
}
