import { createLogger } from "@usercore/logger";

import { createAuthApi } from "./authApi";
import { createAuth } from "./betterauth";
import { createClients } from "./clients";
import { createDB, migrateDB } from "./db/db";
import { env } from "./env";
import { createMailer } from "./mailer";

const logger = createLogger({ name: "auth-api", level: env.LOG_LEVEL });

const initializeApp = async () => {
  const db = createDB({ logger });
  const { rabbitMQ } = createClients({ logger });
  const mailer = createMailer({ logger });

  // Connect to RabbitMQ
  await rabbitMQ.connect();

  // Run DB migrations
  await migrateDB({ db, logger });

  // Create Better Auth instance
  const auth = createAuth({ db, mailer });

  // Create Hono app
  const app = createAuthApi({ db, logger, auth, rabbitMQ });

  logger.info({ msg: "Auth API started", port: 3001 });

  return { app, rabbitMQ };
};

const { app, rabbitMQ } = await initializeApp();

export default {
  port: 3001,
  fetch: app.fetch,
};

const gracefulShutdown = async () => {
  logger.info({ msg: "Shutting down auth-api" });
  await rabbitMQ.shutdown();
  process.exit(0);
};

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);
