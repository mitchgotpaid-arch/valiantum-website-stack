import { describe, expect, it } from "vitest";
import { extractBriefingSocialDrafts } from "./briefing-social-drafts";

const briefing = `# Daily Briefing — 2026-10-06

## Opportunity 1: A verified update

### Verified facts

- Official update confirmed.

### Facebook

What does this change for fans?

### Instagram

A short visual-first caption.

### X — manual handoff

Concise update.

### Graphic direction

Use a text graphic.

### Sources

- https://example.com/official-update

# Publication-ready article package

Article text`;

describe("briefing social draft extraction", () => {
  it("turns one researched opportunity into three separate platform drafts", () => {
    expect(extractBriefingSocialDrafts(briefing)).toEqual([
      { rank: 1, headline: "A verified update", channel: "FACEBOOK", body: "What does this change for fans?", sourceUrls: ["https://example.com/official-update"] },
      { rank: 1, headline: "A verified update", channel: "INSTAGRAM", body: "A short visual-first caption.", sourceUrls: ["https://example.com/official-update"] },
      { rank: 1, headline: "A verified update", channel: "X", body: "Concise update.", sourceUrls: ["https://example.com/official-update"] },
    ]);
  });

  it("fails closed when an opportunity has no valid source", () => {
    expect(extractBriefingSocialDrafts(briefing.replace("https://example.com/official-update", "[VERIFY: No source matched]"))).toEqual([]);
  });

  it("does not mistake the article's distribution section for an opportunity", () => {
    expect(extractBriefingSocialDrafts(briefing + "\n## Opportunity 2: A fake article heading\n\n### Facebook\n\nA second post.\n\n### Sources\n\n- https://example.com/other")).toHaveLength(3);
  });
});
