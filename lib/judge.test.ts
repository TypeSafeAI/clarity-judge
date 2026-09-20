import { afterEach, describe, expect, it, vi } from "vitest";
import { answerToResult, axesToRequest, axisToQuestion, keywordLean, runJudgmentDetailed } from "./judge";
import { BUILT_IN_AXES } from "./builtInAxes";
import { buildSummary } from "./results";
import { SAMPLE_TEXT } from "./sampleText";
import type { Axis, ChoiceAxis, YesNoAxis } from "@/types/axis";
import type { JevAnswer } from "@/types/jev";
import { JevApiError } from "@/types/jev";

const axis = (id: string) => BUILT_IN_AXES.find((a) => a.id === id)!;
const hedging = axis("hedging") as YesNoAxis;
const tone = axis("tone") as ChoiceAxis;

describe("axisToQuestion", () => {
  it("turns a yes/no axis into a noul question with its criteria", () => {
    const q = axisToQuestion(hedging);
    expect(q).toMatchObject({ type: "noul", id: "hedging", question: hedging.question, criteria: hedging.criteria });
  });

  it("turns a choice axis into a choice question with option descriptions", () => {
    const q = axisToQuestion(tone);
    expect(q.type).toBe("choice");
    if (q.type !== "choice") throw new Error("expected a choice question");
    expect(q.options).toEqual(["formal", "casual", "mixed"]);
    expect(q.optionDescriptions?.casual).toBe(tone.options[1].description);
  });

  it("falls back to the option label when an option has no description", () => {
    const custom: ChoiceAxis = {
      id: "audience",
      kind: "choice",
      builtIn: false,
      name: "Audience",
      description: "Who is this for?",
      question: "Which audience is this text written for?",
      options: [
        { value: "engineers", label: "Engineers" },
        { value: "executives", label: "Executives" },
      ],
      issueOptions: [],
    };
    const q = axisToQuestion(custom);
    if (q.type !== "choice") throw new Error("expected a choice question");
    expect(q.optionDescriptions).toEqual({ engineers: "Engineers", executives: "Executives" });
  });

  it("passes goodLooksLike through for custom checks", () => {
    const custom: YesNoAxis = {
      id: "brand",
      kind: "yes_no",
      builtIn: false,
      name: "On brand",
      description: "Sounds like us.",
      question: "Does this sound like our brand voice?",
      goodLooksLike: "Short, warm, no jargon.",
      issueWhen: false,
    };
    expect(axisToQuestion(custom).goodLooksLike).toBe("Short, warm, no jargon.");
  });
});

describe("axesToRequest", () => {
  it("keeps the text as context and one question per axis, in order", () => {
    const request = axesToRequest("Some text.", [hedging, tone]);
    expect(request.context).toBe("Some text.");
    expect(request.questions.map((q) => q.id)).toEqual(["hedging", "tone"]);
  });
});

describe("answerToResult", () => {
  const noul = (value: boolean, probability: number): JevAnswer => ({
    id: "hedging",
    type: "noul",
    value,
    probability,
    confidence: Math.max(probability, 1 - probability),
    needsReview: false,
  });

  it("marks a missing answer as needs review, never as an issue", () => {
    const result = answerToResult(hedging, undefined, null);
    expect(result.needsReview).toBe(true);
    expect(result.isIssue).toBe(false);
    expect(result.confidence).toBe(0);
    expect(result.verdictLabel).toBe("Needs review");
    expect(result.answer).toBeNull();
  });

  it("marks a malformed answer as needs review", () => {
    const bad: JevAnswer = { id: "hedging", type: "noul", value: false, confidence: 0, needsReview: true };
    expect(answerToResult(hedging, bad, null).needsReview).toBe(true);
  });

  it("uses issueWhen to decide whether a yes is a problem", () => {
    const yes = answerToResult(hedging, noul(true, 0.9), null);
    expect(yes).toMatchObject({ verdictLabel: "Yes", verdictDetail: "Hedges too much", isIssue: true, confidence: 0.9 });

    const no = answerToResult(hedging, noul(false, 0.2), null);
    expect(no).toMatchObject({ verdictLabel: "No", verdictDetail: "States claims directly", isIssue: false, confidence: 0.8 });
  });

  it("treats a no as the issue when issueWhen is false", () => {
    const clarity = axis("clarity") as YesNoAxis;
    expect(clarity.issueWhen).toBe(false);
    expect(answerToResult(clarity, { ...noul(false, 0.3), id: "clarity" }, null).isIssue).toBe(true);
    expect(answerToResult(clarity, { ...noul(true, 0.8), id: "clarity" }, null).isIssue).toBe(false);
  });

  it("labels a choice answer with the option's label and flags issue options", () => {
    const mixed: JevAnswer = { id: "tone", type: "choice", value: "mixed", confidence: 0.7, needsReview: false };
    const result = answerToResult(tone, mixed, null);
    expect(result.verdictLabel).toBe("Mixed / inconsistent");
    expect(result.verdictDetail).toBe(tone.options[2].description);
    expect(result.isIssue).toBe(true);

    const formal: JevAnswer = { ...mixed, value: "formal" };
    expect(answerToResult(tone, formal, null).isIssue).toBe(false);
  });

  it("falls back to the raw value when Jev picks an option we don't know", () => {
    const odd: JevAnswer = { id: "tone", type: "choice", value: "shouty", confidence: 0.6, needsReview: false };
    const result = answerToResult(tone, odd, null);
    expect(result.verdictLabel).toBe("shouty");
    expect(result.isIssue).toBe(false);
  });

  it("carries the evidence through untouched", () => {
    const evidence = { snippet: "I think so.", index: 0, total: 1, approximate: true };
    expect(answerToResult(hedging, noul(true, 0.9), evidence).evidence).toBe(evidence);
  });
});

describe("keywordLean", () => {
  it("is neutral for an axis with no evidence hint", () => {
    const bare: Axis = { ...hedging, id: "bare", evidenceHint: undefined };
    expect(keywordLean("I think this might perhaps work.", bare)).toBe(0.5);
  });

  it("leans no when nothing matches and yes when the text is full of hits", () => {
    expect(keywordLean("The launch is on Monday.", hedging)).toBeCloseTo(0.25);
    const hedgy = "I think it might work. Perhaps it sort of does. Maybe, probably, arguably, it seems so.";
    expect(keywordLean(hedgy, hedging)).toBeGreaterThan(0.7);
  });

  it("never exceeds 0.9", () => {
    const wall = Array(40).fill("I think it might perhaps maybe sort of work.").join(" ");
    expect(keywordLean(wall, hedging)).toBe(0.9);
  });
});

describe("runJudgmentDetailed in demo mode", () => {
  it("reproduces the README's sample run exactly", async () => {
    const { results, telemetry } = await runJudgmentDetailed(SAMPLE_TEXT, BUILT_IN_AXES, { demoMode: true });

    const table = results.map((r) => [r.axis.name, r.verdictLabel, r.verdictDetail, Math.round(r.confidence * 100)]);
    expect(table).toEqual([
      ["Hedging language", "Yes", "Hedges too much", 100],
      ["Em dash usage", "Yes", "Overuses em dashes", 100],
      ["Clarity up front", "Yes", "Main point is clear early", 93],
      ["Filler phrases", "Yes", "Contains filler", 100],
      ["Tone consistency", "Casual", "Relaxed, conversational register throughout.", 62],
      ["Passive voice overuse", "Yes", "Leans on passive voice", 75],
      ["Actionability", "Clear next steps", "Specific actions, owners, or deadlines are stated.", 86],
    ]);
    expect(buildSummary(results, 0.7).takeaway).toBe(
      "3 of 7 checks passed. Review hedging language, em dash usage, filler phrases, and passive voice overuse. 1 check is low-confidence and worth a second look.",
    );

    // Demo evidence always comes from the local heuristic.
    expect(results.every((r) => r.evidence?.approximate === true)).toBe(true);
    expect(telemetry).toMatchObject({ model: "simulated", source: "simulated", questions: 7 });
    expect(telemetry.inputTokens).toBeGreaterThan(0);
  });

  it("returns one result per axis, in the order the axes were given", async () => {
    const axes = [tone, hedging];
    const { results } = await runJudgmentDetailed("Anyway, I think it might work.", axes, { demoMode: true });
    expect(results.map((r) => r.axis.id)).toEqual(["tone", "hedging"]);
  });
});

describe("runJudgmentDetailed in live mode", () => {
  afterEach(() => vi.unstubAllGlobals());

  function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  }

  it("publishes primary verdicts before a delayed evidence response", async () => {
    let release!: (response: Response) => void;
    const evidence = new Promise<Response>((resolve) => { release = resolve; });
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(jsonResponse({ answers: [{ id: "hedging", type: "noul", value: true, probability: 0.9, confidence: 0.9, needsReview: false }] }))
      .mockReturnValueOnce(evidence));
    const onVerdicts = vi.fn();
    const run = runJudgmentDetailed("Perhaps we wait. Decide Friday.", [hedging], { demoMode: false, jevEvidence: true, onVerdicts });
    await vi.waitFor(() => expect(onVerdicts).toHaveBeenCalledOnce());
    expect(onVerdicts.mock.calls[0][0].results[0]).toMatchObject({ isIssue: true, evidence: { approximate: true } });
    expect(onVerdicts.mock.calls[0][0].evidencePending).toBe(true);
    release(jsonResponse({ answers: [{ id: "hedging", type: "choice", value: "s2", confidence: 0.9, needsReview: false }] }));
    expect((await run).results[0].evidence?.index).toBe(1);
  });

  it("posts to /api/judge with the browser key and reads Jev's telemetry", async () => {
    const answers: JevAnswer[] = [
      { id: "hedging", type: "noul", value: true, probability: 0.9, confidence: 0.9, needsReview: false },
    ];
    const fetchMock = vi.fn(async () => jsonResponse({ answers, model: "jev-latest", usage: { inputTokens: 123, outputTokens: 1 } }));
    vi.stubGlobal("fetch", fetchMock);

    const { results, telemetry } = await runJudgmentDetailed("I think so.", [hedging], { demoMode: false, apiKey: "apikey_test" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/judge");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["x-typesafe-api-key"]).toBe("apikey_test");
    expect(JSON.parse(String(init.body))).toMatchObject({ context: "I think so.", questions: [{ id: "hedging", type: "noul" }] });

    expect(results[0]).toMatchObject({ verdictLabel: "Yes", isIssue: true, confidence: 0.9 });
    expect(results[0].evidence?.approximate).toBe(true);
    expect(telemetry).toMatchObject({ model: "jev-latest", source: "jev", inputTokens: 123, outputTokens: 1 });
  });

  it("makes a second request for evidence when asked, and labels the pick as Jev's", async () => {
    const text = "The launch slipped. I think it might slip again. Let me know by Friday.";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ answers: [{ id: "hedging", type: "noul", value: true, probability: 0.8, confidence: 0.8, needsReview: false }] }),
      )
      .mockResolvedValueOnce(jsonResponse({ answers: [{ id: "hedging", type: "choice", value: "s2", confidence: 0.9, needsReview: false }] }));
    vi.stubGlobal("fetch", fetchMock);

    const { results } = await runJudgmentDetailed(text, [hedging], { demoMode: false, jevEvidence: true });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const evidenceBody = JSON.parse(String((fetchMock.mock.calls[1] as unknown as [string, RequestInit])[1].body));
    expect(evidenceBody.questions[0]).toMatchObject({ type: "choice", id: "hedging", options: ["s1", "s2", "s3"] });
    expect(results[0].evidence).toEqual({ snippet: "I think it might slip again.", index: 1, total: 3, approximate: false });
  });

  it("falls back to the local heuristic when the evidence request fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ answers: [{ id: "hedging", type: "noul", value: true, probability: 0.8, confidence: 0.8, needsReview: false }] }),
      )
      .mockResolvedValueOnce(new Response("rate limited", { status: 429 }));
    vi.stubGlobal("fetch", fetchMock);

    const { results } = await runJudgmentDetailed("The launch slipped. I think it might slip again.", [hedging], { demoMode: false, jevEvidence: true });
    expect(results[0].evidence?.approximate).toBe(true);
    expect(results[0].evidence?.snippet).toBe("I think it might slip again.");
  });

  it("surfaces the route's error payload as a JevApiError", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: "Rate limit reached", code: "rate_limited" }, 429)));
    const promise = runJudgmentDetailed("Text.", [hedging], { demoMode: false });
    await expect(promise).rejects.toBeInstanceOf(JevApiError);
    await expect(promise).rejects.toMatchObject({ code: "rate_limited", status: 429 });
  });

  it("reports a non-JSON reply as bad_response and an unreachable route as network", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>502</html>", { status: 502 })));
    await expect(runJudgmentDetailed("Text.", [hedging], { demoMode: false })).rejects.toMatchObject({ code: "bad_response", status: 502 });

    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    await expect(runJudgmentDetailed("Text.", [hedging], { demoMode: false })).rejects.toMatchObject({ code: "network" });
  });
});
