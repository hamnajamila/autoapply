import type { JobListing } from "@autoapply/shared";
import { sanitizeText } from "./text";

const GOV_SOURCE_PORTALS = new Set(["nts", "fpsc", "ppsc", "spsc", "bpsc", "kppsc", "pts", "ots", "rozee", "dawn", "express", "mustakbil"]);
const GOV_KEYWORDS = [
  "government",
  "govt",
  "ministry",
  "department",
  "commission",
  "authority",
  "public sector",
  "federal",
  "punjab",
  "sindh",
  "balochistan",
  "khyber pakhtunkhwa",
  "kpk",
  "pakistan",
  "bps",
  "challan",
  "nts",
  "fpsc",
  "ppsc",
  "spsc",
  "bpsc",
  "kppsc",
  "pts",
  "ots"
];
const YOUTH_KEYWORDS = [
  "intern",
  "internship",
  "graduate",
  "entry level",
  "entry-level",
  "junior",
  "trainee",
  "fellowship",
  "scholarship",
  "youth",
  "graduate program",
  "associate",
  "apprentice",
  "bootcamp",
  "residency program",
  "early career",
  "hackathon",
  "competition"
];

function normalize(value: string | null | undefined) {
  return sanitizeText(value ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function countHits(haystack: string, needles: string[]) {
  return needles.reduce((total, needle) => (haystack.includes(needle) ? total + 1 : total), 0);
}

export function inferYouthOpportunityType(job: Pick<JobListing, "title" | "description" | "tags">) {
  const haystack = normalize([job.title, job.description, ...(job.tags ?? [])].join(" "));
  if (haystack.includes("scholarship")) return "scholarship";
  if (haystack.includes("fellowship")) return "fellowship";
  if (haystack.includes("hackathon")) return "hackathon";
  if (haystack.includes("competition")) return "competition";
  return "internship";
}

export function isLikelyGovernmentListing(
  job: Pick<JobListing, "portalName" | "title" | "company" | "description" | "tags">
) {
  const portal = normalize(job.portalName);
  const title = normalize(job.title);
  const description = normalize(job.description);
  const company = normalize(job.company);
  const tags = normalize((job.tags ?? []).join(" "));
  const haystack = [title, company, description, tags].join(" ");

  const sourceMatch = GOV_SOURCE_PORTALS.has(portal);
  const govHits = countHits(haystack, GOV_KEYWORDS);
  const hasExplicitGovTag = tags.includes("government");

  if (hasExplicitGovTag && govHits >= 1) return true;
  if (sourceMatch && govHits >= 1) return true;
  if (sourceMatch && /(commission|authority|ministry|department|public sector|bps[- ]?\d+)/i.test(haystack)) {
    return true;
  }

  return false;
}

export function isLikelyYouthListing(job: Pick<JobListing, "portalName" | "title" | "company" | "description" | "tags">) {
  if (isLikelyGovernmentListing(job)) return false;

  const haystack = normalize([job.title, job.company, job.description, ...(job.tags ?? [])].join(" "));
  const youthHits = countHits(haystack, YOUTH_KEYWORDS);
  return youthHits >= 1;
}
