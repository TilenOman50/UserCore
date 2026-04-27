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

export type WorkflowSessionDetail = {
  session: WorkflowSession;
  steps: WorkflowSessionStep[];
  attributes: WorkflowSessionAttribute[];
};

export type ReviewDecision = "approved" | "rejected" | "flagged";

export const useWorkflowSessions = (workspaceId: string) =>
  useQuery({
    queryKey: ["workflow-sessions", workspaceId],
    queryFn: () =>
      apiFetch<WorkflowSession[]>(
        `${WORKFLOWS_API_URL}/workflows/workflow-sessions/workspace/${encodeURIComponent(workspaceId)}`,
      ),
    enabled: !!workspaceId,
  });

export const useWorkflowSession = (sessionId: string | null) =>
  useQuery({
    queryKey: ["workflow-session", sessionId],
    queryFn: () =>
      apiFetch<WorkflowSessionDetail>(
        `${WORKFLOWS_API_URL}/workflows/workflow-sessions/${encodeURIComponent(sessionId!)}`,
      ),
    enabled: !!sessionId,
  });

export const useSessionFileUrl = (
  sessionId: string | null,
  kind: "document_front" | "document_back" | "face_video",
) =>
  useQuery({
    queryKey: ["workflow-session-file", sessionId, kind],
    queryFn: () =>
      apiFetch<{ url: string; key: string }>(
        `${WORKFLOWS_API_URL}/workflows/workflow-sessions/${encodeURIComponent(sessionId!)}/files/${kind}/url`,
      ).catch(() => null),
    enabled: !!sessionId,
    retry: false,
  });

export const useFinalizeSession = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      sessionId: string;
      decision: ReviewDecision;
      reviewedBy: string;
      reason?: string;
    }) =>
      apiFetch(
        `${WORKFLOWS_API_URL}/workflows/workflow-sessions/${encodeURIComponent(data.sessionId)}/finalize`,
        {
          method: "POST",
          body: JSON.stringify({
            decision: data.decision,
            reviewedBy: data.reviewedBy,
            reason: data.reason,
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
