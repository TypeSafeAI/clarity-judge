import type { Axis } from "@/types/axis";
import type { AxisResult } from "@/types/results";
import { isFlagged } from "./results";

/** Explicit fields keep persisted object property order from affecting identity. */
export function checkDefinition(axis: Axis): string {
  return JSON.stringify([
    axis.id, axis.name, axis.description, axis.question, axis.goodLooksLike ?? "", axis.kind,
    axis.evidenceHint?.keywords ?? [], axis.evidenceHint?.pattern ?? "",
    axis.kind === "yes_no"
      ? [axis.issueWhen, axis.yesLabel ?? "", axis.noLabel ?? "", axis.criteria?.true ?? "", axis.criteria?.false ?? ""]
      : [axis.options.map((option) => [option.value, option.label, option.description ?? ""]), [...axis.issueOptions].sort()],
  ]);
}

export function outcomeLabel(result: AxisResult, threshold: number): string {
  if (result.needsReview) return "Needs review";
  return `${result.isIssue ? "Issue" : "Pass"}${isFlagged(result, threshold) ? " · low confidence" : ""}`;
}

export function compareResult(result: AxisResult, previous: AxisResult[], threshold: number): string {
  const before = previous.find((item) => item.axis.id === result.axis.id);
  if (!before) return "New check · no comparison";
  if (checkDefinition(before.axis) !== checkDefinition(result.axis)) return "Check changed · no comparison";
  const oldLabel = outcomeLabel(before, threshold);
  const newLabel = outcomeLabel(result, threshold);
  if (oldLabel !== newLabel) return `${oldLabel} → ${newLabel}`;
  if (!result.needsReview && before.verdictLabel !== result.verdictLabel) return `${before.verdictLabel} → ${result.verdictLabel} (${newLabel})`;
  return `Unchanged: ${newLabel}`;
}
