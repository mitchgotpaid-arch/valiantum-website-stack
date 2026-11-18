import type { BrandSummary } from "@/data/brands";

export interface BrandAgentContext {
  knowledge?: import("./knowledge").BrandKnowledge;
  name: string;
  website?: string;
  organizationType?: string;
  about?: string;
  audience?: string;
  coverage?: string[];
  marketingGoals?: string[];
  voice?: string;
  instructionsAndBoundaries?: string;
  logoAssetUrl?: string;
  strategy?: {
    mission?: string;
    positioning?: string;
    offers?: string[];
    differentiators?: string[];
    proofPoints?: string[];
  };
  audienceIntelligence?: { needs?: string[]; objections?: string[] };
  distribution?: { priorityChannels?: string[]; preferredFormats?: string[]; callsToAction?: string[] };
  editorialRules?: { approvedVocabulary?: string[]; avoidedVocabulary?: string[] };
  officialSources?: string[];
  visualDirection?: string;
  guardrails?: { requiredDisclosures?: string[]; prohibitedTopics?: string[] };
  examples?: { approved?: string; avoid?: string };
}

function optionalText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function optionalList(values: string[]) {
  const populated = values.map((value) => value.trim()).filter(Boolean);
  return populated.length ? populated : undefined;
}

function populatedObject<T extends object>(value: T) {
  return Object.values(value).some(Boolean) ? value : undefined;
}

/** Builds the only Brand-profile object that should be passed to future Agent prompts. */
export function buildBrandAgentContext(brand: BrandSummary): BrandAgentContext {
  const context: BrandAgentContext = { name: brand.name.trim() };
  const website = optionalText(brand.websiteUrl);
  const organizationType = optionalText(brand.industry);
  const about = optionalText(brand.description);
  const audience = optionalText(brand.targetAudience);
  const coverage = optionalList(brand.contentPillars);
  const marketingGoals = optionalList(brand.marketingObjectives);
  const voice = optionalText(brand.brandVoice);
  const instructionsAndBoundaries = optionalText(brand.freeformInstructions);
  const logoAssetUrl = optionalText(brand.logoUrl);
  if (website) context.website = website;
  if (organizationType) context.organizationType = organizationType;
  if (about) context.about = about;
  if (audience) context.audience = audience;
  if (coverage) context.coverage = coverage;
  if (marketingGoals) context.marketingGoals = marketingGoals;
  if (voice) context.voice = voice;
  if (instructionsAndBoundaries) context.instructionsAndBoundaries = instructionsAndBoundaries;
  if (logoAssetUrl) context.logoAssetUrl = logoAssetUrl;
  const strategy = populatedObject({
    mission: optionalText(brand.playbook.mission),
    positioning: optionalText(brand.playbook.positioning),
    offers: optionalList(brand.playbook.offers),
    differentiators: optionalList(brand.playbook.differentiators),
    proofPoints: optionalList(brand.playbook.proofPoints),
  });
  const audienceIntelligence = populatedObject({ needs: optionalList(brand.playbook.audienceNeeds), objections: optionalList(brand.playbook.audienceObjections) });
  const distribution = populatedObject({
    priorityChannels: optionalList(brand.playbook.priorityChannels),
    preferredFormats: optionalList(brand.playbook.preferredFormats),
    callsToAction: optionalList(brand.playbook.callsToAction),
  });
  const editorialRules = populatedObject({ approvedVocabulary: optionalList(brand.playbook.approvedVocabulary), avoidedVocabulary: optionalList(brand.playbook.avoidedVocabulary) });
  const guardrails = populatedObject({ requiredDisclosures: optionalList(brand.playbook.requiredDisclosures), prohibitedTopics: optionalList(brand.playbook.prohibitedTopics) });
  const examples = populatedObject({ approved: optionalText(brand.playbook.approvedExamples), avoid: optionalText(brand.playbook.avoidExamples) });
  if (strategy) context.strategy = strategy;
  if (audienceIntelligence) context.audienceIntelligence = audienceIntelligence;
  if (distribution) context.distribution = distribution;
  if (editorialRules) context.editorialRules = editorialRules;
  const officialSources = optionalList(brand.playbook.officialSources);
  if (officialSources) context.officialSources = officialSources;
  const visualDirection = optionalText(brand.playbook.visualDirection);
  if (visualDirection) context.visualDirection = visualDirection;
  if (guardrails) context.guardrails = guardrails;
  if (examples) context.examples = examples;
  return context;
}
