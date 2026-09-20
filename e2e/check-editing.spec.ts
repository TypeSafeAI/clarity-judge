import { expect, test } from "@playwright/test";
import type { Axis } from "../types/axis";
import { checkChips, openJudge } from "./helpers";

test("custom checks preview, cancel editing, and save without changing their identity", async ({ page }) => {
  await openJudge(page);
  await page.getByText("Add a custom check", { exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("Clear owner");
  await page.getByLabel("Question to ask").fill("Does the text name an owner?");
  const preview = page.getByRole("region", { name: "Check preview", exact: true });
  await expect(preview).toContainText("Does the text name an owner?");
  await expect(preview).toContainText("Counts as an issue: No");
  await page.getByRole("button", { name: "Save check", exact: true }).click();
  const saved = await page.evaluate<Axis[]>(() => JSON.parse(localStorage.getItem("clarity-judge:custom-axes")!));
  await page.getByRole("button", { name: "About Clear owner", exact: true }).click();
  await page.getByRole("button", { name: "Edit Clear owner", exact: true }).click();
  await expect(page.getByLabel("Name", { exact: true })).toBeFocused();
  await page.getByLabel("Name", { exact: true }).fill("Discard me");
  await page.getByRole("button", { name: "Cancel editing", exact: true }).click();
  await expect(page.getByRole("button", { name: "Edit Clear owner", exact: true })).toBeFocused();
  await expect(checkChips(page).getByRole("checkbox", { name: "Clear owner", exact: true })).toBeChecked();
  await page.getByRole("button", { name: "Edit Clear owner", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("Named owner");
  await page.getByLabel("There's a problem", { exact: true }).check();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(checkChips(page).getByRole("checkbox", { name: "Named owner", exact: true })).toBeChecked();
  const updated = await page.evaluate<Axis[]>(() => JSON.parse(localStorage.getItem("clarity-judge:custom-axes")!));
  expect(updated).toHaveLength(1);
  expect(updated[0]).toMatchObject({ id: saved[0].id, name: "Named owner", issueWhen: true });
});

test("choice edits preserve option values and polarity; removal undo restores selection and order", async ({ page }) => {
  const axis: Axis = { id: "custom-audience", builtIn: false, name: "Audience", description: "Audience", question: "Who is the audience?", kind: "choice", options: [{ value: "legacy_engineers", label: "Engineers" }, { value: "legacy_general", label: "General public", description: "Readers without technical background" }], issueOptions: ["legacy_general"] };
  await page.addInitScript((axis) => {
    if (localStorage.getItem("clarity-judge:custom-axes")) return;
    const sibling = { id: "custom-followup", name: "Follow-up", description: "Next steps", question: "Is a next step named?", kind: "yes_no", issueWhen: false, builtIn: false };
    localStorage.setItem("clarity-judge:custom-axes", JSON.stringify([axis, sibling]));
    localStorage.setItem("clarity-judge:settings", JSON.stringify({ threshold: 0.7, selectedAxisIds: [axis.id] }));
  }, axis);
  await openJudge(page);
  await page.getByRole("button", { name: "About Audience", exact: true }).click();
  await page.getByRole("button", { name: "Edit Audience", exact: true }).click();
  await expect(page.getByRole("checkbox", { name: "General public", exact: true })).toBeChecked();
  await page.getByLabel("Question to ask").fill("Which audience does this address?");
  await page.getByRole("textbox", { name: "Option 2 label", exact: true }).fill("Nontechnical readers");
  await expect(page.getByRole("checkbox", { name: "Nontechnical readers", exact: true })).toBeChecked();
  await page.getByRole("button", { name: "Move option 2 up", exact: true }).click();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  const updated = await page.evaluate<Axis[]>(() => JSON.parse(localStorage.getItem("clarity-judge:custom-axes")!));
  expect(updated[0]).toMatchObject({ id: axis.id, options: [{ ...axis.options[1], label: "Nontechnical readers" }, axis.options[0]], issueOptions: axis.issueOptions });
  await page.getByRole("button", { name: "Remove Audience", exact: true }).click();
  await expect(checkChips(page).getByRole("checkbox", { name: "Audience", exact: true })).toHaveCount(0);
  await expect(page.getByRole("status").filter({ hasText: "Removed Audience" })).toBeVisible();
  await page.getByRole("button", { name: "Undo check removal", exact: true }).click();
  await expect(checkChips(page).getByRole("checkbox", { name: "Audience", exact: true })).toBeChecked();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("clarity-judge:custom-axes")!))).toEqual(updated);
  await checkChips(page).getByRole("checkbox", { name: "Audience", exact: true }).focus();
  await page.keyboard.press("Space");
  await expect(checkChips(page).getByRole("checkbox", { name: "Audience", exact: true })).not.toBeChecked();
  await page.getByRole("button", { name: "Remove Audience", exact: true }).click();
  await page.getByRole("button", { name: "Undo check removal", exact: true }).click();
  await expect(checkChips(page).getByRole("checkbox", { name: "Audience", exact: true })).not.toBeChecked();
  await page.reload();
  await expect(checkChips(page).getByRole("checkbox", { name: "Audience", exact: true })).not.toBeChecked();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("clarity-judge:custom-axes")!))).toEqual(updated);
});

test("choice options with colliding keys cannot be saved", async ({ page }) => {
  await openJudge(page);
  await page.getByText("Add a custom check", { exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("Duplicate options");
  await page.getByLabel("Question to ask").fill("Which label applies?");
  await page.getByRole("radio", { name: "Pick one", exact: true }).check();
  await page.getByLabel("Options (one per line)").fill("On brand\nOn-brand");
  await page.getByRole("button", { name: "Save check", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "unique" })).toBeVisible();
  await expect(checkChips(page).getByRole("checkbox", { name: "Duplicate options", exact: true })).toHaveCount(0);
});


test("edited labels may share a slug when their preserved keys differ", async ({ page }) => {
  const axis: Axis = { id: "custom-labels", builtIn: false, name: "Labels", description: "Labels", question: "Which label applies?", kind: "choice", options: [{ value: "first", label: "First" }, { value: "second", label: "Second" }], issueOptions: ["second"] };
  await page.addInitScript((axis) => localStorage.setItem("clarity-judge:custom-axes", JSON.stringify([axis])), axis);
  await openJudge(page);
  await page.getByRole("button", { name: "About Labels", exact: true }).click();
  await page.getByRole("button", { name: "Edit Labels", exact: true }).click();
  await page.getByRole("textbox", { name: "Option 1 label", exact: true }).fill("On brand");
  await page.getByRole("textbox", { name: "Option 2 label", exact: true }).fill("On brand");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "distinct label" })).toBeVisible();
  await page.getByRole("textbox", { name: "Option 2 label", exact: true }).fill("On-brand");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("button", { name: "Save changes", exact: true })).toHaveCount(0);
  const saved = await page.evaluate<Axis[]>(() => JSON.parse(localStorage.getItem("clarity-judge:custom-axes")!));
  expect(saved[0]).toMatchObject({ id: axis.id, options: [{ value: "first", label: "On brand" }, { value: "second", label: "On-brand" }], issueOptions: ["second"] });
});
