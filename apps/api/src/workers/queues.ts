import { Queue } from "bullmq";
import { env } from "../config/env";
import { redis } from "../config/redis";

export type ScrapeJobData = { userId: string; portalName: string };
export type MatchJobData = { userId: string; jobId: string };
export type ApplyJobData = { userId: string; applicationId: string };

const isTest = env.NODE_ENV === "test";
const connection = redis as any;

type MinimalQueue<T> = {
  add: (name: string, data: T, opts?: any) => Promise<unknown>;
};

function makeNoopQueue<T>(): MinimalQueue<T> {
  return {
    add: async () => undefined
  };
}

export const scrapeQueue: MinimalQueue<ScrapeJobData> = isTest
  ? makeNoopQueue<ScrapeJobData>()
  : new Queue<ScrapeJobData>("scrape-queue", {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: 1000,
        removeOnFail: 5000
      }
    });

export const matchQueue: MinimalQueue<MatchJobData> = isTest
  ? makeNoopQueue<MatchJobData>()
  : new Queue<MatchJobData>("match-queue", {
      connection,
      defaultJobOptions: {
        attempts: 4,
        backoff: { type: "exponential", delay: 1500 },
        removeOnComplete: 5000,
        removeOnFail: 10000
      }
    });

export const applyQueue: MinimalQueue<ApplyJobData> = isTest
  ? makeNoopQueue<ApplyJobData>()
  : new Queue<ApplyJobData>("apply-queue", {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 3000 },
        removeOnComplete: 2000,
        removeOnFail: 5000
      }
    });

export async function enqueueScrape(data: ScrapeJobData) {
  await scrapeQueue.add(`scrape:${data.userId}:${data.portalName}`, data, {
    jobId: `scrape:${data.userId}:${data.portalName}`
  });
}

export async function enqueueMatch(data: MatchJobData) {
  await matchQueue.add(`match:${data.userId}:${data.jobId}`, data, {
    jobId: `match:${data.userId}:${data.jobId}`
  });
}

export async function enqueueApply(data: ApplyJobData) {
  await applyQueue.add(`apply:${data.userId}:${data.applicationId}`, data, {
    jobId: `apply:${data.userId}:${data.applicationId}`
  });
}

