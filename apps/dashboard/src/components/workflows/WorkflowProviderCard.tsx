import { CheckCircle2, Lock, Plug2, type LucideIcon } from "lucide-react";

import { UPGRADE_HINT } from "../../lib/hooks/usePlan";
import type {
  ProviderCredentialMode,
  ProviderShortName,
} from "../../lib/hooks/useWorkflows";
import { PROVIDER_META, USERCORE_ICON_URL } from "../../lib/providerMeta";

// Card rendered inside a workflow step's "Provider" section. Visually
// mirrors the Providers page chrome so the operator sees a consistent
// language: same logo, same mode badge, same Connect/Connected button
// shape. Two variants:
//   - "no-provider" → manual review / step skipped
//   - "provider"    → connects to the single provider available for this
//                     step type, with mode awareness ("Managed" vs "BYO")

type NoProviderProps = {
  variant: "no-provider";
  label: string;
  description: string;
  selected: boolean;
  icon: LucideIcon;
  onClick: () => void;
  readOnly: boolean;
};

type ProviderProps = {
  variant: "provider";
  provider: ProviderShortName;
  // Currently selected on the step
  selected: boolean;
  // Plan-level gating — STARTER can't use any providers
  locked: boolean;
  readOnly: boolean;
  // The step's saved credential mode (managed/byo). Drives the avatar +
  // headline + tagline so the card reflects how this specific step will
  // dispatch — regardless of how other steps in the workflow are wired.
  mode: ProviderCredentialMode;
  onClick: () => void;
};

export const WorkflowProviderCard = (
  props: NoProviderProps | ProviderProps,
) => {
  if (props.variant === "no-provider") {
    return <NoProviderCard {...props} />;
  }
  return <ProviderModeCard {...props} />;
};

const NoProviderCard = ({
  label,
  description,
  selected,
  icon: Icon,
  onClick,
  readOnly,
}: Omit<NoProviderProps, "variant">) => (
  <button
    type="button"
    onClick={onClick}
    disabled={readOnly}
    title={
      readOnly ? "Only owners and admins can change providers." : undefined
    }
    className={`p-4 rounded-2xl border text-left transition-colors flex flex-col gap-3 ${
      selected
        ? "border-primary-400 bg-primary-50 ring-2 ring-primary-200"
        : "border-gray-200 bg-white hover:border-primary-300"
    } ${readOnly ? "cursor-not-allowed opacity-70" : ""}`}
  >
    <div className="flex items-center gap-3">
      <div className="w-12 h-12 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0 text-gray-600">
        <Icon size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-gray-900">{label}</div>
        {selected && (
          <div className="text-[11px] uppercase tracking-wide text-primary-700 font-semibold mt-0.5">
            Selected
          </div>
        )}
      </div>
    </div>
    <p className="text-xs text-gray-500">{description}</p>
  </button>
);

const ProviderModeCard = ({
  provider,
  selected,
  locked,
  readOnly,
  mode,
  onClick,
}: Omit<ProviderProps, "variant">) => {
  const meta = PROVIDER_META[provider];

  const disabled = locked || readOnly;
  const title = locked
    ? UPGRADE_HINT
    : readOnly
      ? "Only owners and admins can change providers."
      : undefined;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-4 rounded-2xl border text-left transition-colors flex flex-col gap-3 ${
        locked
          ? "border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed"
          : selected
            ? "border-primary-400 bg-primary-50 ring-2 ring-primary-200"
            : "border-gray-200 bg-white hover:border-primary-300"
      } ${readOnly && !locked ? "cursor-not-allowed opacity-70" : ""}`}
    >
      <div className="flex items-center gap-3">
        <ProviderAvatar
          provider={provider}
          mode={selected ? mode : "managed"}
        />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-gray-900 truncate">
            {selected && mode === "byo" ? meta.name : meta.managedName}
          </div>
          <div className="text-[11px] uppercase tracking-wide text-gray-400 truncate">
            {meta.category}
          </div>
        </div>
        {locked ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-gray-200 text-gray-600 shrink-0">
            <Lock size={11} /> Locked
          </span>
        ) : selected ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-primary-100 text-primary-700 shrink-0">
            <CheckCircle2 size={11} /> Connected
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 shrink-0">
            <Plug2 size={11} /> Connect
          </span>
        )}
      </div>
      <p className="text-xs text-gray-500">
        {selected
          ? mode === "byo"
            ? "Routing through your account — billed directly by the provider."
            : "Routing through UserCore's managed credentials — included in your plan."
          : meta.description}
      </p>
    </button>
  );
};

// Same avatar treatment as the Providers page: UserCore tile + small
// vendor badge in managed mode; bare vendor tile in BYO mode.
const ProviderAvatar = ({
  provider,
  mode,
}: {
  provider: ProviderShortName;
  mode: "managed" | "byo";
}) => {
  const meta = PROVIDER_META[provider];
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
