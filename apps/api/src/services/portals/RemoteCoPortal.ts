import axios from "axios";
import * as cheerio from "cheerio";
import type { ApplicationResult, JobListing, UserProfile } from "@autoapply/shared";
import { BasePortal } from "./BasePortal";
import { FormDetector } from "../automation/FormDetector";
import { fillFormFields } from "../llm/formFiller";
import { FormSubmitter } from "../automation/FormSubmitter";

export class RemoteCoPortal extends BasePortal {
  readonly name = "remoteco";
  readonly displayName = "Remote.co";
  readonly logoUrl = "https://remote.co/wp-content/themes/remote-co/favicon.png";
  readonly requiresAuth = false;

  async scrapeJobs(): Promise<JobListing[]> {
    const base = "https://remote.co";
    const listUrl = `${base}/remote-jobs/`;
    const html = (await axios.get(listUrl, { timeout: 30000 })).data as string;
    const $ = cheerio.load(html);
    const links: { title: string; company: string; url: string }[] = [];

    $(".card.job").each((_i, el) => {
      const a = $(el).find("a.card-link").attr("href");
      const title = $(el).find(".card-title").text().trim();
      const company = $(el).find(".company").text().trim() || $(el).find(".card-text").first().text().trim();
      if (!a || !title || !company) return;
      const url = a.startsWith("http") ? a : `${base}${a}`;
      links.push({ title, company, url });
    });

    const unique = Array.from(new Map(links.map((l) => [l.url, l])).values()).slice(0, 25);
    const jobs: JobListing[] = [];

    for (const l of unique) {
      const jobHtml = (await axios.get(l.url, { timeout: 30000 })).data as string;
      const $$ = cheerio.load(jobHtml);
      const desc =
        $$(".job_description").text().trim() ||
        $$(".single_job_listing").text().trim() ||
        $$("body").text().trim();
      const applyHref =
        $$("a.application_button").attr("href") ||
        $$("a:contains('Apply')").attr("href") ||
        l.url;
      const applyUrl = applyHref.startsWith("http") ? applyHref : `${base}${applyHref}`;

      jobs.push({
        portalName: this.name,
        externalId: l.url,
        title: l.title,
        company: l.company,
        companyLogoUrl: null,
        location: "Remote",
        description: desc.slice(0, 20000),
        applyUrl,
        salaryMin: null,
        salaryMax: null,
        salaryCurrency: null,
        jobType: null,
        tags: [],
        isRemote: true,
        postedAt: null
      });
    }

    return jobs;
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

