import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3001";

test.describe("Typing flow", () => {
  test("register → login → play timed mode → leaderboard", async ({ page }) => {
    const username = `e2e_${Date.now()}`;
    const password = "testpass123!";

    // ── 1. Register via API ──
    const regRes = await page.request.post(`${BASE}/api/auth/register`, {
      data: { username, email: `${username}@test.com`, password },
    });
    expect(regRes.status()).toBe(201);

    // ── 2. Login via API, set token in localStorage ──
    const loginRes = await page.request.post(`${BASE}/api/auth/login`, {
      data: { identifier: username, password },
    });
    expect(loginRes.status()).toBe(200);
    const { token } = await loginRes.json();

    await page.goto("/");
    await page.evaluate((t) => {
      localStorage.setItem("nltype:auth:token", JSON.stringify(t));
    }, token);
    await page.reload();

    // Verify login succeeded
    await expect(page.getByText(username)).toBeVisible({ timeout: 5000 });

    // ── 3. Start timed game (15s) ──
    await page.getByRole("button", { name: /^15/ }).click();
    await page.waitForTimeout(200);
    await page.keyboard.press("Enter");

    await page.waitForURL("**/game", { timeout: 5000 });

    // ── 4. Type some text ──
    await page.waitForTimeout(500);
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press("a");
      await page.waitForTimeout(20);
    }

    // ── 5. Wait for result modal (15s timer) ──
    await expect(page.getByText("result").first()).toBeVisible({ timeout: 25000 });

    // ── 6. Verify result ──
    await expect(page.getByRole("button", { name: /返回大厅/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /再来一局/ })).toBeVisible();

    // ── 7. Go to leaderboard ──
    await page.getByRole("button", { name: /返回大厅/ }).click();
    await page.waitForTimeout(500);
    await page.getByText("排行榜").click();

    await expect(page.getByText(username).first()).toBeVisible({ timeout: 5000 });
  });
});
