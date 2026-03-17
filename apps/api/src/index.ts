import { createServer } from "node:http";
import { createApp } from "./app";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { AgentScheduler } from "./services/agent/AgentScheduler";

async function main() {
  const app = createApp();
  const server = createServer(app);

  server.listen(env.PORT, () => {
    logger.info("API listening", { port: env.PORT });
  });

  // Scheduler runs in API process to enqueue work based on cron config.
  const scheduler = new AgentScheduler();
  scheduler.start();
}

void main();

