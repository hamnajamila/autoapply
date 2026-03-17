import Redis from "ioredis";
import { env } from "./env";

declare global {
  // eslint-disable-next-line no-var
  var __redis: Redis | undefined;
}

export const redis: Redis =
  global.__redis ??
  (env.NODE_ENV === "test"
    ? (({
        on: () => undefined,
        quit: async () => undefined,
        disconnect: () => undefined
      }) as unknown as Redis)
    : new Redis(env.REDIS_URL, {
        maxRetriesPerRequest: null,
        enableReadyCheck: true,
        lazyConnect: false
      }));

if (env.NODE_ENV !== "production") {
  global.__redis = redis;
}

