import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

import type { ContextVariables } from "../../types";
import {
  EmailVerificationError,
  type EmailVerificationService,
} from "./emailVerificationService";

const ErrorSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
});

export const createEmailVerificationRouter = (props: {
  emailVerificationService: EmailVerificationService;
}) => {
  const { emailVerificationService } = props;

  return new OpenAPIHono<{ Variables: ContextVariables }>()
    .openapi(
      createRoute({
        method: "post",
        path: "/workflow-sessions/:id/email-otp/send",
        tags: ["email-verification"],
        request: {
          params: z.object({ id: z.string() }),
          body: {
            content: {
              "application/json": {
                schema: z.object({
                  email: z.string().email(),
                  // Customer's chosen widget language; the email body and
                  // subject render in this language. Optional — falls back
                  // to English in the service.
                  locale: z.string().optional(),
                }),
              },
            },
          },
        },
        responses: {
          204: { description: "Sent" },
          404: {
            content: { "application/json": { schema: ErrorSchema } },
            description: "Workflow session not found",
          },
          409: {
            content: { "application/json": { schema: ErrorSchema } },
            description:
              "This email is already verified by another customer in the workspace",
          },
          500: {
            content: { "application/json": { schema: ErrorSchema } },
            description: "Send failed",
          },
        },
      }),
      async (c) => {
        const { id } = c.req.valid("param");
        const { email, locale } = c.req.valid("json");
        try {
          await emailVerificationService.sendCode({
            workflowSessionId: id,
            email,
            locale: locale ?? null,
          });
          return c.body(null, 204);
        } catch (err) {
          if (err instanceof EmailVerificationError) {
            if (err.code === "session_not_found") {
              return c.json({ error: err.message, code: err.code }, 404);
            }
            if (err.code === "email_already_used") {
              return c.json({ error: err.message, code: err.code }, 409);
            }
          }
          return c.json(
            { error: err instanceof Error ? err.message : "Send failed" },
            500,
          );
        }
      },
    )
    .openapi(
      createRoute({
        method: "post",
        path: "/workflow-sessions/:id/email-otp/verify",
        tags: ["email-verification"],
        request: {
          params: z.object({ id: z.string() }),
          body: {
            content: {
              "application/json": {
                schema: z.object({
                  email: z.string().email(),
                  code: z.string().min(4),
                }),
              },
            },
          },
        },
        responses: {
          204: { description: "Verified" },
          400: {
            content: { "application/json": { schema: ErrorSchema } },
            description: "Invalid",
          },
        },
      }),
      async (c) => {
        const { id } = c.req.valid("param");
        const { email, code } = c.req.valid("json");
        try {
          await emailVerificationService.verifyCode({
            workflowSessionId: id,
            email,
            code,
          });
          return c.body(null, 204);
        } catch (err) {
          if (err instanceof EmailVerificationError) {
            return c.json({ error: err.message, code: err.code }, 400);
          }
          return c.json(
            { error: err instanceof Error ? err.message : "Verify failed" },
            400,
          );
        }
      },
    );
};
