import { describe, expect, it } from "vitest";
import { contentForReviewSchema, reviewDecisionSchema } from "./schema";

const brandId = "11111111-1111-4111-8111-111111111111";
const contentId = "22222222-2222-4222-8222-222222222222";

describe("content review schemas", () => {
  it("accepts a normalized review-ready draft", () => {
    const result = contentForReviewSchema.parse({ brandId, title: "  Launch post  ", contentType: "SOCIAL_POST", body: "Draft body" });
    expect(result.title).toBe("Launch post");
  });

  it("rejects unsupported content types", () => {
    expect(contentForReviewSchema.safeParse({ brandId, title: "Draft", contentType: "PRESS_RELEASE", body: "" }).success).toBe(false);
  });

  it("requires a real brand identifier", () => {
    expect(contentForReviewSchema.safeParse({ brandId: "not-a-uuid", title: "Draft", contentType: "ARTICLE", body: "" }).success).toBe(false);
  });

  it("accepts only explicit human decisions", () => {
    expect(reviewDecisionSchema.safeParse({ contentId, decision: "APPROVED", notes: "Checked." }).success).toBe(true);
    expect(reviewDecisionSchema.safeParse({ contentId, decision: "PENDING", notes: "" }).success).toBe(false);
  });

  it("requires a recorded reason for rejection", () => {
    expect(reviewDecisionSchema.safeParse({ contentId, decision: "REJECTED", notes: "" }).success).toBe(false);
    expect(reviewDecisionSchema.safeParse({ contentId, decision: "REJECTED", notes: "Unsupported product claim." }).success).toBe(true);
  });

  it("caps review notes", () => {
    expect(reviewDecisionSchema.safeParse({ contentId, decision: "REJECTED", notes: "x".repeat(4_001) }).success).toBe(false);
  });
});
