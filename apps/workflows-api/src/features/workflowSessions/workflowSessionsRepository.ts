import {
  and,
  count,
  desc,
  eq,
  exists,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import type { Logger } from "@usercore/logger";
import type {
  ExternalSessionSource,
  WorkflowVerificationMode,
} from "@usercore/shared-types";

import type { Database } from "../../db/db";
import {
  WorkflowSessionAttributeTable,
  WorkflowSessionEventTable,
  WorkflowSessionStepTable,
  WorkflowSessionTable,
  WorkflowTable,
} from "../../db/schema.db";
import type { WorkflowSessionEventDetail } from "../../db/schema.db";

// Review-queue status filter values. Derived from the identity-verification
// step status + the resubmission marker (no single session-status column).
export type ReviewQueueStatus =
  | "needs_review"
  | "approved"
  | "rejected"
  | "resubmission"
  | "in_progress";

// Queue filter values: the five derived statuses plus two meta-filters —
// "open" (everything not terminal: needs review / in progress / resubmission)
// and "archived" (soft-deleted submissions, hidden under every other filter).
export type ReviewQueueFilter = ReviewQueueStatus | "open" | "archived";

const REVIEW_IDENTITY_STEP = "identity-verification";
const RESUBMISSION_ATTR = "_session.resubmission_requested";
// Aliased attribute table for the name-search EXISTS subquery — the outer query
// already joins the attribute table (for the resubmission marker), so we need a
// distinct alias here to avoid ambiguous column references.
const nameSearchAttr = alias(WorkflowSessionAttributeTable, "name_search_attr");
const NAME_SEARCH_KEYS = [
  "identity_verification.full_name",
  "identity_verification.document_first_name",
  "identity_verification.document_last_name",
];

export const createWorkflowSessionsRepository = (props: {
  db: Database;
  logger: Logger;
}) => {
  const { db } = props;

  const create = async (data: {
    externalSessionId: string;
    externalSessionSource: ExternalSessionSource;
    workflowId: string;
    customerId: string;
    verificationMode?: WorkflowVerificationMode;
    activeDeviceId?: string;
  }) => {
    const [session] = await db
      .insert(WorkflowSessionTable)
      .values(data)
      .returning();
    return session;
  };

  const findById = async (id: string) => {
    return db.query.WorkflowSessionTable.findFirst({
      where: eq(WorkflowSessionTable.id, id),
    });
  };

  const findByExternalSession = async (data: {
    externalSessionId: string;
    externalSessionSource: ExternalSessionSource;
    workflowId: string;
    customerId: string;
    verificationMode: WorkflowVerificationMode;
  }) => {
    return db.query.WorkflowSessionTable.findFirst({
      where: and(
        eq(WorkflowSessionTable.externalSessionId, data.externalSessionId),
        eq(
          WorkflowSessionTable.externalSessionSource,
          data.externalSessionSource,
        ),
        eq(WorkflowSessionTable.workflowId, data.workflowId),
        eq(WorkflowSessionTable.customerId, data.customerId),
        eq(WorkflowSessionTable.verificationMode, data.verificationMode),
      ),
    });
  };

  const listByCustomer = async (customerId: string) => {
    return db
      .select()
      .from(WorkflowSessionTable)
      .where(eq(WorkflowSessionTable.customerId, customerId))
      .orderBy(desc(WorkflowSessionTable.createdAt));
  };

  const listByWorkspace = async (workspaceId: string) => {
    const rows = await db
      .select({ session: WorkflowSessionTable })
      .from(WorkflowSessionTable)
      .innerJoin(
        WorkflowTable,
        eq(WorkflowSessionTable.workflowId, WorkflowTable.id),
      )
      .where(eq(WorkflowTable.workspaceId, workspaceId))
      .orderBy(desc(WorkflowSessionTable.createdAt));
    return rows.map((r) => r.session);
  };

  // Paginated + filtered review queue. LEFT-joins the identity-verification
  // step (unique per session) and the resubmission marker attribute (unique
  // per session) so each row carries the signals needed to derive a review
  // status — without N+1 lookups. Status filtering maps the requested status
  // to conditions on those joined columns.
  const listForReviewQueuePaginated = async (data: {
    workspaceId: string;
    page: number;
    limit: number;
    status?: ReviewQueueFilter;
    mode?: WorkflowVerificationMode;
    search?: string;
  }) => {
    const conditions: SQL[] = [eq(WorkflowTable.workspaceId, data.workspaceId)];
    // Soft-deleted (archived) submissions are hidden everywhere except the
    // explicit "archived" filter — they're retained, just out of the queue.
    conditions.push(
      data.status === "archived"
        ? isNotNull(WorkflowSessionTable.deletedAt)
        : isNull(WorkflowSessionTable.deletedAt),
    );
    if (data.mode) {
      conditions.push(eq(WorkflowSessionTable.verificationMode, data.mode));
    }
    if (data.search && data.search.trim() !== "") {
      const term = `%${data.search.trim()}%`;
      // Match the customer id OR any captured name attribute (full name / first
      // / last) — case-insensitive (ILIKE) — so search lines up with the names
      // the table now shows.
      const searchCondition = or(
        ilike(WorkflowSessionTable.customerId, term),
        exists(
          db
            .select({ one: sql`1` })
            .from(nameSearchAttr)
            .where(
              and(
                eq(nameSearchAttr.workflowSessionId, WorkflowSessionTable.id),
                inArray(nameSearchAttr.attribute, NAME_SEARCH_KEYS),
                ilike(nameSearchAttr.value, term),
              ),
            ),
        ),
      );
      if (searchCondition) conditions.push(searchCondition);
    }
    // "resubmission requested" is truthy only when the marker attribute is
    // exactly 'true'. IS DISTINCT FROM handles the NULL (no marker) case.
    const resubTrue = sql`${WorkflowSessionAttributeTable.value} = 'true'`;
    const resubNotTrue = sql`${WorkflowSessionAttributeTable.value} IS DISTINCT FROM 'true'`;
    if (data.status === "open") {
      // Everything still in motion — excludes the terminal approved/rejected.
      conditions.push(
        sql`(${WorkflowSessionStepTable.status} IS NULL OR ${WorkflowSessionStepTable.status} NOT IN ('SUCCEEDED', 'FAILED'))`,
      );
    } else if (data.status === "needs_review") {
      conditions.push(
        eq(WorkflowSessionStepTable.status, "REQUIRES_REVIEW"),
        resubNotTrue,
      );
    } else if (data.status === "approved") {
      conditions.push(eq(WorkflowSessionStepTable.status, "SUCCEEDED"));
    } else if (data.status === "rejected") {
      conditions.push(eq(WorkflowSessionStepTable.status, "FAILED"));
    } else if (data.status === "resubmission") {
      conditions.push(resubTrue);
    } else if (data.status === "in_progress") {
      conditions.push(
        sql`(${WorkflowSessionStepTable.status} IS NULL OR ${WorkflowSessionStepTable.status} IN ('PENDING', 'IN_PROGRESS'))`,
        resubNotTrue,
      );
    }
    const whereClause = and(...conditions);

    const rows = await db
      .select({
        session: WorkflowSessionTable,
        ivStatus: WorkflowSessionStepTable.status,
        resubmission: WorkflowSessionAttributeTable.value,
      })
      .from(WorkflowSessionTable)
      .innerJoin(
        WorkflowTable,
        eq(WorkflowSessionTable.workflowId, WorkflowTable.id),
      )
      .leftJoin(
        WorkflowSessionStepTable,
        and(
          eq(WorkflowSessionStepTable.sessionId, WorkflowSessionTable.id),
          eq(WorkflowSessionStepTable.step, REVIEW_IDENTITY_STEP),
        ),
      )
      .leftJoin(
        WorkflowSessionAttributeTable,
        and(
          eq(
            WorkflowSessionAttributeTable.workflowSessionId,
            WorkflowSessionTable.id,
          ),
          eq(WorkflowSessionAttributeTable.attribute, RESUBMISSION_ATTR),
        ),
      )
      .where(whereClause)
      .orderBy(desc(WorkflowSessionTable.createdAt))
      .limit(data.limit)
      .offset((data.page - 1) * data.limit);

    const countRows = await db
      .select({ value: count() })
      .from(WorkflowSessionTable)
      .innerJoin(
        WorkflowTable,
        eq(WorkflowSessionTable.workflowId, WorkflowTable.id),
      )
      .leftJoin(
        WorkflowSessionStepTable,
        and(
          eq(WorkflowSessionStepTable.sessionId, WorkflowSessionTable.id),
          eq(WorkflowSessionStepTable.step, REVIEW_IDENTITY_STEP),
        ),
      )
      .leftJoin(
        WorkflowSessionAttributeTable,
        and(
          eq(
            WorkflowSessionAttributeTable.workflowSessionId,
            WorkflowSessionTable.id,
          ),
          eq(WorkflowSessionAttributeTable.attribute, RESUBMISSION_ATTR),
        ),
      )
      .where(whereClause);

    return { rows, total: countRows[0]?.value ?? 0 };
  };

  // Count sessions whose parent workflow is in the given organization and
  // whose createdAt falls inside the current calendar month. Powers the
  // verifications-per-month hard cap.
  const countForOrganizationCurrentMonth = async (
    organizationId: string,
  ): Promise<number> => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const rows = await db
      .select({ value: count() })
      .from(WorkflowSessionTable)
      .innerJoin(
        WorkflowTable,
        eq(WorkflowSessionTable.workflowId, WorkflowTable.id),
      )
      .where(
        and(
          eq(WorkflowTable.organizationId, organizationId),
          gte(WorkflowSessionTable.createdAt, startOfMonth),
        ),
      );
    return rows[0]?.value ?? 0;
  };

  // Identity attribute rows for every OTHER session in the same workspace —
  // powers local duplicate detection. Returns one row per (session, attribute)
  // for the identity keys we match on; the service groups + compares them.
  const findIdentityMatchRows = async (params: {
    workspaceId: string;
    excludeCustomerId: string;
    attributeKeys: string[];
  }): Promise<
    Array<{
      customerId: string;
      sessionId: string;
      attribute: string;
      value: string;
    }>
  > => {
    return db
      .select({
        customerId: WorkflowSessionTable.customerId,
        sessionId: WorkflowSessionTable.id,
        attribute: WorkflowSessionAttributeTable.attribute,
        value: WorkflowSessionAttributeTable.value,
      })
      .from(WorkflowSessionAttributeTable)
      .innerJoin(
        WorkflowSessionTable,
        eq(
          WorkflowSessionAttributeTable.workflowSessionId,
          WorkflowSessionTable.id,
        ),
      )
      .innerJoin(
        WorkflowTable,
        eq(WorkflowSessionTable.workflowId, WorkflowTable.id),
      )
      .where(
        and(
          eq(WorkflowTable.workspaceId, params.workspaceId),
          ne(WorkflowSessionTable.customerId, params.excludeCustomerId),
          inArray(
            WorkflowSessionAttributeTable.attribute,
            params.attributeKeys,
          ),
          // Archived (soft-deleted) submissions are out of the active set —
          // exclude them so test/junk records can't trigger false duplicate
          // matches. Real fraud cases are Rejected (retained), not archived.
          isNull(WorkflowSessionTable.deletedAt),
        ),
      );
  };

  // Soft delete (archive) — keeps the row for AML retention/audit; deletedBy +
  // reason record who archived it and why. Default queue lookups exclude it.
  const softDelete = async (data: {
    id: string;
    deletedBy: string;
    reason: string;
  }) => {
    const now = new Date();
    await db
      .update(WorkflowSessionTable)
      .set({
        deletedAt: now,
        deletedBy: data.deletedBy,
        deleteReason: data.reason,
        updatedAt: now,
      })
      .where(eq(WorkflowSessionTable.id, data.id));
  };

  // Append one row to the session's audit trail. Never updated or deleted —
  // each call is a distinct historical event.
  const insertEvent = async (data: {
    workflowSessionId: string;
    type: string;
    detail?: WorkflowSessionEventDetail | null;
    createdBy?: string | null;
  }) => {
    await db.insert(WorkflowSessionEventTable).values({
      workflowSessionId: data.workflowSessionId,
      type: data.type,
      detail: data.detail ?? null,
      createdBy: data.createdBy ?? null,
    });
  };

  // Full audit trail for a session, oldest event first.
  const findEventsBySession = async (sessionId: string) => {
    return db
      .select()
      .from(WorkflowSessionEventTable)
      .where(eq(WorkflowSessionEventTable.workflowSessionId, sessionId))
      .orderBy(WorkflowSessionEventTable.occurredAt);
  };

  // Un-archive — clears the soft-delete fields so the session returns to the
  // queue.
  const restore = async (id: string) => {
    const now = new Date();
    await db
      .update(WorkflowSessionTable)
      .set({
        deletedAt: null,
        deletedBy: null,
        deleteReason: null,
        updatedAt: now,
      })
      .where(eq(WorkflowSessionTable.id, id));
  };

  // Per-session display metadata for the review table: a name (canonical
  // full_name, else first + last) and a country (first available of document /
  // issuing / nationality / POR address — all ISO alpha-2). Missing → null.
  const COUNTRY_META_KEYS = [
    "identity_verification.document_country",
    "identity_verification.document_issuing_country",
    "identity_verification.document_nationality",
    "address.country",
  ];
  const findRowMetaForSessions = async (
    sessionIds: string[],
  ): Promise<Map<string, { name: string | null; country: string | null }>> => {
    const out = new Map<
      string,
      { name: string | null; country: string | null }
    >();
    if (sessionIds.length === 0) return out;
    const rows = await db
      .select({
        sessionId: WorkflowSessionAttributeTable.workflowSessionId,
        attribute: WorkflowSessionAttributeTable.attribute,
        value: WorkflowSessionAttributeTable.value,
      })
      .from(WorkflowSessionAttributeTable)
      .where(
        and(
          inArray(WorkflowSessionAttributeTable.workflowSessionId, sessionIds),
          inArray(WorkflowSessionAttributeTable.attribute, [
            "identity_verification.full_name",
            "identity_verification.document_first_name",
            "identity_verification.document_last_name",
            ...COUNTRY_META_KEYS,
          ]),
        ),
      );
    const bySession = new Map<string, Record<string, string>>();
    for (const r of rows) {
      const m = bySession.get(r.sessionId) ?? {};
      m[r.attribute] = r.value;
      bySession.set(r.sessionId, m);
    }
    for (const [sid, m] of bySession) {
      const name =
        m["identity_verification.full_name"]?.trim() ||
        [
          m["identity_verification.document_first_name"],
          m["identity_verification.document_last_name"],
        ]
          .filter(Boolean)
          .join(" ")
          .trim();
      let country: string | null = null;
      for (const k of COUNTRY_META_KEYS) {
        const v = m[k]?.trim();
        if (v) {
          country = v;
          break;
        }
      }
      out.set(sid, { name: name || null, country });
    }
    return out;
  };

  return {
    create,
    findById,
    findByExternalSession,
    listByCustomer,
    listByWorkspace,
    listForReviewQueuePaginated,
    countForOrganizationCurrentMonth,
    findIdentityMatchRows,
    findRowMetaForSessions,
    insertEvent,
    findEventsBySession,
    softDelete,
    restore,
  };
};

export type WorkflowSessionsRepository = ReturnType<
  typeof createWorkflowSessionsRepository
>;
