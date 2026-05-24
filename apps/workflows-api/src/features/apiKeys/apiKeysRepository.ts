import { and, desc, eq, isNull } from "drizzle-orm";

import type { Database } from "../../db/db";
import { ApiKeyTable, type NewApiKey } from "../../db/schema.db";

export const createApiKeysRepository = (props: { db: Database }) => {
  const { db } = props;

  const create = async (data: NewApiKey) => {
    const [row] = await db.insert(ApiKeyTable).values(data).returning();
    if (!row) throw new Error("Insert returned no row");
    return row;
  };

  // Active (non-revoked) keys for a workspace, newest first.
  const listActiveByWorkspace = async (workspaceId: string) =>
    db
      .select()
      .from(ApiKeyTable)
      .where(
        and(
          eq(ApiKeyTable.workspaceId, workspaceId),
          isNull(ApiKeyTable.revokedAt),
        ),
      )
      .orderBy(desc(ApiKeyTable.createdAt));

  // Hash lookup on the authenticated-request hot path — only matches keys that
  // haven't been revoked.
  const findActiveByHash = async (keyHash: string) =>
    db.query.ApiKeyTable.findFirst({
      where: and(
        eq(ApiKeyTable.keyHash, keyHash),
        isNull(ApiKeyTable.revokedAt),
      ),
    });

  const findById = async (id: string) =>
    db.query.ApiKeyTable.findFirst({ where: eq(ApiKeyTable.id, id) });

  // Soft revoke — kept for audit, but no longer matches findActiveByHash.
  const revoke = async (id: string) => {
    await db
      .update(ApiKeyTable)
      .set({ revokedAt: new Date(), updatedAt: new Date() })
      .where(eq(ApiKeyTable.id, id));
  };

  const touchLastUsed = async (id: string) => {
    await db
      .update(ApiKeyTable)
      .set({ lastUsedAt: new Date(), updatedAt: new Date() })
      .where(eq(ApiKeyTable.id, id));
  };

  return {
    create,
    listActiveByWorkspace,
    findActiveByHash,
    findById,
    revoke,
    touchLastUsed,
  };
};

export type ApiKeysRepository = ReturnType<typeof createApiKeysRepository>;
