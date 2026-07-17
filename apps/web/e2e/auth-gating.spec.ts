import { expect, test } from "@playwright/test";

test.describe("Login page", () => {
  test("renders the Google sign-in button", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("button", { name: "Sign in with Google" })).toBeVisible();
  });
});

test.describe("Unauthenticated route protection", () => {
  for (const path of ["/", "/battle", "/store"]) {
    test(`visiting ${path} without a session redirects to /login`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login$/);
      await expect(page.getByRole("button", { name: "Sign in with Google" })).toBeVisible();
    });
  }
});
