import { useEffect, useRef, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import {
  AlertTriangle,
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Check,
  ChevronDown,
  Clock,
  FileText,
  FlaskConical,
  IdCard,
  ListChecks,
  Loader2,
  Mail,
  Phone,
  Play,
  Radio,
  RotateCcw,
  ScanFace,
  ShieldCheck,
  X,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";

import {
  ID_DOCUMENT_TYPES,
  IDENTITY_VERIFICATION_FIELDS,
  identityAttributeKey,
  KYC_REASONS,
  kycReasonLabel,
  REQUIRED_IDENTITY_FIELD_KEYS,
} from "@usercore/shared-types";

import { ChecksPanel } from "../components/ChecksPanel";
import { Modal } from "../components/Modal";
import { Select, type SelectOption } from "../components/ui/Select";
import { COUNTRIES } from "../lib/countries";
import { formatDate, formatDateTime } from "../lib/dates";
import { useMembers } from "../lib/hooks/useMembers";
import {
  useFinalizeSession,
  useRecordStep,
  useRequestResubmission,
  useRequestReverification,
  useRestoreSession,
  useRunChecks,
  useSaveIdentityData,
  useSessionFileUrl,
  useSessionFileUrlByKey,
  useWorkflowSession,
  type ReviewDecision,
  type ReviewQueueStatus,
  type SessionFileMeta,
  type WorkflowSessionEvent,
  type WorkflowSessionStep,
} from "../lib/hooks/useWorkflowSessions";
import { useWorkspace } from "../lib/workspaceContext";

// Sub-steps a reviewer can ask the customer to redo, with friendly labels and
// the same icons used across the workflow / checks.
const RESUBMITTABLE_STEPS: Array<{
  type: string;
  label: string;
  icon: ComponentType<{ size?: number; className?: string }>;
}> = [
  { type: "id-scan", label: "Identity document", icon: IdCard },
  { type: "face-scan", label: "Face scan / selfie", icon: ScanFace },
  { type: "proof-of-residence", label: "Proof of residence", icon: FileText },
  { type: "contact-information", label: "Contact information", icon: Phone },
  { type: "email-verification", label: "Email verification", icon: Mail },
];

// Friendly label for a sub-step type (used by the re-verification banner).
const stepLabel = (type: string): string =>
  RESUBMITTABLE_STEPS.find((s) => s.type === type)?.label ??
  type.charAt(0).toUpperCase() + type.slice(1).replace(/[-_]/g, " ");

const PROVIDER_CHECK_LABELS: Record<string, string> = {
  "aml-screening": "AML screening",
  "fraud-detection": "Fraud detection",
  "duplicate-detection": "Duplicate detection",
  "rules-engine": "Rules engine",
};
const PROVIDER_CHECK_ORDER = [
  "aml-screening",
  "fraud-detection",
  "duplicate-detection",
  "rules-engine",
];

type StepStatus = WorkflowSessionStep["status"];
type Tone = "good" | "warn" | "bad" | "neutral";

const Section = ({
  title,
  icon,
  action,
  children,
  defaultCollapsed = false,
}: {
  title: string;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  defaultCollapsed?: boolean;
}) => {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  return (
    <section className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-center justify-between gap-4">
        {/* Title area toggles collapse; the action (e.g. verdict buttons) stays
            independently clickable on the right. */}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="flex min-w-0 items-center gap-2"
        >
          <ChevronDown
            size={16}
            className={`shrink-0 text-gray-400 transition-transform ${
              collapsed ? "-rotate-90" : ""
            }`}
          />
          {icon && (
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
              {icon}
            </span>
          )}
          <h3 className="truncate text-sm font-semibold text-gray-900">
            {title}
          </h3>
        </button>
        {action}
      </div>
      {!collapsed && <div className="mt-4">{children}</div>}
    </section>
  );
};

// One event on the activity timeline. `at` is an ISO timestamp; entries are
// sorted oldest-first by the caller.
type TimelineTone = "neutral" | "info" | "good" | "bad" | "warn";
type TimelineEntry = {
  at: string;
  icon: ReactNode;
  tone: TimelineTone;
  title: string;
  actor?: string | null;
  detail?: ReactNode;
};

const TIMELINE_DOT: Record<TimelineTone, string> = {
  neutral: "bg-gray-100 text-gray-500",
  info: "bg-blue-100 text-blue-600",
  good: "bg-primary-100 text-primary-700",
  bad: "bg-red-100 text-red-600",
  warn: "bg-orange-100 text-orange-600",
};

// Vertical audit trail: a connector line threads the dots, each row carries a
// title, timestamp, optional actor, and optional detail (reasons / steps / note).
const ActivityTimeline = ({ entries }: { entries: TimelineEntry[] }) => (
  <ol className="relative -mt-1">
    {entries.map((e, i) => (
      <li key={`${e.at}-${i}`} className="relative flex gap-3 pb-5 last:pb-0">
        {i < entries.length - 1 && (
          <span className="absolute left-[13px] top-7 bottom-0 w-px bg-gray-200" />
        )}
        <span
          className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${TIMELINE_DOT[e.tone]}`}
        >
          {e.icon}
        </span>
        <div className="min-w-0 pt-0.5">
          <div className="text-sm font-medium text-gray-900">{e.title}</div>
          <div className="text-xs text-gray-400">
            {formatDateTime(e.at)}
            {e.actor && (
              <>
                {" · by "}
                <span className="text-gray-500">{e.actor}</span>
              </>
            )}
          </div>
          {e.detail && (
            <div className="mt-1 space-y-0.5 text-xs text-gray-600">
              {e.detail}
            </div>
          )}
        </div>
      </li>
    ))}
  </ol>
);

// Caution + version switcher shown at the top of a scan block that has more
// than one submission (the customer was bounced and resubmitted). No automatic
// identity detection — the officer picks a version (a past one renders in the
// same layout, read-only) and compares for themselves.
const VersionSwitcher = ({
  versions,
  selected,
  onSelect,
  noun,
}: {
  versions: Array<{ label: string }>;
  selected: number;
  onSelect: (index: number) => void;
  noun: string;
}) => (
  <div className="mb-4 flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 sm:flex-row sm:items-center sm:justify-between">
    <div className="flex items-start gap-2 text-amber-800">
      <AlertTriangle size={14} className="mt-0.5 shrink-0" />
      <div>
        <div className="text-sm font-medium">
          Submitted {versions.length} times
        </div>
        <div className="text-xs text-amber-700">
          Switch versions and confirm it&apos;s the same person — a resubmission
          can be used to swap in a different {noun}.
        </div>
      </div>
    </div>
    <div className="w-full shrink-0 sm:w-52">
      <Select
        value={String(selected)}
        onChange={(v) => onSelect(Number(v))}
        options={versions.map((v, i) => ({ value: String(i), label: v.label }))}
        size="md"
      />
    </div>
  </div>
);

// Identity form dropdown option sets. iDenfy returns sex as M/F (empty if not
// read); X covers ICAO "unspecified" + the manual "not clearly M/F" case.
const SEX_OPTIONS = [
  { value: "M", label: "Male (M)" },
  { value: "F", label: "Female (F)" },
  { value: "X", label: "Other / unspecified (X)" },
];
const DOC_TYPE_LABELS: Record<string, string> = {
  PASSPORT: "Passport",
  ID_CARD: "ID card",
  DRIVER_LICENSE: "Driver license",
};
const DOC_TYPE_OPTIONS = ID_DOCUMENT_TYPES.map((t) => ({
  value: t,
  label: DOC_TYPE_LABELS[t] ?? t,
}));
const COUNTRY_OPTIONS: SelectOption[] = COUNTRIES.map((c) => ({
  value: c.code,
  label: c.name,
  icon: (
    <span
      className={`fi fi-${c.code.toLowerCase()} inline-block h-3 w-4 rounded-sm shadow-[0_0_0_1px_rgba(0,0,0,0.04)]`}
    />
  ),
}));

// Wraps the app's styled Select (searchable for long lists, keyboard-nav). Keeps
// a provider value that's outside our option set (e.g. iDenfy's RESIDENCE_PERMIT
// or an ISO-3 country) visible by appending it, so real data is never dropped.
const IdentitySelect = ({
  value,
  onChange,
  options,
  disabled = false,
}: {
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  disabled?: boolean;
}) => {
  const known = value === "" || options.some((o) => o.value === value);
  const opts = known ? options : [{ value, label: value }, ...options];
  return (
    <Select
      value={value}
      onChange={onChange}
      options={opts}
      size="md"
      placeholder="Select…"
      disabled={disabled}
    />
  );
};

// Predefined reason chips (iDenfy-compatible codes), grouped by area. Shown in
// the Reject modal (severity "reject") and Resubmission modal (severity
// "resubmit"); the "other" catch-all appears in both.
// Predefined justifications shown when an officer approves over a failed risk
// check (AML / fraud / rules). Quick, consistent audit reasons + a free note.
const APPROVE_OVERRIDE_REASONS = [
  { code: "FALSE_POSITIVE", label: "False positive" },
  { code: "VERIFIED_OUT_OF_BAND", label: "Verified out-of-band" },
  { code: "LOW_RISK_ACCEPTABLE", label: "Low risk — acceptable" },
  { code: "REVIEWED_NO_CONCERN", label: "Reviewed — no concern" },
] as const;

const REASON_AREA_ORDER = ["document", "face", "fraud", "other"] as const;
const REASON_AREA_LABELS: Record<string, string> = {
  document: "Document",
  face: "Face",
  fraud: "Fraud / AML",
  other: "Other",
};
// Which reason areas each resubmittable step maps to — so the resubmission
// reasons can be limited to the steps actually being bounced ("Other" always
// shows). POR reuses the document-quality reasons (blurry/glare/etc.).
const STEP_REASON_AREAS: Record<string, string[]> = {
  "id-scan": ["document"],
  "face-scan": ["face"],
  "proof-of-residence": ["document"],
  "contact-information": [],
  "email-verification": [],
};
const ReasonChips = ({
  severity,
  selected,
  onToggle,
  areas,
}: {
  severity: "resubmit" | "reject";
  selected: Set<string>;
  onToggle: (code: string) => void;
  // When provided, only these reason areas are shown (e.g. limit resubmission
  // reasons to the steps being bounced). Undefined = show all areas.
  areas?: string[];
}) => {
  const reasons = KYC_REASONS.filter(
    (r) => r.severity === severity || r.area === "other",
  );
  const visibleAreas = areas
    ? REASON_AREA_ORDER.filter((a) => areas.includes(a))
    : REASON_AREA_ORDER;
  return (
    <div className="space-y-3">
      {visibleAreas.map((area) => {
        const items = reasons.filter((r) => r.area === area);
        if (items.length === 0) return null;
        return (
          <div key={area}>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              {REASON_AREA_LABELS[area]}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {items.map((r) => {
                const active = selected.has(r.code);
                return (
                  <button
                    key={r.code}
                    type="button"
                    onClick={() => onToggle(r.code)}
                    className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                      active
                        ? "border-primary-300 bg-primary-100 text-primary-800"
                        : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const KycReviewDetailPage = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { user, organization } = useWorkspace();
  const navigate = useNavigate();

  // Member directory — resolves the actor ids stored on audit events
  // (createdBy = the acting member's user id) to readable emails. Cached and
  // shared across the dashboard via React Query. Falls back to the raw id while
  // loading or for an actor no longer in the org.
  const membersQuery = useMembers(organization.id, { page: 1, limit: 100 });
  const memberEmailById = new Map<string, string>();
  for (const m of membersQuery.data?.items ?? []) {
    if (m.userId) memberEmailById.set(m.userId, m.userEmail);
    if (m.memberId) memberEmailById.set(m.memberId, m.userEmail);
  }
  const resolveActor = (id: string | null | undefined): string | null =>
    id ? (memberEmailById.get(id) ?? id) : null;

  const detail = useWorkflowSession(sessionId ?? null);
  const documentFront = useSessionFileUrl(sessionId ?? null, "document_front");
  const documentBack = useSessionFileUrl(sessionId ?? null, "document_back");
  const faceVideo = useSessionFileUrl(sessionId ?? null, "face_video");
  const proofOfResidence = useSessionFileUrl(
    sessionId ?? null,
    "proof_of_residence",
  );

  const finalize = useFinalizeSession();
  const saveIdentity = useSaveIdentityData();
  const runChecks = useRunChecks();
  const recordStep = useRecordStep();
  const requestResubmission = useRequestResubmission();
  const requestReverification = useRequestReverification();
  const restoreSession = useRestoreSession();

  const [reason, setReason] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [resubmitOpen, setResubmitOpen] = useState(false);
  const [resubmitSteps, setResubmitSteps] = useState<Record<string, boolean>>(
    {},
  );
  const [resubmitNote, setResubmitNote] = useState("");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReasons, setRejectReasons] = useState<Set<string>>(new Set());
  const [resubmitReasons, setResubmitReasons] = useState<Set<string>>(
    new Set(),
  );
  // Approve-over-a-flag (override) justification — required when approving while
  // a risk check (AML / fraud / rules) is failed, for the compliance audit trail.
  const [approveOpen, setApproveOpen] = useState(false);
  const [approveReasons, setApproveReasons] = useState<Set<string>>(new Set());
  const [approveNote, setApproveNote] = useState("");
  // True once the officer has run checks for the data currently entered. Reset
  // when the data is edited so a stale pass can't be approved. Gates ID scan
  // approval: you must run checks before clearing the document.
  const [checksRun, setChecksRun] = useState(false);
  // Which version of each scan the officer is viewing (null = current/latest).
  const [selectedIdVersion, setSelectedIdVersion] = useState<number | null>(
    null,
  );
  const [selectedFaceVersion, setSelectedFaceVersion] = useState<number | null>(
    null,
  );
  const [selectedPorVersion, setSelectedPorVersion] = useState<number | null>(
    null,
  );

  // ── Scan versions (resubmission history) ────────────────────────────────────
  // Each resubmission snapshots the OUTGOING attempt into its event, so a step
  // bounced N times has N past versions + the current one. The officer flips
  // between them in each block and compares for themselves — no auto-detection.
  // The version selector + read-only past view live inside the ID/Face blocks.
  const snapshotsWithAny = (keys: string[]): Array<Record<string, string>> => {
    const evs = detail.data?.events ?? [];
    return evs
      .filter(
        (e) =>
          e.type === "resubmission_requested" &&
          e.detail?.snapshot &&
          keys.some((k) => k in e.detail!.snapshot!),
      )
      .map((e) => e.detail!.snapshot!);
  };
  const idScanSnapshots = snapshotsWithAny([
    "identity_verification.document_complete",
    "identity_verification.document_type",
    "identity_verification.document_front_s3_key",
  ]);
  const faceScanSnapshots = snapshotsWithAny([
    "identity_verification.liveness_passed",
    "identity_verification.face_video_s3_key",
  ]);
  const porSnapshots = snapshotsWithAny([
    "proof_of_residence.complete",
    "identity_verification.proof_of_residence_s3_key",
    "address.country",
  ]);
  // versions array = [...past snapshots, current]; default-select the current.
  const idSelectedIdx = selectedIdVersion ?? idScanSnapshots.length;
  const faceSelectedIdx = selectedFaceVersion ?? faceScanSnapshots.length;
  const porSelectedIdx = selectedPorVersion ?? porSnapshots.length;
  const idViewingPast = idSelectedIdx < idScanSnapshots.length;
  const faceViewingPast = faceSelectedIdx < faceScanSnapshots.length;
  const porViewingPast = porSelectedIdx < porSnapshots.length;
  const idPastSnapshot = idViewingPast ? idScanSnapshots[idSelectedIdx] : null;
  const facePastSnapshot = faceViewingPast
    ? faceScanSnapshots[faceSelectedIdx]
    : null;
  const porPastSnapshot = porViewingPast ? porSnapshots[porSelectedIdx] : null;
  // Signed URLs for the SELECTED past version's images (one slot each — only one
  // past version is shown at a time, so a single hook per slot suffices).
  const pastDocFront = useSessionFileUrlByKey(
    sessionId ?? null,
    idPastSnapshot?.["identity_verification.document_front_s3_key"],
  );
  const pastDocBack = useSessionFileUrlByKey(
    sessionId ?? null,
    idPastSnapshot?.["identity_verification.document_back_s3_key"],
  );
  const pastFace = useSessionFileUrlByKey(
    sessionId ?? null,
    facePastSnapshot?.["identity_verification.face_video_s3_key"],
  );
  const pastPor = useSessionFileUrlByKey(
    sessionId ?? null,
    porPastSnapshot?.["identity_verification.proof_of_residence_s3_key"],
  );

  const attributes = detail.data?.attributes;
  useEffect(() => {
    const seeded: Record<string, string> = {};
    for (const f of IDENTITY_VERIFICATION_FIELDS) {
      const found = attributes?.find((a) => a.attribute === f.attribute);
      if (found) seeded[f.key] = found.value;
    }
    // The widget's document-step "Country" is captured as document_country,
    // which has no form field of its own. Use it as an editable DEFAULT for
    // issuing country (exact match) and nationality (a convenience default the
    // officer confirms against the document) — only when those are still blank,
    // so iDenfy MRZ data or a manual edit is never overwritten.
    const docCountry = attributes?.find(
      (a) => a.attribute === "identity_verification.document_country",
    )?.value;
    if (docCountry) {
      if (!seeded["document_issuing_country"])
        seeded["document_issuing_country"] = docCountry;
      if (!seeded["document_nationality"])
        seeded["document_nationality"] = docCountry;
    }
    setFields(seeded);
  }, [attributes]);

  // Auto-approve the ID scan once the officer's Run checks come back clean —
  // every provider/in-house check settled and passed, and no verdict has been
  // set yet. Saves a click on the happy path; the officer can still toggle it
  // off. Fires once per page (ref) and never overrides a manual verdict.
  const sessionSteps = detail.data?.steps;
  const autoApprovedIdScan = useRef(false);
  useEffect(() => {
    if (!sessionId || !checksRun || autoApprovedIdScan.current || !sessionSteps)
      return;
    const map = new Map(sessionSteps.map((s) => [s.step, s.status]));
    if (map.get("id-scan")) return; // a verdict already exists — don't override
    const checks = PROVIDER_CHECK_ORDER.filter((t) => map.has(t));
    if (checks.length === 0) return;
    const settled = checks.every((t) => {
      const s = map.get(t);
      return s !== "PENDING" && s !== "IN_PROGRESS";
    });
    if (!settled) return;
    if (!checks.every((t) => map.get(t) === "SUCCEEDED")) return;
    autoApprovedIdScan.current = true;
    recordStep.mutate({ sessionId, step: "id-scan", status: "SUCCEEDED" });
  }, [sessionId, checksRun, sessionSteps, recordStep]);

  const backToQueue = () => navigate("/kyc-review");

  if (!sessionId) return null;

  if (detail.isPending) {
    return (
      <div className="p-8 max-w-6xl mx-auto">
        <BackLink />
        <div className="bg-white border border-gray-200 rounded-xl p-6 text-sm text-gray-500 mt-4">
          Loading session…
        </div>
      </div>
    );
  }

  // Resolved but no session — bad/stale id (e.g. a deleted session or an old
  // duplicate link without a session id). Show a real not-found state instead
  // of spinning on "Loading…" forever.
  if (!detail.data) {
    return (
      <div className="p-8 max-w-6xl mx-auto">
        <BackLink />
        <div className="bg-white border border-gray-200 rounded-xl p-6 text-sm text-gray-500 mt-4">
          Session not found. It may have been removed, or this link is stale —
          re-run checks to refresh duplicate links.
        </div>
      </div>
    );
  }

  const session = detail.data.session;
  // Steps a reviewer can bounce for RESUBMISSION = currently enabled in the
  // workflow (so the customer can redo it via today's widget) AND already
  // completed by the customer (so there's something to redo). outstanding.steps
  // = enabled-but-not-completed, so "enabled minus outstanding" = completed &
  // enabled. A step the customer never did (e.g. one ADDED to the workflow after
  // they submitted) is a re-verification concern, not a resubmission — it must
  // not appear here.
  const bounceableSteps = detail.data.enabledSteps.filter(
    (s) => !detail.data.outstanding.steps.includes(s),
  );

  // Flat lookup over every EAV attribute on the session.
  const attrMap = new Map<string, string>();
  for (const a of detail.data.attributes) attrMap.set(a.attribute, a.value);
  const iv = (suffix: string) =>
    attrMap.get(identityAttributeKey(suffix)) ?? "";

  // Rich check results stored as JSON attributes by the backend.
  const matchedCustomers = parseJsonAttr<DuplicateMatch[]>(
    attrMap.get("duplicate_detection.matched_customers"),
    [],
  );
  const ruleEvaluations = parseJsonAttr<RuleEvaluation[]>(
    attrMap.get("rules_engine.evaluations"),
    [],
  );

  const stepStatus = new Map<string, StepStatus>();
  for (const s of detail.data.steps) stepStatus.set(s.step, s.status);
  const overallStatus = stepStatus.get("identity-verification") ?? "PENDING";

  const dataReady = REQUIRED_IDENTITY_FIELD_KEYS.every((attrKey) => {
    const def = IDENTITY_VERIFICATION_FIELDS.find(
      (f) => f.attribute === attrKey,
    );
    return def ? (fields[def.key]?.trim() ?? "") !== "" : true;
  });

  const providerChecks = PROVIDER_CHECK_ORDER.filter((t) => stepStatus.has(t));
  const checksPending = providerChecks.some((t) => {
    const s = stepStatus.get(t);
    return s === "PENDING" || s === "IN_PROGRESS";
  });
  // Checks have run if there are persisted results (survives reopen) or the
  // officer ran them this session.
  const checksHaveRun = providerChecks.length > 0 || checksRun;

  // Duplicate detection is reviewer-driven: the ID scan can only be approved
  // once the duplicate is APPROVED (cleared). An unreviewed or confirmed
  // duplicate blocks approval — to approve you must first clear it.
  const dupRan = attrMap.has("duplicate_detection.match_found");
  const dupMatchFound =
    attrMap.get("duplicate_detection.match_found") === "true";
  const dupStatus = stepStatus.get("duplicate-detection");
  const dupCleared = dupMatchFound && dupStatus === "SUCCEEDED";
  const dupConfirmed = dupMatchFound && dupStatus === "FAILED";
  const dupBlocksApprove = dupRan && dupStatus !== "SUCCEEDED";

  // AML + fraud results (provider checks) for the Risk assessment detail.
  const amlStatus = stepStatus.get("aml-screening");
  const fraudStatus = stepStatus.get("fraud-detection");
  const hasAmlFraud = !!amlStatus || !!fraudStatus;
  const fraudFlags = (["vpn", "tor", "proxy", "is_crawler"] as const).filter(
    (f) => attrMap.get(`fraud_detection.${f}`) === "true",
  );
  // iDenfy's own verdict reasons (read-only) — same vocabulary as KYC_REASONS,
  // so known codes resolve to friendly labels and unknown ones show verbatim.
  const idenfyFlags = [
    attrMap.get("identity_verification.suspicion_reasons"),
    attrMap.get("identity_verification.fraud_tags"),
    attrMap.get("identity_verification.mismatch_tags"),
  ]
    .filter((v): v is string => !!v)
    .flatMap((csv) => csv.split(","))
    .map((s) => s.trim())
    .filter(Boolean);
  const rejectReasonsAttr = attrMap.get("_session.reject_reasons");

  // Label/value detail rows for the AML + fraud cards. Empty values are dropped
  // so a row only appears when the provider actually returned it.
  const titleCase = (s?: string) =>
    s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ") : "";
  const yesNo = (s?: string) =>
    s === "true" ? "Yes" : s === "false" ? "No" : "";
  const amlRows = (
    [
      ["Match status", titleCase(attrMap.get("aml_screening.match_status"))],
      ["Risk level", titleCase(attrMap.get("aml_screening.risk_level"))],
      ["Total hits", attrMap.get("aml_screening.total_hits") ?? "0"],
      ["Categories", attrMap.get("aml_screening.hit_categories") ?? ""],
      ["Reference", attrMap.get("aml_screening.search_ref") ?? ""],
    ] as Array<[string, string]>
  ).filter(([, v]) => v !== "");
  const fraudLocation = [
    attrMap.get("fraud_detection.city"),
    attrMap.get("fraud_detection.region"),
  ]
    .filter(Boolean)
    .join(", ");
  const fraudRows = (
    [
      ["Fraud score", attrMap.get("fraud_detection.fraud_score") ?? ""],
      ["Country", attrMap.get("fraud_detection.country_code") ?? ""],
      ["Location", fraudLocation],
      ["Connection", attrMap.get("fraud_detection.connection_type") ?? ""],
      ["ISP", attrMap.get("fraud_detection.isp") ?? ""],
      ["Recent abuse", yesNo(attrMap.get("fraud_detection.recent_abuse"))],
      ["Bot", yesNo(attrMap.get("fraud_detection.bot_status"))],
      ["Flags", fraudFlags.length ? fraudFlags.join(", ") : "None"],
    ] as Array<[string, string]>
  ).filter(([, v]) => v !== "");

  const frontUrl = documentFront.data?.url;
  const backUrl = documentBack.data?.url;
  const selfieUrl = faceVideo.data?.url;
  // Per-version document visibility is derived below (idShowBackView etc.); a
  // passport is single-page so its back image is never shown.

  // ID scan + Face scan are documents the reviewer clears manually (Sumsub
  // style): their verdict is stored as an id-scan / face-scan step row
  // (SUCCEEDED = approved, FAILED = rejected). Liveness is shown inside the Face
  // scan section, not as a separate check card.
  //
  // Whether the session HAS each scan to review is derived from persisted
  // attributes / step rows — NOT the signed image URL (which may still be
  // loading or fail to fetch) — so the check card always shows when the scan
  // exists, even before its image renders.
  const livenessAttr = iv("liveness_passed");
  // Has the customer COMPLETED each scan (uploaded a document / done liveness)?
  // Derived from persisted attributes / step rows, not the signed image URL.
  // Gates the detail SECTIONS — no point showing the document block before it
  // exists.
  const idScanCompleted =
    !!iv("document_complete") ||
    !!iv("document_type") ||
    !!iv("document_front_s3_key") ||
    stepStatus.has("id-scan");
  const faceScanCompleted =
    !!livenessAttr ||
    !!iv("liveness_checks") ||
    !!iv("face_status") ||
    !!iv("face_video_s3_key") ||
    stepStatus.has("face-scan");
  // Does each scan belong in the checks panel?
  //  • Completed (data present) → always shown.
  //  • Not completed → shown as "Not yet run" ONLY while the session is still in
  //    progress (abandoned mid-flow). Once a session has been SUBMITTED, a step
  //    that's merely enabled-but-not-done is one ADDED to the workflow AFTER
  //    submission — it's not part of this frozen session, so it must NOT appear
  //    as a dead "Not yet run" card the officer can never resolve. It surfaces
  //    normally the moment the customer actually does it (via resubmission —
  //    data-driven), just like any other re-collected step.
  const outstandingSteps = detail.data.outstanding.steps;
  const everSubmitted =
    attrMap.has("_session.submitted_at") ||
    overallStatus === "REQUIRES_REVIEW" ||
    overallStatus === "SUCCEEDED" ||
    overallStatus === "FAILED";
  const idScanConfigured =
    idScanCompleted ||
    dataReady ||
    (!everSubmitted && outstandingSteps.includes("id-scan"));
  const faceScanConfigured =
    faceScanCompleted ||
    (!everSubmitted && outstandingSteps.includes("face-scan"));
  const idScanVerdict = stepStatus.get("id-scan");
  const faceScanVerdict = stepStatus.get("face-scan");

  const pipeline: Array<{
    key: string;
    label: string;
    status: StepStatus;
    skipped?: boolean;
  }> = [];
  // Manual scans: status follows whether the CUSTOMER has completed the step,
  // not whether provider checks have run. Not completed → "Not yet run";
  // completed but no verdict → "Needs review" (the officer must clear it);
  // verdict set (manually or auto-approved) → Passed / Failed.
  if (idScanConfigured) {
    pipeline.push({
      key: "id-scan",
      label: "ID scan",
      status:
        idScanVerdict ?? (idScanCompleted ? "REQUIRES_REVIEW" : "PENDING"),
    });
  }
  if (faceScanConfigured) {
    pipeline.push({
      key: "face-scan",
      label: "Face scan",
      status:
        faceScanVerdict ?? (faceScanCompleted ? "REQUIRES_REVIEW" : "PENDING"),
    });
  }
  // Show every provider check that was configured AT SUBMISSION — frozen as
  // _session.expected_checks so a later workflow edit can't make a not-yet-run
  // check vanish from review. Old sessions (no frozen attr) fall back to the
  // live outstanding set. Status: ran → its result; still in the workflow + not
  // run → "Not yet run"; expected but since removed from the workflow + not run
  // → "Skipped" (Run checks dispatches off the live workflow, so it can't run).
  const expectedChecks = attrMap.has("_session.expected_checks")
    ? (attrMap.get("_session.expected_checks") ?? "").split(",").filter(Boolean)
    : detail.data.outstanding.checks;
  const stillConfigured = new Set(detail.data.outstanding.checks);
  const configuredProviderChecks = PROVIDER_CHECK_ORDER.filter(
    (t) => stepStatus.has(t) || expectedChecks.includes(t),
  );
  for (const t of configuredProviderChecks) {
    const ran = stepStatus.has(t);
    pipeline.push({
      key: t,
      label: PROVIDER_CHECK_LABELS[t] ?? t,
      status: stepStatus.get(t) ?? "PENDING",
      skipped: !ran && !stillConfigured.has(t),
    });
  }
  // Skipped checks are N/A (no longer in the workflow) — excluded from the
  // passed tally so they don't make "all passed" unreachable.
  const countableChecks = pipeline.filter((p) => !p.skipped);
  const checksPassedCount = countableChecks.filter(
    (p) => p.status === "SUCCEEDED",
  ).length;

  // Approve gate (Sumsub style): data captured → checks settled → both the ID
  // scan and the face scan cleared. Surfaced as a reason so a disabled Approve
  // button explains itself.
  const idScanApproved = idScanVerdict === "SUCCEEDED";
  const faceScanApproved = faceScanVerdict === "SUCCEEDED";
  // Awaiting the customer to resubmit (officer bounced specific steps back). The
  // case is back with the customer — it can't be approved until they resubmit,
  // at which point identity-verification flips back to review and this clears.
  const resubRequested =
    attrMap.get("_session.resubmission_requested") === "true";
  const approveBlockedReason = resubRequested
    ? "Awaiting customer resubmission"
    : !dataReady
      ? "Enter ID data before approving"
      : checksPending
        ? "Run checks before approving"
        : dupBlocksApprove
          ? "Clear the duplicate match first"
          : idScanCompleted && !idScanApproved
            ? "Approve the ID scan first"
            : faceScanCompleted && !faceScanApproved
              ? "Approve the face scan first"
              : null;
  const canApprove = approveBlockedReason === null;

  // Header status — mirror the review queue's derived status exactly so the
  // table and the detail page never disagree. The resubmission marker takes
  // precedence (identity-verification sits at IN_PROGRESS while it's out with
  // the customer, which on its own would read as "in progress").
  const headerStatus: ReviewQueueStatus = resubRequested
    ? "resubmission"
    : overallStatus === "SUCCEEDED"
      ? "approved"
      : overallStatus === "FAILED"
        ? "rejected"
        : overallStatus === "REQUIRES_REVIEW"
          ? "needs_review"
          : "in_progress";

  // Per-document verdict handlers. Approving the ID scan persists the typed
  // data first so the verdict reflects what was entered.
  const setIdScanVerdict = async (status: StepStatus) => {
    if (status === "SUCCEEDED")
      await saveIdentity.mutateAsync({ sessionId, fields });
    await recordStep.mutateAsync({ sessionId, step: "id-scan", status });
  };
  const setFaceScanVerdict = (status: StepStatus) =>
    recordStep.mutateAsync({ sessionId, step: "face-scan", status });
  // Reviewer clears (or re-flags) a possible duplicate — duplicate detection is
  // a signal that needs a human call, unlike the deterministic rules engine.
  // If the duplicate is moved out of "cleared" while the ID scan was already
  // approved, revoke that approval so a stale clearance can't carry through —
  // the reviewer must consciously re-approve with the new picture.
  const setDuplicateVerdict = async (status: StepStatus) => {
    await recordStep.mutateAsync({
      sessionId,
      step: "duplicate-detection",
      status,
    });
    if (status !== "SUCCEEDED" && idScanVerdict === "SUCCEEDED") {
      await recordStep.mutateAsync({
        sessionId,
        step: "id-scan",
        status: "REQUIRES_REVIEW",
      });
    }
  };

  // Display name — mirrors the review table (full_name, else first + last).
  // Prefers the officer's live edits, falling back to the stored attribute.
  const namePart = (suffix: string) =>
    (fields[suffix]?.trim() || iv(suffix)).trim();
  const customerName =
    namePart("full_name") ||
    [namePart("document_first_name"), namePart("document_last_name")]
      .filter(Boolean)
      .join(" ");

  // Header country flag — same priority the review table uses (document country,
  // then issuing, nationality, finally residence). Flag only when it resolves to
  // a known alpha-2 code, matching the table's CountryCell.
  const customerCountryCode = (
    iv("document_country") ||
    iv("document_issuing_country") ||
    iv("document_nationality") ||
    attrMap.get("address.country") ||
    ""
  )
    .trim()
    .toUpperCase();
  const customerCountry = COUNTRIES.find((c) => c.code === customerCountryCode);

  // ── Integrity signals (derived from canonical attributes) ──────────────────
  const signals: Array<{ tone: Tone; label: string; value: ReactNode }> = [];

  const age = computeAge(iv("date_of_birth"));
  if (age !== null) {
    signals.push({
      tone: age < 18 ? "bad" : "neutral",
      label: "Age",
      value: age < 18 ? `${age} — under 18` : `${age} years`,
    });
  }

  const exp = expiryInfo(iv("document_expiry"));
  if (exp) {
    signals.push({
      tone: exp.tone,
      label: "Document validity",
      value: exp.text,
    });
  }

  const nationality = iv("document_nationality");
  const issuing = iv("document_issuing_country");
  if (nationality && issuing) {
    const match = nationality.toUpperCase() === issuing.toUpperCase();
    signals.push({
      tone: match ? "good" : "warn",
      label: "Nationality vs issuing country",
      value: match ? "Match" : `${nationality} ≠ ${issuing}`,
    });
  }

  const providerDecision = iv("provider_decision");
  if (providerDecision) {
    const dec = providerDecision.toUpperCase();
    signals.push({
      tone:
        dec === "APPROVED"
          ? "good"
          : dec === "DENIED" || dec === "REJECTED"
            ? "bad"
            : "warn",
      label: "Provider decision",
      value: providerDecision,
    });
  }

  // ── Face-scan data (lives in the Face scan section, beside the selfie) ──────
  const faceData: Array<{ tone: Tone; label: string; value: ReactNode }> = [];
  const livenessPassed = iv("liveness_passed");
  // MediaPipe gesture liveness (manual path).
  if (livenessPassed) {
    const ok = livenessPassed === "true";
    faceData.push({
      tone: ok ? "good" : "bad",
      label: "Liveness",
      value: ok ? "Passed" : "Failed",
    });
  }
  const livenessChecks = iv("liveness_checks");
  if (livenessChecks)
    faceData.push({
      // These are the checks that PASSED, so match the green "Liveness: Passed"
      // row rather than showing a neutral grey dot.
      tone: livenessPassed === "true" ? "good" : "neutral",
      label: "Checks performed",
      value: livenessChecks.split(",").map(humanize).join(", "),
    });
  // iDenfy path: its own face verdict (autoFace/manualFace) instead of the
  // MediaPipe checks, which only run on the manual path.
  const faceStatus = iv("face_status");
  if (faceStatus) {
    const ok = faceStatus === "FACE_MATCH";
    faceData.push({
      tone: ok ? "good" : "bad",
      label: "Face check",
      value: ok ? "Match" : kycReasonLabel(faceStatus),
    });
  }

  // ── Contact & session facts ────────────────────────────────────────────────
  const verifiedEmail = attrMap.get("email_verification.email");
  const emailVerifiedAt = attrMap.get("email_verification.verified_at");
  const contactEmail = attrMap.get("contact_information.email");
  const contactPhone = attrMap.get("contact_information.phone");
  const clientIp = attrMap.get("_session.client_ip");
  const locale = attrMap.get("_session.locale");
  const termsAt = attrMap.get("terms_acceptance.accepted_at");
  const providerScanRef = iv("provider_scan_ref");

  const facts: Array<{ tone: Tone; label: string; value: ReactNode }> = [];
  if (verifiedEmail || contactEmail) {
    facts.push({
      tone: emailVerifiedAt ? "good" : "neutral",
      label: "Email",
      value: emailVerifiedAt
        ? `${verifiedEmail ?? contactEmail} · verified ${fmtDate(emailVerifiedAt)}`
        : `${contactEmail} · not verified`,
    });
  }
  if (contactPhone)
    facts.push({ tone: "neutral", label: "Phone", value: contactPhone });
  if (clientIp)
    facts.push({ tone: "neutral", label: "Submission IP", value: clientIp });
  if (locale)
    facts.push({
      tone: "neutral",
      label: "Locale",
      value: <LocaleFlag locale={locale} />,
    });
  if (termsAt)
    facts.push({
      tone: "good",
      label: "Terms accepted",
      value: fmtDate(termsAt),
    });
  if (providerScanRef)
    facts.push({
      tone: "neutral",
      label: "Provider scan ref",
      value: <span className="font-mono text-xs">{providerScanRef}</span>,
    });

  // ── Structured residence address (from proof-of-residence step) ────────────
  const addr = {
    street: attrMap.get("address.street") ?? "",
    city: attrMap.get("address.city") ?? "",
    postal: attrMap.get("address.postal_code") ?? "",
    country: attrMap.get("address.country") ?? "",
    docType: attrMap.get("proof_of_residence.document_type") ?? "",
  };
  const hasAddress = !!(
    addr.street ||
    addr.city ||
    addr.postal ||
    addr.country
  );

  // ── Resubmission history ───────────────────────────────────────────────────
  // (resubRequested is defined above, by the approve gate.)
  const resubNote = attrMap.get("_session.resubmission_note");
  const resubAt = attrMap.get("_session.resubmission_requested_at");
  const resubSteps = attrMap.get("_session.resubmission_steps");
  const resubReasons = attrMap.get("_session.resubmission_reasons");

  // ── Scan versions: labels for the switcher + the selected version's view ─────
  // A past version renders in the SAME block layout, read-only, fed from its
  // snapshot; the current version is the live, editable one.
  const idVersionLabels = [
    ...idScanSnapshots.map((_, i) => ({ label: `Attempt ${i + 1}` })),
    { label: "Current" },
  ];
  const faceVersionLabels = [
    ...faceScanSnapshots.map((_, i) => ({ label: `Attempt ${i + 1}` })),
    { label: "Current" },
  ];
  const idDocTypeView = idViewingPast
    ? (idPastSnapshot?.["identity_verification.document_type"] ?? "")
    : iv("document_type");
  const idFrontUrl = idViewingPast ? pastDocFront.data?.url : frontUrl;
  const idBackUrl = idViewingPast ? pastDocBack.data?.url : backUrl;
  const idFrontData = idViewingPast ? pastDocFront.data : documentFront.data;
  const idBackData = idViewingPast ? pastDocBack.data : documentBack.data;
  const idShowBackView = !!idBackUrl && idDocTypeView !== "PASSPORT";
  const idHasDocumentView = !!(idFrontUrl || idShowBackView);
  const idFieldValue = (field: { key: string; attribute: string }) => {
    if (!idViewingPast) return fields[field.key] ?? "";
    const raw = idPastSnapshot?.[field.attribute] ?? "";
    if (raw) return raw;
    // Mirror the current form's seeding so a country swap is visible even on a
    // past version: default Nationality / Issuing country from the snapshot's
    // captured document_country when they weren't separately saved.
    if (
      field.key === "document_nationality" ||
      field.key === "document_issuing_country"
    ) {
      return idPastSnapshot?.["identity_verification.document_country"] ?? "";
    }
    return "";
  };

  const faceSelfieUrl = faceViewingPast ? pastFace.data?.url : selfieUrl;
  const faceSelfieData = faceViewingPast ? pastFace.data : faceVideo.data;
  // The document photo is only shown for the current face scan (a past face-only
  // resubmission doesn't snapshot the document).
  const faceDocPhotoUrl = faceViewingPast ? null : frontUrl;
  const facePastLiveness =
    facePastSnapshot?.["identity_verification.liveness_passed"];
  const facePastChecks = (
    facePastSnapshot?.["identity_verification.liveness_checks"] ?? ""
  )
    .split(",")
    .map(humanize)
    .filter(Boolean)
    .join(", ");
  const faceSignalsView: Array<{
    tone: Tone;
    label: string;
    value: ReactNode;
  }> = faceViewingPast
    ? [
        ...(facePastLiveness
          ? [
              {
                tone: (facePastLiveness === "true" ? "good" : "bad") as Tone,
                label: "Liveness",
                value: facePastLiveness === "true" ? "Passed" : "Failed",
              },
            ]
          : []),
        ...(facePastChecks
          ? [
              {
                tone: "neutral" as Tone,
                label: "Liveness checks",
                value: facePastChecks,
              },
            ]
          : []),
      ]
    : faceData;

  const porVersionLabels = [
    ...porSnapshots.map((_, i) => ({ label: `Attempt ${i + 1}` })),
    { label: "Current" },
  ];
  const porImageUrl = porViewingPast
    ? pastPor.data?.url
    : proofOfResidence.data?.url;
  const porImageData = porViewingPast ? pastPor.data : proofOfResidence.data;
  const porDocTypeView = porViewingPast
    ? (porPastSnapshot?.["proof_of_residence.document_type"] ?? "")
    : addr.docType;
  const porStreet = porViewingPast
    ? (porPastSnapshot?.["address.street"] ?? "")
    : addr.street;
  const porCity = porViewingPast
    ? (porPastSnapshot?.["address.city"] ?? "")
    : addr.city;
  const porPostal = porViewingPast
    ? (porPastSnapshot?.["address.postal_code"] ?? "")
    : addr.postal;
  const porCountry = porViewingPast
    ? (porPastSnapshot?.["address.country"] ?? "")
    : addr.country;
  const porHasAddress = !!(porStreet || porCity || porPostal || porCountry);

  // ── Activity timeline ──────────────────────────────────────────────────────
  // Source of truth is the append-only event table (every resubmission /
  // re-verification / decision / archive round is its own row, so the full
  // history shows). For sessions created before that table existed, we fall back
  // to deriving a single entry from the last-wins markers / row / step — so old
  // submissions still render a sensible (if single-round) history.
  const events = detail.data.events;
  const hasEvent = (t: string) => events.some((e) => e.type === t);
  const renderStepList = (steps: string[] | undefined) =>
    steps && steps.length > 0 ? (
      <div>Steps: {steps.map(stepLabel).join(", ")}</div>
    ) : null;
  const renderReasonList = (codes: string[] | undefined) =>
    codes && codes.length > 0 ? (
      <div>Reasons: {codes.map((c) => kycReasonLabel(c)).join(", ")}</div>
    ) : null;
  const renderCsvSteps = (csv: string) => (
    <div>
      Steps:{" "}
      {csv
        .split(",")
        .map((s) => stepLabel(s.trim()))
        .join(", ")}
    </div>
  );
  const renderCsvReasons = (csv: string) => (
    <div>
      Reasons:{" "}
      {csv
        .split(",")
        .map((c) => kycReasonLabel(c.trim()))
        .join(", ")}
    </div>
  );

  const eventToEntry = (e: WorkflowSessionEvent): TimelineEntry => {
    const d = e.detail ?? {};
    if (e.type === "decision") {
      const dec = d.decision ?? "";
      return {
        at: e.occurredAt,
        icon:
          dec === "approved" ? (
            <Check size={13} />
          ) : dec === "rejected" ? (
            <X size={13} />
          ) : (
            <AlertTriangle size={13} />
          ),
        tone: dec === "approved" ? "good" : dec === "rejected" ? "bad" : "warn",
        title:
          dec === "approved"
            ? "Approved"
            : dec === "rejected"
              ? "Rejected"
              : "Flagged for review",
        actor: resolveActor(e.createdBy),
        // Reject decisions carry structured reason codes; an approve-override
        // carries a free-text justification (d.reason). Show whichever exists.
        detail:
          d.reasonCodes && d.reasonCodes.length > 0 ? (
            (renderReasonList(d.reasonCodes) ?? undefined)
          ) : d.reason ? (
            <div>{d.reason}</div>
          ) : undefined,
      };
    }
    if (e.type === "archived") {
      return {
        at: e.occurredAt,
        icon: <Archive size={13} />,
        tone: "neutral",
        title: "Archived",
        actor: resolveActor(e.createdBy),
        detail: d.reason ? <div>Reason: “{d.reason}”</div> : undefined,
      };
    }
    // resubmission_requested | reverification_requested
    const isResub = e.type === "resubmission_requested";
    return {
      at: e.occurredAt,
      icon: <RotateCcw size={13} />,
      tone: "warn",
      title: isResub ? "Resubmission requested" : "Re-verification requested",
      actor: resolveActor(e.createdBy),
      detail: (
        <>
          {renderStepList(d.steps)}
          {renderReasonList(d.reasonCodes)}
          {d.note && <div>Note: “{d.note}”</div>}
        </>
      ),
    };
  };

  const timeline: TimelineEntry[] = [
    {
      at: session.createdAt,
      icon: <Play size={13} />,
      tone: "neutral",
      title: "Verification started",
    },
  ];
  const submittedAt = attrMap.get("_session.submitted_at");
  if (submittedAt)
    timeline.push({
      at: submittedAt,
      icon: <Clock size={13} />,
      tone: "info",
      title: "Submitted for review",
    });

  for (const e of events) timeline.push(eventToEntry(e));

  // ── Fallbacks for pre-event-table sessions (no event of the given kind) ──
  if (!hasEvent("resubmission_requested") && resubAt)
    timeline.push({
      at: resubAt,
      icon: <RotateCcw size={13} />,
      tone: "warn",
      title: "Resubmission requested",
      actor: resolveActor(attrMap.get("_session.resubmission_requested_by")),
      detail: (
        <>
          {resubSteps && renderCsvSteps(resubSteps)}
          {resubReasons && renderCsvReasons(resubReasons)}
          {resubNote && <div>Note: “{resubNote}”</div>}
        </>
      ),
    });
  const reverAt = attrMap.get("_session.reverification_requested_at");
  if (!hasEvent("reverification_requested") && reverAt) {
    const s = attrMap.get("_session.reverification_steps");
    timeline.push({
      at: reverAt,
      icon: <RotateCcw size={13} />,
      tone: "warn",
      title: "Re-verification requested",
      actor: resolveActor(attrMap.get("_session.reverification_requested_by")),
      detail: s ? renderCsvSteps(s) : undefined,
    });
  }
  if (
    !hasEvent("decision") &&
    (overallStatus === "SUCCEEDED" || overallStatus === "FAILED")
  ) {
    const approved = overallStatus === "SUCCEEDED";
    const ivStep = detail.data.steps.find(
      (s) => s.step === "identity-verification",
    );
    timeline.push({
      at: ivStep?.updatedAt ?? session.updatedAt,
      icon: approved ? <Check size={13} /> : <X size={13} />,
      tone: approved ? "good" : "bad",
      title: approved ? "Approved" : "Rejected",
      detail:
        !approved && rejectReasonsAttr
          ? renderCsvReasons(rejectReasonsAttr)
          : undefined,
    });
  }
  if (!hasEvent("archived") && session.deletedAt)
    timeline.push({
      at: session.deletedAt,
      icon: <Archive size={13} />,
      tone: "neutral",
      title: "Archived",
      actor: resolveActor(session.deletedBy),
      detail: session.deleteReason ? (
        <div>Reason: “{session.deleteReason}”</div>
      ) : undefined,
    });
  timeline.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  const handleRunChecks = async () => {
    await saveIdentity.mutateAsync({ sessionId, fields });
    await runChecks.mutateAsync(sessionId);
    setChecksRun(true);
  };
  const handleFinalize = async (decision: ReviewDecision) => {
    await finalize.mutateAsync({
      sessionId,
      decision,
      reviewedBy: user.id,
      reason: reason || undefined,
      reasonCodes: Array.from(rejectReasons),
    });
    backToQueue();
  };

  // Risk checks the officer would be overriding by approving (settled but not
  // passed). Approving over any of these requires a documented justification.
  const riskFlags = ["aml-screening", "fraud-detection", "rules-engine"].filter(
    (t) => {
      const s = stepStatus.get(t);
      return s === "FAILED" || s === "REQUIRES_REVIEW";
    },
  );
  const needsApproveReason = riskFlags.length > 0;

  const handleApprove = () => {
    if (needsApproveReason) setApproveOpen(true);
    else void handleFinalize("approved");
  };

  const handleApproveOverride = async () => {
    // Compose the override justification (chip labels + free note) into the
    // decision reason. reasonCodes stays empty so it isn't stored as a REJECT
    // reason — it rides the decision event as the approval justification.
    const labels = APPROVE_OVERRIDE_REASONS.filter((r) =>
      approveReasons.has(r.code),
    ).map((r) => r.label);
    const composed = [labels.join(", "), approveNote.trim()]
      .filter(Boolean)
      .join(" — ");
    if (!composed) return;
    await finalize.mutateAsync({
      sessionId,
      decision: "approved",
      reviewedBy: user.id,
      reason: composed,
      reasonCodes: [],
    });
    backToQueue();
  };
  // Reason chips track the steps being bounced: show only the areas relevant to
  // the SELECTED steps (or, before any are picked, the enabled steps), plus the
  // always-relevant "Other". So a POR-only / face-only bounce won't offer
  // unrelated reasons.
  const selectedResubmitSteps = Object.entries(resubmitSteps)
    .filter(([, checked]) => checked)
    .map(([type]) => type);
  const resubmitReasonSource =
    selectedResubmitSteps.length > 0 ? selectedResubmitSteps : bounceableSteps;
  const resubmitReasonAreas = [
    ...new Set(resubmitReasonSource.flatMap((t) => STEP_REASON_AREAS[t] ?? [])),
    "other",
  ];

  const handleResubmit = async () => {
    const steps = Object.entries(resubmitSteps)
      .filter(([, checked]) => checked)
      .map(([type]) => type)
      // Defensive: only bounce steps that are enabled AND were completed.
      .filter((type) => bounceableSteps.includes(type));
    if (steps.length === 0) return;
    await requestResubmission.mutateAsync({
      sessionId,
      steps,
      note: resubmitNote || undefined,
      reasonCodes: Array.from(resubmitReasons),
      reviewedBy: user.id,
    });
    backToQueue();
  };
  const toggleReason = (setter: typeof setRejectReasons) => (code: string) =>
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });

  // Re-verification: an APPROVED customer is missing what the workflow now
  // requires (identity steps and/or server checks). They STAY approved — this
  // re-runs server checks + prompts for missing steps; only a failed re-check
  // moves them (handled server-side).
  const outstanding = detail.data.outstanding ?? { steps: [], checks: [] };
  // Only customer-action STEPS drive the re-verification prompt. Outstanding
  // server CHECKS (AML/fraud/dup/rules added after approval) are NOT
  // customer-facing — they re-screen server-side (see getSession) and only
  // demote on failure, so they never make a customer "re-verification required".
  const outstandingStepLabels = outstanding.steps.map(stepLabel);
  const needsReverification =
    overallStatus === "SUCCEEDED" && outstandingStepLabels.length > 0;
  // Customer was demoted from approved because a re-check failed.
  const reverificationFailed = attrMap.get("_session.reverification_failed");
  const handleRequestReverification = async () => {
    await requestReverification.mutateAsync({ sessionId, reviewedBy: user.id });
    backToQueue();
  };
  const handleRestore = async () => {
    await restoreSession.mutateAsync(sessionId);
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-4">
      <BackLink />

      {/* Header — identity + status on the left, decision actions on the right */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="text-base font-semibold text-gray-900">
                {customerName || session.customerId}
              </div>
              {customerCountry && (
                <span
                  title={customerCountry.name}
                  aria-label={customerCountry.name}
                  className={`fi fi-${customerCountry.code.toLowerCase()} inline-block h-4 w-6 rounded-sm shadow-[0_0_0_1px_rgba(0,0,0,0.04)]`}
                />
              )}
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                  session.verificationMode === "sandbox"
                    ? "bg-yellow-100 text-yellow-700"
                    : "bg-red-100 text-red-700"
                }`}
              >
                {session.verificationMode === "sandbox" ? (
                  <>
                    <FlaskConical size={12} /> Sandbox
                  </>
                ) : (
                  <>
                    <Radio size={12} /> Live
                  </>
                )}
              </span>
              <StatusPill status={headerStatus} />
            </div>
            {customerName && (
              <div className="font-mono text-xs text-gray-400 mt-0.5">
                {session.customerId}
              </div>
            )}
            <div className="text-xs text-gray-500 mt-0.5">
              Submitted {formatDateTime(session.createdAt)}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              Workflow:{" "}
              <Link
                to={`/settings/workflows/${session.workflowId}`}
                className="text-primary-700 hover:underline font-mono"
              >
                {session.workflowId}
              </Link>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1.5">
            <div className="flex flex-wrap items-center justify-end gap-2">
              {session.archived ? (
                <button
                  type="button"
                  disabled={restoreSession.isPending}
                  onClick={handleRestore}
                  className="inline-flex items-center gap-1.5 py-2 px-4 bg-primary-200 hover:bg-primary-300 text-primary-800 font-medium rounded-lg text-sm disabled:opacity-50"
                >
                  <ArchiveRestore size={14} />{" "}
                  {restoreSession.isPending ? "Restoring…" : "Restore"}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={finalize.isPending || !canApprove}
                    onClick={handleApprove}
                    title={approveBlockedReason ?? undefined}
                    className="inline-flex items-center gap-1.5 py-2 px-4 bg-primary-200 hover:bg-primary-300 text-primary-800 font-medium rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Check size={14} /> Approve
                  </button>
                  <button
                    type="button"
                    disabled={finalize.isPending}
                    onClick={() => setResubmitOpen(true)}
                    className="inline-flex items-center gap-1.5 py-2 px-4 bg-orange-100 hover:bg-orange-200 text-orange-700 font-medium rounded-lg text-sm disabled:opacity-50"
                  >
                    <RotateCcw size={14} /> Request resubmission
                  </button>
                  <button
                    type="button"
                    disabled={finalize.isPending}
                    onClick={() => setRejectOpen(true)}
                    className="inline-flex items-center gap-1.5 py-2 px-4 bg-red-50 hover:bg-red-100 text-red-700 font-medium rounded-lg text-sm disabled:opacity-50"
                  >
                    <X size={14} /> Reject
                  </button>
                </>
              )}
            </div>
            {!session.archived && approveBlockedReason && (
              <span className="text-xs text-yellow-700 inline-flex items-center gap-1">
                <Clock size={12} /> {approveBlockedReason}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Archived banner */}
      {session.archived && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <Archive size={14} /> Archived submission
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Hidden from the review queue and retained for audit — Restore to
            return it to the queue.
            {session.deleteReason ? ` Reason: “${session.deleteReason}”` : ""}
          </div>
          {session.deletedAt && (
            <div className="text-xs text-gray-400 mt-1">
              Archived {fmtDate(session.deletedAt)}
              {session.deletedBy ? ` by ${session.deletedBy}` : ""}
            </div>
          )}
        </div>
      )}

      {/* Resubmission banner */}
      {(resubRequested || resubNote) && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-orange-800">
            <RotateCcw size={14} />
            {resubRequested
              ? "Awaiting customer resubmission"
              : "Previously sent back for resubmission"}
          </div>
          {resubSteps && (
            <div className="text-xs text-orange-700 mt-1">
              Steps: {resubSteps.split(",").join(", ")}
            </div>
          )}
          {resubReasons && (
            <div className="text-xs text-orange-700 mt-1">
              Reasons:{" "}
              {resubReasons
                .split(",")
                .map((c) => kycReasonLabel(c.trim()))
                .join(", ")}
            </div>
          )}
          {resubNote && (
            <div className="text-xs text-orange-700 mt-1">“{resubNote}”</div>
          )}
          {resubAt && (
            <div className="text-xs text-orange-600 mt-1">
              Requested {fmtDate(resubAt)}
            </div>
          )}
        </div>
      )}

      {/* Re-verification banner — approved customer missing now-required
          requirements. They STAY approved; this re-runs server checks + prompts
          for missing steps. */}
      {needsReverification && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-medium text-orange-800">
                <AlertTriangle size={14} /> Re-verification required
              </div>
              <div className="text-xs text-orange-700 mt-1">
                Approved under an earlier version of the workflow, which now
                requires the customer to complete:{" "}
                {outstandingStepLabels.join(", ")}. They stay approved while
                this is resolved — only a failed re-check moves them.
              </div>
            </div>
            <button
              type="button"
              onClick={handleRequestReverification}
              disabled={requestReverification.isPending}
              className="shrink-0 inline-flex items-center gap-1.5 py-2 px-3 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium disabled:opacity-50"
            >
              <RotateCcw size={14} />
              {requestReverification.isPending
                ? "Sending…"
                : "Request re-verification"}
            </button>
          </div>
        </div>
      )}

      {/* Demoted from approved to review because a re-check failed */}
      {reverificationFailed && overallStatus === "REQUIRES_REVIEW" && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-red-800">
            <AlertTriangle size={14} /> Moved out of approved — re-check failed
          </div>
          <div className="text-xs text-red-700 mt-1">
            A re-screen of this previously-approved customer failed:{" "}
            {reverificationFailed
              .split(",")
              .map((t) => PROVIDER_CHECK_LABELS[t.trim()] ?? t.trim())
              .join(", ")}
            . Review and decide below.
          </div>
        </div>
      )}

      {/* Rejected — decision + reasons (shown when a rejected session is opened,
          e.g. from the future Customers page or a direct link) */}
      {overallStatus === "FAILED" && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-red-800">
            <X size={14} /> Rejected
          </div>
          {rejectReasonsAttr && (
            <div className="text-xs text-red-700 mt-1">
              Reasons:{" "}
              {rejectReasonsAttr
                .split(",")
                .map((c) => kycReasonLabel(c.trim()))
                .join(", ")}
            </div>
          )}
        </div>
      )}

      {/* Activity timeline — chronological audit trail of the submission */}
      <Section title="Activity" icon={<Clock size={15} />}>
        <ActivityTimeline entries={timeline} />
      </Section>

      {/* Checks */}
      {pipeline.length > 0 && (
        <Section
          title="Checks"
          icon={<ListChecks size={15} />}
          action={
            <span
              className={`text-xs ${
                checksPassedCount === countableChecks.length
                  ? "text-emerald-600"
                  : "text-gray-400"
              }`}
            >
              {checksPassedCount}/{countableChecks.length} passed
            </span>
          }
        >
          <ChecksPanel checks={pipeline} />
        </Section>
      )}

      {/* Section: Risk assessment — integrity signals, AML/fraud, duplicate, scenarios */}
      {(signals.length > 0 ||
        hasAmlFraud ||
        dupRan ||
        idenfyFlags.length > 0 ||
        ruleEvaluations.length > 0) && (
        <Section title="Risk assessment" icon={<ShieldCheck size={15} />}>
          {/* Each sub-block divided + generously padded so it reads clearly. */}
          <div className="-mt-1 divide-y divide-gray-100">
            {/* Provider flags — iDenfy's own verdict reasons (read-only) */}
            {idenfyFlags.length > 0 && (
              <div className="py-5 first:pt-0 last:pb-0">
                <SubBlock title="Provider flags">
                  <div className="flex flex-wrap gap-1.5">
                    {idenfyFlags.map((code) => (
                      <span
                        key={code}
                        className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs text-amber-700"
                      >
                        {kycReasonLabel(code)}
                      </span>
                    ))}
                  </div>
                </SubBlock>
              </div>
            )}
            {/* Integrity signals — derived facts off the document */}
            {signals.length > 0 && (
              <div className="py-5 first:pt-0 last:pb-0">
                <SubBlock title="Integrity signals">
                  <div className="divide-y divide-gray-100">
                    {signals.map((s) => (
                      <SignalRow key={s.label} {...s} />
                    ))}
                  </div>
                </SubBlock>
              </div>
            )}

            {/* AML & fraud — provider screening results */}
            {hasAmlFraud && (
              <div className="py-5 first:pt-0 last:pb-0">
                <SubBlock title="AML & fraud">
                  <div className="space-y-2">
                    {amlStatus && (
                      <div className="rounded-lg border border-gray-200 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-medium text-gray-900">
                            AML screening
                          </div>
                          <StepResultPill status={amlStatus} />
                        </div>
                        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                          {amlRows.map(([label, value]) => (
                            <div
                              key={label}
                              className="flex justify-between gap-2"
                            >
                              <dt className="text-gray-500">{label}</dt>
                              <dd className="truncate text-right text-gray-900">
                                {value}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                    )}
                    {fraudStatus && (
                      <div className="rounded-lg border border-gray-200 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-medium text-gray-900">
                            Fraud detection
                          </div>
                          <StepResultPill status={fraudStatus} />
                        </div>
                        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                          {fraudRows.map(([label, value]) => (
                            <div
                              key={label}
                              className="flex justify-between gap-2"
                            >
                              <dt className="text-gray-500">{label}</dt>
                              <dd className="truncate text-right text-gray-900">
                                {value}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                    )}
                  </div>
                </SubBlock>
              </div>
            )}

            {/* Duplicate detection — needs a human call, so it's clearable */}
            {dupRan && (
              <div className="py-5 first:pt-0 last:pb-0">
                <SubBlock
                  title="Duplicate detection"
                  badge={
                    !dupMatchFound ? (
                      <ResultPill tone="good">No duplicates</ResultPill>
                    ) : dupConfirmed ? (
                      <ResultPill tone="bad">Duplicate</ResultPill>
                    ) : dupCleared ? (
                      <ResultPill tone="good">Cleared</ResultPill>
                    ) : (
                      <ResultPill tone="warn">Needs review</ResultPill>
                    )
                  }
                >
                  {dupMatchFound ? (
                    <div className="space-y-3">
                      {matchedCustomers.length > 0 ? (
                        <div className="space-y-2">
                          {matchedCustomers.map((m) => (
                            <div
                              key={m.customerId}
                              className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50/60 px-3 py-2.5"
                            >
                              <div className="min-w-0">
                                {m.sessionId ? (
                                  <Link
                                    to={`/kyc-review/${m.sessionId}`}
                                    className="text-sm font-medium text-primary-700 hover:underline"
                                  >
                                    {m.name || "Unnamed"}
                                  </Link>
                                ) : (
                                  <span className="text-sm font-medium text-gray-900">
                                    {m.name || "Unnamed"}
                                  </span>
                                )}
                                <div className="text-[11px] text-gray-400 font-mono truncate">
                                  {m.customerId}
                                </div>
                              </div>
                              <span className="shrink-0 text-xs text-gray-500">
                                {m.on === "document"
                                  ? "same document #"
                                  : "same name + DOB"}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-gray-500 font-mono break-all">
                          {attrMap.get(
                            "duplicate_detection.matched_customer_ids",
                          )}
                        </div>
                      )}

                      {dupCleared || dupConfirmed ? (
                        <div className="flex items-center gap-3">
                          <span
                            className={`inline-flex items-center gap-1 text-xs ${
                              dupConfirmed ? "text-red-700" : "text-emerald-700"
                            }`}
                          >
                            {dupConfirmed ? (
                              <X size={12} />
                            ) : (
                              <Check size={12} />
                            )}
                            {dupConfirmed
                              ? "Confirmed duplicate"
                              : "Reviewed — not a duplicate"}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setDuplicateVerdict("REQUIRES_REVIEW")
                            }
                            className="text-xs text-gray-500 hover:text-gray-700 underline"
                          >
                            Undo
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setDuplicateVerdict("SUCCEEDED")}
                            disabled={recordStep.isPending}
                            className="inline-flex items-center gap-1.5 text-xs font-medium py-1.5 px-3 rounded-lg border border-emerald-300 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                          >
                            <Check size={13} /> Not a duplicate
                          </button>
                          <button
                            type="button"
                            onClick={() => setDuplicateVerdict("FAILED")}
                            disabled={recordStep.isPending}
                            className="inline-flex items-center gap-1.5 text-xs font-medium py-1.5 px-3 rounded-lg border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50"
                          >
                            <X size={13} /> Confirm duplicate
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500">
                      No duplicates found.
                    </div>
                  )}
                </SubBlock>
              </div>
            )}

            {/* Custom scenarios (rules engine) — deterministic pass/fail */}
            {ruleEvaluations.length > 0 && (
              <div className="py-5 first:pt-0 last:pb-0">
                <SubBlock title="Rules engine">
                  <div className="space-y-2.5">
                    {ruleEvaluations.map((ev) => (
                      <div
                        key={ev.scenarioId}
                        className="rounded-lg border border-gray-200 p-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <Link
                              to={`/settings/scenarios/${ev.scenarioId}`}
                              className="text-sm font-medium text-primary-700 hover:underline"
                            >
                              {ev.name}
                            </Link>
                            <div className="text-[11px] text-gray-400 font-mono truncate">
                              {ev.scenarioId}
                            </div>
                          </div>
                          <ResultPill tone={ev.matched ? "bad" : "good"}>
                            {ev.matched ? "Failed" : "Passed"}
                          </ResultPill>
                        </div>
                        {ev.conditions.length > 0 && (
                          <div className="mt-2.5 space-y-1.5 border-t border-gray-100 pt-2.5">
                            {ev.conditions.map((c, i) => (
                              <div
                                key={i}
                                className="flex items-center justify-between gap-3 text-xs"
                              >
                                <span
                                  className={`font-mono ${
                                    c.passed ? "text-gray-700" : "text-gray-400"
                                  }`}
                                >
                                  {attrLabel(c.attribute)}{" "}
                                  {opSymbol(c.operator)} {c.value}
                                </span>
                                <span
                                  className={
                                    c.passed ? "text-gray-700" : "text-gray-400"
                                  }
                                >
                                  {c.passed ? "met" : "not met"}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                        {ev.matched && (
                          <ScenarioActionSummary actions={ev.actions} />
                        )}
                      </div>
                    ))}
                  </div>
                </SubBlock>
              </div>
            )}
          </div>
        </Section>
      )}

      {/* Approve over flagged checks — override justification (compliance) */}
      <Modal
        open={approveOpen}
        onClose={() => setApproveOpen(false)}
        title="Approve despite flagged checks"
        subtitle="Clearing a flagged case requires a documented justification."
        maxWidth="md"
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setApproveOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={
                finalize.isPending ||
                (approveReasons.size === 0 && approveNote.trim() === "")
              }
              onClick={handleApproveOverride}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-primary-500 hover:bg-primary-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {finalize.isPending ? "Approving…" : "Approve"}
            </button>
          </div>
        }
      >
        {riskFlags.length > 0 && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Overriding:{" "}
            {riskFlags.map((t) => PROVIDER_CHECK_LABELS[t] ?? t).join(", ")}
          </div>
        )}
        <label className="block text-xs font-medium text-gray-600 mb-2">
          Justification <span className="text-red-500">*</span>
        </label>
        <div className="flex flex-wrap gap-1.5">
          {APPROVE_OVERRIDE_REASONS.map((r) => {
            const active = approveReasons.has(r.code);
            return (
              <button
                key={r.code}
                type="button"
                onClick={() => toggleReason(setApproveReasons)(r.code)}
                className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                  active
                    ? "border-primary-300 bg-primary-100 text-primary-800"
                    : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                {r.label}
              </button>
            );
          })}
        </div>
        <label className="mt-4 block text-xs font-medium text-gray-600 mb-1">
          Note (optional)
        </label>
        <textarea
          value={approveNote}
          onChange={(e) => setApproveNote(e.target.value)}
          placeholder="Add context for the audit trail…"
          rows={3}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300"
        />
      </Modal>

      {/* Reject — confirmation modal */}
      <Modal
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title="Reject submission"
        subtitle="The customer will be marked as rejected."
        maxWidth="md"
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setRejectOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={finalize.isPending}
              onClick={() => handleFinalize("rejected")}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
            >
              {finalize.isPending ? "Rejecting…" : "Confirm rejection"}
            </button>
          </div>
        }
      >
        <label className="block text-xs font-medium text-gray-600 mb-2">
          Reasons
        </label>
        <ReasonChips
          severity="reject"
          selected={rejectReasons}
          onToggle={toggleReason(setRejectReasons)}
        />
        <label className="mt-4 block text-xs font-medium text-gray-600 mb-1">
          Note (optional)
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Add any extra detail…"
          rows={3}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300"
        />
      </Modal>

      {/* Request resubmission — modal */}
      <Modal
        open={resubmitOpen}
        onClose={() => setResubmitOpen(false)}
        title="Request resubmission"
        subtitle="Send the customer back to redo the selected steps."
        maxWidth="md"
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setResubmitOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleResubmit}
              disabled={
                requestResubmission.isPending ||
                !Object.values(resubmitSteps).some(Boolean)
              }
              className="px-4 py-2 text-sm font-medium rounded-lg bg-primary-500 hover:bg-primary-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {requestResubmission.isPending ? "Sending…" : "Send request"}
            </button>
          </div>
        }
      >
        <div className="text-sm font-medium text-gray-900 mb-2.5">
          Which steps should the customer redo?
        </div>
        <div className="space-y-2 mb-5">
          {RESUBMITTABLE_STEPS.filter((s) => bounceableSteps.includes(s.type))
            .length === 0 && (
            <div className="rounded-lg border border-dashed border-gray-200 px-3 py-4 text-center text-xs text-gray-400">
              No completed steps to resubmit for this workflow.
            </div>
          )}
          {RESUBMITTABLE_STEPS.filter((s) =>
            bounceableSteps.includes(s.type),
          ).map((s) => {
            const selected = !!resubmitSteps[s.type];
            const Icon = s.icon;
            return (
              <button
                key={s.type}
                type="button"
                onClick={() =>
                  setResubmitSteps((prev) => ({
                    ...prev,
                    [s.type]: !prev[s.type],
                  }))
                }
                className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                  selected
                    ? "border-primary-400 bg-primary-50"
                    : "border-gray-200 hover:bg-gray-50"
                }`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                    selected
                      ? "bg-primary-200 text-primary-800"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  <Icon size={16} />
                </span>
                <span className="flex-1 text-sm font-medium text-gray-900">
                  {s.label}
                </span>
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${
                    selected
                      ? "border-primary-500 bg-primary-500 text-white"
                      : "border-gray-300 bg-white"
                  }`}
                >
                  {selected && <Check size={13} />}
                </span>
              </button>
            );
          })}
        </div>
        <label className="block text-xs font-medium text-gray-600 mb-2">
          Reasons
        </label>
        <ReasonChips
          severity="resubmit"
          selected={resubmitReasons}
          onToggle={toggleReason(setResubmitReasons)}
          areas={resubmitReasonAreas}
        />
        <label className="mt-4 block text-xs font-medium text-gray-600 mb-1">
          Message to the customer (optional)
        </label>
        <textarea
          value={resubmitNote}
          onChange={(e) => setResubmitNote(e.target.value)}
          placeholder="e.g. “your ID photo was blurry”"
          rows={2}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300"
        />
      </Modal>

      {/* Section: ID scan — document images + the identity data form. Hidden
          until the customer has completed the id-scan step (the check card above
          still shows "Not yet run"). The version switcher only appears once a
          SECOND submission is in — i.e. completed AND a prior snapshot exists. */}
      {idScanCompleted && (
        <Section
          title="ID scan"
          icon={<IdCard size={15} />}
          action={
            idViewingPast ? undefined : (
              <VerdictButtons
                status={idScanVerdict}
                onApprove={() =>
                  setIdScanVerdict(
                    idScanVerdict === "SUCCEEDED"
                      ? "REQUIRES_REVIEW"
                      : "SUCCEEDED",
                  )
                }
                onReject={() =>
                  setIdScanVerdict(
                    idScanVerdict === "FAILED" ? "REQUIRES_REVIEW" : "FAILED",
                  )
                }
                approveDisabled={
                  idScanVerdict !== "SUCCEEDED" &&
                  (!dataReady ||
                    !checksHaveRun ||
                    checksPending ||
                    dupBlocksApprove)
                }
                approveTitle={
                  !dataReady
                    ? "Enter name and date of birth first."
                    : !checksHaveRun
                      ? "Run checks before approving."
                      : checksPending
                        ? "Checks are still running."
                        : dupBlocksApprove
                          ? "Clear the duplicate match to approve."
                          : undefined
                }
                busy={recordStep.isPending || saveIdentity.isPending}
              />
            )
          }
        >
          {idScanSnapshots.length > 0 && (
            <VersionSwitcher
              versions={idVersionLabels}
              selected={idSelectedIdx}
              onSelect={(i) =>
                setSelectedIdVersion(i === idScanSnapshots.length ? null : i)
              }
              noun="document"
            />
          )}
          <div
            className={`grid grid-cols-1 gap-6 items-start ${
              idHasDocumentView ? "lg:grid-cols-2" : ""
            }`}
          >
            {/* Left: document images (lone passport is centered) */}
            {idHasDocumentView && (
              <div className="space-y-4">
                {idFrontUrl && (
                  <div className={!idShowBackView ? "max-w-md mx-auto" : ""}>
                    <div className="text-xs text-gray-500 mb-1.5">Front</div>
                    <ZoomImage
                      src={idFrontUrl}
                      alt="Document front"
                      maxHeight="max-h-96"
                      meta={buildFileMeta(idFrontData, idDocTypeView)}
                    />
                  </div>
                )}
                {idShowBackView && (
                  <div>
                    <div className="text-xs text-gray-500 mb-1.5">Back</div>
                    <ZoomImage
                      src={idBackUrl}
                      alt="Document back"
                      maxHeight="max-h-96"
                      meta={buildFileMeta(idBackData, idDocTypeView)}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Right: identity data form (read-only when viewing a past version) */}
            <div>
              <p className="text-xs text-gray-500 mb-4">
                {idViewingPast
                  ? "Read-only — the data captured for this past submission."
                  : "Extracted automatically when an identity provider is used. Otherwise, type what you read off the document — this feeds AML screening and the rules engine."}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {IDENTITY_VERIFICATION_FIELDS.map((f) => {
                  const value = idFieldValue(f);
                  const update = (v: string) => {
                    if (idViewingPast) return;
                    setChecksRun(false);
                    setFields((prev) => ({ ...prev, [f.key]: v }));
                  };
                  const isCountry =
                    f.key === "document_nationality" ||
                    f.key === "document_issuing_country";
                  return (
                    <div key={f.key}>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        {f.label}
                        {f.core && <span className="text-red-500"> *</span>}
                      </label>
                      {f.key === "document_sex" ? (
                        <IdentitySelect
                          value={value}
                          onChange={update}
                          options={SEX_OPTIONS}
                          disabled={idViewingPast}
                        />
                      ) : f.key === "document_type" ? (
                        <IdentitySelect
                          value={value}
                          onChange={update}
                          options={DOC_TYPE_OPTIONS}
                          disabled={idViewingPast}
                        />
                      ) : isCountry ? (
                        <IdentitySelect
                          value={value}
                          onChange={update}
                          options={COUNTRY_OPTIONS}
                          disabled={idViewingPast}
                        />
                      ) : (
                        <input
                          type={f.type === "DATE" ? "date" : "text"}
                          value={value}
                          onChange={(e) => update(e.target.value)}
                          disabled={idViewingPast}
                          className="w-full h-10 px-3 text-sm border border-gray-200 rounded-lg bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 disabled:bg-gray-50 disabled:text-gray-500"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
              {!idViewingPast && (
                <div className="flex items-center gap-3 mt-4">
                  <button
                    type="button"
                    onClick={handleRunChecks}
                    disabled={
                      !dataReady ||
                      runChecks.isPending ||
                      saveIdentity.isPending
                    }
                    title={
                      !dataReady
                        ? "Fill in name and date of birth first."
                        : "Save the data and run AML, fraud and rules-engine checks."
                    }
                    className="inline-flex items-center gap-1.5 text-sm py-2 px-3 rounded-lg border border-primary-300 bg-primary-100 hover:bg-primary-200 text-primary-900 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {runChecks.isPending ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Play size={14} />
                    )}
                    {runChecks.isPending
                      ? "Running…"
                      : checksHaveRun
                        ? "Re-run checks"
                        : "Run checks"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </Section>
      )}

      {/* Section: Face scan — document photo + selfie + liveness data. Switcher
          only appears once a SECOND face submission is in. */}
      {(selfieUrl || faceData.length > 0) && (
        <Section
          title="Face scan"
          icon={<ScanFace size={15} />}
          action={
            faceViewingPast ? undefined : (
              <VerdictButtons
                status={faceScanVerdict}
                onApprove={() =>
                  setFaceScanVerdict(
                    faceScanVerdict === "SUCCEEDED"
                      ? "REQUIRES_REVIEW"
                      : "SUCCEEDED",
                  )
                }
                onReject={() =>
                  setFaceScanVerdict(
                    faceScanVerdict === "FAILED" ? "REQUIRES_REVIEW" : "FAILED",
                  )
                }
                busy={recordStep.isPending}
              />
            )
          }
        >
          {faceScanSnapshots.length > 0 && (
            <VersionSwitcher
              versions={faceVersionLabels}
              selected={faceSelectedIdx}
              onSelect={(i) =>
                setSelectedFaceVersion(
                  i === faceScanSnapshots.length ? null : i,
                )
              }
              noun="face"
            />
          )}
          {(faceDocPhotoUrl || faceSelfieUrl) && (
            <div
              className={`grid grid-cols-1 gap-6 ${
                faceDocPhotoUrl && faceSelfieUrl ? "lg:grid-cols-2" : ""
              }`}
            >
              {faceDocPhotoUrl && (
                <div>
                  <div className="text-xs text-gray-500 mb-1.5">
                    Document photo
                  </div>
                  <ZoomImage
                    src={faceDocPhotoUrl}
                    alt="Document photo"
                    maxHeight="max-h-96"
                    meta={buildFileMeta(
                      documentFront.data,
                      iv("document_type"),
                    )}
                  />
                </div>
              )}
              {faceSelfieUrl && (
                <div>
                  <div className="text-xs text-gray-500 mb-1.5">
                    {faceViewingPast
                      ? "Selfie"
                      : "Selfie — compare against the document photo"}
                  </div>
                  <ZoomImage
                    src={faceSelfieUrl}
                    alt="Selfie"
                    maxHeight="max-h-96"
                    meta={buildFileMeta(faceSelfieData)}
                  />
                </div>
              )}
            </div>
          )}
          {faceSignalsView.length > 0 && (
            <div
              className={`divide-y divide-gray-100 ${
                faceDocPhotoUrl || faceSelfieUrl
                  ? "mt-6 pt-5 border-t border-gray-100"
                  : ""
              }`}
            >
              {faceSignalsView.map((s) => (
                <SignalRow key={s.label} {...s} />
              ))}
            </div>
          )}
        </Section>
      )}

      {/* Section: Proof of residence — image (left) + address data (right). No
          verdict (POR doesn't gate approval); the version switcher appears once
          a SECOND POR submission is in. */}
      {(proofOfResidence.data?.url || hasAddress) && (
        <Section title="Proof of residence" icon={<FileText size={15} />}>
          {porSnapshots.length > 0 && (
            <VersionSwitcher
              versions={porVersionLabels}
              selected={porSelectedIdx}
              onSelect={(i) =>
                setSelectedPorVersion(i === porSnapshots.length ? null : i)
              }
              noun="address document"
            />
          )}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {porImageUrl ? (
              <ZoomImage
                src={porImageUrl}
                alt="Proof of residence"
                fallbackHref={porImageUrl}
                maxHeight="max-h-96"
                meta={buildFileMeta(porImageData, porDocTypeView)}
              />
            ) : (
              <div className="text-sm text-gray-400">No document uploaded.</div>
            )}
            <div>
              {porViewingPast && (
                <div className="mb-3 inline-flex items-center gap-1.5 rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-500">
                  <Clock size={12} /> Past submission — read-only
                </div>
              )}
              {porDocTypeView && (
                <div className="mb-3">
                  <div className="text-xs text-gray-500">Document type</div>
                  <div className="text-sm text-gray-900">
                    {humanize(porDocTypeView)}
                  </div>
                </div>
              )}
              {porHasAddress ? (
                <div className="space-y-2 text-sm">
                  <AddressRow label="Street" value={porStreet} />
                  <AddressRow label="City" value={porCity} />
                  <AddressRow label="Postal code" value={porPostal} />
                  <AddressRow
                    label="Country"
                    value={
                      porCountry ? <CountryFlagName code={porCountry} /> : ""
                    }
                  />
                </div>
              ) : (
                <div className="text-sm text-gray-400">
                  No address captured.
                </div>
              )}
            </div>
          </div>
        </Section>
      )}

      {/* Section: Contact & session */}
      {facts.length > 0 && (
        <Section title="Contact & session" icon={<Mail size={15} />}>
          <div className="-mt-2 divide-y divide-gray-100">
            {facts.map((s) => (
              <SignalRow key={s.label} {...s} />
            ))}
          </div>
        </Section>
      )}
    </div>
  );
};

// ── Sumsub-style hover magnifier + click-to-open lightbox ────────────────────
// Hover scales the image toward the cursor; clicking opens a full-screen modal
// so the whole image can be inspected large (Escape or backdrop click closes).
const ZoomImage = ({
  src,
  alt,
  fallbackHref,
  maxHeight = "max-h-72",
  meta,
}: {
  src: string;
  alt: string;
  fallbackHref?: string;
  maxHeight?: string;
  meta?: Array<{ label: string; value: string }>;
}) => {
  const [origin, setOrigin] = useState("50% 50%");
  const [zoomed, setZoomed] = useState(false);
  const [broken, setBroken] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModalOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalOpen]);

  if (broken && fallbackHref) {
    return (
      <a
        href={fallbackHref}
        target="_blank"
        rel="noreferrer"
        className="block text-sm text-primary-700 hover:underline"
      >
        Open uploaded file
      </a>
    );
  }

  return (
    <>
      <div
        className={`relative overflow-hidden rounded-lg border border-gray-200 bg-gray-50 cursor-zoom-in ${maxHeight}`}
        onClick={() => setModalOpen(true)}
        onMouseEnter={() => setZoomed(true)}
        onMouseLeave={() => setZoomed(false)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width) * 100;
          const y = ((e.clientY - rect.top) / rect.height) * 100;
          setOrigin(`${x}% ${y}%`);
        }}
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          onError={() => setBroken(true)}
          style={{
            transformOrigin: origin,
            transform: zoomed ? "scale(2.5)" : "scale(1)",
          }}
          className={`w-full ${maxHeight} object-contain transition-transform duration-100 ease-out`}
        />
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
          onClick={() => setModalOpen(false)}
        >
          {/* Fixed-size frame so the modal looks the same regardless of how
              large or small the underlying image is. */}
          <div
            className="flex h-[80vh] w-[min(90vw,56rem)] flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-2.5">
              <div className="truncate text-sm font-medium text-gray-900">
                {alt}
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Close"
                className="text-gray-400 hover:text-gray-700"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex flex-1 items-center justify-center overflow-hidden bg-gray-50 p-4">
              <img
                src={src}
                alt={alt}
                className="max-h-full max-w-full object-contain"
              />
            </div>
            {meta && meta.length > 0 && (
              <div className="flex flex-wrap gap-x-6 gap-y-1 border-t border-gray-200 px-4 py-2.5 text-xs">
                {meta.map((m) => (
                  <span key={m.label}>
                    <span className="text-gray-400">{m.label}: </span>
                    <span className="text-gray-900">{m.value}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

const TONE_TEXT: Record<Tone, string> = {
  good: "text-primary-600",
  warn: "text-yellow-600",
  bad: "text-red-600",
  neutral: "text-gray-400",
};

const SignalRow = ({
  tone,
  label,
  value,
}: {
  tone: Tone;
  label: string;
  value: ReactNode;
}) => (
  <div className="flex items-center justify-between gap-3 py-2 text-sm">
    <span className="inline-flex items-center gap-2 text-gray-600">
      <span
        className={`h-1.5 w-1.5 rounded-full bg-current ${TONE_TEXT[tone]}`}
      />
      {label}
    </span>
    <span className="text-gray-900 text-right">{value}</span>
  </div>
);

// Per-document approve/reject control shown in the ID scan / Face scan section
// headers. The current verdict is the solid (filled) button.
const VerdictButtons = ({
  status,
  onApprove,
  onReject,
  approveDisabled,
  approveTitle,
  busy,
}: {
  status: StepStatus | undefined;
  onApprove: () => void;
  onReject: () => void;
  approveDisabled?: boolean;
  approveTitle?: string;
  busy?: boolean;
}) => (
  <div className="flex items-center gap-1.5">
    <button
      type="button"
      onClick={onApprove}
      disabled={busy || approveDisabled}
      title={approveTitle}
      className={`inline-flex items-center gap-1 text-xs font-medium py-1.5 px-2.5 rounded-lg border transition disabled:opacity-50 disabled:cursor-not-allowed ${
        status === "SUCCEEDED"
          ? "border-emerald-500 bg-emerald-500 text-white"
          : "border-emerald-300 text-emerald-700 hover:bg-emerald-50"
      }`}
    >
      <Check size={13} /> {status === "SUCCEEDED" ? "Approved" : "Approve"}
    </button>
    <button
      type="button"
      onClick={onReject}
      disabled={busy}
      className={`inline-flex items-center gap-1 text-xs font-medium py-1.5 px-2.5 rounded-lg border transition disabled:opacity-50 ${
        status === "FAILED"
          ? "border-red-500 bg-red-500 text-white"
          : "border-red-300 text-red-700 hover:bg-red-50"
      }`}
    >
      <X size={13} /> {status === "FAILED" ? "Rejected" : "Reject"}
    </button>
  </div>
);

// A titled sub-area inside the Integrity signals card (duplicate detection,
// scenarios). Optional status pill on the right of the header.
const SubBlock = ({
  title,
  badge,
  children,
}: {
  title: string;
  badge?: ReactNode;
  children: ReactNode;
}) => (
  <div>
    <div className="flex items-center justify-between mb-2">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {title}
      </div>
      {badge}
    </div>
    {children}
  </div>
);

const RESULT_PILL: Record<"good" | "warn" | "bad", string> = {
  good: "bg-emerald-50 text-emerald-700",
  warn: "bg-yellow-100 text-yellow-700",
  bad: "bg-red-100 text-red-700",
};
const RESULT_PILL_ICON: Record<"good" | "warn" | "bad", ReactNode> = {
  good: <Check size={12} />,
  warn: <Clock size={12} />,
  bad: <AlertTriangle size={12} />,
};
const ResultPill = ({
  tone,
  children,
}: {
  tone: "good" | "warn" | "bad";
  children: ReactNode;
}) => (
  <span
    className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded ${RESULT_PILL[tone]}`}
  >
    {RESULT_PILL_ICON[tone]} {children}
  </span>
);

// Maps a step status to a result pill (used for AML / fraud rows).
const StepResultPill = ({ status }: { status: StepStatus }) => {
  if (status === "SUCCEEDED")
    return <ResultPill tone="good">Passed</ResultPill>;
  if (status === "FAILED") return <ResultPill tone="bad">Failed</ResultPill>;
  if (status === "IN_PROGRESS")
    return <ResultPill tone="warn">Running</ResultPill>;
  if (status === "REQUIRES_REVIEW")
    return <ResultPill tone="warn">Needs review</ResultPill>;
  return <ResultPill tone="warn">Not run</ResultPill>;
};

// Locale (language code) → representative country flag. The locale is the
// language the customer ran the widget in, not a country, so we pick the most
// recognizable flag per language.
const LOCALE_FLAG: Record<string, string> = {
  en: "gb",
  sl: "si",
  de: "de",
  fr: "fr",
  es: "es",
};

const LocaleFlag = ({ locale }: { locale: string }) => {
  const cc = LOCALE_FLAG[locale.slice(0, 2).toLowerCase()];
  return (
    <span className="inline-flex items-center gap-1.5">
      {cc && (
        <span
          className={`fi fi-${cc} inline-block h-3 w-4 rounded-sm shadow-[0_0_0_1px_rgba(0,0,0,0.04)]`}
        />
      )}
      {locale.toUpperCase()}
    </span>
  );
};

// Country code (ISO alpha-2) → flag + full display name.
const CountryFlagName = ({ code }: { code: string }) => {
  const cc = code.trim().toUpperCase();
  if (!cc) return null;
  const name = COUNTRIES.find((c) => c.code === cc)?.name ?? code;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`fi fi-${cc.toLowerCase()} inline-block h-3 w-4 rounded-sm shadow-[0_0_0_1px_rgba(0,0,0,0.04)]`}
      />
      {name}
    </span>
  );
};

const AddressRow = ({ label, value }: { label: string; value: ReactNode }) =>
  value ? (
    <div className="flex justify-between gap-3">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-900 text-right">{value}</span>
    </div>
  ) : null;

const BackLink = () => (
  <Link
    to="/kyc-review"
    className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
  >
    <ArrowLeft size={16} /> Back to review queue
  </Link>
);

// Mirrors the review queue's STATUS_BADGE so the detail header and the table
// read identically.
// Mirrors the review table's STATUS_BADGE (same colors, icons, labels).
const STATUS_PILL: Record<
  ReviewQueueStatus,
  { cls: string; icon: ReactNode; label: string }
> = {
  needs_review: {
    cls: "bg-yellow-100 text-yellow-700",
    icon: <AlertTriangle size={12} />,
    label: "Needs review",
  },
  resubmission: {
    cls: "bg-orange-100 text-orange-700",
    icon: <RotateCcw size={12} />,
    label: "Resubmission",
  },
  in_progress: {
    cls: "bg-gray-100 text-gray-500",
    icon: <Clock size={12} />,
    label: "In progress",
  },
  approved: {
    cls: "bg-primary-100 text-primary-700",
    icon: <Check size={12} />,
    label: "Approved",
  },
  rejected: {
    cls: "bg-red-100 text-red-700",
    icon: <X size={12} />,
    label: "Rejected",
  },
};

const StatusPill = ({ status }: { status: ReviewQueueStatus }) => (
  <span
    className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded ${STATUS_PILL[status].cls}`}
  >
    {STATUS_PILL[status].icon} {STATUS_PILL[status].label}
  </span>
);

// ── helpers ──────────────────────────────────────────────────────────────────
const computeAge = (dob: string): number | null => {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age >= 0 && age < 130 ? age : null;
};

const expiryInfo = (expiry: string): { tone: Tone; text: string } | null => {
  if (!expiry) return null;
  const d = new Date(expiry);
  if (Number.isNaN(d.getTime())) return null;
  const days = Math.round((d.getTime() - Date.now()) / 86_400_000);
  if (days < 0)
    return { tone: "bad", text: `Expired ${Math.abs(days)} days ago` };
  if (days < 90) return { tone: "warn", text: `Expires in ${days} days` };
  return { tone: "good", text: `Valid · expires ${expiry}` };
};

const fmtDate = (value: string): string => {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : formatDate(value);
};

// "RENT_AGREEMENT" → "Rent agreement"
const humanize = (v: string): string =>
  v
    ? v.charAt(0).toUpperCase() + v.slice(1).toLowerCase().replace(/_/g, " ")
    : v;

// Rich check results the backend stores as JSON-string attributes.
type DuplicateMatch = {
  customerId: string;
  sessionId: string;
  name: string;
  on: "document" | "name+dob";
};
type RuleEvaluation = {
  scenarioId: string;
  name: string;
  matched: boolean;
  actions: Array<{ type: string; value: string; enabled: boolean }>;
  conditions: Array<{
    attribute: string;
    operator: string;
    value: string;
    passed: boolean;
  }>;
};

const SCENARIO_ACTION_LABELS: Record<string, string> = {
  set_customer_status: "Status",
  set_customer_risk_level: "Risk level",
  assign_tag: "Tag",
};
const STATUS_RECO_TONE: Record<string, string> = {
  approved: "text-primary-700",
  rejected: "text-red-700",
  flagged: "text-orange-700",
  pending_review: "text-gray-700",
};

// A matched scenario's actions, split to teach the model at a glance:
// `set_customer_status` is a RECOMMENDATION the officer decides on (manual
// review); risk/tag are metadata that auto-apply. (Wiring lands in the
// customers/actions phase — until then this is informational.)
const ScenarioActionSummary = ({
  actions,
}: {
  actions: Array<{ type: string; value: string }>;
}) => {
  const statusAction = actions.find((a) => a.type === "set_customer_status");
  const others = actions.filter((a) => a.type !== "set_customer_status");
  if (!statusAction && others.length === 0) return null;
  return (
    <div className="mt-2.5 space-y-1 border-t border-gray-100 pt-2.5 text-xs">
      {statusAction && (
        <div className="flex items-center gap-1.5">
          <span className="text-gray-400">Recommended</span>
          <span
            className={`font-medium ${STATUS_RECO_TONE[statusAction.value] ?? "text-gray-800"}`}
          >
            {humanize(statusAction.value)}
          </span>
        </div>
      )}
      {others.length > 0 && (
        <div className="flex items-start gap-1.5">
          <span className="shrink-0 text-gray-400">Auto-applies</span>
          <span className="text-gray-700">
            {others
              .map(
                (a) =>
                  `${SCENARIO_ACTION_LABELS[a.type] ?? humanize(a.type)} → ${a.value}`,
              )
              .join(", ")}
          </span>
        </div>
      )}
    </div>
  );
};

const parseJsonAttr = <T,>(raw: string | undefined, fallback: T): T => {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

// "identity_verification.age" → "age" (last dot-segment, underscores spaced).
const attrLabel = (attribute: string): string =>
  (attribute.split(".").pop() ?? attribute).replace(/_/g, " ");

const OP_SYMBOL: Record<string, string> = {
  eq: "=",
  neq: "≠",
  gt: ">",
  lt: "<",
  gte: "≥",
  lte: "≤",
  in: "in",
  nin: "not in",
  contains: "contains",
};
const opSymbol = (op: string): string => OP_SYMBOL[op] ?? op;

const formatBytes = (n: number): string => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};

// Image metadata shown in the lightbox — mirrors the fields the reference
// product surfaces (media type, document type) plus what our storage gives us
// for free (size, upload time).
const buildFileMeta = (
  file: SessionFileMeta | null | undefined,
  documentType?: string,
): Array<{ label: string; value: string }> => {
  if (!file) return [];
  const meta: Array<{ label: string; value: string }> = [];
  if (file.contentType)
    meta.push({ label: "Media type", value: file.contentType });
  if (documentType)
    meta.push({ label: "Document type", value: humanize(documentType) });
  if (file.size != null)
    meta.push({ label: "File size", value: formatBytes(file.size) });
  if (file.uploadedAt)
    meta.push({
      label: "Uploaded",
      value: formatDateTime(file.uploadedAt),
    });
  return meta;
};
