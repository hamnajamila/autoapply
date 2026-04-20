import { chromium } from "playwright";

const baseUrl = process.env.PUBLIC_BASE_URL;
if (!baseUrl) {
  console.error("PUBLIC_BASE_URL is required");
  process.exit(1);
}

const routes = [
  "/dashboard",
  "/dashboard/portals",
  "/dashboard/profile",
  "/dashboard/applications",
  "/dashboard/custom-portals",
  "/dashboard/youth",
  "/dashboard/gov-jobs",
  "/dashboard/answer-library",
  "/dashboard/notifications"
];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

const email = `sweep.${Date.now()}@example.com`;
const password = "Passw0rd123!";

try {
  await page.goto(`${baseUrl}/register`, { waitUntil: "networkidle" });
  await page.locator('input[name="name"]').fill("Web Sweep");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('input[name="confirmPassword"]').fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/\/onboarding|\/dashboard/, { timeout: 30000 });

  for (const route of routes) {
    const response = await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded" });
    const status = response?.status() ?? 0;
    const networkErrorCount = await page.locator("text=Network Error").count();
    console.log(`ROUTE ${route} => status:${status} networkError:${networkErrorCount}`);
  }
} finally {
  await context.close();
  await browser.close();
}
