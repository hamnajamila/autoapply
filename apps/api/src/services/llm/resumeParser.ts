import { UserProfileSchema } from "@autoapply/shared";
import type { UserProfile } from "@autoapply/shared";
import { BaseLLMClient } from "./LLMClient";
import { getDefaultLLMClient } from "./providerFactory";
import { extractRelevantKeywords } from "./resumeKeywords";

const SYSTEM_PROMPT =
  "You are a resume parser. Extract all information from the resume text into \n" +
  "the specified JSON format. Be thorough - extract ALL skills mentioned \n" +
  "regardless of industry or domain. If a field is not present, use null \n" +
  "or an empty array. Return only valid JSON.";

function normalize(profile: Record<string, unknown>): UserProfile {
  const base = {
    name: typeof profile["name"] === "string" ? profile["name"] : "",
    email: typeof profile["email"] === "string" ? profile["email"] : "",
    summary: typeof profile["summary"] === "string" ? profile["summary"] : "",
    skills: Array.isArray(profile["skills"]) ? profile["skills"] : [],
    extractedKeywords: Array.isArray(profile["extractedKeywords"]) ? profile["extractedKeywords"] : [],
    targetJobKeywords: Array.isArray(profile["targetJobKeywords"]) ? profile["targetJobKeywords"] : [],
    experience: Array.isArray(profile["experience"]) ? profile["experience"] : [],
    education: Array.isArray(profile["education"]) ? profile["education"] : [],
    certifications: Array.isArray(profile["certifications"]) ? profile["certifications"] : [],
    languages: Array.isArray(profile["languages"]) ? profile["languages"] : [],
    ...(typeof profile["phone"] === "string" && profile["phone"].trim() ? { phone: profile["phone"] } : {}),
    ...(typeof profile["location"] === "string" && profile["location"].trim() ? { location: profile["location"] } : {}),
    ...(typeof profile["portfolioUrl"] === "string" && profile["portfolioUrl"].trim()
      ? { portfolioUrl: profile["portfolioUrl"] }
      : {}),
    ...(typeof profile["linkedinUrl"] === "string" && profile["linkedinUrl"].trim()
      ? { linkedinUrl: profile["linkedinUrl"] }
      : {}),
    ...(typeof profile["githubUrl"] === "string" && profile["githubUrl"].trim() ? { githubUrl: profile["githubUrl"] } : {})
  };

  const extractedKeywords = Array.isArray(base.extractedKeywords) && base.extractedKeywords.length
    ? base.extractedKeywords.filter((keyword): keyword is string => typeof keyword === "string" && keyword.trim().length > 0)
    : extractRelevantKeywords(
        [base.summary, ...(base.skills ?? []), ...(base.experience ?? []).map((item: any) => `${item?.title ?? ""} ${item?.company ?? ""}`)].join("\n"),
        [...(base.skills ?? []).filter((skill): skill is string => typeof skill === "string")]
      );

  const enrichedBase = {
    ...base,
    extractedKeywords,
    targetJobKeywords:
      Array.isArray(base.targetJobKeywords) && base.targetJobKeywords.length
        ? base.targetJobKeywords.filter((keyword): keyword is string => typeof keyword === "string" && keyword.trim().length > 0)
        : extractedKeywords.slice(0, 20)
  };

  const parsed = UserProfileSchema.safeParse(enrichedBase);
  if (parsed.success) return parsed.data;

  const coerced = {
    ...enrichedBase,
    skills: (enrichedBase.skills ?? []).filter((skill): skill is string => typeof skill === "string" && skill.trim().length > 0),
    extractedKeywords: (enrichedBase.extractedKeywords ?? []).filter(
      (keyword): keyword is string => typeof keyword === "string" && keyword.trim().length > 0
    ),
    targetJobKeywords: (enrichedBase.targetJobKeywords ?? []).filter(
      (keyword): keyword is string => typeof keyword === "string" && keyword.trim().length > 0
    ),
    experience: Array.isArray(enrichedBase.experience) ? enrichedBase.experience : [],
    education: Array.isArray(enrichedBase.education) ? enrichedBase.education : [],
    certifications: Array.isArray(enrichedBase.certifications) ? enrichedBase.certifications : [],
    languages: Array.isArray(enrichedBase.languages) ? enrichedBase.languages : []
  };

  return UserProfileSchema.parse(coerced);
}

function heuristicParse(text: string): UserProfile {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? "";
  const phone = text.match(/(\+?\d[\d\s().-]{7,}\d)/)?.[1];
  const urlMatches = Array.from(text.matchAll(/https?:\/\/[^\s)]+/gi)).map((match) => match[0]);
  const githubUrl = urlMatches.find((url) => /github\.com/i.test(url));
  const linkedinUrl = urlMatches.find((url) => /linkedin\.com/i.test(url));
  const portfolioUrl = urlMatches.find((url) => !/github\.com|linkedin\.com/i.test(url));

  const name = lines[0] ?? "";
  const locationLine = lines.find((line) => /remote|city|state|country|location/i.test(line));
  const location = locationLine ? locationLine.replace(/^location[:\s]*/i, "") : undefined;

  const skillsSectionIdx = lines.findIndex((line) => /^skills\b/i.test(line));
  const skills: string[] = [];
  if (skillsSectionIdx >= 0) {
    for (let i = skillsSectionIdx + 1; i < Math.min(lines.length, skillsSectionIdx + 12); i++) {
      const line = lines[i];
      if (!line) continue;
      if (/^(experience|education|certifications|projects)\b/i.test(line)) break;
      line
        .split(/[,|•]/g)
        .map((skill) => skill.trim())
        .filter((skill) => skill.length >= 2 && skill.length <= 60)
        .forEach((skill) => skills.push(skill));
    }
  }

  return normalize({
    name,
    email,
    ...(phone ? { phone } : {}),
    ...(location ? { location } : {}),
    summary: lines.slice(0, 6).join(" ").slice(0, 600),
    skills: Array.from(new Set(skills)).slice(0, 100),
    extractedKeywords: extractRelevantKeywords(text, skills),
    targetJobKeywords: extractRelevantKeywords(text, skills).slice(0, 20),
    experience: [],
    education: [],
    certifications: [],
    languages: [],
    ...(portfolioUrl ? { portfolioUrl } : {}),
    ...(linkedinUrl ? { linkedinUrl } : {}),
    ...(githubUrl ? { githubUrl } : {})
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

  const provider = llm ?? getDefaultLLMClient();
  if (!provider) return heuristicParse(text);

  const prompt =
    `Resume text:\n` +
    `---\n${text.slice(0, 18000)}\n---\n\n` +
    `Return JSON with this exact shape:\n` +
    `{\n` +
    `  name: string,\n  email: string,\n  phone?: string,\n  location?: string,\n  summary: string,\n  skills: string[],\n` +
    `  extractedKeywords?: string[],\n  targetJobKeywords?: string[],\n` +
    `  experience: Array<{ company: string, title: string, startDate: string, endDate: string | "Present", description: string, achievements: string[] }>,\n` +
    `  education: Array<{ institution: string, degree: string, field: string, graduationYear: string }>,\n` +
    `  certifications: string[],\n  languages: string[],\n  portfolioUrl?: string,\n  linkedinUrl?: string,\n  githubUrl?: string\n` +
    `}`;

  try {
    const parsed = await provider.completeJSON<Record<string, unknown>>(prompt, SYSTEM_PROMPT);
    return normalize(parsed);
  } catch {
    return heuristicParse(text);
  }
}
