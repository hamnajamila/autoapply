import type { ApplicationResult, JobListing, UserProfile } from "@autoapply/shared";
import { BrowserManager } from "../automation/BrowserManager";
import { CaptchaDetector } from "../automation/CaptchaDetector";
import type { Browser, BrowserContext, Page } from "playwright";

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0"
];

function randomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)] ?? USER_AGENTS[0]!;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export abstract class BasePortal {
  abstract readonly name: string;
  abstract readonly displayName: string;
  abstract readonly logoUrl: string;
  abstract readonly requiresAuth: boolean;

  protected browser: Browser | null = null;
  protected context: BrowserContext | null = null;
  protected page: Page | null = null;

  abstract scrapeJobs(profile?: UserProfile): Promise<JobListing[]>;
  abstract applyToJob(job: JobListing, profile: UserProfile, resumePath: string): Promise<ApplicationResult>;
  abstract isLoggedIn(): Promise<boolean>;
  abstract login(credentials: Record<string, string>): Promise<void>;

  async initBrowser(storedCookies?: string): Promise<void> {
    const context = await BrowserManager.newContext({ userAgent: randomUserAgent() });
    this.context = context;
    this.browser = context.browser();
    this.page = await context.newPage();

    if (storedCookies) {
      try {
        const cookies = JSON.parse(storedCookies);
        if (Array.isArray(cookies) && cookies.length) {
          await context.addCookies(cookies);
        }
      } catch {
        // ignore corrupt cookies
      }
    }
  }

  async saveCookies(): Promise<string> {
    if (!this.context) return "[]";
    const cookies = await this.context.cookies();
    return JSON.stringify(cookies);
  }

  async closeBrowser(): Promise<void> {
    try {
      await this.page?.close().catch(() => undefined);
      await this.context?.close().catch(() => undefined);
    } finally {
      this.page = null;
      this.context = null;
      this.browser = null;
    }
  }

  protected async randomDelay(min = 2000, max = 6000): Promise<void> {
    const ms = Math.floor(Math.random() * (max - min + 1)) + min;
    await sleep(ms);
  }

  protected async detectCaptcha(): Promise<boolean> {
    if (!this.page) return false;
    return CaptchaDetector.detect(this.page);
  }

  protected async takeScreenshot(): Promise<string> {
    if (!this.page) return "";
    const buf = await this.page.screenshot({ fullPage: true, type: "png" });
    return buf.toString("base64");
  }

  protected async safeGoto(url: string): Promise<void> {
    if (!this.page) throw new Error("Browser not initialized");
    let attempt = 0;
    let delay = 800;
    while (attempt < 3) {
      try {
        await this.page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
        if (await this.detectCaptcha()) {
          throw new Error("captcha_required");
        }
        return;
      } catch (err) {
        attempt++;
        if (attempt >= 3) throw err;
        await sleep(delay);
        delay *= 2;
      }
    }
  }
}

