import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

import {
  IdentityVerificationSubStepTypeEnum,
  ProviderShortNameEnum,
} from "@usercore/shared-types";

import type {
  IdentityVerificationStep,
  IdentityVerificationSubStep,
  WorkflowStep,
} from "../../db/schema.db";
import type { ContextVariables } from "../../types";
import type { IdentityVerificationService } from "./identityVerificationService";

const SubStepSchema = z.object({
  id: z.string(),
  type: IdentityVerificationSubStepTypeEnum,
  enabled: z.boolean(),
  valid: z.boolean(),
  providerConfig: z.any(),
  identityVerificationStepId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const StepWithSubStepsSchema = z.object({
  step: z.object({
    id: z.string(),
    workflowStepId: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
  }),
  subSteps: z.array(SubStepSchema),
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

const serializeWorkflowStep = (s: WorkflowStep) => ({
  id: s.id,
  workflowId: s.workflowId,
  type: s.type,
  provider: s.provider,
  valid: s.valid,
  createdAt: s.createdAt.toISOString(),
  updatedAt: s.updatedAt.toISOString(),
});

const serializeStep = (s: IdentityVerificationStep) => ({
  id: s.id,
  workflowStepId: s.workflowStepId,
  createdAt: s.createdAt.toISOString(),
  updatedAt: s.updatedAt.toISOString(),
});

const serializeSubStep = (s: IdentityVerificationSubStep) => ({
  id: s.id,
  type: s.type,
  enabled: s.enabled,
  valid: s.valid,
  providerConfig: s.providerConfig,
  identityVerificationStepId: s.identityVerificationStepId,
  createdAt: s.createdAt.toISOString(),
  updatedAt: s.updatedAt.toISOString(),
});

export const createIdentityVerificationRouter = (props: {
  identityVerificationService: IdentityVerificationService;
}) => {
  const { identityVerificationService } = props;

  return new OpenAPIHono<{ Variables: ContextVariables }>()
    .openapi(
      createRoute({
        method: "post",
        path: "/workflows/:workflowId/identity-verification",
        tags: ["identity-verification"],
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
        const step = await identityVerificationService.addStep({
          workflowId,
          provider: provider ?? null,
        });
        return c.json(serializeWorkflowStep(step!), 201);
      },
    )
    .openapi(
      createRoute({
        method: "get",
        path: "/workflow-steps/:workflowStepId/identity-verification",
        tags: ["identity-verification"],
        request: { params: z.object({ workflowStepId: z.string() }) },
        responses: {
          200: {
            content: {
              "application/json": { schema: StepWithSubStepsSchema },
            },
            description: "Step + sub-steps",
          },
          404: {
            content: { "application/json": { schema: ErrorSchema } },
            description: "Not found",
          },
        },
      }),
      async (c) => {
        const { workflowStepId } = c.req.valid("param");
        const result =
          await identityVerificationService.getStep(workflowStepId);
        if (!result) {
          return c.json({ error: "Identity verification step not found" }, 404);
        }
        return c.json(
          {
            step: serializeStep(result.step),
            subSteps: result.subSteps.map(serializeSubStep),
          },
          200,
        );
      },
    )
    .openapi(
      createRoute({
        method: "patch",
        path: "/workflow-steps/:workflowStepId/identity-verification/provider",
        tags: ["identity-verification"],
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
        const step = await identityVerificationService.setProvider({
          workflowStepId,
          provider,
        });
        return c.json(serializeWorkflowStep(step!), 200);
      },
    )
    .openapi(
      createRoute({
        method: "patch",
        path: "/identity-verification/sub-steps/:subStepId",
        tags: ["identity-verification"],
        request: {
          params: z.object({ subStepId: z.string() }),
          body: {
            content: {
              "application/json": {
                schema: z.object({
                  enabled: z.boolean().optional(),
                  providerConfig: z.any().optional(),
                }),
              },
            },
          },
        },
        responses: {
          200: {
            content: { "application/json": { schema: SubStepSchema } },
            description: "Updated",
          },
          404: {
            content: { "application/json": { schema: ErrorSchema } },
            description: "Not found",
          },
        },
      }),
      async (c) => {
        const { subStepId } = c.req.valid("param");
        const body = c.req.valid("json");

        let result: IdentityVerificationSubStep | undefined;
        if (typeof body.enabled === "boolean") {
          const r = await identityVerificationService.toggleSubStep({
            subStepId,
            enabled: body.enabled,
          });
          if (r) result = r;
        }
        if (body.providerConfig !== undefined) {
          result = await identityVerificationService.updateSubStepConfig({
            subStepId,
            providerConfig: body.providerConfig,
          });
        }
        if (!result) return c.json({ error: "Sub-step not found" }, 404);
        return c.json(serializeSubStep(result), 200);
      },
    )
    .openapi(
      createRoute({
        method: "delete",
        path: "/workflow-steps/:workflowStepId/identity-verification",
        tags: ["identity-verification"],
        request: { params: z.object({ workflowStepId: z.string() }) },
        responses: {
          204: { description: "Deleted" },
        },
      }),
      async (c) => {
        const { workflowStepId } = c.req.valid("param");
        await identityVerificationService.removeStep(workflowStepId);
        return c.body(null, 204);
      },
    );
};
