# Judgment review flow implementation plan

Goal: deliver all five approved priorities, end to end, preserving per-check
semantics, privacy, source evidence and demo/live separation.

Architecture: keep workspace state in JudgeWorkspace. Add a pure check-definition
fingerprint and comparison helper. Report primary results through an optional
callback in runJudgmentDetailed, then finish bounded evidence lookup. Reuse the
custom-check builder for editing with a preview before save. No dependencies,
automatic provider requests or persisted writing/history.

- [x] Compact overview: remove repeated heading count and metrics grid; retain
  one short summary, mode label and counted filters. Update browser assertions.
- [x] Reading comfort: raise workspace helper/control text to 12–14px; quotes
  have comfortable line height and spacing. Verify 320/390/1024px and desktop,
  both themes, keyboard controls and axe accessibility.
- [x] Custom checks: edit with stable ID and declared options; preview question,
  options and issue polarity before create/update. Cancel preserves prior check.
  Undo removal restores original position and enabled state. Edits invalidate
  results using complete check definitions. Verify persistence and keyboard flow.
- [x] Progress: expose Evaluating checks and Finding evidence phases. Primary
  results become visible immediately; evidence updates the same run without
  resetting cards. Evidence failure retains approximate results. Prevent duplicate
  runs through shortcuts/palette while pending. Verify delayed/failing requests.
- [x] Comparisons: retain only the previous successful run in memory. Compare
  matching definitions and mode, show per-check outcome changes including
  uncertainty using the current threshold for both runs; explain exclusions.
  Failed runs do not replace the baseline; reload removes history.
- [x] Tests first: reproduce missing progressive results and comparison behavior
  with unit tests, then add browser tests for each new user flow and failure path.
- [x] Documentation: README and CONTRIBUTING describe actual final behavior.
- [x] Verify: pnpm check:secrets, pnpm lint, pnpm typecheck, pnpm test, pnpm build,
  pnpm test:e2e; inspect screenshots and independently review requirements/code.

Delivery: verify the feature branch, review the pull request feedback and checks,
then squash merge into main as requested. Record verification limits here.


Review evidence:
- Requirements review confirmed all five behaviors after gating source navigation
  until evidence lookup finishes.
- Quality review found choice renames dropping issue polarity. Existing options
  now retain independent values/descriptions through label edits and reordering;
  desktop/mobile regression covers this, and re-review found no material issues.
- New pending-evidence axe coverage found a disabled scroll pane without keyboard
  access. The writing pane is now a labeled, focusable region.
- Rendered desktop/light and mobile/dark editing views and 320px result views
  were inspected. This caught an edit-form padding override, now corrected.

Final verification receipts:
- `pnpm check:secrets`: passed, including all new source/tests added to the index
  with intent-to-add so the tracked-file scanner sees them.
- `pnpm lint`: passed.
- `pnpm typecheck`: passed.
- `pnpm test`: 79 passed across 11 files.
- `pnpm build`: passed with Next.js 16.3.5.
- `pnpm test:e2e --workers=2`: 110 passed, 5 expected platform-specific skips.
- `git diff --check`: passed.

The initial browser passes found a checkbox-driver interaction (fixed by using
keyboard Space), the loading-state keyboard-scroll accessibility bug (fixed in
SourcePanel), and one axe scan timeout under very high host load. The final full
run used two workers; no assertions or timeouts were weakened.

Completion audit:
| Priority | Authoritative coverage |
| --- | --- |
| Compact overview | review-flow browser test verifies removed metrics/header counts and counted filters; existing filtering and threshold tests pass. |
| Reading comfort | Confidence font assertion, 320/390/1024px no-overflow/navigation cases, desktop and mobile screenshots in both themes; final edit-padding screenshots inspected. |
| Custom editing | check-editing browser tests cover preview, cancel, stable ID, choice rename/reorder preserving values/descriptions/polarity, duplicate validation, Undo position/selection and reload persistence; review-flow checks definition-sensitive staleness. |
| Progressive results | Unit callback test and gated browser requests prove Evaluating/Finding phases, visible primary results, no duplicate run, evidence success without disclosure reset, and failure fallback; pending-state axe test passes. |
| Run comparison | Unit comparison tests and demo/live browser flows verify transitions, changed/new definitions, mode separation, shared threshold, failed-run baseline, and memory-only reload behavior. |

Requirements and code-quality reviews completed with all material findings fixed.
Real-provider calls and human VoiceOver/keyboard-only acceptance remain unverified.
