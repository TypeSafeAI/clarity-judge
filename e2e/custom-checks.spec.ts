import { expect, test } from "@playwright/test";
import { alerts, checkChips, openJudge, resultCards } from "./helpers";

test.describe("custom checks", () => {
  test("can be added, run, persisted, and removed", async ({ page }) => {
    await openJudge(page);

    await page.getByText("Add a custom check").click();
    await page.getByLabel("Name").fill("On brand");
    await page.getByLabel("Question to ask").fill("Does this sound like our brand voice?");
    await page.getByRole("radio", { name: "There's a problem" }).check();
    await page.getByRole("button", { name: "Save check" }).click();

    const chip = checkChips(page).getByRole("checkbox", { name: "On brand" });
    await expect(chip).toBeChecked();
    // Saving says so and lands on the new chip, which is above the form and easy to miss.
    await expect(page.getByRole("status").filter({ hasText: "Added On brand. It's switched on for the next run." })).toBeVisible();
    await expect(chip).toBeFocused();
    await expect(page.locator(".field-label .count")).toHaveText("8/8 on");
    await page.getByRole("button", { name: "About On brand", exact: true }).click();
    await expect(page.getByRole("region", { name: "On brand check details" })).toContainText("Counts as an issue: Yes");
    await expect(page.getByRole("region", { name: "On brand check details" })).toContainText("Does this sound like our brand voice?");

    await page.getByRole("button", { name: "Run judgment" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Judgment complete" })).toBeVisible();
    await expect(resultCards(page)).toHaveCount(8);
    await expect(resultCards(page).last().locator("h3")).toHaveText("On brand");

    // Survives a reload via localStorage.
    await page.reload();
    await expect(checkChips(page).getByRole("checkbox", { name: "On brand" })).toBeVisible();

    await page.getByRole("button", { name: "Remove On brand" }).click();
    await expect(checkChips(page).getByRole("checkbox", { name: "On brand" })).toHaveCount(0);
    await expect(page.getByRole("status").filter({ hasText: "Removed On brand." })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "Added On brand" })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "On brand check details" })).toHaveCount(0);
    await expect(page.locator(".field-label .count")).toHaveText("7/7 on");
  });

  test("a pick-one check needs at least two options", async ({ page }) => {
    await openJudge(page);
    await page.getByText("Add a custom check").click();
    await page.getByLabel("Name").fill("Audience");
    await page.getByRole("radio", { name: "Pick one" }).check();
    await page.getByLabel("Question to ask").fill("Which audience is this for?");
    await page.getByLabel("Options (one per line)").fill("Engineers");
    await page.getByRole("button", { name: "Save check" }).click();
    await expect(alerts(page)).toContainText("at least two options");

    await page.getByLabel("Options (one per line)").fill("Engineers\nExecutives");
    await expect(page.getByRole("checkbox", { name: "Executives" })).toBeVisible();
    await page.getByRole("checkbox", { name: "Executives" }).check();
    await page.getByRole("button", { name: "Save check" }).click();
    await expect(checkChips(page).getByRole("checkbox", { name: "Audience" })).toBeChecked();
    await page.getByRole("button", { name: "About Audience", exact: true }).click();
    await expect(page.getByRole("region", { name: "Audience check details" })).toContainText("Counts as an issue: Executives");
  });

  test("select all and clear all toggle every chip", async ({ page }) => {
    await openJudge(page);
    await page.getByRole("button", { name: "Clear all" }).click();
    await expect(page.locator(".field-label .count")).toHaveText("0/7 on");
    await expect(page.getByRole("button", { name: "Run judgment" })).toBeDisabled();
    await page.getByRole("button", { name: "Select all" }).click();
    await expect(page.locator(".field-label .count")).toHaveText("7/7 on");
  });
});
