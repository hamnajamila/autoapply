import axios from "axios";
import type { ApplicationResult, JobListing, UserProfile } from "@autoapply/shared";
import { BasePortal } from "./BasePortal";
import { FormDetector } from "../automation/FormDetector";
import { fillFormFields } from "../llm/formFiller";
import { FormSubmitter } from "../automation/FormSubmitter";

export class RemotivePortal extends BasePortal {
  readonly name = "remotive";
  readonly displayName = "Remotive";
  readonly logoUrl = "https://remotive.com/favicon-32x32.png";
  readonly requiresAuth = false;

  async scrapeJobs(): Promise<JobListing[]> {
    const res = await axios.get("https://remotive.com/api/remote-jobs", { timeout: 30000 });
    const jobs = Array.isArray(res.data?.jobs) ? res.data.jobs : [];
    return jobs
      .map((j: any) => {
        const id = String(j.id);
        return {
          portalName: this.name,
          externalId: id,
          title: String(j.title ?? ""),
          company: String(j.company_name ?? ""),
          companyLogoUrl: j.company_logo_url ? String(j.company_logo_url) : null,
          location: String(j.candidate_required_location ?? "Remote"),
          description: String(j.description ?? ""),
          applyUrl: String(j.url ?? ""),
          salaryMin: null,
          salaryMax: null,
          salaryCurrency: null,
          jobType: j.job_type ? String(j.job_type) : null,
          tags: Array.isArray(j.tags) ? j.tags.map(String) : [],
          isRemote: true,
          postedAt: j.publication_date ? new Date(j.publication_date).toISOString() : null
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

