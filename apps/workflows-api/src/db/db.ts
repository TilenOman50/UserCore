import { PGlite } from "@electric-sql/pglite";
import {
  drizzle as drizzleNode,
  type NodePgDatabase,
} from "drizzle-orm/node-postgres";
import { migrate as migrateNode } from "drizzle-orm/node-postgres/migrator";
import {
  drizzle as drizzlePglite,
  type PgliteDatabase,
} from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { Pool } from "pg";

import type { Logger } from "@usercore/logger";

import { env } from "../env";
import * as schema from "./schema";

// Two drivers: real Postgres for dev + prod, in-memory PGLite for the
// integration test suite. Tests run against the exact same schema and
// migrations as production — no mocked db layer — but in a fresh in-memory
// instance per file. Mirrors the platform's createDB({ type: "pg-lite" }) pattern.
export const createDB = (props: { logger: Logger; type?: "pg-lite" }) => {
  if (props.type === "pg-lite") {
    const client = new PGlite();
    return drizzlePglite(client, { schema, logger: false });
  }
  const pool = new Pool({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_DATABASE,
  });
  return drizzleNode(pool, { schema, logger: false });
};

export type Database =
  | NodePgDatabase<typeof schema>
  | PgliteDatabase<typeof schema>;

export const migrateDB = async (props: {
  db: Database;
  logger: Logger;
  type?: "pg-lite";
}) => {
  const { db, logger, type } = props;
  logger.info({ msg: "Running migrations" });
  if (type === "pg-lite") {
    await migratePglite(db as PgliteDatabase<typeof schema>, {
      migrationsFolder: "./drizzle",
    });
  } else {
    await migrateNode(db as NodePgDatabase<typeof schema>, {
      migrationsFolder: "./drizzle",
    });
  }
  logger.info({ msg: "Migrations done" });
};
