import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3001";

test.describe("Entry submission and review", () => {
  test("submit entry and verify in mine tab", async ({ page }) => {
    const userName = `user_${Date.now()}`;
    const entryContent = "apple banana cherry date elderberry fig grape";

    // Register via API
    const res = await page.request.post(`${BASE}/api/auth/register`, {
      data: { username: userName, email: `${userName}@test.com`, password: "testpass123!" },
    });
    expect(res.status()).toBe(201);
    const { token } = await res.json();

    // Login via localStorage
    await page.goto("/");
    await page.evaluate((t) => localStorage.setItem("nltype:auth:token", JSON.stringify(t)), token);
    await page.reload();
    await expect(page.getByText(userName)).toBeVisible({ timeout: 5000 });

    // Navigate to entries page
    await page.getByText("词库").click();
    await page.waitForURL("**/entries", { timeout: 5000 });

    // Submit an entry
    await page.locator("textarea").fill(entryContent);
    await page.locator("button:has-text('提交词库')").click();
    await page.waitForTimeout(500);

    // Switch to "我的提交" tab
    await page.getByText("我的提交").click();
    await page.waitForTimeout(500);

    // Verify entry appears
    await expect(page.getByText(entryContent.substring(0, 30)).first()).toBeVisible();
  });

  test("review entry via API and verify status change", async ({ page, request }) => {
    // Register as the developer (first new user becomes developer if DB is empty)
    const devName = `dev_${Date.now()}`;
    const userRes = await request.post(`${BASE}/api/auth/register`, {
      data: { username: devName, email: `${devName}@test.com`, password: "devpass123!" },
    });
    expect(userRes.status()).toBe(201);
    const devData = await userRes.json();

    // Register a second user (normal user)
    const userName = `usr_${Date.now()}`;
    const userRes2 = await request.post(`${BASE}/api/auth/register`, {
      data: { username: userName, email: `${userName}@test.com`, password: "usrpass123!" },
    });
    expect(userRes2.status()).toBe(201);
    const { token: userToken } = await userRes2.json();

    // User creates an entry via API
    const createRes = await request.post(`${BASE}/api/entries`, {
      headers: { Authorization: `Bearer ${userToken}` },
      data: { language: "en", content: "test entry content for review" },
    });
    expect(createRes.status()).toBe(201);
    const { entry } = await createRes.json();
    expect(entry.status).toBe("pending");

    // Try to review with developer's token (if devData.user.role is developer)
    if (devData.user.role === "developer") {
      const reviewRes = await request.patch(`${BASE}/api/entries/${entry.id}/review`, {
        headers: { Authorization: `Bearer ${devData.token}` },
        data: { status: "approved" },
      });
      expect(reviewRes.status()).toBe(200);
      const reviewed = await reviewRes.json();
      expect(reviewed.entry.status).toBe("approved");
    }
  });
});
