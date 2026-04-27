import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

import { ProviderShortNameEnum } from "@usercore/shared-types";

import type { FraudDetectionStep, WorkflowStep } from "../../db/schema.db";
import type { ContextVariables } from "../../types";
import type { FraudDetectionService } from "./fraudDetectionService";

const StepSchema = z.object({
  id: z.string(),
  workflowStepId: z.string(),
  screenOnCreated: z.boolean(),
  providerConfig: z.any(),
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

const serializeStep = (s: FraudDetectionStep) => ({
  id: s.id,
  workflowStepId: s.workflowStepId,
  screenOnCreated: s.screenOnCreated,
  providerConfig: s.providerConfig,
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

export const createFraudDetectionRouter = (props: {
  fraudDetectionService: FraudDetectionService;
}) => {
  const { fraudDetectionService } = props;

  return new OpenAPIHono<{ Variables: ContextVariables }>()
    .openapi(
      createRoute({
        method: "post",
        path: "/workflows/:workflowId/fraud-detection",
        tags: ["fraud-detection"],
        request: {
          params: z.object({ workflowId: z.string() }),
          body: {
            content: {
              "application/json": {
                schema: z.object({
                  provider: ProviderShortNameEnum.nullable().optional(),
                }),
              },
            },
          },
        },
        responses: {
          201: {
            content: { "application/json": { schema: WorkflowStepSchema } },
            description: "Step added",
          },
        },
      }),
      async (c) => {
        const { workflowId } = c.req.valid("param");
        const { provider } = c.req.valid("json");
        const step = await fraudDetectionService.addStep({
          workflowId,
          provider: provider ?? null,
        });
        return c.json(serializeWorkflowStep(step!), 201);
      },
    )
    .openapi(
      createRoute({
        method: "get",
        path: "/workflow-steps/:workflowStepId/fraud-detection",
        tags: ["fraud-detection"],
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
        const step = await fraudDetectionService.getStep(workflowStepId);
        if (!step) return c.json({ error: "Fraud step not found" }, 404);
        return c.json(serializeStep(step), 200);
      },
    )
    .openapi(
      createRoute({
        method: "patch",
        path: "/workflow-steps/:workflowStepId/fraud-detection",
        tags: ["fraud-detection"],
        request: {
          params: z.object({ workflowStepId: z.string() }),
          body: {
            content: {
              "application/json": {
                schema: z.object({
                  screenOnCreated: z.boolean().optional(),
                  providerConfig: z.any().optional(),
                }),
              },
            },
          },
        },
        responses: {
          200: {
            content: { "application/json": { schema: StepSchema } },
            description: "Updated",
          },
        },
      }),
      async (c) => {
        const { workflowStepId } = c.req.valid("param");
        const body = c.req.valid("json");
        const step = await fraudDetectionService.updateStep(
          workflowStepId,
          body,
        );
        return c.json(serializeStep(step!), 200);
      },
    )
    .openapi(
      createRoute({
        method: "patch",
        path: "/workflow-steps/:workflowStepId/fraud-detection/provider",
        tags: ["fraud-detection"],
        request: {
          params: z.object({ workflowStepId: z.string() }),
          body: {
            content: {
              "application/json": {
                schema: z.object({
                  provider: ProviderShortNameEnum.nullable(),
                }),
              },
            },
          },
        },
        responses: {
          200: {
            content: { "application/json": { schema: WorkflowStepSchema } },
            description: "Provider updated",
          },
        },
      }),
      async (c) => {
        const { workflowStepId } = c.req.valid("param");
        const { provider } = c.req.valid("json");
        const step = await fraudDetectionService.setProvider({
          workflowStepId,
          provider,
        });
        return c.json(serializeWorkflowStep(step!), 200);
      },
    )
    .openapi(
      createRoute({
        method: "delete",
        path: "/workflow-steps/:workflowStepId/fraud-detection",
        tags: ["fraud-detection"],
        request: { params: z.object({ workflowStepId: z.string() }) },
        responses: { 204: { description: "Deleted" } },
      }),
      async (c) => {
        const { workflowStepId } = c.req.valid("param");
        await fraudDetectionService.removeStep(workflowStepId);
        return c.body(null, 204);
      },
    );
};
