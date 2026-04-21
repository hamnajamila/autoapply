import type { ApplicationResult, JobListing, UserProfile } from "@autoapply/shared";
import { BasePortal } from "./BasePortal";
import { FormDetector } from "../automation/FormDetector";
import { fillFormFields } from "../llm/formFiller";
import { FormSubmitter } from "../automation/FormSubmitter";

async function hasText(page: any, re: RegExp): Promise<boolean> {
  const text = await page.content().catch(() => "");
  return re.test(text);
}

export class WorkdayPortal extends BasePortal {
  readonly name = "workday";
  readonly displayName = "Workday ATS";
  readonly logoUrl = "https://www.myworkdayjobs.com/favicon.ico";
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
      const page = this.page!;
      await this.safeGoto(job.applyUrl);
      await this.randomDelay();

      if (await this.detectCaptcha()) {
        const before = await this.takeScreenshot();
        return { success: false, status: "SKIPPED_CAPTCHA", method: "captcha", screenshotBefore: before };
      }

      if (await hasText(page, /create\s+account|sign\s+up/i)) {
        const before = await this.takeScreenshot();
        return {
          success: false,
          status: "SKIPPED_MANUAL",
          method: "workday_account_required",
          screenshotBefore: before,
          skipReason: "account_creation_required"
        };
      }

      const screenshotBefore = await this.takeScreenshot();

      for (let step = 0; step < 6; step += 1) {
        const fields = await FormDetector.getFields(page);
        const filled = await fillFormFields(fields, profile, job.title);

        // Prefer the next step when it exists instead of treating every page as a final submit.
        for (const field of filled) {
          void field;
        }

        const nextButton = page
          .locator('button:has-text("Next"), button:has-text("Continue"), button:has-text("Review")')
          .first();
        const hasNext = await nextButton.isVisible().catch(() => false);

        if (hasNext) {
          await FormSubmitter.submit(page, filled, resumePath);
          await nextButton.click().catch(() => undefined);
          await this.randomDelay(1500, 3500);
          continue;
        }

        const submit = await FormSubmitter.submit(page, filled, resumePath);
        return {
          success: submit.success,
          status: submit.success ? "SUBMITTED" : "UNCERTAIN",
          method: submit.method,
          screenshotBefore: screenshotBefore || submit.screenshotBefore,
          screenshotAfter: submit.screenshotAfter
        };
      }

      const screenshotAfter = await this.takeScreenshot();
      return {
        success: false,
        status: "UNCERTAIN",
        method: "workday_max_steps",
        screenshotBefore,
        screenshotAfter
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "apply_failed";
      const before = this.page ? await this.takeScreenshot().catch(() => "") : "";

      return {
        success: false,
        status: message === "captcha_required" ? "SKIPPED_CAPTCHA" : "FAILED",
        method: "error",
        errorMessage: message,
        screenshotBefore: before
      };
    } finally {
      await this.closeBrowser();
    }
  }
}
