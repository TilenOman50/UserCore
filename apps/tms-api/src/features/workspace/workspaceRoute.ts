import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

import type { ContextVariables } from "../../types";
import type { WorkspaceService } from "./workspaceService";

const WorkspaceSettingsSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  displayName: z.string().nullable(),
  logoUrl: z.string().nullable(),
  primaryColor: z.string().nullable(),
  metadata: z.any(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const UpdateSettingsSchema = z.object({
  displayName: z.string().optional(),
  logoUrl: z.string().url().optional(),
  primaryColor: z.string().optional(),
});

export const createWorkspaceRouter = (props: {
  workspaceService: WorkspaceService;
}) => {
  const { workspaceService } = props;

  return new OpenAPIHono<{ Variables: ContextVariables }>()
    .openapi(
      createRoute({
        method: "get",
        path: "/workspaces/:workspaceId/settings",
        tags: ["workspace"],
        request: { params: z.object({ workspaceId: z.string() }) },
        responses: {
          200: {
            content: {
              "application/json": { schema: WorkspaceSettingsSchema },
            },
            description: "Workspace settings",
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
        const { workspaceId } = c.req.valid("param");
        const settings = await workspaceService.getSettings(workspaceId);
        if (!settings) {
          return c.json({ error: "Workspace settings not found" }, 404);
        }
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
        method: "patch",
        path: "/workspaces/:workspaceId/settings",
        tags: ["workspace"],
        request: {
          params: z.object({ workspaceId: z.string() }),
          body: {
            content: { "application/json": { schema: UpdateSettingsSchema } },
          },
        },
        responses: {
          200: {
            content: {
              "application/json": { schema: WorkspaceSettingsSchema },
            },
            description: "Updated",
          },
        },
      }),
      async (c) => {
        const { workspaceId } = c.req.valid("param");
        const body = c.req.valid("json");
        const settings = await workspaceService.updateSettings({
          workspaceId,
          ...body,
        });
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
