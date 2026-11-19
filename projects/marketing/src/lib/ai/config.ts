import "server-only";
import { z } from "zod";

const aiEnvironmentSchema = z.object({
  OPENAI_API_KEY: z.string().min(20),
  OPENAI_DRAFT_MODEL: z.string().min(1).default("gpt-6-luna"),
  OPENAI_BRIEFING_MODEL: z.string().min(1).default("gpt-6.1-sol"),
});

export type AiEnvironment = z.infer<typeof aiEnvironmentSchema>;

export function getAiEnvironment(): AiEnvironment {
  const result = aiEnvironmentSchema.safeParse({
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_DRAFT_MODEL: process.env.OPENAI_DRAFT_MODEL || undefined,
    OPENAI_BRIEFING_MODEL: process.env.OPENAI_BRIEFING_MODEL || undefined,
  });
  if (!result.success) throw new Error("OpenAI draft generation is not configured.");
  return result.data;
}

export function hasAiEnvironment(): boolean {
  return aiEnvironmentSchema.safeParse({
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_DRAFT_MODEL: process.env.OPENAI_DRAFT_MODEL || undefined,
    OPENAI_BRIEFING_MODEL: process.env.OPENAI_BRIEFING_MODEL || undefined,
  }).success;
}
