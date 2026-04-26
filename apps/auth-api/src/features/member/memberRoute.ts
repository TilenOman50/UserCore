import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { and, eq } from "drizzle-orm";

import type { Auth } from "../../betterauth";
import { member, organization } from "../../db/auth.db";
import type { Database } from "../../db/db";
import { WorkspaceTable } from "../../db/schema.db";
import type { ContextVariables } from "../../types";
import type { MemberService } from "./memberService";

const MemberSchema = z.object({
  memberId: z.string(),
  role: z.string(),
  createdAt: z.string(),
  userId: z.string(),
  userName: z.string(),
  userEmail: z.string(),
  emailVerified: z.boolean(),
  workspaceAccess: z.array(z.string()),
});

const ErrorSchema = z.object({ error: z.string() });

type AuthCheck =
  | { ok: false; error: string; status: 401 | 403 }
  | {
      ok: true;
      session: NonNullable<Awaited<ReturnType<Auth["api"]["getSession"]>>>;
      callerMember: NonNullable<
        Awaited<ReturnType<Database["query"]["member"]["findFirst"]>>
      >;
    };

const requireOwnerOrAdmin = async (props: {
  auth: Auth;
  db: Database;
  headers: Headers;
  organizationId: string;
}): Promise<AuthCheck> => {
  const session = await props.auth.api.getSession({ headers: props.headers });
  if (!session) return { ok: false, error: "Unauthorized", status: 401 };

  const callerMember = await props.db.query.member.findFirst({
    where: and(
      eq(member.userId, session.user.id),
      eq(member.organizationId, props.organizationId),
    ),
  });

  if (!callerMember) {
    return { ok: false, error: "Forbidden", status: 403 };
  }

  if (callerMember.role !== "owner" && callerMember.role !== "admin") {
    return {
      ok: false,
      error: "Only owners and admins can manage members",
      status: 403,
    };
  }

  return { ok: true, session, callerMember };
};

export const createMemberRouter = (props: {
  memberService: MemberService;
  auth: Auth;
  db: Database;
}) => {
  const { memberService, auth, db } = props;

  return new OpenAPIHono<{ Variables: ContextVariables }>()
    .openapi(
      createRoute({
        method: "get",
        path: "/members",
        tags: ["members"],
        request: {
          query: z.object({
            organizationId: z.string(),
            q: z.string().optional(),
            status: z.enum(["active", "pending"]).optional(),
            role: z.enum(["owner", "admin", "member"]).optional(),
            workspaceId: z.string().optional(),
            page: z.coerce.number().int().min(1).default(1),
            limit: z.coerce.number().int().min(1).max(100).default(10),
          }),
        },
        responses: {
          200: {
            content: {
              "application/json": {
                schema: z.object({
                  items: z.array(MemberSchema),
                  total: z.number().int(),
                  page: z.number().int(),
                  limit: z.number().int(),
                  totalPages: z.number().int(),
                }),
              },
            },
            description: "Members of the organization",
          },
          401: {
            content: { "application/json": { schema: ErrorSchema } },
            description: "Unauthorized",
          },
          403: {
            content: { "application/json": { schema: ErrorSchema } },
            description: "Forbidden",
          },
        },
      }),
      async (c) => {
        const query = c.req.valid("query");
        const auth_check = await requireOwnerOrAdmin({
          auth,
          db,
          headers: c.req.raw.headers,
          organizationId: query.organizationId,
        });
        if (!auth_check.ok) {
          return c.json({ error: auth_check.error }, auth_check.status);
        }

        const { items, total } = await memberService.listMembers({
          organizationId: query.organizationId,
          search: query.q,
          status: query.status,
          role: query.role,
          workspaceId: query.workspaceId,
          page: query.page,
          limit: query.limit,
        });

        return c.json(
          {
            items: items.map((m) => ({
              memberId: m.memberId,
              role: m.role,
              createdAt: m.createdAt.toISOString(),
              userId: m.userId,
              userName: m.userName,
              userEmail: m.userEmail,
              emailVerified: m.emailVerified,
              workspaceAccess: m.workspaceAccess,
            })),
            total,
            page: query.page,
            limit: query.limit,
            totalPages: Math.max(1, Math.ceil(total / query.limit)),
          },
          200,
        );
      },
    )
    .openapi(
      createRoute({
        method: "post",
        path: "/members/invite",
        tags: ["members"],
        request: {
          body: {
            content: {
              "application/json": {
                schema: z.object({
                  organizationId: z.string(),
                  email: z.string().email(),
                  role: z.enum(["owner", "admin", "member"]),
                  workspaceIds: z.array(z.string()).optional(),
                }),
              },
            },
          },
        },
        responses: {
          201: {
            content: {
              "application/json": {
                schema: z.object({ memberId: z.string(), userId: z.string() }),
              },
            },
            description: "Invitation sent",
          },
          400: {
            content: { "application/json": { schema: ErrorSchema } },
            description: "Bad request",
          },
          401: {
            content: { "application/json": { schema: ErrorSchema } },
            description: "Unauthorized",
          },
          403: {
            content: { "application/json": { schema: ErrorSchema } },
            description: "Forbidden",
          },
          409: {
            content: { "application/json": { schema: ErrorSchema } },
            description: "Already a member",
          },
        },
      }),
      async (c) => {
        const body = c.req.valid("json");
        const auth_check = await requireOwnerOrAdmin({
          auth,
          db,
          headers: c.req.raw.headers,
          organizationId: body.organizationId,
        });
        if (!auth_check.ok) {
          return c.json({ error: auth_check.error }, auth_check.status);
        }

        const [orgRow, workspaceRow] = await Promise.all([
          db.query.organization.findFirst({
            where: eq(organization.id, body.organizationId),
          }),
          db.query.WorkspaceTable.findFirst({
            where: eq(WorkspaceTable.organizationId, body.organizationId),
          }),
        ]);

        const result = await memberService.inviteMember({
          email: body.email,
          role: body.role,
          organizationId: body.organizationId,
          workspaceName: workspaceRow?.name ?? orgRow?.name ?? "UserCore",
          inviterName: auth_check.session.user.name,
          inviterMemberId: auth_check.callerMember.id,
          workspaceIds: body.workspaceIds,
        });

        return c.json(
          { memberId: result.member.id, userId: result.user.id },
          201,
        );
      },
    )
    .openapi(
      createRoute({
        method: "patch",
        path: "/members/:memberId/role",
        tags: ["members"],
        request: {
          params: z.object({ memberId: z.string() }),
          body: {
            content: {
              "application/json": {
                schema: z.object({
                  organizationId: z.string(),
                  role: z.enum(["owner", "admin", "member"]),
                }),
              },
            },
          },
        },
        responses: {
          200: {
            content: {
              "application/json": {
                schema: z.object({
                  memberId: z.string(),
                  role: z.string(),
                }),
              },
            },
            description: "Role updated",
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
        const { memberId } = c.req.valid("param");
        const body = c.req.valid("json");
        const auth_check = await requireOwnerOrAdmin({
          auth,
          db,
          headers: c.req.raw.headers,
          organizationId: body.organizationId,
        });
        if (!auth_check.ok) {
          return c.json({ error: auth_check.error }, auth_check.status);
        }

        const updated = await memberService.updateRole({
          memberId,
          newRole: body.role,
          callerRole: auth_check.callerMember.role,
        });
        return c.json({ memberId: updated.id, role: updated.role }, 200);
      },
    )
    .openapi(
      createRoute({
        method: "delete",
        path: "/members/:memberId",
        tags: ["members"],
        request: {
          params: z.object({ memberId: z.string() }),
          query: z.object({ organizationId: z.string() }),
        },
        responses: {
          204: { description: "Removed" },
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
        const { memberId } = c.req.valid("param");
        const { organizationId } = c.req.valid("query");
        const auth_check = await requireOwnerOrAdmin({
          auth,
          db,
          headers: c.req.raw.headers,
          organizationId,
        });
        if (!auth_check.ok) {
          return c.json({ error: auth_check.error }, auth_check.status);
        }

        if (memberId === auth_check.callerMember.id) {
          return c.json({ error: "You cannot remove yourself" }, 403);
        }

        await memberService.removeMember({
          memberId,
          callerRole: auth_check.callerMember.role,
        });
        return c.body(null, 204);
      },
    );
};
