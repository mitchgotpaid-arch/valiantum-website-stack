import { z } from "zod";

const optionalText = (maximum: number) => z.string().trim().max(maximum).transform((value) => value || null);
function isHttpUrl(value: string) {
  if (!value) return true;
  try { return ["http:", "https:"].includes(new URL(value).protocol); } catch { return false; }
}

const optionalUrl = z.string().trim().max(500).refine(isHttpUrl, "Enter a complete http:// or https:// URL.").transform((value) => value || null);
const optionalLineList = z.string().trim().max(6_000).transform((value) => value ? value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean) : [])
  .pipe(z.array(z.string().max(500, "Keep each item under 500 characters.")).max(30, "Use no more than 30 items."));
const playbookText = (maximum: number) => z.string().trim().max(maximum).optional().default("");
const playbookLineList = optionalLineList.optional().default([]);
const playbookUrlList = playbookLineList.superRefine((values, context) => {
  values.forEach((value, index) => {
    if (!isHttpUrl(value)) context.addIssue({ code: "custom", message: `Source ${index + 1} must be a complete http:// or https:// URL.` });
  });
});

export const brandInputSchema = z.object({
  name: z.string().trim().min(1, "Brand name is required.").max(120),
  slug: z.string().trim().min(1, "Slug is required.").max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and single hyphens."),
  description: z.string().trim().max(2_000),
  websiteUrl: optionalUrl,
  industry: optionalText(120),
  targetAudience: optionalText(2_000),
  brandVoice: optionalText(4_000),
  marketingObjectives: optionalLineList,
  contentPillars: optionalLineList,
  freeformInstructions: z.string().trim().max(6_000),
  mission: playbookText(2_000),
  positioning: playbookText(3_000),
  offers: playbookLineList,
  differentiators: playbookLineList,
  proofPoints: playbookLineList,
  audienceNeeds: playbookLineList,
  audienceObjections: playbookLineList,
  priorityChannels: playbookLineList,
  preferredFormats: playbookLineList,
  callsToAction: playbookLineList,
  approvedVocabulary: playbookLineList,
  avoidedVocabulary: playbookLineList,
  officialSources: playbookUrlList,
  visualDirection: playbookText(4_000),
  requiredDisclosures: playbookLineList,
  prohibitedTopics: playbookLineList,
  approvedExamples: playbookText(6_000),
  avoidExamples: playbookText(6_000),
});

export type BrandInput = z.infer<typeof brandInputSchema>;

export function brandInputFromFormData(formData: FormData) {
  return brandInputSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    description: formData.get("description"),
    websiteUrl: formData.get("websiteUrl"),
    industry: formData.get("industry"),
    targetAudience: formData.get("targetAudience"),
    brandVoice: formData.get("brandVoice"),
    marketingObjectives: formData.get("marketingObjectives"),
    contentPillars: formData.get("contentPillars"),
    freeformInstructions: formData.get("freeformInstructions"),
    mission: optionalFormValue(formData, "mission"),
    positioning: optionalFormValue(formData, "positioning"),
    offers: optionalFormValue(formData, "offers"),
    differentiators: optionalFormValue(formData, "differentiators"),
    proofPoints: optionalFormValue(formData, "proofPoints"),
    audienceNeeds: optionalFormValue(formData, "audienceNeeds"),
    audienceObjections: optionalFormValue(formData, "audienceObjections"),
    priorityChannels: optionalFormValue(formData, "priorityChannels"),
    preferredFormats: optionalFormValue(formData, "preferredFormats"),
    callsToAction: optionalFormValue(formData, "callsToAction"),
    approvedVocabulary: optionalFormValue(formData, "approvedVocabulary"),
    avoidedVocabulary: optionalFormValue(formData, "avoidedVocabulary"),
    officialSources: optionalFormValue(formData, "officialSources"),
    visualDirection: optionalFormValue(formData, "visualDirection"),
    requiredDisclosures: optionalFormValue(formData, "requiredDisclosures"),
    prohibitedTopics: optionalFormValue(formData, "prohibitedTopics"),
    approvedExamples: optionalFormValue(formData, "approvedExamples"),
    avoidExamples: optionalFormValue(formData, "avoidExamples"),
  });
}

function optionalFormValue(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : undefined;
}
