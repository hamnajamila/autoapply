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
  "year",
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
  "developer",
  "remote",
  "hybrid",
  "onsite",
  "experience",
  "team",
  "teams",
  "industry",
  "field"
]);

function normalizeKeyword(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9+#/. -]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string) {
  return normalizeKeyword(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

function addKeyword(target: Set<string>, raw: string) {
  const value = normalizeKeyword(raw);
  if (!value) return;
  if (value.length < 2 || value.length > 60) return;
  if (STOP_WORDS.has(value)) return;
  if (/^\d+$/.test(value)) return;
  target.add(value);
}

function addWeightedPhrase(target: Map<string, number>, raw: string, weight: number) {
  const normalized = normalizeKeyword(raw);
  if (!normalized) return;

  if (normalized.includes(" ") && normalized.length <= 80 && !STOP_WORDS.has(normalized)) {
    target.set(normalized, (target.get(normalized) ?? 0) + weight + 2);
  }

  for (const token of tokenize(normalized)) {
    target.set(token, (target.get(token) ?? 0) + weight);
  }
}

function uniqueStrings(values: Array<string | undefined | null>) {
  return Array.from(
    new Set(
      values
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter(Boolean)
    )
  );
}

export function extractRelevantKeywords(text: string, explicitTerms: string[] = []): string[] {
  const bucket = new Set<string>();

  for (const term of explicitTerms) {
    addKeyword(bucket, term);
  }

  const normalizedText = text.replace(/[|/]/g, ",");
  const lines = normalizedText.split(/\r?\n/);
  for (const line of lines) {
    for (const part of line.split(/[,:;()â€¢\u2022-]/g)) {
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

  return Array.from(bucket).slice(0, 60);
}

export function getProfileSearchKeywords(profile: UserProfile | null | undefined): string[] {
  if (!profile) return [];

  const seededTerms = [
    ...(profile.targetJobKeywords ?? []),
    ...(profile.extractedKeywords ?? []),
    ...(profile.skills ?? []),
    ...(profile.certifications ?? []),
    ...(profile.languages ?? []),
    ...(profile.experience ?? []).flatMap((item) => [item.title, item.company, item.description, ...item.achievements]),
    ...(profile.education ?? []).flatMap((item) => [item.degree, item.field, item.institution]),
    profile.summary ?? "",
    profile.location ?? ""
  ];

  return extractRelevantKeywords(seededTerms.join("\n"), seededTerms);
}

export function getProfileFocusTerms(profile: UserProfile | null | undefined, limit = 18): string[] {
  if (!profile) return [];

  const weighted = new Map<string, number>();

  for (const term of profile.targetJobKeywords ?? []) addWeightedPhrase(weighted, term, 6);
  for (const term of profile.extractedKeywords ?? []) addWeightedPhrase(weighted, term, 5);
  for (const skill of profile.skills ?? []) addWeightedPhrase(weighted, skill, 5);
  for (const cert of profile.certifications ?? []) addWeightedPhrase(weighted, cert, 3);
  for (const language of profile.languages ?? []) addWeightedPhrase(weighted, language, 2);
  for (const experience of profile.experience ?? []) {
    addWeightedPhrase(weighted, experience.title, 7);
    addWeightedPhrase(weighted, experience.company, 1);
    addWeightedPhrase(weighted, experience.description, 3);
    for (const achievement of experience.achievements ?? []) {
      addWeightedPhrase(weighted, achievement, 3);
    }
  }
  for (const education of profile.education ?? []) {
    addWeightedPhrase(weighted, education.degree, 3);
    addWeightedPhrase(weighted, education.field, 5);
    addWeightedPhrase(weighted, education.institution, 1);
  }
  addWeightedPhrase(weighted, profile.summary ?? "", 2);

  return Array.from(weighted.entries())
    .filter(([term]) => term.length >= 3)
    .sort((left, right) => {
      if (right[1] !== left[1]) return right[1] - left[1];
      return right[0].length - left[0].length;
    })
    .map(([term]) => term)
    .slice(0, limit);
}

function buildListingText(listing: Pick<JobListing, "title" | "company" | "location" | "description" | "tags">) {
  return {
    title: normalizeKeyword(listing.title),
    company: normalizeKeyword(listing.company ?? ""),
    location: normalizeKeyword(listing.location ?? ""),
    description: normalizeKeyword(listing.description ?? ""),
    tags: normalizeKeyword((listing.tags ?? []).join(" "))
  };
}

function scoreListingAgainstFocus(listing: Pick<JobListing, "title" | "company" | "location" | "description" | "tags">, focusTerms: string[]) {
  if (!focusTerms.length) return 0;

  const fields = buildListingText(listing);
  const titleTokens = new Set(tokenize(fields.title));
  const descriptionTokens = new Set(tokenize(fields.description));

  let score = 0;
  let titleOrTagHits = 0;
  let descriptionHits = 0;

  for (const term of focusTerms) {
    const normalizedTerm = normalizeKeyword(term);
    if (!normalizedTerm) continue;

    const inTitle = fields.title.includes(normalizedTerm);
    const inTags = fields.tags.includes(normalizedTerm);
    const inDescription = fields.description.includes(normalizedTerm);
    const inLocation = fields.location.includes(normalizedTerm);
    const inCompany = fields.company.includes(normalizedTerm);
    const isPhrase = normalizedTerm.includes(" ");

    if (inTitle) {
      score += isPhrase ? 18 : 12;
      titleOrTagHits += 1;
      continue;
    }
    if (inTags) {
      score += isPhrase ? 14 : 10;
      titleOrTagHits += 1;
      continue;
    }
    if (inDescription) {
      score += isPhrase ? 7 : 4;
      descriptionHits += 1;
      continue;
    }
    if (inLocation) {
      score += 1;
      continue;
    }
    if (inCompany) {
      score += 1;
    }
  }

  const focusTokens = new Set(focusTerms.flatMap((term) => tokenize(term)));
  let titleTokenOverlap = 0;
  let descriptionTokenOverlap = 0;
  for (const token of focusTokens) {
    if (titleTokens.has(token)) titleTokenOverlap += 1;
    else if (descriptionTokens.has(token)) descriptionTokenOverlap += 1;
  }

  score += titleTokenOverlap * 6;
  score += Math.min(descriptionTokenOverlap, 6) * 2;

  if (titleOrTagHits === 0 && titleTokenOverlap < 2) {
    return 0;
  }
  if (titleOrTagHits === 0 && descriptionHits < 2 && descriptionTokenOverlap < 3) {
    return 0;
  }

  return score;
}

export function scoreListingRelevance(
  listing: Pick<JobListing, "title" | "company" | "location" | "description" | "tags">,
  profile: UserProfile | null | undefined
): number {
  const focusTerms = getProfileFocusTerms(profile);
  if (!focusTerms.length) return 0;
  return scoreListingAgainstFocus(listing, focusTerms);
}

export function filterRelevantListings<T extends Pick<JobListing, "title" | "company" | "location" | "description" | "tags">>(
  listings: T[],
  profile: UserProfile | null | undefined,
  minScore = 10
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
  const ranked = filterRelevantListings(listings, profile, 12);
  return ranked.map((listing) => {
    const { relevanceScore: _relevanceScore, ...job } = listing;
    return job;
  });
}

export function inferPrimaryProfileSignals(profile: UserProfile | null | undefined) {
  const focusTerms = getProfileFocusTerms(profile, 12);
  const keywords = uniqueStrings([
    ...(profile?.targetJobKeywords ?? []),
    ...(profile?.extractedKeywords ?? []),
    ...(profile?.skills ?? [])
  ]).slice(0, 20);

  return {
    focusTerms,
    keywords
  };
}
