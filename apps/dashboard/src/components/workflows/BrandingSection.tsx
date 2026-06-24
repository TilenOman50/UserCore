import { useEffect, useRef, useState } from "react";
import { ChevronDown, Lock, Palette, RotateCcw, Upload, X } from "lucide-react";

import { UPGRADE_HINT, usePlan } from "../../lib/hooks/usePlan";
import {
  useBrandingLogoUrl,
  useUpdateWorkflow,
  useUploadBrandingLogo,
  type WorkflowBranding,
} from "../../lib/hooks/useWorkflows";
import { PlanBadge } from "../PlanBadge";

type Props = {
  workflowId: string;
  branding: WorkflowBranding;
  canEdit: boolean;
};

const DEFAULT_PRIMARY = "#C0E1D2";
const DEFAULT_SECONDARY = "#D9F0E7";

// Widget branding editor. Plan-gated:
//   STARTER     → all controls disabled, "Locked" hint, default look only
//   GROWTH      → brand name + logo + primary colour editable
//   ENTERPRISE  → also enables the "Hide Powered by UserCore" toggle
export const BrandingSection = ({ workflowId, branding, canEdit }: Props) => {
  const { features } = usePlan();
  const updateWorkflow = useUpdateWorkflow();
  const uploadLogo = useUploadBrandingLogo();
  const logoUrlQuery = useBrandingLogoUrl(
    branding.logoS3Key ? workflowId : null,
  );

  // Local draft of editable string fields; debounced into the PATCH so
  // typing isn't a write storm.
  const [brandName, setBrandName] = useState(branding.brandName ?? "");
  const [primaryColor, setPrimaryColor] = useState(
    branding.primaryColor ?? DEFAULT_PRIMARY,
  );
  const [secondaryColor, setSecondaryColor] = useState(
    branding.secondaryColor ?? DEFAULT_SECONDARY,
  );
  const [senderEmail, setSenderEmail] = useState(branding.senderEmail ?? "");
  // Sync local state when the parent re-fetches the workflow.
  useEffect(() => {
    setBrandName(branding.brandName ?? "");
    setPrimaryColor(branding.primaryColor ?? DEFAULT_PRIMARY);
    setSecondaryColor(branding.secondaryColor ?? DEFAULT_SECONDARY);
    setSenderEmail(branding.senderEmail ?? "");
  }, [
    branding.brandName,
    branding.primaryColor,
    branding.secondaryColor,
    branding.senderEmail,
  ]);

  const customBranding = features.customBranding && canEdit;
  const whiteLabel = features.whiteLabel && canEdit;
  const locked = !features.customBranding;

  const fileRef = useRef<HTMLInputElement>(null);

  // Mirror the latest `branding` prop into a ref so the debounce timer
  // below reads the post-reset value (not the stale value captured when the
  // timer was scheduled). Without this, clicking Reset triggers an
  // immediate PATCH that clears everything, then the still-pending 600ms
  // debounce closure runs with the OLD branding and partially restores it.
  const brandingRef = useRef(branding);
  useEffect(() => {
    brandingRef.current = branding;
  }, [branding]);

  // Debounced field PATCH: 600ms after the last keystroke / colour pick.
  useEffect(() => {
    if (!customBranding) return;
    const t = setTimeout(() => {
      const current = brandingRef.current;
      const trimmedName = brandName.trim();
      const trimmedSender = senderEmail.trim();
      // Validate the email shape locally — Better to keep stale-but-good
      // server state than push gibberish. Server still re-validates.
      const senderValid =
        trimmedSender.length === 0 ||
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedSender);
      const next: WorkflowBranding = {
        ...current,
        brandName: trimmedName.length > 0 ? trimmedName : null,
        primaryColor:
          primaryColor.toUpperCase() === DEFAULT_PRIMARY.toUpperCase()
            ? null
            : primaryColor,
        secondaryColor:
          secondaryColor.toUpperCase() === DEFAULT_SECONDARY.toUpperCase()
            ? null
            : secondaryColor,
        senderEmail:
          senderValid && trimmedSender.length > 0 ? trimmedSender : null,
      };
      // Only PATCH if anything actually changed — avoids hot-reload write loops.
      const same =
        (next.brandName ?? null) === (current.brandName ?? null) &&
        (next.primaryColor ?? null) === (current.primaryColor ?? null) &&
        (next.secondaryColor ?? null) === (current.secondaryColor ?? null) &&
        (next.senderEmail ?? null) === (current.senderEmail ?? null);
      if (same) return;
      updateWorkflow.mutate({ workflowId, patch: { branding: next } });
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandName, primaryColor, secondaryColor, senderEmail]);

  const onLogoSelected = async (file: File) => {
    await uploadLogo.mutateAsync({ workflowId, file });
  };

  const removeLogo = () => {
    updateWorkflow.mutate({
      workflowId,
      patch: { branding: { ...branding, logoS3Key: null } },
    });
  };

  const setHidePoweredBy = (hide: boolean) => {
    updateWorkflow.mutate({
      workflowId,
      patch: { branding: { ...branding, hidePoweredBy: hide } },
    });
  };

  const hasOverrides = !!(
    branding.brandName ||
    branding.logoS3Key ||
    branding.primaryColor ||
    branding.secondaryColor ||
    branding.hidePoweredBy ||
    branding.senderEmail
  );

  const handleReset = () => {
    setBrandName("");
    setPrimaryColor(DEFAULT_PRIMARY);
    setSecondaryColor(DEFAULT_SECONDARY);
    setSenderEmail("");
    updateWorkflow.mutate({ workflowId, patch: { branding: {} } });
  };

  const [expanded, setExpanded] = useState(false);

  return (
    <section className="mb-6">
      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
        Widget branding
      </h3>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div
          className="w-full flex items-start gap-4 p-5 cursor-pointer hover:bg-gray-50"
          onClick={() => setExpanded((v) => !v)}
        >
          <div className="w-10 h-10 rounded-xl bg-gray-50 border-2 border-gray-200 flex items-center justify-center shrink-0 text-gray-700">
            <Palette size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-gray-900">
                Widget appearance
              </span>
              {locked && (
                <span
                  className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-gray-200 text-gray-600"
                  title={UPGRADE_HINT}
                >
                  <Lock size={11} />
                  Locked
                </span>
              )}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Logo, colours, brand name, verification email sender, and footer
              attribution.
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {customBranding && hasOverrides && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleReset();
                }}
                className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-red-600 py-1.5 px-2 rounded-lg hover:bg-red-50"
                title="Reset all branding to defaults"
              >
                <RotateCcw size={12} />
                Reset
              </button>
            )}
            <ChevronDown
              size={18}
              className={`text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`}
            />
          </div>
        </div>

        {expanded && (
          <div className="border-t border-gray-100 bg-gray-50/50 p-5 grid grid-cols-2 gap-6">
            <div
              className={`col-span-2 ${!customBranding ? "opacity-60" : ""}`}
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <label className="block text-xs font-medium text-gray-700">
                  Brand name
                </label>
                {!customBranding && <PlanBadge plan="GROWTH" />}
              </div>
              <input
                type="text"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                disabled={!customBranding}
                placeholder="UserCore Verification"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 disabled:bg-gray-100 disabled:cursor-not-allowed placeholder:text-gray-300"
              />
              <p className="mt-1 text-xs text-gray-400">
                Shown next to the logo in the widget header.
              </p>
            </div>

            <ColorRow
              label="Primary colour"
              hint="Used on the main widget button and brand-tinted backgrounds."
              value={primaryColor}
              onChange={setPrimaryColor}
              placeholder={DEFAULT_PRIMARY}
              disabled={!customBranding}
              pill={!customBranding ? <PlanBadge plan="GROWTH" /> : null}
            />

            <ColorRow
              label="Secondary colour"
              hint="Used on borders and focus outlines."
              value={secondaryColor}
              onChange={setSecondaryColor}
              placeholder={DEFAULT_SECONDARY}
              disabled={!customBranding}
              pill={!customBranding ? <PlanBadge plan="GROWTH" /> : null}
            />

            <div
              className={`col-span-2 ${!customBranding ? "opacity-60" : ""}`}
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <label className="block text-xs font-medium text-gray-700">
                  Logo
                </label>
                {!customBranding && <PlanBadge plan="GROWTH" />}
              </div>
              <div className="flex items-center gap-3">
                <div className="w-20 h-20 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden shrink-0">
                  {logoUrlQuery.data?.url ? (
                    <img
                      src={logoUrlQuery.data.url}
                      alt="Brand logo"
                      className="max-w-full max-h-full object-contain"
                    />
                  ) : (
                    <span className="text-2xl font-bold text-primary-700">
                      UC
                    </span>
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <button
                    type="button"
                    disabled={!customBranding || uploadLogo.isPending}
                    onClick={() => fileRef.current?.click()}
                    className="inline-flex items-center gap-2 text-sm py-1.5 px-3 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Upload size={14} />
                    {uploadLogo.isPending
                      ? "Uploading…"
                      : branding.logoS3Key
                        ? "Replace logo"
                        : "Upload logo"}
                  </button>
                  {branding.logoS3Key && customBranding && (
                    <button
                      type="button"
                      onClick={removeLogo}
                      className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-red-600"
                    >
                      <X size={12} />
                      Remove
                    </button>
                  )}
                  <p className="text-xs text-gray-400">
                    Square PNG works best — anything ≤ 1 MB.
                  </p>
                </div>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onLogoSelected(f);
                }}
                className="hidden"
              />
            </div>

            <div
              className={`col-span-2 p-3 rounded-lg border border-gray-200 bg-gray-50 ${
                !whiteLabel ? "opacity-60" : ""
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <label
                  htmlFor="branding-sender-email"
                  className="block text-sm font-medium text-gray-900"
                >
                  Verification email sender
                </label>
                {!whiteLabel && <PlanBadge plan="ENTERPRISE" />}
              </div>
              <p className="text-xs text-gray-500 mb-2">
                Customers receive the OTP email from this address — match it to
                your own domain (e.g. <code>noreply@yourcompany.com</code>) so
                recipients trust it as coming from you, not a third party.
              </p>
              <input
                id="branding-sender-email"
                type="email"
                value={senderEmail}
                onChange={(e) => setSenderEmail(e.target.value)}
                disabled={!whiteLabel}
                placeholder="noreply@yourbrand.com"
                title={!whiteLabel ? UPGRADE_HINT : undefined}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 disabled:bg-gray-100 disabled:cursor-not-allowed placeholder:text-gray-300 bg-white"
              />
            </div>

            <div
              className={`col-span-2 flex items-start justify-between gap-3 p-3 rounded-lg border border-gray-200 bg-gray-50 ${
                !whiteLabel ? "opacity-60" : ""
              }`}
            >
              <div>
                <div className="flex items-center gap-1.5">
                  <div className="text-sm font-medium text-gray-900">
                    Hide &quot;Powered by UserCore&quot; footer
                  </div>
                  {!whiteLabel && <PlanBadge plan="ENTERPRISE" />}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  Remove the UserCore attribution from the widget chrome.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={!!branding.hidePoweredBy}
                disabled={!whiteLabel}
                onClick={() => setHidePoweredBy(!branding.hidePoweredBy)}
                title={!whiteLabel ? UPGRADE_HINT : undefined}
                className={`relative inline-flex h-5 w-9 shrink-0 self-center items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-200 disabled:cursor-not-allowed disabled:opacity-50 ${
                  branding.hidePoweredBy ? "bg-primary-500" : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    branding.hidePoweredBy ? "translate-x-4" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

const ColorRow = ({
  label,
  hint,
  value,
  onChange,
  placeholder,
  disabled,
  pill,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  disabled?: boolean;
  pill?: React.ReactNode;
}) => (
  <div className={disabled ? "opacity-60" : undefined}>
    <div className="flex items-center gap-1.5 mb-1.5">
      <label className="block text-xs font-medium text-gray-700">{label}</label>
      {pill}
    </div>
    <div className="flex items-stretch gap-2">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-12 h-9 rounded-lg border border-gray-200 cursor-pointer disabled:cursor-not-allowed"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className="flex-1 px-3 py-2 text-sm font-mono border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 disabled:bg-gray-100 disabled:cursor-not-allowed"
      />
    </div>
    <p className="mt-1 text-xs text-gray-400">{hint}</p>
  </div>
);
