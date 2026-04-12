import { createLogger } from "@usercore/logger";

import { createDashboardApi } from "./dashboardApi";
import { createDB, migrateDB } from "./db/db";
import { env } from "./env";

const logger = createLogger({ name: "dashboard-api", level: env.LOG_LEVEL });
const db = createDB({ logger });

await migrateDB({ db, logger });

const app = createDashboardApi({ db, logger });

logger.info({ msg: "Dashboard API started", port: 3006 });

export default { port: 3006, fetch: app.fetch };

const gracefulShutdown = () => {
  logger.info({ msg: "Shutting down dashboard-api" });
  process.exit(0);
};

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);
