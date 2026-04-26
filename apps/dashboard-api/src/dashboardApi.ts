import { swaggerUI } from "@hono/swagger-ui";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { cors } from "hono/cors";
import { requestId } from "hono/request-id";

import type { Logger } from "@usercore/logger";

import type { Database } from "./db/db";
import { DashboardMemberSettingsTable } from "./db/schema.db";
import type { ContextVariables } from "./types";

const BASE_PATH = "/dashboard-api";

const MemberSettingsSchema = z.object({
  id: z.string(),
  memberId: z.string(),
  workspaceId: z.string(),
  preferences: z.any(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const createDashboardApi = (props: { db: Database; logger: Logger }) => {
  const { db, logger } = props;

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
    info: { version: "1.0.0", title: "UserCore Dashboard API" },
  });

  app.onError((err, c) => {
    logger.error({ msg: "Unhandled error", error: err });
    return c.json({ error: err.message }, 500);
  });

  return app
    .openapi(
      createRoute({
        method: "get",
        path: `${BASE_PATH}/members/:memberId/settings`,
        tags: ["members"],
        request: { params: z.object({ memberId: z.string() }) },
        responses: {
          200: {
            content: { "application/json": { schema: MemberSettingsSchema } },
            description: "Settings",
          },
          404: {
            content: {
              "application/json": { schema: z.object({ error: z.string() }) },
            },
            description: "Not found",
          },
        },
      }),
      async (c) => {
        const { memberId } = c.req.valid("param");
        const settings = await db.query.DashboardMemberSettingsTable.findFirst({
          where: eq(DashboardMemberSettingsTable.memberId, memberId),
        });
        if (!settings) return c.json({ error: "Not found" }, 404);
        return c.json(
          {
            ...settings,
            createdAt: settings.createdAt.toISOString(),
            updatedAt: settings.updatedAt.toISOString(),
          },
          200,
        );
      },
    )
    .openapi(
      createRoute({
        method: "put",
        path: `${BASE_PATH}/members/:memberId/settings`,
        tags: ["members"],
        request: {
          params: z.object({ memberId: z.string() }),
          body: {
            content: {
              "application/json": {
                schema: z.object({
                  workspaceId: z.string(),
                  preferences: z.record(z.unknown()).optional(),
                }),
              },
            },
          },
        },
        responses: {
          200: {
            content: { "application/json": { schema: MemberSettingsSchema } },
            description: "Upserted",
          },
        },
      }),
      async (c) => {
        const { memberId } = c.req.valid("param");
        const body = c.req.valid("json");
        const [settings] = await db
          .insert(DashboardMemberSettingsTable)
          .values({
            memberId,
            workspaceId: body.workspaceId,
            preferences: body.preferences,
          })
          .onConflictDoUpdate({
            target: DashboardMemberSettingsTable.memberId,
            set: { preferences: body.preferences, updatedAt: new Date() },
          })
          .returning();
        return c.json(
          {
            ...settings!,
            createdAt: settings!.createdAt.toISOString(),
            updatedAt: settings!.updatedAt.toISOString(),
          },
          200,
        );
      },
    );
};
