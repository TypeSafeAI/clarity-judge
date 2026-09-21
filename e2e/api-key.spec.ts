import { expect, test } from "@playwright/test";
import { FAKE_KEY, alerts, keyInput, openJudge, stubJudgeRoute } from "./helpers";

test.describe("API key lifecycle", () => {
  test("rejects a malformed key without saving it", async ({ page }) => {
    await openJudge(page);
    await page.getByRole("button", { name: "API key settings" }).click();
    const dialog = page.getByRole("dialog", { name: "Your TypeSafe API key" });
    await expect(dialog).toBeVisible();
    await expect(keyInput(page)).toBeFocused();

    await keyInput(page).fill("not-a-key-at-all-really");
    await dialog.getByRole("button", { name: "Save key" }).click();
    await expect(dialog.getByRole("alert")).toContainText("doesn't look like a TypeSafe key");
    await expect(page.locator(".demo-banner")).toBeVisible();
  });

  test("saving a key switches to live mode, and the key never appears on screen", async ({ page }) => {
    await openJudge(page);
    await page.getByRole("button", { name: "API key settings" }).click();
    const dialog = page.getByRole("dialog", { name: "Your TypeSafe API key" });
    await keyInput(page).fill(FAKE_KEY);
    await dialog.getByRole("button", { name: "Save key" }).click();
    await expect(dialog.getByRole("status")).toContainText("hidden from now on");
    await page.keyboard.press("Escape");

    await expect(page.locator(".demo-banner")).toHaveCount(0);
    await expect(page.locator(".usage-badge")).toContainText("Live · browser key");
    await expect(page.locator(".usage-badge")).toContainText("No run yet");
    await expect(page.getByRole("button", { name: "API key settings" })).toHaveClass(/has-key/);

    // Stale results from the simulated run are still labelled simulated, and
    // the notice says the mode changed rather than blaming the text.
    await expect(page.locator(".verdict-summary .summary-note")).toContainText("Simulated");
    await expect(page.locator(".stale-notice")).toHaveText(
      /^You switched to live mode\. These verdicts are still simulated\. Run again for real verdicts from Jev\./,
    );

    const html = await page.content();
    expect(html).not.toContain(FAKE_KEY);
    const stored = await page.evaluate(() => localStorage.getItem("clarity-judge:api-key"));
    expect(stored).toBe(JSON.stringify(FAKE_KEY));
  });

  test("a rejected key shows the auth error with working actions", async ({ page }) => {
    await openJudge(page);
    await stubJudgeRoute(page, 401, { error: "TypeSafe rejected the API key.", code: "auth", status: 401, raw: '{"error":"invalid api key"}' });

    await page.getByRole("button", { name: "API key settings" }).click();
    const dialog = page.getByRole("dialog", { name: "Your TypeSafe API key" });
    await keyInput(page).fill(FAKE_KEY);
    await dialog.getByRole("button", { name: "Save key" }).click();
    await page.keyboard.press("Escape");

    const requestPromise = page.waitForRequest("**/api/judge");
    await page.getByRole("button", { name: "Run judgment" }).click();
    const request = await requestPromise;
    expect(request.headers()["x-typesafe-api-key"]).toBe(FAKE_KEY);

    const alert = alerts(page);
    await expect(alert).toContainText("TypeSafe rejected the API key · HTTP 401");
    await expect(alert.getByRole("button", { name: "Change key" })).toBeVisible();
    await expect(alert.getByRole("button", { name: "Retry" })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "Run failed" })).toBeVisible();

    await alert.getByText("Raw response").click();
    await expect(alert.locator("pre")).toContainText("invalid api key");

    await alert.getByRole("button", { name: "Change key" }).click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Remove from this browser" }).click();
    await page.keyboard.press("Escape");
    await expect(page.locator(".demo-banner")).toBeVisible();
    await expect(page.locator(".usage-badge")).toContainText("Demo");
    // The failed live run left the simulated verdicts on screen; back in demo mode they match again.
    await expect(page.locator(".stale-notice")).toHaveCount(0);
  });

  test("removing the key after a live run warns that a re-run will be simulated", async ({ page }) => {
    await openJudge(page);
    await stubJudgeRoute(page, 200, { answers: [{ id: "hedging", type: "noul", value: false, probability: 0.2, confidence: 0.8, needsReview: false }], model: "mock-live" });
    await page.getByRole("button", { name: "API key settings" }).click();
    const dialog = page.getByRole("dialog", { name: "Your TypeSafe API key" });
    await keyInput(page).fill(FAKE_KEY);
    await dialog.getByRole("button", { name: "Save key" }).click();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Run judgment" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Judgment complete" })).toBeVisible();
    await expect(page.locator(".stale-notice")).toHaveCount(0);

    await page.getByRole("button", { name: "API key settings" }).click();
    await dialog.getByRole("button", { name: "Remove from this browser" }).click();
    await page.keyboard.press("Escape");
    await expect(page.locator(".stale-notice")).toHaveText(/^You switched back to demo mode\. These verdicts came from Jev\. Running again will simulate results\./);
    await expect(page.locator(".verdict-summary .summary-note")).toContainText("Verdicts from Jev");
  });

  test("other upstream failures are explained with a retry", async ({ page }) => {
    await openJudge(page);
    await stubJudgeRoute(page, 429, { error: "You've hit the API rate limit, try again in a moment.", code: "rate_limited", status: 429 });
    await page.getByRole("button", { name: "API key settings" }).click();
    const dialog = page.getByRole("dialog", { name: "Your TypeSafe API key" });
    await keyInput(page).fill(FAKE_KEY);
    await dialog.getByRole("button", { name: "Save key" }).click();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Run judgment" }).click();
    await expect(alerts(page)).toContainText("Rate limit reached");
    await expect(alerts(page).getByRole("button", { name: "Retry" })).toBeVisible();
  });

  test("the server setup guide is offered when there is no server key", async ({ page }) => {
    await openJudge(page);
    await page.getByRole("button", { name: "Add a key" }).click();
    const dialog = page.getByRole("dialog", { name: "Your TypeSafe API key" });
    await dialog.getByText("Set it on the server instead").click();
    await expect(dialog.getByText("TYPESAFE_API_KEY")).toBeVisible();
  });
});
