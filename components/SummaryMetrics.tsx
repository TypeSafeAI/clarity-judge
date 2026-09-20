"use client";

import type { Summary } from "@/types/results";

type Props = { summary: Summary; simulated: boolean };

/** One compact orientation line; exact counts live in the filter controls. */
export function SummaryMetrics({ summary, simulated }: Props) {
  const allClear = summary.issues === 0 && summary.flagged === 0 && summary.total > 0;
  return (
    <div className={`verdict-summary${allClear ? " clear" : ""}`}>
      <h3>{allClear ? "No issues or uncertainty flagged." : "Review the highlighted checks."}</h3>
      <p className="summary-note">{simulated ? "Simulated results, deterministic for this text." : "Verdicts from Jev."}</p>
    </div>
  );
}
