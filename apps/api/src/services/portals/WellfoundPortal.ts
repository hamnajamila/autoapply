import type { ApplicationResult, JobListing, UserProfile } from "@autoapply/shared";
import { BasePortal } from "./BasePortal";
import { FormDetector } from "../automation/FormDetector";
import { fillFormFields } from "../llm/formFiller";
import { FormSubmitter } from "../automation/FormSubmitter";
import { getProfileFocusTerms } from "../llm/resumeKeywords";

export class WellfoundPortal extends BasePortal {
  readonly name = "wellfound";
  readonly displayName = "Wellfound";
  readonly logoUrl = "https://wellfound.com/favicon.ico";
  readonly requiresAuth = true;

  async isLoggedIn(): Promise<boolean> {
    if (!this.page) return false;
    const hasProfile = await this.page.locator('a[href*="/profile"], [data-testid*="profile"]').first().isVisible().catch(() => false);
    return hasProfile;
  }

  async login(credentials: Record<string, string>): Promise<void> {
    if (!this.page) throw new Error("Browser not initialized");
    const email = credentials["email"] ?? "";
    const password = credentials["password"] ?? "";
    if (!email || !password) throw new Error("missing_credentials");

    await this.safeGoto("https://wellfound.com/login");
    await this.randomDelay();
    await this.page.locator('input[type="email"], input[name="email"]').first().fill(email);
    await this.page.locator('input[type="password"], input[name="password"]').first().fill(password);
    await this.page.locator('button[type="submit"], button:has-text("Sign in")').first().click();
    await this.page.waitForLoadState("domcontentloaded", { timeout: 30000 }).catch(() => undefined);
  }

  async scrapeJobs(profile?: UserProfile): Promise<JobListing[]> {
    if (!this.page) throw new Error("Browser not initialized");
    const queries = getProfileFocusTerms(profile, 4).filter((term) => term.length >= 3);
    const urls = (queries.length ? queries : ["remote"]).map(
      (query) => `https://wellfound.com/jobs?query=${encodeURIComponent(query)}`
    );

    const aggregate: any[] = [];
    for (const url of urls) {
      await this.safeGoto(url);
      await this.randomDelay();
      if (await this.detectCaptcha()) throw new Error("captcha_required");

      const jobs = await this.page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll('a[href*="/company/"], a[href*="/jobs/"]')).slice(0, 60);
        const out: any[] = [];
        for (const a of cards) {
          const href = (a as HTMLAnchorElement).href;
          const title =
            (a as HTMLElement).querySelector("h3,h2")?.textContent?.trim() ?? (a as HTMLElement).textContent?.trim() ?? "";
          const company = (a as HTMLElement).querySelector("[data-testid*='company'], .company")?.textContent?.trim() ?? "";
          const description = (a as HTMLElement).textContent?.trim() ?? "";
          if (!href || !title) continue;
          out.push({ href, title, company: company || "Unknown", description });
        }
        return out;
      });

      aggregate.push(...jobs);
    }

    const uniq = Array.from(new Map(aggregate.map((job) => [job.href, job])).values()).slice(0, 40);
    return uniq.map((j) => ({
      portalName: this.name,
      externalId: String(j.href),
      title: String(j.title),
      company: String(j.company ?? "Unknown"),
      companyLogoUrl: null,
      location: "Remote",
      description: String(j.description ?? ""),
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

      const applyBtn = this.page.locator('button:has-text("Apply"), a:has-text("Apply")').first();
      if (await applyBtn.isVisible().catch(() => false)) {
        await applyBtn.click().catch(() => undefined);
        await this.randomDelay(1200, 2500);
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

