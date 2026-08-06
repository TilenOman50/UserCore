// Test harness: boots workflows-api in-process against an in-memory PGLite
// database, with a fake RabbitMQ client and a stubbed plan client (no
// auth-api round-trip). `createWorkflowsApi` is the same factory production
// uses, just fed test-grade dependencies.
//
// We instantiate PGLite + the drizzle wrapper directly here (instead of via
// createDB) so the test can `close()` the pglite worker pool on cleanup.
// Without that explicit close, bun's test runner sees lingering async
// resources and exits with 99 even though every assertion passed.

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

import { createLogger, type Logger } from "@usercore/logger";
import type { Plan } from "@usercore/shared-types";

import type { Database } from "../../src/db/db";
import * as schema from "../../src/db/schema";
import type { Mailer } from "../../src/features/emailVerification/mailer";
import type { StorageService } from "../../src/storage/storageService";
import { createWorkflowsApi } from "../../src/workflowsApi";

const silentLogger = (): Logger =>
  createLogger({ name: "test", level: "fatal" });

// Records of published RabbitMQ events for assertions. A test can assert
// against `rabbit.published` after exercising the route.
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

// Records every mailer invocation so tests can assert that an email was sent
// with the right OTP / locale / brand. Inject this into createWorkflowsApi
// instead of the real nodemailer-backed Mailer so tests never open an SMTP
// socket. Mirrors the FakeRabbit pattern above — list of calls plus the
// stub functions populated on demand.
export type FakeMailer = Mailer & {
  verificationOtpCalls: Array<
    Parameters<Mailer["sendVerificationOtp"]>[0]
  >;
  resubmissionCalls: Array<Parameters<Mailer["sendResubmissionRequest"]>[0]>;
  decisionCalls: Array<Parameters<Mailer["sendDecisionNotice"]>[0]>;
};

const createFakeMailer = (): FakeMailer => {
  const verificationOtpCalls: FakeMailer["verificationOtpCalls"] = [];
  const resubmissionCalls: FakeMailer["resubmissionCalls"] = [];
  const decisionCalls: FakeMailer["decisionCalls"] = [];
  return {
    sendVerificationOtp: async (data) => {
      verificationOtpCalls.push(data);
    },
    sendResubmissionRequest: async (data) => {
      resubmissionCalls.push(data);
    },
    sendDecisionNotice: async (data) => {
      decisionCalls.push(data);
    },
    verificationOtpCalls,
    resubmissionCalls,
    decisionCalls,
  };
};

// No-op storage service so the branding-logo upload route can be exercised
// without standing up MinIO. uploadFile / getObject return enough shape for
// the routes to succeed; tests inspect uploadedKeys to confirm the route
// reached storage.
export type FakeStorage = StorageService & {
  uploadedKeys: string[];
  objects: Map<string, { body: Uint8Array; contentType: string }>;
};

const createFakeStorage = (): FakeStorage => {
  const uploadedKeys: string[] = [];
  const objects = new Map<
    string,
    { body: Uint8Array; contentType: string }
  >();
  return {
    uploadFile: async ({ key, body, mimeType }) => {
      uploadedKeys.push(key);
      objects.set(key, {
        body: body instanceof Uint8Array ? body : new Uint8Array(body),
        contentType: mimeType,
      });
      return key;
    },
    headFile: async (key) => {
      const obj = objects.get(key);
      return {
        contentType: obj?.contentType ?? null,
        size: obj ? obj.body.byteLength : null,
      };
    },
    getSignedDownloadUrl: async (key) =>
      `http://fake-storage.local/${encodeURIComponent(key)}`,
    getObject: async (key) => {
      const obj = objects.get(key);
      if (!obj) return null;
      return { body: obj.body, contentType: obj.contentType };
    },
    uploadedKeys,
    objects,
  };
};

export type PlanStub = {
  plan: Plan;
  members?: number;
  workspaces?: number;
};

// Default plan stub: GROWTH org with one workspace. Per-test override via
// `setPlan()` returned from `bootTestApp`.
const defaultPlan = (): PlanStub => ({
  plan: "GROWTH",
  members: 1,
  workspaces: 1,
});

// Hijacks global fetch so the workflows-api's internal plan client (which
// calls auth-api's /auth/internal/organizations endpoint) gets a static
// response. Only intercepts the plan-lookup URL; everything else falls
// through to the real fetch.
const installFetchStub = (organizationId: string, getPlan: () => PlanStub) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes(`/auth/internal/organizations/`)) {
      const { plan, members = 1, workspaces = 1 } = getPlan();
      return new Response(
        JSON.stringify({
          id: organizationId,
          name: "Test Organization",
          plan,
          counts: { members, workspaces },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    return originalFetch(input, init);
  }) as typeof fetch;
  return () => {
    globalThis.fetch = originalFetch;
  };
};

export type TestApp = {
  app: Awaited<ReturnType<typeof createWorkflowsApi>>;
  db: Database;
  rabbit: FakeRabbit;
  mailer: FakeMailer;
  storage: FakeStorage;
  setPlan: (next: PlanStub) => void;
  // Convenience: invokes app.fetch with a path under /workflows + headers
  // already wired. Saves boilerplate inside tests.
  request: (
    path: string,
    init?: RequestInit & { apiKey?: string },
  ) => Promise<Response>;
  cleanup: () => Promise<void>;
};

export const bootTestApp = async (
  opts?: { organizationId?: string },
): Promise<TestApp> => {
  const logger = silentLogger();
  const pglite = new PGlite();
  const db = drizzle(pglite, { schema, logger: false }) as unknown as Database;
  await migrate(drizzle(pglite, { schema, logger: false }), {
    migrationsFolder: "./drizzle",
  });

  const rabbit = createFakeRabbit();
  const mailer = createFakeMailer();
  const storage = createFakeStorage();
  const orgId = opts?.organizationId ?? "org_test";
  let planStub = defaultPlan();
  const restoreFetch = installFetchStub(orgId, () => planStub);

  const app = await createWorkflowsApi({
    db,
    logger,
    rabbitMQ: rabbit,
    mailer,
    storageService: storage,
  });

  return {
    app,
    db,
    rabbit,
    mailer,
    storage,
    setPlan: (next) => {
      planStub = next;
    },
    request: async (path, init) => {
      const headers = new Headers(init?.headers);
      if (init?.apiKey) headers.set("Authorization", `Bearer ${init.apiKey}`);
      if (init?.body && !headers.has("content-type")) {
        headers.set("content-type", "application/json");
      }
      return app.fetch(
        new Request(`http://localhost${path}`, { ...init, headers }),
      );
    },
    cleanup: async () => {
      restoreFetch();
      await pglite.close();
    },
  };
};
