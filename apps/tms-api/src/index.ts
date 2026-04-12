import { createLogger } from "@usercore/logger";
import { createRabbitMQClient } from "@usercore/rabbitmq";

import { createDB, migrateDB } from "./db/db";
import { env } from "./env";
import { createTmsApi } from "./tmsApi";

const logger = createLogger({ name: "tms-api", level: env.LOG_LEVEL });
const db = createDB({ logger });
const rabbitMQ = createRabbitMQClient({ url: env.RABBITMQ_URL, logger });

await rabbitMQ.connect();
await migrateDB({ db, logger });

const app = createTmsApi({ db, logger, rabbitMQ });

logger.info({ msg: "TMS API started", port: 3002 });

export default { port: 3002, fetch: app.fetch };

const gracefulShutdown = async () => {
  logger.info({ msg: "Shutting down tms-api" });
  await rabbitMQ.shutdown();
  process.exit(0);
};

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);
