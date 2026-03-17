import { UserProfileSchema } from "@autoapply/shared";
import type { UserProfile } from "@autoapply/shared";
import { BaseLLMClient } from "./LLMClient";
import { OpenAIProvider } from "./OpenAIProvider";
import { env } from "../../config/env";

const SYSTEM_PROMPT =
  'You are a resume parser. Extract all information from the resume text into \n' +
  'the specified JSON format. Be thorough — extract ALL skills mentioned \n' +
  'regardless of industry or domain. If a field is not present, use null \n' +
  "or an empty array. Return only valid JSON.";

function normalize(profile: any): UserProfile {
  const base = {
    name: profile?.name ?? "",
    email: profile?.email ?? "",
    summary: profile?.summary ?? "",
    skills: Array.isArray(profile?.skills) ? profile.skills : [],
    experience: Array.isArray(profile?.experience) ? profile.experience : [],
    education: Array.isArray(profile?.education) ? profile.education : [],
    certifications: Array.isArray(profile?.certifications) ? profile.certifications : [],
    languages: Array.isArray(profile?.languages) ? profile.languages : [],
    ...(typeof profile?.phone === "string" && profile.phone.trim() ? { phone: profile.phone } : {}),
    ...(typeof profile?.location === "string" && profile.location.trim() ? { location: profile.location } : {}),
    ...(typeof profile?.portfolioUrl === "string" && profile.portfolioUrl.trim() ? { portfolioUrl: profile.portfolioUrl } : {}),
    ...(typeof profile?.linkedinUrl === "string" && profile.linkedinUrl.trim() ? { linkedinUrl: profile.linkedinUrl } : {}),
    ...(typeof profile?.githubUrl === "string" && profile.githubUrl.trim() ? { githubUrl: profile.githubUrl } : {})
  } as any;
  const parsed = UserProfileSchema.safeParse(base);
  if (parsed.success) return parsed.data;
  // If LLM returned nulls, coerce to safe defaults then validate again.
  const coerced = {
    ...base,
    name: typeof base.name === "string" ? base.name : "",
    email: typeof base.email === "string" ? base.email : "",
    summary: typeof base.summary === "string" ? base.summary : "",
    skills: (base.skills ?? []).filter((s: unknown): s is string => typeof s === "string" && s.trim().length > 0),
    experience: Array.isArray(base.experience) ? base.experience : [],
    education: Array.isArray(base.education) ? base.education : [],
    certifications: Array.isArray(base.certifications) ? base.certifications : [],
    languages: Array.isArray(base.languages) ? base.languages : []
  };
  const parsed2 = UserProfileSchema.parse(coerced);
  return parsed2;
}

function heuristicParse(text: string): UserProfile {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? "";
  const phone = text.match(/(\+?\d[\d\s().-]{7,}\d)/)?.[1];
  const urlMatches = Array.from(text.matchAll(/https?:\/\/[^\s)]+/gi)).map((m) => m[0]);
  const githubUrl = urlMatches.find((u) => /github\.com/i.test(u));
  const linkedinUrl = urlMatches.find((u) => /linkedin\.com/i.test(u));
  const portfolioUrl = urlMatches.find((u) => !/github\.com|linkedin\.com/i.test(u));

  const name = lines[0] ?? "";
  const locationLine = lines.find((l) => /remote|city|state|country|location/i.test(l));
  const location = locationLine ? locationLine.replace(/^location[:\s]*/i, "") : undefined;

  const skillsSectionIdx = lines.findIndex((l) => /^skills\b/i.test(l));
  const skills: string[] = [];
  if (skillsSectionIdx >= 0) {
    for (let i = skillsSectionIdx + 1; i < Math.min(lines.length, skillsSectionIdx + 12); i++) {
      const l = lines[i];
      if (!l) continue;
      if (/^(experience|education|certifications|projects)\b/i.test(l)) break;
      l.split(/[,•|]/g)
        .map((s) => s.trim())
        .filter((s) => s.length >= 2 && s.length <= 60)
        .forEach((s) => skills.push(s));
    }
  }
  const uniqSkills = Array.from(new Set(skills)).slice(0, 100);

  return normalize({
    name,
    email,
    phone,
    location,
    summary: lines.slice(0, 6).join(" ").slice(0, 600),
    skills: uniqSkills,
    experience: [],
    education: [],
    certifications: [],
    languages: [],
    portfolioUrl,
    linkedinUrl,
    githubUrl
  });
}

export async function parseResumeText(rawText: string, llm?: BaseLLMClient): Promise<UserProfile> {
  const text = (rawText ?? "").trim();
  if (!text) {
    return normalize({
      name: "",
      email: "",
      summary: "",
      skills: [],
      experience: [],
      education: [],
      certifications: [],
      languages: []
    });
  }

  const provider =
    llm ??
    (() => {
      if (!env.OPENAI_API_KEY) return null;
      try {
        return new OpenAIProvider();
      } catch {
        return null;
      }
    })();

  if (!provider) return heuristicParse(text);

  const prompt =
    `Resume text:\n` +
    `---\n${text.slice(0, 18000)}\n---\n\n` +
    `Return JSON with this exact shape:\n` +
    `{\n` +
    `  name: string,\n  email: string,\n  phone?: string,\n  location?: string,\n  summary: string,\n  skills: string[],\n` +
    `  experience: Array<{ company: string, title: string, startDate: string, endDate: string | "Present", description: string, achievements: string[] }>,\n` +
    `  education: Array<{ institution: string, degree: string, field: string, graduationYear: string }>,\n` +
    `  certifications: string[],\n  languages: string[],\n  portfolioUrl?: string,\n  linkedinUrl?: string,\n  githubUrl?: string\n` +
    `}`;

  const parsed = await provider.completeJSON<any>(prompt, SYSTEM_PROMPT);
  return normalize(parsed);
}

