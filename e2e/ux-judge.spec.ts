import { expect, test } from "@playwright/test";
import { BUILT_IN_AXES } from "../lib/builtInAxes";
import { FAKE_KEY, checkChips, keyInput, mod, openJudge, resultCards, stubJudgeRoute } from "./helpers";

test("uncertainty labels distinguish the verdict, confidence, and raw yes probability", async ({ page }) => {
  await openJudge(page);
  await page.getByRole("slider", { name: /Flag anything under/ }).fill("95");
  const pass = resultCards(page).filter({ hasText: "Clarity up front" });
  await expect(pass.locator(".outcome-badge")).toHaveText("Pass · low confidence");
  await expect(pass.locator(".result-confidence")).toContainText("Answer confidence");
  await expect(pass.getByRole("meter")).toHaveCount(0);
  await pass.getByText("Details", { exact: true }).click();
  await expect(pass.getByRole("meter", { name: /Probability of yes/ })).toBeVisible();
  await expect(page.getByText("Needs review includes low-confidence passes and issues, plus checks without a usable answer.")).toBeVisible();
  await page.getByRole("button", { name: "Passed 3", exact: true }).click();
  await expect(pass).toBeVisible();
  await page.getByRole("button", { name: "Needs review 4", exact: true }).click();
  await expect(pass).toBeVisible();
});

test("live results keep missing answers distinct from a low-confidence pass", async ({ page }) => {
  await openJudge(page);
  const requests: string[] = [];
  page.on("request", (request) => { if (request.url().includes("/api/judge")) requests.push(request.url()); });
  await stubJudgeRoute(page, 200, {
    answers: [{ id: "hedging", type: "noul", value: false, probability: 0.4, confidence: 0.6, needsReview: false }],
    model: "mock-live",
  });
  await page.getByRole("button", { name: "API key settings" }).click();
  await keyInput(page).fill(FAKE_KEY);
  await page.getByRole("button", { name: "Save key", exact: true }).click();
  await page.keyboard.press("Escape");
  await page.getByLabel("Paste the text to judge").fill("A synthetic sentence.");
  await page.getByRole("button", { name: "Run judgment", exact: false }).click();
  const pass = resultCards(page).first();
  await expect(pass.locator(".outcome-badge")).toHaveText("Pass · low confidence");
  await expect(pass.locator(".result-score")).toHaveText("60%");
  await pass.getByText("Details", { exact: true }).click();
  await expect(pass.getByRole("meter")).toHaveAttribute("aria-valuenow", "40");
  const missing = resultCards(page).nth(1);
  await expect(missing.locator(".outcome-badge")).toHaveText("Needs review");
  await expect(missing.locator(".result-score")).toHaveText("—");
  await expect(missing).not.toContainText("low confidence");
  await expect(page.locator(".verdict-summary .summary-note")).not.toContainText("Simulated");
  await expect(page.locator(".verdict-summary h2")).toContainText("6 checks have no usable answer");
  await page.getByRole("slider", { name: /Flag anything under/ }).fill("50");
  await expect(pass.locator(".outcome-badge")).toHaveText("Pass");
  await page.getByRole("button", { name: "About Hedging language", exact: true }).click();
  await page.getByRole("button", { name: "Clear text", exact: true }).click();
  await page.getByRole("button", { name: "Undo replacement" }).click();
  await expect(page.getByLabel("Paste the text to judge")).toHaveValue("A synthetic sentence.");
  expect(requests).toHaveLength(1);
});

test("evidence navigation selects the provider's later duplicate sentence", async ({ page }) => {
  await openJudge(page);
  await page.route("**/api/judge", (route) => {
    const evidenceRequest = route.request().postDataJSON().questions[0].type === "choice";
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      answers: [{ id: "hedging", type: evidenceRequest ? "choice" : "noul", value: evidenceRequest ? "s3" : true, probability: 0.9, confidence: 0.9, needsReview: false }],
      model: "mock-live",
    }) });
  });
  await page.getByRole("button", { name: "API key settings" }).click();
  await keyInput(page).fill(FAKE_KEY);
  await page.getByRole("button", { name: "Save key", exact: true }).click();
  await page.keyboard.press("Escape");
  const duplicate = "Perhaps we should wait.";
  const text = `${duplicate} A direct decision follows.\n\n${duplicate}`;
  const editor = page.getByLabel("Paste the text to judge");
  await editor.fill(text);
  await page.getByRole("button", { name: "Run judgment", exact: false }).click();
  const card = resultCards(page).first();
  await expect(card.locator("figcaption")).toContainText("Sentence 3 of 3 · picked by Jev");
  await card.getByRole("button", { name: "Find in writing" }).click();
  await expect(editor).toBeFocused();
  expect(await editor.evaluate((element: HTMLTextAreaElement) => [element.selectionStart, element.selectionEnd])).toEqual([text.lastIndexOf(duplicate), text.length]);
});

test("clear, sample, and example replacements can be undone without storing drafts", async ({ page }) => {
  await openJudge(page);
  const editor = page.getByLabel("Paste the text to judge");
  const draft = "My synthetic draft. Keep this text in memory only.";
  await editor.fill(draft);
  for (const action of ["clear", "sample", "example"]) {
    if (action === "example") {
      await page.getByText("Try an example", { exact: true }).click();
      await page.getByRole("button", { name: /Clear update/ }).click();
    } else {
      await page.getByRole("button", { name: action === "clear" ? "Clear text" : "Load sample", exact: true }).click();
    }
    await expect(editor).not.toHaveValue(draft);
    await expect(page.getByRole("status").filter({ hasText: "Undo is available" })).toBeVisible();
    await page.getByRole("button", { name: "Undo replacement" }).click();
    await expect(editor).toHaveValue(draft);
    await expect(editor).toBeFocused();
    await expect(page.getByRole("status").filter({ hasText: "Previous text restored" })).toBeVisible();
    // Editing hides examples again even after the user reopens them.
    await editor.fill(draft);
  }
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain(draft);
  await page.reload();
  await expect(editor).not.toHaveValue(draft);
  await expect(page.getByRole("button", { name: "Undo replacement" })).toHaveCount(0);
});

test("palette replacements share undo and preserve the most recent replaced draft", async ({ page }) => {
  await openJudge(page);
  const editor = page.getByLabel("Paste the text to judge");
  await editor.fill("First synthetic draft.");
  await page.keyboard.press(`${mod}+k`);
  await page.getByRole("combobox", { name: "Search commands" }).fill("clear text");
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Undo replacement" }).click();
  await expect(editor).toHaveValue("First synthetic draft.");
  await editor.fill("Second synthetic draft.");
  await page.getByRole("button", { name: "Load sample", exact: true }).click();
  await page.getByRole("button", { name: "Undo replacement" }).click();
  await expect(editor).toHaveValue("Second synthetic draft.");
});

test("editing collapses examples and methodology stays available on demand", async ({ page }) => {
  await openJudge(page);
  const examples = page.getByRole("group", { name: "Writing examples" });
  await expect(examples).toBeVisible();
  await page.getByLabel("Paste the text to judge").fill("A focused draft.");
  await expect(examples).not.toBeVisible();
  const trigger = page.locator(".example-disclosure > summary");
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(examples).toBeVisible();
  const method = page.locator(".method-disclosure");
  await expect(method).not.toHaveAttribute("open", "");
  await method.locator("summary").click();
  await expect(method).toContainText("evidence request");
});

test("check previews expose each question and its issue polarity without toggling it", async ({ page }) => {
  await openJudge(page);
  for (const axis of BUILT_IN_AXES) {
    const trigger = page.getByRole("button", { name: `About ${axis.name}`, exact: true });
    await trigger.focus();
    await page.keyboard.press("Enter");
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    const preview = page.getByRole("region", { name: `${axis.name} check details`, exact: true });
    await expect(preview).toBeInViewport();
    await expect(preview).toContainText(axis.question);
    if (axis.kind === "yes_no") {
      await expect(preview).toContainText(`Counts as an issue: ${axis.issueWhen ? "Yes" : "No"}`);
    } else {
      for (const option of axis.options.filter((option) => axis.issueOptions.includes(option.value))) {
        await expect(preview).toContainText(option.label);
      }
    }
    await expect(checkChips(page).getByRole("checkbox", { name: axis.name, exact: true })).toBeChecked();
    await page.keyboard.press("Enter");
    await expect(preview).toHaveCount(0);
  }
});

test("evidence navigation returns focus to the same verdict and expires when edited", async ({ page }) => {
  await openJudge(page);
  const first = resultCards(page).first();
  await first.getByRole("button", { name: "Find in writing" }).click();
  const editor = page.getByLabel("Paste the text to judge");
  await expect(editor).toBeFocused();
  await page.getByRole("button", { name: "Back to Hedging language verdict", exact: true }).click();
  await expect(first.locator(":scope > summary")).toBeFocused();
  await first.getByRole("button", { name: "Find in writing" }).click();
  const check = checkChips(page).getByRole("checkbox", { name: "Hedging language", exact: true });
  await check.focus();
  await page.keyboard.press("Space");
  await expect(check).not.toBeChecked();
  await page.keyboard.press("Space");
  await expect(check).toBeChecked();
  await expect(page.getByRole("button", { name: /Back to .* verdict/ })).toHaveCount(0);
  await first.getByRole("button", { name: "Find in writing" }).click();
  await editor.fill("New text makes the previous evidence stale.");
  await expect(page.getByRole("button", { name: /Back to .* verdict/ })).toHaveCount(0);
});

for (const width of [320, 390, 1024]) {
  test(`narrow layouts keep writing, verdicts, and run reachable at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    await openJudge(page);
    const shortcuts = page.getByRole("navigation", { name: "Workspace shortcuts" });
    await expect(shortcuts).toBeInViewport();
    await shortcuts.getByRole("button", { name: "Verdicts", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Verdicts", exact: true })).toBeFocused();
    await expect(page.getByRole("heading", { name: "Verdicts", exact: true })).toBeInViewport();
    const headingTop = await page.locator("#results-title").evaluate((element) => element.getBoundingClientRect().top);
    const mainTop = await page.locator("main").evaluate((element) => element.getBoundingClientRect().top);
    expect(headingTop - mainTop).toBeLessThan(64);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await expect(page.getByRole("banner")).toBeInViewport();
    await expect(page.getByRole("button", { name: "Run judgment" })).toBeInViewport();
    await shortcuts.getByRole("button", { name: "Writing", exact: true }).click();
    await expect(page.getByLabel("Paste the text to judge")).toBeFocused();
    await page.getByRole("slider", { name: /Flag anything under/ }).scrollIntoViewIfNeeded();
    await expect(shortcuts).toBeInViewport();
    await expect(page.getByRole("button", { name: "Run judgment" })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    for (const theme of ["light", "dark"] as const) {
      await page.evaluate((value) => { document.documentElement.dataset.theme = value; }, theme);
      await shortcuts.getByRole("button", { name: "Writing", exact: true }).click();
      await page.screenshot({ path: testInfo.outputPath(`writing-${width}-${theme}.png`), animations: "disabled" });
      await shortcuts.getByRole("button", { name: "Verdicts", exact: true }).click();
      await page.screenshot({ path: testInfo.outputPath(`verdicts-${width}-${theme}.png`), animations: "disabled" });
    }
  });
}

test("desktop workspace screenshots cover both themes and inline previews", async ({ page, isMobile }, testInfo) => {
  test.skip(isMobile, "desktop layout coverage");
  await openJudge(page);
  await page.getByLabel("Paste the text to judge").fill("The launch is on Monday. Please confirm by Friday.");
  await page.getByRole("button", { name: "Run judgment" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Judgment complete" })).toBeVisible();
  await expect(page.locator(".summary-metrics strong.pass")).toHaveText("5");
  await page.getByRole("button", { name: "About Hedging language", exact: true }).click();
  for (const theme of ["light", "dark"] as const) {
    await page.evaluate((value) => { document.documentElement.dataset.theme = value; }, theme);
    await page.screenshot({ path: testInfo.outputPath(`workspace-${theme}.png`), animations: "disabled" });
  }
});
