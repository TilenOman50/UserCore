// auth-api in-process harness. Better Auth + the mailer are stubbed since
// most internal endpoints don't need them — the integration tests focus on
// the org-plan lookup (workflows-api consumes this) and DB-driven flows.

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

import { createLogger, type Logger } from "@usercore/logger";

import { createAuthApi } from "../../src/authApi";
import type { Auth } from "../../src/betterauth";
import type { Database } from "../../src/db/db";
import * as schema from "../../src/db/schema";
import type { Mailer } from "../../src/mailer";

const silentLogger = (): Logger =>
  createLogger({ name: "test", level: "fatal" });

// Minimal session shape — what the route handlers actually read out of the
// Better Auth session object. Tests pass one of these to bootTestApp() and
// every request will see it via auth.api.getSession().
export type TestSession = {
  user: { id: string; name?: string; email?: string };
  session: { activeOrganizationId?: string | null };
};

const fakeAuth = (session: TestSession | null): Auth =>
  ({
    api: {
      getSession: async () => session,
    },
    handler: async () => new Response(null, { status: 404 }),
  }) as unknown as Auth;

// Record outgoing mailer calls so invite tests can assert "an email was sent"
// without standing up a real SMTP transport.
export type SentMail =
  | { kind: "invitation"; to: string; workspaceName: string; role: string }
  | { kind: "otp"; to: string; otp: string };

const fakeMailer = (sent: SentMail[]): Mailer =>
  ({
    sendOtpEmail: async (to: string, otp: string) => {
      sent.push({ kind: "otp", to, otp });
    },
    sendInvitationEmail: async (data: {
      to: string;
      workspaceName: string;
      inviterName: string;
      role: string;
    }) => {
      sent.push({
        kind: "invitation",
        to: data.to,
        workspaceName: data.workspaceName,
        role: data.role,
      });
    },
  }) as unknown as Mailer;

// Record rabbit publishes so workspace.deleted / workspace.created tests can
// assert the event made it onto the bus without needing a real broker.
export type PublishedEvent = {
  exchange: string;
  routingKey: string;
  payload: unknown;
};

const fakeRabbit = (published: PublishedEvent[]) => ({
  connect: async () => {},
  publish: async (event: PublishedEvent) => {
    published.push(event);
  },
  subscribe: async () => {},
  shutdown: async () => {},
});

export type TestApp = {
  app: ReturnType<typeof createAuthApi>;
  db: Database;
  request: (path: string, init?: RequestInit) => Promise<Response>;
  cleanup: () => Promise<void>;
  // Mutable handle to the current session — tests can swap callers between
  // assertions without rebooting the whole app.
  setSession: (session: TestSession | null) => void;
  mailer: { sent: SentMail[] };
  rabbit: { published: PublishedEvent[] };
};

export const bootTestApp = async (opts?: {
  session?: TestSession | null;
}): Promise<TestApp> => {
  const logger = silentLogger();
  const pglite = new PGlite();
  const db = drizzle(pglite, { schema, logger: false }) as unknown as Database;
  await migrate(drizzle(pglite, { schema, logger: false }), {
    migrationsFolder: "./drizzle",
  });

  let currentSession: TestSession | null = opts?.session ?? null;
  const auth = {
    api: {
      // Read currentSession lazily so setSession() between requests works.
      getSession: async () => currentSession,
    },
    handler: async () => new Response(null, { status: 404 }),
  } as unknown as Auth;

  const sent: SentMail[] = [];
  const published: PublishedEvent[] = [];

  const app = createAuthApi({
    db,
    logger,
    auth,
    rabbitMQ: fakeRabbit(published),
    mailer: fakeMailer(sent),
  });

  // Re-export fakeAuth so we keep the symbol in scope for future test files
  // that want a totally stateless auth (rather than the mutable one above).
  void fakeAuth;

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
    setSession: (session) => {
      currentSession = session;
    },
    mailer: { sent },
    rabbit: { published },
  };
};
