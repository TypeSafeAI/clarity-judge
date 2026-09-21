import { expect, test } from "@playwright/test";
import { checkChips, mod, openJudge, resultCards } from "./helpers";

test.describe("keyboard", () => {
  test("the skip link is the first tab stop and lands on the workspace", async ({ page }) => {
    await openJudge(page);
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to workspace" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("main#main")).toBeFocused();
  });

  test("the command palette is a combobox that returns focus to its opener", async ({ page }) => {
    await openJudge(page);
    const opener = page.getByRole("button", { name: "Open the command palette" });
    await opener.click();

    const box = page.getByRole("combobox", { name: "Search commands" });
    await expect(box).toBeFocused();
    await expect(box).toHaveAttribute("aria-activedescendant", "palette-option-0");
    await expect(page.getByRole("listbox", { name: "Commands" })).toBeVisible();

    await page.keyboard.press("End");
    await expect(box).toHaveAttribute("aria-activedescendant", /palette-option-\d+/);
    await page.keyboard.press("Home");
    await expect(box).toHaveAttribute("aria-activedescendant", "palette-option-0");

    await box.fill("clear text");
    await expect(page.getByRole("option")).toHaveCount(1);
    await page.keyboard.press("Enter");
    await expect(page.getByLabel("Paste the text to judge")).toHaveValue("");

    await page.keyboard.press(`${mod}+k`);
    await expect(box).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(opener).toBeFocused();
  });

  test("the shortcut runs a judgment and the status region announces it", async ({ page }) => {
    await openJudge(page);
    await page.getByLabel("Paste the text to judge").fill("The launch is on Monday. Please confirm by Friday.");
    await page.keyboard.press(`${mod}+Enter`);
    await expect(page.getByRole("status").filter({ hasText: "Judgment complete" })).toBeVisible();
    await expect(page.locator(".panel .notice")).toHaveCount(0);
  });

  test("chips toggle with Space and result cards open with Enter", async ({ page }) => {
    await openJudge(page);
    const hedging = checkChips(page).getByRole("checkbox", { name: "Hedging language" });
    await hedging.focus();
    await page.keyboard.press("Space");
    await expect(hedging).not.toBeChecked();
    await expect(page.locator(".field-label .count")).toHaveText("6/7 on");
    await page.keyboard.press("Space");
    await expect(hedging).toBeChecked();

    const pass = resultCards(page).filter({ has: page.locator('[data-outcome="pass"]') }).first();
    await pass.locator(":scope > summary").focus();
    await page.keyboard.press("Enter");
    await expect(pass).toHaveAttribute("open", "");
    await page.keyboard.press("Enter");
    await expect(pass).not.toHaveAttribute("open", "");
  });

  test("shortcuts stay inside the key dialog while it is open", async ({ page }) => {
    await openJudge(page);
    await page.getByLabel("Paste the text to judge").fill("A changed draft that would run.");
    await expect(page.locator(".stale-notice")).toBeVisible();
    await page.getByRole("button", { name: "API key settings" }).click();
    const dialog = page.getByRole("dialog", { name: "Your TypeSafe API key" });
    await expect(dialog).toBeVisible();

    // ⌘↵ must not run a judgment behind the dialog: the verdicts stay stale.
    await page.keyboard.press(`${mod}+Enter`);
    await expect(page.locator(".stale-notice")).toBeVisible();
    // ⌘K must not stack the palette on top of it.
    await page.keyboard.press(`${mod}+k`);
    await expect(page.getByRole("combobox", { name: "Search commands" })).toHaveCount(0);
    await expect(dialog).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await page.keyboard.press(`${mod}+Enter`);
    await expect(page.getByRole("status").filter({ hasText: "Judgment complete" })).toBeVisible();
    await expect(page.locator(".stale-notice")).toHaveCount(0);
  });

  test("every probability track is a named meter", async ({ page }) => {
    await openJudge(page);
    await page.getByRole("button", { name: "Expand all" }).click();
    for (const details of await page.locator(".result-details > summary").all()) await details.click();
    const meters = page.getByRole("meter");
    await expect(meters).toHaveCount(7);
    for (const meter of await meters.all()) {
      await expect(meter).toHaveAttribute("aria-label", /for .+/);
      await expect(meter).toHaveAttribute("aria-valuetext", /\d+%/);
    }
  });
});
