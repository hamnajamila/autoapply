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
  const results = await Promise.allSettled([
    scrapeWorker.close(),
    matchWorker.close(),
    applyWorker.close()
  ]);
  results.forEach((result, index) => {
    const names = ["scrape", "match", "apply"];
    if (result.status === "rejected") {
      logger.error(`Failed to close ${names[index]} worker`, { error: result.reason });
    }
  });
  process.exit(0);
});

