import { describe, expect, it } from "vitest";
import {
  buildDailyBriefingMessages,
  collectWebSources,
  countWebSearchCalls,
  evaluateDailyBriefing,
  estimateBriefingCostMicros,
  reconcileBriefingSources,
  renderDailyBriefing,
  type DailyBriefingOutput,
} from "./daily-briefing";

const sample: DailyBriefingOutput = {
  briefingDate: "2026-09-29",
  executiveSummary: "The strongest story is a verified local milestone.",
  topRecommendation: "Lead with the milestone and use the article to drive owned traffic.",
  opportunities: [{
    rank: 1,
    headline: "Verified milestone",
    whyNow: "It happened today.",
    verifiedFacts: ["The official source confirmed the result."],
    sourceUrls: ["https://example.com/official-story/"],
    confidence: "HIGH",
    recommendedTime: "8:10 AM ET",
    facebookCaption: "A Facebook post.",
    instagramCaption: "An Instagram caption.",
    xPost: "A concise manual X handoff.",
    graphicHeadline: "HISTORY.",
    graphicCopy: "A verified number.",
    visualDirection: "Use a clean editorial treatment without assuming likeness rights.",
  }],
  article: {
    headline: "A verified milestone deserves a closer look",
    seoTitle: "Verified Milestone: What It Means",
    primaryKeyword: "verified milestone",
    targetKeywords: ["verified milestone", "local sports", "team news", "player milestone", "sports analysis"],
    slug: "verified-milestone-analysis",
    metaDescription: "A verified local milestone and what it means next for the team.",
    excerpt: "The milestone is official. Here is what it means.",
    categories: ["Sports"],
    tags: ["Milestone", "Analysis"],
    bodyMarkdown: "## The milestone\n\n" + "Verified reporting explains the milestone and its context. ".repeat(12) + "\n\n## What comes next\n\nThe verified context shapes the next conversation.",
    sourceUrls: ["https://example.com/official-story"],
    searchHeadline: "Verified Milestone: What It Means",
    discoverHeadlines: ["This milestone changes the conversation", "The number behind today's biggest story"],
    featuredImageConcept: "A typography-led statistical graphic.",
    featuredImageFilename: "verified-milestone.jpg",
    featuredImageAltText: "Graphic explaining the verified milestone",
    internalLinkOpportunities: ["Prior milestone coverage", "Recent team analysis"],
    facebookPost: "Read the full analysis.",
    xPost: "The milestone is official. Here's what it means.",
  },
  watchList: ["Wait for the official lineup."],
  omittedUnverifiedItems: ["A rumored transaction lacked confirmation."],
};

describe("daily briefing workflow", () => {
  it("recreates the research-first editorial rules without exposing signed logo URLs", () => {
    const messages = buildDailyBriefingMessages({
      date: "2026-09-29",
      timezone: "America/New_York",
      operatorFocus: "Prioritize non-redundant graphics.",
      brand: { name: "Nati Sports", coverage: ["Cincinnati sports"], logoAssetUrl: "https://signed.example/logo?secret=1" },
    });
    expect(messages[0].content).toContain("Use live web search before drafting");
    expect(messages[0].content).toContain("omit it from publishable copy");
    expect(messages[0].content).toContain("exactly one copy-and-paste-ready owned-site article");
    expect(messages[0].content).toContain("Never publish");
    expect(messages[1].content).toContain("2026-09-29");
    expect(messages[1].content).not.toContain("signed.example");
  });

  it("collects and de-duplicates only HTTP web sources returned by the provider", () => {
    const sources = collectWebSources([
      { type: "web_search_call", action: { type: "search", sources: [{ type: "url", url: "https://example.com/story/" }, { type: "url", url: "https://example.com/story" }] } },
      { type: "message", content: [{ type: "output_text", annotations: [{ type: "url_citation", url: "https://league.example/news", title: "League" }] }] },
      { type: "web_search_call", action: { type: "open_page", url: "file:///not-web" } },
    ]);
    expect(sources).toEqual(["https://example.com/story/", "https://league.example/news"]);
  });

  it("estimates Sol token and web-search cost in integer microdollars", () => {
    const output = [{ type: "web_search_call" }, { type: "message" }, { type: "web_search_call" }];
    expect(countWebSearchCalls(output)).toBe(2);
    expect(estimateBriefingCostMicros("gpt-6.1-sol", 20_000, 8_000, 2)).toBe(140_000);
    expect(estimateBriefingCostMicros("unknown-model", 1, 1, 0)).toBe(450_000);
  });

  it("removes model-supplied URLs that were not in provider source metadata", () => {
    const reconciled = reconcileBriefingSources({
      ...sample,
      opportunities: [{ ...sample.opportunities[0], sourceUrls: ["https://example.com/official-story/", "https://invented.example/story"] }],
    }, ["https://example.com/official-story"]);
    expect(reconciled.opportunities[0].sourceUrls).toEqual(["https://example.com/official-story"]);
  });

  it("renders a reviewable briefing, SEO package, manual X handoff, and verification ledger", () => {
    const body = renderDailyBriefing(sample);
    expect(body).toContain("# Publication-ready article package");
    expect(body).toContain("**Target keywords:** verified milestone, local sports, team news, player milestone, sports analysis");
    expect(body).toContain("### X — manual handoff");
    expect(body).toContain("## Omitted because verification was incomplete");
    expect(body).toContain("https://example.com/official-story");
  });

  it("enforces the repeatable quality contract before a briefing can be stored", () => {
    expect(evaluateDailyBriefing(sample, "2026-09-29")).toEqual([]);
    const issues = evaluateDailyBriefing({
      ...sample,
      briefingDate: "2026-09-28",
      opportunities: [{ ...sample.opportunities[0], sourceUrls: [] }],
      article: { ...sample.article, sourceUrls: [], targetKeywords: ["same", "same", "three", "four", "five"], bodyMarkdown: "No headings here." },
    }, "2026-09-29");
    expect(issues).toContain("briefing date does not match the requested date");
    expect(issues).toContain("an opportunity has no provider-matched source");
    expect(issues).toContain("the article has no provider-matched source");
    expect(issues).toContain("SEO target keywords are duplicated");
    expect(issues).toContain("article body needs at least two descriptive headings");
  });
});
