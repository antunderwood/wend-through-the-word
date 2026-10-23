import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { doubleClickLabel, focusIs, openOnAbraham } from "./scene";

const ABRAHAM = "person:abraham_58",
  SARAH = "person:sarah_2473",
  ISAAC = "person:isaac_616";
const panel = (page: Page) => page.getByRole("complementary", { name: "Selected Node" });
const bar = (page: Page) => page.getByRole("navigation", { name: "Your Path" });
const note = (page: Page, name: string) => panel(page).getByRole("textbox", { name: `Note on ${name}` });

test.use({ reducedMotion: "reduce" });

test("a note survives a reload, and the download holds it with a link back", async ({ page }) => {
  await openOnAbraham(page);
  await focusIs(page, ABRAHAM);
  await expect(panel(page)).toContainText("Notes stay in this browser only.");
  await note(page, "Abraham").fill("Called out of Ur.");
  await doubleClickLabel(page, "Isaac", ISAAC);
  await note(page, "Isaac").fill("The son of the promise.");
  // A step with a note is marked in the Your Path bar.
  await expect(bar(page).getByRole("button", { name: "Abraham" })).toHaveAccessibleDescription("Has a note");

  // The reload restores Your Path from this browser, and the notes with it.
  await page.reload();
  await focusIs(page, ISAAC);
  await expect(bar(page).getByRole("listitem")).toHaveText(["Isaac", "Abraham"]);
  await expect(note(page, "Isaac")).toHaveValue("The son of the promise.");
  await bar(page).getByRole("button", { name: "Abraham" }).click();
  await expect(note(page, "Abraham")).toHaveValue("Called out of Ur.");

  const [file] = await Promise.all([page.waitForEvent("download"), panel(page).getByRole("button", { name: "Download notes" }).click()]);
  const text = await readFile((await file.path())!, "utf8");
  const origin = new URL(page.url()).origin;
  expect(text).toMatch(/^# Journey notes, /);
  expect(text).toContain(`## 1. Abraham\n\n*Person*, [open as the Focus](${origin}/?focus=${ABRAHAM})\n\nCalled out of Ur.\n`);
  expect(text).toContain(`## 2. Isaac\n\n*Person*, [open as the Focus](${origin}/?focus=${ISAAC})\n\nThe son of the promise.\n`);
});

test("an address naming a Focus wins over the one kept in this browser", async ({ page }) => {
  await openOnAbraham(page);
  await focusIs(page, ABRAHAM);
  await doubleClickLabel(page, "Isaac", ISAAC);
  await page.goto(`/?focus=${SARAH}`);
  await focusIs(page, SARAH);
  await expect(bar(page).getByRole("listitem")).toHaveText(["Sarah", "Isaac", "Abraham"]);
  // The bare address names no Focus, so the one kept in this browser comes back.
  await page.goto("/");
  await focusIs(page, SARAH);
});

test("Clear and Undo clear keep notes; Delete all notes asks first", async ({ page }) => {
  await openOnAbraham(page);
  await focusIs(page, ABRAHAM);
  await note(page, "Abraham").fill("Called out of Ur.");
  await doubleClickLabel(page, "Isaac", ISAAC);
  await bar(page).getByRole("button", { name: "Clear", exact: true }).click();
  await expect(bar(page).getByRole("listitem")).toHaveText(["Isaac"]);
  await bar(page).getByRole("button", { name: "Undo clear" }).click();
  await bar(page).getByRole("button", { name: "Abraham" }).click();
  await expect(note(page, "Abraham")).toHaveValue("Called out of Ur.");

  // Cancel keeps the notes; OK deletes them.
  const asked: string[] = [];
  page.once("dialog", (d) => (asked.push(d.message()), d.dismiss()));
  await panel(page).getByRole("button", { name: "Delete all notes" }).click();
  expect(asked).toEqual(["Delete all your notes? This cannot be undone."]);
  await expect(note(page, "Abraham")).toHaveValue("Called out of Ur.");
  page.once("dialog", (d) => d.accept());
  await panel(page).getByRole("button", { name: "Delete all notes" }).click();
  await expect(note(page, "Abraham")).toHaveValue("");
  await expect(bar(page).getByRole("button", { name: "Abraham" })).not.toHaveAccessibleDescription("Has a note");
});

test("a focused note box has the app's focus ring, not the browser's blue one", async ({ page }) => {
  await openOnAbraham(page);
  await focusIs(page, ABRAHAM);
  await note(page, "Abraham").focus();
  const style = await note(page, "Abraham").evaluate((e) => {
    const s = getComputedStyle(e);
    return { outline: `${s.outlineStyle} ${s.outlineWidth} ${s.outlineColor}`, border: s.borderColor };
  });
  // Visible, in the accent (#ffd27a) at 40% with an accent border, and no blue.
  expect(style).toEqual({ outline: "solid 2px rgba(255, 210, 122, 0.4)", border: "rgb(255, 210, 122)" });
});
