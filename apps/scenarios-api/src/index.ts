import { createLogger } from "@usercore/logger";
import { createRabbitMQClient } from "@usercore/rabbitmq";

import { createDB, migrateDB } from "./db/db";
import { env } from "./env";
import { createScenariosApi } from "./scenariosApi";

const logger = createLogger({ name: "scenarios-api", level: env.LOG_LEVEL });
const db = createDB({ logger });
const rabbitMQ = createRabbitMQClient({ url: env.RABBITMQ_URL, logger });

await rabbitMQ.connect();
await migrateDB({ db, logger });

const app = createScenariosApi({ db, logger, rabbitMQ });

logger.info({ msg: "Scenarios API started", port: 3005 });

export default { port: 3005, fetch: app.fetch };

const gracefulShutdown = async () => {
  logger.info({ msg: "Shutting down scenarios-api" });
  await rabbitMQ.shutdown();
  process.exit(0);
};

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);
