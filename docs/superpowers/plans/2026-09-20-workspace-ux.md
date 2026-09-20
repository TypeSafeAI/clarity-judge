# Workspace UX implementation checklist

Goal: implement all five improvements in Val's supplied brief, preserving current
worktree edits, provider behavior, and existing result semantics.

Architecture: keep judgment and replacement state in `JudgeWorkspace`, presentation
in the existing panels, and transient check previews in `CheckChips`. Use native
disclosures, existing theme tokens, and memory-only undo. No dependencies or new
provider requests.

- [x] Add failing browser regressions in `e2e/ux-judge.spec.ts` for all five flows.
- [x] Label answer confidence and low-confidence outcomes in `AxisResultCard`;
  put raw probabilities and the exact question in nested Details. Explain the
  overlapping filters in `ResultsPanel` without changing counts or thresholds.
- [x] Route clear, sample, example, and palette replacements through one handler
  in `JudgeWorkspace`; expose one-step Undo and a polite announcement in
  `SourcePanel`. Keep drafts out of storage and restore editor focus.
- [x] Collapse examples when editing begins; make methodology a closed disclosure
  in `SourcePanel`, with accurate demo/live request wording.
- [x] Add keyboard-accessible check previews in `CheckChips`, showing the exact
  question, declared options and issue polarity for built-in and custom checks.
  Use Yes / No and Choose one labels.
- [x] Add narrow-screen Writing / Verdicts shortcuts and a persistent run action.
  Return from located evidence to the originating verdict with focus restored.
  Invalidate that return target when results become stale or a new run begins.
- [x] Adapt existing keyboard tests for the new Details disclosure; extend axe
  coverage to previews, undo, raw details, and mobile controls in both themes.
- [x] Align README and CONTRIBUTING with the implemented flows.
- [x] Verify with pinned pnpm 10.34.5: `pnpm check:secrets`, `pnpm lint`,
  `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm test:e2e`.
- [x] Inspect desktop and narrow-screen screenshots, review the diff, and audit
  the five requirements against fresh tests. Report the human accessibility and
  real-provider verification gaps.


Verification receipts:

- `pnpm check:secrets`: passed (tracked-file scan); new test and plan manually reviewed.
- `pnpm lint`: passed.
- `pnpm typecheck`: passed.
- `pnpm test`: 74 tests passed across 10 files.
- `pnpm build`: passed with Next.js 16.3.5.
- `pnpm test:e2e --workers=4`: 86 passed, 5 expected platform-specific skips.
- `git diff --check`: passed.

Requirement evidence:

| Requirement | Evidence |
| --- | --- |
| Clear uncertainty | Demo and mocked live browser cases distinguish low-confidence passes, missing answers, and raw yes probability; summary unit tests distinguish unavailable answers. |
| More editor space | Browser case verifies examples collapse on edit and reopen by keyboard; methodology remains a closed disclosure until requested. |
| Inline check explanations | Every built-in question/polarity preview is tested for visibility and keyboard access; custom Yes/No and choice previews are covered by custom-check tests. |
| Recover replaced text | Clear, sample, example, and palette flows restore the previous text and editor focus; storage and reload checks prove recovery remains in memory. |
| Shorter mobile review loop | 320px, 390px, and 1024px cases verify persistent controls, focus, top-aligned verdict jumps without outer-page scrolling, and return to the originating evidence card. |

Inspected rendered screenshots in both themes, including desktop previews and
narrow-screen writing/verdict views. Axe checks cover default/expanded results,
raw probability details, check previews, Undo, custom checks, dialogs, errors,
reference pages, and mobile navigation. Independent code review found no material
regressions. Evidence return targets are cleared on edits, check changes, and new
runs; a mode mismatch also makes the target unavailable.

Limits: live-mode tests use a stubbed provider. No real provider calls, manual
VoiceOver acceptance, or human keyboard-only acceptance were performed. Existing
worktree edits were preserved.
