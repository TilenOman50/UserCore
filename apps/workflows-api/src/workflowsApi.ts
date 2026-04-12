import { swaggerUI } from "@hono/swagger-ui";
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { requestId } from "hono/request-id";

import type { Logger } from "@usercore/logger";
import type { RabbitMQClient } from "@usercore/rabbitmq";

import type { Database } from "./db/db";
import { KycDocumentTable } from "./db/schema.db";
import { createDocumentRepository } from "./features/documents/documentRepository";
import { createDocumentService } from "./features/documents/documentService";
import { createKycSessionRepository } from "./features/kycSessions/kycSessionRepository";
import { createKycSessionService } from "./features/kycSessions/kycSessionService";
import { createLivenessRepository } from "./features/liveness/livenessRepository";
import { createLivenessService } from "./features/liveness/livenessService";
import { createReviewRepository } from "./features/review/reviewRepository";
import { createReviewService } from "./features/review/reviewService";
import { createStorageService } from "./storage/storageService";
import type { ContextVariables } from "./types";

const BASE_PATH = "/workflows";

export const createWorkflowsApi = (props: {
  db: Database;
  logger: Logger;
  rabbitMQ: RabbitMQClient;
}) => {
  const { db, logger, rabbitMQ } = props;

  // Storage
  const storageService = createStorageService({ logger });

  // Repositories
  const kycSessionRepository = createKycSessionRepository({ db, logger });
  const documentRepository = createDocumentRepository({ db, logger });
  const livenessRepository = createLivenessRepository({ db, logger });
  const reviewRepository = createReviewRepository({ db, logger });

  // Services
  const kycSessionService = createKycSessionService({ kycSessionRepository, logger });
  const documentService = createDocumentService({ documentRepository, storageService, logger });
  const livenessService = createLivenessService({ livenessRepository, logger });
  const reviewService = createReviewService({ reviewRepository, kycSessionService, rabbitMQ, logger });

  const SessionSchema = z.object({
    id: z.string(),
    userId: z.string(),
    workspaceId: z.string(),
    status: z.string(),
    firstName: z.string().nullable(),
    lastName: z.string().nullable(),
    country: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  });

  const app = new OpenAPIHono<{ Variables: ContextVariables }>()
    .use("*", requestId())
    .use("*", cors({
      origin: ["http://localhost:3000", "http://localhost:3007"],
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization"],
      credentials: true,
    }))
    .use("*", async (c, next) => {
      c.set("db", db);
      c.set("logger", logger);
      await next();
    })
    .get("/health", (c) => c.text("OK"))
    .get(`${BASE_PATH}/doc`, swaggerUI({ url: `${BASE_PATH}/openapi.json` }))

    // KYC Sessions
    .openapi(
      createRoute({
        method: "post",
        path: `${BASE_PATH}/kyc-sessions`,
        tags: ["kyc-sessions"],
        request: { body: { content: { "application/json": { schema: z.object({ userId: z.string(), workspaceId: z.string() }) } } } },
        responses: { 201: { content: { "application/json": { schema: SessionSchema } }, description: "Session started" } },
      }),
      async (c) => {
        const body = c.req.valid("json");
        const session = await kycSessionService.startSession(body);
        return c.json({ ...session!, createdAt: session!.createdAt.toISOString(), updatedAt: session!.updatedAt.toISOString() }, 201);
      },
    )
    .openapi(
      createRoute({
        method: "get",
        path: `${BASE_PATH}/kyc-sessions/:id`,
        tags: ["kyc-sessions"],
        request: { params: z.object({ id: z.string() }) },
        responses: { 200: { content: { "application/json": { schema: SessionSchema } }, description: "Session" } },
      }),
      async (c) => {
        const { id } = c.req.valid("param");
        const session = await kycSessionService.getSession(id);
        return c.json({ ...session, createdAt: session.createdAt.toISOString(), updatedAt: session.updatedAt.toISOString() });
      },
    )
    .openapi(
      createRoute({
        method: "get",
        path: `${BASE_PATH}/kyc-sessions/workspace/:workspaceId`,
        tags: ["kyc-sessions"],
        request: { params: z.object({ workspaceId: z.string() }) },
        responses: { 200: { content: { "application/json": { schema: z.array(SessionSchema) } }, description: "Sessions" } },
      }),
      async (c) => {
        const { workspaceId } = c.req.valid("param");
        const sessions = await kycSessionService.listByWorkspace(workspaceId);
        return c.json(sessions.map(s => ({ ...s, createdAt: s.createdAt.toISOString(), updatedAt: s.updatedAt.toISOString() })));
      },
    )
    .openapi(
      createRoute({
        method: "patch",
        path: `${BASE_PATH}/kyc-sessions/:id/form`,
        tags: ["kyc-sessions"],
        request: {
          params: z.object({ id: z.string() }),
          body: { content: { "application/json": { schema: z.object({ firstName: z.string(), lastName: z.string(), dateOfBirth: z.string(), nationality: z.string(), address: z.string(), city: z.string(), country: z.string() }) } } },
        },
        responses: { 200: { content: { "application/json": { schema: SessionSchema } }, description: "Updated" } },
      }),
      async (c) => {
        const { id } = c.req.valid("param");
        const body = c.req.valid("json");
        const session = await kycSessionService.submitFormData(id, body);
        return c.json({ ...session!, createdAt: session!.createdAt.toISOString(), updatedAt: session!.updatedAt.toISOString() });
      },
    )
    .openapi(
      createRoute({
        method: "post",
        path: `${BASE_PATH}/kyc-sessions/:id/submit`,
        tags: ["kyc-sessions"],
        request: { params: z.object({ id: z.string() }) },
        responses: { 200: { content: { "application/json": { schema: SessionSchema } }, description: "Submitted" } },
      }),
      async (c) => {
        const { id } = c.req.valid("param");
        const session = await kycSessionService.submitSession(id);
        return c.json({ ...session!, createdAt: session!.createdAt.toISOString(), updatedAt: session!.updatedAt.toISOString() });
      },
    )

    // Documents — multipart upload
    .post(`${BASE_PATH}/kyc-sessions/:id/documents`, async (c) => {
      const { id } = c.req.param();
      const formData = await c.req.formData();
      const file = formData.get("file") as File | null;
      const documentType = formData.get("documentType") as string | null;

      if (!file || !documentType) {
        return c.json({ error: "file and documentType are required" }, 400);
      }

      const validTypes = ["passport", "national_id", "drivers_license"];
      if (!validTypes.includes(documentType)) {
        return c.json({ error: "Invalid document type" }, 400);
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const doc = await documentService.uploadDocument({
        kycSessionId: id,
        documentType: documentType as typeof KycDocumentTable.$inferInsert.documentType,
        fileBuffer: buffer,
        originalFilename: file.name,
        mimeType: file.type,
      });

      return c.json({ ...doc!, createdAt: doc!.createdAt.toISOString() }, 201);
    })

    // Liveness
    .openapi(
      createRoute({
        method: "post",
        path: `${BASE_PATH}/kyc-sessions/:id/liveness`,
        tags: ["liveness"],
        request: {
          params: z.object({ id: z.string() }),
          body: { content: { "application/json": { schema: z.object({ passed: z.boolean(), confidence: z.number().optional(), checks: z.array(z.string()).optional() }) } } },
        },
        responses: { 201: { content: { "application/json": { schema: z.object({ id: z.string(), passed: z.boolean(), createdAt: z.string() }) } }, description: "Saved" } },
      }),
      async (c) => {
        const { id } = c.req.valid("param");
        const body = c.req.valid("json");
        const result = await livenessService.saveLivenessResult({ kycSessionId: id, ...body });
        return c.json({ id: result!.id, passed: result!.passed, createdAt: result!.createdAt.toISOString() }, 201);
      },
    )

    // Review (admin)
    .openapi(
      createRoute({
        method: "post",
        path: `${BASE_PATH}/kyc-sessions/:id/review`,
        tags: ["review"],
        request: {
          params: z.object({ id: z.string() }),
          body: { content: { "application/json": { schema: z.object({ reviewedBy: z.string(), decision: z.enum(["approved", "rejected"]), reason: z.string().optional() }) } } },
        },
        responses: { 201: { content: { "application/json": { schema: z.object({ id: z.string(), decision: z.string(), createdAt: z.string() }) } }, description: "Review submitted" } },
      }),
      async (c) => {
        const { id } = c.req.valid("param");
        const body = c.req.valid("json");
        const review = await reviewService.submitReview({ kycSessionId: id, ...body });
        return c.json({ id: review!.id, decision: review!.decision, createdAt: review!.createdAt.toISOString() }, 201);
      },
    )

    .doc(`${BASE_PATH}/openapi.json`, {
      openapi: "3.0.0",
      info: { version: "1.0.0", title: "UserCore Workflows API" },
    })
    .onError((err, c) => {
      logger.error({ msg: "Unhandled error", error: err });
      return c.json({ error: err.message }, 500);
    });

  return app;
};
