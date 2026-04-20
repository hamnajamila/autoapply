import { z } from "zod";

export const UserProfileExperienceSchema = z.object({
  company: z.string().min(1),
  title: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.union([z.literal("Present"), z.string().min(1)]),
  description: z.string().default(""),
  achievements: z.array(z.string()).default([])
});

export const UserProfileEducationSchema = z.object({
  institution: z.string().min(1),
  degree: z.string().min(1),
  field: z.string().min(1),
  graduationYear: z.string().min(1)
});

export const UserProfileSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1).optional(),
  location: z.string().min(1).optional(),
  summary: z.string().min(1),
  skills: z.array(z.string()).default([]),
  extractedKeywords: z.array(z.string()).default([]).optional(),
  targetJobKeywords: z.array(z.string()).default([]).optional(),
  experience: z.array(UserProfileExperienceSchema).default([]),
  education: z.array(UserProfileEducationSchema).default([]),
  certifications: z.array(z.string()).default([]),
  languages: z.array(z.string()).default([]),
  portfolioUrl: z.string().url().optional(),
  linkedinUrl: z.string().url().optional(),
  githubUrl: z.string().url().optional()
});

export type UserProfileInput = z.infer<typeof UserProfileSchema>;

export const RegisterSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8)
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export const UpdateProfileSchema = z.object({
  profile: UserProfileSchema.partial().optional(),
  preferences: z.record(z.any()).optional(),
  matchThreshold: z.number().int().min(0).max(100).optional(),
  agentSchedule: z.string().min(1).optional(),
  emailNotifications: z.boolean().optional()
});

