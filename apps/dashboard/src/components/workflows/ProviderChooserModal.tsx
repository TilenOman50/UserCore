import { CheckCircle2, Lock, Plug2, Shield } from "lucide-react";
import { Link } from "react-router-dom";

import { useProviderConfigurations } from "../../lib/hooks/useProviderConfigurations";
import type {
  ProviderCredentialMode,
  ProviderShortName,
} from "../../lib/hooks/useWorkflows";
import {
  PROVIDER_META,
  USERCORE_ICON_URL,
  type ProviderMeta,
} from "../../lib/providerMeta";
import { useWorkspace } from "../../lib/workspaceContext";
import { Modal } from "../Modal";

type Props = {
  open: boolean;
  onClose: () => void;
  // shortName of the provider available for this step type. The chooser
  // surfaces two modes for the same provider — managed and BYO — and the
  // user picks one. Each mode sets step.providerCredentialMode separately.
  provider: ProviderShortName;
  // Pre-fills the "this is what you'd be connecting to" copy.
  stepLabel: string;
  // True when the step is already wired to this provider — used to mark the
  // currently-connected mode with a "Connected" badge.
  isConnected: boolean;
  // Which mode the step is currently using. Defaults to "managed" for new
  // steps; matters when the step is already connected so we render the
  // right "Connected" mark.
  currentMode: ProviderCredentialMode;
  onConfirm: (mode: ProviderCredentialMode) => void;
  canEdit: boolean;
};

export const ProviderChooserModal = ({
  open,
  onClose,
  provider,
  stepLabel,
  isConnected,
  currentMode,
  onConfirm,
  canEdit,
}: Props) => {
  const { organization } = useWorkspace();
  const orgId = organization?.id ?? null;
  const configsQuery = useProviderConfigurations(open ? orgId : null);
  const meta = PROVIDER_META[provider];

  // BYO is offerable when the org has credentials saved. The org-wide
  // "enabled" toggle no longer exists — saving credentials is the sole
  // gate, and BYO is then chosen per-step.
  const config = configsQuery.data?.find((c) => c.provider === provider);
  const byoAvailable = !!config?.apiKey;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Connect a provider — ${stepLabel}`}
      subtitle={meta.description}
      maxWidth="xl"
    >
      <div className="space-y-3">
        <ModeCard
          meta={meta}
          mode="managed"
          available
          isActive={isConnected && currentMode === "managed"}
          onPick={() => {
            if (!canEdit) return;
            onConfirm("managed");
            onClose();
          }}
          canEdit={canEdit}
        />
        <ModeCard
          meta={meta}
          mode="byo"
          available={byoAvailable}
          isActive={isConnected && currentMode === "byo"}
          onPick={() => {
            if (!canEdit || !byoAvailable) return;
            onConfirm("byo");
            onClose();
          }}
          canEdit={canEdit}
        />
      </div>
    </Modal>
  );
};

type ModeCardProps = {
  meta: ProviderMeta;
  mode: "managed" | "byo";
  available: boolean;
  isActive: boolean;
  onPick: () => void;
  canEdit: boolean;
};

const ModeCard = ({
  meta,
  mode,
  available,
  isActive,
  onPick,
  canEdit,
}: ModeCardProps) => {
  const title =
    mode === "managed" ? meta.managedName : `${meta.name} (your account)`;
  const description =
    mode === "managed"
      ? "Runs on UserCore's credentials — included in your plan."
      : "Routes through your own provider account so you're billed directly.";
  const disabled = !available || !canEdit;

  return (
    <div
      className={`flex items-stretch gap-3 p-4 rounded-2xl border ${
        isActive
          ? "border-primary-300 bg-primary-50 shadow-sm"
          : "border-gray-200 bg-white"
      } ${disabled ? "opacity-70" : ""}`}
    >
      <ModeAvatar meta={meta} mode={mode} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-gray-900">{title}</span>
          {mode === "managed" ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-primary-100 text-primary-700">
              <Shield size={11} /> Always available
            </span>
          ) : available ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-violet-100 text-violet-700">
              <CheckCircle2 size={11} /> Configured
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-gray-200 text-gray-600">
              <Lock size={11} /> Not configured
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-1">{description}</p>
        {mode === "byo" && !available && (
          <p className="text-xs text-gray-400 mt-2">
            Add credentials in{" "}
            <Link
              to="/settings/providers"
              className="text-primary-700 hover:text-primary-800 font-medium"
            >
              Providers
            </Link>{" "}
            to enable this option.
          </p>
        )}
      </div>
      <div className="flex items-center shrink-0">
        <button
          type="button"
          onClick={onPick}
          disabled={disabled}
          className={`inline-flex items-center gap-1.5 text-sm py-2 px-3 rounded-lg border disabled:opacity-50 disabled:cursor-not-allowed ${
            isActive
              ? "border-primary-300 bg-primary-100 text-primary-900"
              : "border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
          }`}
        >
          {isActive ? (
            <>
              <CheckCircle2 size={14} /> Connected
            </>
          ) : (
            <>
              <Plug2 size={14} /> Use this
            </>
          )}
        </button>
      </div>
    </div>
  );
};

// Managed mode: UserCore tile + small vendor badge.
// BYO mode: vendor tile on its own.
const ModeAvatar = ({
  meta,
  mode,
}: {
  meta: ProviderMeta;
  mode: "managed" | "byo";
}) => {
  if (mode === "managed") {
    return (
      <div className="relative shrink-0">
        <img
          src={USERCORE_ICON_URL}
          alt="UserCore"
          className="w-12 h-12 rounded-xl object-contain bg-white"
        />
        <img
          src={meta.iconUrl}
          alt={meta.name}
          className="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full object-contain bg-white ring-2 ring-white shadow-sm"
        />
      </div>
    );
  }
  return (
    <img
      src={meta.iconUrl}
      alt={meta.name}
      className="w-12 h-12 rounded-xl object-contain bg-white shrink-0"
    />
  );
};
