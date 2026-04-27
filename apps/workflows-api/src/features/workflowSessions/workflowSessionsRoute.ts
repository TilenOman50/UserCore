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
  WorkflowSessionStep,
} from "../../db/schema.db";
import type { ContextVariables } from "../../types";
import {
  PlanLimitExceededError,
  type WorkflowSessionsService,
} from "./workflowSessionsService";

const SessionSchema = z.object({
  id: z.string(),
  externalSessionId: z.string(),
  externalSessionSource: ExternalSessionSourceEnum,
  workflowId: z.string(),
  customerId: z.string(),
  verificationMode: WorkflowVerificationModeEnum,
  activeDeviceId: z.string().nullable(),
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

const SessionDetailSchema = z.object({
  session: SessionSchema,
  steps: z.array(SessionStepSchema),
  attributes: z.array(SessionAttributeSchema),
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

export const createWorkflowSessionsRouter = (props: {
  workflowSessionsService: WorkflowSessionsService;
}) => {
  const { workflowSessionsService } = props;

  const app = new OpenAPIHono<{ Variables: ContextVariables }>();

  // Signed download URL for a previously uploaded session file. Dashboard
  // reviewers fetch this when rendering the document image / face video.
  app.get("/workflow-sessions/:id/files/:kind/url", async (c) => {
    const { id, kind } = c.req.param();
    if (
      kind !== "document_front" &&
      kind !== "document_back" &&
      kind !== "face_video"
    ) {
      return c.json({ error: "Invalid file kind" }, 400);
    }
    const result = await workflowSessionsService.getSessionFileUrl({
      workflowSessionId: id,
      kind,
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
    if (
      kind !== "document_front" &&
      kind !== "document_back" &&
      kind !== "face_video"
    ) {
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
                  code: z.string(),
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
        const row = await workflowSessionsService.recordStepStatus({
          sessionId: id,
          ...body,
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
