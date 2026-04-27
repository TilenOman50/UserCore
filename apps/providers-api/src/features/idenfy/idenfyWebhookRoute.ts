import { createHmac, timingSafeEqual } from "node:crypto";
import { OpenAPIHono } from "@hono/zod-openapi";

import type { Logger } from "@usercore/logger";
import type { RabbitMQClient } from "@usercore/rabbitmq";
import {
  PROVIDER_EVENTS,
  type ProviderCheckCompletedPayload,
} from "@usercore/shared-types";

import type { ContextVariables } from "../../types";
import {
  IdenfyWebhookPayload,
  mapIdenfyOverallStatus,
  mapIdenfyToAttributes,
} from "./idenfyWebhookMapper";

const verifySignature = (props: {
  rawBody: string;
  signatureHeader: string | null;
  secret: string;
}): boolean => {
  if (!props.signatureHeader) return false;
  const expected = createHmac("sha256", props.secret)
    .update(props.rawBody)
    .digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(props.signatureHeader);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
};

export const createIdenfyWebhookRouter = (props: {
  rabbitMQ: RabbitMQClient;
  webhookSecret: string | undefined;
  logger: Logger;
}) => {
  const { rabbitMQ, webhookSecret, logger } = props;

  const app = new OpenAPIHono<{ Variables: ContextVariables }>();

  app.post("/webhooks/idenfy", async (c) => {
    const rawBody = await c.req.text();

    if (webhookSecret) {
      const ok = verifySignature({
        rawBody,
        signatureHeader: c.req.header("idenfy-signature") ?? null,
        secret: webhookSecret,
      });
      if (!ok) {
        logger.warn({ msg: "iDenfy webhook signature mismatch" });
        return c.json({ error: "Invalid signature" }, 401);
      }
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawBody);
    } catch {
      return c.json({ error: "Invalid JSON" }, 400);
    }
    const result = IdenfyWebhookPayload.safeParse(parsedJson);
    if (!result.success) {
      logger.warn({
        msg: "iDenfy webhook payload validation failed",
        error: result.error.message,
      });
      return c.json({ error: "Invalid payload" }, 400);
    }
    const payload = result.data;

    // The clientId we send to iDenfy when starting a session is the workflow
    // session id, so the callback identifies its UserCore session directly.
    const status = mapIdenfyOverallStatus(payload.status?.overall);
    const completed: ProviderCheckCompletedPayload = {
      workflowSessionId: payload.clientId,
      workflowStepType: "identity-verification",
      providerShortName: "idenfy",
      status,
      message: payload.status?.suspicionReasons?.join(", "),
      rawPayload: payload as unknown as Record<string, unknown>,
    };
    await rabbitMQ.publish({
      exchange: "usercore.events",
      routingKey: PROVIDER_EVENTS.CHECK_COMPLETED,
      payload: completed,
    });
    logger.info({
      msg: "Forwarded iDenfy webhook to providers.check.completed",
      scanRef: payload.scanRef,
      status,
    });

    return c.json({ ok: true }, 200);
  });

  return app;
};

// Re-export for the dispatcher: the same mapping logic is used to flatten the
// raw payload server-side after workflows-api consumes the completed event.
export { mapIdenfyToAttributes };
