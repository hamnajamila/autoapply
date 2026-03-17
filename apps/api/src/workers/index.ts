import { logger } from "../config/logger";
import { scrapeWorker } from "./scrapeWorker";
import { matchWorker } from "./matchWorker";
import { applyWorker } from "./applyWorker";

function bind(workerName: string, w: any) {
  w.on("completed", (job: any) => logger.info(`${workerName} completed`, { id: job.id }));
  w.on("failed", (job: any, err: any) => logger.error(`${workerName} failed`, { id: job?.id, err: err?.message ?? String(err) }));
}

bind("scrape", scrapeWorker);
bind("match", matchWorker);
bind("apply", applyWorker);

logger.info("Workers started");

process.on("SIGINT", async () => {
  logger.info("Shutting down workers...");
  await Promise.all([scrapeWorker.close(), matchWorker.close(), applyWorker.close()].map((p) => p.catch(() => undefined)));
  process.exit(0);
});

