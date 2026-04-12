import { swaggerUI } from "@hono/swagger-ui";
import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { requestId } from "hono/request-id";

import type { Logger } from "@usercore/logger";
import type { RabbitMQClient } from "@usercore/rabbitmq";
import { EVENTS, WorkspaceCreatedPayload } from "@usercore/shared-types";

import type { Database } from "./db/db";
import { WorkspaceSettingsTable } from "./db/schema.db";
import { createAuditLogRepository } from "./features/auditLog/auditLogRepository";
import { createWorkspaceRepository } from "./features/workspace/workspaceRepository";
import { createWorkspaceRouter } from "./features/workspace/workspaceRoute";
import { createWorkspaceService } from "./features/workspace/workspaceService";
import type { ContextVariables } from "./types";

const BASE_PATH = "/tms";

export const createTmsApi = (props: {
  db: Database;
  logger: Logger;
  rabbitMQ: RabbitMQClient;
}) => {
  const { db, logger, rabbitMQ } = props;

  // Subscribe to workspace.created event — create default settings
  rabbitMQ.subscribe({
    exchange: "usercore.events",
    routingKey: EVENTS.WORKSPACE_CREATED,
    queue: "tms-api.workspace-created",
    handler: async (payload) => {
      const parsed = WorkspaceCreatedPayload.safeParse(payload);
      if (!parsed.success) return;
      await db.insert(WorkspaceSettingsTable).values({
        workspaceId: parsed.data.workspaceId,
        displayName: parsed.data.name,
        primaryColor: "#C0E1D2",
      }).onConflictDoNothing();
      logger.info({ msg: "Workspace settings initialized", workspaceId: parsed.data.workspaceId });
    },
  });

  const workspaceRepository = createWorkspaceRepository({ db, logger });
  const auditLogRepository = createAuditLogRepository({ db, logger });
  const workspaceService = createWorkspaceService({ workspaceRepository, logger });
  const workspaceRouter = createWorkspaceRouter({ workspaceService });

  const app = new OpenAPIHono<{ Variables: ContextVariables }>()
    .use("*", requestId())
    .use("*", cors({
      origin: ["http://localhost:3000"],
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization"],
      credentials: true,
    }))
    .use("*", async (c, next) => {
      c.set("db", db);
      c.set("logger", logger);
      await next();
    })
    .get("/health", (c) => c.text("OK"))
    .get(`${BASE_PATH}/doc`, swaggerUI({ url: `${BASE_PATH}/openapi.json` }))
    .route(`${BASE_PATH}`, workspaceRouter)
    .doc(`${BASE_PATH}/openapi.json`, {
      openapi: "3.0.0",
      info: { version: "1.0.0", title: "UserCore TMS API" },
    })
    .onError((err, c) => {
      logger.error({ msg: "Unhandled error", error: err });
      return c.json({ error: err.message }, 500);
    });

  // Suppress unused warning
  void auditLogRepository;

  return app;
};
