import { chromium } from "playwright";

const baseUrl = process.env.PUBLIC_BASE_URL;

if (!baseUrl) {
  console.error("PUBLIC_BASE_URL is required");
  process.exit(1);
}

async function runPass(pass) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on("requestfailed", (request) => {
    console.log(`PASS ${pass}: REQUEST FAILED ${request.method()} ${request.url()} :: ${request.failure()?.errorText ?? "unknown"}`);
  });
  page.on("response", (response) => {
    const url = response.url();
    if (url.includes("/api/") || url.includes("/api-proxy/")) {
      console.log(`PASS ${pass}: RESPONSE ${response.status()} ${url}`);
    }
  });

  const email = `smoke.pass${pass}.${Date.now()}@example.com`;
  const password = "Passw0rd123!";

  try {
    await page.goto(`${baseUrl}/register`, { waitUntil: "networkidle" });
    await page.locator('input[name="name"]').fill(`Smoke Pass ${pass}`);
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="password"]').fill(password);
    await page.locator('input[name="confirmPassword"]').fill(password);
    await page.getByRole("button", { name: "Create account" }).click();
    await page.waitForURL(/\/onboarding|\/dashboard/, { timeout: 30000 });

    await page.evaluate(() => {
      localStorage.removeItem("autoapply_token");
    });
    await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle" });
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="password"]').fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 30000 });

    const currentUrl = page.url();
    console.log(`PASS ${pass}: OK | email=${email} | final=${currentUrl}`);
  } finally {
    if (!page.isClosed()) {
      const currentUrl = page.url();
      const networkErrorVisible = await page.locator("text=Network Error").count();
      if (networkErrorVisible > 0) {
        console.log(`PASS ${pass}: UI shows Network Error at ${currentUrl}`);
      }
    }
    await context.close();
    await browser.close();
  }
}

for (let i = 1; i <= 3; i += 1) {
  await runPass(i);
}
