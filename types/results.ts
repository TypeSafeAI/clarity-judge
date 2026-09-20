import type { Axis } from "./axis";
import type { JevAnswer } from "./jev";

export type Evidence = {
  /** The sentence (or phrase) most relevant to this axis. */
  snippet: string;
  /** 0-based position of the sentence in the text. */
  index: number;
  /** How many sentences the text was split into. */
  total: number;
  /**
   * True when the snippet was picked by our local keyword heuristic rather
   * than by Jev. The UI labels these "approximate".
   */
  approximate: boolean;
};

export type AxisResult = {
  axis: Axis;
  /** Null if Jev returned nothing for this axis. */
  answer: JevAnswer | null;
  /** Plain-language verdict, e.g. "Yes" or "Mixed / inconsistent". */
  verdictLabel: string;
  /** Optional second line, e.g. "Hedges too much". */
  verdictDetail?: string;
  /** True when the verdict is the undesirable one for this axis. */
  isIssue: boolean;
  /** 0–1. Copied from the answer for convenience. */
  confidence: number;
  /** True when the answer was missing/malformed; always shown as flagged. */
  needsReview: boolean;
  evidence: Evidence | null;
};

export type Summary = {
  total: number;
  passed: number;
  issues: number;
  /** Axes whose confidence is below the user's threshold (or need review). */
  flagged: number;
  takeaway: string;
};

export type JudgmentStatus = "idle" | "running" | "evidence" | "done" | "error";

/** Facts about the last run, shown as a readout in the header. */
export type Telemetry = {
  /** Wall-clock time for the whole run, in milliseconds. */
  latencyMs: number;
  /** Tokens Jev billed for the text + questions, if it told us. */
  inputTokens?: number;
  outputTokens?: number;
  model: string;
  source: "jev" | "simulated";
  questions: number;
  at: number;
};

export type Settings = {
  /** 0–1. Axes with confidence below this are flagged for a human look. */
  threshold: number;
  /** Ids of the axes currently switched on. */
  selectedAxisIds: string[];
};
