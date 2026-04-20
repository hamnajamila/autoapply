import type { JobListing, UserProfile } from "@autoapply/shared";

const STOP_WORDS = new Set([
  "about",
  "across",
  "after",
  "again",
  "also",
  "among",
  "and",
  "application",
  "applying",
  "apply",
  "are",
  "been",
  "between",
  "candidate",
  "company",
  "currently",
  "each",
  "from",
  "have",
  "into",
  "jobs",
  "more",
  "need",
  "only",
  "other",
  "over",
  "professional",
  "profile",
  "resume",
  "role",
  "roles",
  "seeking",
  "skills",
  "some",
  "that",
  "their",
  "them",
  "they",
  "this",
  "those",
  "through",
  "using",
  "with",
  "work",
  "worked",
  "working",
  "years",
  "your",
  "manager",
  "senior",
  "junior",
  "associate",
  "specialist",
  "analyst",
  "director",
  "lead",
  "principal",
  "operations",
  "strategy",
  "support",
  "coordinator",
  "executive",
  "officer",
  "consultant",
  "engineer",
  "developer"
]);

const DOMAIN_KEYWORDS: Record<string, string[]> = {
  ai_ml_data: [
    "machine learning",
    "ml",
    "ai",
    "artificial intelligence",
    "deep learning",
    "data science",
    "data scientist",
    "nlp",
    "computer vision",
    "llm",
    "genai",
    "generative ai",
    "statistics",
    "pytorch",
    "tensorflow",
    "scikit",
    "mle",
    "data engineer",
    "analytics"
  ],
  software: ["software", "backend", "frontend", "full stack", "web development", "api", "typescript", "node", "react"],
  product_design: ["product manager", "ux", "ui", "design", "figma", "research"],
  marketing_sales: ["marketing", "seo", "campaign", "sales", "growth", "crm"],
  finance_accounting: ["finance", "accounting", "audit", "tax", "investment", "banking"],
  legal_compliance: ["legal", "paralegal", "law", "compliance", "contract", "litigation"],
  healthcare: ["nurse", "doctor", "clinical", "medical", "healthcare", "patient"],
  education: ["teacher", "education", "curriculum", "instructor", "training"]
};

function normalizeKeyword(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9+#/. -]/g, " ").replace(/\s+/g, " ").trim();
}

function addKeyword(target: Set<string>, raw: string) {
  const value = normalizeKeyword(raw);
  if (!value) return;
  if (value.length < 2 || value.length > 40) return;
  if (STOP_WORDS.has(value)) return;
  if (/^\d+$/.test(value)) return;
  target.add(value);
}

export function extractRelevantKeywords(text: string, explicitTerms: string[] = []): string[] {
  const bucket = new Set<string>();

  for (const term of explicitTerms) {
    addKeyword(bucket, term);
  }

  const normalizedText = text.replace(/[|/]/g, ",");
  const lines = normalizedText.split(/\r?\n/);
  for (const line of lines) {
    for (const part of line.split(/[,:;()•\u2022-]/g)) {
      const trimmed = part.trim();
      if (!trimmed) continue;

      if (trimmed.includes(" ")) {
        addKeyword(bucket, trimmed);
      }

      for (const word of trimmed.split(/\s+/)) {
        addKeyword(bucket, word);
      }
    }
  }

  return Array.from(bucket).slice(0, 40);
}

export function getProfileSearchKeywords(profile: UserProfile | null | undefined): string[] {
  if (!profile) return [];

  const seededTerms = [
    ...(profile.targetJobKeywords ?? []),
    ...(profile.extractedKeywords ?? []),
    ...(profile.skills ?? []),
    ...(profile.certifications ?? []),
    ...(profile.languages ?? []),
    ...(profile.experience ?? []).flatMap((item) => [item.title, ...item.achievements]),
    ...(profile.education ?? []).flatMap((item) => [item.degree, item.field]),
    profile.summary ?? ""
  ];

  return extractRelevantKeywords(seededTerms.join("\n"), seededTerms);
}

function inferProfileDomains(profile: UserProfile | null | undefined): string[] {
  if (!profile) return [];
  const keywords = getProfileSearchKeywords(profile);
  if (!keywords.length) return [];

  const text = normalizeKeyword(keywords.join(" "));
  const scored = Object.entries(DOMAIN_KEYWORDS)
    .map(([domain, tokens]) => ({
      domain,
      score: tokens.reduce((acc, token) => (text.includes(normalizeKeyword(token)) ? acc + 1 : acc), 0)
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, 2).map((entry) => entry.domain);
}

function scoreListingAgainstKeywords(listing: JobListing, keywords: string[]) {
  if (!keywords.length) return 0;

  const title = normalizeKeyword(listing.title);
  const tags = normalizeKeyword((listing.tags ?? []).join(" "));
  const description = normalizeKeyword(listing.description ?? "");
  const company = normalizeKeyword(listing.company ?? "");
  const haystack = `${title} ${tags} ${description} ${company}`.trim();

  let score = 0;
  let titleOrTagHits = 0;
  for (const keyword of keywords) {
    if (!haystack.includes(keyword)) continue;
    const inTitle = title.includes(keyword);
    const inTags = tags.includes(keyword);
    const inDescription = description.includes(keyword);
    const inCompany = company.includes(keyword);

    if (inTitle) {
      score += 8;
      titleOrTagHits += 1;
      continue;
    }
    if (inTags) {
      score += 6;
      titleOrTagHits += 1;
      continue;
    }
    if (inDescription) {
      score += 2;
      continue;
    }
    if (inCompany) {
      score += 1;
    }
  }

  // Hard gate: must match at least one meaningful keyword in title/tags.
  if (titleOrTagHits === 0) return 0;

  return score;
}

export function scoreListingRelevance(listing: Pick<JobListing, "title" | "company" | "location" | "description" | "tags">, profile: UserProfile | null | undefined): number {
  const keywords = getProfileSearchKeywords(profile);
  if (!keywords.length) return 0;
  const baseScore = scoreListingAgainstKeywords(
    {
      portalName: "relevance",
      externalId: "relevance",
      title: listing.title,
      company: listing.company,
      location: listing.location ?? "Remote",
      description: listing.description,
      applyUrl: "",
      tags: listing.tags ?? [],
      isRemote: true
    },
    keywords
  );
  if (baseScore === 0) return 0;

  const profileDomains = inferProfileDomains(profile);
  if (!profileDomains.length) return baseScore;

  const listingText = normalizeKeyword([listing.title, listing.description, ...(listing.tags ?? [])].join(" "));
  const domainMatchScore = profileDomains.reduce((acc, domain) => {
    const tokens = DOMAIN_KEYWORDS[domain] ?? [];
    const tokenHits = tokens.reduce((hits, token) => (listingText.includes(normalizeKeyword(token)) ? hits + 1 : hits), 0);
    return acc + tokenHits;
  }, 0);

  if (domainMatchScore === 0) return 0;
  return baseScore + domainMatchScore * 3;
}

export function filterRelevantListings<T extends Pick<JobListing, "title" | "company" | "location" | "description" | "tags">>(
  listings: T[],
  profile: UserProfile | null | undefined,
  minScore = 1
): Array<T & { relevanceScore: number }> {
  return listings
    .map((listing) => ({
      ...listing,
      relevanceScore: scoreListingRelevance(listing, profile)
    }))
    .filter((listing) => listing.relevanceScore >= minScore)
    .sort((left, right) => right.relevanceScore - left.relevanceScore);
}

export function rankListingsForProfile(listings: JobListing[], profile: UserProfile | null | undefined): JobListing[] {
  const keywords = getProfileSearchKeywords(profile);
  if (!keywords.length) return listings;

  const scored = listings.map((listing) => ({
    listing,
    score: scoreListingAgainstKeywords(listing, keywords)
  }));

  const matched = scored
    .filter((entry) => entry.score >= 8)
    .sort((left, right) => right.score - left.score)
    .map((entry) => entry.listing);

  // Keep results strictly resume-relevant: never append zero-match listings.
  return matched;
}
