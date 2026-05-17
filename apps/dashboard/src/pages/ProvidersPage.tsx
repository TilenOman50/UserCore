import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Lock,
  Mail,
  Pencil,
  Plug2,
  Shield,
  Sparkles,
  XCircle,
} from "lucide-react";

import { Modal } from "../components/Modal";
import { useCanManageConfig, usePlan } from "../lib/hooks/usePlan";
import {
  useDeleteProviderConfiguration,
  useProviderConfigurations,
  useUpsertProviderConfiguration,
  type ProviderConfiguration,
} from "../lib/hooks/useProviderConfigurations";
import type { ProviderShortName } from "../lib/hooks/useWorkflows";
import { useWorkspace } from "../lib/workspaceContext";

type ProviderMeta = {
  provider: ProviderShortName;
  // Original vendor name — used on the BYO card (where the customer is
  // bringing their own contract with the actual vendor).
  name: string;
  // UserCore-branded display name used on the managed card so the operator
  // sees "UserCore Identity" rather than the raw vendor — same convention as
  // the platform's `integrated*` naming.
  managedName: string;
  category: string;
  description: string;
  // Whether the provider needs key + secret (iDenfy) or just a key.
  needsSecret: boolean;
  // Path to the vendor icon SVG, served from public/. Swap in the official
  // brand SVGs from each vendor's brand-resources page when available — the
  // current files are simple placeholder marks.
  iconUrl: string;
};

const USERCORE_ICON_URL = "/icons/providers/usercore.svg";

const PROVIDERS: ProviderMeta[] = [
  {
    provider: "idenfy",
    name: "iDenfy",
    managedName: "UserCore Identity",
    category: "Identity verification",
    description:
      "Hosted ID-scan, liveness and face-match. Used as an alternative to UserCore's in-house identity flow.",
    needsSecret: true,
    iconUrl: "/icons/providers/idenfy.jpg",
  },
  {
    provider: "complyAdvantage",
    name: "ComplyAdvantage",
    managedName: "UserCore AML",
    category: "AML screening",
    description:
      "Sanctions, PEP and adverse-media screening. Reviewer decisions feed back into workflow sessions.",
    needsSecret: false,
    iconUrl: "/icons/providers/complyadvantage.png",
  },
  {
    provider: "ipQualityScore",
    name: "IPQualityScore",
    managedName: "UserCore Fraud",
    category: "Fraud detection",
    description:
      "IP intelligence and device fingerprinting. Returns a 0–100 fraud score consumed by the rules engine.",
    needsSecret: false,
    iconUrl: "/icons/providers/ipqualityscore.jpg",
  },
];

export const ProvidersPage = () => {
  const { organization } = useWorkspace();
  const canEdit = useCanManageConfig();
  const { plan, features } = usePlan();
  const orgId = organization?.id ?? null;
  const configsQuery = useProviderConfigurations(orgId);

  // Coarse-grained plan gating for the page. Per-step provider features all
  // flip together in the current plan model, so we treat them as a single
  // "providers available" flag for the managed + BYO rows. Custom integration
  // is Enterprise-only.
  const providersAllowed =
    features.providers["identity-verification"] ||
    features.providers["aml-screening"] ||
    features.providers["fraud-detection"];
  const customAllowed = plan === "ENTERPRISE";

  const byProvider = new Map<ProviderShortName, ProviderConfiguration>();
  for (const c of configsQuery.data ?? []) byProvider.set(c.provider, c);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-10">
        <h1 className="text-2xl font-bold text-gray-900">Providers</h1>
        <p className="text-sm text-gray-500 mt-1 max-w-2xl">
          UserCore-managed providers are always on and billed through your plan.
          If you&apos;d rather route checks through your own provider account
          and be billed directly, connect your credentials below.
        </p>
      </div>

      {!orgId ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 text-sm text-gray-500">
          Select an organisation to view its provider configurations.
        </div>
      ) : configsQuery.isLoading ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 text-sm text-gray-500">
          Loading…
        </div>
      ) : (
        <>
          <SectionHeader
            icon={<Shield size={16} />}
            title="Managed by UserCore"
            subtitle="Always connected, no setup required. Calls are billed as part of your plan."
            pill={!providersAllowed ? <PlanPill plan="Growth" /> : null}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
            {PROVIDERS.map((meta) => (
              <ManagedCard
                key={meta.provider}
                meta={meta}
                locked={!providersAllowed}
              />
            ))}
          </div>

          <SectionHeader
            icon={<Plug2 size={16} />}
            title="Or connect your own"
            subtitle="Use your own provider account. We'll route every check through your credentials and you'll be billed directly by the provider."
            pill={!providersAllowed ? <PlanPill plan="Growth" /> : null}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
            {PROVIDERS.map((meta) => (
              <ByoCard
                key={meta.provider}
                meta={meta}
                config={byProvider.get(meta.provider) ?? null}
                organizationId={orgId}
                canEdit={canEdit}
                locked={!providersAllowed}
              />
            ))}
          </div>

          <SectionHeader
            icon={<Sparkles size={16} />}
            title="Custom integrations"
            subtitle="Need a provider we don't support yet? Our team will scope and build the integration alongside your workspace."
            pill={!customAllowed ? <PlanPill plan="Enterprise" /> : null}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <CustomProviderCard locked={!customAllowed} canEdit={canEdit} />
          </div>
        </>
      )}
    </div>
  );
};

// Plan-tier badge — points the reviewer at which plan unlocks a section.
// Same shape as the BrandingSection pill so the chrome stays consistent.
const PlanPill = ({ plan }: { plan: "Growth" | "Enterprise" }) => (
  <span
    className={`inline-flex items-center text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${
      plan === "Enterprise"
        ? "bg-violet-100 text-violet-700"
        : "bg-blue-100 text-blue-700"
    }`}
    title={`Available on the ${plan} plan`}
  >
    {plan}
  </span>
);

const SectionHeader = ({
  icon,
  title,
  subtitle,
  pill,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  pill?: React.ReactNode;
}) => (
  <div className="mb-3">
    <div className="flex items-center gap-2 text-gray-700">
      <span className="text-gray-500">{icon}</span>
      <h2 className="text-sm font-semibold uppercase tracking-wide">{title}</h2>
      {pill}
    </div>
    <p className="text-xs text-gray-500 mt-1 max-w-2xl">{subtitle}</p>
  </div>
);

const ProviderAvatar = ({
  iconUrl,
  alt,
  poweredByIconUrl,
  poweredByAlt,
}: {
  iconUrl: string;
  alt: string;
  // Optional vendor mark overlaid on the main avatar as a small circular
  // badge — used on the managed cards to point at the underlying provider
  // ("UserCore Identity, powered by iDenfy"). Matches the same pattern
  // the platform uses on its integrated-provider cards.
  poweredByIconUrl?: string;
  poweredByAlt?: string;
}) => {
  const mainImg = (
    <img
      src={iconUrl}
      alt={alt}
      className="w-10 h-10 rounded-xl shrink-0 object-contain bg-white"
    />
  );

  if (!poweredByIconUrl) return mainImg;

  return (
    <div className="relative shrink-0">
      {mainImg}
      <img
        src={poweredByIconUrl}
        alt={poweredByAlt ?? ""}
        className="absolute -bottom-2 -right-2 w-5 h-5 rounded-full object-contain bg-white ring-2 ring-white shadow-sm"
      />
    </div>
  );
};

// Read-only card for the always-on, plan-bundled provider. With BYO now
// chosen per workflow step, this card is no longer affected by org-wide
// state — it just describes what UserCore-managed mode offers. The two
// visible states are "connected" (default) and "locked" (plan doesn't
// include external providers).
const ManagedCard = ({
  meta,
  locked,
}: {
  meta: ProviderMeta;
  locked: boolean;
}) => (
  <div
    className={`bg-white rounded-2xl border border-gray-200 p-5 flex flex-col gap-4 ${
      locked ? "opacity-60" : ""
    }`}
  >
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-2.5 min-w-0">
        <ProviderAvatar
          iconUrl={USERCORE_ICON_URL}
          alt="UserCore"
          poweredByIconUrl={meta.iconUrl}
          poweredByAlt={meta.name}
        />
        <div className="min-w-0">
          <div className="text-sm font-semibold text-gray-900 truncate">
            {meta.managedName}
          </div>
          <div className="text-[11px] uppercase tracking-wide text-gray-400">
            {meta.category}
          </div>
        </div>
      </div>
      {locked ? (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-gray-200 text-gray-600 shrink-0">
          <Lock size={11} /> Locked
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-primary-100 text-primary-700 shrink-0">
          <CheckCircle2 size={11} /> Connected
        </span>
      )}
    </div>
    <p className="text-xs text-gray-500 flex-1">{meta.description}</p>
    <div className="text-[11px] text-gray-400 inline-flex items-center gap-1">
      <Shield size={11} />
      {locked
        ? "Upgrade to use external providers."
        : "Managed by UserCore · included in your plan"}
    </div>
  </div>
);

type ByoCardProps = {
  meta: ProviderMeta;
  config: ProviderConfiguration | null;
  organizationId: string;
  canEdit: boolean;
  locked: boolean;
};

const ByoCard = ({
  meta,
  config,
  organizationId,
  canEdit,
  locked,
}: ByoCardProps) => {
  const [modalOpen, setModalOpen] = useState(false);
  // With BYO chosen per workflow step, this card only reports whether the
  // org has credentials saved — actual use happens when an operator wires
  // a step to BYO in the workflow editor.
  const isConfigured = !!config?.apiKey;

  return (
    <>
      <div
        className={`bg-white rounded-2xl border p-5 flex flex-col gap-4 ${
          isConfigured && !locked
            ? "border-primary-300 shadow-sm"
            : "border-gray-200"
        } ${locked ? "opacity-60" : ""}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <ProviderAvatar iconUrl={meta.iconUrl} alt={meta.name} />
            <div className="min-w-0">
              <div className="text-sm font-semibold text-gray-900 truncate">
                {meta.name}
              </div>
              <div className="text-[11px] uppercase tracking-wide text-gray-400">
                {meta.category}
              </div>
            </div>
          </div>
          {locked ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-gray-200 text-gray-600 shrink-0">
              <Lock size={11} /> Locked
            </span>
          ) : isConfigured ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 shrink-0">
              <CheckCircle2 size={11} /> Configured
            </span>
          ) : null}
        </div>

        <p className="text-xs text-gray-500 flex-1">{meta.description}</p>

        <button
          type="button"
          onClick={() => setModalOpen(true)}
          disabled={locked || (!canEdit && !isConfigured)}
          title={locked ? "Available on the Growth plan." : undefined}
          className={`inline-flex items-center justify-center gap-1.5 text-sm py-2 px-3 rounded-lg border disabled:opacity-50 disabled:cursor-not-allowed ${
            isConfigured
              ? "border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
              : "border-primary-300 bg-primary-100 hover:bg-primary-200 text-primary-900"
          }`}
        >
          {isConfigured ? (
            <>
              <Pencil size={14} />
              Edit credentials
            </>
          ) : (
            <>
              <Plug2 size={14} />
              Connect
            </>
          )}
        </button>
      </div>

      <ByoSettingsModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        meta={meta}
        config={config}
        organizationId={organizationId}
        canEdit={canEdit}
      />
    </>
  );
};

// "Request a custom integration" CTA card — same chrome as the other rows so
// the page reads as one continuous shelf. mailto: keeps this dependency-free;
// in production this would open a sales-form modal.
const CustomProviderCard = ({
  locked,
  canEdit,
}: {
  locked: boolean;
  canEdit: boolean;
}) => {
  const disabled = locked || !canEdit;
  return (
    <div
      className={`bg-white rounded-2xl border border-gray-200 p-5 flex flex-col gap-4 ${
        locked ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center shrink-0">
            <Sparkles size={18} />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-gray-900 truncate">
              Request a custom integration
            </div>
            <div className="text-[11px] uppercase tracking-wide text-gray-400">
              Bespoke
            </div>
          </div>
        </div>
        {locked && (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-gray-200 text-gray-600 shrink-0">
            <Lock size={11} /> Locked
          </span>
        )}
      </div>

      <p className="text-xs text-gray-500 flex-1">
        Bring any KYC, AML, fraud or device-fingerprinting vendor you already
        work with — our team scopes the connector, deploys it for your
        workspace, and wires it into the workflow engine.
      </p>

      <a
        href={
          disabled
            ? undefined
            : "mailto:sales@usercore.local?subject=Custom%20provider%20integration"
        }
        aria-disabled={disabled}
        onClick={(e) => {
          if (disabled) e.preventDefault();
        }}
        className={`inline-flex items-center justify-center gap-1.5 text-sm py-2 px-3 rounded-lg border ${
          disabled
            ? "opacity-50 cursor-not-allowed border-gray-200 bg-white text-gray-500"
            : "border-violet-300 bg-violet-100 hover:bg-violet-200 text-violet-900"
        }`}
      >
        <Mail size={14} />
        Contact sales
      </a>
    </div>
  );
};

type ByoSettingsModalProps = {
  open: boolean;
  onClose: () => void;
  meta: ProviderMeta;
  config: ProviderConfiguration | null;
  organizationId: string;
  canEdit: boolean;
};

const ByoSettingsModal = ({
  open,
  onClose,
  meta,
  config,
  organizationId,
  canEdit,
}: ByoSettingsModalProps) => {
  const upsert = useUpsertProviderConfiguration();
  const remove = useDeleteProviderConfiguration();

  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");

  // Reset draft when the modal opens — stops a stale "type to replace" from
  // a previous open leaking into a fresh edit.
  useEffect(() => {
    if (open) {
      setApiKey("");
      setApiSecret("");
    }
  }, [open]);

  const isConfigured = !!config?.apiKey;

  const onSave = () => {
    if (!canEdit) return;
    upsert.mutate(
      {
        organizationId,
        provider: meta.provider,
        apiKey: apiKey.length > 0 ? apiKey : (config?.apiKey ?? null),
        apiSecret:
          apiSecret.length > 0 ? apiSecret : (config?.apiSecret ?? null),
        // The org-level "enabled" flag is no longer load-bearing — BYO is
        // chosen per workflow step. We always store true so old code paths
        // that still read the column keep behaving consistently.
        enabled: true,
      },
      {
        onSuccess: () => {
          setApiKey("");
          setApiSecret("");
        },
      },
    );
  };

  const onDisconnect = () => {
    if (!canEdit) return;
    remove.mutate({ organizationId, provider: meta.provider });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={meta.name}
      subtitle={`${meta.category} · bring-your-own credentials`}
      footer={
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <button
            type="button"
            onClick={onSave}
            disabled={!canEdit || upsert.isPending}
            className="inline-flex items-center gap-1.5 text-sm py-2 px-3 rounded-lg border border-primary-300 bg-primary-100 hover:bg-primary-200 text-primary-900 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {upsert.isPending ? "Saving…" : "Save changes"}
          </button>
          {canEdit && isConfigured && (
            <button
              type="button"
              onClick={onDisconnect}
              disabled={remove.isPending}
              className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-red-600 py-1.5 px-2 rounded-lg hover:bg-red-50 disabled:opacity-50"
            >
              <XCircle size={12} />
              Disconnect
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        {!canEdit && (
          <div className="flex items-center gap-2 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
            <Lock size={12} /> Only owners and admins can edit provider
            credentials.
          </div>
        )}

        <p className="text-xs text-gray-500">{meta.description}</p>

        <div>
          <label
            htmlFor={`${meta.provider}-drawer-key`}
            className="block text-xs font-medium text-gray-700 mb-1.5"
          >
            API key
          </label>
          <input
            id={`${meta.provider}-drawer-key`}
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            disabled={!canEdit}
            placeholder={
              config?.apiKey
                ? `Stored — currently ${config.apiKey}. Type to replace.`
                : "Paste your API key…"
            }
            className="w-full px-3 py-2 text-sm font-mono border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 disabled:bg-gray-100 disabled:cursor-not-allowed placeholder:text-gray-400 bg-white"
          />
        </div>

        {meta.needsSecret && (
          <div>
            <label
              htmlFor={`${meta.provider}-drawer-secret`}
              className="block text-xs font-medium text-gray-700 mb-1.5"
            >
              API secret
            </label>
            <input
              id={`${meta.provider}-drawer-secret`}
              type="password"
              value={apiSecret}
              onChange={(e) => setApiSecret(e.target.value)}
              disabled={!canEdit}
              placeholder={
                config?.apiSecret
                  ? `Stored — currently ${config.apiSecret}. Type to replace.`
                  : "Paste your API secret…"
              }
              className="w-full px-3 py-2 text-sm font-mono border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 disabled:bg-gray-100 disabled:cursor-not-allowed placeholder:text-gray-400 bg-white"
            />
          </div>
        )}

        <div className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
          Credentials are saved here; choose which workflow steps actually route
          through them in the workflow editor.
        </div>
      </div>
    </Modal>
  );
};
