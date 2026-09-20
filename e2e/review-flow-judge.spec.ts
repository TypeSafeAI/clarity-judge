import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { openJudge, resultCards, keyInput, FAKE_KEY, mod } from "./helpers";

test("compact overview keeps one set of counted filters and readable explanations", async ({ page }) => {
  await openJudge(page);
  await expect(page.locator(".summary-metrics")).toHaveCount(0);
  await expect(page.locator(".panel-heading .count").filter({ hasText: "passed" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Issues 4", exact: true })).toBeVisible();
  const font = await page.locator(".result-confidence-label").first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(font).toBeGreaterThanOrEqual(12);
});

test("consecutive demo runs compare matching checks without persisting history", async ({ page }) => {
  await openJudge(page);
  await page.getByLabel("Paste the text to judge").fill("We will launch Monday. Maya will send the report Friday.");
  await page.getByRole("button", { name: "Run judgment", exact: false }).click();
  await expect(page.getByRole("status").filter({ hasText: "Judgment complete" })).toBeVisible();
  await expect(page.getByText("Compared with previous demo run", { exact: true })).toBeVisible();
  await expect(resultCards(page).first().locator(".result-comparison")).toContainText("Issue → Pass");
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain("We will launch Monday");
  await page.reload();
  await expect(page.getByText("Compared with previous demo run", { exact: true })).toHaveCount(0);
});

test("verdicts arrive before evidence, duplicate shortcuts do not rerun, and evidence failure keeps results", async ({ page }) => {
  await openJudge(page);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let releasePrimary!: () => void;
  const primaryGate = new Promise<void>((resolve) => { releasePrimary = resolve; });
  let requests = 0;
  await page.route("**/api/judge", async (route) => {
    requests++;
    if (route.request().postDataJSON().questions[0].type === "choice") {
      await gate;
      await route.fulfill({ status: 503, json: { error: "Evidence unavailable", code: "overloaded" } });
    } else {
      await primaryGate;
      await route.fulfill({ json: { answers: [{ id: "hedging", type: "noul", value: false, probability: 0.1, confidence: 0.9, needsReview: false }], model: "mock-live" } });
    }
  });
  await page.getByRole("button", { name: "API key settings" }).click();
  await keyInput(page).fill(FAKE_KEY);
  await page.getByRole("button", { name: "Save key", exact: true }).click();
  await page.keyboard.press("Escape");
  await page.getByLabel("Paste the text to judge").fill("We launch Monday. Maya owns the launch.");
  await page.getByRole("button", { name: "Run judgment", exact: false }).click();
  await expect(page.getByRole("status").filter({ hasText: "Evaluating checks" })).toBeVisible();
  await page.keyboard.press(`${mod}+Enter`);
  expect(requests).toBe(1);
  releasePrimary();
  await expect(page.getByRole("status").filter({ hasText: "Finding evidence" })).toBeVisible();
  await expect(resultCards(page).first().locator(".outcome-badge")).toHaveText("Pass");
  await expect(page.getByText("Demo and live runs are not compared.", { exact: true })).toBeVisible();
  await page.keyboard.press(`${mod}+Enter`);
  expect(requests).toBe(2);
  const accessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(accessibility.violations).toEqual([]);
  release();
  await expect(page.getByRole("status").filter({ hasText: "Judgment complete" })).toBeVisible();
  await expect(resultCards(page).first().locator(".outcome-badge")).toHaveText("Pass");
  await resultCards(page).first().locator(":scope > summary").click();
  await expect(resultCards(page).first()).toContainText("approximate");
});

test("evidence upgrades visible verdicts without resetting their disclosures", async ({ page }) => {
  await openJudge(page);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/judge", async (route) => {
    const evidence = route.request().postDataJSON().questions[0].type === "choice";
    if (evidence) await gate;
    await route.fulfill({ json: { answers: [{ id: "hedging", type: evidence ? "choice" : "noul", value: evidence ? "s2" : true, probability: 0.9, confidence: 0.9, needsReview: false }], model: "mock-live" } });
  });
  await page.getByRole("button", { name: "API key settings" }).click();
  await keyInput(page).fill(FAKE_KEY);
  await page.getByRole("button", { name: "Save key", exact: true }).click();
  await page.keyboard.press("Escape");
  await page.getByLabel("Paste the text to judge").fill("Perhaps we wait. Maya owns the decision.");
  await page.getByRole("button", { name: "Run judgment", exact: false }).click();
  await expect(page.getByRole("status").filter({ hasText: "Finding evidence" })).toBeVisible();
  const card = resultCards(page).first();
  await expect(card).toContainText("approximate");
  await expect(card.getByRole("button", { name: "Find in writing" })).toHaveCount(0);
  await card.getByText("Details", { exact: true }).click();
  await card.locator(":scope > summary").click();
  release();
  await expect(page.getByRole("status").filter({ hasText: "Judgment complete" })).toBeVisible();
  await expect(card).not.toHaveAttribute("open", "");
  await card.locator(":scope > summary").click();
  await expect(card.locator(".result-details")).toHaveAttribute("open", "");
  await expect(card.locator("figcaption")).toContainText("Sentence 2 of 2 · picked by Jev");
  await expect(card.locator("blockquote")).toContainText("Maya owns the decision.");
});

test("editing a check invalidates its old verdict and excludes it from comparison", async ({ page }) => {
  await openJudge(page);
  await page.getByText("Add a custom check", { exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("Ownership");
  await page.getByLabel("Question to ask").fill("Is an owner named?");
  await page.getByRole("button", { name: "Save check", exact: true }).click();
  await page.getByRole("button", { name: "Run judgment", exact: false }).click();
  await expect(page.getByRole("status").filter({ hasText: "Judgment complete" })).toBeVisible();
  await page.getByRole("button", { name: "About Ownership", exact: true }).click();
  await page.getByRole("button", { name: "Edit Ownership", exact: true }).click();
  await page.getByLabel("Question to ask").fill("Is exactly one owner named?");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("button", { name: "Run updated judgment", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Run updated judgment", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Judgment complete" })).toBeVisible();
  await expect(resultCards(page).filter({ hasText: "Ownership" }).locator(".result-comparison")).toHaveText("Check changed · no comparison");
});

test("failed primary runs preserve the previous successful comparison baseline", async ({ page }) => {
  await openJudge(page);
  let attempt = 0;
  await page.route("**/api/judge", async (route) => {
    attempt++;
    if (attempt === 2) return route.fulfill({ status: 503, json: { error: "Try later", code: "overloaded" } });
    const issue = attempt === 1;
    return route.fulfill({ json: { answers: [{ id: "hedging", type: "noul", value: issue, probability: issue ? 0.9 : 0.1, confidence: 0.9, needsReview: false }], model: "mock-live" } });
  });
  await page.getByRole("button", { name: "API key settings" }).click();
  await keyInput(page).fill(FAKE_KEY);
  await page.getByRole("button", { name: "Save key", exact: true }).click();
  await page.keyboard.press("Escape");
  const editor = page.getByLabel("Paste the text to judge");
  await editor.fill("Perhaps we wait.");
  await page.getByRole("button", { name: "Run judgment", exact: false }).click();
  await expect(page.getByRole("status").filter({ hasText: "Judgment complete" })).toBeVisible();
  await editor.fill("We launch Monday.");
  await page.getByRole("button", { name: "Run judgment", exact: false }).click();
  await expect(page.getByRole("status").filter({ hasText: "Run failed" })).toBeVisible();
  await page.getByRole("button", { name: "Run judgment", exact: false }).click();
  await expect(page.getByRole("status").filter({ hasText: "Judgment complete" })).toBeVisible();
  await expect(resultCards(page).first().locator(".result-comparison")).toHaveText("Issue → Pass");
  await expect(page.getByText("Compared with previous live run", { exact: true })).toBeVisible();
  await page.getByRole("slider", { name: /Flag anything under/ }).fill("95");
  await expect(resultCards(page).first().locator(".result-comparison")).toHaveText("Issue · low confidence → Pass · low confidence");
  expect(attempt).toBe(3);
});
