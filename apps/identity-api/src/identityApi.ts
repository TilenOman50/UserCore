import { swaggerUI } from "@hono/swagger-ui";
import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { requestId } from "hono/request-id";

import type { Logger } from "@usercore/logger";
import type { RabbitMQClient } from "@usercore/rabbitmq";
import {
  EVENTS,
  KycCompletedPayload,
  resolveDevCorsOrigin,
} from "@usercore/shared-types";

import type { Database } from "./db/db";
import { createCustomerProfileRepository } from "./features/customerProfile/customerProfileRepository";
import { createCustomerProfileRouter } from "./features/customerProfile/customerProfileRoute";
import { createCustomerProfileService } from "./features/customerProfile/customerProfileService";
import type { ContextVariables } from "./types";

const BASE_PATH = "/identity";

export const createIdentityApi = (props: {
  db: Database;
  logger: Logger;
  rabbitMQ: RabbitMQClient;
}) => {
  const { db, logger, rabbitMQ } = props;

  const customerProfileRepository = createCustomerProfileRepository({
    db,
    logger,
  });
  const customerProfileService = createCustomerProfileService({
    customerProfileRepository,
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
      await customerProfileService.upsertFromKyc({
        customerId: parsed.data.customerId,
        workspaceId: parsed.data.workspaceId,
        kycStatus: parsed.data.status,
        kycSessionId: parsed.data.workflowSessionId,
        riskLevel: parsed.data.riskLevel,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        dateOfBirth: parsed.data.dateOfBirth,
        nationality: parsed.data.nationality,
        country: parsed.data.country,
      });
    },
  });

  const customerProfileRouter = createCustomerProfileRouter({
    customerProfileService,
  });

  const app = new OpenAPIHono<{ Variables: ContextVariables }>();

  app.use("*", requestId());
  app.use(
    "*",
    cors({
      origin: resolveDevCorsOrigin,
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

  return app.route(`${BASE_PATH}`, customerProfileRouter);
};
