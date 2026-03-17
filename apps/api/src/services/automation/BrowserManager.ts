import { chromium, type Browser, type BrowserContext } from "playwright";

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

  static async getBrowser(): Promise<Browser> {
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

