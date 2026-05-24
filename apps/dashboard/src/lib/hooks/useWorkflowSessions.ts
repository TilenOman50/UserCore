import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch, WORKFLOWS_API_URL } from "../api";

export type WorkflowSession = {
  id: string;
  externalSessionId: string;
  externalSessionSource: "widget" | "dashboard";
  workflowId: string;
  customerId: string;
  verificationMode: "sandbox" | "production";
  activeDeviceId: string | null;
  // Soft-delete (archive) state. archived is the convenience flag; the rest are
  // the audit trail of who archived it and why.
  archived: boolean;
  deletedAt: string | null;
  deletedBy: string | null;
  deleteReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WorkflowSessionStep = {
  id: string;
  sessionId: string;
  step: string;
  status:
    | "PENDING"
    | "IN_PROGRESS"
    | "SUCCEEDED"
    | "FAILED"
    | "REQUIRES_REVIEW";
  message: string | null;
  traceId: string | null;
  parentStepId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WorkflowSessionAttribute = {
  id: string;
  workflowSessionId: string;
  attribute: string;
  value: string;
  attributeType: "STRING" | "BOOLEAN" | "NUMBER" | "DATE";
  createdAt: string;
  updatedAt: string;
};

export type WorkflowSessionEvent = {
  id: string;
  type: string;
  detail: {
    decision?: string;
    steps?: string[];
    reasonCodes?: string[];
    note?: string | null;
    reason?: string | null;
    // Snapshot of the prior attempt's data (attribute → value) on a
    // resubmission event — the baseline for the fraud comparison.
    snapshot?: Record<string, string>;
  } | null;
  occurredAt: string;
  createdBy: string | null;
};

export type WorkflowSessionDetail = {
  session: WorkflowSession;
  steps: WorkflowSessionStep[];
  attributes: WorkflowSessionAttribute[];
  // Append-only audit trail, oldest first — the activity timeline source.
  events: WorkflowSessionEvent[];
  // Gap vs the workflow's current requirements (a step/check/T&C was added
  // after submission). Drives re-verification for approved customers.
  //   steps  = identity sub-steps the customer must (re)complete
  //   checks = server-side checks not yet run for this session
  outstanding: { steps: string[]; checks: string[] };
  // Identity sub-steps enabled in the workflow right now — limits which steps
  // can be bounced for resubmission (customer can only redo enabled steps).
  enabledSteps: string[];
};

export type ReviewDecision = "approved" | "rejected" | "flagged";

export type ReviewQueueStatus =
  | "needs_review"
  | "approved"
  | "rejected"
  | "resubmission"
  | "in_progress";

// Queue filter values: the five derived statuses plus "open" (everything not
// terminal) and "archived" (soft-deleted, hidden under every other filter).
export type ReviewQueueFilter = ReviewQueueStatus | "open" | "archived";

export type ReviewQueueRow = WorkflowSession & {
  reviewStatus: ReviewQueueStatus;
  // Display name resolved from identity data when captured; falls back to id.
  customerName: string | null;
  // ISO alpha-2 country (document / issuing / nationality / address), or null.
  customerCountry: string | null;
};

export type ReviewQueuePage = {
  items: ReviewQueueRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type ReviewSortField = "createdAt" | "verificationMode" | "reviewStatus";

export type ReviewQueueFilters = {
  workspaceId: string;
  page: number;
  limit: number;
  status?: ReviewQueueFilter;
  mode?: "sandbox" | "production";
  search?: string;
  sortBy?: ReviewSortField;
  sortDir?: "asc" | "desc";
};

export const useReviewQueue = (filters: ReviewQueueFilters) =>
  useQuery({
    queryKey: ["review-queue", filters],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(filters.page),
        limit: String(filters.limit),
      });
      if (filters.status) params.set("status", filters.status);
      if (filters.mode) params.set("mode", filters.mode);
      if (filters.search?.trim()) params.set("search", filters.search.trim());
      if (filters.sortBy) params.set("sortBy", filters.sortBy);
      if (filters.sortDir) params.set("sortDir", filters.sortDir);
      return apiFetch<ReviewQueuePage>(
        `${WORKFLOWS_API_URL}/workflows/workflow-sessions/workspace/${encodeURIComponent(filters.workspaceId)}/review-queue?${params.toString()}`,
      );
    },
    enabled: !!filters.workspaceId,
  });

export const useWorkflowSessions = (workspaceId: string) =>
  useQuery({
    queryKey: ["workflow-sessions", workspaceId],
    queryFn: () =>
      apiFetch<WorkflowSession[]>(
        `${WORKFLOWS_API_URL}/workflows/workflow-sessions/workspace/${encodeURIComponent(workspaceId)}`,
      ),
    enabled: !!workspaceId,
  });

export type WorkspaceVerificationStats = { thisMonth: number; total: number };

// Workspace-scoped verification (session) counts for the overview.
export const useWorkspaceVerificationStats = (workspaceId: string | null) =>
  useQuery({
    queryKey: ["workspace-verification-stats", workspaceId],
    enabled: !!workspaceId,
    queryFn: () =>
      apiFetch<WorkspaceVerificationStats>(
        `${WORKFLOWS_API_URL}/workflows/workflow-sessions/workspace/${encodeURIComponent(workspaceId!)}/verification-stats`,
      ),
  });

export const useWorkflowSession = (sessionId: string | null) =>
  useQuery({
    queryKey: ["workflow-session", sessionId],
    queryFn: () =>
      apiFetch<WorkflowSessionDetail>(
        `${WORKFLOWS_API_URL}/workflows/workflow-sessions/${encodeURIComponent(sessionId!)}`,
      ),
    enabled: !!sessionId,
    // Poll while any step is still running so async provider checks (AML,
    // fraud) stream into the review page without a manual refresh; stop once
    // everything has settled.
    refetchInterval: (query) => {
      const steps = query.state.data?.steps ?? [];
      const pending = steps.some(
        (s) => s.status === "PENDING" || s.status === "IN_PROGRESS",
      );
      return pending ? 2500 : false;
    },
  });

export type SessionFileKind =
  | "document_front"
  | "document_back"
  | "face_video"
  | "proof_of_residence";

export type SessionFileMeta = {
  url: string;
  key: string;
  contentType: string | null;
  size: number | null;
  uploadedAt: string | null;
};

export const useSessionFileUrl = (
  sessionId: string | null,
  kind: SessionFileKind,
) =>
  useQuery({
    queryKey: ["workflow-session-file", sessionId, kind],
    queryFn: () =>
      apiFetch<SessionFileMeta>(
        `${WORKFLOWS_API_URL}/workflows/workflow-sessions/${encodeURIComponent(sessionId!)}/files/${kind}/url`,
      ).catch(() => null),
    enabled: !!sessionId,
    retry: false,
  });

// Signed URL for a PREVIOUS attempt's object key (from a resubmission event
// snapshot) — used by the identity-swap comparison to render the prior image.
export const useSessionFileUrlByKey = (
  sessionId: string | null,
  key: string | null | undefined,
) =>
  useQuery({
    queryKey: ["workflow-session-file-by-key", sessionId, key],
    queryFn: () =>
      apiFetch<SessionFileMeta>(
        `${WORKFLOWS_API_URL}/workflows/workflow-sessions/${encodeURIComponent(sessionId!)}/file-by-key/url?key=${encodeURIComponent(key!)}`,
      ).catch(() => null),
    enabled: !!sessionId && !!key,
    retry: false,
  });

// Starts a session attributed to a throwaway customer id so the admin can walk
// through the workflow. The session inherits the workflow's mode (Sandbox or
// Live) — the backend derives it from the workflow, so we don't pin it here.
export const useStartTestSession = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (workflowId: string) => {
      const stamp = Date.now();
      const rand = Math.random().toString(36).slice(2, 10);
      return apiFetch<WorkflowSession>(
        `${WORKFLOWS_API_URL}/workflows/workflow-sessions`,
        {
          method: "POST",
          body: JSON.stringify({
            externalSessionId: `test_${stamp}_${rand}`,
            externalSessionSource: "dashboard",
            workflowId,
            customerId: `test_${stamp}_${rand}`,
          }),
        },
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workflow-sessions"] });
    },
  });
};

export const useFinalizeSession = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      sessionId: string;
      decision: ReviewDecision;
      reviewedBy: string;
      reason?: string;
      reasonCodes?: string[];
    }) =>
      apiFetch(
        `${WORKFLOWS_API_URL}/workflows/workflow-sessions/${encodeURIComponent(data.sessionId)}/finalize`,
        {
          method: "POST",
          body: JSON.stringify({
            decision: data.decision,
            reviewedBy: data.reviewedBy,
            reason: data.reason,
            reasonCodes: data.reasonCodes,
          }),
        },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workflow-sessions"] });
      qc.invalidateQueries({ queryKey: ["workflow-session"] });
    },
  });
};

export const useWriteSessionAttributes = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      sessionId: string;
      attributes: Array<{
        attribute: string;
        value: string;
        attributeType: WorkflowSessionAttribute["attributeType"];
      }>;
    }) =>
      apiFetch(
        `${WORKFLOWS_API_URL}/workflows/workflow-sessions/${encodeURIComponent(data.sessionId)}/attributes`,
        {
          method: "POST",
          body: JSON.stringify({ attributes: data.attributes }),
        },
      ),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({
        queryKey: ["workflow-session", vars.sessionId],
      });
    },
  });
};

// Manual identity data entry from the review page. `fields` keys are canonical
// field suffixes (document_first_name, date_of_birth, …); the backend writes
// the identity_verification.* attributes (same shape iDenfy produces).
export const useSaveIdentityData = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { sessionId: string; fields: Record<string, string> }) =>
      apiFetch<{ written: number }>(
        `${WORKFLOWS_API_URL}/workflows/workflow-sessions/${encodeURIComponent(data.sessionId)}/identity-data`,
        { method: "POST", body: JSON.stringify({ fields: data.fields }) },
      ),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["workflow-session", vars.sessionId] });
    },
  });
};

// Officer "Run checks" trigger — re-fires the workflow's provider checks (AML
// now included once a name exists). Results stream back async, so we
// invalidate the session so the dashboard re-polls the updated step statuses.
export const useRunChecks = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) =>
      apiFetch<{ triggered: boolean }>(
        `${WORKFLOWS_API_URL}/workflows/workflow-sessions/${encodeURIComponent(sessionId)}/run-checks`,
        { method: "POST" },
      ),
    onSuccess: (_d, sessionId) => {
      qc.invalidateQueries({ queryKey: ["workflow-session", sessionId] });
    },
  });
};

// Re-verify an approved customer against the workflow's current requirements.
// Runs outstanding server checks + prompts the customer for missing identity
// steps, WITHOUT de-approving. Only a failed re-check moves them.
export const useRequestReverification = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { sessionId: string; reviewedBy: string }) =>
      apiFetch<{ steps: string[]; checks: string[]; notified: boolean }>(
        `${WORKFLOWS_API_URL}/workflows/workflow-sessions/${encodeURIComponent(data.sessionId)}/request-reverification`,
        {
          method: "POST",
          body: JSON.stringify({ reviewedBy: data.reviewedBy }),
        },
      ),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["workflow-sessions"] });
      qc.invalidateQueries({ queryKey: ["workflow-session", vars.sessionId] });
    },
  });
};

// Soft-delete (archive) a submission — hides it from the queue but keeps the
// record for retention/audit. Requires a reason. Restore puts it back.
export const useArchiveSession = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      sessionId: string;
      reviewedBy: string;
      reason: string;
    }) =>
      apiFetch<{ archived: boolean }>(
        `${WORKFLOWS_API_URL}/workflows/workflow-sessions/${encodeURIComponent(data.sessionId)}/archive`,
        {
          method: "POST",
          body: JSON.stringify({
            reviewedBy: data.reviewedBy,
            reason: data.reason,
          }),
        },
      ),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["review-queue"] });
      qc.invalidateQueries({ queryKey: ["workflow-session", vars.sessionId] });
    },
  });
};

export const useRestoreSession = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) =>
      apiFetch<{ restored: boolean }>(
        `${WORKFLOWS_API_URL}/workflows/workflow-sessions/${encodeURIComponent(sessionId)}/restore`,
        { method: "POST" },
      ),
    onSuccess: (_d, sessionId) => {
      qc.invalidateQueries({ queryKey: ["review-queue"] });
      qc.invalidateQueries({ queryKey: ["workflow-session", sessionId] });
    },
  });
};

// Officer per-document verdict — records an id-scan / face-scan step status
// (SUCCEEDED = approved, FAILED = rejected). The Sumsub-style gate requires
// each document to be cleared before the whole submission can be approved.
export const useRecordStep = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      sessionId: string;
      step: string;
      status: WorkflowSessionStep["status"];
    }) =>
      apiFetch<WorkflowSessionStep>(
        `${WORKFLOWS_API_URL}/workflows/workflow-sessions/${encodeURIComponent(data.sessionId)}/steps`,
        {
          method: "POST",
          body: JSON.stringify({ step: data.step, status: data.status }),
        },
      ),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["workflow-session", vars.sessionId] });
    },
  });
};

// Request resubmission — bounces the session back to the customer for the
// chosen steps with an optional note (and triggers a branded email if we have
// a contact address). See request-resubmission endpoint.
export const useRequestResubmission = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      sessionId: string;
      steps: string[];
      note?: string;
      reasonCodes?: string[];
      reviewedBy: string;
    }) =>
      apiFetch(
        `${WORKFLOWS_API_URL}/workflows/workflow-sessions/${encodeURIComponent(data.sessionId)}/request-resubmission`,
        {
          method: "POST",
          body: JSON.stringify({
            steps: data.steps,
            note: data.note,
            reasonCodes: data.reasonCodes,
            reviewedBy: data.reviewedBy,
          }),
        },
      ),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["workflow-sessions"] });
      qc.invalidateQueries({ queryKey: ["workflow-session", vars.sessionId] });
    },
  });
};
