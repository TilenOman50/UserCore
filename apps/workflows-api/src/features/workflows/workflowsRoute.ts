import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

import {
  WorkflowBrandingSchema,
  WorkflowStatusEnum,
  WorkflowStepTypeEnum,
  WorkflowTypeEnum,
  WorkflowVerificationModeEnum,
} from "@usercore/shared-types";

import type { Workflow, WorkflowStep } from "../../db/schema.db";
import type { ContextVariables } from "../../types";
import type { WorkflowsService } from "./workflowsService";

const WorkflowReasonSchema = z.object({
  stepType: WorkflowStepTypeEnum.optional(),
  message: z.string(),
});

const WorkflowStepSchema = z.object({
  id: z.string(),
  type: WorkflowStepTypeEnum,
  workflowId: z.string(),
  provider: z.string().nullable(),
  valid: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const WorkflowSchema = z.object({
  id: z.string(),
  status: WorkflowStatusEnum,
  type: WorkflowTypeEnum,
  workspaceId: z.string(),
  organizationId: z.string(),
  displayName: z.string(),
  description: z.string().nullable(),
  valid: z.boolean(),
  reasons: z.array(WorkflowReasonSchema),
  verificationMode: WorkflowVerificationModeEnum,
  isDefault: z.boolean(),
  branding: WorkflowBrandingSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

const WorkflowWithStepsSchema = WorkflowSchema.extend({
  steps: z.array(WorkflowStepSchema),
});

const CreateWorkflowSchema = z.object({
  workspaceId: z.string(),
  organizationId: z.string(),
  displayName: z.string().min(1).max(120),
  type: WorkflowTypeEnum.optional(),
  status: WorkflowStatusEnum.optional(),
  verificationMode: WorkflowVerificationModeEnum.optional(),
  isDefault: z.boolean().optional(),
});

const UpdateWorkflowSchema = z.object({
  displayName: z.string().min(1).max(120).optional(),
  description: z.string().nullable().optional(),
  status: WorkflowStatusEnum.optional(),
  verificationMode: WorkflowVerificationModeEnum.optional(),
  isDefault: z.boolean().optional(),
  branding: WorkflowBrandingSchema.optional(),
});

const ErrorSchema = z.object({ error: z.string() });

const serializeWorkflow = (w: Workflow) => ({
  id: w.id,
  status: w.status,
  type: w.type,
  workspaceId: w.workspaceId,
  organizationId: w.organizationId,
  displayName: w.displayName,
  description: w.description,
  valid: w.valid,
  reasons: w.reasons ?? [],
  verificationMode: w.verificationMode,
  isDefault: w.isDefault,
  branding: w.branding ?? {},
  createdAt: w.createdAt.toISOString(),
  updatedAt: w.updatedAt.toISOString(),
});

const serializeStep = (s: WorkflowStep) => ({
  id: s.id,
  type: s.type,
  workflowId: s.workflowId,
  provider: s.provider,
  valid: s.valid,
  createdAt: s.createdAt.toISOString(),
  updatedAt: s.updatedAt.toISOString(),
});

export const createWorkflowsRouter = (props: {
  workflowsService: WorkflowsService;
}) => {
  const { workflowsService } = props;

  const app = new OpenAPIHono<{ Variables: ContextVariables }>();

  // Branding-logo upload + URL retrieval. Plain Hono routes because the
  // openapi() helper doesn't model multipart well; documentation cost is
  // the only loss here.
  app.post("/workflows/:id/branding/logo", async (c) => {
    const { id } = c.req.param();
    const formData = await c.req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return c.json({ error: "file is required" }, 400);
    const buffer = Buffer.from(await file.arrayBuffer());
    const updated = await workflowsService.uploadBrandingLogo({
      workflowId: id,
      fileBuffer: buffer,
      mimeType: file.type,
    });
    if (!updated) return c.json({ error: "Workflow not found" }, 404);
    return c.json(serializeWorkflow(updated), 200);
  });

  app.get("/workflows/:id/branding/logo/url", async (c) => {
    const { id } = c.req.param();
    const result = await workflowsService.getBrandingLogoUrl(id);
    if (!result) return c.json({ error: "No branding logo set" }, 404);
    return c.json(result, 200);
  });

  // Logo bytes proxied through the API. The widget on a phone (QR handoff)
  // can't reach the dev MinIO at localhost:9000, so it consumes this instead
  // of the presigned URL above.
  app.get("/workflows/:id/branding/logo", async (c) => {
    const { id } = c.req.param();
    const result = await workflowsService.getBrandingLogoBytes(id);
    if (!result) return c.json({ error: "No branding logo set" }, 404);
    return c.body(Buffer.from(result.body), 200, {
      "Content-Type": result.contentType,
      "Cache-Control": "public, max-age=300",
    });
  });

  return app
    .openapi(
      createRoute({
        method: "post",
        path: "/workflows",
        tags: ["workflows"],
        request: {
          body: {
            content: { "application/json": { schema: CreateWorkflowSchema } },
          },
        },
        responses: {
          201: {
            content: { "application/json": { schema: WorkflowSchema } },
            description: "Created",
          },
        },
      }),
      async (c) => {
        const body = c.req.valid("json");
        const workflow = await workflowsService.createWorkflow(body);
        return c.json(serializeWorkflow(workflow!), 201);
      },
    )
    .openapi(
      createRoute({
        method: "get",
        path: "/workflows/:id",
        tags: ["workflows"],
        request: { params: z.object({ id: z.string() }) },
        responses: {
          200: {
            content: {
              "application/json": { schema: WorkflowWithStepsSchema },
            },
            description: "Workflow",
          },
          404: {
            content: { "application/json": { schema: ErrorSchema } },
            description: "Not found",
          },
        },
      }),
      async (c) => {
        const { id } = c.req.valid("param");
        const workflow = await workflowsService.getWorkflow(id);
        if (!workflow) return c.json({ error: "Workflow not found" }, 404);
        return c.json(
          {
            ...serializeWorkflow(workflow),
            steps: workflow.steps.map(serializeStep),
          },
          200,
        );
      },
    )
    .openapi(
      createRoute({
        method: "get",
        path: "/workflows/workspace/:workspaceId",
        tags: ["workflows"],
        request: {
          params: z.object({ workspaceId: z.string() }),
          query: z.object({
            organizationId: z.string(),
            page: z.coerce.number().int().min(1).optional(),
            limit: z.coerce.number().int().min(1).max(100).optional(),
          }),
        },
        responses: {
          200: {
            content: {
              "application/json": {
                schema: z.union([
                  z.array(WorkflowSchema),
                  z.object({
                    items: z.array(WorkflowSchema),
                    total: z.number(),
                    page: z.number(),
                    limit: z.number(),
                    totalPages: z.number(),
                  }),
                ]),
              },
            },
            description: "Workflows (paginated when page/limit provided)",
          },
        },
      }),
      async (c) => {
        const { workspaceId } = c.req.valid("param");
        const { organizationId, page, limit } = c.req.valid("query");
        if (page !== undefined || limit !== undefined) {
          const result = await workflowsService.listByWorkspacePaginated({
            workspaceId,
            organizationId,
            page: page ?? 1,
            limit: limit ?? 20,
          });
          return c.json(
            {
              ...result,
              items: result.items.map(serializeWorkflow),
            },
            200,
          );
        }
        const workflows = await workflowsService.listByWorkspace(
          workspaceId,
          organizationId,
        );
        return c.json(workflows.map(serializeWorkflow), 200);
      },
    )
    .openapi(
      createRoute({
        method: "patch",
        path: "/workflows/:id",
        tags: ["workflows"],
        request: {
          params: z.object({ id: z.string() }),
          body: {
            content: { "application/json": { schema: UpdateWorkflowSchema } },
          },
        },
        responses: {
          200: {
            content: { "application/json": { schema: WorkflowSchema } },
            description: "Updated",
          },
        },
      }),
      async (c) => {
        const { id } = c.req.valid("param");
        const body = c.req.valid("json");
        const workflow = await workflowsService.updateWorkflow(id, body);
        return c.json(serializeWorkflow(workflow!), 200);
      },
    )
    .openapi(
      createRoute({
        method: "delete",
        path: "/workflows/:id",
        tags: ["workflows"],
        request: { params: z.object({ id: z.string() }) },
        responses: {
          204: { description: "Deleted" },
        },
      }),
      async (c) => {
        const { id } = c.req.valid("param");
        await workflowsService.deleteWorkflow(id);
        return c.body(null, 204);
      },
    );
};
