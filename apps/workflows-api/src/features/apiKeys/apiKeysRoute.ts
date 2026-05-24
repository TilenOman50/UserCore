import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

import type { ApiKey } from "../../db/schema.db";
import type { ContextVariables } from "../../types";
import type { ApiKeysService } from "./apiKeysService";

// Metadata shape — never includes the hash or the raw secret.
const ApiKeySchema = z.object({
  id: z.string(),
  name: z.string(),
  keyPrefix: z.string(),
  lastUsedAt: z.string().nullable(),
  createdAt: z.string(),
});

// Create echoes the raw secret exactly once.
const CreatedApiKeySchema = ApiKeySchema.extend({ secret: z.string() });

const serialize = (k: ApiKey) => ({
  id: k.id,
  name: k.name,
  keyPrefix: k.keyPrefix,
  lastUsedAt: k.lastUsedAt ? k.lastUsedAt.toISOString() : null,
  createdAt: k.createdAt.toISOString(),
});

export const createApiKeysRouter = (props: {
  apiKeysService: ApiKeysService;
}) => {
  const { apiKeysService } = props;

  return new OpenAPIHono<{ Variables: ContextVariables }>()
    .openapi(
      createRoute({
        method: "get",
        path: "/api-keys",
        tags: ["api-keys"],
        request: { query: z.object({ workspaceId: z.string() }) },
        responses: {
          200: {
            content: { "application/json": { schema: z.array(ApiKeySchema) } },
            description: "Active API keys for the workspace",
          },
        },
      }),
      async (c) => {
        const { workspaceId } = c.req.valid("query");
        const rows = await apiKeysService.list(workspaceId);
        return c.json(rows.map(serialize), 200);
      },
    )
    .openapi(
      createRoute({
        method: "post",
        path: "/api-keys",
        tags: ["api-keys"],
        request: {
          body: {
            content: {
              "application/json": {
                schema: z.object({
                  workspaceId: z.string(),
                  organizationId: z.string(),
                  name: z.string().min(1).max(80),
                  createdBy: z.string().nullable().optional(),
                }),
              },
            },
          },
        },
        responses: {
          201: {
            content: { "application/json": { schema: CreatedApiKeySchema } },
            description: "Created key — secret returned once",
          },
        },
      }),
      async (c) => {
        const body = c.req.valid("json");
        const { key, secret } = await apiKeysService.create(body);
        return c.json({ ...serialize(key), secret }, 201);
      },
    )
    .openapi(
      createRoute({
        method: "delete",
        path: "/api-keys/{id}",
        tags: ["api-keys"],
        request: {
          params: z.object({ id: z.string() }),
          query: z.object({ workspaceId: z.string() }),
        },
        responses: {
          204: { description: "Revoked" },
          404: {
            content: {
              "application/json": { schema: z.object({ error: z.string() }) },
            },
            description: "Not found in this workspace",
          },
        },
      }),
      async (c) => {
        const { id } = c.req.valid("param");
        const { workspaceId } = c.req.valid("query");
        const ok = await apiKeysService.revoke({ id, workspaceId });
        if (!ok) return c.json({ error: "API key not found" }, 404);
        return c.body(null, 204);
      },
    );
};
