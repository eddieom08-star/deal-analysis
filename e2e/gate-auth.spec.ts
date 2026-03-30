import { test, expect } from "@playwright/test";

test.describe("Gate Authentication", () => {
  test("gate page loads with email input", async ({ page }) => {
    await page.goto("/gate");
    await expect(page.getByRole("heading", { name: "Deal Analysis" })).toBeVisible();
    await expect(page.getByPlaceholder("you@example.com")).toBeVisible();
    await expect(page.getByRole("button", { name: "Send Code" })).toBeVisible();
  });

  test("send code shows code input step", async ({ page }) => {
    await page.goto("/gate");

    // Fill email and submit
    await page.getByPlaceholder("you@example.com").fill("eddieom08@gmail.com");
    await page.getByRole("button", { name: "Send Code" }).click();

    // Should transition to code input step
    await expect(page.getByText("Code sent to")).toBeVisible();
    await expect(page.getByPlaceholder("000000")).toBeVisible();
    await expect(page.getByRole("button", { name: "Verify" })).toBeVisible();
  });

  test("code input only accepts numeric characters", async ({ page }) => {
    await page.goto("/gate");

    // Get to code step
    await page.getByPlaceholder("you@example.com").fill("eddieom08@gmail.com");
    await page.getByRole("button", { name: "Send Code" }).click();
    await expect(page.getByPlaceholder("000000")).toBeVisible();

    // Type mixed characters - should only keep digits
    const codeInput = page.getByPlaceholder("000000");
    await codeInput.fill("12ab34");
    await expect(codeInput).toHaveValue("1234");
  });

  test("verify button disabled until 6 digits entered", async ({ page }) => {
    await page.goto("/gate");

    await page.getByPlaceholder("you@example.com").fill("eddieom08@gmail.com");
    await page.getByRole("button", { name: "Send Code" }).click();
    await expect(page.getByPlaceholder("000000")).toBeVisible();

    // With less than 6 digits, verify should be disabled
    await page.getByPlaceholder("000000").fill("12345");
    await expect(page.getByRole("button", { name: "Verify" })).toBeDisabled();

    // With 6 digits, verify should be enabled
    await page.getByPlaceholder("000000").fill("123456");
    await expect(page.getByRole("button", { name: "Verify" })).toBeEnabled();
  });

  test("use different email button resets to email step", async ({ page }) => {
    await page.goto("/gate");

    await page.getByPlaceholder("you@example.com").fill("eddieom08@gmail.com");
    await page.getByRole("button", { name: "Send Code" }).click();
    await expect(page.getByPlaceholder("000000")).toBeVisible();

    // Click "Use a different email"
    await page.getByRole("button", { name: "Use a different email" }).click();

    // Should be back on email step
    await expect(page.getByPlaceholder("you@example.com")).toBeVisible();
    await expect(page.getByRole("button", { name: "Send Code" })).toBeVisible();
  });

  test("code input has autocomplete one-time-code attribute", async ({ page }) => {
    await page.goto("/gate");

    await page.getByPlaceholder("you@example.com").fill("eddieom08@gmail.com");
    await page.getByRole("button", { name: "Send Code" }).click();
    await expect(page.getByPlaceholder("000000")).toBeVisible();

    const autocomplete = await page.getByPlaceholder("000000").getAttribute("autocomplete");
    expect(autocomplete).toBe("one-time-code");
  });
});
