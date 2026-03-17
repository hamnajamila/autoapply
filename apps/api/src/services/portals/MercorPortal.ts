import type { ApplicationResult, JobListing, UserProfile } from "@autoapply/shared";
import { BasePortal } from "./BasePortal";
import { FormDetector } from "../automation/FormDetector";
import { fillFormFields } from "../llm/formFiller";
import { FormSubmitter } from "../automation/FormSubmitter";

export class MercorPortal extends BasePortal {
  readonly name = "mercor";
  readonly displayName = "Mercor";
  readonly logoUrl = "https://mercor.com/favicon.ico";
  readonly requiresAuth = true;

  async isLoggedIn(): Promise<boolean> {
    if (!this.page) return false;
    const hasLogout = await this.page.locator('button:has-text("Log out"), a:has-text("Log out")').first().isVisible().catch(() => false);
    const hasDashboard = /mercor\.com/i.test(this.page.url()) && !/login/i.test(this.page.url());
    return Boolean(hasLogout || hasDashboard);
  }

  async login(credentials: Record<string, string>): Promise<void> {
    if (!this.page) throw new Error("Browser not initialized");
    const email = credentials["email"] ?? "";
    const password = credentials["password"] ?? "";
    if (!email || !password) throw new Error("missing_credentials");

    await this.safeGoto("https://mercor.com/login");
    await this.randomDelay();
    await this.page.locator('input[type="email"], input[name="email"]').first().fill(email);
    await this.page.locator('input[type="password"], input[name="password"]').first().fill(password);
    await this.page.locator('button[type="submit"], button:has-text("Continue"), button:has-text("Sign in")').first().click();
    await this.page.waitForLoadState("domcontentloaded", { timeout: 30000 }).catch(() => undefined);
  }

  async scrapeJobs(): Promise<JobListing[]> {
    if (!this.page) throw new Error("Browser not initialized");
    await this.safeGoto("https://mercor.com/jobs");
    await this.randomDelay();
    if (await this.detectCaptcha()) throw new Error("captcha_required");

    const jobs = await this.page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll("a[href*='/jobs/']")).slice(0, 40);
      const out: any[] = [];
      for (const a of cards) {
        const href = (a as HTMLAnchorElement).href;
        const title = (a as HTMLElement).querySelector("h3,h2")?.textContent?.trim() ?? (a as HTMLElement).textContent?.trim() ?? "";
        const company = (a as HTMLElement).querySelector("[data-company], .company")?.textContent?.trim() ?? "";
        if (!href || !title) continue;
        out.push({ href, title, company: company || "Unknown" });
      }
      return out;
    });

    return (jobs as any[]).map((j) => ({
      portalName: this.name,
      externalId: String(j.href),
      title: String(j.title),
      company: String(j.company ?? "Unknown"),
      companyLogoUrl: null,
      location: "Remote",
      description: "",
      applyUrl: String(j.href),
      salaryMin: null,
      salaryMax: null,
      salaryCurrency: null,
      jobType: null,
      tags: [],
      isRemote: true,
      postedAt: null
    }));
  }

  async applyToJob(job: JobListing, profile: UserProfile, resumePath: string): Promise<ApplicationResult> {
    if (!this.page) throw new Error("Browser not initialized");
    try {
      await this.safeGoto(job.applyUrl);
      await this.randomDelay();

      if (await this.detectCaptcha()) {
        const before = await this.takeScreenshot();
        return { success: false, status: "SKIPPED_CAPTCHA", method: "captcha", screenshotBefore: before };
      }

      const content = await this.page.content().catch(() => "");
      if (/video\s+intro.*required/i.test(content)) {
        const before = await this.takeScreenshot();
        return {
          success: false,
          status: "SKIPPED_MANUAL",
          method: "video_required",
          screenshotBefore: before,
          skipReason: "video_required"
        };
      }

      const fields = await FormDetector.getFields(this.page);
      const filled = await fillFormFields(fields, profile, job.title);
      const submit = await FormSubmitter.submit(this.page, filled, resumePath);
      return {
        success: submit.success,
        status: submit.success ? "SUBMITTED" : "UNCERTAIN",
        method: submit.method,
        screenshotBefore: submit.screenshotBefore,
        screenshotAfter: submit.screenshotAfter
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "apply_failed";
      const before = await this.takeScreenshot().catch(() => "");
      return { success: false, status: msg === "captcha_required" ? "SKIPPED_CAPTCHA" : "FAILED", method: "error", errorMessage: msg, screenshotBefore: before };
    }
  }
}

