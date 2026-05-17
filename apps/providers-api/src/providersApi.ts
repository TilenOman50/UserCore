import { swaggerUI } from "@hono/swagger-ui";
import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { requestId } from "hono/request-id";

import type { Logger } from "@usercore/logger";
import type { RabbitMQClient } from "@usercore/rabbitmq";
import { resolveDevCorsOrigin } from "@usercore/shared-types";

import { env } from "./env";
import { createComplyAdvantageClient } from "./features/complyAdvantage/complyAdvantageClient";
import { registerProviderDispatcher } from "./features/dispatcher/dispatcherService";
import { createIdenfyClient } from "./features/idenfy/idenfyClient";
import { createIdenfySessionRouter } from "./features/idenfy/idenfySessionRoute";
import { createIdenfyWebhookRouter } from "./features/idenfy/idenfyWebhookRoute";
import { createIpQualityScoreClient } from "./features/ipQualityScore/ipQualityScoreClient";
import type { ContextVariables } from "./types";

const BASE_PATH = "/providers";

export const createProvidersApi = async (props: {
  logger: Logger;
  rabbitMQ: RabbitMQClient;
}) => {
  const { logger, rabbitMQ } = props;

  // Provider clients
  const idenfyClient = createIdenfyClient({ env, logger });
  const complyAdvantageClient = createComplyAdvantageClient({ env, logger });
  const ipQualityScoreClient = createIpQualityScoreClient({ env, logger });

  // Wire the AML / fraud event dispatcher
  await registerProviderDispatcher({
    rabbitMQ,
    complyAdvantageClient,
    ipQualityScoreClient,
    logger,
  });

  // Routers
  const idenfySessionRouter = createIdenfySessionRouter({
    idenfyClient,
    logger,
  });
  const idenfyWebhookRouter = createIdenfyWebhookRouter({
    rabbitMQ,
    webhookSecret: env.IDENFY_WEBHOOK_SECRET,
    logger,
  });

  const app = new OpenAPIHono<{ Variables: ContextVariables }>();

  app.use("*", requestId());
  app.use(
    "*",
    cors({
      origin: resolveDevCorsOrigin,
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders: [
        "Content-Type",
        "Authorization",
        "ngrok-skip-browser-warning",
      ],
      credentials: true,
    }),
  );
  app.use("*", async (c, next) => {
    c.set("logger", logger);
    await next();
  });

  app.get("/health", (c) => c.text("OK"));
  app.get(`${BASE_PATH}/doc`, swaggerUI({ url: `${BASE_PATH}/openapi.json` }));

  app.doc(`${BASE_PATH}/openapi.json`, {
    openapi: "3.0.0",
    info: { version: "1.0.0", title: "UserCore Providers API" },
  });

  app.onError((err, c) => {
    logger.error({ msg: "Unhandled error", error: err });
    return c.json({ error: err.message }, 500);
  });

  return app.route("/", idenfyWebhookRouter).route("/", idenfySessionRouter);
};
