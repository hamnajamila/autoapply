import type { UserPreferences, UserProfile } from "@autoapply/shared";
import type { FormField } from "../automation/FormDetector";
import { BaseLLMClient } from "./LLMClient";
import { getDefaultLLMClient } from "./providerFactory";

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

function normalize(text: string) {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function yearsOfExperience(profile: UserProfile): number {
  if (!profile.experience.length) return 0;

  const toYear = (date: string) => {
    const match = date.match(/(19|20)\d{2}/);
    return match ? Number(match[0]) : Number.NaN;
  };

  const spans = profile.experience
    .map((experience) => {
      const start = toYear(experience.startDate);
      const end = experience.endDate === "Present" ? new Date().getFullYear() : toYear(experience.endDate);
      return Number.isFinite(start) && Number.isFinite(end) && end >= start ? end - start : 0;
    })
    .filter((years) => years > 0);

  return spans.length ? Math.max(...spans) : 0;
}

function heuristicFill(
  fields: FormField[],
  profile: UserProfile,
  jobTitle: string,
  preferences?: UserPreferences
): FilledField[] {
  const result: FilledField[] = [];
  const yoe = yearsOfExperience(profile);
  const salary =
    preferences?.salaryMin && preferences?.salaryMax
      ? `${preferences.salaryMin}-${preferences.salaryMax}${preferences.salaryCurrency ? ` ${preferences.salaryCurrency}` : ""}`
      : "";

  for (const field of fields) {
    const label = normalize(field.label);
    let value: string | boolean | null = null;
    let confidence = 0;

    if (field.type === "email" || label.includes("email")) {
      value = profile.email;
      confidence = profile.email ? 0.95 : 0;
    } else if (field.type === "tel" || label.includes("phone")) {
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
    } else if (
      field.type === "checkbox" &&
      (label.includes("authorized") || label.includes("work") || label.includes("consent"))
    ) {
      value = true;
      confidence = 0.75;
    } else if (label.includes("how did you hear")) {
      value = "Online Job Board";
      confidence = 0.8;
    } else if (
      label.includes("cover letter") ||
      label.includes("why do you want") ||
      label.includes("why are you interested")
    ) {
      const skills = profile.skills.slice(0, 6).join(", ");
      const summary = profile.summary.trim();
      value =
        `${summary ? `${summary} ` : ""}I'm interested in the ${jobTitle} opportunity because my experience and skills ` +
        `(${skills || "relevant skills"}) align with the role's requirements. I'm excited to contribute and learn quickly.`;
      confidence = 0.7;
    }

    if (confidence > 0 && value !== null && String(value).trim().length > 0) {
      result.push({ ...field, valueToFill: value, confidence });
    }
  }

  return result;
}

export async function fillFormFields(
  fields: FormField[],
  userProfile: UserProfile,
  jobTitle: string,
  options?: { llm?: BaseLLMClient; preferences?: UserPreferences }
): Promise<FilledField[]> {
  const provider = options?.llm ?? getDefaultLLMClient();
  if (!provider) return heuristicFill(fields, userProfile, jobTitle, options?.preferences);

  const prompt =
    `Job title: ${jobTitle}\n\n` +
    `Candidate profile JSON:\n${JSON.stringify(userProfile)}\n\n` +
    `User preferences JSON (may be empty):\n${JSON.stringify(options?.preferences ?? {})}\n\n` +
    `Form fields JSON:\n${JSON.stringify(fields)}\n\n` +
    `Return only fields where confidence > 0.`;

  try {
    const mapped = await provider.completeJSON<
      Array<{ selector?: string; valueToFill?: string | boolean; confidence?: number }>
    >(prompt, SYSTEM_PROMPT);
    const valuesBySelector = new Map<string, { valueToFill: string | boolean | undefined; confidence: number }>();

    for (const item of Array.isArray(mapped) ? mapped : []) {
      if (typeof item?.selector !== "string") continue;
      const confidence = Number(item?.confidence ?? 0);
      if (!Number.isFinite(confidence) || confidence <= 0) continue;
      valuesBySelector.set(item.selector, { valueToFill: item.valueToFill, confidence });
    }

    const result: FilledField[] = [];
    for (const field of fields) {
      const mappedField = valuesBySelector.get(field.selector);
      if (!mappedField) continue;

      const confidence = Math.max(0, Math.min(1, mappedField.confidence));
      const valueToFill =
        field.type === "checkbox" ? Boolean(mappedField.valueToFill) : String(mappedField.valueToFill ?? "");

      if (confidence > 0 && (typeof valueToFill === "boolean" || valueToFill.trim().length > 0)) {
        result.push({ ...field, valueToFill, confidence });
      }
    }

    return result.length ? result : heuristicFill(fields, userProfile, jobTitle, options?.preferences);
  } catch {
    return heuristicFill(fields, userProfile, jobTitle, options?.preferences);
  }
}
