import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

import {
  ProviderCredentialModeEnum,
  ProviderShortNameEnum,
} from "@usercore/shared-types";

import type {
  RulesEngineScenario,
  RulesEngineStep,
  WorkflowStep,
} from "../../db/schema.db";
import type { ContextVariables } from "../../types";
import type { RulesEngineService } from "./rulesEngineService";

const StepSchema = z.object({
  id: z.string(),
  workflowStepId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const ScenarioLinkSchema = z.object({
  id: z.string(),
  rulesEngineStepId: z.string(),
  externalScenarioId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const StepWithScenariosSchema = z.object({
  step: StepSchema,
  scenarios: z.array(ScenarioLinkSchema),
});

const WorkflowStepSchema = z.object({
  id: z.string(),
  workflowId: z.string(),
  type: z.string(),
  provider: ProviderShortNameEnum.nullable(),
  providerCredentialMode: ProviderCredentialModeEnum,
  valid: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const ErrorSchema = z.object({ error: z.string() });

const serializeStep = (s: RulesEngineStep) => ({
  id: s.id,
  workflowStepId: s.workflowStepId,
  createdAt: s.createdAt.toISOString(),
  updatedAt: s.updatedAt.toISOString(),
});

const serializeScenario = (s: RulesEngineScenario) => ({
  id: s.id,
  rulesEngineStepId: s.rulesEngineStepId,
  externalScenarioId: s.externalScenarioId,
  createdAt: s.createdAt.toISOString(),
  updatedAt: s.updatedAt.toISOString(),
});

const serializeWorkflowStep = (s: WorkflowStep) => ({
  id: s.id,
  workflowId: s.workflowId,
  type: s.type,
  provider: s.provider,
  providerCredentialMode: s.providerCredentialMode,
  valid: s.valid,
  createdAt: s.createdAt.toISOString(),
  updatedAt: s.updatedAt.toISOString(),
});

export const createRulesEngineRouter = (props: {
  rulesEngineService: RulesEngineService;
}) => {
  const { rulesEngineService } = props;

  return new OpenAPIHono<{ Variables: ContextVariables }>()
    .openapi(
      createRoute({
        method: "post",
        path: "/workflows/:workflowId/rules-engine",
        tags: ["rules-engine"],
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
        const step = await rulesEngineService.addStep({ workflowId });
        return c.json(serializeWorkflowStep(step!), 201);
      },
    )
    .openapi(
      createRoute({
        method: "get",
        path: "/workflow-steps/:workflowStepId/rules-engine",
        tags: ["rules-engine"],
        request: { params: z.object({ workflowStepId: z.string() }) },
        responses: {
          200: {
            content: {
              "application/json": { schema: StepWithScenariosSchema },
            },
            description: "Step + scenarios",
          },
          404: {
            content: { "application/json": { schema: ErrorSchema } },
            description: "Not found",
          },
        },
      }),
      async (c) => {
        const { workflowStepId } = c.req.valid("param");
        const result = await rulesEngineService.getStep(workflowStepId);
        if (!result) {
          return c.json({ error: "Rules-engine step not found" }, 404);
        }
        return c.json(
          {
            step: serializeStep(result.step),
            scenarios: result.scenarios.map(serializeScenario),
          },
          200,
        );
      },
    )
    .openapi(
      createRoute({
        method: "post",
        path: "/workflow-steps/:workflowStepId/rules-engine/scenarios",
        tags: ["rules-engine"],
        request: {
          params: z.object({ workflowStepId: z.string() }),
          body: {
            content: {
              "application/json": {
                schema: z.object({ externalScenarioId: z.string() }),
              },
            },
          },
        },
        responses: {
          201: {
            content: { "application/json": { schema: ScenarioLinkSchema } },
            description: "Scenario linked",
          },
          404: {
            content: { "application/json": { schema: ErrorSchema } },
            description: "Not found",
          },
        },
      }),
      async (c) => {
        const { workflowStepId } = c.req.valid("param");
        const { externalScenarioId } = c.req.valid("json");
        const link = await rulesEngineService.linkScenario({
          workflowStepId,
          externalScenarioId,
        });
        if (!link) {
          return c.json({ error: "Rules-engine step not found" }, 404);
        }
        return c.json(serializeScenario(link), 201);
      },
    )
    .openapi(
      createRoute({
        method: "delete",
        path: "/workflow-steps/:workflowStepId/rules-engine/scenarios/:scenarioLinkId",
        tags: ["rules-engine"],
        request: {
          params: z.object({
            workflowStepId: z.string(),
            scenarioLinkId: z.string(),
          }),
        },
        responses: { 204: { description: "Unlinked" } },
      }),
      async (c) => {
        const { workflowStepId, scenarioLinkId } = c.req.valid("param");
        await rulesEngineService.unlinkScenario({
          workflowStepId,
          scenarioLinkId,
        });
        return c.body(null, 204);
      },
    )
    .openapi(
      createRoute({
        method: "delete",
        path: "/workflow-steps/:workflowStepId/rules-engine",
        tags: ["rules-engine"],
        request: { params: z.object({ workflowStepId: z.string() }) },
        responses: { 204: { description: "Deleted" } },
      }),
      async (c) => {
        const { workflowStepId } = c.req.valid("param");
        await rulesEngineService.removeStep(workflowStepId);
        return c.body(null, 204);
      },
    )
    .openapi(
      createRoute({
        method: "get",
        path: "/rules-engine/scenario-links/workspace/:workspaceId",
        tags: ["rules-engine"],
        request: { params: z.object({ workspaceId: z.string() }) },
        responses: {
          200: {
            content: {
              "application/json": {
                schema: z.record(
                  z.array(
                    z.object({
                      workflowId: z.string(),
                      workflowStepId: z.string(),
                      workflowName: z.string(),
                    }),
                  ),
                ),
              },
            },
            description:
              "Map of externalScenarioId → list of workflow rules-engine steps that reference it.",
          },
        },
      }),
      async (c) => {
        const { workspaceId } = c.req.valid("param");
        const map = await rulesEngineService.listScenarioLinks(workspaceId);
        return c.json(Object.fromEntries(map), 200);
      },
    );
};
