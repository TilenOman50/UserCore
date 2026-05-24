import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Check, ChevronDown, Clock, Flag, X } from "lucide-react";
import { createPortal } from "react-dom";

import type { CustomerRiskLevel, KycStatus } from "@usercore/shared-types";

import { useUpdateCustomerClassification } from "../lib/hooks/useCustomers";

// Shared KYC-status + risk display maps and the inline-editable badges used in
// the customers table and the customer detail header. Single source of truth so
// the two stay visually identical.
export const STATUS_LABELS: Record<KycStatus, string> = {
  not_started: "Not started",
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  flagged: "Flagged",
};
export const STATUS_BADGE: Record<KycStatus, string> = {
  not_started: "bg-gray-100 text-gray-600",
  pending: "bg-yellow-100 text-yellow-700",
  approved: "bg-primary-100 text-primary-700",
  rejected: "bg-red-100 text-red-700",
  flagged: "bg-orange-100 text-orange-700",
};
export const STATUS_ICON: Record<KycStatus, ReactNode> = {
  not_started: <Clock size={12} />,
  pending: <Clock size={12} />,
  approved: <Check size={12} />,
  rejected: <X size={12} />,
  flagged: <Flag size={12} />,
};
export const RISK_LABELS: Record<CustomerRiskLevel, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};
export const RISK_BADGE: Record<CustomerRiskLevel, string> = {
  low: "bg-primary-100 text-primary-700",
  medium: "bg-yellow-100 text-yellow-700",
  high: "bg-red-100 text-red-700",
};

// Reviewer-selectable values (the realistic manual overrides).
const STATUS_EDIT_VALUES: KycStatus[] = ["approved", "rejected", "flagged"];
const RISK_EDIT_VALUES: CustomerRiskLevel[] = ["low", "medium", "high"];

// Inline-editable badge: shows the current value as a pill, opens a small menu
// (rendered in a portal so a parent's overflow-hidden can't clip it) to switch.
function InlineEditBadge<T extends string>({
  current,
  currentCls,
  currentIcon,
  currentLabel,
  options,
  onSelect,
  pending,
}: {
  current: T | null;
  currentCls: string;
  currentIcon: ReactNode;
  currentLabel: ReactNode;
  options: { value: T; label: string; icon: ReactNode; cls: string }[];
  onSelect: (value: T) => void;
  pending?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (
        !btnRef.current?.contains(e.target as Node) &&
        !menuRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 4, left: r.left });
    setOpen((v) => !v);
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        disabled={pending}
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-shadow hover:ring-2 hover:ring-gray-200 ${currentCls} ${
          pending ? "opacity-60" : ""
        }`}
      >
        {currentIcon}
        {currentLabel}
        <ChevronDown size={11} className="opacity-50" />
      </button>
      {open &&
        pos &&
        createPortal(
          <div
            ref={menuRef}
            style={{ top: pos.top, left: pos.left }}
            className="fixed z-50 w-40 overflow-hidden rounded-xl border border-gray-200 bg-white p-1 shadow-lg ring-1 ring-black/5"
            onClick={(e) => e.stopPropagation()}
          >
            {options.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                  if (o.value !== current) onSelect(o.value);
                }}
                className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-gray-50"
              >
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${o.cls}`}
                >
                  {o.icon}
                  {o.label}
                </span>
                {o.value === current && (
                  <Check size={14} className="text-primary-600" />
                )}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}

export const StatusSelectBadge = ({
  customerId,
  status,
}: {
  customerId: string;
  status: KycStatus;
}) => {
  const update = useUpdateCustomerClassification();
  return (
    <InlineEditBadge
      current={status}
      currentCls={STATUS_BADGE[status]}
      currentIcon={STATUS_ICON[status]}
      currentLabel={STATUS_LABELS[status]}
      options={STATUS_EDIT_VALUES.map((v) => ({
        value: v,
        label: STATUS_LABELS[v],
        icon: STATUS_ICON[v],
        cls: STATUS_BADGE[v],
      }))}
      pending={update.isPending}
      onSelect={(v) => update.mutate({ customerId, kycStatus: v })}
    />
  );
};

export const RiskSelectBadge = ({
  customerId,
  riskLevel,
}: {
  customerId: string;
  riskLevel: CustomerRiskLevel | null;
}) => {
  const update = useUpdateCustomerClassification();
  return (
    <InlineEditBadge
      current={riskLevel}
      currentCls={
        riskLevel
          ? RISK_BADGE[riskLevel]
          : "bg-gray-50 text-gray-400 ring-1 ring-inset ring-gray-200"
      }
      currentIcon={null}
      currentLabel={riskLevel ? RISK_LABELS[riskLevel] : "—"}
      options={RISK_EDIT_VALUES.map((v) => ({
        value: v,
        label: RISK_LABELS[v],
        icon: null,
        cls: RISK_BADGE[v],
      }))}
      pending={update.isPending}
      onSelect={(v) => update.mutate({ customerId, riskLevel: v })}
    />
  );
};
