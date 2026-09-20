# Contributing to Clarity Judge

Read [README.md](README.md) for setup and [AGENTS.md](AGENTS.md) for the implementation boundaries. Use the pnpm version in package.json and `pnpm install --frozen-lockfile`.

A useful change improves one check, one evidence path, or one part of the interface. Keep dependency upgrades and new provider integrations separate. Use synthetic writing and never include real credentials or private drafts.

## Add or change a check

Define built-in checks in `lib/builtInAxes.ts`. Use a stable id, a focused question, a supported answer type, and explicit problem-answer polarity. Add tests for expected and opposite answers, uncertainty, and missing/malformed results. Do not count unavailable answers as passes.

Keep live results distinct from the mock. Source evidence must quote the supplied text; label heuristic selection approximate. The optional evidence request is separate from the primary verdict batch, so account for that when documenting requests and usage.

## Verify and submit

```sh
pnpm check:secrets
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

Use mocked transports for automated tests. For UI work, inspect demo/live labeling, custom checks, threshold changes, key removal, error states, keyboard controls, themes, and narrow layouts. Also verify replacement Undo (including command-palette actions), inline check polarity previews, nested probability details, and the narrow-screen writing/verdict navigation with evidence return focus. Draft recovery must remain in memory rather than browser storage. Review the diff for sensitive text even when the scanner passes.

Open a focused pull request with the intended behavior, relevant synthetic examples, commands actually run, results, and any unverified behavior. Do not describe simulated confidence as calibrated accuracy or a writing-style verdict as factual verification.
