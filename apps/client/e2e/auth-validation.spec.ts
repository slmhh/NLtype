import { test, expect } from "@playwright/test";

test.describe("Registration validation", () => {
  const BASE = "http://localhost:3001";

  test("shows validation errors for invalid input", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "登录" }).click();
    await page.locator("button:has-text('注册')").first().click();
    await page.waitForTimeout(200);

    // Submit empty form → validation should block (Arco shows inline errors)
    await page.locator(".arco-btn-primary").click();
    await page.waitForTimeout(500);

    // Modal should still be visible (validation prevented submit)
    await expect(page.getByRole("dialog")).toBeVisible();

    // Try registering with a duplicate username
    const dupUser = `dup_${Date.now()}`;
    await page.request.post(`${BASE}/api/auth/register`, {
      data: { username: dupUser, email: `${dupUser}@test.com`, password: "testpass123!" },
    });
    await page.waitForTimeout(200);

    // Fill form with duplicate username
    await page.locator('input[placeholder*="3-20"]').fill(dupUser);
    await page.locator('input[placeholder*="your@email"]').fill(`${dupUser}2@test.com`);
    await page.locator('[type="password"]').fill("testpass123!");
    await page.locator(".arco-btn-primary").click();
    await page.waitForTimeout(500);

    // Modal should still be open (server returned error)
    await expect(page.getByRole("dialog")).toBeVisible();
  });
});
