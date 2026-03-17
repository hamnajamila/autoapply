import type { UserProfile } from "@autoapply/shared";
import { BaseLLMClient } from "./LLMClient";
import { OpenAIProvider } from "./OpenAIProvider";
import { env } from "../../config/env";

export type JobMatchResult = {
  score: number;
  reasons: string[];
  missingSkills: string[];
  confident: boolean;
};

const SYSTEM_PROMPT =
  "You are a field-agnostic job matching expert. You evaluate how well a \n" +
  "candidate's profile matches a job description regardless of industry, \n" +
  "domain, or role type. You work equally well for technical, creative, \n" +
  "business, medical, legal, and any other field.\n\n" +
  "Given a candidate profile and a job description:\n" +
  "1. Identify required and preferred skills/qualifications from the job description\n" +
  "2. Match them against the candidate's skills and experience  \n" +
  "3. Assign a score 0-100 based on overall fit\n" +
  "4. List the top 3-5 specific reasons for the score\n" +
  "5. List specific skills/qualifications the candidate is missing\n\n" +
  "Return JSON: {\n" +
  "  score: number,\n" +
  "  reasons: string[],\n" +
  "  missingSkills: string[],\n" +
  "  confident: boolean\n" +
  "}\n\n" +
  "Be strict: only score above 80 if it's genuinely a strong match. \n" +
  "Score below 50 if there are major mismatches in seniority or core requirements.";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function normalizeText(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9+.#/ -]/g, " ").replace(/\s+/g, " ").trim();
}

function heuristicMatch(profile: UserProfile, jobDescription: string, jobTitle: string): JobMatchResult {
  const desc = normalizeText(jobDescription);
  const title = normalizeText(jobTitle);
  const skills = (profile.skills ?? []).map(normalizeText).filter(Boolean);

  const tokens = new Set(desc.split(" "));
  const skillHits = skills.filter((sk) => sk && (tokens.has(sk) || desc.includes(sk)));
  const overlap = skills.length ? skillHits.length / skills.length : 0;

  const senioritySignals = ["senior", "lead", "principal", "head", "director", "manager", "junior", "entry", "intern"];
  const titleSignals = senioritySignals.filter((t) => title.includes(t));
  const descSignals = senioritySignals.filter((t) => desc.includes(t));
  const seniorityMatch = titleSignals.some((s) => descSignals.includes(s)) ? 1 : 0.6;

  const score = clamp(Math.round(overlap * 70 * seniorityMatch + 20), 0, 100);

  const reasons = [
    `Skills overlap: ${skillHits.slice(0, 6).join(", ") || "limited overlap detected"}`,
    `Resume summary: ${profile.summary?.slice(0, 120) || "provided"}`,
    `Title vs description seniority signals evaluated`
  ].slice(0, score >= 70 ? 4 : 3);

  const missingSkills = skills.length
    ? skills.filter((sk) => sk && !desc.includes(sk)).slice(0, 10)
    : [];

  return {
    score,
    reasons,
    missingSkills,
    confident: false
  };
}

export async function scoreJobMatch(
  userProfile: UserProfile,
  jobDescription: string,
  jobTitle: string,
  llm?: BaseLLMClient
): Promise<JobMatchResult> {
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

  if (!provider) return heuristicMatch(userProfile, jobDescription, jobTitle);

  const prompt =
    `Candidate profile JSON:\n${JSON.stringify(userProfile)}\n\n` +
    `Job title: ${jobTitle}\n\n` +
    `Job description:\n---\n${jobDescription.slice(0, 18000)}\n---\n\n` +
    `Scoring weights (do not mention industries):\n` +
    `- Skills overlap 40%\n- Experience level match 30%\n- Role type match 20%\n- Education/certifications 10%\n`;

  const res = await provider.completeJSON<any>(prompt, SYSTEM_PROMPT);
  const score = clamp(Number(res?.score ?? 0), 0, 100);
  const reasons = Array.isArray(res?.reasons) ? res.reasons.filter((r: any) => typeof r === "string").slice(0, 5) : [];
  const missingSkills = Array.isArray(res?.missingSkills)
    ? res.missingSkills.filter((r: any) => typeof r === "string").slice(0, 20)
    : [];
  const confident = Boolean(res?.confident);
  return { score, reasons, missingSkills, confident };
}

