import { expect, test } from "@playwright/test";
import { alerts, openJudge, resultCards } from "./helpers";

test.describe("judge workspace in demo mode", () => {
  test("runs the sample automatically and shows the README's deterministic result", async ({ page }) => {
    await openJudge(page);

    await expect(page.getByRole("heading", { level: 1 })).toContainText("Decisions, not scores.");
    await expect(page.locator(".demo-banner")).toContainText("Demo mode");
    await expect(page.locator(".usage-badge")).toContainText("Demo");

    const cards = resultCards(page);
    await expect(cards).toHaveCount(7);
    await expect(page.locator(".verdict-summary h3")).toHaveText("Review the highlighted checks.");
    await expect(page.locator(".verdict-summary .summary-note")).toContainText("Simulated");
    await expect(page.getByRole("button", { name: "Passed 3", exact: true })).toBeVisible();

    // The first card is the hedging issue, open by default because it is an issue.
    const first = cards.first();
    await expect(first).toHaveAttribute("data-outcome", "issue");
    await expect(first).toHaveAttribute("open", "");
    await expect(first.locator(".result-score")).toHaveText("100%");
    await expect(first.locator(".evidence-quote figcaption")).toContainText("approximate");

    // Passes start collapsed.
    const pass = cards.filter({ has: page.locator('[data-outcome="pass"]') }).first();
    await expect(pass).not.toHaveAttribute("open", "");
  });

  test("threshold slider re-flags locally without a new run", async ({ page }) => {
    await openJudge(page);
    const flagged = page.getByRole("button", { name: /^Needs review/ });
    await expect(flagged).toHaveText("Needs review 1");

    const requests: string[] = [];
    page.on("request", (r) => r.url().includes("/api/judge") && requests.push(r.url()));

    const slider = page.getByRole("slider", { name: /Confidence threshold|Flag anything under/ });
    await slider.focus();
    // 70% -> 95% flags the 93%, 86%, and 75% results too.
    for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowRight");
    await expect(page.locator(".threshold label strong")).toHaveText("95%");
    await expect(flagged).toHaveText("Needs review 4");
    expect(requests).toHaveLength(0);
  });

  test("expand all and collapse all override the defaults until the next run", async ({ page }) => {
    await openJudge(page);
    const cards = resultCards(page);
    await page.getByRole("button", { name: "Expand all" }).click();
    for (const card of await cards.all()) await expect(card).toHaveAttribute("open", "");

    await page.getByRole("button", { name: "Collapse all" }).click();
    for (const card of await cards.all()) await expect(card).not.toHaveAttribute("open", "");
  });

  test("editing the text marks the results stale, and re-running clears it", async ({ page }) => {
    await openJudge(page);
    await expect(page.locator(".panel .notice")).toHaveCount(0);
    await page.getByLabel("Paste the text to judge").fill("Mistakes were made. It is what it is.");
    await expect(page.locator(".panel .notice")).toContainText("Run again");
    await page.getByRole("button", { name: "Run judgment" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Judgment complete" })).toBeVisible();
    await expect(page.locator(".panel .notice")).toHaveCount(0);
  });

  test("refuses to run with no text and says so", async ({ page }) => {
    await openJudge(page);
    await page.getByLabel("Paste the text to judge").fill("");
    await expect(page.getByRole("button", { name: "Run judgment" })).toBeDisabled();
    await page.keyboard.press(process.platform === "darwin" ? "Meta+Enter" : "Control+Enter");
    await expect(alerts(page)).toContainText("Add some text to judge first.");
  });

  test("export is enabled once there are results", async ({ page }) => {
    await openJudge(page);
    await expect(page.getByRole("button", { name: "Export" })).toBeEnabled();
  });

  test("clear, filter, and export keep the last judged source", async ({ page }) => {
    await openJudge(page);
    const source = page.getByLabel("Paste the text to judge");
    const judgedText = await source.inputValue();

    await page.getByRole("button", { name: "Issues 4", exact: true }).click();
    await expect(resultCards(page)).toHaveCount(4);
    await page.getByRole("button", { name: "Passed 3", exact: true }).click();
    await expect(resultCards(page)).toHaveCount(3);
    await page.getByRole("button", { name: "All 7", exact: true }).click();
    await expect(resultCards(page)).toHaveCount(7);

    await page.getByRole("button", { name: "Clear text" }).click();
    await expect(source).toBeEmpty();
    await expect(page.locator(".panel .notice")).toContainText("Run again");
    await expect(page.getByRole("button", { name: "Run updated judgment" })).toBeDisabled();
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export" }).click();
    const download = await downloadPromise;
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    expect(JSON.parse(Buffer.concat(chunks).toString()).text).toBe(judgedText);
  });

  test("examples explain their focus and can each be judged", async ({ page }) => {
    await openJudge(page);
    const examples = page.getByRole("group", { name: "Writing examples" });
    await expect(examples.getByRole("button")).toHaveCount(3);
    await expect(examples.getByRole("button", { name: /Hedged launch note/ })).toHaveAttribute("aria-pressed", "true");
    await expect(examples).toContainText("qualification");

    for (const title of ["Clear update", "Vague next steps"]) {
      await examples.getByRole("button", { name: new RegExp(title) }).click();
      await expect(examples.getByRole("button", { name: new RegExp(title) })).toHaveAttribute("aria-pressed", "true");
      await expect(page.getByLabel("Paste the text to judge")).not.toBeEmpty();
      await page.getByRole("button", { name: "Run updated judgment" }).click();
      await expect(page.getByRole("status").filter({ hasText: "Judgment complete" })).toBeVisible();
      await expect(resultCards(page)).toHaveCount(7);
    }
  });

  test("evidence locates its sentence in the editor, but stale evidence cannot", async ({ page }) => {
    await openJudge(page);
    const first = resultCards(page).first();
    const evidence = await first.locator(".evidence-quote blockquote").innerText();
    await first.getByRole("button", { name: "Find in writing" }).click();
    const editor = page.getByLabel("Paste the text to judge");
    await expect(editor).toBeFocused();
    const selected = await editor.evaluate((element: HTMLTextAreaElement) => element.value.slice(element.selectionStart, element.selectionEnd));
    expect(`“${selected}”`).toBe(evidence);

    await editor.fill("A new draft with no matching sentence.");
    await expect(first.getByRole("button", { name: "Find in writing" })).toHaveCount(0);
  });

  test("filters show counts and update the review count with the threshold", async ({ page }) => {
    await openJudge(page);
    const filters = page.getByRole("group", { name: "Filter verdicts" });
    await expect(filters.getByRole("button", { name: "Issues 4" })).toBeVisible();
    await expect(filters.getByRole("button", { name: "Needs review 1" })).toBeVisible();
    await page.getByRole("slider", { name: /Flag anything under/ }).fill("95");
    await expect(filters.getByRole("button", { name: "Needs review 4" })).toBeVisible();
    await filters.getByRole("button", { name: "Needs review 4" }).click();
    await expect(resultCards(page)).toHaveCount(4);
  });
});
