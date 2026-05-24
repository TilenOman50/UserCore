import type { ComponentType, ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Copy,
  IdCard,
  Loader2,
  MinusCircle,
  ScanEye,
  ScanFace,
  Search,
  Settings2,
  Shield,
  XCircle,
} from "lucide-react";

import type { WorkflowSessionStep } from "../lib/hooks/useWorkflowSessions";

type StepStatus = WorkflowSessionStep["status"];

export type CheckItem = {
  key: string;
  label: string;
  status: StepStatus;
  // Expected at submission but the workflow no longer includes it and it never
  // ran — can't run now, so it's shown as N/A rather than "Not yet run".
  skipped?: boolean;
};

const SKIPPED_STYLE = {
  circle: "bg-gray-100 text-gray-400",
  text: "text-gray-400",
  icon: <MinusCircle size={13} />,
  label: "Skipped",
};

// Type icon per check — mirrors the icons the workflow editor uses.
const NODE_ICON: Record<
  string,
  ComponentType<{ size?: number; className?: string }>
> = {
  "id-scan": IdCard,
  "face-scan": ScanFace,
  liveness: ScanEye,
  "aml-screening": Shield,
  "fraud-detection": Search,
  "duplicate-detection": Copy,
  "rules-engine": Settings2,
};

const STATUS: Record<
  StepStatus,
  { circle: string; text: string; icon: ReactNode; label: string }
> = {
  // Success uses emerald (distinct from the brand green) so a passed check is
  // unmistakable rather than blending into the green-themed UI.
  SUCCEEDED: {
    circle: "bg-emerald-50 text-emerald-600",
    text: "text-emerald-700",
    icon: <CheckCircle2 size={13} />,
    label: "Passed",
  },
  FAILED: {
    circle: "bg-red-50 text-red-600",
    text: "text-red-700",
    icon: <XCircle size={13} />,
    label: "Failed",
  },
  REQUIRES_REVIEW: {
    circle: "bg-yellow-50 text-yellow-600",
    text: "text-yellow-700",
    icon: <AlertTriangle size={13} />,
    label: "Needs review",
  },
  IN_PROGRESS: {
    circle: "bg-gray-100 text-gray-500",
    text: "text-gray-500",
    icon: <Loader2 size={13} className="animate-spin" />,
    label: "Running",
  },
  PENDING: {
    circle: "bg-gray-100 text-gray-400",
    text: "text-gray-400",
    icon: <Circle size={13} />,
    label: "Not yet run",
  },
};

// Reusable checks grid — used on the KYC review detail page and the customer
// detail page. Cards are neutral; colour lives only in the status accent so the
// outcome reads clearly regardless of how many checks there are.
export const ChecksPanel = ({
  checks,
  className,
}: {
  checks: CheckItem[];
  className?: string;
}) => {
  if (checks.length === 0) return null;

  return (
    <div className={className}>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {checks.map((c) => {
          const s = c.skipped ? SKIPPED_STYLE : STATUS[c.status];
          const Icon = NODE_ICON[c.key];
          return (
            <div
              key={c.key}
              className="flex items-center gap-2.5 rounded-lg border border-gray-200 px-3 py-2.5"
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${s.circle}`}
              >
                {Icon ? <Icon size={15} /> : <Circle size={15} />}
              </span>
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-gray-900">
                  {c.label}
                </div>
                <div
                  className={`inline-flex items-center gap-1 text-xs ${s.text}`}
                >
                  {s.icon} {s.label}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
