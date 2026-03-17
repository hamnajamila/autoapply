import axios from "axios";
import type { ApplicationResult, JobListing, UserProfile } from "@autoapply/shared";
import { BasePortal } from "./BasePortal";
import { FormDetector } from "../automation/FormDetector";
import { fillFormFields } from "../llm/formFiller";
import { FormSubmitter } from "../automation/FormSubmitter";

export class HimalayasPortal extends BasePortal {
  readonly name = "himalayas";
  readonly displayName = "Himalayas";
  readonly logoUrl = "https://himalayas.app/favicon.ico";
  readonly requiresAuth = false;

  async scrapeJobs(): Promise<JobListing[]> {
    const res = await axios.get("https://himalayas.app/jobs/api?limit=50", { timeout: 30000 });
    const jobs = Array.isArray(res.data?.jobs) ? res.data.jobs : Array.isArray(res.data) ? res.data : [];
    return jobs
      .map((j: any) => {
        const id = String(j.id ?? j.external_id ?? j.slug ?? "");
        const company = String(j.companyName ?? j.company_name ?? j.company ?? "");
        const applyUrl = String(j.applicationUrl ?? j.applyUrl ?? j.url ?? "");
        return {
          portalName: this.name,
          externalId: id || applyUrl,
          title: String(j.title ?? ""),
          company,
          companyLogoUrl: j.companyLogoUrl ? String(j.companyLogoUrl) : null,
          location: String(j.location ?? "Remote"),
          description: String(j.description ?? ""),
          applyUrl,
          salaryMin: null,
          salaryMax: null,
          salaryCurrency: null,
          jobType: j.employmentType ? String(j.employmentType) : null,
          tags: Array.isArray(j.tags) ? j.tags.map(String) : [],
          isRemote: true,
          postedAt: j.postedAt ? new Date(j.postedAt).toISOString() : null
        } satisfies JobListing;
      })
      .filter((j: JobListing) => j.title && j.company && j.applyUrl)
      .slice(0, 50);
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

      const fields = await FormDetector.getFields(this.page!);
      const filled = await fillFormFields(fields, profile, job.title);
      const submit = await FormSubmitter.submit(this.page!, filled, resumePath);
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

