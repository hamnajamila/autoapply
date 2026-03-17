import type { Page } from "playwright";

export class CaptchaDetector {
  static async detect(page: Page): Promise<boolean> {
    const selectors = [
      ".g-recaptcha",
      'iframe[src*="recaptcha"]',
      'iframe[src*="hcaptcha"]',
      '[id*="captcha"]',
      '[class*="captcha"]'
    ];
    for (const sel of selectors) {
      const found = await page.locator(sel).first().isVisible().catch(() => false);
      if (found) return true;
    }
    const content = await page.content().catch(() => "");
    if (/captcha|hcaptcha|recaptcha/i.test(content)) return true;
    return false;
  }
}

