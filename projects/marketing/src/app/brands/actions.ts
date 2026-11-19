"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createBrand, deleteBrand, removeBrandLogo, updateBrand, uploadBrandLogo, BrandDataError } from "@/data/brands";
import { AuthenticationRequiredError } from "@/data/auth";
import { validateBrandLogo, validateBrandLogoMetadata } from "@/lib/brands/logo";
import { brandInputFromFormData } from "@/lib/brands/schema";
import { idSchema } from "@/lib/brands/governance-schema";

export interface BrandActionState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: string;
}

function publicError(error: unknown): BrandActionState {
  if (error instanceof AuthenticationRequiredError) return { error: "Your session has expired. Sign in and try again." };
  if (error instanceof BrandDataError && error.code === "SLUG_TAKEN") return { fieldErrors: { slug: ["That slug is already used by another brand."] } };
  if (error instanceof BrandDataError && error.code === "HAS_DEPENDENCIES") return { error: "This brand has related content and cannot be deleted." };
  if (error instanceof BrandDataError && error.code === "NOT_FOUND") return { error: "The brand was not found or you do not have permission to change it." };
  return { error: "The change could not be saved. Try again or contact an administrator." };
}

function revalidateBrandViews(id: string) {
  revalidatePath("/");
  revalidatePath("/brands");
  revalidatePath(`/brands/${id}`);
  revalidatePath("/agent");
  revalidatePath("/settings");
}

export async function createBrandAction(_state: BrandActionState, formData: FormData): Promise<BrandActionState> {
  const parsed = brandInputFromFormData(formData);
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  let id: string;
  try {
    id = await createBrand(parsed.data);
  } catch (error) {
    return publicError(error);
  }
  revalidatePath("/brands");
  redirect(`/settings?brand=${id}`);
}

export async function updateBrandAction(id: string, _state: BrandActionState, formData: FormData): Promise<BrandActionState> {
  const parsed = brandInputFromFormData(formData);
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  try {
    await updateBrand(id, parsed.data);
    revalidateBrandViews(id);
    return { success: "Brand settings saved." };
  } catch (error) {
    return publicError(error);
  }
}

export async function uploadBrandLogoAction(id: string, _state: BrandActionState, formData: FormData): Promise<BrandActionState> {
  if (!idSchema.safeParse(id).success) return { error: "Invalid Brand." };
  const logo = formData.get("logo");
  if (!(logo instanceof File)) return { fieldErrors: { logo: ["Choose a logo image to upload."] } };
  const metadataError = validateBrandLogoMetadata(logo.type, logo.size);
  if (metadataError) return { fieldErrors: { logo: [metadataError] } };
  const bytes = new Uint8Array(await logo.arrayBuffer());
  const validationError = validateBrandLogo(logo.type, logo.size, bytes);
  if (validationError) return { fieldErrors: { logo: [validationError] } };
  try {
    await uploadBrandLogo(id, bytes, logo.type);
    revalidateBrandViews(id);
    return { success: "Brand logo saved." };
  } catch (error) {
    return publicError(error);
  }
}

export async function removeBrandLogoAction(id: string, _state: BrandActionState, _formData: FormData): Promise<BrandActionState> {
  void _state;
  void _formData;
  if (!idSchema.safeParse(id).success) return { error: "Invalid Brand." };
  try {
    await removeBrandLogo(id);
    revalidateBrandViews(id);
    return { success: "Brand logo removed." };
  } catch (error) {
    return publicError(error);
  }
}

export async function deleteBrandAction(id: string, _state: BrandActionState, formData: FormData): Promise<BrandActionState> {
  const confirmation = formData.get("confirmation");
  if (typeof confirmation !== "string" || !confirmation.trim()) return { fieldErrors: { confirmation: ["Type the brand name to confirm deletion."] } };
  try {
    await deleteBrand(id, confirmation.trim());
  } catch (error) {
    return publicError(error);
  }
  revalidatePath("/brands");
  revalidatePath("/settings");
  redirect("/settings");
}
