import { swaggerUI } from "@hono/swagger-ui";
import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { requestId } from "hono/request-id";

import type { Logger } from "@usercore/logger";
import type { RabbitMQClient } from "@usercore/rabbitmq";
import { EVENTS, KycCompletedPayload } from "@usercore/shared-types";

import type { Database } from "./db/db";
import { createUserProfileRepository } from "./features/userProfile/userProfileRepository";
import { createUserProfileRouter } from "./features/userProfile/userProfileRoute";
import { createUserProfileService } from "./features/userProfile/userProfileService";
import type { ContextVariables } from "./types";

const BASE_PATH = "/identity";

export const createIdentityApi = (props: {
  db: Database;
  logger: Logger;
  rabbitMQ: RabbitMQClient;
}) => {
  const { db, logger, rabbitMQ } = props;

  const userProfileRepository = createUserProfileRepository({ db, logger });
  const userProfileService = createUserProfileService({
    userProfileRepository,
    logger,
  });

  // Listen for KYC completion events to update profile status
  rabbitMQ.subscribe({
    exchange: "usercore.events",
    routingKey: EVENTS.KYC_COMPLETED,
    queue: "identity-api.kyc-completed",
    handler: async (payload) => {
      const parsed = KycCompletedPayload.safeParse(payload);
      if (!parsed.success) return;
      await userProfileService.updateKycStatus({
        userId: parsed.data.userId,
        kycStatus: parsed.data.status,
        kycSessionId: parsed.data.kycSessionId,
      });
    },
  });

  const userProfileRouter = createUserProfileRouter({ userProfileService });

  const app = new OpenAPIHono<{ Variables: ContextVariables }>();

  app.use("*", requestId());
  app.use(
    "*",
    cors({
      origin: ["http://localhost:3000", "http://localhost:3007"],
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization"],
      credentials: true,
    }),
  );
  app.use("*", async (c, next) => {
    c.set("db", db);
    c.set("logger", logger);
    await next();
  });

  app.get("/health", (c) => c.text("OK"));
  app.get(`${BASE_PATH}/doc`, swaggerUI({ url: `${BASE_PATH}/openapi.json` }));

  app.doc(`${BASE_PATH}/openapi.json`, {
    openapi: "3.0.0",
    info: { version: "1.0.0", title: "UserCore Identity API" },
  });

  app.onError((err, c) => {
    logger.error({ msg: "Unhandled error", error: err });
    return c.json({ error: err.message }, 500);
  });

  return app.route(`${BASE_PATH}`, userProfileRouter);
};
