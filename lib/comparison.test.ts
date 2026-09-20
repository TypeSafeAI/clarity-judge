import { expect, it } from "vitest";
import { compareResult, checkDefinition } from "./comparison";
import { BUILT_IN_AXES } from "./builtInAxes";
import type { AxisResult } from "@/types/results";

const result: AxisResult = { axis: BUILT_IN_AXES[0], answer: null, verdictLabel: "Yes", confidence: 0.9, isIssue: true, needsReview: false, evidence: null };
it("compares outcomes, uncertainty and missing answers at the same threshold", () => {
  expect(compareResult({ ...result, isIssue: false }, [result], 0.7)).toBe("Issue → Pass");
  expect(compareResult({ ...result, needsReview: true }, [result], 0.7)).toBe("Issue → Needs review");
  expect(compareResult({ ...result, confidence: 0.6 }, [result], 0.7)).toBe("Issue → Issue · low confidence");
  expect(compareResult({ ...result, confidence: 0.6 }, [result], 0.5)).toBe("Unchanged: Issue");
});
it("does not compare new or modified checks", () => {
  expect(compareResult(result, [], 0.7)).toBe("New check · no comparison");
  expect(compareResult({ ...result, axis: { ...result.axis, question: "Changed?" } }, [result], 0.7)).toBe("Check changed · no comparison");
  expect(checkDefinition({ ...result.axis, goodLooksLike: "New guidance" })).not.toBe(checkDefinition(result.axis));
});

it("excludes changed option polarity and reports different choices within one outcome", () => {
  const axis = BUILT_IN_AXES.find((item) => item.kind === "choice")!;
  if (axis.kind !== "choice") throw new Error("Choice fixture required");
  const before = { ...result, axis, isIssue: false, verdictLabel: "Formal" };
  expect(compareResult({ ...before, verdictLabel: "Casual" }, [before], 0.7)).toBe("Formal → Casual (Pass)");
  expect(compareResult({ ...before, axis: { ...axis, issueOptions: [] } }, [before], 0.7)).toBe("Check changed · no comparison");
  expect(compareResult({ ...before, axis: { ...axis, options: axis.options.map((option, index) => index ? option : { ...option, label: "Renamed" }) } }, [before], 0.7)).toBe("Check changed · no comparison");
});

it("treats reordered object properties as the same saved definition", () => {
  const { id, ...rest } = result.axis;
  expect(checkDefinition({ ...rest, id })).toBe(checkDefinition(result.axis));
});
