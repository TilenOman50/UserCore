import type { Logger } from "@usercore/logger";
import type { RabbitMQClient } from "@usercore/rabbitmq";
import type {
  ExternalSessionSource,
  KycStatus,
  ProviderShortName,
  WorkflowSessionStatus,
  WorkflowSessionStepType,
  WorkflowVerificationMode,
} from "@usercore/shared-types";
import {
  atLimit,
  EVENTS,
  getPlanFeatures,
  PROVIDER_EVENTS,
  type KycCompletedPayload,
  type ProviderCheckRequestedPayload,
} from "@usercore/shared-types";

import type { StorageService } from "../../storage/storageService";
import type { PlanClient } from "../plans/planClient";
import type { ProviderConfigurationsService } from "../providerConfigurations/providerConfigurationsService";
import type { WorkflowsRepository } from "../workflows/workflowsRepository";
import type { WorkflowStepsRepository } from "../workflowSteps/workflowStepsRepository";
import type {
  AttributeUpsert,
  WorkflowSessionAttributesRepository,
} from "./workflowSessionAttributesRepository";
import type { WorkflowSessionsRepository } from "./workflowSessionsRepository";
import type { WorkflowSessionStepsRepository } from "./workflowSessionStepsRepository";

export type ReviewDecision = "approved" | "rejected" | "flagged";

export const SESSION_FILE_KINDS = [
  "document_front",
  "document_back",
  "face_video",
  "proof_of_residence",
] as const;
export type SessionFileKind = (typeof SESSION_FILE_KINDS)[number];

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
    super(`Plan limit reached: ${limitType} (${used} / ${max} this month)`);
    this.name = "PlanLimitExceededError";
  }
}

export const createWorkflowSessionsService = (props: {
  workflowSessionsRepository: WorkflowSessionsRepository;
  workflowSessionStepsRepository: WorkflowSessionStepsRepository;
  workflowSessionAttributesRepository: WorkflowSessionAttributesRepository;
  workflowsRepository: WorkflowsRepository;
  workflowStepsRepository: WorkflowStepsRepository;
  providerConfigurationsService: ProviderConfigurationsService;
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
    workflowStepsRepository,
    providerConfigurationsService,
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
    // Drift handling: if the workflow has gained top-level steps since this
    // session was created, fill in the gaps before returning. Each missing
    // step is recorded PENDING and then auto-executed via its stub run-path,
    // so the operator's status view is always in sync with the current
    // workflow config without any explicit rescreen action.
    await _evaluateWorkflowDrift(id, session.workflowId);

    const [steps, attributes] = await Promise.all([
      workflowSessionStepsRepository.findBySessionId(id),
      workflowSessionAttributesRepository.findBySessionId(id),
    ]);
    return { session, steps, attributes };
  };

  // ──────────────────────────────────────────────────────────────────────
  // Drift detection — compares the workflow's currently-enabled top-level
  // steps to the session's recorded step rows. Anything missing gets
  // inserted as PENDING and immediately auto-run via stubs (AML, fraud,
  // dup, rules). Identity-verification is excluded because it's a
  // customer-interactive widget step, not a server-side check.
  // ──────────────────────────────────────────────────────────────────────
  const _evaluateWorkflowDrift = async (
    sessionId: string,
    workflowId: string,
  ) => {
    const workflow =
      await workflowsRepository.findByIdIncludingDeleted(workflowId);
    if (!workflow) return;
    const workflowWithSteps =
      await workflowsRepository.findByIdWithSteps(workflowId);
    if (!workflowWithSteps) return;

    const existingSteps =
      await workflowSessionStepsRepository.findBySessionId(sessionId);
    const recordedTypes = new Set(existingSteps.map((s) => s.step));

    // Server-side checks we know how to auto-run. Identity-verification is
    // the customer's job (widget flow); we don't synthesise records for it.
    const serverSideTypes: WorkflowSessionStepType[] = [
      "aml-screening",
      "fraud-detection",
      "duplicate-detection",
      "rules-engine",
    ];

    for (const wfStep of workflowWithSteps.steps) {
      const type = wfStep.type as WorkflowSessionStepType;
      if (!serverSideTypes.includes(type)) continue;
      if (recordedTypes.has(type)) continue;
      // Step is enabled in the workflow but never ran for this session —
      // record PENDING then immediately resolve via stub.
      await workflowSessionStepsRepository.upsert({
        sessionId,
        step: type,
        status: "PENDING",
      });
      await _runStubFor(sessionId, type);
    }
  };

  // Stub execution paths for the four server-side step types. Real provider
  // integrations would replace these with calls into their respective
  // services; for the diploma scope they auto-succeed and write a small mock
  // attribute the reviewer can see in the session detail.
  const _runStubFor = async (
    sessionId: string,
    type: WorkflowSessionStepType,
  ) => {
    const now = new Date().toISOString();
    let attributes: AttributeUpsert[] = [];
    switch (type) {
      case "aml-screening":
        attributes = [
          {
            attribute: "aml_screening.passed",
            value: "true",
            attributeType: "BOOLEAN",
          },
          {
            attribute: "aml_screening.checked_at",
            value: now,
            attributeType: "DATE",
          },
        ];
        break;
      case "fraud-detection":
        attributes = [
          {
            attribute: "fraud_detection.risk_score",
            value: "0.05",
            attributeType: "NUMBER",
          },
          {
            attribute: "fraud_detection.checked_at",
            value: now,
            attributeType: "DATE",
          },
        ];
        break;
      case "duplicate-detection":
        attributes = [
          {
            attribute: "duplicate_detection.match_found",
            value: "false",
            attributeType: "BOOLEAN",
          },
          {
            attribute: "duplicate_detection.checked_at",
            value: now,
            attributeType: "DATE",
          },
        ];
        break;
      case "rules-engine":
        attributes = [
          {
            attribute: "rules_engine.flagged",
            value: "false",
            attributeType: "BOOLEAN",
          },
          {
            attribute: "rules_engine.checked_at",
            value: now,
            attributeType: "DATE",
          },
        ];
        break;
      default:
        return;
    }
    await workflowSessionAttributesRepository.batchUpsert({
      workflowSessionId: sessionId,
      attributes,
    });
    await workflowSessionStepsRepository.upsert({
      sessionId,
      step: type,
      status: "SUCCEEDED",
    });
    logger.info({
      msg: "Stub-executed top-level step",
      sessionId,
      step: type,
    });
  };

  const listForReviewQueue = async (workspaceId: string) => {
    return workflowSessionsRepository.listByWorkspace(workspaceId);
  };

  // Build the `data` blob each provider check receives. We pluck whatever
  // session attributes we have (collected during identity-verification) and
  // pass them through with provider-friendly key names. Missing fields are
  // simply absent — the dispatcher handlers will read `searchTerm`, `ip`
  // etc. and decide what to do with what's there.
  const buildCheckRequestData = (
    attributes: { attribute: string; value: string }[],
  ): Record<string, unknown> => {
    const find = (key: string) =>
      attributes.find((a) => a.attribute === key)?.value;
    const street = find("address.street");
    const city = find("address.city");
    const country = find("address.country");
    const email = find("contact_information.email");
    return {
      searchTerm: email ?? "",
      email,
      phone: find("contact_information.phone"),
      country,
      address: [street, city, country].filter(Boolean).join(", ") || undefined,
      // Server-derived at submit time (see recordStepStatus). Empty when the
      // request didn't come through a proxy that set x-forwarded-for (e.g.
      // bare localhost) — IPQS then returns a low-confidence result.
      ip: find("_session.client_ip") ?? "",
    };
  };

  const publishProviderChecksForSession = async (sessionId: string) => {
    const session = await workflowSessionsRepository.findById(sessionId);
    if (!session) return;
    const workflow = await workflowsRepository.findById(session.workflowId);
    if (!workflow) return;
    const steps = await workflowStepsRepository.findByWorkflowId(
      session.workflowId,
    );
    const providerSteps = steps.filter(
      (s) =>
        s.provider !== null &&
        (s.type === "aml-screening" || s.type === "fraud-detection"),
    );
    if (providerSteps.length === 0) return;

    const attributes =
      await workflowSessionAttributesRepository.findBySessionId(sessionId);
    const checkData = buildCheckRequestData(attributes);

    for (const step of providerSteps) {
      if (!step.provider) continue;
      const effective = await providerConfigurationsService.getEffectiveConfig({
        workflowSessionId: sessionId,
        provider: step.provider as ProviderShortName,
      });
      const payload: ProviderCheckRequestedPayload = {
        workflowSessionId: sessionId,
        workflowStepType: step.type,
        providerShortName: step.provider as ProviderShortName,
        workspaceId: workflow.workspaceId,
        customerId: session.customerId,
        // Tell the dispatcher whether to short-circuit with a canned
        // response (sandbox) or hit the real provider (production). Read
        // off the session — the workflow's mode is captured there at
        // session-create time so a mid-flight mode flip can't surprise
        // us during dispatch.
        verificationMode: session.verificationMode,
        data: checkData,
        credentials:
          effective.mode === "byo"
            ? { apiKey: effective.apiKey, apiSecret: effective.apiSecret }
            : null,
      };
      await rabbitMQ.publish({
        exchange: "usercore.events",
        routingKey: PROVIDER_EVENTS.CHECK_REQUESTED,
        payload,
      });
      logger.info({
        msg: "Published providers.check.requested",
        sessionId,
        provider: step.provider,
        mode: effective.mode,
      });
    }
  };

  const recordStepStatus = async (data: {
    sessionId: string;
    step: WorkflowSessionStepType;
    status: WorkflowSessionStatus;
    message?: string | null;
    parentStepId?: string | null;
    traceId?: string | null;
    // Server-derived customer IP, captured by the route off the connection
    // headers. Persisted as an attribute so fraud-detection (IPQS) can use
    // it. Not part of the step row.
    clientIp?: string | null;
  }) => {
    const { clientIp, ...stepData } = data;
    const row = await workflowSessionStepsRepository.upsert(stepData);
    // Identity-verification reaching REQUIRES_REVIEW is our "session
    // submitted by customer" signal — fan out any provider checks the
    // workflow has configured (AML, fraud) so they run in the background
    // while the manual reviewer waits to make a decision.
    if (
      data.step === "identity-verification" &&
      data.status === "REQUIRES_REVIEW"
    ) {
      // Stash the IP first so it's available when buildCheckRequestData
      // assembles the IPQS payload below.
      if (clientIp) {
        await workflowSessionAttributesRepository
          .batchUpsert({
            workflowSessionId: data.sessionId,
            attributes: [
              {
                attribute: "_session.client_ip",
                value: clientIp,
                attributeType: "STRING",
              },
            ],
          })
          .catch((err) => {
            logger.warn({
              msg: "Failed to persist client IP — IPQS will run without it",
              sessionId: data.sessionId,
              error: err instanceof Error ? err.message : String(err),
            });
          });
      }
      publishProviderChecksForSession(data.sessionId).catch((err) => {
        logger.error({
          msg: "Failed to publish provider check requests",
          sessionId: data.sessionId,
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }
    return row;
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
    kind: SessionFileKind;
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
    kind: SessionFileKind;
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
