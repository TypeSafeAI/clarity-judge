/**
 * Why the verdicts on screen no longer match the workspace, in one sentence a
 * person can act on. The mode matters most: simulated verdicts sitting under a
 * live badge (or the reverse) must never read as "the text changed".
 */
export type StaleReasons = {
  textChanged: boolean;
  checksChanged: boolean;
  /** True when the results came from the mock but a key is now in use, or vice versa. */
  modeChanged: boolean;
};

export function isStale(reasons: StaleReasons): boolean {
  return reasons.textChanged || reasons.checksChanged || reasons.modeChanged;
}

/**
 * @param resultsSimulated whether the verdicts on screen came from the mock.
 * @param blocker why a run can't start right now, phrased as the next step, or null.
 */
export function describeStaleness(reasons: StaleReasons, resultsSimulated: boolean, blocker: string | null): string {
  const changed = [reasons.textChanged && "text", reasons.checksChanged && "checks"].filter((part): part is string => !!part).join(" and ");
  let lead: string;
  let state: string;
  let action: string;
  if (reasons.modeChanged && resultsSimulated) {
    lead = changed ? `You switched to live mode and the ${changed} changed.` : "You switched to live mode.";
    state = "These verdicts are still simulated.";
    action = "Run again for real verdicts from Jev.";
  } else if (reasons.modeChanged) {
    lead = changed ? `You switched back to demo mode and the ${changed} changed.` : "You switched back to demo mode.";
    state = "These verdicts came from Jev.";
    action = "Running again will simulate results.";
  } else {
    lead = `The ${changed || "workspace"} changed.`;
    state = "These verdicts reflect the previous run.";
    action = "Run again to refresh them.";
  }
  return `${lead} ${state} ${blocker ?? action}`;
}
