import type { BrandInput } from "./schema";

export interface BrandPlaybook {
  mission: string;
  positioning: string;
  offers: string[];
  differentiators: string[];
  proofPoints: string[];
  audienceNeeds: string[];
  audienceObjections: string[];
  priorityChannels: string[];
  preferredFormats: string[];
  callsToAction: string[];
  approvedVocabulary: string[];
  avoidedVocabulary: string[];
  officialSources: string[];
  visualDirection: string;
  requiredDisclosures: string[];
  prohibitedTopics: string[];
  approvedExamples: string;
  avoidExamples: string;
}

const emptyPlaybook: BrandPlaybook = {
  mission: "",
  positioning: "",
  offers: [],
  differentiators: [],
  proofPoints: [],
  audienceNeeds: [],
  audienceObjections: [],
  priorityChannels: [],
  preferredFormats: [],
  callsToAction: [],
  approvedVocabulary: [],
  avoidedVocabulary: [],
  officialSources: [],
  visualDirection: "",
  requiredDisclosures: [],
  prohibitedTopics: [],
  approvedExamples: "",
  avoidExamples: "",
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function list(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean) : [];
}

export function parseBrandPlaybook(value: unknown): BrandPlaybook {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ...emptyPlaybook };
  const profile = value as Record<string, unknown>;
  return {
    mission: text(profile.mission),
    positioning: text(profile.positioning),
    offers: list(profile.offers),
    differentiators: list(profile.differentiators),
    proofPoints: list(profile.proofPoints),
    audienceNeeds: list(profile.audienceNeeds),
    audienceObjections: list(profile.audienceObjections),
    priorityChannels: list(profile.priorityChannels),
    preferredFormats: list(profile.preferredFormats),
    callsToAction: list(profile.callsToAction),
    approvedVocabulary: list(profile.approvedVocabulary),
    avoidedVocabulary: list(profile.avoidedVocabulary),
    officialSources: list(profile.officialSources),
    visualDirection: text(profile.visualDirection),
    requiredDisclosures: list(profile.requiredDisclosures),
    prohibitedTopics: list(profile.prohibitedTopics),
    approvedExamples: text(profile.approvedExamples),
    avoidExamples: text(profile.avoidExamples),
  };
}

export function compactBrandPlaybook(input: BrandInput): Record<string, string | string[]> {
  const profile: Record<string, string | string[]> = {};
  const setText = (key: string, value: string) => { if (value) profile[key] = value; };
  const setList = (key: string, value: string[]) => { if (value.length) profile[key] = value; };

  setText("mission", input.mission);
  setText("positioning", input.positioning);
  setList("offers", input.offers);
  setList("differentiators", input.differentiators);
  setList("proofPoints", input.proofPoints);
  setList("audienceNeeds", input.audienceNeeds);
  setList("audienceObjections", input.audienceObjections);
  setList("priorityChannels", input.priorityChannels);
  setList("preferredFormats", input.preferredFormats);
  setList("callsToAction", input.callsToAction);
  setList("approvedVocabulary", input.approvedVocabulary);
  setList("avoidedVocabulary", input.avoidedVocabulary);
  setList("officialSources", input.officialSources);
  setText("visualDirection", input.visualDirection);
  setList("requiredDisclosures", input.requiredDisclosures);
  setList("prohibitedTopics", input.prohibitedTopics);
  setText("approvedExamples", input.approvedExamples);
  setText("avoidExamples", input.avoidExamples);
  return profile;
}
