import { chromium, type Browser, type BrowserContext } from "playwright";
import { access } from "node:fs/promises";
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

    const executablePath = chromium.executablePath();

    try {
      await access(executablePath);
    } catch {
      logger.error("Playwright browser executable not found", { executablePath });
      throw new Error("browser_setup_required");
    }

    try {
      const testBrowser = await chromium.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-dev-shm-usage"]
      });
      await testBrowser.close();
      this.verified = true;
      logger.info("Playwright browsers verified", { executablePath });
    } catch (err) {
      logger.error("Playwright browser verification failed", {
        executablePath,
        error: err instanceof Error ? err.message : String(err)
      });
      throw new Error("browser_setup_required");
    }
  }

  static async getBrowser(): Promise<Browser> {
    await this.verifyBrowsersInstalled();
    if (this.browser) return this.browser;
    if (!this.launching) {
      this.launching = chromium.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-dev-shm-usage"]
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

