import { createLogger } from "@usercore/logger";
import { createRabbitMQClient } from "@usercore/rabbitmq";

import { env } from "./env";
import { createProvidersApi } from "./providersApi";

const logger = createLogger({ name: "providers-api", level: env.LOG_LEVEL });
const rabbitMQ = createRabbitMQClient({ url: env.RABBITMQ_URL, logger });

await rabbitMQ.connect();

const app = await createProvidersApi({ logger, rabbitMQ });

logger.info({ msg: "Providers API started", port: 3008 });

export default { port: 3008, fetch: app.fetch };

const gracefulShutdown = async () => {
  logger.info({ msg: "Shutting down providers-api" });
  await rabbitMQ.shutdown();
  process.exit(0);
};

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);
