import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

import type { ContextVariables } from "../../types";
import type { WorkspaceService } from "./workspaceService";

const WorkspaceResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  organizationId: z.string(),
  ownerId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const CreateWorkspaceSchema = z.object({
  name: z.string().min(1).max(100),
  organizationId: z.string(),
});

export const createWorkspaceRouter = (props: {
  workspaceService: WorkspaceService;
}) => {
  const { workspaceService } = props;

  return new OpenAPIHono<{ Variables: ContextVariables }>()
    .openapi(
      createRoute({
        method: "post",
        path: "/workspaces",
        tags: ["workspace"],
        request: {
          body: {
            content: {
              "application/json": { schema: CreateWorkspaceSchema },
            },
          },
        },
        responses: {
          201: {
            content: {
              "application/json": { schema: WorkspaceResponseSchema },
            },
            description: "Workspace created",
          },
        },
      }),
      async (c) => {
        const body = c.req.valid("json");
        const logger = c.get("logger");
        const userId = c.get("userId") ?? "unknown";

        const workspace = await workspaceService.createWorkspace({
          name: body.name,
          organizationId: body.organizationId,
          ownerId: userId,
        });

        logger.info({ msg: "POST /workspaces", workspaceId: workspace?.id });
        return c.json(
          {
            ...workspace!,
            createdAt: workspace!.createdAt.toISOString(),
            updatedAt: workspace!.updatedAt.toISOString(),
          },
          201,
        );
      },
    )
    .openapi(
      createRoute({
        method: "get",
        path: "/workspaces/:id",
        tags: ["workspace"],
        request: {
          params: z.object({ id: z.string() }),
        },
        responses: {
          200: {
            content: {
              "application/json": { schema: WorkspaceResponseSchema },
            },
            description: "Workspace found",
          },
          404: {
            content: {
              "application/json": {
                schema: z.object({ error: z.string() }),
              },
            },
            description: "Not found",
          },
        },
      }),
      async (c) => {
        const { id } = c.req.valid("param");
        const workspace = await workspaceService.getWorkspace(id);
        if (!workspace) {
          return c.json({ error: "Workspace not found" }, 404);
        }
        return c.json(
          {
            ...workspace,
            createdAt: workspace.createdAt.toISOString(),
            updatedAt: workspace.updatedAt.toISOString(),
          },
          200,
        );
      },
    );
};
