import type { ApplicationResult, JobListing, UserProfile } from "@autoapply/shared";
import { BasePortal } from "./BasePortal";
import { FormDetector } from "../automation/FormDetector";
import { fillFormFields } from "../llm/formFiller";
import { FormSubmitter } from "../automation/FormSubmitter";

export class LeverPortal extends BasePortal {
  readonly name = "lever";
  readonly displayName = "Lever ATS";
  readonly logoUrl = "https://jobs.lever.co/favicon.ico";
  readonly requiresAuth = false;

  async scrapeJobs(): Promise<JobListing[]> {
    return [];
  }

  async isLoggedIn(): Promise<boolean> {
    return true;
  }

  async login(): Promise<void> {
    return;
  }

  async applyToJob(job: JobListing, profile: UserProfile, resumePath: string): Promise<ApplicationResult> {
    await this.initBrowser();
    try {
      await this.safeGoto(job.applyUrl);
      await this.randomDelay();

      if (await this.detectCaptcha()) {
        const before = await this.takeScreenshot();
        return { success: false, status: "SKIPPED_CAPTCHA", method: "captcha", screenshotBefore: before };
      }

      const page = this.page!;
      await page.locator('input[name="name"]').fill(profile.name || "").catch(() => undefined);
      await page.locator('input[name="email"]').fill(profile.email || "").catch(() => undefined);
      if (profile.phone) await page.locator('input[name="phone"]').fill(profile.phone).catch(() => undefined);
      if (profile.linkedinUrl) await page.locator('input[name="urls[LinkedIn]"]').fill(profile.linkedinUrl).catch(() => undefined);

      const fileInput = page.locator('input[type="file"]').first();
      await fileInput.setInputFiles(resumePath).catch(() => undefined);

      const fields = await FormDetector.getFields(page);
      const filled = await fillFormFields(fields, profile, job.title);
      const submit = await FormSubmitter.submit(page, filled, resumePath);
      return {
        success: submit.success,
        status: submit.success ? "SUBMITTED" : "UNCERTAIN",
        method: submit.method,
        screenshotBefore: submit.screenshotBefore,
        screenshotAfter: submit.screenshotAfter
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "apply_failed";
      const before = this.page ? await this.takeScreenshot().catch(() => "") : "";
      return { success: false, status: msg === "captcha_required" ? "SKIPPED_CAPTCHA" : "FAILED", method: "error", errorMessage: msg, screenshotBefore: before };
    } finally {
      await this.closeBrowser();
    }
  }
}

