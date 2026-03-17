import type { UserPreferences, UserProfile } from "@autoapply/shared";
import type { FormField } from "../automation/FormDetector";
import { BaseLLMClient } from "./LLMClient";
import { OpenAIProvider } from "./OpenAIProvider";
import { env } from "../../config/env";

export type FilledField = FormField & { valueToFill: string | boolean; confidence: number };

const SYSTEM_PROMPT =
  "You are a job application form filler. Given a list of form fields and \n" +
  "a candidate's profile, determine the best value to fill in each field.\n" +
  "Use information from the profile to fill fields as accurately as possible.\n" +
  "For fields you cannot determine with confidence, set confidence to 0.\n" +
  "Return only fields where confidence > 0.\n\n" +
  "Return JSON array: [\n" +
  '  { selector: string, label: string, valueToFill: string, confidence: number }\n' +
  "]\n\n" +
  "Rules:\n" +
  "- For name fields: use full name\n" +
  "- For email: use profile email\n" +
  "- For phone: use profile phone\n" +
  "- For cover letter / 'why do you want this job': write 2-3 sentences \n" +
  "  using the profile's summary and skills relevant to the job\n" +
  "- For salary: if user has set a salary preference, use it; otherwise leave blank\n" +
  "- For 'years of experience': calculate from profile work history\n" +
  "- For location/timezone: use profile location\n" +
  "- For checkboxes like 'I am authorized to work': check true\n" +
  "- For 'how did you hear about us': put 'Online Job Board'\n" +
  "- NEVER make up qualifications the candidate does not have";

function normalize(s: string) {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function yearsOfExperience(profile: UserProfile): number {
  const ex = profile.experience ?? [];
  if (!ex.length) return 0;
  const toYear = (d: string) => {
    const m = d.match(/(19|20)\d{2}/);
    return m ? Number(m[0]) : NaN;
  };
  const years: number[] = [];
  for (const e of ex) {
    const s = toYear(e.startDate);
    const end = e.endDate === "Present" ? new Date().getFullYear() : toYear(e.endDate);
    if (Number.isFinite(s) && Number.isFinite(end) && end >= s) years.push(end - s);
  }
  if (!years.length) return 0;
  return Math.max(...years);
}

function heuristicFill(fields: FormField[], profile: UserProfile, jobTitle: string, prefs?: UserPreferences): FilledField[] {
  const out: FilledField[] = [];
  const yoe = yearsOfExperience(profile);
  const salary =
    prefs?.salaryMin && prefs?.salaryMax
      ? `${prefs.salaryMin}-${prefs.salaryMax}${prefs.salaryCurrency ? ` ${prefs.salaryCurrency}` : ""}`
      : "";

  for (const f of fields) {
    const label = normalize(f.label);
    let value: string | boolean | null = null;
    let confidence = 0;

    if (f.type === "email" || label.includes("email")) {
      value = profile.email;
      confidence = profile.email ? 0.95 : 0;
    } else if (f.type === "tel" || label.includes("phone")) {
      value = profile.phone ?? "";
      confidence = profile.phone ? 0.9 : 0;
    } else if (label.includes("full name") || (label.includes("name") && !label.includes("company"))) {
      value = profile.name;
      confidence = profile.name ? 0.9 : 0;
    } else if (label.includes("location") || label.includes("timezone") || label.includes("city")) {
      value = profile.location ?? "";
      confidence = profile.location ? 0.75 : 0;
    } else if (label.includes("linkedin")) {
      value = profile.linkedinUrl ?? "";
      confidence = profile.linkedinUrl ? 0.85 : 0;
    } else if (label.includes("github")) {
      value = profile.githubUrl ?? "";
      confidence = profile.githubUrl ? 0.85 : 0;
    } else if (label.includes("portfolio") || label.includes("website")) {
      value = profile.portfolioUrl ?? "";
      confidence = profile.portfolioUrl ? 0.75 : 0;
    } else if (label.includes("years") && label.includes("experience")) {
      value = yoe ? String(yoe) : "";
      confidence = yoe ? 0.75 : 0;
    } else if (label.includes("salary") || label.includes("compensation")) {
      value = salary;
      confidence = salary ? 0.75 : 0;
    } else if (f.type === "checkbox" && (label.includes("authorized") || label.includes("work") || label.includes("consent"))) {
      value = true;
      confidence = 0.75;
    } else if (label.includes("how did you hear")) {
      value = "Online Job Board";
      confidence = 0.8;
    } else if (label.includes("cover letter") || label.includes("why do you want") || label.includes("why are you interested")) {
      const skills = (profile.skills ?? []).slice(0, 6).join(", ");
      const summary = profile.summary?.trim() ?? "";
      const text =
        `${summary ? summary + " " : ""}I’m interested in the ${jobTitle} opportunity because my experience and skills ` +
        `(${skills || "relevant skills"}) align with the role’s requirements. I’m excited to contribute and learn quickly.`;
      value = text.slice(0, 1200);
      confidence = 0.7;
    }

    if (confidence > 0 && value !== null && String(value).trim().length > 0) {
      out.push({ ...f, valueToFill: value, confidence });
    }
  }
  return out;
}

export async function fillFormFields(
  fields: FormField[],
  userProfile: UserProfile,
  jobTitle: string,
  opts?: { llm?: BaseLLMClient; preferences?: UserPreferences }
): Promise<FilledField[]> {
  const provider =
    opts?.llm ??
    (() => {
      if (!env.OPENAI_API_KEY) return null;
      try {
        return new OpenAIProvider();
      } catch {
        return null;
      }
    })();

  if (!provider) return heuristicFill(fields, userProfile, jobTitle, opts?.preferences);

  const prompt =
    `Job title: ${jobTitle}\n\n` +
    `Candidate profile JSON:\n${JSON.stringify(userProfile)}\n\n` +
    `User preferences JSON (may be empty):\n${JSON.stringify(opts?.preferences ?? {})}\n\n` +
    `Form fields JSON:\n${JSON.stringify(fields)}\n\n` +
    `Return only fields where confidence > 0.`;

  const mapped = await provider.completeJSON<any[]>(prompt, SYSTEM_PROMPT);
  const bySelector = new Map<string, { valueToFill: any; confidence: number }>();
  for (const m of Array.isArray(mapped) ? mapped : []) {
    if (typeof m?.selector !== "string") continue;
    const conf = Number(m?.confidence ?? 0);
    if (!Number.isFinite(conf) || conf <= 0) continue;
    bySelector.set(m.selector, { valueToFill: m.valueToFill, confidence: conf });
  }

  const out: FilledField[] = [];
  for (const f of fields) {
    const m = bySelector.get(f.selector);
    if (!m) continue;
    const confidence = Math.max(0, Math.min(1, m.confidence));
    let valueToFill: string | boolean;
    if (f.type === "checkbox") valueToFill = Boolean(m.valueToFill);
    else valueToFill = String(m.valueToFill ?? "");
    if (confidence > 0 && (typeof valueToFill === "boolean" || valueToFill.trim().length > 0)) {
      out.push({ ...f, valueToFill, confidence });
    }
  }
  return out.length ? out : heuristicFill(fields, userProfile, jobTitle, opts?.preferences);
}

