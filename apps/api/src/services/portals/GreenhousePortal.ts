import type { ApplicationResult, JobListing, UserProfile } from "@autoapply/shared";
import { BasePortal } from "./BasePortal";
import { FormDetector } from "../automation/FormDetector";
import { fillFormFields } from "../llm/formFiller";
import { FormSubmitter } from "../automation/FormSubmitter";

function splitName(full: string) {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { first: "", last: "" };
  if (parts.length === 1) return { first: parts[0]!, last: "" };
  return { first: parts[0]!, last: parts.slice(1).join(" ") };
}

export class GreenhousePortal extends BasePortal {
  readonly name = "greenhouse";
  readonly displayName = "Greenhouse ATS";
  readonly logoUrl = "https://boards.greenhouse.io/favicon.ico";
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

      const { first, last } = splitName(profile.name || "");
      const page = this.page!;

      // Prefer Greenhouse standardized fields when present
      await page.locator('input[name="first_name"]').fill(first).catch(() => undefined);
      await page.locator('input[name="last_name"]').fill(last).catch(() => undefined);
      await page.locator('input[name="email"]').fill(profile.email || "").catch(() => undefined);
      if (profile.phone) await page.locator('input[name="phone"]').fill(profile.phone).catch(() => undefined);

      const resumePrimary = page.locator('input[data-field="resume"]').first();
      const hasPrimary = await resumePrimary.isVisible().catch(() => false);
      if (hasPrimary) {
        await resumePrimary.setInputFiles(resumePath).catch(() => undefined);
      } else {
        await page.locator('input[type="file"]').first().setInputFiles(resumePath).catch(() => undefined);
      }

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

