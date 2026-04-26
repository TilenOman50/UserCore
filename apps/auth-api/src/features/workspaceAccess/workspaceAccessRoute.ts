import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { and, eq } from "drizzle-orm";

import { generateId } from "@usercore/shared-types";

import type { Auth } from "../../betterauth";
import { member } from "../../db/auth.db";
import type { Database } from "../../db/db";
import { WorkspaceTable } from "../../db/schema.db";
import type { ContextVariables } from "../../types";
import type { WorkspaceAccessRepository } from "./workspaceAccessRepository";

const AccessSchema = z.object({
  id: z.string(),
  userId: z.string(),
  userName: z.string(),
  userEmail: z.string(),
  createdAt: z.string(),
});

const ErrorSchema = z.object({ error: z.string() });

type AuthCheck =
  | { ok: false; error: string; status: 401 | 403 | 404 }
  | {
      ok: true;
      organizationId: string;
      callerRole: string;
      callerMemberId: string;
    };

const requireWorkspaceManager = async (props: {
  auth: Auth;
  db: Database;
  headers: Headers;
  workspaceId: string;
}): Promise<AuthCheck> => {
  const session = await props.auth.api.getSession({ headers: props.headers });
  if (!session) return { ok: false, error: "Unauthorized", status: 401 };

  const workspaceRow = await props.db.query.WorkspaceTable.findFirst({
    where: eq(WorkspaceTable.id, props.workspaceId),
  });
  if (!workspaceRow) {
    return { ok: false, error: "Workspace not found", status: 404 };
  }

  const callerMember = await props.db.query.member.findFirst({
    where: and(
      eq(member.userId, session.user.id),
      eq(member.organizationId, workspaceRow.organizationId),
    ),
  });
  if (
    !callerMember ||
    (callerMember.role !== "owner" && callerMember.role !== "admin")
  ) {
    return { ok: false, error: "Forbidden", status: 403 };
  }

  return {
    ok: true,
    organizationId: workspaceRow.organizationId,
    callerRole: callerMember.role,
    callerMemberId: callerMember.id,
  };
};

export const createWorkspaceAccessRouter = (props: {
  workspaceAccessRepository: WorkspaceAccessRepository;
  auth: Auth;
  db: Database;
}) => {
  const { workspaceAccessRepository, auth, db } = props;

  return new OpenAPIHono<{ Variables: ContextVariables }>()
    .openapi(
      createRoute({
        method: "get",
        path: "/workspaces/:workspaceId/access",
        tags: ["workspace-access"],
        request: { params: z.object({ workspaceId: z.string() }) },
        responses: {
          200: {
            content: {
              "application/json": { schema: z.array(AccessSchema) },
            },
            description: "Members with access",
          },
          401: {
            content: { "application/json": { schema: ErrorSchema } },
            description: "Unauthorized",
          },
          403: {
            content: { "application/json": { schema: ErrorSchema } },
            description: "Forbidden",
          },
          404: {
            content: { "application/json": { schema: ErrorSchema } },
            description: "Not found",
          },
        },
      }),
      async (c) => {
        const { workspaceId } = c.req.valid("param");
        const check = await requireWorkspaceManager({
          auth,
          db,
          headers: c.req.raw.headers,
          workspaceId,
        });
        if (!check.ok) {
          return c.json({ error: check.error }, check.status);
        }

        const rows =
          await workspaceAccessRepository.listAccessForWorkspace(workspaceId);
        return c.json(
          rows.map((r) => ({
            id: r.id,
            userId: r.userId,
            userName: r.userName,
            userEmail: r.userEmail,
            createdAt: r.createdAt.toISOString(),
          })),
          200,
        );
      },
    )
    .openapi(
      createRoute({
        method: "post",
        path: "/workspaces/:workspaceId/access",
        tags: ["workspace-access"],
        request: {
          params: z.object({ workspaceId: z.string() }),
          body: {
            content: {
              "application/json": {
                schema: z.object({ userId: z.string() }),
              },
            },
          },
        },
        responses: {
          201: {
            content: {
              "application/json": {
                schema: z.object({ id: z.string(), userId: z.string() }),
              },
            },
            description: "Access granted",
          },
          200: {
            content: {
              "application/json": { schema: z.object({ id: z.string() }) },
            },
            description: "Already had access",
          },
          401: {
            content: { "application/json": { schema: ErrorSchema } },
            description: "Unauthorized",
          },
          403: {
            content: { "application/json": { schema: ErrorSchema } },
            description: "Forbidden",
          },
          404: {
            content: { "application/json": { schema: ErrorSchema } },
            description: "Not found",
          },
        },
      }),
      async (c) => {
        const { workspaceId } = c.req.valid("param");
        const body = c.req.valid("json");
        const check = await requireWorkspaceManager({
          auth,
          db,
          headers: c.req.raw.headers,
          workspaceId,
        });
        if (!check.ok) {
          return c.json({ error: check.error }, check.status);
        }

        // Validate target user is a member of the same org
        const targetMember = await db.query.member.findFirst({
          where: and(
            eq(member.userId, body.userId),
            eq(member.organizationId, check.organizationId),
          ),
        });
        if (!targetMember) {
          return c.json(
            { error: "Target user is not a member of this organization" },
            403,
          );
        }

        const created = await workspaceAccessRepository.grantAccess({
          id: generateId("workspaceaccess"),
          workspaceId,
          userId: body.userId,
          createdBy: check.callerMemberId,
        });

        if (!created) {
          // Already had access — idempotent response
          return c.json({ id: "" }, 200);
        }
        return c.json({ id: created.id, userId: created.userId }, 201);
      },
    )
    .openapi(
      createRoute({
        method: "delete",
        path: "/workspaces/:workspaceId/access/:userId",
        tags: ["workspace-access"],
        request: {
          params: z.object({
            workspaceId: z.string(),
            userId: z.string(),
          }),
        },
        responses: {
          204: { description: "Revoked" },
          401: {
            content: { "application/json": { schema: ErrorSchema } },
            description: "Unauthorized",
          },
          403: {
            content: { "application/json": { schema: ErrorSchema } },
            description: "Forbidden",
          },
          404: {
            content: { "application/json": { schema: ErrorSchema } },
            description: "Not found",
          },
        },
      }),
      async (c) => {
        const { workspaceId, userId } = c.req.valid("param");
        const check = await requireWorkspaceManager({
          auth,
          db,
          headers: c.req.raw.headers,
          workspaceId,
        });
        if (!check.ok) {
          return c.json({ error: check.error }, check.status);
        }

        await workspaceAccessRepository.revokeAccess(workspaceId, userId);
        return c.body(null, 204);
      },
    );
};
