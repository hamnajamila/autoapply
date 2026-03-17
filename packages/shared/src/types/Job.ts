export type JobListing = {
  portalName: string;
  externalId: string;
  title: string;
  company: string;
  companyLogoUrl?: string | null;
  location?: string | null;
  description: string;
  applyUrl: string;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: string | null;
  jobType?: string | null;
  tags: string[];
  isRemote: boolean;
  postedAt?: string | null;
};

