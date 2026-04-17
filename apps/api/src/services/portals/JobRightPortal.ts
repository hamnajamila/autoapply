import type { ApplicationResult, JobListing, UserProfile } from "@autoapply/shared";
import { BasePortal } from "./BasePortal";
import { FormDetector } from "../automation/FormDetector";
import { fillFormFields } from "../llm/formFiller";
import { FormSubmitter } from "../automation/FormSubmitter";

export class JobRightPortal extends BasePortal {
  readonly name = "jobright";
  readonly displayName = "JobRight.ai";
  readonly logoUrl = "https://jobright.ai/favicon.ico";
  readonly requiresAuth = true;

  async isLoggedIn(): Promise<boolean> {
    if (!this.page) return false;
    const url = this.page.url();
    if (/login/i.test(url)) return false;
    const hasAvatar = await this.page.locator('img[alt*="avatar"], [data-testid*="avatar"]').first().isVisible().catch(() => false);
    return hasAvatar;
  }

  async login(credentials: Record<string, string>): Promise<void> {
    if (!this.page) throw new Error("Browser not initialized");
    const email = credentials["email"] ?? credentials["username"] ?? "";
    const password = credentials["password"] ?? "";
    if (!email || !password) throw new Error("missing_credentials");

    await this.safeGoto("https://jobright.ai/");
    await this.randomDelay(1200, 2200);

    const emailField = this.page.locator('input[type="email"], input[name="email"], input[placeholder="Email"]').first();
    const passwordField = this.page.locator('input[type="password"], input[name="password"], input[placeholder="Password"]').first();
    const emailVisible = await emailField.isVisible().catch(() => false);

    if (!emailVisible) {
      const signInCandidates = this.page.locator("button, a, [role='button']").filter({ hasText: /sign in/i });
      const candidateCount = await signInCandidates.count();
      let clicked = false;

      for (let index = 0; index < candidateCount; index += 1) {
        const candidate = signInCandidates.nth(index);
        const isVisible = await candidate.isVisible().catch(() => false);
        if (!isVisible) {
          continue;
        }

        await candidate.click().catch(() => undefined);
        clicked = true;
        break;
      }

      if (!clicked) {
        throw new Error("portal_login_form_unavailable");
      }
      await this.randomDelay(800, 1600);
    }

    await emailField.waitFor({ state: "visible", timeout: 15000 });
    await passwordField.waitFor({ state: "visible", timeout: 15000 });
    await emailField.fill(email);
    await passwordField.fill(password);
    await this.randomDelay(800, 1600);

    const submitButton = this.page
      .locator('button:has-text("SIGN IN"), button:has-text("Sign in"), button:has-text("Login"), button[type="submit"]')
      .last();
    await submitButton.click();
    await this.page.waitForLoadState("domcontentloaded", { timeout: 30000 }).catch(() => undefined);
  }

  async scrapeJobs(): Promise<JobListing[]> {
    if (!this.page) throw new Error("Browser not initialized");
    await this.safeGoto("https://jobright.ai/jobs?remote=true");
    await this.randomDelay();
    if (await this.detectCaptcha()) throw new Error("captcha_required");

    const jobs = await this.page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('[data-testid*="job"], a[href*="/jobs/"], .job-card')).slice(0, 40);
      const out: any[] = [];
      for (const c of cards) {
        const a = (c as HTMLElement).closest("a") ?? (c as HTMLElement).querySelector("a");
        const href = (a as HTMLAnchorElement | null)?.href ?? "";
        const title =
          (c as HTMLElement).querySelector('[data-testid*="title"], .title')?.textContent?.trim() ??
          (c as HTMLElement).querySelector("h3,h2")?.textContent?.trim() ??
          "";
        const company =
          (c as HTMLElement).querySelector('[data-testid*="company"], .company')?.textContent?.trim() ??
          (c as HTMLElement).querySelector("p")?.textContent?.trim() ??
          "";
        if (!href || !title || !company) continue;
        out.push({ href, title, company });
      }
      return out;
    });

    return (jobs as any[])
      .map((j) => {
        const externalId = j.href;
        return {
          portalName: this.name,
          externalId,
          title: String(j.title),
          company: String(j.company),
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
        } satisfies JobListing;
      })
      .slice(0, 30);
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

