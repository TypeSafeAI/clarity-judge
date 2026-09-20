"use client";

import { useState } from "react";
import { ChevronDown, LoaderCircle } from "lucide-react";
import { compareResult } from "@/lib/comparison";
import { isFlagged } from "@/lib/results";
import { explainError } from "@/lib/errors";
import type { AxisResult, Evidence, JudgmentStatus, Summary } from "@/types/results";
import type { JevErrorPayload } from "@/types/jev";
import { AxisResultCard } from "./AxisResultCard";
import { SummaryMetrics } from "./SummaryMetrics";
import { Empty, Export } from "./ui";

type Props = {
  status: JudgmentStatus;
  previousRun: { results: AxisResult[]; simulated: boolean } | null;
  results: AxisResult[];
  summary: Summary | null;
  error: JevErrorPayload | null;
  /** True when the text or checks changed after the last run. */
  stale: boolean;
  threshold: number;
  onThresholdChange: (value: number) => void;
  onRetry: () => void;
  canRun: boolean;
  onChangeKey: () => void;
  onLocateEvidence: (evidence: Evidence, trigger: HTMLButtonElement, name: string) => void;
  demoMode: boolean;
  /** True when the results on screen came from the mock, whatever the mode is now. */
  resultsSimulated: boolean;
  /** Increments per run so cards re-animate and disclosure defaults reset. */
  runId: number;
  exportData: unknown;
};

/** Right panel: the verdicts, one card per check, plus the threshold. */
export function ResultsPanel({ status, previousRun, results, summary, error, stale, threshold, onThresholdChange, onRetry, canRun, onChangeKey, onLocateEvidence, demoMode, resultsSimulated, runId, exportData }: Props) {
  const explained = error ? explainError(error) : null;
  const [filter, setFilter] = useState<"all" | "issues" | "review" | "passed">("all");
  const visibleResults = results.filter((result) =>
    filter === "all" ||
    (filter === "issues" && result.isIssue && !result.needsReview) ||
    (filter === "review" && (result.needsReview || isFlagged(result, threshold))) ||
    (filter === "passed" && !result.isIssue && !result.needsReview),
  );
  const filterCounts = {
    all: results.length,
    issues: results.filter((result) => result.isIssue && !result.needsReview).length,
    review: results.filter((result) => result.needsReview || isFlagged(result, threshold)).length,
    passed: results.filter((result) => !result.isIssue && !result.needsReview).length,
  };

  // Progressive disclosure: issues and flagged checks start open, passes closed.
  // Any manual toggle or expand/collapse-all overrides that until the next run.
  const [override, setOverride] = useState<{ runId: number; ids: Set<string> } | null>(null);
  const defaultOpen = (r: AxisResult) => r.isIssue || r.needsReview || isFlagged(r, threshold);
  const isOpen = (r: AxisResult) => (override && override.runId === runId ? override.ids.has(r.axis.id) : defaultOpen(r));
  const allOpen = visibleResults.length > 0 && visibleResults.every(isOpen);

  function toggleOne(id: string) {
    const ids = new Set(results.filter(isOpen).map((r) => r.axis.id));
    if (ids.has(id)) ids.delete(id);
    else ids.add(id);
    setOverride({ runId, ids });
  }
  function setAll(open: boolean) {
    const ids = new Set(results.filter(isOpen).map((r) => r.axis.id));
    for (const result of visibleResults) {
      if (open) ids.add(result.axis.id);
      else ids.delete(result.axis.id);
    }
    setOverride({ runId, ids });
  }

  const running = status === "running" || status === "evidence";
  const evaluating = status === "running";
  // One polite announcement per state change, instead of narrating the whole panel.
  const announcement = evaluating
    ? demoMode ? "Evaluating checks · simulated locally." : "Evaluating checks · one verdict request."
    : status === "evidence"
      ? "Finding evidence · verdicts are ready; showing approximate matches for now."
      : status === "error" && explained
        ? `Run failed. ${explained.title}.`
        : status === "done" && summary
          ? `Judgment complete. ${summary.takeaway}`
          : "";

  return (
    <section className="panel" aria-labelledby="results-title">
      <div className="panel-heading">
        <div>
          <h2 id="results-title" tabIndex={-1}>Verdicts</h2>
        </div>
        <Export data={exportData} name="clarity-judge.json" />
      </div>

      <p className={running ? "status-line run-progress" : "sr-only"} role="status" aria-live="polite">
        {running && <LoaderCircle size={14} className="spin" aria-hidden />}
        {announcement}
      </p>
      <div className="panel-content scroll">
        {status === "error" && error && explained && (
          <div className="error-note" role="alert">
            <strong>
              {explained.title}
              {error.status ? ` · HTTP ${error.status}` : ""}
            </strong>
            {explained.detail}
            {explained.actions.length > 0 && (
              <div className="run-actions">
                {explained.actions.map((action) =>
                  action.kind === "link" ? (
                    <a key={action.label} className="button primary" href={action.href} target="_blank" rel="noreferrer">
                      {action.label} ↗
                    </a>
                  ) : (
                    <button
                      key={action.label}
                      type="button"
                      className={`button${action.kind === "retry" ? " primary" : ""}`}
                      onClick={action.kind === "retry" ? onRetry : onChangeKey}
                    >
                      {action.label}
                    </button>
                  ),
                )}
              </div>
            )}
            {error.raw && (
              <details className="disclosure">
                <summary>
                  <ChevronDown size={14} className="marker" />
                  Raw response <span className="count">{error.code}</span>
                </summary>
                <pre className="criteria-preview">{error.raw}</pre>
              </details>
            )}
          </div>
        )}

        {stale && !running && (
          <div className="notice stale-notice">
            <span>The text or checks changed. These verdicts reflect the previous run. Run again to refresh them.</span>
            <button type="button" className="button small" disabled={!canRun} onClick={onRetry}>Run updated judgment</button>
          </div>
        )}

        {status === "idle" && results.length === 0 && (
          <Empty title="Nothing judged yet.">Pick your checks and press Run judgment to see a verdict, a confidence, and the evidence for each one.</Empty>
        )}

        {results.length > 0 && summary && (
          <div style={{ opacity: evaluating ? 0.5 : 1, transition: "opacity 150ms" }}>
            <SummaryMetrics summary={summary} simulated={resultsSimulated} />

            <div className="result-filters" role="group" aria-label="Filter verdicts">
              {(["all", "issues", "review", "passed"] as const).map((option) => (
                <button key={option} type="button" className="result-filter" aria-pressed={filter === option} onClick={() => setFilter(option)}>
                  {option === "all" ? "All" : option === "issues" ? "Issues" : option === "review" ? "Needs review" : "Passed"} <span>{filterCounts[option]}</span>
                </button>
              ))}
            </div>
            <details className="filter-explanation">
              <summary>What needs review?</summary>
              <p id="review-filter-help" className="field-hint">Needs review includes low-confidence passes and issues, plus checks without a usable answer.</p>
            </details>
            {previousRun && !evaluating && (
              <p className="comparison-note">{previousRun.simulated !== resultsSimulated
                ? "Demo and live runs are not compared."
                : `Compared with previous ${resultsSimulated ? "demo" : "live"} run`}</p>
            )}

            <div className="results-toolbar">
              <span className="muted">
                {visibleResults.length} of {results.length} {results.length === 1 ? "check" : "checks"} shown
              </span>
              <button type="button" className="button quiet small" disabled={visibleResults.length === 0} onClick={() => setAll(!allOpen)}>
                {allOpen ? "Collapse all" : "Expand all"}
              </button>
            </div>

            <div className="evidence-list">
              {visibleResults.map((result, i) => (
                <AxisResultCard
                  key={`${runId}-${result.axis.id}`}
                  result={result}
                  comparison={!evaluating && previousRun && previousRun.simulated === resultsSimulated ? compareResult(result, previousRun.results, threshold) : undefined}
                  threshold={threshold}
                  index={i}
                  expanded={isOpen(result)}
                  onToggle={() => toggleOne(result.axis.id)}
                  onLocateEvidence={stale || running ? undefined : (evidence, trigger) => onLocateEvidence(evidence, trigger, result.axis.name)}
                />
              ))}
              {visibleResults.length === 0 && <p className="filter-empty">No verdicts match this filter.</p>}
            </div>
          </div>
        )}

        <div className="threshold">
          <label htmlFor="judge-threshold">
            Flag anything under <strong>{Math.round(threshold * 100)}%</strong>
          </label>
          <input
            id="judge-threshold"
            type="range"
            min={50}
            max={95}
            step={5}
            value={Math.round(threshold * 100)}
            aria-valuetext={`${Math.round(threshold * 100)} percent confidence`}
            onChange={(event) => onThresholdChange(Number(event.target.value) / 100)}
          />
          <div className="input-meta">
            <span>Trust more answers</span>
            <span>Ask for a second look sooner</span>
          </div>
        </div>
      </div>

      <p className="panel-footnote">
        Answer confidence is derived from yes/no probabilities or supplied for the chosen option. It is not a guarantee of accuracy. Flags update instantly without a new request.
        {demoMode ? " Demo results are simulated." : ""}
      </p>
    </section>
  );
}
