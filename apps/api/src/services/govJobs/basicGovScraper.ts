import axios from "axios";
import * as cheerio from "cheerio";
import { prisma } from "../../config/database";

type BasicSource = {
  sourcePortal: string;
  sourceUrl: string;
  include: string[];
};

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const SOURCES: BasicSource[] = [
  { sourcePortal: "NTS", sourceUrl: "https://www.nts.org.pk/new", include: ["job", "vacancy", "post", "recruit"] },
  { sourcePortal: "FPSC", sourceUrl: "https://www.fpsc.gov.pk/", include: ["advertisement", "job", "vacancy", "post"] },
  { sourcePortal: "PPSC", sourceUrl: "https://www.ppsc.gop.pk/", include: ["jobs", "vacancy", "post"] },
  { sourcePortal: "PTS", sourceUrl: "https://pts.org.pk/", include: ["job", "vacancy", "post"] },
  { sourcePortal: "OTS", sourceUrl: "https://ots.org.pk/", include: ["job", "vacancy", "post"] }
];

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function getAbsoluteUrl(baseUrl: string, href: string) {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return "";
  }
}

function isLikelyGovPosting(text: string, include: string[]) {
  const haystack = normalizeText(text);
  if (!haystack) return false;
  return include.some((token) => haystack.includes(token));
}

async function scrapeSource(source: BasicSource) {
  const response = await axios.get<string>(source.sourceUrl, {
    timeout: 30000,
    headers: {
      "User-Agent": USER_AGENT
    }
  });

  const $ = cheerio.load(response.data);
  const rows = new Map<string, { title: string; url: string }>();

  $("a[href]").each((_index, element) => {
    const title = $(element).text().replace(/\s+/g, " ").trim();
    const href = $(element).attr("href") ?? "";
    const url = getAbsoluteUrl(source.sourceUrl, href);
    if (!url || !title) return;
    if (!isLikelyGovPosting(title, source.include)) return;
    rows.set(url, { title, url });
  });

  return Array.from(rows.values()).slice(0, 80);
}

export async function scrapeAndStoreGovJobs() {
  let inserted = 0;

  for (const source of SOURCES) {
    try {
      const postings = await scrapeSource(source);
      for (const posting of postings) {
        try {
          await prisma.job.upsert({
            where: {
              portalName_externalId: {
                portalName: source.sourcePortal.toLowerCase(),
                externalId: posting.url
              }
            },
            create: {
              portalName: source.sourcePortal.toLowerCase(),
              externalId: posting.url,
              title: posting.title,
              company: source.sourcePortal,
              location: "Pakistan",
              description: posting.title,
              applyUrl: posting.url,
              tags: ["government", source.sourcePortal.toLowerCase()],
              isRemote: false,
              postedAt: new Date()
            },
            update: {
              title: posting.title,
              company: source.sourcePortal,
              description: posting.title,
              applyUrl: posting.url,
              tags: ["government", source.sourcePortal.toLowerCase()],
              isRemote: false,
              scrapedAt: new Date()
            }
          });
          inserted += 1;
        } catch {
          // Keep scraping resilient.
        }
      }
    } catch {
      // Keep scraping resilient across slow portals.
    }
  }

  return { inserted };
}
