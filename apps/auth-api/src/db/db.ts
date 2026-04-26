import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

import type { Logger } from "@usercore/logger";

import { env } from "../env";
import * as schema from "./schema";

export const createDB = (_props: { logger: Logger }) => {
  const pool = new Pool({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_DATABASE,
  });

  return drizzle(pool, { schema, logger: false });
};

export const migrateDB = async (props: { db: Database; logger: Logger }) => {
  const { db, logger } = props;
  logger.info({ msg: "Running migrations" });
  await migrate(db, { migrationsFolder: "./drizzle" });
  logger.info({ msg: "Migrations done" });
};

export type Database = ReturnType<typeof createDB>;
