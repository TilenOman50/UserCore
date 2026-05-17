import { swaggerUI } from "@hono/swagger-ui";
import { OpenAPIHono } from "@hono/zod-openapi";
import { and, count, eq } from "drizzle-orm";
import { cors } from "hono/cors";
import { requestId } from "hono/request-id";

import type { Logger } from "@usercore/logger";
import type { RabbitMQClient } from "@usercore/rabbitmq";
import {
  EVENTS,
  generateId,
  resolveDevCorsOrigin,
} from "@usercore/shared-types";

import type { Auth } from "./betterauth";
import { member, organization, user } from "./db/auth.db";
import type { Database } from "./db/db";
import { WorkspaceAccessTable, WorkspaceTable } from "./db/schema.db";
import { createMemberRepository } from "./features/member/memberRepository";
import { createMemberRouter } from "./features/member/memberRoute";
import { createMemberService } from "./features/member/memberService";
import { createWorkspaceAccessRepository } from "./features/workspaceAccess/workspaceAccessRepository";
import { createWorkspaceAccessRouter } from "./features/workspaceAccess/workspaceAccessRoute";
import type { Mailer } from "./mailer";
import { createRequestMiddleware } from "./middlewares/requestMiddleware";
import type { ContextVariables } from "./types";

const BASE_PATH = "/auth";

export const createAuthApi = (props: {
  db: Database;
  logger: Logger;
  auth: Auth;
  rabbitMQ: RabbitMQClient;
  mailer: Mailer;
}) => {
  const { db, logger, auth, rabbitMQ, mailer } = props;

  const workspaceAccessRepository = createWorkspaceAccessRepository({
    db,
    logger,
  });
  const workspaceAccessRouter = createWorkspaceAccessRouter({
    workspaceAccessRepository,
    auth,
    db,
  });

  const memberRepository = createMemberRepository({ db, logger });
  const memberService = createMemberService({
    memberRepository,
    workspaceAccessRepository,
    mailer,
    logger,
  });
  const memberRouter = createMemberRouter({ memberService, auth, db });

  const app = new OpenAPIHono<{ Variables: ContextVariables }>();

  app.doc(`${BASE_PATH}/openapi.json`, {
    openapi: "3.0.0",
    info: { version: "1.0.0", title: "UserCore Auth API" },
  });

  app.onError((err, c) => {
    logger.error({ msg: "Unhandled error", error: err });
    return c.json({ error: err.message }, 500);
  });

  return (
    app
      .use("*", requestId())
      .use(
        "*",
        cors({
          origin: resolveDevCorsOrigin,
          allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
          allowHeaders: ["Content-Type", "Authorization"],
          credentials: true,
        }),
      )
      .use("*", createRequestMiddleware({ db, logger }))
      .get("/health", (c) => c.text("OK"))
      .get(`${BASE_PATH}/doc`, swaggerUI({ url: `${BASE_PATH}/openapi.json` }))
      // Pre-check: reject OTP requests for unknown emails so the UI can show a
      // helpful error. UserCore is invite-only so enumeration is acceptable.
      .use("/api/auth/email-otp/send-verification-otp", async (c, next) => {
        if (c.req.method !== "POST") return next();
        const body = (await c.req.raw
          .clone()
          .json()
          .catch(() => null)) as {
          email?: string;
        } | null;
        const email = body?.email?.toLowerCase().trim();
        if (email) {
          const existing = await db.query.user.findFirst({
            where: eq(user.email, email),
          });
          if (!existing) {
            return c.json({ message: "No account found with this email" }, 404);
          }
        }
        return next();
      })
      // Better Auth handles all other /api/auth/* routes
      .on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw))
      // Current user + active org + role + accessible workspaces in that org.
      // Owners/admins see all workspaces in their org; members see only ones
      // they have explicit workspace_access for.
      .get(`${BASE_PATH}/me`, async (c) => {
        const session = await auth.api.getSession({
          headers: c.req.raw.headers,
        });
        if (!session) {
          return c.json({ error: "Unauthorized" }, 401);
        }

        const orgMemberships = await db
          .select({
            role: member.role,
            organizationId: organization.id,
            organizationName: organization.name,
            organizationSlug: organization.slug,
            organizationPlan: organization.plan,
          })
          .from(member)
          .innerJoin(organization, eq(organization.id, member.organizationId))
          .where(eq(member.userId, session.user.id));

        if (orgMemberships.length === 0) {
          return c.json({ error: "User has no organization" }, 404);
        }

        const activeOrgId = session.session.activeOrganizationId ?? null;
        const activeOrg =
          orgMemberships.find((m) => m.organizationId === activeOrgId) ??
          orgMemberships[0]!;

        // For owner/admin: every workspace in the org. For member: only
        // workspaces with an access row.
        const visibleWorkspaces =
          activeOrg.role === "owner" || activeOrg.role === "admin"
            ? await db
                .select({
                  id: WorkspaceTable.id,
                  name: WorkspaceTable.name,
                  slug: WorkspaceTable.slug,
                  organizationId: WorkspaceTable.organizationId,
                })
                .from(WorkspaceTable)
                .where(
                  eq(WorkspaceTable.organizationId, activeOrg.organizationId),
                )
            : await db
                .select({
                  id: WorkspaceTable.id,
                  name: WorkspaceTable.name,
                  slug: WorkspaceTable.slug,
                  organizationId: WorkspaceTable.organizationId,
                })
                .from(WorkspaceAccessTable)
                .innerJoin(
                  WorkspaceTable,
                  eq(WorkspaceTable.id, WorkspaceAccessTable.workspaceId),
                )
                .where(
                  and(
                    eq(WorkspaceAccessTable.userId, session.user.id),
                    eq(WorkspaceTable.organizationId, activeOrg.organizationId),
                  ),
                );

        // Pick the active workspace: client-supplied ?workspaceId if it matches
        // a visible one, otherwise the first visible one.
        const requestedWorkspaceId = c.req.query("workspaceId") ?? null;
        const activeWorkspace =
          (requestedWorkspaceId
            ? (visibleWorkspaces.find((w) => w.id === requestedWorkspaceId) ??
              null)
            : null) ??
          visibleWorkspaces[0] ??
          null;

        return c.json(
          {
            user: {
              id: session.user.id,
              name: session.user.name,
              email: session.user.email,
            },
            organization: {
              id: activeOrg.organizationId,
              name: activeOrg.organizationName,
              slug: activeOrg.organizationSlug,
              plan: activeOrg.organizationPlan,
            },
            role: activeOrg.role,
            workspace: activeWorkspace,
            workspaces: visibleWorkspaces.map((w) => ({
              ...w,
              isActive: w.id === activeWorkspace?.id,
            })),
            // For UIs that need to know about other orgs the user belongs to
            organizations: orgMemberships.map((m) => ({
              id: m.organizationId,
              name: m.organizationName,
              slug: m.organizationSlug,
              plan: m.organizationPlan,
              role: m.role,
              isActive: m.organizationId === activeOrg.organizationId,
            })),
          },
          200,
        );
      })
      // Internal plan + counts lookup for sister services. Other backends
      // call this to enforce per-plan quotas (e.g. workflows-api on session
      // creation). Not exposed to browsers because the auth-api CORS allowlist
      // doesn't include `*` and other services hit it server-to-server.
      .get(`${BASE_PATH}/internal/organizations/:id`, async (c) => {
        const id = c.req.param("id");
        const [org] = await db
          .select({
            id: organization.id,
            name: organization.name,
            plan: organization.plan,
          })
          .from(organization)
          .where(eq(organization.id, id))
          .limit(1);
        if (!org) return c.json({ error: "Organization not found" }, 404);
        const memberCount = await db
          .select({ count: count() })
          .from(member)
          .where(eq(member.organizationId, id));
        const workspaceCount = await db
          .select({ count: count() })
          .from(WorkspaceTable)
          .where(eq(WorkspaceTable.organizationId, id));
        return c.json(
          {
            id: org.id,
            name: org.name,
            plan: org.plan,
            counts: {
              members: memberCount[0]?.count ?? 0,
              workspaces: workspaceCount[0]?.count ?? 0,
            },
          },
          200,
        );
      })
      // Rename a workspace (also renames its organization to keep them in sync)
      .patch(`${BASE_PATH}/workspaces/:workspaceId`, async (c) => {
        const session = await auth.api.getSession({
          headers: c.req.raw.headers,
        });
        if (!session) return c.json({ error: "Unauthorized" }, 401);

        const workspaceId = c.req.param("workspaceId");
        const body = (await c.req.raw
          .clone()
          .json()
          .catch(() => null)) as { name?: string } | null;
        const name = body?.name?.trim();
        if (!name) return c.json({ error: "name is required" }, 400);

        const workspaceRow = await db.query.WorkspaceTable.findFirst({
          where: eq(WorkspaceTable.id, workspaceId),
        });
        if (!workspaceRow) return c.json({ error: "Workspace not found" }, 404);

        const callerMember = await db.query.member.findFirst({
          where: and(
            eq(member.userId, session.user.id),
            eq(member.organizationId, workspaceRow.organizationId),
          ),
        });
        if (
          !callerMember ||
          (callerMember.role !== "owner" && callerMember.role !== "admin")
        ) {
          return c.json({ error: "Forbidden" }, 403);
        }

        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
        await db
          .update(WorkspaceTable)
          .set({ name, slug, updatedAt: new Date() })
          .where(eq(WorkspaceTable.id, workspaceId));

        logger.info({ msg: "Workspace renamed", workspaceId, name });
        return c.json({ workspace: { id: workspaceId, name, slug } }, 200);
      })
      // Delete a workspace + its organization + all member rows for that org
      .delete(`${BASE_PATH}/workspaces/:workspaceId`, async (c) => {
        const session = await auth.api.getSession({
          headers: c.req.raw.headers,
        });
        if (!session) return c.json({ error: "Unauthorized" }, 401);

        const workspaceId = c.req.param("workspaceId");
        const workspaceRow = await db.query.WorkspaceTable.findFirst({
          where: eq(WorkspaceTable.id, workspaceId),
        });
        if (!workspaceRow) return c.json({ error: "Workspace not found" }, 404);

        const callerMember = await db.query.member.findFirst({
          where: and(
            eq(member.userId, session.user.id),
            eq(member.organizationId, workspaceRow.organizationId),
          ),
        });
        if (!callerMember || callerMember.role !== "owner") {
          return c.json({ error: "Only owners can delete workspaces" }, 403);
        }

        // Prevent deleting the org's only workspace — would orphan the org.
        const orgWorkspaces = await db
          .select({ id: WorkspaceTable.id })
          .from(WorkspaceTable)
          .where(
            eq(WorkspaceTable.organizationId, workspaceRow.organizationId),
          );
        if (orgWorkspaces.length <= 1) {
          return c.json(
            {
              error:
                "You can't delete the organization's only workspace. Create another one first.",
            },
            403,
          );
        }

        await db
          .delete(WorkspaceTable)
          .where(eq(WorkspaceTable.id, workspaceId));

        await rabbitMQ.publish({
          exchange: "usercore.events",
          routingKey: EVENTS.WORKSPACE_DELETED,
          payload: {
            workspaceId,
            organizationId: workspaceRow.organizationId,
          },
        });

        logger.info({ msg: "Workspace deleted", workspaceId });
        return c.body(null, 204);
      })
      // Create a new workspace inside the caller's active organization.
      // Requires owner or admin role at the org level.
      .post(`${BASE_PATH}/workspaces/create`, async (c) => {
        const session = await auth.api.getSession({
          headers: c.req.raw.headers,
        });
        if (!session) return c.json({ error: "Unauthorized" }, 401);

        const activeOrgId = session.session.activeOrganizationId;
        const callerMembership = activeOrgId
          ? await db.query.member.findFirst({
              where: and(
                eq(member.userId, session.user.id),
                eq(member.organizationId, activeOrgId),
              ),
            })
          : await db.query.member.findFirst({
              where: eq(member.userId, session.user.id),
            });

        if (!callerMembership) {
          return c.json({ error: "No active organization" }, 403);
        }
        if (
          callerMembership.role !== "owner" &&
          callerMembership.role !== "admin"
        ) {
          return c.json(
            { error: "Only owners and admins can create new workspaces" },
            403,
          );
        }

        const body = (await c.req.raw
          .clone()
          .json()
          .catch(() => null)) as { name?: string } | null;
        const name = body?.name?.trim();
        if (!name) {
          return c.json({ error: "name is required" }, 400);
        }

        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
        const workspaceId = generateId("workspace");
        const orgId = callerMembership.organizationId;
        const now = new Date();

        await db.insert(WorkspaceTable).values({
          id: workspaceId,
          name,
          slug,
          organizationId: orgId,
          ownerId: session.user.id,
          createdAt: now,
          updatedAt: now,
        });

        // Creator gets explicit access too (redundant for owner/admin since
        // they implicitly see all org workspaces, but keeps the join clean).
        await db.insert(WorkspaceAccessTable).values({
          id: generateId("workspaceaccess"),
          workspaceId,
          userId: session.user.id,
          createdBy: callerMembership.id,
          createdAt: now,
          updatedAt: now,
        });

        await rabbitMQ.publish({
          exchange: "usercore.events",
          routingKey: EVENTS.WORKSPACE_CREATED,
          payload: {
            workspaceId,
            organizationId: orgId,
            name,
            ownerId: session.user.id,
          },
        });

        logger.info({
          msg: "Workspace created",
          workspaceId,
          organizationId: orgId,
        });

        return c.json(
          {
            workspace: {
              id: workspaceId,
              name,
              slug,
              organizationId: orgId,
            },
          },
          201,
        );
      })
      .route(`${BASE_PATH}`, memberRouter)
      .route(`${BASE_PATH}`, workspaceAccessRouter)
  );
};

export type AuthApi = ReturnType<typeof createAuthApi>;
