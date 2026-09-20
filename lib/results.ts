import type { AxisResult, Summary } from "@/types/results";

/** Default: flag anything under 70% confidence for a human look. */
export const DEFAULT_THRESHOLD = 0.7;

/** Should this result carry the "double-check" flag at the given threshold? */
export function isFlagged(result: AxisResult, threshold: number): boolean {
  return result.needsReview || result.confidence < threshold;
}

/** Three bands used for the confidence bar color + icon. */
export type ConfidenceBand = "high" | "medium" | "low";

export function confidenceBand(confidence: number, threshold: number): ConfidenceBand {
  if (confidence < threshold) return "low";
  // "High" starts halfway between the threshold and 100%.
  if (confidence >= threshold + (1 - threshold) / 2) return "high";
  return "medium";
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/** Aggregate per-axis results into the numbers and one-liner shown at the top. */
export function buildSummary(results: AxisResult[], threshold: number): Summary {
  const total = results.length;
  const flaggedResults = results.filter((r) => isFlagged(r, threshold));
  const unavailable = flaggedResults.filter((r) => r.needsReview).length;
  const lowConfidence = flaggedResults.length - unavailable;
  const issueResults = results.filter((r) => !r.needsReview && r.isIssue);
  const passed = results.filter((r) => !r.needsReview && !r.isIssue).length;

  let takeaway: string;
  if (total === 0) {
    takeaway = "No checks selected.";
  } else if (issueResults.length === 0 && flaggedResults.length === 0) {
    takeaway = `All ${total} checks passed.`;
  } else {
    const parts: string[] = [`${passed} of ${total} checks passed.`];
    if (issueResults.length > 0) {
      parts.push(`Review ${listNames(issueResults.map((r) => r.axis.name))}.`);
    }
    if (lowConfidence > 0) {
      parts.push(
        `${lowConfidence} ${lowConfidence === 1 ? "check is" : "checks are"} low-confidence and worth a second look.`,
      );
    }
    if (unavailable > 0) {
      parts.push(`${unavailable} ${unavailable === 1 ? "check has" : "checks have"} no usable answer and ${unavailable === 1 ? "needs" : "need"} review.`);
    }
    takeaway = parts.join(" ");
  }

  return { total, passed, issues: issueResults.length, flagged: flaggedResults.length, takeaway };
}

/** "a", "a and b", "a, b, and c" — lower-cased so it reads naturally mid-sentence. */
function listNames(names: string[]): string {
  const lowered = names.map((n) => n.toLowerCase());
  if (lowered.length === 1) return lowered[0];
  if (lowered.length === 2) return `${lowered[0]} and ${lowered[1]}`;
  return `${lowered.slice(0, -1).join(", ")}, and ${lowered[lowered.length - 1]}`;
}
