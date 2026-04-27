import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

import { ProviderShortNameEnum } from "@usercore/shared-types";

import type { DuplicateDetectionStep, WorkflowStep } from "../../db/schema.db";
import type { ContextVariables } from "../../types";
import type { DuplicateDetectionService } from "./duplicateDetectionService";

const StepSchema = z.object({
  id: z.string(),
  workflowStepId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const WorkflowStepSchema = z.object({
  id: z.string(),
  workflowId: z.string(),
  type: z.string(),
  provider: ProviderShortNameEnum.nullable(),
  valid: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const ErrorSchema = z.object({ error: z.string() });

const serializeStep = (s: DuplicateDetectionStep) => ({
  id: s.id,
  workflowStepId: s.workflowStepId,
  createdAt: s.createdAt.toISOString(),
  updatedAt: s.updatedAt.toISOString(),
});

const serializeWorkflowStep = (s: WorkflowStep) => ({
  id: s.id,
  workflowId: s.workflowId,
  type: s.type,
  provider: s.provider,
  valid: s.valid,
  createdAt: s.createdAt.toISOString(),
  updatedAt: s.updatedAt.toISOString(),
});

export const createDuplicateDetectionRouter = (props: {
  duplicateDetectionService: DuplicateDetectionService;
}) => {
  const { duplicateDetectionService } = props;

  return new OpenAPIHono<{ Variables: ContextVariables }>()
    .openapi(
      createRoute({
        method: "post",
        path: "/workflows/:workflowId/duplicate-detection",
        tags: ["duplicate-detection"],
        request: { params: z.object({ workflowId: z.string() }) },
        responses: {
          201: {
            content: { "application/json": { schema: WorkflowStepSchema } },
            description: "Step added",
          },
        },
      }),
      async (c) => {
        const { workflowId } = c.req.valid("param");
        const step = await duplicateDetectionService.addStep({ workflowId });
        return c.json(serializeWorkflowStep(step!), 201);
      },
    )
    .openapi(
      createRoute({
        method: "get",
        path: "/workflow-steps/:workflowStepId/duplicate-detection",
        tags: ["duplicate-detection"],
        request: { params: z.object({ workflowStepId: z.string() }) },
        responses: {
          200: {
            content: { "application/json": { schema: StepSchema } },
            description: "Step config",
          },
          404: {
            content: { "application/json": { schema: ErrorSchema } },
            description: "Not found",
          },
        },
      }),
      async (c) => {
        const { workflowStepId } = c.req.valid("param");
        const step = await duplicateDetectionService.getStep(workflowStepId);
        if (!step) return c.json({ error: "Duplicate step not found" }, 404);
        return c.json(serializeStep(step), 200);
      },
    )
    .openapi(
      createRoute({
        method: "delete",
        path: "/workflow-steps/:workflowStepId/duplicate-detection",
        tags: ["duplicate-detection"],
        request: { params: z.object({ workflowStepId: z.string() }) },
        responses: { 204: { description: "Deleted" } },
      }),
      async (c) => {
        const { workflowStepId } = c.req.valid("param");
        await duplicateDetectionService.removeStep(workflowStepId);
        return c.body(null, 204);
      },
    );
};
