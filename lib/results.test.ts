import { describe, expect, it } from "vitest";
import { buildSummary, confidenceBand, isFlagged } from "./results";
import { BUILT_IN_AXES } from "./builtInAxes";
import type { AxisResult } from "@/types/results";

const axis = (id: string) => BUILT_IN_AXES.find((a) => a.id === id)!;

function result(id: string, overrides: Partial<AxisResult>): AxisResult {
  return {
    axis: axis(id),
    answer: null,
    verdictLabel: "Yes",
    isIssue: false,
    confidence: 0.9,
    needsReview: false,
    evidence: null,
    ...overrides,
  };
}

describe("isFlagged", () => {
  it("flags below the threshold", () => {
    expect(isFlagged(result("hedging", { confidence: 0.69 }), 0.7)).toBe(true);
    expect(isFlagged(result("hedging", { confidence: 0.7 }), 0.7)).toBe(false);
  });
  it("always flags needsReview", () => {
    expect(isFlagged(result("hedging", { confidence: 1, needsReview: true }), 0.7)).toBe(true);
  });
});

describe("confidenceBand", () => {
  it("splits into low / medium / high around the threshold", () => {
    expect(confidenceBand(0.5, 0.7)).toBe("low");
    expect(confidenceBand(0.75, 0.7)).toBe("medium");
    expect(confidenceBand(0.9, 0.7)).toBe("high");
  });
});

describe("buildSummary", () => {
  it("handles no results", () => {
    expect(buildSummary([], 0.7).takeaway).toBe("No checks selected.");
  });

  it("celebrates a clean run", () => {
    const summary = buildSummary([result("hedging", {}), result("clarity", {})], 0.7);
    expect(summary).toMatchObject({ total: 2, passed: 2, issues: 0, flagged: 0 });
    expect(summary.takeaway).toBe("All 2 checks passed.");
  });

  it("names the axes with issues and counts flagged ones", () => {
    const summary = buildSummary(
      [
        result("hedging", { isIssue: true }),
        result("em_dashes", { isIssue: true, confidence: 0.6 }),
        result("clarity", {}),
        result("filler", { needsReview: true }),
      ],
      0.7,
    );
    expect(summary).toMatchObject({ total: 4, passed: 1, issues: 2, flagged: 2 });
    expect(summary.takeaway).toBe(
      "1 of 4 checks passed. Review hedging language and em dash usage. 1 check is low-confidence and worth a second look. 1 check has no usable answer and needs review.",
    );
  });

  it("does not describe missing answers as measured low confidence", () => {
    const summary = buildSummary([result("hedging", { needsReview: true, confidence: 0 })], 0.7);
    expect(summary).toMatchObject({ passed: 0, issues: 0, flagged: 1 });
    expect(summary.takeaway).toBe("0 of 1 checks passed. 1 check has no usable answer and needs review.");
  });
});
