import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

import { ProviderShortNameEnum } from "@usercore/shared-types";

import type { AmlScreeningStep, WorkflowStep } from "../../db/schema.db";
import type { ContextVariables } from "../../types";
import type { AmlScreeningService } from "./amlScreeningService";

const StepSchema = z.object({
  id: z.string(),
  workflowStepId: z.string(),
  screenOnCreated: z.boolean(),
  monitorOngoing: z.boolean(),
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

const serializeStep = (s: AmlScreeningStep) => ({
  id: s.id,
  workflowStepId: s.workflowStepId,
  screenOnCreated: s.screenOnCreated,
  monitorOngoing: s.monitorOngoing,
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

export const createAmlScreeningRouter = (props: {
  amlScreeningService: AmlScreeningService;
}) => {
  const { amlScreeningService } = props;

  return new OpenAPIHono<{ Variables: ContextVariables }>()
    .openapi(
      createRoute({
        method: "post",
        path: "/workflows/:workflowId/aml-screening",
        tags: ["aml-screening"],
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
        const step = await amlScreeningService.addStep({
          workflowId,
          provider: provider ?? null,
        });
        return c.json(serializeWorkflowStep(step!), 201);
      },
    )
    .openapi(
      createRoute({
        method: "get",
        path: "/workflow-steps/:workflowStepId/aml-screening",
        tags: ["aml-screening"],
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
        const step = await amlScreeningService.getStep(workflowStepId);
        if (!step) return c.json({ error: "AML step not found" }, 404);
        return c.json(serializeStep(step), 200);
      },
    )
    .openapi(
      createRoute({
        method: "patch",
        path: "/workflow-steps/:workflowStepId/aml-screening",
        tags: ["aml-screening"],
        request: {
          params: z.object({ workflowStepId: z.string() }),
          body: {
            content: {
              "application/json": {
                schema: z.object({
                  screenOnCreated: z.boolean().optional(),
                  monitorOngoing: z.boolean().optional(),
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
        const step = await amlScreeningService.updateStep(workflowStepId, body);
        return c.json(serializeStep(step!), 200);
      },
    )
    .openapi(
      createRoute({
        method: "patch",
        path: "/workflow-steps/:workflowStepId/aml-screening/provider",
        tags: ["aml-screening"],
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
        const step = await amlScreeningService.setProvider({
          workflowStepId,
          provider,
        });
        return c.json(serializeWorkflowStep(step!), 200);
      },
    )
    .openapi(
      createRoute({
        method: "delete",
        path: "/workflow-steps/:workflowStepId/aml-screening",
        tags: ["aml-screening"],
        request: { params: z.object({ workflowStepId: z.string() }) },
        responses: { 204: { description: "Deleted" } },
      }),
      async (c) => {
        const { workflowStepId } = c.req.valid("param");
        await amlScreeningService.removeStep(workflowStepId);
        return c.body(null, 204);
      },
    );
};
