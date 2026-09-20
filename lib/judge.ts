import type { Axis } from "@/types/axis";
import type { JevAnswer, JevErrorPayload, JevQuestion, JevRequest } from "@/types/jev";
import { JevApiError } from "@/types/jev";
import type { AxisResult, Evidence, Telemetry } from "@/types/results";
import { pickEvidence, scoreSentence, splitSentences } from "./evidenceHeuristic";
import { mockCallJev } from "./mockJevClient";

/**
 * Orchestrates one "Run Judgment":
 *   axes → Jev questions → answers (real or mock) → per-axis results with evidence.
 *
 * This file runs in the browser. In live mode it posts to our own API route
 * (which holds the key); in demo mode it calls the mock directly so results
 * feel instant.
 */

export type RunOptions = {
  demoMode: boolean;
  /** Key the user saved in the browser, if any. Sent as a header to our own route. */
  apiKey?: string;
  /** Live mode only: ask Jev a second, batched question to pick evidence sentences. */
  jevEvidence?: boolean;
  /** Primary results are available before the optional evidence request finishes. */
  onVerdicts?: (update: { results: AxisResult[]; telemetry: Telemetry; evidencePending: boolean }) => void;
};

/** Must match API_KEY_HEADER in app/api/judge/route.ts. */
const API_KEY_HEADER = "x-typesafe-api-key";

/** One axis becomes exactly one Jev question. */
export function axisToQuestion(axis: Axis): JevQuestion {
  if (axis.kind === "yes_no") {
    return {
      type: "noul",
      id: axis.id,
      question: axis.question,
      goodLooksLike: axis.goodLooksLike,
      criteria: axis.criteria,
    };
  }
  const optionDescriptions: Record<string, string> = {};
  for (const option of axis.options) {
    optionDescriptions[option.value] = option.description ?? option.label;
  }
  return {
    type: "choice",
    id: axis.id,
    question: axis.question,
    options: axis.options.map((o) => o.value),
    optionDescriptions,
    goodLooksLike: axis.goodLooksLike,
  };
}

export function axesToRequest(text: string, axes: Axis[]): JevRequest {
  return { context: text, questions: axes.map(axisToQuestion) };
}

/** Pair each answer with its axis and translate it into a plain-language verdict. */
export function answerToResult(axis: Axis, answer: JevAnswer | undefined, evidence: Evidence | null): AxisResult {
  if (!answer || answer.needsReview) {
    return {
      axis,
      answer: answer ?? null,
      verdictLabel: "Needs review",
      verdictDetail: "Jev didn't return a usable answer for this check.",
      isIssue: false,
      confidence: 0,
      needsReview: true,
      evidence,
    };
  }

  if (axis.kind === "yes_no") {
    const isYes = answer.value === true;
    return {
      axis,
      answer,
      verdictLabel: isYes ? "Yes" : "No",
      verdictDetail: isYes ? axis.yesLabel : axis.noLabel,
      isIssue: isYes === axis.issueWhen,
      confidence: answer.confidence,
      needsReview: false,
      evidence,
    };
  }

  const chosen = axis.options.find((o) => o.value === answer.value);
  return {
    axis,
    answer,
    verdictLabel: chosen?.label ?? String(answer.value),
    verdictDetail: chosen?.description,
    isIssue: axis.issueOptions.includes(String(answer.value)),
    confidence: answer.confidence,
    needsReview: false,
    evidence,
  };
}

/**
 * Demo mode helper: how strongly does the text "look like" this axis applies?
 * Counts keyword/pattern hits so the mock leans toward "yes" when the text is
 * full of hedges, em dashes, etc. Returns 0.5 (no lean) when there are no hints.
 */
export function keywordLean(text: string, axis: Axis): number {
  if (!axis.evidenceHint) return 0.5;
  const hits = splitSentences(text).reduce((sum, sentence) => sum + scoreSentence(sentence, axis), 0);
  // 0 hits → 0.25 (lean "no"); ~6+ hits → ~0.9 (lean "yes").
  return Math.min(0.9, 0.25 + hits * 0.11);
}

type LiveResponse = {
  answers: JevAnswer[];
  demo?: boolean;
  model?: string;
  latencyMs?: number;
  usage?: { inputTokens?: number; outputTokens?: number };
};

/** Post to our API route and return answers, or throw a JevApiError. */
async function fetchLiveAnswers(request: JevRequest, apiKey?: string): Promise<JevAnswer[]> {
  return (await fetchLive(request, apiKey)).answers;
}

async function fetchLive(request: JevRequest, apiKey?: string): Promise<LiveResponse> {
  let response: Response;
  try {
    response = await fetch("/api/judge", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(apiKey ? { [API_KEY_HEADER]: apiKey } : {}) },
      body: JSON.stringify(request),
    });
  } catch (error) {
    throw new JevApiError("Could not reach the app's API route.", "network", undefined, String(error));
  }

  const text = await response.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new JevApiError("The API route returned something that wasn't JSON.", "bad_response", response.status, text);
  }

  if (!response.ok) {
    const payload = body as Partial<JevErrorPayload>;
    throw new JevApiError(payload.error ?? `Request failed with HTTP ${response.status}.`, payload.code ?? "unknown", response.status, payload.raw);
  }

  return body as LiveResponse;
}

/**
 * Optional live-mode upgrade: ask Jev which sentence best demonstrates each
 * axis. We number the sentences, send them as the state, and ask one Choice
 * question per axis whose options are the sentence numbers. Any failure falls
 * back to the local heuristic — evidence is a nice-to-have, not the verdict.
 */
async function pickEvidenceWithJev(text: string, axes: Axis[], apiKey?: string): Promise<Record<string, Evidence>> {
  const sentences = splitSentences(text);
  if (sentences.length < 2 || sentences.length > 100) return {};

  const ids = sentences.map((_, i) => `s${i + 1}`);
  const optionDescriptions: Record<string, string> = {};
  ids.forEach((id, i) => (optionDescriptions[id] = sentences[i]));
  const numbered = ids.map((id, i) => `${id}: ${sentences[i]}`).join("\n");

  const request: JevRequest = {
    context: numbered,
    questions: axes.map((axis) => ({
      type: "choice",
      id: axis.id,
      question: `Which sentence most strongly influences the answer to: "${axis.question}"`,
      options: ids,
      optionDescriptions,
    })),
  };

  try {
    const answers = await fetchLiveAnswers(request, apiKey);
    const picked: Record<string, Evidence> = {};
    for (const answer of answers) {
      if (answer.needsReview || typeof answer.value !== "string") continue;
      const index = ids.indexOf(answer.value);
      if (index >= 0) picked[answer.id] = { snippet: sentences[index], index, total: sentences.length, approximate: false };
    }
    return picked;
  } catch {
    return {};
  }
}

export async function runJudgment(text: string, axes: Axis[], options: RunOptions): Promise<AxisResult[]> {
  return (await runJudgmentDetailed(text, axes, options)).results;
}

/** Like runJudgment, plus timing and token usage for the header readout. */
export async function runJudgmentDetailed(
  text: string,
  axes: Axis[],
  options: RunOptions,
): Promise<{ results: AxisResult[]; telemetry: Telemetry }> {
  const request = axesToRequest(text, axes);
  const started = performance.now();

  let answers: JevAnswer[];
  let usage: { inputTokens?: number; outputTokens?: number } = {};
  let model = "simulated";
  if (options.demoMode) {
    const lean: Record<string, number> = {};
    for (const axis of axes) lean[axis.id] = keywordLean(text, axis);
    answers = await mockCallJev(request, { lean });
    usage = { inputTokens: Math.ceil(request.context.length / 4), outputTokens: axes.length };
  } else {
    const live = await fetchLive(request, options.apiKey);
    answers = live.answers;
    usage = live.usage ?? {};
    model = live.model ?? "jev-latest";
  }

  const results = axes.map((axis) => {
    const answer = answers.find((a) => a.id === axis.id);
    const evidence = pickEvidence(text, axis);
    return answerToResult(axis, answer, evidence);
  });

  const telemetry: Telemetry = {
    latencyMs: Math.round(performance.now() - started),
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    model,
    source: options.demoMode ? "simulated" : "jev",
    questions: axes.length,
    at: Date.now(),
  };

  const sentenceCount = splitSentences(text).length;
  const evidencePending = !options.demoMode && !!options.jevEvidence && sentenceCount >= 2 && sentenceCount <= 100;
  options.onVerdicts?.({ results, telemetry, evidencePending });
  const jevEvidence = evidencePending ? await pickEvidenceWithJev(text, axes, options.apiKey) : {};
  return {
    results: results.map((result) => ({ ...result, evidence: jevEvidence[result.axis.id] ?? result.evidence })),
    telemetry: { ...telemetry, latencyMs: Math.round(performance.now() - started) },
  };
}
