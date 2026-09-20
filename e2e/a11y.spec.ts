import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { alerts, openJudge } from "./helpers";

/**
 * Accessibility gate: WCAG 2.2 AA rules plus axe best practices, on every page
 * and interactive state, in both themes. A violation here fails CI.
 */
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];

async function expectNoViolations(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const summary = results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
  expect(summary, label).toEqual([]);
}

async function setTheme(page: Page, theme: "light" | "dark") {
  await page.evaluate((t) => {
    localStorage.setItem("clarity-judge:theme", t);
    document.documentElement.dataset.theme = t;
  }, theme);
}

for (const theme of ["light", "dark"] as const) {
  test.describe(`${theme} theme`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/");
      await setTheme(page, theme);
    });

    test("judge, with results expanded and the custom check form open", async ({ page }) => {
      await openJudge(page);
      await expectNoViolations(page, "judge default");
      await page.getByRole("button", { name: "Expand all" }).click();
      await page.getByText("Add a custom check").click();
      await expectNoViolations(page, "judge expanded");
      await page.locator(".result-details > summary").first().click();
      await page.getByRole("button", { name: "About Hedging language", exact: true }).click();
      await page.getByRole("button", { name: "Clear text", exact: true }).click();
      await expectNoViolations(page, "raw probabilities, check preview, and undo");
    });

    test("key dialog", async ({ page }) => {
      await openJudge(page);
      await page.getByRole("button", { name: "API key settings" }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await expectNoViolations(page, "key dialog");
    });

    test("command palette", async ({ page }) => {
      await openJudge(page);
      await page.getByRole("button", { name: "Open the command palette" }).click();
      await expect(page.getByRole("combobox")).toBeFocused();
      await expectNoViolations(page, "palette");
    });

    test("error state", async ({ page }) => {
      await openJudge(page);
      await page.getByLabel("Paste the text to judge").fill("");
      await page.keyboard.press(process.platform === "darwin" ? "Meta+Enter" : "Control+Enter");
      await expect(alerts(page)).toBeVisible();
      await expectNoViolations(page, "error");
    });

    test("reference pages", async ({ page }) => {
      await page.goto("/checks");
      await expectNoViolations(page, "checks");
      await page.goto("/how-it-works");
      await expectNoViolations(page, "how it works");
    });

    test("mobile drawer", async ({ page, isMobile }) => {
      test.skip(!isMobile, "phones only");
      await page.goto("/");
      await page.getByRole("button", { name: "Open navigation" }).click();
      await expectNoViolations(page, "mobile drawer");
    });
  });
}
