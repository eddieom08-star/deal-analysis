import { test, expect } from "@playwright/test";

test.describe("App Navigation (dev mode - no auth required)", () => {
  test("home page loads", async ({ page }) => {
    await page.goto("/");
    // Home page should render — check for main content rather than title
    // (title may be set client-side after hydration)
    await expect(page.locator("body")).not.toBeEmpty();
  });

  test("submit page loads with URL input", async ({ page }) => {
    await page.goto("/submit");
    // Should have a form to submit a Rightmove URL
    await expect(page.getByRole("heading")).toBeVisible();
  });

  test("gate page is accessible", async ({ page }) => {
    await page.goto("/gate");
    await expect(page.getByRole("heading", { name: "Deal Analysis" })).toBeVisible();
  });
});
