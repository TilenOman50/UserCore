import { swaggerUI } from "@hono/swagger-ui";
import { OpenAPIHono } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { cors } from "hono/cors";
import { requestId } from "hono/request-id";

import type { Logger } from "@usercore/logger";
import type { RabbitMQClient } from "@usercore/rabbitmq";

import type { Auth } from "./betterauth";
import { user } from "./db/auth.db";
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

  const workspaceRepository = createWorkspaceRepository({ db, logger });
  const workspaceService = createWorkspaceService({
    workspaceRepository,
    rabbitMQ,
    logger,
  });
  const workspaceRouter = createWorkspaceRouter({ workspaceService });

  const app = new OpenAPIHono<{ Variables: ContextVariables }>();

  app.doc(`${BASE_PATH}/openapi.json`, {
    openapi: "3.0.0",
    info: { version: "1.0.0", title: "UserCore Auth API" },
  });

  app.onError((err, c) => {
    logger.error({ msg: "Unhandled error", error: err });
    return c.json({ error: err.message }, 500);
  });

  return (
    app
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
      // Pre-check: reject OTP requests for unknown emails so the UI can show a
      // helpful error. UserCore is invite-only so enumeration is acceptable.
      .use("/api/auth/email-otp/send-verification-otp", async (c, next) => {
        if (c.req.method !== "POST") return next();
        const body = (await c.req.raw
          .clone()
          .json()
          .catch(() => null)) as {
          email?: string;
        } | null;
        const email = body?.email?.toLowerCase().trim();
        if (email) {
          const existing = await db.query.user.findFirst({
            where: eq(user.email, email),
          });
          if (!existing) {
            return c.json({ message: "No account found with this email" }, 404);
          }
        }
        return next();
      })
      // Better Auth handles all other /api/auth/* routes
      .on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw))
      .route(`${BASE_PATH}`, workspaceRouter)
  );
};

export type AuthApi = ReturnType<typeof createAuthApi>;
