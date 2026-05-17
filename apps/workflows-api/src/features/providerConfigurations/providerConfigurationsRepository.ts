import { and, eq } from "drizzle-orm";

import type { ProviderShortName } from "@usercore/shared-types";

import type { Database } from "../../db/db";
import {
  ProviderConfigurationTable,
  type NewProviderConfiguration,
} from "../../db/schema.db";

export const createProviderConfigurationsRepository = (props: {
  db: Database;
}) => {
  const { db } = props;

  const listByOrganization = async (organizationId: string) =>
    db
      .select()
      .from(ProviderConfigurationTable)
      .where(eq(ProviderConfigurationTable.organizationId, organizationId));

  const findByOrgAndProvider = async (data: {
    organizationId: string;
    provider: ProviderShortName;
  }) =>
    db.query.ProviderConfigurationTable.findFirst({
      where: and(
        eq(ProviderConfigurationTable.organizationId, data.organizationId),
        eq(ProviderConfigurationTable.provider, data.provider),
      ),
    });

  // Upsert keyed on the unique (organizationId, provider) pair — the UI saves
  // an entire provider block at a time, so we always have the full picture.
  const upsert = async (data: NewProviderConfiguration) => {
    const [row] = await db
      .insert(ProviderConfigurationTable)
      .values(data)
      .onConflictDoUpdate({
        target: [
          ProviderConfigurationTable.organizationId,
          ProviderConfigurationTable.provider,
        ],
        set: {
          apiKey: data.apiKey,
          apiSecret: data.apiSecret,
          enabled: data.enabled,
          updatedAt: new Date(),
        },
      })
      .returning();
    if (!row) throw new Error("Upsert returned no row");
    return row;
  };

  const remove = async (id: string) => {
    await db
      .delete(ProviderConfigurationTable)
      .where(eq(ProviderConfigurationTable.id, id));
  };

  return {
    listByOrganization,
    findByOrgAndProvider,
    upsert,
    remove,
  };
};

export type ProviderConfigurationsRepository = ReturnType<
  typeof createProviderConfigurationsRepository
>;
