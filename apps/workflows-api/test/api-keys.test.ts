// API key lifecycle — creation returns the raw secret once, list returns
// only metadata (no secrets ever roundtrip back), and revoke is workspace-
// scoped so a stray id from another workspace can't be revoked.

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { ApiKeyTable } from "../src/db/schema.db";
import { bootTestApp, type TestApp } from "./utils/testApp";
import { seedApiKey } from "./utils/seed";

describe("POST /workflows/api-keys", () => {
  let ctx: TestApp;

  beforeEach(async () => {
    ctx = await bootTestApp();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  test("creates a key, returns the raw secret exactly once", async () => {
    const res = await ctx.request("/workflows/api-keys", {
      method: "POST",
      body: JSON.stringify({
        workspaceId: "ws_create_key",
        organizationId: "org_create_key",
        name: "Production",
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBeDefined();
    expect(body.name).toBe("Production");
    // The dashboard response intentionally omits workspaceId + the hash —
    // only the raw secret + display metadata is echoed.
    expect(body).not.toHaveProperty("workspaceId");
    expect(body).not.toHaveProperty("keyHash");
    // The raw secret is returned ONLY on create. Format: uc_<base64url>.
    expect(typeof body.secret).toBe("string");
    expect(body.secret).toMatch(/^uc_/);
  });

  test("stored row never contains the raw secret — only its sha256 hash", async () => {
    const res = await ctx.request("/workflows/api-keys", {
      method: "POST",
      body: JSON.stringify({
        workspaceId: "ws_hash_check",
        organizationId: "org_hash_check",
        name: "Backend",
      }),
    });
    const { id, secret } = await res.json();
    const rows = await ctx.db.select().from(ApiKeyTable);
    const stored = rows.find((r) => r.id === id);
    expect(stored).toBeDefined();
    expect(stored?.keyHash).not.toBe(secret);
    expect(stored?.keyHash).toMatch(/^[a-f0-9]{64}$/);
    // The prefix preserves only the first 11 chars for display, never the
    // full secret. That's what the dashboard renders in the table.
    expect(stored?.keyPrefix.length).toBe(11);
  });
});

describe("GET /workflows/api-keys", () => {
  let ctx: TestApp;

  beforeEach(async () => {
    ctx = await bootTestApp();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  test("lists only the workspace's own keys", async () => {
    await seedApiKey(ctx.db, {
      workspaceId: "ws_a",
      organizationId: "org_a",
      name: "Key A",
    });
    await seedApiKey(ctx.db, {
      workspaceId: "ws_b",
      organizationId: "org_b",
      name: "Key B",
    });

    const res = await ctx.request("/workflows/api-keys?workspaceId=ws_a");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe("Key A");
    expect(body[0]).not.toHaveProperty("secret");
    expect(body[0]).not.toHaveProperty("keyHash");
  });
});

describe("DELETE /workflows/api-keys/:id", () => {
  let ctx: TestApp;

  beforeEach(async () => {
    ctx = await bootTestApp();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  test("revokes a key inside its owning workspace", async () => {
    const key = await seedApiKey(ctx.db, {
      workspaceId: "ws_revoke",
      organizationId: "org_revoke",
      name: "To be revoked",
    });
    const res = await ctx.request(
      `/workflows/api-keys/${key.id}?workspaceId=ws_revoke`,
      { method: "DELETE" },
    );
    expect(res.status).toBe(204);

    // List should now return zero
    const list = await ctx.request("/workflows/api-keys?workspaceId=ws_revoke");
    const body = await list.json();
    expect(body).toHaveLength(0);
  });

  test("refuses to revoke a key that belongs to a different workspace", async () => {
    const key = await seedApiKey(ctx.db, {
      workspaceId: "ws_owner",
      organizationId: "org_owner",
      name: "Owned",
    });
    const res = await ctx.request(
      `/workflows/api-keys/${key.id}?workspaceId=ws_attacker`,
      { method: "DELETE" },
    );
    expect(res.status).toBe(404);
  });
});
