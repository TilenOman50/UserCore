import { createLogger } from "@usercore/logger";

import { createDB, migrateDB } from "../src/db/db";
import { env } from "../src/env";

const logger = createLogger({ name: "scenarios-api-migrate", level: env.LOG_LEVEL });
const db = createDB({ logger });
await migrateDB({ db, logger });
process.exit(0);
