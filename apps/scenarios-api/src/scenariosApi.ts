import { swaggerUI } from "@hono/swagger-ui";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { requestId } from "hono/request-id";

import type { Logger } from "@usercore/logger";
import type { RabbitMQClient } from "@usercore/rabbitmq";
import {
  RuleOperatorEnum,
  ScenarioActionConfigSchema,
  ScenarioEvaluationSchema,
} from "@usercore/shared-types";

import type { Database } from "./db/db";
import type { Scenario } from "./db/schema.db";
import { createRuleEngineService } from "./features/ruleEngine/ruleEngineService";
import { createScenarioRepository } from "./features/scenarios/scenarioRepository";
import { createScenarioService } from "./features/scenarios/scenarioService";
import type { ContextVariables } from "./types";

const BASE_PATH = "/scenarios";

const ScenarioSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  evaluation: ScenarioEvaluationSchema,
  actions: z.array(ScenarioActionConfigSchema),
  createdBy: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const ErrorSchema = z.object({ error: z.string() });

const serializeScenario = (s: Scenario) => ({
  id: s.id,
  workspaceId: s.workspaceId,
  name: s.name,
  description: s.description,
  evaluation: s.evaluation,
  actions: s.actions,
  createdBy: s.createdBy,
  createdAt: s.createdAt.toISOString(),
  updatedAt: s.updatedAt.toISOString(),
});

export const createScenariosApi = (props: {
  db: Database;
  logger: Logger;
  rabbitMQ: RabbitMQClient;
}) => {
  const { db, logger, rabbitMQ } = props;

  const ruleEngineService = createRuleEngineService({ logger });
  const scenarioRepository = createScenarioRepository({ db, logger });
  const scenarioService = createScenarioService({
    scenarioRepository,
    ruleEngineService,
    rabbitMQ,
    logger,
  });

  const app = new OpenAPIHono<{ Variables: ContextVariables }>();

  app.use("*", requestId());
  app.use(
    "*",
    cors({
      origin: ["http://localhost:3000"],
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization"],
      credentials: true,
    }),
  );
  app.use("*", async (c, next) => {
    c.set("db", db);
    c.set("logger", logger);
    await next();
  });

  app.get("/health", (c) => c.text("OK"));
  app.get(`${BASE_PATH}/doc`, swaggerUI({ url: `${BASE_PATH}/openapi.json` }));

  app.doc(`${BASE_PATH}/openapi.json`, {
    openapi: "3.0.0",
    info: { version: "1.0.0", title: "UserCore Scenarios API" },
  });

  app.onError((err, c) => {
    logger.error({ msg: "Unhandled error", error: err });
    return c.json({ error: err.message }, 500);
  });

  return app
    .openapi(
      createRoute({
        method: "get",
        path: `${BASE_PATH}/workspace/:workspaceId`,
        tags: ["scenarios"],
        request: { params: z.object({ workspaceId: z.string() }) },
        responses: {
          200: {
            content: {
              "application/json": { schema: z.array(ScenarioSchema) },
            },
            description: "Scenarios",
          },
        },
      }),
      async (c) => {
        const { workspaceId } = c.req.valid("param");
        const scenarios = await scenarioService.listScenarios(workspaceId);
        return c.json(scenarios.map(serializeScenario), 200);
      },
    )
    .openapi(
      createRoute({
        method: "post",
        path: BASE_PATH,
        tags: ["scenarios"],
        request: {
          body: {
            content: {
              "application/json": {
                schema: z.object({
                  workspaceId: z.string(),
                  name: z.string().min(1).max(120),
                  description: z.string().optional(),
                  createdBy: z.string().optional(),
                }),
              },
            },
          },
        },
        responses: {
          201: {
            content: { "application/json": { schema: ScenarioSchema } },
            description: "Created",
          },
        },
      }),
      async (c) => {
        const body = c.req.valid("json");
        const scenario = await scenarioService.createScenario(body);
        return c.json(serializeScenario(scenario!), 201);
      },
    )
    .openapi(
      createRoute({
        method: "get",
        path: `${BASE_PATH}/:id`,
        tags: ["scenarios"],
        request: { params: z.object({ id: z.string() }) },
        responses: {
          200: {
            content: { "application/json": { schema: ScenarioSchema } },
            description: "Scenario",
          },
          404: {
            content: { "application/json": { schema: ErrorSchema } },
            description: "Not found",
          },
        },
      }),
      async (c) => {
        const { id } = c.req.valid("param");
        const scenario = await scenarioService.getScenario(id);
        if (!scenario) return c.json({ error: "Scenario not found" }, 404);
        return c.json(serializeScenario(scenario), 200);
      },
    )
    .openapi(
      createRoute({
        method: "patch",
        path: `${BASE_PATH}/:id`,
        tags: ["scenarios"],
        request: {
          params: z.object({ id: z.string() }),
          body: {
            content: {
              "application/json": {
                schema: z.object({
                  name: z.string().min(1).max(120).optional(),
                  description: z.string().nullable().optional(),
                  evaluation: ScenarioEvaluationSchema.optional(),
                  actions: z.array(ScenarioActionConfigSchema).optional(),
                }),
              },
            },
          },
        },
        responses: {
          200: {
            content: { "application/json": { schema: ScenarioSchema } },
            description: "Updated",
          },
        },
      }),
      async (c) => {
        const { id } = c.req.valid("param");
        const body = c.req.valid("json");
        const scenario = await scenarioService.updateScenario(id, body);
        return c.json(serializeScenario(scenario!), 200);
      },
    )
    .openapi(
      createRoute({
        method: "delete",
        path: `${BASE_PATH}/:id`,
        tags: ["scenarios"],
        request: { params: z.object({ id: z.string() }) },
        responses: { 204: { description: "Deleted" } },
      }),
      async (c) => {
        const { id } = c.req.valid("param");
        await scenarioService.deleteScenario(id);
        return c.body(null, 204);
      },
    )
    .openapi(
      createRoute({
        method: "post",
        path: `${BASE_PATH}/evaluate`,
        tags: ["evaluation"],
        request: {
          body: {
            content: {
              "application/json": {
                schema: z.object({
                  workspaceId: z.string(),
                  customerId: z.string(),
                  customerData: z.record(z.unknown()),
                }),
              },
            },
          },
        },
        responses: {
          200: {
            content: {
              "application/json": {
                schema: z.object({ evaluated: z.boolean() }),
              },
            },
            description: "Evaluated",
          },
        },
      }),
      async (c) => {
        const body = c.req.valid("json");
        await scenarioService.evaluateScenariosForCustomer({
          workspaceId: body.workspaceId,
          customerId: body.customerId,
          customerData: body.customerData as Record<
            string,
            string | number | boolean | null | undefined
          >,
        });
        return c.json({ evaluated: true }, 200);
      },
    );
};

// Operator enum re-export to keep old imports happy if any external service
// still references it.
export { RuleOperatorEnum };
