// Audit log is the compliance backbone — every significant action across
// the platform writes a row here. The routes that read it haven't shipped
// yet, so these integration tests exercise the repository against PGLite
// to lock in the table shape, workspace scoping, and ordering invariants
// that downstream consumers will rely on.

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { desc, eq } from "drizzle-orm";

import { createLogger } from "@usercore/logger";

import { AuditLogTable } from "../src/db/schema.db";
import { createAuditLogRepository } from "../src/features/auditLog/auditLogRepository";
import { bootTestApp, type TestApp } from "./utils/testApp";

describe("audit log repository", () => {
  let ctx: TestApp;

  beforeEach(async () => {
    ctx = await bootTestApp();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  test("create() writes a row with the expected shape", async () => {
    const repo = createAuditLogRepository({
      db: ctx.db,
      logger: createLogger({ name: "test", level: "fatal" }),
    });

    const created = await repo.create({
      workspaceId: "ws_main",
      actorId: "member_admin",
      action: "workflow.published",
      resourceType: "workflow",
      resourceId: "wf_123",
      metadata: { previousVersion: 2, newVersion: 3 },
    });

    expect(created.id).toMatch(/^audit_/);
    expect(created.workspaceId).toBe("ws_main");
    expect(created.actorId).toBe("member_admin");
    expect(created.action).toBe("workflow.published");
    expect(created.resourceType).toBe("workflow");
    expect(created.resourceId).toBe("wf_123");
    expect(created.metadata).toEqual({ previousVersion: 2, newVersion: 3 });
    expect(created.createdAt).toBeInstanceOf(Date);
    expect(created.updatedAt).toBeInstanceOf(Date);
  });

  test("create() allows null resourceId and null metadata", async () => {
    const repo = createAuditLogRepository({
      db: ctx.db,
      logger: createLogger({ name: "test", level: "fatal" }),
    });

    const created = await repo.create({
      workspaceId: "ws_main",
      actorId: "system",
      action: "workspace.created",
      resourceType: "workspace",
    });

    expect(created.resourceId).toBeNull();
    expect(created.metadata).toBeNull();
  });

  test("findByWorkspaceId() returns only rows for the requested workspace", async () => {
    // Seed three rows across two workspaces — the listing for ws_a must
    // not leak ws_b's audit events.
    await ctx.db.insert(AuditLogTable).values([
      {
        workspaceId: "ws_a",
        actorId: "member_1",
        action: "scenario.updated",
        resourceType: "scenario",
        resourceId: "sc_1",
      },
      {
        workspaceId: "ws_a",
        actorId: "member_2",
        action: "api_key.created",
        resourceType: "apiKey",
        resourceId: "key_1",
      },
      {
        workspaceId: "ws_b",
        actorId: "member_3",
        action: "scenario.updated",
        resourceType: "scenario",
        resourceId: "sc_99",
      },
    ]);

    const repo = createAuditLogRepository({
      db: ctx.db,
      logger: createLogger({ name: "test", level: "fatal" }),
    });

    const rows = await repo.findByWorkspaceId("ws_a");
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.workspaceId === "ws_a")).toBe(true);
    expect(rows.map((r) => r.action).sort()).toEqual([
      "api_key.created",
      "scenario.updated",
    ]);
  });

  test("findByWorkspaceId() returns rows newest-first", async () => {
    // Insert in a known order with explicit timestamps so we don't rely
    // on insertion-order shenanigans.
    const base = new Date("2026-01-01T00:00:00Z");
    await ctx.db.insert(AuditLogTable).values([
      {
        workspaceId: "ws_order",
        actorId: "m",
        action: "first",
        resourceType: "x",
        createdAt: new Date(base.getTime() + 0),
        updatedAt: new Date(base.getTime() + 0),
      },
      {
        workspaceId: "ws_order",
        actorId: "m",
        action: "second",
        resourceType: "x",
        createdAt: new Date(base.getTime() + 1000),
        updatedAt: new Date(base.getTime() + 1000),
      },
      {
        workspaceId: "ws_order",
        actorId: "m",
        action: "third",
        resourceType: "x",
        createdAt: new Date(base.getTime() + 2000),
        updatedAt: new Date(base.getTime() + 2000),
      },
    ]);

    const repo = createAuditLogRepository({
      db: ctx.db,
      logger: createLogger({ name: "test", level: "fatal" }),
    });

    const rows = await repo.findByWorkspaceId("ws_order");
    expect(rows.map((r) => r.action)).toEqual(["third", "second", "first"]);
  });

  test("findByWorkspaceId() respects the limit parameter", async () => {
    const repo = createAuditLogRepository({
      db: ctx.db,
      logger: createLogger({ name: "test", level: "fatal" }),
    });

    for (let i = 0; i < 5; i++) {
      await repo.create({
        workspaceId: "ws_limit",
        actorId: "m",
        action: `evt_${i}`,
        resourceType: "x",
      });
    }

    const rows = await repo.findByWorkspaceId("ws_limit", 3);
    expect(rows).toHaveLength(3);
  });

  test("findByWorkspaceId() returns an empty list for an unknown workspace", async () => {
    const repo = createAuditLogRepository({
      db: ctx.db,
      logger: createLogger({ name: "test", level: "fatal" }),
    });
    await repo.create({
      workspaceId: "ws_real",
      actorId: "m",
      action: "noise",
      resourceType: "x",
    });

    const rows = await repo.findByWorkspaceId("ws_ghost");
    expect(rows).toHaveLength(0);
  });

  test("metadata round-trips arbitrary JSON shapes", async () => {
    const repo = createAuditLogRepository({
      db: ctx.db,
      logger: createLogger({ name: "test", level: "fatal" }),
    });

    const nested = {
      before: { status: "draft", reviewers: ["a", "b"] },
      after: { status: "published", reviewers: ["a", "b", "c"] },
      flags: { ipAddress: "10.0.0.1", count: 7, archived: false },
    };

    await repo.create({
      workspaceId: "ws_meta",
      actorId: "m",
      action: "workflow.published",
      resourceType: "workflow",
      resourceId: "wf_meta",
      metadata: nested,
    });

    const [row] = await ctx.db
      .select()
      .from(AuditLogTable)
      .where(eq(AuditLogTable.workspaceId, "ws_meta"));
    expect(row.metadata).toEqual(nested);
  });
});

describe("tms-api app surface", () => {
  let ctx: TestApp;

  beforeEach(async () => {
    ctx = await bootTestApp();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  test("GET /health returns OK", async () => {
    const res = await ctx.request("/health");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("OK");
  });

  test("OpenAPI doc is served and advertises the TMS API title", async () => {
    const res = await ctx.request("/tms/openapi.json");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { info: { title: string } };
    expect(body.info.title).toBe("UserCore TMS API");
  });

  test("seeded rows are queryable directly through the test db", async () => {
    // Same pattern a future HTTP test will follow once the read route
    // ships: seed via ctx.db, then assert on what the API returns.
    await ctx.db.insert(AuditLogTable).values({
      workspaceId: "ws_seed",
      actorId: "member_seed",
      action: "member.invited",
      resourceType: "member",
      resourceId: "member_new",
      metadata: { email: "new@example.com" },
    });

    const rows = await ctx.db
      .select()
      .from(AuditLogTable)
      .where(eq(AuditLogTable.workspaceId, "ws_seed"))
      .orderBy(desc(AuditLogTable.createdAt));

    expect(rows).toHaveLength(1);
    expect(rows[0].action).toBe("member.invited");
    expect(rows[0].metadata).toEqual({ email: "new@example.com" });
  });
});
