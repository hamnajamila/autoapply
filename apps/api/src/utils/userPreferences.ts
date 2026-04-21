type JsonRecord = Record<string, any>;

const DEFAULT_YOUTH_KEYWORDS = [
  "intern",
  "internship",
  "graduate",
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
  "early career"
];

export function readPreferences(raw: unknown): JsonRecord {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? ({ ...(raw as JsonRecord) } as JsonRecord) : {};
}

export function getYouthKeywords(preferences: unknown): string[] {
  const prefs = readPreferences(preferences);
  const keywords = Array.isArray(prefs["youthKeywords"]) ? prefs["youthKeywords"] : DEFAULT_YOUTH_KEYWORDS;
  return Array.from(
    new Set(
      keywords
        .map((keyword) => (typeof keyword === "string" ? keyword.trim().toLowerCase() : ""))
        .filter(Boolean)
    )
  );
}

export function upsertArrayItem<T extends { id: string }>(items: T[], nextItem: T) {
  const withoutCurrent = items.filter((item) => item.id !== nextItem.id);
  return [nextItem, ...withoutCurrent];
}

export function removeArrayItem<T extends { id: string }>(items: T[], id: string) {
  return items.filter((item) => item.id !== id);
}
