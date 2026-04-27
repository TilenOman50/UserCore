import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

import type { Logger } from "@usercore/logger";

import type { ContextVariables } from "../../types";
import type { IdenfyClient } from "./idenfyClient";

const StartSessionInputSchema = z.object({
  workflowSessionId: z.string(),
  customerId: z.string(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  dateOfBirth: z.string().optional(),
  locale: z.string().optional(),
  callbackUrl: z.string().optional(),
  successUrl: z.string().optional(),
  errorUrl: z.string().optional(),
});

const StartSessionOutputSchema = z.object({
  authToken: z.string(),
  scanRef: z.string(),
  scanUrl: z.string(),
  expiryTime: z.number(),
});

const ErrorSchema = z.object({ error: z.string() });

export const createIdenfySessionRouter = (props: {
  idenfyClient: IdenfyClient;
  logger: Logger;
}) => {
  const { idenfyClient, logger } = props;

  return new OpenAPIHono<{ Variables: ContextVariables }>().openapi(
    createRoute({
      method: "post",
      path: "/providers/idenfy/sessions",
      tags: ["idenfy"],
      request: {
        body: {
          content: {
            "application/json": { schema: StartSessionInputSchema },
          },
        },
      },
      responses: {
        201: {
          content: { "application/json": { schema: StartSessionOutputSchema } },
          description: "Session created",
        },
        502: {
          content: { "application/json": { schema: ErrorSchema } },
          description: "Provider error",
        },
      },
    }),
    async (c) => {
      const body = c.req.valid("json");
      try {
        const session = await idenfyClient.startSession({
          // workflowSessionId becomes iDenfy's clientId so callbacks identify
          // the originating session without an extra lookup.
          clientId: body.workflowSessionId,
          firstName: body.firstName,
          lastName: body.lastName,
          dateOfBirth: body.dateOfBirth,
          locale: body.locale,
          callbackUrl: body.callbackUrl,
          successUrl: body.successUrl,
          errorUrl: body.errorUrl,
        });
        return c.json(session, 201);
      } catch (err) {
        logger.error({
          msg: "iDenfy session start failed",
          error: err instanceof Error ? err.message : String(err),
        });
        return c.json(
          { error: err instanceof Error ? err.message : "Provider error" },
          502,
        );
      }
    },
  );
};
