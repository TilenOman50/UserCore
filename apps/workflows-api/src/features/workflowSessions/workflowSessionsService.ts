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
  IDENTITY_DERIVED_KEYS,
  IDENTITY_VERIFICATION_FIELDS,
  identityAttributeKey,
  kycReasonLabel,
  PROVIDER_EVENTS,
  type KycCompletedPayload,
  type ProviderCheckRequestedPayload,
} from "@usercore/shared-types";

import { env } from "../../env";
import type { StorageService } from "../../storage/storageService";
import type { Mailer } from "../emailVerification/mailer";
import type { IdentityVerificationRepository } from "../identityVerification/identityVerificationRepository";
import type { PlanClient } from "../plans/planClient";
import type { ProviderConfigurationsService } from "../providerConfigurations/providerConfigurationsService";
import type { RulesEngineRepository } from "../rulesEngine/rulesEngineRepository";
import type { WorkflowsRepository } from "../workflows/workflowsRepository";
import type { WorkflowStepsRepository } from "../workflowSteps/workflowStepsRepository";
import type {
  AttributeUpsert,
  WorkflowSessionAttributesRepository,
} from "./workflowSessionAttributesRepository";
import type {
  ReviewQueueFilter,
  ReviewQueueStatus,
  WorkflowSessionsRepository,
} from "./workflowSessionsRepository";
import type { WorkflowSessionStepsRepository } from "./workflowSessionStepsRepository";

export type ReviewDecision = "approved" | "rejected" | "flagged";

export const SESSION_FILE_KINDS = [
  "document_front",
  "document_back",
  "face_video",
  "proof_of_residence",
] as const;
export type SessionFileKind = (typeof SESSION_FILE_KINDS)[number];

// Upload time is encoded in the storage key suffix (`<kind>-<epochMs>`, set in
// uploadSessionFile). Returns an ISO string, or null if the key isn't shaped
// that way (e.g. a legacy key).
const epochIsoFromKey = (key: string): string | null => {
  const ms = Number(key.split("-").pop());
  return Number.isFinite(ms) && ms > 0 ? new Date(ms).toISOString() : null;
};

// Identity attributes local duplicate detection compares across the workspace.
const DUPLICATE_MATCH_KEYS = [
  identityAttributeKey("document_number"),
  identityAttributeKey("document_first_name"),
  identityAttributeKey("document_last_name"),
  identityAttributeKey("date_of_birth"),
  identityAttributeKey("full_name"),
];

// Normalize a name for comparison: lowercase, collapse whitespace, trim.
const _normKey = (s: string): string =>
  s.toLowerCase().replace(/\s+/g, " ").trim();

// Per identity-verification sub-step: the attribute(s) the widget writes once
// the customer completes it. A sub-step counts as "done for this session" if
// any of its markers is present — used to detect which now-required steps an
// approved customer never completed (re-verification on policy change).
// NB: terms-acceptance staleness (hash change) isn't detected here; the widget
// re-prompts for stale terms on resume.
// Server-side check step types (vs customer-interactive identity sub-steps).
const CHECK_STEP_TYPES = [
  "aml-screening",
  "fraud-detection",
  "duplicate-detection",
  "rules-engine",
];

// djb2 — MUST stay identical to the widget's policy.ts hashText so a session's
// stored terms_acceptance.policy_hash matches what we compute here. Used only
// for custom terms text (admin-edited T&C); default terms never change.
const _hashTermsText = (text: string): string => {
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash) ^ text.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
};

const SUBSTEP_COMPLETION_MARKERS: Record<string, string[]> = {
  "id-scan": ["identity_verification.document_complete"],
  "face-scan": ["identity_verification.liveness_passed"],
  "proof-of-residence": ["proof_of_residence.complete"],
  "contact-information": [
    "contact_information.email",
    "contact_information.phone",
  ],
  "email-verification": ["email_verification.email"],
  "terms-acceptance": ["terms_acceptance.accepted"],
};

// Identity sub-steps whose output is a document/selfie a human reviewer gives a
// per-document verdict on — as opposed to self-verifying steps (terms/contact/
// email). On the manual path these can't auto-pass: re-collecting one must pull
// the session back into review.
const HUMAN_REVIEW_DOC_STEPS = ["id-scan", "face-scan", "proof-of-residence"];

// When a reviewer bounces a step back for resubmission, wipe its captured data
// so the customer's NEW submission fully replaces the old values — instead of
// merging with stale data (and a stale Approve/Reject verdict) from the first
// attempt. Keyed by sub-step type. Self-verifying steps (contact / email) are
// intentionally omitted: the customer simply re-enters those, and clearing the
// verified email would break the resubmission-notification address lookup.
const RESUBMISSION_CLEAR_ATTRIBUTES: Record<string, string[]> = {
  "id-scan": [
    "identity_verification.document_complete",
    "identity_verification.document_type",
    "identity_verification.document_country",
    "identity_verification.document_number",
    "identity_verification.document_first_name",
    "identity_verification.document_last_name",
    "identity_verification.full_name",
    "identity_verification.date_of_birth",
    "identity_verification.document_sex",
    "identity_verification.document_date_of_issue",
    "identity_verification.document_expiry",
    "identity_verification.document_nationality",
    "identity_verification.document_issuing_country",
    "identity_verification.document_personal_code",
    "identity_verification.document_front_s3_key",
    "identity_verification.document_back_s3_key",
    "identity_verification.provider_decision",
    "identity_verification.provider_scan_ref",
  ],
  "face-scan": [
    "identity_verification.liveness_passed",
    "identity_verification.liveness_checks",
    "identity_verification.liveness_confidence",
    "identity_verification.face_status",
    "identity_verification.face_video_s3_key",
  ],
  "proof-of-residence": [
    "proof_of_residence.complete",
    "proof_of_residence.document_type",
    "identity_verification.proof_of_residence_s3_key",
    "address.street",
    "address.city",
    "address.postal_code",
    "address.country",
  ],
};

// If the widget's `_session.last_seen_at` heartbeat (stamped ~every 5s while the
// customer sits on the end screen) is fresher than this, they're watching live —
// so skip the email; the on-screen update already shows the outcome / re-routes
// them. ~2 missed beats of slack.
const WIDGET_PRESENCE_WINDOW_MS = 12_000;

const DECISION_TO_KYC_STATUS: Record<ReviewDecision, KycStatus> = {
  approved: "approved",
  rejected: "rejected",
  flagged: "flagged",
};

// Reviewer decision → identity-verification step status. Surfaced to the
// customer when they reopen the widget link (approved/rejected terminal
// screen). "flagged" keeps the session in review.
const DECISION_TO_STEP_STATUS: Record<ReviewDecision, WorkflowSessionStatus> = {
  approved: "SUCCEEDED",
  rejected: "FAILED",
  flagged: "REQUIRES_REVIEW",
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
  rulesEngineRepository: RulesEngineRepository;
  identityVerificationRepository: IdentityVerificationRepository;
  providerConfigurationsService: ProviderConfigurationsService;
  storageService: StorageService;
  mailer: Mailer;
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
    rulesEngineRepository,
    identityVerificationRepository,
    providerConfigurationsService,
    storageService,
    mailer,
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
    // The workflow's Live/Sandbox toggle is the source of truth for the mode —
    // a session inherits it unless the caller explicitly overrides (e.g. a
    // sandbox key). Load the workflow up front so it also feeds the quota check.
    const workflow = await workflowsRepository.findById(data.workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${data.workflowId} not found`);
    }
    const verificationMode = data.verificationMode ?? workflow.verificationMode;
    const existing = await workflowSessionsRepository.findByExternalSession({
      externalSessionId: data.externalSessionId,
      externalSessionSource: data.externalSessionSource,
      workflowId: data.workflowId,
      customerId: data.customerId,
      verificationMode,
    });
    if (existing) return existing;

    // Hard-cap the org's verifications-per-month quota before we insert.
    // org → plan → limit; count current month's sessions for the org. Cap is
    // checked via atLimit() so unlimited plans skip.
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
    // A session is a frozen snapshot of what was screened at onboarding. Editing
    // the workflow later does NOT backfill new server checks onto past sessions:
    // duplicate detection and the rules engine are point-in-time and frozen once
    // they run; AML and fraud are re-screened ON DEMAND from the customer detail
    // page (not here). To screen an in-flight case against a newly-added check,
    // the reviewer runs it explicitly via "Run checks".
    const [steps, attributes, events] = await Promise.all([
      workflowSessionStepsRepository.findBySessionId(id),
      workflowSessionAttributesRepository.findBySessionId(id),
      workflowSessionsRepository.findEventsBySession(id),
    ]);
    const outstanding = await computeOutstanding(
      session.workflowId,
      attributes,
      steps,
    );
    // Currently-enabled identity sub-steps — limits which steps a reviewer can
    // bounce for resubmission (the customer can only redo enabled steps).
    const enabledSteps = await getEnabledSubStepTypes(session.workflowId);
    return { session, steps, attributes, events, outstanding, enabledSteps };
  };

  // Runnable server-check types (AML / fraud / duplicate / rules) configured on
  // a workflow right now. Frozen onto the session at submission so the review
  // page's checks panel survives later workflow edits (a session is a snapshot).
  const getConfiguredCheckTypes = async (
    workflowId: string,
  ): Promise<string[]> => {
    const workflowSteps =
      await workflowStepsRepository.findByWorkflowId(workflowId);
    return workflowSteps
      .filter((ws) => CHECK_STEP_TYPES.includes(ws.type))
      .filter(
        (ws) =>
          ws.type === "duplicate-detection" ||
          ws.type === "rules-engine" ||
          ws.provider !== null, // AML/fraud need a provider to run
      )
      .map((ws) => ws.type);
  };

  // Identity sub-step types ENABLED in the workflow right now. Drives which
  // steps a reviewer may bounce for resubmission — the customer can only redo
  // currently-enabled steps (a step removed from the workflow can't be redone),
  // so the resubmission picker must filter to this set.
  const getEnabledSubStepTypes = async (
    workflowId: string,
  ): Promise<string[]> => {
    const ivWorkflowStep = await workflowStepsRepository.findByWorkflowAndType(
      workflowId,
      "identity-verification",
    );
    if (!ivWorkflowStep) return [];
    const ivStep = await identityVerificationRepository.findByWorkflowStepId(
      ivWorkflowStep.id,
    );
    if (!ivStep) return [];
    const subSteps = await identityVerificationRepository.findSubStepsByStepId(
      ivStep.id,
    );
    return subSteps.filter((ss) => ss.enabled).map((ss) => ss.type);
  };

  // The gap between the workflow's CURRENT requirements and what this session
  // satisfies — read-time only, no mutation (the session stays a snapshot).
  //   steps  = identity-verification sub-steps the customer must (re)complete
  //            (enabled but not done, or stale custom T&C) — needs the widget.
  //   checks = server-side checks (AML/fraud/duplicate/rules) enabled in the
  //            workflow that never ran for this session — run server-side.
  const computeOutstanding = async (
    workflowId: string,
    attributes: Array<{ attribute: string; value: string }>,
    stepRows: Array<{ step: string }>,
  ): Promise<{ steps: string[]; checks: string[] }> => {
    const present = new Set(
      attributes.filter((a) => a.value?.trim()).map((a) => a.attribute),
    );
    const storedTermsHash = attributes.find(
      (a) => a.attribute === "terms_acceptance.policy_hash",
    )?.value;

    // Customer-action steps (identity-verification sub-steps).
    const steps: string[] = [];
    const ivWorkflowStep = await workflowStepsRepository.findByWorkflowAndType(
      workflowId,
      "identity-verification",
    );
    if (ivWorkflowStep) {
      const ivStep = await identityVerificationRepository.findByWorkflowStepId(
        ivWorkflowStep.id,
      );
      if (ivStep) {
        const subSteps =
          await identityVerificationRepository.findSubStepsByStepId(ivStep.id);
        for (const ss of subSteps) {
          if (!ss.enabled) continue;
          if (ss.type === "terms-acceptance") {
            // Only flag T&C when the admin edited custom text and the stored
            // hash no longer matches (default terms never change).
            const cfg = ss.providerConfig as {
              termsText?: string | null;
            } | null;
            const custom = cfg?.termsText?.trim();
            if (
              custom &&
              (!storedTermsHash || storedTermsHash !== _hashTermsText(custom))
            ) {
              steps.push(ss.type);
            }
            continue;
          }
          const markers = SUBSTEP_COMPLETION_MARKERS[ss.type] ?? [];
          if (!markers.some((m) => present.has(m))) steps.push(ss.type);
        }
      }
    }

    // Server checks enabled in the workflow that never ran for this session.
    const recordedSteps = new Set(stepRows.map((s) => s.step));
    const workflowSteps =
      await workflowStepsRepository.findByWorkflowId(workflowId);
    const checks: string[] = [];
    for (const ws of workflowSteps) {
      if (!CHECK_STEP_TYPES.includes(ws.type)) continue;
      const runnable =
        ws.type === "duplicate-detection" ||
        ws.type === "rules-engine" ||
        ws.provider !== null; // AML/fraud need a provider to run
      if (runnable && !recordedSteps.has(ws.type)) checks.push(ws.type);
    }

    return { steps, checks };
  };

  const listForReviewQueue = async (workspaceId: string) => {
    return workflowSessionsRepository.listByWorkspace(workspaceId);
  };

  // Paginated + filtered review queue with a derived per-session review
  // status (resubmission takes precedence, then the identity-verification
  // step status). Powers the dashboard's review table.
  const listReviewQueuePaginated = async (data: {
    workspaceId: string;
    page: number;
    limit: number;
    status?: ReviewQueueFilter;
    mode?: WorkflowVerificationMode;
    search?: string;
  }) => {
    const { rows, total } =
      await workflowSessionsRepository.listForReviewQueuePaginated(data);
    // Resolve display name + country for this page so the table can show a name
    // (with id underneath) and a country flag where we captured them.
    const meta = await workflowSessionsRepository.findRowMetaForSessions(
      rows.map((r) => r.session.id),
    );
    const items = rows.map((r) => {
      const resubmission = r.resubmission === "true";
      let reviewStatus: ReviewQueueStatus;
      if (resubmission) {
        reviewStatus = "resubmission";
      } else if (r.ivStatus === "SUCCEEDED") {
        reviewStatus = "approved";
      } else if (r.ivStatus === "FAILED") {
        reviewStatus = "rejected";
      } else if (r.ivStatus === "REQUIRES_REVIEW") {
        reviewStatus = "needs_review";
      } else {
        reviewStatus = "in_progress";
      }
      const m = meta.get(r.session.id);
      return {
        ...r.session,
        reviewStatus,
        customerName: m?.name ?? null,
        customerCountry: m?.country ?? null,
      };
    });
    return {
      items,
      total,
      page: data.page,
      limit: data.limit,
      totalPages: Math.max(1, Math.ceil(total / data.limit)),
    };
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

    // AML search term comes from the canonical identity name (full_name, or
    // first+last) — NOT email. Populated by iDenfy today, by the manual
    // review form later. Empty until a name exists, which is why AML is
    // deferred when there's no name (see recordStepStatus / review design).
    const fullName = find(IDENTITY_DERIVED_KEYS.fullName);
    const firstName = find(identityAttributeKey("document_first_name"));
    const lastName = find(identityAttributeKey("document_last_name"));
    const searchTerm =
      fullName ?? [firstName, lastName].filter(Boolean).join(" ");
    // ComplyAdvantage accepts a birth_year filter to cut false positives.
    // DOB format varies by source, so pull the first 19xx/20xx year we find.
    const dob = find(identityAttributeKey("date_of_birth"));
    const birthYearMatch = dob?.match(/\b(19|20)\d{2}\b/);
    const birthYear = birthYearMatch ? Number(birthYearMatch[0]) : undefined;

    return {
      searchTerm: searchTerm || "",
      birthYear,
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

  // `allowed` (when given) restricts dispatch to that set of check types — used
  // by manual Run checks to honor the session's frozen expected_checks, so a
  // check added to the workflow after submission can't run for an in-flight
  // session. Omitted (submit / re-verification paths) = dispatch the live set.
  const publishProviderChecksForSession = async (
    sessionId: string,
    allowed?: Set<string>,
  ) => {
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
        (s.type === "aml-screening" || s.type === "fraud-detection") &&
        (!allowed || allowed.has(s.type)),
    );
    if (providerSteps.length === 0) return;

    const attributes =
      await workflowSessionAttributesRepository.findBySessionId(sessionId);
    const checkData = buildCheckRequestData(attributes);

    // Checks only fire once a name is present. With iDenfy the name is
    // extracted by submit time so everything fires automatically here; in the
    // manual flow there's no name yet, so we defer until the officer enters one
    // and presses Run checks (which re-invokes this with the name present).
    // Gating fraud the same way as AML — even though IPQS only needs the IP —
    // keeps it from firing at submit AND again on Run checks (no double call).
    const hasName =
      typeof checkData.searchTerm === "string" &&
      checkData.searchTerm.trim().length > 0;

    for (const step of providerSteps) {
      if (!step.provider) continue;
      if (!hasName) {
        logger.info({
          msg: `Deferring ${step.type} — no name yet (Run checks will trigger it)`,
          sessionId,
        });
        continue;
      }
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
      // Mark the check in-flight so the review page shows "running" and polls
      // until the completed consumer overwrites it with the real result.
      await workflowSessionStepsRepository.upsert({
        sessionId,
        step: step.type,
        status: "IN_PROGRESS",
        message: "check requested",
      });
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

  // ── In-house checks (no external provider, no RabbitMQ) ────────────────────
  // Duplicate detection + rules engine run locally. Triggered alongside the
  // provider checks: automatically at submit when a name is already present
  // (iDenfy), or via the manual "Run checks" once the officer enters a name.

  const runDuplicateDetection = async (sessionId: string) => {
    const session = await workflowSessionsRepository.findById(sessionId);
    if (!session) return;
    const workflow = await workflowsRepository.findById(session.workflowId);
    if (!workflow) return;

    const attributes =
      await workflowSessionAttributesRepository.findBySessionId(sessionId);
    const get = (suffix: string) =>
      attributes
        .find((a) => a.attribute === identityAttributeKey(suffix))
        ?.value?.trim() ?? "";
    const docNumber = get("document_number");
    const dob = get("date_of_birth");
    const selfName =
      get("full_name") ||
      [get("document_first_name"), get("document_last_name")]
        .filter(Boolean)
        .join(" ");
    const selfNameKey = _normKey(selfName);
    const hasDocNumber = docNumber.length > 0;
    const hasNameDob = selfNameKey.length > 0 && dob.length > 0;
    if (!hasDocNumber && !hasNameDob) return;

    const rows = await workflowSessionsRepository.findIdentityMatchRows({
      workspaceId: workflow.workspaceId,
      excludeCustomerId: session.customerId,
      attributeKeys: DUPLICATE_MATCH_KEYS,
    });

    // Collapse the EAV rows into one identity record per other customer. We
    // also keep a session id so the review page can deep-link to that match.
    const byCustomer = new Map<
      string,
      {
        sessionId: string;
        docNumber: string;
        fullName: string;
        first: string;
        last: string;
        dob: string;
      }
    >();
    for (const r of rows) {
      const rec = byCustomer.get(r.customerId) ?? {
        sessionId: r.sessionId,
        docNumber: "",
        fullName: "",
        first: "",
        last: "",
        dob: "",
      };
      rec.sessionId = r.sessionId;
      const v = r.value.trim();
      if (r.attribute === identityAttributeKey("document_number"))
        rec.docNumber = v;
      else if (r.attribute === identityAttributeKey("document_first_name"))
        rec.first = v;
      else if (r.attribute === identityAttributeKey("document_last_name"))
        rec.last = v;
      else if (r.attribute === identityAttributeKey("date_of_birth"))
        rec.dob = v;
      else if (r.attribute === identityAttributeKey("full_name"))
        rec.fullName = v;
      byCustomer.set(r.customerId, rec);
    }

    const matches: Array<{
      customerId: string;
      sessionId: string;
      name: string;
      on: "document" | "name+dob";
    }> = [];
    for (const [customerId, rec] of byCustomer) {
      const otherName =
        rec.fullName || [rec.first, rec.last].filter(Boolean).join(" ");
      const otherNameKey = _normKey(otherName);
      const docMatch =
        hasDocNumber &&
        rec.docNumber.length > 0 &&
        rec.docNumber.toLowerCase() === docNumber.toLowerCase();
      const nameDobMatch =
        hasNameDob &&
        otherNameKey.length > 0 &&
        otherNameKey === selfNameKey &&
        rec.dob === dob;
      if (docMatch || nameDobMatch) {
        matches.push({
          customerId,
          sessionId: rec.sessionId,
          name: otherName,
          on: docMatch ? "document" : "name+dob",
        });
      }
    }

    const matchFound = matches.length > 0;
    const attrs: AttributeUpsert[] = [
      {
        attribute: "duplicate_detection.match_found",
        value: String(matchFound),
        attributeType: "BOOLEAN",
      },
      {
        attribute: "duplicate_detection.match_count",
        value: String(matches.length),
        attributeType: "NUMBER",
      },
      {
        attribute: "duplicate_detection.checked_at",
        value: new Date().toISOString(),
        attributeType: "DATE",
      },
    ];
    if (matchFound) {
      attrs.push({
        attribute: "duplicate_detection.matched_customer_ids",
        value: matches.map((m) => m.customerId).join(","),
        attributeType: "STRING",
      });
      // Richer detail (id + name + what matched) for the review page.
      attrs.push({
        attribute: "duplicate_detection.matched_customers",
        value: JSON.stringify(matches),
        attributeType: "STRING",
      });
    }
    await workflowSessionAttributesRepository.batchUpsert({
      workflowSessionId: sessionId,
      attributes: attrs,
    });
    await workflowSessionStepsRepository.upsert({
      sessionId,
      step: "duplicate-detection",
      status: matchFound ? "REQUIRES_REVIEW" : "SUCCEEDED",
      message: matchFound
        ? `${matches.length} possible duplicate(s)`
        : "no duplicates found",
    });
    // A duplicate surfacing on an already-approved customer (re-screen) must
    // pull them back into review — same guard as a FAILED check.
    if (matchFound) {
      await applyAdverseTransition(sessionId).catch(() => undefined);
    }
    logger.info({
      msg: "Duplicate detection ran",
      sessionId,
      matchFound,
      count: matches.length,
    });
  };

  const runRulesEngine = async (sessionId: string) => {
    const session = await workflowSessionsRepository.findById(sessionId);
    if (!session) return;
    const workflow = await workflowsRepository.findById(session.workflowId);
    if (!workflow) return;

    const reWorkflowStep = await workflowStepsRepository.findByWorkflowAndType(
      session.workflowId,
      "rules-engine",
    );
    if (!reWorkflowStep) return;
    const reStep = await rulesEngineRepository.findStepByWorkflowStepId(
      reWorkflowStep.id,
    );
    const links = reStep
      ? await rulesEngineRepository.listScenarios(reStep.id)
      : [];
    const scenarioIds = links.map((l) => l.externalScenarioId);
    if (scenarioIds.length === 0) {
      await workflowSessionStepsRepository.upsert({
        sessionId,
        step: "rules-engine",
        status: "SUCCEEDED",
        message: "no scenarios linked",
      });
      return;
    }

    const attributes =
      await workflowSessionAttributesRepository.findBySessionId(sessionId);
    const customerData: Record<string, string> = {};
    for (const a of attributes) customerData[a.attribute] = a.value;

    type Action = { type: string; value: string; enabled: boolean };
    type Triggered = { scenarioId: string; name: string; actions: Action[] };
    type Evaluated = {
      scenarioId: string;
      name: string;
      matched: boolean;
      actions: Action[];
      conditions: Array<{
        attribute: string;
        operator: string;
        value: string;
        passed: boolean;
      }>;
    };
    let triggered: Triggered[] = [];
    let evaluations: Evaluated[] = [];
    try {
      const res = await fetch(`${env.SCENARIOS_API_URL}/scenarios/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: workflow.workspaceId,
          customerId: session.customerId,
          customerData,
          scenarioIds,
        }),
      });
      if (!res.ok) throw new Error(`scenarios-api responded ${res.status}`);
      const body = (await res.json()) as {
        triggered?: Triggered[];
        evaluations?: Evaluated[];
      };
      triggered = body.triggered ?? [];
      evaluations = body.evaluations ?? [];
    } catch (err) {
      logger.error({
        msg: "Rules engine evaluation failed",
        sessionId,
        error: err instanceof Error ? err.message : String(err),
      });
      await workflowSessionStepsRepository.upsert({
        sessionId,
        step: "rules-engine",
        status: "REQUIRES_REVIEW",
        message: "rules engine unavailable",
      });
      return;
    }

    // Rules engine is deterministic — binary pass/fail. Any scenario that
    // triggered means the customer failed a rule; none triggered = passed.
    const status: WorkflowSessionStatus =
      triggered.length > 0 ? "FAILED" : "SUCCEEDED";
    const names = triggered.map((t) => t.name).join(", ");

    await workflowSessionAttributesRepository.batchUpsert({
      workflowSessionId: sessionId,
      attributes: [
        {
          attribute: "rules_engine.flagged",
          value: String(triggered.length > 0),
          attributeType: "BOOLEAN",
        },
        {
          attribute: "rules_engine.triggered_scenarios",
          value: names,
          attributeType: "STRING",
        },
        {
          // Full per-scenario evaluation detail (name, matched, conditions) so
          // the review page can show what ran and why — like an activity log.
          attribute: "rules_engine.evaluations",
          value: JSON.stringify(evaluations),
          attributeType: "STRING",
        },
        {
          attribute: "rules_engine.checked_at",
          value: new Date().toISOString(),
          attributeType: "DATE",
        },
      ],
    });
    await workflowSessionStepsRepository.upsert({
      sessionId,
      step: "rules-engine",
      status,
      message:
        triggered.length > 0 ? `triggered: ${names}` : "no scenarios triggered",
    });
    // A matched scenario on an approved customer (re-screen) demotes them.
    if (status === "FAILED") {
      await applyAdverseTransition(sessionId).catch(() => undefined);
    }
    logger.info({
      msg: "Rules engine ran",
      sessionId,
      triggered: triggered.length,
      status,
    });
  };

  // Run the workflow's in-house checks (duplicate detection, rules engine) if
  // configured. Gated on a name being present — same deferral as AML so they
  // run automatically with iDenfy and on Run checks for the manual flow.
  const runInHouseChecks = async (
    sessionId: string,
    allowed?: Set<string>, // see publishProviderChecksForSession
  ) => {
    const session = await workflowSessionsRepository.findById(sessionId);
    if (!session) return;
    const steps = await workflowStepsRepository.findByWorkflowId(
      session.workflowId,
    );
    const hasDup =
      steps.some((s) => s.type === "duplicate-detection") &&
      (!allowed || allowed.has("duplicate-detection"));
    const hasRules =
      steps.some((s) => s.type === "rules-engine") &&
      (!allowed || allowed.has("rules-engine"));
    if (!hasDup && !hasRules) return;

    const attributes =
      await workflowSessionAttributesRepository.findBySessionId(sessionId);
    const checkData = buildCheckRequestData(attributes);
    const hasName =
      typeof checkData.searchTerm === "string" &&
      checkData.searchTerm.trim().length > 0;
    if (!hasName) {
      logger.info({
        msg: "Deferring in-house checks — no name yet",
        sessionId,
      });
      return;
    }

    if (hasDup) {
      await runDuplicateDetection(sessionId).catch((err) => {
        logger.error({
          msg: "Duplicate detection failed",
          sessionId,
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }
    if (hasRules) {
      await runRulesEngine(sessionId).catch((err) => {
        logger.error({
          msg: "Rules engine failed",
          sessionId,
          error: err instanceof Error ? err.message : String(err),
        });
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
      // Freeze the check types the workflow configures RIGHT NOW onto the
      // session, so the review page's checks panel reflects what was expected at
      // submission — even if the workflow is edited later. Without this, a
      // not-yet-run check vanishes from review once it's removed from the
      // workflow (the panel would otherwise read the live config).
      const submitSession = await workflowSessionsRepository.findById(
        data.sessionId,
      );
      const expectedChecks = submitSession
        ? await getConfiguredCheckTypes(submitSession.workflowId)
        : [];

      // The manual flow's "country of residence" lives in the POR address;
      // mirror it into the canonical scenario attribute so residence-based
      // scenarios fire on the manual path too (iDenfy writes it directly from
      // selectedCountry). Only when not already set, so iDenfy's value wins.
      const submitAttrs =
        await workflowSessionAttributesRepository.findBySessionId(
          data.sessionId,
        );
      const residenceCountry = submitAttrs
        .find((a) => a.attribute === "address.country")
        ?.value?.trim();
      const hasResidence = submitAttrs.some(
        (a) =>
          a.attribute === "identity_verification.country_of_residence" &&
          a.value?.trim(),
      );

      // Stash the IP (for IPQS) and clear any resubmission flag — the
      // customer just re-submitted, so the session is back "in review", not
      // awaiting redo. Both are best-effort attribute writes.
      const submitMarkers: AttributeUpsert[] = [
        {
          attribute: "_session.resubmission_requested",
          value: "false",
          attributeType: "BOOLEAN",
        },
        // Timestamp of the (latest) submission for review — powers the "Submitted
        // for review" entry on the dashboard activity timeline.
        {
          attribute: "_session.submitted_at",
          value: new Date().toISOString(),
          attributeType: "DATE",
        },
        // Frozen slate of expected server checks (see above).
        {
          attribute: "_session.expected_checks",
          value: expectedChecks.join(","),
          attributeType: "STRING",
        },
      ];
      if (clientIp) {
        submitMarkers.push({
          attribute: "_session.client_ip",
          value: clientIp,
          attributeType: "STRING",
        });
      }
      if (residenceCountry && !hasResidence) {
        submitMarkers.push({
          attribute: "identity_verification.country_of_residence",
          value: residenceCountry,
          attributeType: "STRING",
        });
      }
      await workflowSessionAttributesRepository
        .batchUpsert({
          workflowSessionId: data.sessionId,
          attributes: submitMarkers,
        })
        .catch((err) => {
          logger.warn({
            msg: "Failed to persist submit markers",
            sessionId: data.sessionId,
            error: err instanceof Error ? err.message : String(err),
          });
        });
      publishProviderChecksForSession(data.sessionId).catch((err) => {
        logger.error({
          msg: "Failed to publish provider check requests",
          sessionId: data.sessionId,
          error: err instanceof Error ? err.message : String(err),
        });
      });
      // In-house checks (duplicate detection, rules engine). Self-defers when
      // no name is present yet (manual flow runs them on Run checks instead).
      runInHouseChecks(data.sessionId).catch((err) => {
        logger.error({
          msg: "Failed to run in-house checks",
          sessionId: data.sessionId,
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }
    // A check failing on an already-approved customer (re-screen) demotes them.
    if (CHECK_STEP_TYPES.includes(data.step) && data.status === "FAILED") {
      await applyAdverseTransition(data.sessionId).catch(() => undefined);
    }
    return row;
  };

  const writeAttributes = async (data: {
    workflowSessionId: string;
    attributes: AttributeUpsert[];
  }) => {
    return workflowSessionAttributesRepository.batchUpsert(data);
  };

  // Manual identity data entry from the KYC review page. The officer types
  // what they read off the ID; we write the canonical identity_verification.*
  // attributes — the exact same keys iDenfy's webhook writes — so downstream
  // checks (AML, dup, rules) can't tell whether a human or a provider filled
  // them. Field types come from the schema, never trusted from the client;
  // unknown keys are ignored.
  const saveIdentityData = async (data: {
    workflowSessionId: string;
    fields: Record<string, string>;
  }) => {
    const upserts: AttributeUpsert[] = [];
    let firstName: string | undefined;
    let lastName: string | undefined;
    for (const def of IDENTITY_VERIFICATION_FIELDS) {
      const value = data.fields[def.key];
      if (value === undefined || value.trim() === "") continue;
      upserts.push({
        attribute: def.attribute,
        value: value.trim(),
        attributeType: def.type,
      });
      if (def.key === "document_first_name") firstName = value.trim();
      if (def.key === "document_last_name") lastName = value.trim();
    }
    // Derive full_name to mirror iDenfy's shape, so AML/dup read one key
    // regardless of source.
    if (firstName || lastName) {
      upserts.push({
        attribute: IDENTITY_DERIVED_KEYS.fullName,
        value: [firstName, lastName].filter(Boolean).join(" "),
        attributeType: "STRING",
      });
    }
    if (upserts.length === 0) return { written: 0 };
    await workflowSessionAttributesRepository.batchUpsert({
      workflowSessionId: data.workflowSessionId,
      attributes: upserts,
    });
    logger.info({
      msg: "Saved manual identity data",
      sessionId: data.workflowSessionId,
      fields: upserts.length,
    });
    return { written: upserts.length };
  };

  // "Run checks" trigger from the review page. Re-fans-out the workflow's
  // provider checks; now that a name exists (manual entry or iDenfy) AML is
  // included instead of deferred. Fire-and-forget — results stream back via
  // the check-completed consumer and land as attributes + step statuses the
  // dashboard polls for.
  const runChecks = async (sessionId: string) => {
    // Officer-driven re-screen from the review page (used during onboarding, and
    // the future on-demand AML/fraud re-screen from the customer detail page).
    // Restrict to the session's FROZEN expected checks so a check added to the
    // workflow after submission can't run for an in-flight session — keeping the
    // review lane a true snapshot. Old sessions (no frozen attr) fall back to the
    // live config; a frozen-empty set ("") correctly runs nothing.
    const attrs =
      await workflowSessionAttributesRepository.findBySessionId(sessionId);
    const expectedAttr = attrs.find(
      (a) => a.attribute === "_session.expected_checks",
    );
    const allowed = expectedAttr
      ? new Set(expectedAttr.value.split(",").filter(Boolean))
      : undefined;
    await publishProviderChecksForSession(sessionId, allowed);
    await runInHouseChecks(sessionId, allowed);
    return { triggered: true };
  };

  // Bounce a session back to the customer to redo specific steps. Records
  // resubmission markers (the widget reads these on resume to force-redo the
  // listed steps), flips identity-verification back to IN_PROGRESS so the
  // queue shows it's with the customer, and best-effort sends a branded
  // resubmission email if we have a contact address.
  const requestResubmission = async (data: {
    workflowSessionId: string;
    steps: string[];
    note?: string | null;
    reasonCodes?: string[];
    reviewedBy: string;
  }) => {
    const session = await workflowSessionsRepository.findById(
      data.workflowSessionId,
    );
    if (!session) return null;

    const reasonCodes = (data.reasonCodes ?? []).filter(Boolean);
    // Localize the reason labels to the language the customer used in the widget
    // (custom note stays as the officer typed it).
    const sessionAttrs =
      await workflowSessionAttributesRepository.findBySessionId(
        data.workflowSessionId,
      );
    const locale =
      sessionAttrs.find((a) => a.attribute === "_session.locale")?.value ??
      undefined;

    const markers: AttributeUpsert[] = [
      {
        attribute: "_session.resubmission_requested",
        value: "true",
        attributeType: "BOOLEAN",
      },
      {
        attribute: "_session.resubmission_steps",
        value: data.steps.join(","),
        attributeType: "STRING",
      },
      {
        attribute: "_session.resubmission_requested_by",
        value: data.reviewedBy,
        attributeType: "STRING",
      },
      {
        attribute: "_session.resubmission_requested_at",
        value: new Date().toISOString(),
        attributeType: "DATE",
      },
    ];
    // Composed human-readable message (reason labels + free note). Stored so the
    // WIDGET can show the customer WHY on reopen without depending on the reason
    // catalog, and reused verbatim for the resubmission email.
    const note = data.note?.trim() ?? "";
    const reasonText = reasonCodes
      .map((c) => kycReasonLabel(c, locale))
      .join(", ");
    const composedMessage = [reasonText, note].filter(Boolean).join(" — ");
    // Always (re)write note / reasons / message — even when empty — so a REPEAT
    // resubmission request fully replaces the previous one. Pushing them only
    // when present would leave stale values from an earlier request, and the
    // widget would show the customer the wrong reason on reopen.
    markers.push(
      {
        attribute: "_session.resubmission_note",
        value: note,
        attributeType: "STRING",
      },
      {
        attribute: "_session.resubmission_reasons",
        value: reasonCodes.join(","),
        attributeType: "STRING",
      },
      {
        attribute: "_session.resubmission_message",
        value: composedMessage,
        attributeType: "STRING",
      },
    );
    await workflowSessionAttributesRepository.batchUpsert({
      workflowSessionId: data.workflowSessionId,
      attributes: markers,
    });

    await workflowSessionStepsRepository.upsert({
      sessionId: data.workflowSessionId,
      step: "identity-verification",
      status: "IN_PROGRESS",
      message: "Resubmission requested by reviewer",
    });

    // Reset the bounced steps to a clean slate: wipe their captured data and
    // delete any reviewer verdict (id-scan / face-scan step row), so the
    // customer's resubmission is reviewed fresh rather than inheriting the first
    // attempt's data + Approve/Reject.
    const attributesToClear = data.steps.flatMap(
      (s) => RESUBMISSION_CLEAR_ATTRIBUTES[s] ?? [],
    );
    // Snapshot the OUTGOING attempt's data (taken from sessionAttrs, read before
    // any clearing) into the audit event — preserves the baseline so the next
    // attempt can be compared against it (identity-swap fraud guard). Image S3
    // objects survive because uploads use timestamped keys, so the snapshotted
    // keys still resolve.
    const snapshot: Record<string, string> = {};
    for (const a of sessionAttrs) {
      if (attributesToClear.includes(a.attribute) && a.value?.trim()) {
        snapshot[a.attribute] = a.value;
      }
    }
    if (attributesToClear.length > 0) {
      await workflowSessionAttributesRepository.deleteByAttributes({
        workflowSessionId: data.workflowSessionId,
        attributes: attributesToClear,
      });
    }
    const verdictStepsToReset = data.steps.filter((s) =>
      HUMAN_REVIEW_DOC_STEPS.includes(s),
    );
    if (verdictStepsToReset.length > 0) {
      await workflowSessionStepsRepository.deleteBySessionAndSteps(
        data.workflowSessionId,
        verdictStepsToReset,
      );
    }

    // Append-only audit event — captures THIS round (the markers above are
    // last-wins, so only the event table preserves every resubmission round).
    await workflowSessionsRepository.insertEvent({
      workflowSessionId: data.workflowSessionId,
      type: "resubmission_requested",
      createdBy: data.reviewedBy,
      detail: {
        steps: data.steps,
        reasonCodes,
        note: note || null,
        snapshot: Object.keys(snapshot).length > 0 ? snapshot : undefined,
      },
    });

    const notified = await _notifyCustomerToResume(
      data.workflowSessionId,
      composedMessage || null,
    );

    logger.info({
      msg: "Resubmission requested",
      sessionId: data.workflowSessionId,
      steps: data.steps,
      notified,
    });
    return session;
  };

  // Best-effort branded "reopen the widget" email — verified email first, then
  // the notification email captured on the widget end screen. Shared by
  // resubmission and re-verification. Returns whether an email was sent.
  // Shared resolution for any customer-facing email: contact address, branding,
  // brand logo bytes, locale, and the resume deep link (carrying &lang). Returns
  // null when there's no address to reach the customer.
  const _resolveNotifyContext = async (sessionId: string) => {
    const session = await workflowSessionsRepository.findById(sessionId);
    if (!session) return null;
    const workflow = await workflowsRepository.findByIdIncludingDeleted(
      session.workflowId,
    );
    if (!workflow) return null;
    const attributes =
      await workflowSessionAttributesRepository.findBySessionId(sessionId);
    const find = (k: string) =>
      attributes.find((a) => a.attribute === k)?.value;
    const contactEmail =
      find("email_verification.email") ??
      find("_session.notification_email") ??
      null;
    if (!contactEmail) return null;
    const branding = workflow.branding ?? {};
    const brandName =
      branding.brandName?.trim() && branding.brandName.trim().length > 0
        ? branding.brandName.trim()
        : "UserCore Verification";
    const primaryColor = branding.primaryColor ?? "#C0E1D2";
    const senderEmail =
      branding.senderEmail && branding.senderEmail.trim().length > 0
        ? branding.senderEmail.trim()
        : null;
    const locale = find("_session.locale") ?? null;
    const lastSeenRaw = find("_session.last_seen_at");
    const lastSeenAt = lastSeenRaw ? new Date(lastSeenRaw).getTime() : null;
    // Brand logo, embedded as a CID attachment. Best-effort: skip if MinIO is
    // down or the key is stale.
    let logo: { body: Buffer; contentType: string } | null = null;
    if (branding.logoS3Key) {
      try {
        const obj = await storageService.getObject(branding.logoS3Key);
        if (obj) {
          logo = { body: Buffer.from(obj.body), contentType: obj.contentType };
        }
      } catch (err) {
        logger.warn({
          msg: "Failed to fetch brand logo for email",
          sessionId,
          err: err instanceof Error ? err.message : String(err),
        });
      }
    }
    const resumeUrl = `${env.WIDGET_URL}/?session=${encodeURIComponent(
      sessionId,
    )}&workflowsApi=${encodeURIComponent(env.WORKFLOWS_PUBLIC_URL)}${
      locale ? `&lang=${encodeURIComponent(locale)}` : ""
    }`;
    return {
      contactEmail,
      brandName,
      primaryColor,
      senderEmail,
      locale,
      logo,
      resumeUrl,
      lastSeenAt,
    };
  };

  // True when the widget's heartbeat says the customer is watching the end
  // screen right now — in which case we don't email (the live update covers it).
  const _widgetIsOpen = (lastSeenAt: number | null): boolean =>
    lastSeenAt !== null && Date.now() - lastSeenAt < WIDGET_PRESENCE_WINDOW_MS;

  const _notifyCustomerToResume = async (
    sessionId: string,
    note: string | null,
  ): Promise<boolean> => {
    const ctx = await _resolveNotifyContext(sessionId);
    if (!ctx) return false;
    // Don't email if they're watching the widget — the poll re-routes them live.
    if (_widgetIsOpen(ctx.lastSeenAt)) return false;
    await mailer
      .sendResubmissionRequest({
        to: ctx.contactEmail,
        brandName: ctx.brandName,
        primaryColor: ctx.primaryColor,
        logo: ctx.logo,
        senderEmail: ctx.senderEmail,
        locale: ctx.locale,
        note,
        resumeUrl: ctx.resumeUrl,
      })
      .catch((err) => {
        logger.warn({
          msg: "Resume email failed — customer can still reopen the link",
          sessionId,
          error: err instanceof Error ? err.message : String(err),
        });
      });
    return true;
  };

  // Final decision (approved/rejected) notice — so a customer who closed the
  // widget still learns the outcome. Resubmission has its own email.
  const _notifyCustomerOfDecision = async (
    sessionId: string,
    decision: "approved" | "rejected",
  ): Promise<boolean> => {
    const ctx = await _resolveNotifyContext(sessionId);
    if (!ctx) return false;
    // Don't email if they're watching the widget — the live screen shows it.
    if (_widgetIsOpen(ctx.lastSeenAt)) return false;
    await mailer
      .sendDecisionNotice({
        to: ctx.contactEmail,
        brandName: ctx.brandName,
        primaryColor: ctx.primaryColor,
        logo: ctx.logo,
        senderEmail: ctx.senderEmail,
        locale: ctx.locale,
        decision,
        resumeUrl: ctx.resumeUrl,
      })
      .catch((err) => {
        logger.warn({
          msg: "Decision email failed",
          sessionId,
          error: err instanceof Error ? err.message : String(err),
        });
      });
    return true;
  };

  // Re-verification: an APPROVED customer must satisfy the workflow's current
  // requirements without losing approved status. This covers customer-action
  // IDENTITY steps only — server checks are a frozen onboarding snapshot and are
  // NOT re-run here (AML/fraud are re-screened on demand from the customer detail
  // page; duplicate/rules are frozen once they ran). Missing steps are flagged
  // via `_session.reverification_*` markers the widget reads on resume. IV is
  // NEVER touched here — only applyAdverseTransition demotes, on a failed re-check.
  const requestReverification = async (data: {
    workflowSessionId: string;
    reviewedBy: string;
  }) => {
    const session = await workflowSessionsRepository.findById(
      data.workflowSessionId,
    );
    if (!session) return null;
    const [stepRows, attributes] = await Promise.all([
      workflowSessionStepsRepository.findBySessionId(data.workflowSessionId),
      workflowSessionAttributesRepository.findBySessionId(
        data.workflowSessionId,
      ),
    ]);
    const { steps, checks } = await computeOutstanding(
      session.workflowId,
      attributes,
      stepRows,
    );
    // Server checks are a frozen snapshot — re-verification does NOT re-run them.

    let notified = false;
    if (steps.length > 0) {
      // Separate markers from resubmission so the review queue keeps the
      // customer as "approved" (not "resubmission") while they re-verify.
      await workflowSessionAttributesRepository.batchUpsert({
        workflowSessionId: data.workflowSessionId,
        attributes: [
          {
            attribute: "_session.reverification_requested",
            value: "true",
            attributeType: "BOOLEAN",
          },
          {
            attribute: "_session.reverification_steps",
            value: steps.join(","),
            attributeType: "STRING",
          },
          {
            attribute: "_session.reverification_requested_by",
            value: data.reviewedBy,
            attributeType: "STRING",
          },
          {
            attribute: "_session.reverification_requested_at",
            value: new Date().toISOString(),
            attributeType: "DATE",
          },
        ],
      });
      notified = await _notifyCustomerToResume(data.workflowSessionId, null);
      // Append-only audit event for the timeline.
      await workflowSessionsRepository.insertEvent({
        workflowSessionId: data.workflowSessionId,
        type: "reverification_requested",
        createdBy: data.reviewedBy,
        detail: { steps },
      });
    }

    logger.info({
      msg: "Re-verification requested",
      sessionId: data.workflowSessionId,
      steps,
      checks,
      notified,
    });
    return { steps, checks, notified };
  };

  // Customer finished the re-verification steps in the widget. Clear the marker;
  // server checks are NOT re-run (frozen snapshot). A re-collected document that
  // needs a human verdict pulls the session back into review; otherwise the
  // customer simply stays approved.
  const completeReverification = async (sessionId: string) => {
    const attributes =
      await workflowSessionAttributesRepository.findBySessionId(sessionId);
    const reCollected = (
      attributes.find((a) => a.attribute === "_session.reverification_steps")
        ?.value ?? ""
    )
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    await workflowSessionAttributesRepository.batchUpsert({
      workflowSessionId: sessionId,
      attributes: [
        {
          attribute: "_session.reverification_requested",
          value: "false",
          attributeType: "BOOLEAN",
        },
      ],
    });

    // A re-collected document needs a fresh HUMAN verdict, which pulls the
    // session back into review. Which docs need a human depends on the doc:
    //  • proof-of-residence is always widget-native — no provider ever verdicts
    //    it, so it always needs review (even on the iDenfy path).
    //  • id-scan / face-scan are verdicted by the provider on the iDenfy path
    //    (the webhook sets it: approved→stays approved / denied→failed), so they
    //    only need a human verdict on the MANUAL path (no provider).
    // Every OTHER (already-completed) document keeps its persisted verdict, so
    // the officer only re-checks what was re-collected.
    const reCollectedDocs = reCollected.filter((s) =>
      HUMAN_REVIEW_DOC_STEPS.includes(s),
    );
    if (reCollectedDocs.length > 0) {
      const session = await workflowSessionsRepository.findById(sessionId);
      const ivWorkflowStep = session
        ? await workflowStepsRepository.findByWorkflowAndType(
            session.workflowId,
            "identity-verification",
          )
        : null;
      const providerVerdicts = !!ivWorkflowStep?.provider;
      const needsHuman = reCollectedDocs.filter(
        (d) => d === "proof-of-residence" || !providerVerdicts,
      );
      if (needsHuman.length > 0) {
        // Reset the per-document verdicts that have a verdict UI (id/face scan)
        // so the officer re-clears exactly what was re-collected.
        for (const doc of needsHuman) {
          if (doc === "id-scan" || doc === "face-scan") {
            await workflowSessionStepsRepository.upsert({
              sessionId,
              step: doc,
              status: "REQUIRES_REVIEW",
              message: "Re-collected — awaiting reviewer verdict",
            });
          }
        }
        // Direct upsert (not recordStepStatus) so we don't re-fire provider
        // checks off a REQUIRES_REVIEW transition — they already ran above.
        await workflowSessionStepsRepository.upsert({
          sessionId,
          step: "identity-verification",
          status: "REQUIRES_REVIEW",
          message: "Re-verification: new document(s) need review",
        });
      }
    }
    return { completed: true };
  };

  // The ONLY thing that moves an approved customer: a re-run check that fails.
  // If identity-verification is SUCCEEDED (approved) and any server check is
  // FAILED, demote to REQUIRES_REVIEW and record why. Idempotent.
  const applyAdverseTransition = async (sessionId: string) => {
    const steps =
      await workflowSessionStepsRepository.findBySessionId(sessionId);
    const iv = steps.find((s) => s.step === "identity-verification");
    if (iv?.status !== "SUCCEEDED") return;
    // A re-screen is "adverse" when a server check FAILED (AML hit, fraud,
    // matched scenario) OR duplicate detection found a match — duplicates land
    // on REQUIRES_REVIEW, never FAILED, so they need their own clause.
    const adverse = steps
      .filter(
        (s) =>
          (CHECK_STEP_TYPES.includes(s.step) && s.status === "FAILED") ||
          (s.step === "duplicate-detection" && s.status === "REQUIRES_REVIEW"),
      )
      .map((s) => s.step);
    if (adverse.length === 0) return;
    await workflowSessionStepsRepository.upsert({
      sessionId,
      step: "identity-verification",
      status: "REQUIRES_REVIEW",
      message: `Re-check flagged: ${adverse.join(", ")}`,
    });
    await workflowSessionAttributesRepository.batchUpsert({
      workflowSessionId: sessionId,
      attributes: [
        {
          attribute: "_session.reverification_failed",
          value: adverse.join(","),
          attributeType: "STRING",
        },
      ],
    });
    logger.info({
      msg: "Approved customer demoted — adverse re-check",
      sessionId,
      adverse,
    });
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
    reasonCodes?: string[];
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
    // Predefined reason codes (reject) → store for audit + fold their labels
    // into the reason text that rides on kyc.completed and the step message.
    const reasonCodes = (data.reasonCodes ?? []).filter(Boolean);
    const reasonText = reasonCodes
      .map((code) => kycReasonLabel(code))
      .join(", ");
    const fullReason =
      [reasonText, data.reason?.trim()].filter(Boolean).join(" — ") ||
      undefined;
    if (reasonCodes.length > 0) {
      await workflowSessionAttributesRepository.batchUpsert({
        workflowSessionId: session.id,
        attributes: [
          {
            attribute: "_session.reject_reasons",
            value: reasonCodes.join(","),
            attributeType: "STRING",
          },
        ],
      });
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

    const reviewedAt = new Date().toISOString();
    // Append-only audit event so the dashboard timeline can show
    // "approved/rejected by X at T" (with reasons) for every decision round —
    // re-verification can demote an approved customer and lead to a 2nd decision.
    await workflowSessionsRepository.insertEvent({
      workflowSessionId: session.id,
      type: "decision",
      createdBy: data.reviewedBy,
      detail: {
        decision: data.decision,
        reasonCodes,
        reason: fullReason ?? null,
      },
    });

    const payload: KycCompletedPayload = {
      workflowSessionId: session.id,
      customerId: session.customerId,
      workspaceId: workflow.workspaceId,
      status: DECISION_TO_KYC_STATUS[data.decision],
      reviewedAt,
      reviewedBy: data.reviewedBy,
      reason: fullReason,
    };
    // Reflect the decision on the identity-verification step so a customer
    // reopening the link sees the outcome. Direct upsert (not recordStepStatus)
    // to avoid re-firing provider checks on a "flagged" REQUIRES_REVIEW.
    await workflowSessionStepsRepository.upsert({
      sessionId: session.id,
      step: "identity-verification",
      status: DECISION_TO_STEP_STATUS[data.decision],
      message: fullReason ?? `Reviewer decision: ${data.decision}`,
    });

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
    // Email the customer the outcome (best-effort) so they learn it even if they
    // closed the widget. "flagged" stays in review, so no terminal notice.
    if (data.decision === "approved" || data.decision === "rejected") {
      void _notifyCustomerOfDecision(session.id, data.decision);
    }
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
    const head = await storageService.headFile(attr.value);
    return {
      url,
      key: attr.value,
      contentType: head.contentType,
      size: head.size,
      // The upload epoch is encoded in the key suffix (`<kind>-<epochMs>`).
      uploadedAt: epochIsoFromKey(attr.value),
    };
  };

  // Signed URL for an arbitrary session-scoped object key — used to render a
  // PREVIOUS attempt's images (snapshotted in a resubmission event) for the
  // fraud comparison. Guarded: the key MUST live under this session's prefix so
  // a caller can't sign another session's (or any other) object.
  const getSessionFileUrlByKey = async (data: {
    workflowSessionId: string;
    key: string;
  }) => {
    const prefix = `sessions/${data.workflowSessionId}/`;
    if (!data.key.startsWith(prefix)) return null;
    const url = await storageService.getSignedDownloadUrl(data.key);
    const head = await storageService.headFile(data.key);
    return {
      url,
      key: data.key,
      contentType: head.contentType,
      size: head.size,
      uploadedAt: epochIsoFromKey(data.key),
    };
  };

  // Soft-delete (archive) a submission and its inverse. KYC records are never
  // hard-deleted — retention + audit require keeping the row; this only hides it
  // from the queue, preserving who archived it and why.
  const archiveSession = async (data: {
    workflowSessionId: string;
    reviewedBy: string;
    reason: string;
  }) => {
    await workflowSessionsRepository.softDelete({
      id: data.workflowSessionId,
      deletedBy: data.reviewedBy,
      reason: data.reason,
    });
    await workflowSessionsRepository.insertEvent({
      workflowSessionId: data.workflowSessionId,
      type: "archived",
      createdBy: data.reviewedBy,
      detail: { reason: data.reason },
    });
    logger.info({
      msg: "Session archived",
      sessionId: data.workflowSessionId,
      by: data.reviewedBy,
    });
    return { archived: true };
  };

  const restoreSession = async (sessionId: string) => {
    await workflowSessionsRepository.restore(sessionId);
    logger.info({ msg: "Session restored", sessionId });
    return { restored: true };
  };

  return {
    createSession,
    getSession,
    getSessionFileUrlByKey,
    listForReviewQueue,
    listReviewQueuePaginated,
    archiveSession,
    restoreSession,
    recordStepStatus,
    writeAttributes,
    saveIdentityData,
    runChecks,
    requestResubmission,
    requestReverification,
    completeReverification,
    uploadSessionFile,
    getSessionFileUrl,
    finalizeSession,
    getMonthlyVerificationStats,
  };
};

export type WorkflowSessionsService = ReturnType<
  typeof createWorkflowSessionsService
>;
