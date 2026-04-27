import type { Logger } from "@usercore/logger";
import type { RabbitMQClient } from "@usercore/rabbitmq";
import type {
  ExternalSessionSource,
  KycStatus,
  WorkflowSessionStatus,
  WorkflowSessionStepType,
  WorkflowVerificationMode,
} from "@usercore/shared-types";
import {
  atLimit,
  EVENTS,
  getPlanFeatures,
  type KycCompletedPayload,
} from "@usercore/shared-types";

import type { StorageService } from "../../storage/storageService";
import type { PlanClient } from "../plans/planClient";
import type { WorkflowsRepository } from "../workflows/workflowsRepository";
import type {
  AttributeUpsert,
  WorkflowSessionAttributesRepository,
} from "./workflowSessionAttributesRepository";
import type { WorkflowSessionsRepository } from "./workflowSessionsRepository";
import type { WorkflowSessionStepsRepository } from "./workflowSessionStepsRepository";

export type ReviewDecision = "approved" | "rejected" | "flagged";

const DECISION_TO_KYC_STATUS: Record<ReviewDecision, KycStatus> = {
  approved: "approved",
  rejected: "rejected",
  flagged: "flagged",
};

// Thrown when the org's verifications-per-month quota is exhausted. The route
// layer turns this into a 403 with a structured body so the widget can render
// a meaningful message.
export class PlanLimitExceededError extends Error {
  readonly code = "plan_limit_exceeded" as const;
  constructor(
    public readonly limitType: "verifications_per_month",
    public readonly used: number,
    public readonly max: number,
  ) {
    super(
      `Plan limit reached: ${limitType} (${used} / ${max} this month)`,
    );
    this.name = "PlanLimitExceededError";
  }
}

export const createWorkflowSessionsService = (props: {
  workflowSessionsRepository: WorkflowSessionsRepository;
  workflowSessionStepsRepository: WorkflowSessionStepsRepository;
  workflowSessionAttributesRepository: WorkflowSessionAttributesRepository;
  workflowsRepository: WorkflowsRepository;
  storageService: StorageService;
  planClient: PlanClient;
  rabbitMQ: RabbitMQClient;
  logger: Logger;
}) => {
  const {
    workflowSessionsRepository,
    workflowSessionStepsRepository,
    workflowSessionAttributesRepository,
    workflowsRepository,
    storageService,
    planClient,
    rabbitMQ,
    logger,
  } = props;

  // Idempotent on the unique key (externalSessionId, externalSessionSource,
  // workflowId, customerId, verificationMode) — re-calls return the existing
  // row instead of failing on a constraint violation.
  const createSession = async (data: {
    externalSessionId: string;
    externalSessionSource: ExternalSessionSource;
    workflowId: string;
    customerId: string;
    verificationMode?: WorkflowVerificationMode;
    activeDeviceId?: string;
  }) => {
    const verificationMode = data.verificationMode ?? "sandbox";
    const existing = await workflowSessionsRepository.findByExternalSession({
      externalSessionId: data.externalSessionId,
      externalSessionSource: data.externalSessionSource,
      workflowId: data.workflowId,
      customerId: data.customerId,
      verificationMode,
    });
    if (existing) return existing;

    // Hard-cap the org's verifications-per-month quota before we insert.
    // Look up workflow → org → plan → limit; count current month's sessions
    // for that org. Cap is checked via atLimit() so unlimited plans skip.
    const workflow = await workflowsRepository.findById(data.workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${data.workflowId} not found`);
    }
    const org = await planClient.getOrganization(workflow.organizationId);
    if (org) {
      const features = getPlanFeatures(org.plan);
      const used =
        await workflowSessionsRepository.countForOrganizationCurrentMonth(
          workflow.organizationId,
        );
      if (atLimit(used, features.maxVerificationsPerMonth)) {
        throw new PlanLimitExceededError(
          "verifications_per_month",
          used,
          features.maxVerificationsPerMonth,
        );
      }
    }

    logger.info({
      msg: "Creating workflow session",
      workflowId: data.workflowId,
      customerId: data.customerId,
    });
    return workflowSessionsRepository.create({ ...data, verificationMode });
  };

  const getMonthlyVerificationStats = async (organizationId: string) => {
    const org = await planClient.getOrganization(organizationId);
    if (!org) return null;
    const features = getPlanFeatures(org.plan);
    const used =
      await workflowSessionsRepository.countForOrganizationCurrentMonth(
        organizationId,
      );
    return {
      used,
      max: features.maxVerificationsPerMonth,
      plan: org.plan,
    };
  };

  const getSession = async (id: string) => {
    const session = await workflowSessionsRepository.findById(id);
    if (!session) return null;
    const [steps, attributes] = await Promise.all([
      workflowSessionStepsRepository.findBySessionId(id),
      workflowSessionAttributesRepository.findBySessionId(id),
    ]);
    return { session, steps, attributes };
  };

  const listForReviewQueue = async (workspaceId: string) => {
    return workflowSessionsRepository.listByWorkspace(workspaceId);
  };

  const recordStepStatus = async (data: {
    sessionId: string;
    step: WorkflowSessionStepType;
    status: WorkflowSessionStatus;
    message?: string | null;
    parentStepId?: string | null;
    traceId?: string | null;
  }) => {
    return workflowSessionStepsRepository.upsert(data);
  };

  const writeAttributes = async (data: {
    workflowSessionId: string;
    attributes: AttributeUpsert[];
  }) => {
    return workflowSessionAttributesRepository.batchUpsert(data);
  };

  // Called when a session reaches a terminal state — manual reviewer presses
  // approve/reject, or the last provider check-completed handler resolves.
  // Looks up the workspace via the workflow, then publishes kyc.completed for
  // identity-api to update the customer profile.
  const finalizeSession = async (data: {
    workflowSessionId: string;
    decision: ReviewDecision;
    reviewedBy: string;
    reason?: string;
  }) => {
    const session = await workflowSessionsRepository.findById(
      data.workflowSessionId,
    );
    if (!session) {
      logger.warn({
        msg: "Cannot finalize unknown session",
        sessionId: data.workflowSessionId,
      });
      return null;
    }
    // Use the includes-deleted lookup so manual reviewers can finalize
    // sessions belonging to workflows that were soft-deleted after the
    // session was created — the session is still valid customer history.
    const workflow = await workflowsRepository.findByIdIncludingDeleted(
      session.workflowId,
    );
    if (!workflow) {
      logger.warn({
        msg: "Workflow missing for session",
        sessionId: data.workflowSessionId,
      });
      return null;
    }

    const payload: KycCompletedPayload = {
      workflowSessionId: session.id,
      customerId: session.customerId,
      workspaceId: workflow.workspaceId,
      status: DECISION_TO_KYC_STATUS[data.decision],
      reviewedAt: new Date().toISOString(),
      reviewedBy: data.reviewedBy,
      reason: data.reason,
    };
    await rabbitMQ.publish({
      exchange: "usercore.events",
      routingKey: EVENTS.KYC_COMPLETED,
      payload,
    });
    logger.info({
      msg: "Published kyc.completed",
      sessionId: session.id,
      decision: data.decision,
    });
    return session;
  };

  // Upload a customer-provided binary (doc photo, face video) to MinIO, then
  // record an attribute pointing at the object key. The same key is rendered
  // back to the dashboard reviewer via getSignedDownloadUrl.
  const uploadSessionFile = async (data: {
    workflowSessionId: string;
    kind: "document_front" | "document_back" | "face_video";
    fileBuffer: Buffer;
    mimeType: string;
  }) => {
    const key = `sessions/${data.workflowSessionId}/${data.kind}-${Date.now()}`;
    await storageService.uploadFile({
      key,
      body: data.fileBuffer,
      mimeType: data.mimeType,
    });
    await workflowSessionAttributesRepository.batchUpsert({
      workflowSessionId: data.workflowSessionId,
      attributes: [
        {
          attribute: `identity_verification.${data.kind}_s3_key`,
          value: key,
          attributeType: "STRING",
        },
      ],
    });
    return { key };
  };

  const getSessionFileUrl = async (data: {
    workflowSessionId: string;
    kind: "document_front" | "document_back" | "face_video";
  }) => {
    const attributes =
      await workflowSessionAttributesRepository.findBySessionId(
        data.workflowSessionId,
      );
    const attr = attributes.find(
      (a) => a.attribute === `identity_verification.${data.kind}_s3_key`,
    );
    if (!attr) return null;
    const url = await storageService.getSignedDownloadUrl(attr.value);
    return { url, key: attr.value };
  };

  return {
    createSession,
    getSession,
    listForReviewQueue,
    recordStepStatus,
    writeAttributes,
    uploadSessionFile,
    getSessionFileUrl,
    finalizeSession,
    getMonthlyVerificationStats,
  };
};

export type WorkflowSessionsService = ReturnType<
  typeof createWorkflowSessionsService
>;
