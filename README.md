# Clarity Judge

Evaluate writing against **separate, named checks** with TypeSafe AI's Jev: hedging, em dash overuse, clarity, filler phrases, tone, passive voice, and actionability. Inspect each verdict, confidence signal, and supporting sentence rather than relying on one opaque overall score.

This is an **independent community project**, not an official TypeSafe product. It evaluates supplied writing; it does not generate a rewrite or establish that a passage is factually correct.

[Contributing](CONTRIBUTING.md) · [Agent guide](AGENTS.md) · [TypeSafe API reference](https://docs.typesafe.ai/api)

## Live demo

**[judge.jev.works](https://judge.jev.works)** runs this app as a public demo. It carries **no server API key**, so every visitor sees deterministic simulated results, labeled as demo mode. Those show how the interface behaves, not Jev's measured performance, and nothing a visitor does there reaches TypeSafe.

For real verdicts, open the key dialog and paste your own TypeSafe key. It is held in that browser's localStorage, travels only as a request header to the deployment's own `/api/judge` endpoint, and is never displayed again or stored by the deployment. Remove it from the same dialog when you are done, particularly on a shared machine.

The deployment has no server key on purpose. A public URL configured with one lets any visitor spend its credits, so this one leaves it unset and asks each person to bring their own.

## Run it locally

Use the pnpm version pinned in [package.json](package.json), currently `10.34.5`, and keep `pnpm-lock.yaml` as the only dependency lockfile. The manifest declares Node.js `>=20`; use a version supported by the installed Next.js dependency as well. Node.js 22+ is a practical development baseline.

```sh
git clone https://github.com/TypeSafeAI/clarity-judge.git
cd clarity-judge
# Activate the pnpm version declared in package.json.
# Where Corepack is installed, `corepack enable` enables its shims.
pnpm install --frozen-lockfile
pnpm dev
```

Open the address printed by Next.js, normally `http://localhost:3000`. Without a key, the app uses deterministic local mock results, clearly labeled as demo mode. They demonstrate the interface, not Jev's measured performance. The install guard permits **pnpm**, not npm or Yarn; do not create a second lockfile.

### Connect Jev

Obtain a key from the [TypeSafe console](https://console.typesafe.ai), then configure it on your own development server:

```sh
cp .env.local.example .env.local
# Edit .env.local and set TYPESAFE_API_KEY, then restart `pnpm dev`.
```

Alternatively, use the app's API key panel. A browser key overrides the server environment key; without either, the app stays in demo mode. Live requests go through this app's `/api/judge` endpoint to TypeSafe, not directly from the browser to the provider.

## Try a judgment

The editor starts with a deliberately hedgy sample. You can switch among three synthetic examples: a hedged launch note, a clear update, and vague next steps. Each card says what to inspect; selecting one replaces the editor text. Examples collapse under **Try an example** when you start editing, and **How judgments work** holds the request details. **Undo** restores the text replaced by Clear text, Load sample, an example, or the command palette. The previous text is kept in memory only and is lost on reload. Choose the checks to run, then press **Run Judgment**, or use `⌘/Ctrl + Enter` in the editor. Each enabled check becomes a separate typed question, submitted in one primary batch.

| Check | What it asks about |
| --- | --- |
| Hedging language | Unnecessary qualification of claims. |
| Em dash usage | Excessive reliance on em dashes. |
| Clarity up front | Whether the main point appears early. |
| Filler phrases | Words and phrases that add little substance. |
| Tone consistency | The passage's tone category. |
| Passive voice overuse | Whether passive constructions obscure the message. |
| Actionability | Whether the reader has clear next steps. |

These are editable writing preferences, not universal rules: a hedge may accurately express uncertainty, and passive voice can be appropriate. Check the actual text before acting on a verdict.

Results show a plain-language verdict, labeled answer confidence, and a relevant sentence. Uncertain answers say **Pass · low confidence** or **Issue · low confidence**; missing or malformed answers say **Needs review**. Open a card’s **Details** for the raw yes probability or option probabilities and the exact question. The default flagging threshold is 70%; moving it re-evaluates flags locally without a new model call. Filter cards by issues, checks needing review, or passes; filter counts update with the threshold, and a low-confidence pass can appear in both review and passed views. Problematic and uncertain cards expand first; **Expand all** exposes the current view. **Find in writing** selects an evidence sentence in the editor when the results are current; **Back to … verdict** returns focus to that card. Editing or rerunning clears the return path. If text or checks change, the old verdicts are marked stale and **Run updated judgment** refreshes them. Clear text from the editor when starting over. Exports retain the text associated with the displayed verdicts, even if the editor has since changed. During evidence lookup, exports include the approximate matches currently shown. The compact overview keeps counts in the filter controls, with no overall writing score. After another successful run, each card compares its outcome with the previous run kept in memory. New or edited check definitions are excluded; demo and live runs are never compared. Both runs use the current display threshold for uncertainty labels. Failed runs retain the last successful comparison baseline; reloading clears the history.

The interface follows the TypeSafe playground at [jev.works](https://jev.works): a sidebar with the judge and two reference pages (**Checks**, which lists every built-in question, and **How it works**), a topbar with the last run's latency and token readout, the API key dialog, and the theme switch. Use `⌘K` / `Ctrl+K` for the command palette and `⌘↵` / `Ctrl+Enter` to run. Narrow screens stack the two panels and move the sidebar behind a menu button. Below 1050px, a persistent toolbar keeps **Writing**, **Verdicts**, and **Run judgment** reachable while scrolling. The first two controls move focus to the editor and verdict heading.

## Accessibility

The interface is built to be used without a mouse, without colour vision, and with a screen reader.

- **Keyboard.** A skip link is the first tab stop. `⌘K` / `Ctrl+K` or the topbar button opens the command palette, a combobox with arrow, Home, End, Enter, and Escape support. `⌘↵` / `Ctrl+Enter` runs. Checks are real checkboxes styled as chips; result cards are native disclosures. Every dialog traps focus and returns it to the control that opened it.
- **Screen readers.** Landmarks for navigation, main, and footer; one polite status announcement when a run starts, finishes, or fails; probability tracks are named meters with a spoken value; icon-only controls carry labels; errors use `role="alert"`.
- **Vision.** Verdicts use an icon and a word as well as a colour. Text meets the 4.5:1 contrast floor in both themes, including small labels and chips. `prefers-contrast: more` strengthens lines and muted text, and Windows forced-colors mode keeps selected, active, and primary states visible.
- **Motion and touch.** `prefers-reduced-motion` removes every animation and transition, including result transitions. On touch screens every control is at least 44px tall.

Automated checks run against every page and state with axe-core (WCAG 2.2 AA rules plus best practices) report no violations. That is a floor, not a guarantee; if something is hard to use, open an issue.

## Add a custom check

Use the info button beside any check to read its exact question, answer options, and which answer counts as an issue without leaving the workspace. Check types are labeled **Yes / No** and **Choose one**.

Choose **Add a custom check**, then provide a name, question, and answer type: Yes/No or a fixed list of options. Declare which answers count as a problem; optionally describe what a good result looks like. Custom checks are stored in that browser's localStorage. The form previews the exact question, options, and issue criteria before saving. Open a custom check's info panel and choose **Edit** to change it without replacing its ID; **Cancel editing** leaves the saved check unchanged. Choice option labels and order can change while their saved identities and issue polarity remain intact. Saving a changed check makes previous results stale. **Undo check removal** restores the most recently removed check, its position, and whether it was enabled; this recovery is memory-only.

Keep questions narrow enough to judge from the supplied text. For built-in additions, edit `lib/builtInAxes.ts`; request construction, results, and summaries derive from those definitions. Keep ids stable and test both the answer mapping and the issue polarity.

## What the model returns

Jev answers structured questions rather than writing a critique. This app uses `noul` for Yes/No and `choice` for named options. The server adapter uses TypeSafe's `state`, `model`, and `questions` wire format with `jev-latest`; see `lib/jevClient.ts` and the API reference above.

For a Yes/No question, the provider returns the probability of “yes.” The app displays `max(p, 1 - p)` as the probability of the selected binary answer: 0.92 becomes 92%, while 0.5 becomes 50%. For choice questions, it uses the returned confidence value. These signals are not a guarantee of correctness, calibrated accuracy, or factual verification.

Missing or malformed answers remain **Needs review**. They must not silently become passing checks.

### Evidence and request counts

The primary request batches the enabled writing checks. **Evaluating checks** identifies this phase. Verdicts appear as soon as that request completes; **Finding evidence** marks the optional second phase while approximate local matches remain visible. Evidence upgrades the same cards without resetting open details. Running again is disabled until the current run finishes. When live evidence selection is enabled and the passage has 2–100 sentences, the app can make **one additional batched request** asking Jev to select sentence ids. Otherwise, or if that extra request fails, a local heuristic picks a likely sentence and labels it **approximate**.

Evidence always comes from the supplied text, not a generated quotation. A model-selected sentence is a relevance judgment, not proof of the model's causal reasoning or of the verdict's truth. Evidence lookup failure does not replace a failed primary judgment with a success.

At this revision, the token readout in `lib/judge.ts` uses the primary classification response; it does **not** aggregate usage from the optional evidence request. Demo token values are estimates. Do not treat the header as a complete billing ledger.

## API keys and privacy

A server `TYPESAFE_API_KEY` stays on the server; the client receives only configuration status. Do not put credentials in `NEXT_PUBLIC_` variables, checked-in files, screenshots, URLs, or model input.

A key entered in the browser is stored in localStorage and sent as the `x-typesafe-api-key` header to this deployment's `/api/judge` endpoint. The masked field reduces accidental screen exposure, but localStorage is not encrypted by the app and remains accessible to scripts on the origin and anyone with access to the browser profile. Users must trust the deployment handling their key. Remove browser keys on shared machines.

Live judgment sends the submitted writing and checks to TypeSafe. Use synthetic text for demonstrations and consider confidentiality before submitting unpublished or sensitive material. A public deployment configured with a server key lets visitor requests spend that key's credits: add appropriate access controls, request limits, and provider-side budgets, or leave the server key unset for a no-key demo. The deployment at [judge.jev.works](https://judge.jev.works) takes the last option, so no visitor request can spend a key that is not their own.

### Repository safeguards

The install-time `prepare` script installs the repository's Git hooks. The secret scanner supports staged-change checks and tracked-file scans; the repository also contains a CI workflow. Run `pnpm check:secrets` before sharing changes. Redaction helpers mask key-shaped strings in errors, and `.env.local` is gitignored.

These are safeguards, not a guarantee that every credential or private sentence will be detected. Review diffs and exports manually. If a key is exposed, revoke or rotate it at the provider rather than only deleting the visible copy.

## Errors

| Result | What to check |
| --- | --- |
| 401 / rejected key | The browser override and server key configuration. |
| 402 / no credits | The account's billing or credit state. |
| 429 / rate limit | Provider retry guidance; avoid rapid repeated requests. |
| 529 or 503 / overloaded | Retry later rather than fabricating a result. |
| Needs review on a card | Missing or malformed data for that check. |

The UI provides actionable error messages and an expandable upstream response. Treat diagnostic text as potentially sensitive even after redaction.

## Project map

| Path | Responsibility |
| --- | --- |
| `components/Shell.tsx`, `components/ShellContext.tsx` | Sidebar, topbar, demo banner, theme, and the key state shared with every page. |
| `components/JudgeWorkspace.tsx` | Client state and the judgment workflow. |
| `components/SourcePanel.tsx`, `components/CheckChips.tsx`, `components/CustomAxisBuilder.tsx` | Text input, built-in and custom check selection. |
| `components/ApiKeyDialog.tsx` | The only place a key is typed; masked, never displayed again. |
| `components/BrandMark.tsx`, `app/icon.svg`, `app/apple-icon.tsx` | The Clarity Judge mark, drawn once and reused for the sidebar and icons. |
| `lib/social.ts`, `lib/social-image.tsx`, `app/**/opengraph-image.tsx` | Per-page metadata and generated social preview images. |
| `app/checks/page.tsx`, `app/how-it-works/page.tsx` | Reference pages generated from the check definitions. |
| `components/ResultsPanel.tsx`, `components/AxisResultCard.tsx` | Result, evidence, and uncertainty presentation. |
| `lib/builtInAxes.ts` | Named built-in checks. |
| `lib/judge.ts` | Browser orchestration, answer mapping, and optional evidence selection. |
| `lib/jevClient.ts`, `app/api/judge/route.ts` | Provider adapter and server endpoint. |
| `lib/mockJevClient.ts`, `lib/evidenceHeuristic.ts` | Local simulation and approximate evidence. |
| `lib/results.ts`, `lib/storage.ts`, `lib/redact.ts`, `lib/errors.ts` | Summaries, storage, redaction, and error presentation. |
| `types/` | Check, provider, and result contracts. |
| `scripts/` | Secret scanner and Git-hook installation. |
| `e2e/` | Playwright suite: judge flows, key lifecycle, keyboard paths, and the axe-core accessibility gate. |

## Canonical URL

The public demo is served at **[judge.jev.works](https://judge.jev.works)**; the `clarity-judge.vercel.app` address is an alias of it. Canonical links, Open Graph URLs, and the generated preview images all name the branded domain, whichever host answered the request, so shared links and search results point at one address.

The Vercel aliases redirect there permanently, keeping path and query, so the two addresses never compete. Per-deployment URLs and branch previews are deliberately left alone, since they have to keep serving their own build until it is promoted.

That origin is `SITE_URL` in `lib/social.ts`, and `next.config.ts` builds the redirects from the same value. Set a `SITE_URL` environment variable to point a fork or a staging deploy at its own domain.

## Deployment

A push to `main` in [`TypeSafeAI/clarity-judge`](https://github.com/TypeSafeAI/clarity-judge) runs CI, then builds and deploys to production on Vercel. The production environment deliberately holds no `TYPESAFE_API_KEY`, which is what keeps the public site in demo mode.

Vercel reaches the repository through its GitHub App, installed on the `TypeSafeAI` organization. An app installation does not follow a repository between owners, so a transferred repository stops deploying until the app is installed for the new owner and the project is reconnected with `vercel git connect`. Until that is done, a push passes CI and silently never ships.

## Development checks

```sh
pnpm check:secrets
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e   # browser suite against the build you just made
```

`pnpm start` serves a production build. Automated tests should use mocks rather than consume real API credits. For interface changes, also check both modes, custom-check persistence, result thresholds, key removal, error states, keyboard controls, themes, and narrow screens.

## Related community projects

[TypeSafe AI Playground](https://github.com/TypeSafeAI/typesafe-playground) explores Jev experiments; [Jev Tool & Model Router](https://github.com/BunsDev/typesafe-router) separates route selection from execution; [TypeSafe UI](https://github.com/TypeSafeAI/typesafe-ui) provides reusable interface components. These are separate repositories, not an automatically integrated product suite.

The proposed GitHub About description and discovery topics are recorded in [repository-metadata.json](repository-metadata.json). That file does not update GitHub settings automatically.
