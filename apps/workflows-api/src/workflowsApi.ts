import { swaggerUI } from "@hono/swagger-ui";
import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { requestId } from "hono/request-id";

import type { Logger } from "@usercore/logger";
import type { RabbitMQClient } from "@usercore/rabbitmq";

import type { Database } from "./db/db";
import { env } from "./env";
import { createAmlScreeningRepository } from "./features/amlScreening/amlScreeningRepository";
import { createAmlScreeningRouter } from "./features/amlScreening/amlScreeningRoute";
import { createAmlScreeningService } from "./features/amlScreening/amlScreeningService";
import { createDuplicateDetectionRepository } from "./features/duplicateDetection/duplicateDetectionRepository";
import { createDuplicateDetectionRouter } from "./features/duplicateDetection/duplicateDetectionRoute";
import { createDuplicateDetectionService } from "./features/duplicateDetection/duplicateDetectionService";
import { createFraudDetectionRepository } from "./features/fraudDetection/fraudDetectionRepository";
import { createFraudDetectionRouter } from "./features/fraudDetection/fraudDetectionRoute";
import { createFraudDetectionService } from "./features/fraudDetection/fraudDetectionService";
import { createIdentityVerificationRepository } from "./features/identityVerification/identityVerificationRepository";
import { createIdentityVerificationRouter } from "./features/identityVerification/identityVerificationRoute";
import { createIdentityVerificationService } from "./features/identityVerification/identityVerificationService";
import { createIdentityWidgetRepository } from "./features/identityWidget/identityWidgetRepository";
import { createIdentityWidgetRouter } from "./features/identityWidget/identityWidgetRoute";
import { createIdentityWidgetService } from "./features/identityWidget/identityWidgetService";
import { createPlanClient } from "./features/plans/planClient";
import { createRulesEngineRepository } from "./features/rulesEngine/rulesEngineRepository";
import { createRulesEngineRouter } from "./features/rulesEngine/rulesEngineRoute";
import { createRulesEngineService } from "./features/rulesEngine/rulesEngineService";
import { createWorkflowsRepository } from "./features/workflows/workflowsRepository";
import { createWorkflowsRouter } from "./features/workflows/workflowsRoute";
import { createWorkflowsService } from "./features/workflows/workflowsService";
import { registerProviderCheckCompletedConsumer } from "./features/workflowSessions/providerCheckCompletedConsumer";
import { createComplyAdvantageCheckCompletedService } from "./features/workflowSessions/providerCheckCompletedServices/complyAdvantageCheckCompletedService";
import { createIdenfyCheckCompletedService } from "./features/workflowSessions/providerCheckCompletedServices/idenfyCheckCompletedService";
import { createIpQualityScoreCheckCompletedService } from "./features/workflowSessions/providerCheckCompletedServices/ipQualityScoreCheckCompletedService";
import { createWorkflowSessionAttributesRepository } from "./features/workflowSessions/workflowSessionAttributesRepository";
import { createWorkflowSessionsRepository } from "./features/workflowSessions/workflowSessionsRepository";
import { createWorkflowSessionsRouter } from "./features/workflowSessions/workflowSessionsRoute";
import { createWorkflowSessionsService } from "./features/workflowSessions/workflowSessionsService";
import { createWorkflowSessionStepsRepository } from "./features/workflowSessions/workflowSessionStepsRepository";
import { createWorkflowStepsRepository } from "./features/workflowSteps/workflowStepsRepository";
import { createStorageService } from "./storage/storageService";
import type { ContextVariables } from "./types";

const BASE_PATH = "/workflows";

export const createWorkflowsApi = async (props: {
  db: Database;
  logger: Logger;
  rabbitMQ: RabbitMQClient;
}) => {
  const { db, logger, rabbitMQ } = props;

  const storageService = createStorageService({ logger });

  // Repositories
  const workflowsRepository = createWorkflowsRepository({ db, logger });
  const workflowStepsRepository = createWorkflowStepsRepository({ db, logger });
  const identityVerificationRepository = createIdentityVerificationRepository({
    db,
    logger,
  });
  const amlScreeningRepository = createAmlScreeningRepository({ db, logger });
  const fraudDetectionRepository = createFraudDetectionRepository({
    db,
    logger,
  });
  const duplicateDetectionRepository = createDuplicateDetectionRepository({
    db,
    logger,
  });
  const rulesEngineRepository = createRulesEngineRepository({ db, logger });
  const identityWidgetRepository = createIdentityWidgetRepository({
    db,
    logger,
  });
  const workflowSessionsRepository = createWorkflowSessionsRepository({
    db,
    logger,
  });
  const workflowSessionStepsRepository = createWorkflowSessionStepsRepository({
    db,
    logger,
  });
  const workflowSessionAttributesRepository =
    createWorkflowSessionAttributesRepository({ db, logger });

  // Services
  const workflowsService = createWorkflowsService({
    workflowsRepository,
    workflowStepsRepository,
    logger,
  });
  const identityVerificationService = createIdentityVerificationService({
    identityVerificationRepository,
    workflowStepsRepository,
    workflowsService,
    logger,
  });
  const amlScreeningService = createAmlScreeningService({
    amlScreeningRepository,
    workflowStepsRepository,
    workflowsService,
    logger,
  });
  const fraudDetectionService = createFraudDetectionService({
    fraudDetectionRepository,
    workflowStepsRepository,
    workflowsService,
    logger,
  });
  const duplicateDetectionService = createDuplicateDetectionService({
    duplicateDetectionRepository,
    workflowStepsRepository,
    workflowsService,
    logger,
  });
  const rulesEngineService = createRulesEngineService({
    rulesEngineRepository,
    workflowStepsRepository,
    workflowsService,
    logger,
  });
  const identityWidgetService = createIdentityWidgetService({
    identityWidgetRepository,
    storageService,
    logger,
  });
  const planClient = createPlanClient({
    authApiUrl: env.AUTH_API_URL,
    logger,
  });
  const workflowSessionsService = createWorkflowSessionsService({
    workflowSessionsRepository,
    workflowSessionStepsRepository,
    workflowSessionAttributesRepository,
    workflowsRepository,
    storageService,
    planClient,
    rabbitMQ,
    logger,
  });

  // Provider check-completed handlers — consume responses from providers-api
  // and write them into session steps + attributes (EAV).
  const idenfyCheckCompletedService = createIdenfyCheckCompletedService({
    workflowSessionsService,
    logger,
  });
  const complyAdvantageCheckCompletedService =
    createComplyAdvantageCheckCompletedService({
      workflowSessionsService,
      logger,
    });
  const ipQualityScoreCheckCompletedService =
    createIpQualityScoreCheckCompletedService({
      workflowSessionsService,
      logger,
    });
  await registerProviderCheckCompletedConsumer({
    rabbitMQ,
    idenfyCheckCompletedService,
    complyAdvantageCheckCompletedService,
    ipQualityScoreCheckCompletedService,
    logger,
  });

  // Routers
  const workflowsRouter = createWorkflowsRouter({ workflowsService });
  const identityVerificationRouter = createIdentityVerificationRouter({
    identityVerificationService,
  });
  const amlScreeningRouter = createAmlScreeningRouter({ amlScreeningService });
  const fraudDetectionRouter = createFraudDetectionRouter({
    fraudDetectionService,
  });
  const duplicateDetectionRouter = createDuplicateDetectionRouter({
    duplicateDetectionService,
  });
  const rulesEngineRouter = createRulesEngineRouter({ rulesEngineService });
  const identityWidgetRouter = createIdentityWidgetRouter({
    identityWidgetService,
  });
  const workflowSessionsRouter = createWorkflowSessionsRouter({
    workflowSessionsService,
  });

  const app = new OpenAPIHono<{ Variables: ContextVariables }>();

  app.use("*", requestId());
  app.use(
    "*",
    cors({
      origin: ["http://localhost:3000", "http://localhost:3007"],
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
    info: { version: "1.0.0", title: "UserCore Workflows API" },
  });

  app.onError((err, c) => {
    logger.error({ msg: "Unhandled error", error: err });
    return c.json({ error: err.message }, 500);
  });

  return app
    .route(BASE_PATH, workflowsRouter)
    .route(BASE_PATH, identityVerificationRouter)
    .route(BASE_PATH, amlScreeningRouter)
    .route(BASE_PATH, fraudDetectionRouter)
    .route(BASE_PATH, duplicateDetectionRouter)
    .route(BASE_PATH, rulesEngineRouter)
    .route(BASE_PATH, identityWidgetRouter)
    .route(BASE_PATH, workflowSessionsRouter);
};
