export type UserProfileExperience = {
  company: string;
  title: string;
  startDate: string;
  endDate: string | "Present";
  description: string;
  achievements: string[];
};

export type UserProfileEducation = {
  institution: string;
  degree: string;
  field: string;
  graduationYear: string;
};

export type UserProfile = {
  name: string;
  email: string;
  phone?: string | undefined;
  location?: string | undefined;
  summary: string;
  skills: string[];
  experience: UserProfileExperience[];
  education: UserProfileEducation[];
  certifications: string[];
  languages: string[];
  portfolioUrl?: string | undefined;
  linkedinUrl?: string | undefined;
  githubUrl?: string | undefined;
};

export type UserPreferences = {
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: string | null;
  jobTypes?: string[] | undefined;
  blockedCompanies?: string[] | undefined;
  remoteOnly?: boolean | undefined;
  scheduleCron?: string | undefined;
  maxApplicationsPerRun?: number | undefined;
};

