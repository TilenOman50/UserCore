import { swaggerUI } from "@hono/swagger-ui";
import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { requestId } from "hono/request-id";

import type { Logger } from "@usercore/logger";
import type { RabbitMQClient } from "@usercore/rabbitmq";

import type { Auth } from "./betterauth";
import type { Database } from "./db/db";
import { createWorkspaceRepository } from "./features/workspace/workspaceRepository";
import { createWorkspaceRouter } from "./features/workspace/workspaceRoute";
import { createWorkspaceService } from "./features/workspace/workspaceService";
import { createRequestMiddleware } from "./middlewares/requestMiddleware";
import type { ContextVariables } from "./types";

const BASE_PATH = "/auth";

export const createAuthApi = (props: {
  db: Database;
  logger: Logger;
  auth: Auth;
  rabbitMQ: RabbitMQClient;
}) => {
  const { db, logger, auth, rabbitMQ } = props;

  // Repositories
  const workspaceRepository = createWorkspaceRepository({ db, logger });

  // Services
  const workspaceService = createWorkspaceService({
    workspaceRepository,
    rabbitMQ,
    logger,
  });

  // Routers
  const workspaceRouter = createWorkspaceRouter({ workspaceService });

  const app = new OpenAPIHono<{ Variables: ContextVariables }>()
    .use("*", requestId())
    .use(
      "*",
      cors({
        origin: ["http://localhost:3000", "http://localhost:3007"],
        allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowHeaders: ["Content-Type", "Authorization"],
        credentials: true,
      }),
    )
    .use("*", createRequestMiddleware({ db, logger }))
    .get("/health", (c) => c.text("OK"))
    .get(`${BASE_PATH}/doc`, swaggerUI({ url: `${BASE_PATH}/openapi.json` }))
    // Better Auth handles all /api/auth/* routes
    .on(["GET", "POST"], "/api/auth/**", (c) => auth.handler(c.req.raw))
    .route(`${BASE_PATH}`, workspaceRouter)
    .doc(`${BASE_PATH}/openapi.json`, {
      openapi: "3.0.0",
      info: { version: "1.0.0", title: "UserCore Auth API" },
    })
    .onError((err, c) => {
      logger.error({ msg: "Unhandled error", error: err });
      return c.json({ error: err.message }, 500);
    });

  return app;
};

export type AuthApi = ReturnType<typeof createAuthApi>;
