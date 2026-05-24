import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  isNotNull,
  isNull,
  lte,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import type { Logger } from "@usercore/logger";
import type { CustomerRiskLevel, KycStatus } from "@usercore/shared-types";

import type { Database } from "../../db/db";
import { CustomerProfileTable } from "../../db/schema.db";

export type CustomerSortField =
  | "createdAt"
  | "firstName"
  | "country"
  | "kycStatus"
  | "riskLevel";

export type CustomerListFilters = {
  workspaceId: string;
  page: number;
  limit: number;
  status?: KycStatus;
  riskLevel?: CustomerRiskLevel;
  country?: string;
  search?: string;
  fromDate?: Date;
  toDate?: Date;
  // true = only archived; false/undefined = exclude archived rows.
  archived?: boolean;
  sortBy?: CustomerSortField;
  sortDir?: "asc" | "desc";
};

const SORT_COLUMNS = {
  createdAt: CustomerProfileTable.createdAt,
  firstName: CustomerProfileTable.firstName,
  country: CustomerProfileTable.country,
  kycStatus: CustomerProfileTable.kycStatus,
  riskLevel: CustomerProfileTable.riskLevel,
} as const;

export const createCustomerProfileRepository = (props: {
  db: Database;
  logger: Logger;
}) => {
  const { db } = props;

  const findByCustomerId = async (customerId: string) => {
    return db.query.CustomerProfileTable.findFirst({
      where: eq(CustomerProfileTable.customerId, customerId),
    });
  };

  const findByWorkspaceId = async (workspaceId: string) => {
    return db
      .select()
      .from(CustomerProfileTable)
      .where(eq(CustomerProfileTable.workspaceId, workspaceId));
  };

  // Shared WHERE for the customers table — used by both the page query and the
  // count so they stay in sync.
  const buildWhere = (f: CustomerListFilters): SQL | undefined => {
    const conditions: SQL[] = [
      eq(CustomerProfileTable.workspaceId, f.workspaceId),
      f.archived
        ? isNotNull(CustomerProfileTable.archivedAt)
        : isNull(CustomerProfileTable.archivedAt),
    ];
    if (f.status) conditions.push(eq(CustomerProfileTable.kycStatus, f.status));
    if (f.riskLevel)
      conditions.push(eq(CustomerProfileTable.riskLevel, f.riskLevel));
    if (f.country) conditions.push(eq(CustomerProfileTable.country, f.country));
    if (f.fromDate)
      conditions.push(gte(CustomerProfileTable.createdAt, f.fromDate));
    if (f.toDate)
      conditions.push(lte(CustomerProfileTable.createdAt, f.toDate));
    if (f.search) {
      const term = `%${f.search}%`;
      const match = or(
        ilike(CustomerProfileTable.firstName, term),
        ilike(CustomerProfileTable.lastName, term),
        ilike(CustomerProfileTable.customerId, term),
      );
      if (match) conditions.push(match);
    }
    return and(...conditions);
  };

  const listForTable = async (
    f: CustomerListFilters,
  ): Promise<{
    rows: (typeof CustomerProfileTable.$inferSelect)[];
    total: number;
  }> => {
    const where = buildWhere(f);
    const sortCol = SORT_COLUMNS[f.sortBy ?? "createdAt"];
    const orderBy = f.sortDir === "asc" ? asc(sortCol) : desc(sortCol);
    const [rows, totalRow] = await Promise.all([
      db
        .select()
        .from(CustomerProfileTable)
        .where(where)
        .orderBy(orderBy)
        .limit(f.limit)
        .offset((f.page - 1) * f.limit),
      db.select({ value: count() }).from(CustomerProfileTable).where(where),
    ]);
    return { rows, total: totalRow[0]?.value ?? 0 };
  };

  const create = async (data: {
    customerId: string;
    workspaceId: string;
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
    nationality?: string;
    address?: string;
    city?: string;
    country?: string;
  }) => {
    const [profile] = await db
      .insert(CustomerProfileTable)
      .values(data)
      .returning();
    return profile;
  };

  const update = async (
    customerId: string,
    data: Partial<{
      firstName: string;
      lastName: string;
      dateOfBirth: string;
      nationality: string;
      address: string;
      city: string;
      country: string;
    }>,
  ) => {
    const [profile] = await db
      .update(CustomerProfileTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(CustomerProfileTable.customerId, customerId))
      .returning();
    return profile;
  };

  const updateKycStatus = async (props: {
    customerId: string;
    kycStatus: KycStatus;
    kycSessionId?: string;
    kycCompletedAt?: Date;
    riskLevel?: CustomerRiskLevel;
  }) => {
    const [profile] = await db
      .update(CustomerProfileTable)
      .set({
        kycStatus: props.kycStatus,
        kycSessionId: props.kycSessionId,
        kycCompletedAt: props.kycCompletedAt,
        // Only overwrite risk when this completion produced one — a re-decision
        // without AML must not wipe an existing classification.
        ...(props.riskLevel ? { riskLevel: props.riskLevel } : {}),
        updatedAt: new Date(),
      })
      .where(eq(CustomerProfileTable.customerId, props.customerId))
      .returning();
    return profile;
  };

  // Dashboard aggregations for the customer charts. All scoped to the
  // workspace and exclude archived rows (the active customer base).
  const getStats = async (workspaceId: string, from?: Date) => {
    const base = and(
      eq(CustomerProfileTable.workspaceId, workspaceId),
      isNull(CustomerProfileTable.archivedAt),
      ...(from ? [gte(CustomerProfileTable.createdAt, from)] : []),
    );
    const dayExpr = sql<string>`to_char(date_trunc('day', ${CustomerProfileTable.createdAt}), 'YYYY-MM-DD')`;
    const [byStatus, byRisk, byCountry, overTime, totalRow] = await Promise.all(
      [
        db
          .select({ status: CustomerProfileTable.kycStatus, count: count() })
          .from(CustomerProfileTable)
          .where(base)
          .groupBy(CustomerProfileTable.kycStatus),
        db
          .select({ riskLevel: CustomerProfileTable.riskLevel, count: count() })
          .from(CustomerProfileTable)
          .where(base)
          .groupBy(CustomerProfileTable.riskLevel),
        db
          .select({ country: CustomerProfileTable.country, count: count() })
          .from(CustomerProfileTable)
          .where(base)
          .groupBy(CustomerProfileTable.country),
        db
          .select({ day: dayExpr, count: count() })
          .from(CustomerProfileTable)
          .where(base)
          .groupBy(dayExpr)
          .orderBy(dayExpr),
        db.select({ value: count() }).from(CustomerProfileTable).where(base),
      ],
    );
    return {
      byStatus,
      byRisk,
      byCountry,
      overTime,
      total: totalRow[0]?.value ?? 0,
    };
  };

  // Create-or-update on KYC completion — a decided customer should appear in
  // the customers table even on their first decision. Identity fields are only
  // overwritten when this completion carried them.
  const upsertFromKyc = async (props: {
    customerId: string;
    workspaceId: string;
    kycStatus: KycStatus;
    kycSessionId?: string;
    kycCompletedAt?: Date;
    riskLevel?: CustomerRiskLevel;
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
    nationality?: string;
    country?: string;
  }) => {
    const [profile] = await db
      .insert(CustomerProfileTable)
      .values({
        customerId: props.customerId,
        workspaceId: props.workspaceId,
        kycStatus: props.kycStatus,
        kycSessionId: props.kycSessionId,
        kycCompletedAt: props.kycCompletedAt,
        riskLevel: props.riskLevel,
        firstName: props.firstName,
        lastName: props.lastName,
        dateOfBirth: props.dateOfBirth,
        nationality: props.nationality,
        country: props.country,
      })
      .onConflictDoUpdate({
        target: CustomerProfileTable.customerId,
        set: {
          kycStatus: props.kycStatus,
          kycSessionId: props.kycSessionId,
          kycCompletedAt: props.kycCompletedAt,
          ...(props.riskLevel ? { riskLevel: props.riskLevel } : {}),
          ...(props.firstName ? { firstName: props.firstName } : {}),
          ...(props.lastName ? { lastName: props.lastName } : {}),
          ...(props.dateOfBirth ? { dateOfBirth: props.dateOfBirth } : {}),
          ...(props.nationality ? { nationality: props.nationality } : {}),
          ...(props.country ? { country: props.country } : {}),
          updatedAt: new Date(),
        },
      })
      .returning();
    return profile;
  };

  const setArchived = async (customerId: string, archived: boolean) => {
    const [profile] = await db
      .update(CustomerProfileTable)
      .set({ archivedAt: archived ? new Date() : null, updatedAt: new Date() })
      .where(eq(CustomerProfileTable.customerId, customerId))
      .returning();
    return profile;
  };

  // Manual reviewer override of status/risk from the customers table. Partial:
  // only the provided fields change, so the KYC session link and completion
  // timestamp are preserved.
  const setClassification = async (
    customerId: string,
    data: { kycStatus?: KycStatus; riskLevel?: CustomerRiskLevel },
  ) => {
    const [profile] = await db
      .update(CustomerProfileTable)
      .set({
        ...(data.kycStatus ? { kycStatus: data.kycStatus } : {}),
        ...(data.riskLevel ? { riskLevel: data.riskLevel } : {}),
        updatedAt: new Date(),
      })
      .where(eq(CustomerProfileTable.customerId, customerId))
      .returning();
    return profile;
  };

  return {
    findByCustomerId,
    findByWorkspaceId,
    listForTable,
    getStats,
    create,
    update,
    updateKycStatus,
    upsertFromKyc,
    setArchived,
    setClassification,
  };
};

export type CustomerProfileRepository = ReturnType<
  typeof createCustomerProfileRepository
>;
