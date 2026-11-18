export type BriefingSocialChannel = "FACEBOOK" | "INSTAGRAM" | "X";

export interface BriefingSocialDraft {
  rank: number;
  headline: string;
  channel: BriefingSocialChannel;
  body: string;
  sourceUrls: string[];
}

const opportunityStart = /^## Opportunity ([1-5]): (.+)$/gm;
const channelSections: { channel: BriefingSocialChannel; heading: string; next: string }[] = [
  { channel: "FACEBOOK", heading: "Facebook", next: "Instagram" },
  { channel: "INSTAGRAM", heading: "Instagram", next: "X — manual handoff" },
  { channel: "X", heading: "X — manual handoff", next: "Graphic direction" },
];

/** Only parses the exact markdown layout produced by renderDailyBriefing. */
export function extractBriefingSocialDrafts(body: string): BriefingSocialDraft[] {
  const articleStart = body.indexOf("\n# Publication-ready article package");
  const briefingOnly = articleStart < 0 ? body : body.slice(0, articleStart);
  const starts = [...briefingOnly.matchAll(opportunityStart)];
  const result: BriefingSocialDraft[] = [];
  for (let index = 0; index < starts.length; index++) {
    const match = starts[index];
    const end = starts[index + 1]?.index ?? briefingOnly.length;
    const section = briefingOnly.slice(match.index, end);
    const rank = Number(match[1]);
    const headline = match[2].trim();
    const sourceBlock = betweenHeadings(section, "Sources", null);
    const sourceUrls = sourceBlock?.split("\n").flatMap((line) => {
      if (!line.startsWith("- ")) return [];
      try {
        const url = new URL(line.slice(2).trim());
        return url.protocol === "http:" || url.protocol === "https:" ? [url.toString()] : [];
      } catch { return []; }
    }) ?? [];
    // A snippet without a provider-matched source is never offered as a draft.
    if (!headline || !sourceUrls.length) continue;
    for (const { channel, heading, next } of channelSections) {
      const copy = betweenHeadings(section, heading, next)?.trim();
      if (copy && copy.length <= 50_000) result.push({ rank, headline, channel, body: copy, sourceUrls });
    }
  }
  return result;
}

function betweenHeadings(section: string, heading: string, next: string | null): string | null {
  const begin = section.indexOf(`\n### ${heading}\n`);
  if (begin < 0) return null;
  const contentStart = begin + `\n### ${heading}\n`.length;
  const contentEnd = next ? section.indexOf(`\n### ${next}\n`, contentStart) : section.length;
  if (contentEnd < 0) return null;
  return section.slice(contentStart, contentEnd).trim();
}
