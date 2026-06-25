// In-process scenarios-api harness. RabbitMQ is replaced with a fake that
// records publishes so a test can assert which events the system reacted to.
//
// PGLite is instantiated directly (not through createDB) so we can call
// `pglite.close()` on cleanup — bun's runner exits with 99 if PGLite's
// worker pool is still alive.

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

import { createLogger, type Logger } from "@usercore/logger";

import type { Database } from "../../src/db/db";
import * as schema from "../../src/db/schema";
import { createScenariosApi } from "../../src/scenariosApi";

const silentLogger = (): Logger =>
  createLogger({ name: "test", level: "fatal" });

export type FakeRabbit = {
  connect: () => Promise<void>;
  publish: (event: {
    exchange: string;
    routingKey: string;
    payload: unknown;
  }) => Promise<void>;
  subscribe: (props: {
    exchange: string;
    routingKey: string;
    queue: string;
    handler: (payload: unknown) => Promise<void>;
  }) => Promise<void>;
  shutdown: () => Promise<void>;
  published: { exchange: string; routingKey: string; payload: unknown }[];
};

const createFakeRabbit = (): FakeRabbit => {
  const published: FakeRabbit["published"] = [];
  return {
    connect: async () => {},
    publish: async (event) => {
      published.push(event);
    },
    subscribe: async () => {},
    shutdown: async () => {},
    published,
  };
};

export type TestApp = {
  app: ReturnType<typeof createScenariosApi>;
  db: Database;
  rabbit: FakeRabbit;
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

  const rabbit = createFakeRabbit();
  const app = createScenariosApi({ db, logger, rabbitMQ: rabbit });

  return {
    app,
    db,
    rabbit,
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
