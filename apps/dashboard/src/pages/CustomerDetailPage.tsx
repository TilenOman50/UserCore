import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Check,
  Copy,
  ExternalLink,
  FileText,
  Fingerprint,
  Flag,
  Globe,
  IdCard,
  Mail,
  MapPin,
  Phone,
  Play,
  RotateCcw,
  ScanFace,
  Shield,
  ShieldAlert,
  User,
  Users,
  X,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";

import {
  IDENTITY_VERIFICATION_FIELDS,
  identityAttributeKey,
} from "@usercore/shared-types";

import { ConfirmDialog } from "../components/ConfirmDialog";
import {
  RISK_BADGE,
  RISK_LABELS,
  RiskSelectBadge,
  STATUS_BADGE,
  STATUS_ICON,
  STATUS_LABELS,
  StatusSelectBadge,
} from "../components/CustomerClassification";
import { countryName } from "../lib/countries";
import { formatDate, formatDateTime } from "../lib/dates";
import { useArchiveCustomer, useCustomer } from "../lib/hooks/useCustomers";
import { useMembers } from "../lib/hooks/useMembers";
import {
  useSessionFileUrl,
  useWorkflowSession,
} from "../lib/hooks/useWorkflowSessions";
import { useWorkspace } from "../lib/workspaceContext";

// ── display maps ─────────────────────────────────────────────────────────────
const DOC_TYPE_LABELS: Record<string, string> = {
  PASSPORT: "Passport",
  ID_CARD: "ID card",
  DRIVER_LICENSE: "Driver license",
};
const SEX_LABELS: Record<string, string> = {
  M: "Male",
  F: "Female",
  X: "Other / unspecified",
};

type Tone = "good" | "warn" | "bad" | "neutral";
const TONE_DOT: Record<Tone, string> = {
  good: "bg-primary-500",
  warn: "bg-orange-500",
  bad: "bg-red-500",
  neutral: "bg-gray-300",
};
const TIMELINE_DOT: Record<Tone | "info", string> = {
  neutral: "bg-gray-100 text-gray-500",
  info: "bg-blue-100 text-blue-600",
  good: "bg-primary-100 text-primary-700",
  bad: "bg-red-100 text-red-600",
  warn: "bg-orange-100 text-orange-600",
};

// Rich check results stored as JSON-string attributes by the backend.
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

// ── small helpers ────────────────────────────────────────────────────────────
const humanize = (v: string) =>
  v
    ? v.charAt(0).toUpperCase() + v.slice(1).toLowerCase().replace(/_/g, " ")
    : v;
const titleCase = (s?: string) =>
  s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ") : "";
const yesNo = (s?: string) =>
  s === "true" ? "Yes" : s === "false" ? "No" : "";
const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("") || "?";
const fmtDateOnly = (v: string) => {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : formatDate(v);
};
const fmtDateTime = (iso: string | null) => (iso ? formatDateTime(iso) : "—");
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
const parseJsonAttr = <T,>(raw: string | undefined, fallback: T): T => {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};
const formatBytes = (n: number) => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};

// ── shared bits ──────────────────────────────────────────────────────────────
const Card = ({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
}) => (
  <section className="rounded-xl border border-gray-200 bg-white p-5">
    <div className="mb-4 flex items-center gap-2">
      {icon && (
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
          {icon}
        </span>
      )}
      <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
    </div>
    {children}
  </section>
);

const Field = ({ label, value }: { label: string; value: ReactNode }) => (
  <div>
    <div className="text-xs font-medium text-gray-500">{label}</div>
    <div className="mt-0.5 text-sm text-gray-900">{value || "—"}</div>
  </div>
);

// label / value list driven by [label, value] tuples. Every row is shown —
// missing values render as "—" (via Field) rather than being dropped.
const KeyValues = ({ rows }: { rows: Array<[string, ReactNode]> }) => (
  <div className="grid grid-cols-2 gap-4">
    {rows.map(([label, value]) => (
      <Field key={label} label={label} value={value} />
    ))}
  </div>
);

const SignalRow = ({
  tone,
  label,
  value,
}: {
  tone: Tone;
  label: string;
  value: ReactNode;
}) => (
  <div className="flex items-center justify-between gap-3 py-1.5">
    <span className="flex items-center gap-2 text-sm text-gray-600">
      <span className={`h-2 w-2 rounded-full ${TONE_DOT[tone]}`} />
      {label}
    </span>
    <span className="text-sm font-medium text-gray-900">{value}</span>
  </div>
);

const CopyButton = ({ value }: { value: string }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      className="text-gray-300 transition-colors hover:text-gray-600"
      title="Copy"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
    </button>
  );
};

// Click-to-enlarge image (documents / proof of residence).
const ZoomImage = ({
  src,
  alt,
  meta,
}: {
  src: string;
  alt: string;
  meta?: Array<{ label: string; value: string }>;
}) => {
  const [open, setOpen] = useState(false);
  const [broken, setBroken] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  if (broken)
    return (
      <a
        href={src}
        target="_blank"
        rel="noreferrer"
        className="text-sm text-primary-700 hover:underline"
      >
        Open uploaded file
      </a>
    );
  return (
    <>
      <img
        src={src}
        alt={alt}
        onError={() => setBroken(true)}
        onClick={() => setOpen(true)}
        className="max-h-72 w-full cursor-zoom-in rounded-lg border border-gray-200 bg-gray-50 object-contain"
      />
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex h-[80vh] w-[min(90vw,56rem)] flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-2.5">
              <span className="truncate text-sm font-medium text-gray-900">
                {alt}
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-700"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex flex-1 items-center justify-center overflow-auto bg-gray-50 p-4">
              <img src={src} alt={alt} className="max-h-full max-w-full" />
            </div>
            {meta && meta.length > 0 && (
              <div className="grid grid-cols-2 gap-2 border-t border-gray-200 px-4 py-3 text-xs sm:grid-cols-4">
                {meta.map((m) => (
                  <div key={m.label}>
                    <div className="text-gray-400">{m.label}</div>
                    <div className="text-gray-800">{m.value}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

const fileMeta = (
  file:
    | {
        contentType: string | null;
        size: number | null;
        uploadedAt: string | null;
      }
    | null
    | undefined,
) => {
  if (!file) return [];
  const meta: Array<{ label: string; value: string }> = [];
  if (file.contentType)
    meta.push({ label: "Media type", value: file.contentType });
  if (file.size != null)
    meta.push({ label: "File size", value: formatBytes(file.size) });
  if (file.uploadedAt)
    meta.push({ label: "Uploaded", value: formatDateTime(file.uploadedAt) });
  return meta;
};

const BackLink = () => (
  <Link
    to="/customers"
    className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"
  >
    <ArrowLeft size={16} /> All customers
  </Link>
);

// flag-icons only ships alpha-2 flags; alpha-3 codes (iDenfy) render nothing.
const CountryFlag = ({ code }: { code: string | null }) => {
  if (!code) return null;
  const cc = code.trim().toUpperCase();
  if (cc.length !== 2) return null;
  return (
    <span
      title={countryName(cc)}
      className={`fi fi-${cc.toLowerCase()} inline-block h-4 w-6 shrink-0 rounded-sm shadow-[0_0_0_1px_rgba(0,0,0,0.04)]`}
    />
  );
};

// Country value with its flag beside the name (flag only for alpha-2 codes).
const CountryValue = ({ code }: { code: string | null }) => {
  if (!code) return null;
  return (
    <span className="inline-flex items-center gap-1.5">
      <CountryFlag code={code} />
      {countryName(code)}
    </span>
  );
};

const TABS = [
  { key: "overview", label: "Overview", icon: <User size={15} /> },
  { key: "kyc", label: "KYC data", icon: <Fingerprint size={15} /> },
  { key: "screening", label: "Screening", icon: <ShieldAlert size={15} /> },
  { key: "activity", label: "Activity", icon: <Activity size={15} /> },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export const CustomerDetailPage = () => {
  const { customerId } = useParams<{ customerId: string }>();
  const { organization } = useWorkspace();
  const customerQuery = useCustomer(customerId ?? null);
  const archive = useArchiveCustomer();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [tab, setTab] = useState<TabKey>("overview");

  // Map officer ids on the activity timeline to their emails.
  const membersQuery = useMembers(organization.id, { page: 1, limit: 100 });
  const resolveActor = (id: string | null | undefined): string | null => {
    if (!id) return null;
    for (const m of membersQuery.data?.items ?? []) {
      if (m.userId === id || m.memberId === id) return m.userEmail;
    }
    return id;
  };

  const sessionId = customerQuery.data?.kycSessionId ?? null;
  const sessionQuery = useWorkflowSession(sessionId);
  // The "face_video" kind actually holds a selfie still (JPG).
  const faceSelfie = useSessionFileUrl(sessionId, "face_video");
  const docFront = useSessionFileUrl(sessionId, "document_front");
  const docBack = useSessionFileUrl(sessionId, "document_back");
  const proofOfResidence = useSessionFileUrl(sessionId, "proof_of_residence");

  const attrMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of sessionQuery.data?.attributes ?? [])
      m.set(a.attribute, a.value);
    return m;
  }, [sessionQuery.data]);

  const c = customerQuery.data;

  if (customerQuery.isLoading) {
    return (
      <div className="mx-auto max-w-6xl p-8">
        <BackLink />
        <div className="text-sm text-gray-500">Loading…</div>
      </div>
    );
  }
  if (!c) {
    return (
      <div className="mx-auto max-w-6xl p-8">
        <BackLink />
        <div className="text-sm text-gray-500">Customer not found.</div>
      </div>
    );
  }

  const iv = (suffix: string) =>
    attrMap.get(identityAttributeKey(suffix)) ?? "";
  const name =
    [iv("document_first_name"), iv("document_last_name")]
      .filter(Boolean)
      .join(" ") || [c.firstName, c.lastName].filter(Boolean).join(" ");
  const isArchived = !!c.archivedAt;

  const handleArchive = async () => {
    await archive.mutateAsync({
      customerId: c.customerId,
      archived: !isArchived,
    });
    setConfirmOpen(false);
  };

  return (
    <div className="mx-auto max-w-6xl p-8">
      <BackLink />

      {/* Header */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <SelfieAvatar
              url={faceSelfie.data?.url}
              fallback={initialsOf(name || c.customerId)}
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold text-gray-900">
                  {name || c.customerId}
                </h1>
                <CountryFlag code={c.country} />
                <StatusSelectBadge
                  customerId={c.customerId}
                  status={c.kycStatus}
                />
                <RiskSelectBadge
                  customerId={c.customerId}
                  riskLevel={c.riskLevel}
                />
                {isArchived && (
                  <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                    Archived
                  </span>
                )}
              </div>
              <div className="mt-1 flex items-center gap-1.5 font-mono text-xs text-gray-400">
                {c.customerId}
                <CopyButton value={c.customerId} />
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {sessionId && (
              <Link
                to={`/kyc-review/${sessionId}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <ExternalLink size={14} /> KYC session
              </Link>
            )}
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              disabled={archive.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {isArchived ? (
                <>
                  <ArchiveRestore size={14} /> Restore
                </>
              ) : (
                <>
                  <Archive size={14} /> Archive
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === t.key
                ? "border-primary-500 text-primary-700"
                : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <OverviewTab customer={c} iv={iv} attrMap={attrMap} />
      )}
      {tab === "kyc" && (
        <KycTab
          iv={iv}
          attrMap={attrMap}
          hasSession={!!sessionId}
          faceUrl={faceSelfie.data?.url}
          faceMeta={fileMeta(faceSelfie.data)}
          docFront={docFront.data}
          docBack={docBack.data}
          por={proofOfResidence.data}
        />
      )}
      {tab === "screening" && (
        <ScreeningTab attrMap={attrMap} hasSession={!!sessionId} />
      )}
      {tab === "activity" && (
        <ActivityTab
          events={sessionQuery.data?.events ?? []}
          sessionCreatedAt={sessionQuery.data?.session.createdAt}
          registeredAt={c.createdAt}
          resolveActor={resolveActor}
        />
      )}

      <ConfirmDialog
        open={confirmOpen}
        title={isArchived ? "Restore customer" : "Archive customer"}
        message={
          isArchived
            ? "Restore this customer to the active list?"
            : "Archive this customer? They will be hidden from the default customers view but kept for audit. You can restore them anytime."
        }
        confirmLabel={isArchived ? "Restore" : "Archive"}
        busy={archive.isPending}
        onConfirm={handleArchive}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
};

// Profile avatar = the selfie still (a JPG); falls back to initials when
// there's no face capture. Clicking a real selfie opens it enlarged (the
// initials fallback isn't clickable).
const SelfieAvatar = ({
  url,
  fallback,
}: {
  url: string | undefined;
  fallback: string;
}) => {
  const [broken, setBroken] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!url || broken)
    return (
      <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-primary-200">
        <span className="text-2xl font-semibold text-primary-700">
          {fallback}
        </span>
      </div>
    );
  return (
    <>
      <img
        src={url}
        alt="Selfie"
        onError={() => setBroken(true)}
        onClick={() => setOpen(true)}
        className="h-24 w-24 shrink-0 cursor-zoom-in rounded-full border border-gray-200 object-cover"
      />
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
          onClick={() => setOpen(false)}
        >
          <img
            src={url}
            alt="Selfie"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[80vh] max-w-[min(90vw,32rem)] rounded-xl object-contain shadow-2xl"
          />
        </div>
      )}
    </>
  );
};

// ── Overview ─────────────────────────────────────────────────────────────────
const OverviewTab = ({
  customer: c,
  iv,
  attrMap,
}: {
  customer: NonNullable<ReturnType<typeof useCustomer>["data"]>;
  iv: (s: string) => string;
  attrMap: Map<string, string>;
}) => {
  const dob = iv("date_of_birth") || c.dateOfBirth || "";
  const age = computeAge(dob);
  const nationality = iv("document_nationality") || c.nationality || "";
  const country = iv("document_issuing_country") || c.country || "";
  const email = attrMap.get("contact_information.email") ?? "";
  const phone = attrMap.get("contact_information.phone") ?? "";

  // Quick risk signals derived from the screening checks.
  const amlStatus = attrMap.get("aml_screening.match_status");
  const fraudScore = attrMap.get("fraud_detection.fraud_score");
  const dupFound = attrMap.get("duplicate_detection.match_found") === "true";
  const liveness = attrMap.get("identity_verification.liveness_passed");

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card title="Identity" icon={<User size={15} />}>
        <KeyValues
          rows={[
            [
              "Full name",
              [iv("document_first_name"), iv("document_last_name")]
                .filter(Boolean)
                .join(" ") ||
                [c.firstName, c.lastName].filter(Boolean).join(" "),
            ],
            [
              "Date of birth",
              dob
                ? `${fmtDateOnly(dob)}${age != null ? ` · ${age} yrs` : ""}`
                : "",
            ],
            ["Sex", SEX_LABELS[iv("document_sex")] ?? iv("document_sex")],
            [
              "Nationality",
              nationality ? <CountryValue code={nationality} /> : "",
            ],
            [
              "Document",
              iv("document_type")
                ? (DOC_TYPE_LABELS[iv("document_type")] ??
                  humanize(iv("document_type")))
                : "",
            ],
            ["Document number", iv("document_number")],
          ]}
        />
      </Card>

      <Card title="Contact & address" icon={<MapPin size={15} />}>
        <KeyValues
          rows={[
            [
              "Email",
              email ? (
                <span className="inline-flex items-center gap-1.5">
                  <Mail size={12} className="text-gray-400" /> {email}
                </span>
              ) : (
                ""
              ),
            ],
            [
              "Phone",
              phone ? (
                <span className="inline-flex items-center gap-1.5">
                  <Phone size={12} className="text-gray-400" /> {phone}
                </span>
              ) : (
                ""
              ),
            ],
            ["Address", iv("address") || c.address || ""],
            ["City", c.city || ""],
            ["Country", country ? <CountryValue code={country} /> : ""],
          ]}
        />
      </Card>

      <Card title="Verification" icon={<Shield size={15} />}>
        <KeyValues
          rows={[
            [
              "KYC status",
              <span
                key="s"
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[c.kycStatus]}`}
              >
                {STATUS_ICON[c.kycStatus]}
                {STATUS_LABELS[c.kycStatus]}
              </span>,
            ],
            [
              "Risk level",
              c.riskLevel ? (
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${RISK_BADGE[c.riskLevel]}`}
                >
                  {RISK_LABELS[c.riskLevel]}
                </span>
              ) : (
                "Unassessed"
              ),
            ],
            ["Registered", fmtDateTime(c.createdAt)],
            ["KYC completed", fmtDateTime(c.kycCompletedAt)],
          ]}
        />
      </Card>

      <Card title="Risk signals" icon={<ShieldAlert size={15} />}>
        <div className="divide-y divide-gray-100">
          <SignalRow
            tone={
              amlStatus === "true_positive"
                ? "bad"
                : amlStatus === "potential_match"
                  ? "warn"
                  : amlStatus
                    ? "good"
                    : "neutral"
            }
            label="AML screening"
            value={amlStatus ? titleCase(amlStatus) : "Not run"}
          />
          <SignalRow
            tone={
              fraudScore === ""
                ? "neutral"
                : Number(fraudScore) >= 75
                  ? "bad"
                  : Number(fraudScore) >= 50
                    ? "warn"
                    : "good"
            }
            label="Fraud score"
            value={fraudScore !== "" ? fraudScore : "Not run"}
          />
          <SignalRow
            tone={dupFound ? "warn" : "good"}
            label="Duplicate detection"
            value={
              attrMap.has("duplicate_detection.match_found")
                ? dupFound
                  ? "Match found"
                  : "No match"
                : "Not run"
            }
          />
          <SignalRow
            tone={
              liveness === "true"
                ? "good"
                : liveness === "false"
                  ? "bad"
                  : "neutral"
            }
            label="Liveness"
            value={liveness ? yesNo(liveness) : "—"}
          />
        </div>
      </Card>
    </div>
  );
};

// ── KYC data ─────────────────────────────────────────────────────────────────
const KycTab = ({
  iv,
  attrMap,
  hasSession,
  faceUrl,
  faceMeta,
  docFront,
  docBack,
  por,
}: {
  iv: (s: string) => string;
  attrMap: Map<string, string>;
  hasSession: boolean;
  faceUrl: string | undefined;
  faceMeta: Array<{ label: string; value: string }>;
  docFront: { url: string } | null | undefined;
  docBack: { url: string } | null | undefined;
  por:
    | {
        url: string;
        contentType: string | null;
        size: number | null;
        uploadedAt: string | null;
      }
    | null
    | undefined;
}) => {
  if (!hasSession) return <NoSession />;

  const fieldValue = (key: string, value: string): ReactNode => {
    if (!value) return "";
    if (key === "document_type")
      return DOC_TYPE_LABELS[value] ?? humanize(value);
    if (key === "document_sex") return SEX_LABELS[value] ?? value;
    if (key === "document_nationality" || key === "document_issuing_country")
      return <CountryValue code={value} />;
    const field = IDENTITY_VERIFICATION_FIELDS.find((f) => f.key === key);
    if (field?.type === "DATE") {
      if (key === "date_of_birth") {
        const age = computeAge(value);
        return `${fmtDateOnly(value)}${age != null ? ` · ${age} yrs` : ""}`;
      }
      return fmtDateOnly(value);
    }
    return value;
  };

  const liveness = iv("liveness_passed");
  const livenessChecks = iv("liveness_checks");
  const hasDocs = !!(docFront?.url || docBack?.url);
  const porDocType = attrMap.get("proof_of_residence.document_type") ?? "";
  const porCountry = attrMap.get("address.country") ?? "";

  return (
    <div className="space-y-6">
      {/* Identity document — images on the left, extracted data on the right. */}
      <Card title="Identity document" icon={<IdCard size={15} />}>
        <div
          className={`grid grid-cols-1 items-start gap-6 ${
            hasDocs ? "lg:grid-cols-2" : ""
          }`}
        >
          {hasDocs && (
            <div className="space-y-4">
              {docFront?.url && (
                <div>
                  <div className="mb-1.5 text-xs text-gray-500">Front</div>
                  <ZoomImage src={docFront.url} alt="Document front" />
                </div>
              )}
              {docBack?.url && (
                <div>
                  <div className="mb-1.5 text-xs text-gray-500">Back</div>
                  <ZoomImage src={docBack.url} alt="Document back" />
                </div>
              )}
            </div>
          )}
          {/* Nudge the data right + down so its top lines up with the front
              image (matching the height of the "Front" label above the image). */}
          <div className={hasDocs ? "lg:pl-4" : ""}>
            {hasDocs && (
              <div aria-hidden className="mb-1.5 hidden text-xs lg:block">
                &nbsp;
              </div>
            )}
            <KeyValues
              rows={IDENTITY_VERIFICATION_FIELDS.map((f) => [
                f.label,
                fieldValue(f.key, attrMap.get(f.attribute) ?? ""),
              ])}
            />
          </div>
        </div>
      </Card>

      <Card title="Selfie & liveness" icon={<ScanFace size={15} />}>
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
          <div>
            {faceUrl ? (
              <ZoomImage src={faceUrl} alt="Selfie" meta={faceMeta} />
            ) : (
              <p className="text-sm text-gray-400">No selfie captured.</p>
            )}
          </div>
          <div className="divide-y divide-gray-100 lg:pl-4">
            <SignalRow
              tone={
                liveness === "true"
                  ? "good"
                  : liveness === "false"
                    ? "bad"
                    : "neutral"
              }
              label="Liveness passed"
              value={liveness ? yesNo(liveness) : "—"}
            />
            {livenessChecks && (
              <SignalRow
                tone="neutral"
                label="Checks"
                value={livenessChecks.split(",").map(humanize).join(", ")}
              />
            )}
            {iv("face_status") && (
              <SignalRow
                tone="neutral"
                label="Face status"
                value={titleCase(iv("face_status"))}
              />
            )}
          </div>
        </div>
      </Card>

      {/* Proof of residence — image on the left, address data on the right. */}
      <Card title="Proof of residence" icon={<FileText size={15} />}>
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
          {por?.url ? (
            <ZoomImage
              src={por.url}
              alt="Proof of residence"
              meta={fileMeta(por)}
            />
          ) : (
            <p className="text-sm text-gray-400">
              No proof of residence uploaded.
            </p>
          )}
          <div className="lg:pl-4">
            <KeyValues
              rows={[
                ["Document type", porDocType ? humanize(porDocType) : ""],
                ["Street", attrMap.get("address.street") ?? ""],
                ["City", attrMap.get("address.city") ?? ""],
                ["Postal code", attrMap.get("address.postal_code") ?? ""],
                [
                  "Country",
                  porCountry ? <CountryValue code={porCountry} /> : "",
                ],
              ]}
            />
          </div>
        </div>
      </Card>
    </div>
  );
};

// ── Screening ────────────────────────────────────────────────────────────────
const ScreeningTab = ({
  attrMap,
  hasSession,
}: {
  attrMap: Map<string, string>;
  hasSession: boolean;
}) => {
  if (!hasSession) return <NoSession />;

  const amlRan = attrMap.has("aml_screening.match_status");
  const fraudRan = attrMap.has("fraud_detection.fraud_score");
  const dupRan = attrMap.has("duplicate_detection.match_found");
  const matches = parseJsonAttr<DuplicateMatch[]>(
    attrMap.get("duplicate_detection.matched_customers"),
    [],
  );
  const rules = parseJsonAttr<RuleEvaluation[]>(
    attrMap.get("rules_engine.evaluations"),
    [],
  );

  const fraudFlags: Array<[string, string]> = [
    ["VPN", "fraud_detection.vpn"],
    ["Tor", "fraud_detection.tor"],
    ["Proxy", "fraud_detection.proxy"],
    ["Recent abuse", "fraud_detection.recent_abuse"],
    ["Bot", "fraud_detection.bot_status"],
  ];

  if (!amlRan && !fraudRan && !dupRan && rules.length === 0)
    return (
      <Card title="Screening" icon={<ShieldAlert size={15} />}>
        <p className="text-sm text-gray-400">
          No screening checks have been run for this customer yet.
        </p>
      </Card>
    );

  return (
    <div className="space-y-6">
      {amlRan && (
        <Card title="AML screening" icon={<Shield size={15} />}>
          <KeyValues
            rows={[
              [
                "Match status",
                titleCase(attrMap.get("aml_screening.match_status")),
              ],
              [
                "Risk level",
                titleCase(attrMap.get("aml_screening.risk_level")),
              ],
              ["Total hits", attrMap.get("aml_screening.total_hits") ?? "0"],
              ["Categories", attrMap.get("aml_screening.hit_categories") ?? ""],
              ["Reference", attrMap.get("aml_screening.search_ref") ?? ""],
            ]}
          />
        </Card>
      )}

      {fraudRan && (
        <Card title="Fraud detection" icon={<Globe size={15} />}>
          <KeyValues
            rows={[
              ["Fraud score", attrMap.get("fraud_detection.fraud_score") ?? ""],
              [
                "Location",
                [
                  attrMap.get("fraud_detection.city"),
                  attrMap.get("fraud_detection.region"),
                  attrMap.get("fraud_detection.country_code"),
                ]
                  .filter(Boolean)
                  .join(", "),
              ],
              [
                "Connection",
                attrMap.get("fraud_detection.connection_type") ?? "",
              ],
              ["ISP", attrMap.get("fraud_detection.isp") ?? ""],
            ]}
          />
          <div className="mt-4 flex flex-wrap gap-2">
            {fraudFlags.map(([label, key]) => {
              const on = attrMap.get(key) === "true";
              return (
                <span
                  key={label}
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                    on ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {on ? <AlertTriangle size={11} /> : <Check size={11} />}
                  {label}
                </span>
              );
            })}
          </div>
        </Card>
      )}

      {dupRan && (
        <Card title="Duplicate detection" icon={<Users size={15} />}>
          {matches.length === 0 ? (
            <p className="text-sm text-gray-400">
              No duplicate customers found.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {matches.map((m) => (
                <li
                  key={m.customerId}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <div className="min-w-0">
                    <Link
                      to={`/customers/${encodeURIComponent(m.customerId)}`}
                      className="text-sm font-medium text-primary-700 hover:underline"
                    >
                      {m.name || m.customerId}
                    </Link>
                    <div className="font-mono text-xs text-gray-400">
                      {m.customerId}
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                    Matched on {m.on}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {rules.length > 0 && (
        <Card title="Rules engine" icon={<ShieldAlert size={15} />}>
          <div className="space-y-3">
            {rules.map((r) => (
              <div
                key={r.scenarioId}
                className="rounded-lg border border-gray-200 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-gray-900">
                    {r.name}
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                      r.matched
                        ? "bg-orange-100 text-orange-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {r.matched ? "Matched" : "No match"}
                  </span>
                </div>
                {r.matched && r.actions.length > 0 && (
                  <div className="mt-2 text-xs text-gray-600">
                    Actions:{" "}
                    {r.actions
                      .map((a) => `${humanize(a.type)} → ${a.value}`)
                      .join(", ")}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

// ── Activity ─────────────────────────────────────────────────────────────────
type WorkflowEvent = NonNullable<
  ReturnType<typeof useWorkflowSession>["data"]
>["events"][number];

const ActivityTab = ({
  events,
  sessionCreatedAt,
  registeredAt,
  resolveActor,
}: {
  events: WorkflowEvent[];
  sessionCreatedAt: string | undefined;
  registeredAt: string;
  resolveActor: (id: string | null | undefined) => string | null;
}) => {
  type Entry = {
    at: string;
    icon: ReactNode;
    tone: Tone | "info";
    title: string;
    actor?: string | null;
    detail?: ReactNode;
  };

  const entries: Entry[] = [];
  if (sessionCreatedAt)
    entries.push({
      at: sessionCreatedAt,
      icon: <Play size={13} />,
      tone: "neutral",
      title: "Verification started",
    });

  for (const e of events) {
    const d = e.detail ?? {};
    if (e.type === "decision") {
      const dec = d.decision ?? "";
      entries.push({
        at: e.occurredAt,
        icon:
          dec === "approved" ? (
            <Check size={13} />
          ) : dec === "rejected" ? (
            <X size={13} />
          ) : (
            <Flag size={13} />
          ),
        tone: dec === "approved" ? "good" : dec === "rejected" ? "bad" : "warn",
        title:
          dec === "approved"
            ? "Approved"
            : dec === "rejected"
              ? "Rejected"
              : "Flagged for review",
        actor: resolveActor(e.createdBy),
        detail:
          d.reasonCodes && d.reasonCodes.length > 0 ? (
            <div>Reasons: {d.reasonCodes.map(humanize).join(", ")}</div>
          ) : d.reason ? (
            <div>{d.reason}</div>
          ) : undefined,
      });
    } else if (e.type === "archived") {
      entries.push({
        at: e.occurredAt,
        icon: <Archive size={13} />,
        tone: "neutral",
        title: "Archived",
        actor: resolveActor(e.createdBy),
        detail: d.reason ? <div>Reason: “{d.reason}”</div> : undefined,
      });
    } else {
      const isResub = e.type === "resubmission_requested";
      entries.push({
        at: e.occurredAt,
        icon: <RotateCcw size={13} />,
        tone: "warn",
        title: isResub
          ? "Resubmission requested"
          : e.type === "reverification_requested"
            ? "Re-verification requested"
            : humanize(e.type),
        actor: resolveActor(e.createdBy),
        detail: (
          <>
            {d.steps && d.steps.length > 0 && (
              <div>Steps: {d.steps.map(humanize).join(", ")}</div>
            )}
            {d.note && <div>Note: “{d.note}”</div>}
          </>
        ),
      });
    }
  }

  entries.push({
    at: registeredAt,
    icon: <User size={13} />,
    tone: "info",
    title: "Customer profile created",
  });

  return (
    <Card title="Activity timeline" icon={<Activity size={15} />}>
      {entries.length === 0 ? (
        <p className="text-sm text-gray-400">No activity recorded.</p>
      ) : (
        <ol className="relative -mt-1">
          {entries.map((e, i) => (
            <li
              key={`${e.at}-${i}`}
              className="relative flex gap-3 pb-5 last:pb-0"
            >
              {i < entries.length - 1 && (
                <span className="absolute bottom-0 left-[13px] top-7 w-px bg-gray-200" />
              )}
              <span
                className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${TIMELINE_DOT[e.tone]}`}
              >
                {e.icon}
              </span>
              <div className="min-w-0 pt-0.5">
                <div className="text-sm font-medium text-gray-900">
                  {e.title}
                </div>
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
      )}
    </Card>
  );
};

const NoSession = () => (
  <Card title="No verification session" icon={<AlertTriangle size={15} />}>
    <p className="text-sm text-gray-400">
      This customer isn’t linked to a KYC verification session, so there’s no
      verification data to show.
    </p>
  </Card>
);
