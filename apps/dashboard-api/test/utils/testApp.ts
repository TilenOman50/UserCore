import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

import { createLogger, type Logger } from "@usercore/logger";

import { createDashboardApi } from "../../src/dashboardApi";
import type { Database } from "../../src/db/db";
import * as schema from "../../src/db/schema";

const silentLogger = (): Logger =>
  createLogger({ name: "test", level: "fatal" });

export type TestApp = {
  app: ReturnType<typeof createDashboardApi>;
  db: Database;
  request: (path: string, init?: RequestInit) => Promise<Response>;
  cleanup: () => Promise<void>;
};

export const bootTestApp = async (): Promise<TestApp> => {
  const logger = silentLogger();
  const pglite = new PGlite();
  const db = drizzle(pglite, { schema, logger: false }) as unknown as Database;
  await migrate(drizzle(pglite, { schema, logger: false }), {
    migrationsFolder: "./drizzle",
  });

  const app = createDashboardApi({ db, logger });

  return {
    app,
    db,
    request: async (path, init) => {
      const headers = new Headers(init?.headers);
      if (init?.body && !headers.has("content-type")) {
        headers.set("content-type", "application/json");
      }
      return app.fetch(
        new Request(`http://localhost${path}`, { ...init, headers }),
      );
    },
    cleanup: async () => {
      await pglite.close();
    },
  };
};
