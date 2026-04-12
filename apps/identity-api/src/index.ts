import { createLogger } from "@usercore/logger";
import { createRabbitMQClient } from "@usercore/rabbitmq";

import { createDB, migrateDB } from "./db/db";
import { env } from "./env";
import { createIdentityApi } from "./identityApi";

const logger = createLogger({ name: "identity-api", level: env.LOG_LEVEL });
const db = createDB({ logger });
const rabbitMQ = createRabbitMQClient({ url: env.RABBITMQ_URL, logger });

await rabbitMQ.connect();
await migrateDB({ db, logger });

const app = createIdentityApi({ db, logger, rabbitMQ });

logger.info({ msg: "Identity API started", port: 3003 });

export default { port: 3003, fetch: app.fetch };

const gracefulShutdown = async () => {
  logger.info({ msg: "Shutting down identity-api" });
  await rabbitMQ.shutdown();
  process.exit(0);
};

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);
