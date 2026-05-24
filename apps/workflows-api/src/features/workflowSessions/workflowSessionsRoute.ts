import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

import {
  AttributeTypeEnum,
  ExternalSessionSourceEnum,
  WorkflowSessionStatusEnum,
  WorkflowSessionStepTypeEnum,
  WorkflowVerificationModeEnum,
} from "@usercore/shared-types";

import type {
  WorkflowSession,
  WorkflowSessionAttribute,
  WorkflowSessionEvent,
  WorkflowSessionStep,
} from "../../db/schema.db";
import type { ContextVariables } from "../../types";
import {
  PlanLimitExceededError,
  SESSION_FILE_KINDS,
  type SessionFileKind,
  type WorkflowSessionsService,
} from "./workflowSessionsService";

const isFileKind = (value: string): value is SessionFileKind =>
  (SESSION_FILE_KINDS as readonly string[]).includes(value);

const SessionSchema = z.object({
  id: z.string(),
  externalSessionId: z.string(),
  externalSessionSource: ExternalSessionSourceEnum,
  workflowId: z.string(),
  customerId: z.string(),
  verificationMode: WorkflowVerificationModeEnum,
  activeDeviceId: z.string().nullable(),
  archived: z.boolean(),
  deletedAt: z.string().nullable(),
  deletedBy: z.string().nullable(),
  deleteReason: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const SessionStepSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  step: WorkflowSessionStepTypeEnum,
  status: WorkflowSessionStatusEnum,
  message: z.string().nullable(),
  traceId: z.string().nullable(),
  parentStepId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const SessionAttributeSchema = z.object({
  id: z.string(),
  workflowSessionId: z.string(),
  attribute: z.string(),
  value: z.string(),
  attributeType: AttributeTypeEnum,
  createdAt: z.string(),
  updatedAt: z.string(),
});

const SessionEventSchema = z.object({
  id: z.string(),
  type: z.string(),
  detail: z
    .object({
      decision: z.string().optional(),
      steps: z.array(z.string()).optional(),
      reasonCodes: z.array(z.string()).optional(),
      note: z.string().nullable().optional(),
      reason: z.string().nullable().optional(),
      snapshot: z.record(z.string(), z.string()).optional(),
    })
    .nullable(),
  occurredAt: z.string(),
  createdBy: z.string().nullable(),
});

const SessionDetailSchema = z.object({
  session: SessionSchema,
  steps: z.array(SessionStepSchema),
  attributes: z.array(SessionAttributeSchema),
  // Append-only audit trail (resubmission / re-verification / decision /
  // archive), oldest first. Powers the dashboard activity timeline.
  events: z.array(SessionEventSchema),
  // Gap between the workflow's current requirements and what this session
  // satisfies. steps = identity sub-steps the customer must (re)complete;
  // checks = server-side checks not yet run. Drives re-verification for
  // approved customers.
  outstanding: z.object({
    steps: z.array(z.string()),
    checks: z.array(z.string()),
  }),
  // Identity sub-steps enabled in the workflow right now — limits which steps a
  // reviewer can bounce for resubmission (a step removed from the workflow can't
  // be redone by the customer).
  enabledSteps: z.array(z.string()),
});

const ErrorSchema = z.object({ error: z.string() });

const serializeSession = (s: WorkflowSession) => ({
  id: s.id,
  externalSessionId: s.externalSessionId,
  externalSessionSource: s.externalSessionSource,
  workflowId: s.workflowId,
  customerId: s.customerId,
  verificationMode: s.verificationMode,
  activeDeviceId: s.activeDeviceId,
  archived: s.deletedAt != null,
  deletedAt: s.deletedAt ? s.deletedAt.toISOString() : null,
  deletedBy: s.deletedBy,
  deleteReason: s.deleteReason,
  createdAt: s.createdAt.toISOString(),
  updatedAt: s.updatedAt.toISOString(),
});

const serializeStep = (s: WorkflowSessionStep) => ({
  id: s.id,
  sessionId: s.sessionId,
  step: s.step,
  status: s.status,
  message: s.message,
  traceId: s.traceId,
  parentStepId: s.parentStepId,
  createdAt: s.createdAt.toISOString(),
  updatedAt: s.updatedAt.toISOString(),
});

const serializeAttribute = (a: WorkflowSessionAttribute) => ({
  id: a.id,
  workflowSessionId: a.workflowSessionId,
  attribute: a.attribute,
  value: a.value,
  attributeType: a.attributeType,
  createdAt: a.createdAt.toISOString(),
  updatedAt: a.updatedAt.toISOString(),
});

const serializeEvent = (e: WorkflowSessionEvent) => ({
  id: e.id,
  type: e.type,
  detail: e.detail ?? null,
  occurredAt: e.occurredAt.toISOString(),
  createdBy: e.createdBy,
});

export const createWorkflowSessionsRouter = (props: {
  workflowSessionsService: WorkflowSessionsService;
}) => {
  const { workflowSessionsService } = props;

  const app = new OpenAPIHono<{ Variables: ContextVariables }>();

  // Signed download URL for a previously uploaded session file. Dashboard
  // reviewers fetch this when rendering the document image / face video.
  app.get("/workflow-sessions/:id/files/:kind/url", async (c) => {
    const { id, kind } = c.req.param();
    if (!isFileKind(kind)) {
      return c.json({ error: "Invalid file kind" }, 400);
    }
    const result = await workflowSessionsService.getSessionFileUrl({
      workflowSessionId: id,
      kind,
    });
    if (!result) return c.json({ error: "File not found" }, 404);
    return c.json(result, 200);
  });

  // Signed URL for a PREVIOUS attempt's object (snapshotted in a resubmission
  // event) — used by the fraud comparison to show the prior document / selfie.
  // The service guards that the key belongs to this session. NOTE: path is
  // `file-by-key` (not `files/by-key`) so it can't collide with the
  // `/files/:kind/url` route above (`:kind` would otherwise match "by-key").
  app.get("/workflow-sessions/:id/file-by-key/url", async (c) => {
    const { id } = c.req.param();
    const key = c.req.query("key");
    if (!key) return c.json({ error: "Missing key" }, 400);
    const result = await workflowSessionsService.getSessionFileUrlByKey({
      workflowSessionId: id,
      key,
    });
    if (!result) return c.json({ error: "File not found" }, 404);
    return c.json(result, 200);
  });

  // Org-scoped monthly verification usage. Powers the dashboard counter and
  // mirrors the same hard-cap source the createSession path uses.
  app.get(
    "/workflow-sessions/organization/:organizationId/usage",
    async (c) => {
      const { organizationId } = c.req.param();
      const stats =
        await workflowSessionsService.getMonthlyVerificationStats(
          organizationId,
        );
      if (!stats) return c.json({ error: "Organization not found" }, 404);
      return c.json(stats, 200);
    },
  );

  // Multipart file upload — stored to MinIO; an EAV attribute holds the key.
  app.post("/workflow-sessions/:id/files/:kind", async (c) => {
    const { id, kind } = c.req.param();
    if (!isFileKind(kind)) {
      return c.json({ error: "Invalid file kind" }, 400);
    }
    const formData = await c.req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return c.json({ error: "file is required" }, 400);
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await workflowSessionsService.uploadSessionFile({
      workflowSessionId: id,
      kind,
      fileBuffer: buffer,
      mimeType: file.type,
    });
    return c.json(result, 200);
  });

  return app
    .openapi(
      createRoute({
        method: "post",
        path: "/workflow-sessions",
        tags: ["workflow-sessions"],
        request: {
          body: {
            content: {
              "application/json": {
                schema: z.object({
                  externalSessionId: z.string(),
                  externalSessionSource: ExternalSessionSourceEnum,
                  workflowId: z.string(),
                  customerId: z.string(),
                  verificationMode: WorkflowVerificationModeEnum.optional(),
                  activeDeviceId: z.string().optional(),
                }),
              },
            },
          },
        },
        responses: {
          201: {
            content: { "application/json": { schema: SessionSchema } },
            description: "Created or existing",
          },
          403: {
            content: {
              "application/json": {
                schema: z.object({
                  error: z.string(),
                  code: z.literal("plan_limit_exceeded"),
                  used: z.number(),
                  max: z.number(),
                }),
              },
            },
            description: "Plan quota exhausted",
          },
        },
      }),
      async (c) => {
        const body = c.req.valid("json");
        try {
          const session = await workflowSessionsService.createSession(body);
          return c.json(serializeSession(session!), 201);
        } catch (err) {
          if (err instanceof PlanLimitExceededError) {
            return c.json(
              {
                error: err.message,
                code: err.code,
                used: err.used,
                max: err.max,
              },
              403,
            );
          }
          throw err;
        }
      },
    )
    .openapi(
      createRoute({
        method: "get",
        path: "/workflow-sessions/:id",
        tags: ["workflow-sessions"],
        request: { params: z.object({ id: z.string() }) },
        responses: {
          200: {
            content: { "application/json": { schema: SessionDetailSchema } },
            description: "Session detail",
          },
          404: {
            content: { "application/json": { schema: ErrorSchema } },
            description: "Not found",
          },
        },
      }),
      async (c) => {
        const { id } = c.req.valid("param");
        const result = await workflowSessionsService.getSession(id);
        if (!result) return c.json({ error: "Session not found" }, 404);
        return c.json(
          {
            session: serializeSession(result.session),
            steps: result.steps.map(serializeStep),
            attributes: result.attributes.map(serializeAttribute),
            events: result.events.map(serializeEvent),
            outstanding: result.outstanding,
            enabledSteps: result.enabledSteps,
          },
          200,
        );
      },
    )
    .openapi(
      createRoute({
        method: "get",
        path: "/workflow-sessions/workspace/:workspaceId",
        tags: ["workflow-sessions"],
        request: { params: z.object({ workspaceId: z.string() }) },
        responses: {
          200: {
            content: { "application/json": { schema: z.array(SessionSchema) } },
            description: "Sessions",
          },
        },
      }),
      async (c) => {
        const { workspaceId } = c.req.valid("param");
        const sessions =
          await workflowSessionsService.listForReviewQueue(workspaceId);
        return c.json(sessions.map(serializeSession), 200);
      },
    )
    .openapi(
      createRoute({
        method: "get",
        path: "/workflow-sessions/workspace/:workspaceId/review-queue",
        tags: ["workflow-sessions"],
        // Paginated + filtered review queue. Each row carries a derived
        // reviewStatus the dashboard table renders + filters on.
        request: {
          params: z.object({ workspaceId: z.string() }),
          query: z.object({
            page: z.coerce.number().min(1).default(1),
            limit: z.coerce.number().min(1).max(100).default(20),
            status: z
              .enum([
                "open",
                "needs_review",
                "approved",
                "rejected",
                "resubmission",
                "in_progress",
                "archived",
              ])
              .optional(),
            mode: WorkflowVerificationModeEnum.optional(),
            search: z.string().optional(),
          }),
        },
        responses: {
          200: {
            content: {
              "application/json": {
                schema: z.object({
                  items: z.array(
                    SessionSchema.extend({
                      reviewStatus: z.enum([
                        "needs_review",
                        "approved",
                        "rejected",
                        "resubmission",
                        "in_progress",
                      ]),
                      customerName: z.string().nullable(),
                      customerCountry: z.string().nullable(),
                    }),
                  ),
                  total: z.number(),
                  page: z.number(),
                  limit: z.number(),
                  totalPages: z.number(),
                }),
              },
            },
            description: "Paginated review queue",
          },
        },
      }),
      async (c) => {
        const { workspaceId } = c.req.valid("param");
        const { page, limit, status, mode, search } = c.req.valid("query");
        const result = await workflowSessionsService.listReviewQueuePaginated({
          workspaceId,
          page,
          limit,
          status,
          mode,
          search,
        });
        return c.json(
          {
            ...result,
            items: result.items.map((it) => ({
              ...serializeSession(it),
              reviewStatus: it.reviewStatus,
              customerName: it.customerName,
              customerCountry: it.customerCountry,
            })),
          },
          200,
        );
      },
    )
    .openapi(
      createRoute({
        method: "post",
        path: "/workflow-sessions/:id/steps",
        tags: ["workflow-sessions"],
        request: {
          params: z.object({ id: z.string() }),
          body: {
            content: {
              "application/json": {
                schema: z.object({
                  step: WorkflowSessionStepTypeEnum,
                  status: WorkflowSessionStatusEnum,
                  message: z.string().nullable().optional(),
                  parentStepId: z.string().nullable().optional(),
                  traceId: z.string().nullable().optional(),
                }),
              },
            },
          },
        },
        responses: {
          200: {
            content: { "application/json": { schema: SessionStepSchema } },
            description: "Upserted",
          },
        },
      }),
      async (c) => {
        const { id } = c.req.valid("param");
        const body = c.req.valid("json");
        // Server-derived client IP for fraud-detection (IPQS). Behind a
        // proxy/tunnel the real customer IP is the first entry of
        // x-forwarded-for; x-real-ip is the nginx/ngrok fallback. Not
        // spoofable by the widget since we read it off the connection
        // headers, not the request body.
        const forwardedFor = c.req.header("x-forwarded-for");
        const clientIp =
          forwardedFor?.split(",")[0]?.trim() ||
          c.req.header("x-real-ip") ||
          null;
        const row = await workflowSessionsService.recordStepStatus({
          sessionId: id,
          ...body,
          clientIp,
        });
        return c.json(serializeStep(row!), 200);
      },
    )
    .openapi(
      createRoute({
        method: "post",
        path: "/workflow-sessions/:id/attributes",
        tags: ["workflow-sessions"],
        request: {
          params: z.object({ id: z.string() }),
          body: {
            content: {
              "application/json": {
                schema: z.object({
                  attributes: z.array(
                    z.object({
                      attribute: z.string(),
                      value: z.string(),
                      attributeType: AttributeTypeEnum,
                    }),
                  ),
                }),
              },
            },
          },
        },
        responses: {
          200: {
            content: {
              "application/json": {
                schema: z.array(SessionAttributeSchema),
              },
            },
            description: "Upserted",
          },
        },
      }),
      async (c) => {
        const { id } = c.req.valid("param");
        const { attributes } = c.req.valid("json");
        const rows = await workflowSessionsService.writeAttributes({
          workflowSessionId: id,
          attributes,
        });
        return c.json(rows.map(serializeAttribute), 200);
      },
    )
    .openapi(
      createRoute({
        method: "post",
        path: "/workflow-sessions/:id/identity-data",
        tags: ["workflow-sessions"],
        // Manual identity data entry from the KYC review page. `fields` is a
        // map of canonical field suffix → value (e.g. document_first_name).
        // The service validates against the shared schema and writes the
        // identity_verification.* attributes — same keys iDenfy writes.
        request: {
          params: z.object({ id: z.string() }),
          body: {
            content: {
              "application/json": {
                schema: z.object({
                  fields: z.record(z.string(), z.string()),
                }),
              },
            },
          },
        },
        responses: {
          200: {
            content: {
              "application/json": {
                schema: z.object({ written: z.number() }),
              },
            },
            description: "Identity data saved",
          },
        },
      }),
      async (c) => {
        const { id } = c.req.valid("param");
        const { fields } = c.req.valid("json");
        const result = await workflowSessionsService.saveIdentityData({
          workflowSessionId: id,
          fields,
        });
        return c.json(result, 200);
      },
    )
    .openapi(
      createRoute({
        method: "post",
        path: "/workflow-sessions/:id/run-checks",
        tags: ["workflow-sessions"],
        // Officer-triggered re-run of the workflow's provider checks. Now
        // that a name exists (manual entry or iDenfy), AML is included
        // instead of deferred. Results stream back asynchronously via the
        // check-completed consumer; the dashboard polls the session.
        request: {
          params: z.object({ id: z.string() }),
        },
        responses: {
          200: {
            content: {
              "application/json": {
                schema: z.object({ triggered: z.boolean() }),
              },
            },
            description: "Checks triggered",
          },
        },
      }),
      async (c) => {
        const { id } = c.req.valid("param");
        const result = await workflowSessionsService.runChecks(id);
        return c.json(result, 200);
      },
    )
    .openapi(
      createRoute({
        method: "post",
        path: "/workflow-sessions/:id/request-resubmission",
        tags: ["workflow-sessions"],
        // Reviewer bounces the session back to the customer for specific
        // steps. Records resubmission markers + best-effort branded email.
        request: {
          params: z.object({ id: z.string() }),
          body: {
            content: {
              "application/json": {
                schema: z.object({
                  steps: z.array(z.string()),
                  note: z.string().optional(),
                  reasonCodes: z.array(z.string()).optional(),
                  reviewedBy: z.string(),
                }),
              },
            },
          },
        },
        responses: {
          200: {
            content: {
              "application/json": {
                schema: z.object({ ok: z.boolean() }),
              },
            },
            description: "Resubmission requested",
          },
        },
      }),
      async (c) => {
        const { id } = c.req.valid("param");
        const body = c.req.valid("json");
        await workflowSessionsService.requestResubmission({
          workflowSessionId: id,
          steps: body.steps,
          note: body.note,
          reasonCodes: body.reasonCodes,
          reviewedBy: body.reviewedBy,
        });
        return c.json({ ok: true }, 200);
      },
    )
    .openapi(
      createRoute({
        method: "post",
        path: "/workflow-sessions/:id/request-reverification",
        tags: ["workflow-sessions"],
        // Re-verify an APPROVED customer against the workflow's current
        // requirements: re-runs outstanding server checks and prompts the
        // customer (widget) for any missing identity steps — WITHOUT losing
        // approved status. Only a failed check demotes them.
        request: {
          params: z.object({ id: z.string() }),
          body: {
            content: {
              "application/json": {
                schema: z.object({ reviewedBy: z.string() }),
              },
            },
          },
        },
        responses: {
          200: {
            content: {
              "application/json": {
                schema: z.object({
                  steps: z.array(z.string()),
                  checks: z.array(z.string()),
                  notified: z.boolean(),
                }),
              },
            },
            description: "Re-verification requested",
          },
        },
      }),
      async (c) => {
        const { id } = c.req.valid("param");
        const body = c.req.valid("json");
        const result = await workflowSessionsService.requestReverification({
          workflowSessionId: id,
          reviewedBy: body.reviewedBy,
        });
        return c.json(
          result ?? { steps: [], checks: [], notified: false },
          200,
        );
      },
    )
    .openapi(
      createRoute({
        method: "post",
        path: "/workflow-sessions/:id/complete-reverification",
        tags: ["workflow-sessions"],
        // Widget calls this when the customer finishes re-verification steps:
        // clears the markers + re-runs checks, keeping approved status (a
        // failed check demotes via applyAdverseTransition).
        request: { params: z.object({ id: z.string() }) },
        responses: {
          200: {
            content: {
              "application/json": {
                schema: z.object({ completed: z.boolean() }),
              },
            },
            description: "Re-verification completed",
          },
        },
      }),
      async (c) => {
        const { id } = c.req.valid("param");
        const result = await workflowSessionsService.completeReverification(id);
        return c.json(result, 200);
      },
    )
    .openapi(
      createRoute({
        method: "post",
        path: "/workflow-sessions/:id/archive",
        tags: ["workflow-sessions"],
        // Soft-delete (archive) a submission: hides it from the queue but keeps
        // the record for AML retention/audit (deletedBy + reason preserved).
        // Never a hard delete.
        request: {
          params: z.object({ id: z.string() }),
          body: {
            content: {
              "application/json": {
                schema: z.object({
                  reviewedBy: z.string(),
                  reason: z.string(),
                }),
              },
            },
          },
        },
        responses: {
          200: {
            content: {
              "application/json": {
                schema: z.object({ archived: z.boolean() }),
              },
            },
            description: "Session archived",
          },
        },
      }),
      async (c) => {
        const { id } = c.req.valid("param");
        const body = c.req.valid("json");
        const result = await workflowSessionsService.archiveSession({
          workflowSessionId: id,
          reviewedBy: body.reviewedBy,
          reason: body.reason,
        });
        return c.json(result, 200);
      },
    )
    .openapi(
      createRoute({
        method: "post",
        path: "/workflow-sessions/:id/restore",
        tags: ["workflow-sessions"],
        // Un-archive — returns a soft-deleted submission to the queue.
        request: { params: z.object({ id: z.string() }) },
        responses: {
          200: {
            content: {
              "application/json": {
                schema: z.object({ restored: z.boolean() }),
              },
            },
            description: "Session restored",
          },
        },
      }),
      async (c) => {
        const { id } = c.req.valid("param");
        const result = await workflowSessionsService.restoreSession(id);
        return c.json(result, 200);
      },
    )
    .openapi(
      createRoute({
        method: "post",
        path: "/workflow-sessions/:id/finalize",
        tags: ["workflow-sessions"],
        request: {
          params: z.object({ id: z.string() }),
          body: {
            content: {
              "application/json": {
                schema: z.object({
                  decision: z.enum(["approved", "rejected", "flagged"]),
                  reviewedBy: z.string(),
                  reason: z.string().optional(),
                  reasonCodes: z.array(z.string()).optional(),
                }),
              },
            },
          },
        },
        responses: {
          200: {
            content: { "application/json": { schema: SessionSchema } },
            description: "Finalized",
          },
          404: {
            content: { "application/json": { schema: ErrorSchema } },
            description: "Not found",
          },
        },
      }),
      async (c) => {
        const { id } = c.req.valid("param");
        const body = c.req.valid("json");
        const session = await workflowSessionsService.finalizeSession({
          workflowSessionId: id,
          ...body,
        });
        if (!session) return c.json({ error: "Session not found" }, 404);
        return c.json(serializeSession(session), 200);
      },
    );
};
