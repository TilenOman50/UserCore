import { createLogger } from "@usercore/logger";
import { createRabbitMQClient } from "@usercore/rabbitmq";

import { createDB, migrateDB } from "./db/db";
import { env } from "./env";
import { createWorkflowsApi } from "./workflowsApi";

const logger = createLogger({ name: "workflows-api", level: env.LOG_LEVEL });
const db = createDB({ logger });
const rabbitMQ = createRabbitMQClient({ url: env.RABBITMQ_URL, logger });

await rabbitMQ.connect();
await migrateDB({ db, logger });

const app = createWorkflowsApi({ db, logger, rabbitMQ });

logger.info({ msg: "Workflows API started", port: 3004 });

export default { port: 3004, fetch: app.fetch };

const gracefulShutdown = async () => {
  logger.info({ msg: "Shutting down workflows-api" });
  await rabbitMQ.shutdown();
  process.exit(0);
};

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);
