import { defineConfig, devices } from "@playwright/test";

/**
 * E2E scope note: apps/web's route protection (proxy.ts/lib/supabase/proxy.ts)
 * verifies the session server-side via a real Supabase call — there's no
 * browser-visible network request Playwright can intercept to fake an
 * authenticated session without real Google/Supabase test credentials
 * (not available in this environment). These specs cover what's genuinely
 * testable without live auth: the login page itself, and the auth-gating
 * redirect behavior for every protected route. The actual game flow
 * (Battle Screen, Store, dungeon runs) is covered by apps/api's 88 passing
 * testcontainers integration tests instead.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "bun run build && bun run start",
    url: "http://localhost:3000/login",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
