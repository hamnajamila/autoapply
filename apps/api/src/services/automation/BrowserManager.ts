import { chromium, type Browser, type BrowserContext } from "playwright";
import { execSync } from "node:child_process";
import { logger } from "../../config/logger";

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.2; rv:124.0) Gecko/20100101 Firefox/124.0"
];

function randomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)] ?? USER_AGENTS[0]!;
}

export class BrowserManager {
  private static browser: Browser | null = null;
  private static launching: Promise<Browser> | null = null;
  private static verified = false;

  static async isBrowserRuntimeReady(): Promise<boolean> {
    try {
      await this.verifyBrowsersInstalled();
      return true;
    } catch {
      return false;
    }
  }

  static async verifyBrowsersInstalled(): Promise<void> {
    if (this.verified) return;
    try {
      // Try to launch a test browser to verify installation
      const testBrowser = await chromium.launch({ headless: true });
      await testBrowser.close();
      this.verified = true;
      logger.info("Playwright browsers verified");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Executable doesn't exist")) {
        logger.error("Playwright browsers not installed. Attempting auto-install...");
        try {
          execSync("npx playwright install chromium", { stdio: "inherit" });
          this.verified = true;
          logger.info("Playwright browsers auto-installed successfully");
        } catch {
          throw new Error(
            "Playwright browsers not installed. Please run: npx playwright install chromium"
          );
        }
      } else {
        throw err;
      }
    }
  }

  static async getBrowser(): Promise<Browser> {
    await this.verifyBrowsersInstalled();
    if (this.browser) return this.browser;
    if (!this.launching) {
      this.launching = chromium.launch({
        headless: true
      });
    }
    this.browser = await this.launching;
    return this.browser;
  }

  static async newContext(opts?: { userAgent?: string; storageState?: any }): Promise<BrowserContext> {
    const browser = await this.getBrowser();
    const userAgent = opts?.userAgent ?? randomUserAgent();
    const context = await browser.newContext({
      userAgent,
      storageState: opts?.storageState
    });
    return context;
  }

  static async close(): Promise<void> {
    try {
      await this.browser?.close();
    } finally {
      this.browser = null;
      this.launching = null;
    }
  }
}

