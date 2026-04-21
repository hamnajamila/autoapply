import type { UserProfile } from "@autoapply/shared";
import { filterRelevantListings, scoreListingRelevance } from "../services/llm/resumeKeywords";
import { inferYouthOpportunityType, isLikelyGovernmentListing, isLikelyYouthListing } from "../utils/jobClassification";

const softwareProfile: UserProfile = {
  name: "Ayesha Khan",
  email: "ayesha@example.com",
  summary: "Backend engineer building Node.js, TypeScript and API-driven systems for web products.",
  skills: ["Node.js", "TypeScript", "PostgreSQL", "REST APIs", "React"],
  targetJobKeywords: ["backend engineer", "software engineer", "typescript", "node.js", "api"],
  extractedKeywords: ["backend engineer", "typescript", "node.js", "postgresql", "api"],
  experience: [
    {
      company: "Acme",
      title: "Backend Engineer",
      startDate: "2022-01",
      endDate: "Present",
      description: "Built APIs and backend services with Node.js and TypeScript.",
      achievements: ["Shipped production APIs", "Scaled PostgreSQL workloads"]
    }
  ],
  education: [
    {
      institution: "FAST",
      degree: "BS Computer Science",
      field: "Computer Science",
      graduationYear: "2021"
    }
  ],
  certifications: [],
  languages: ["English"]
};

test("resume relevance strongly favors matching field and rejects unrelated roles", () => {
  const matchingScore = scoreListingRelevance(
    {
      title: "Senior Backend Engineer",
      company: "Remote Systems",
      location: "Remote",
      description: "Build Node.js APIs, TypeScript services and PostgreSQL-backed products.",
      tags: ["typescript", "node.js", "api", "backend"]
    },
    softwareProfile
  );

  const unrelatedScore = scoreListingRelevance(
    {
      title: "Clinical Nurse",
      company: "City Hospital",
      location: "Lahore",
      description: "Provide patient care, clinical support and ward coordination.",
      tags: ["healthcare", "nursing"]
    },
    softwareProfile
  );

  expect(matchingScore).toBeGreaterThanOrEqual(18);
  expect(unrelatedScore).toBe(0);
});

test("filterRelevantListings keeps only resume-relevant openings", () => {
  const ranked = filterRelevantListings(
    [
      {
        title: "Backend Engineer",
        company: "API Labs",
        location: "Remote",
        description: "Node.js and TypeScript services.",
        tags: ["node.js", "typescript", "backend"]
      },
      {
        title: "Marketing Manager",
        company: "Growth Hub",
        location: "Remote",
        description: "SEO, campaigns and paid acquisition.",
        tags: ["marketing", "seo"]
      }
    ],
    softwareProfile,
    12
  );

  expect(ranked).toHaveLength(1);
  expect(ranked[0]?.title).toBe("Backend Engineer");
});

test("government classification excludes regular commercial jobs", () => {
  expect(
    isLikelyGovernmentListing({
      portalName: "ppsc",
      title: "Punjab Agriculture Department BPS-17 Officer",
      company: "PPSC",
      description: "Government of Punjab department post with BPS-17 scale.",
      tags: ["government", "ppsc"]
    })
  ).toBe(true);

  expect(
    isLikelyGovernmentListing({
      portalName: "rozee",
      title: "Product Manager",
      company: "Private Startup",
      description: "Commercial SaaS role for a private company.",
      tags: ["product", "saas"]
    })
  ).toBe(false);
});

test("youth classification keeps youth opportunities and labels type correctly", () => {
  const internship = {
    portalName: "remotive",
    title: "Software Engineering Internship",
    company: "Remote Labs",
    description: "Remote internship for early-career engineers.",
    tags: ["internship", "graduate"]
  };

  const governmentRole = {
    portalName: "nts",
    title: "Junior Clerk BPS-11",
    company: "National Testing Service",
    description: "Government test service vacancy.",
    tags: ["government", "nts"]
  };

  expect(isLikelyYouthListing(internship)).toBe(true);
  expect(inferYouthOpportunityType(internship)).toBe("internship");
  expect(isLikelyYouthListing(governmentRole)).toBe(false);
});
